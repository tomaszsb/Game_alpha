# AI Collaboration Workflow: Hybrid Model

**Version:** 3.0
**Date:** 2025-10-07
**Updated:** v9.0 Phase 1 Stabilization - Email-style format exclusive

## 1. Overview

This document outlines the hybrid communication and collaboration model between Gemini (Project Manager) and Claude (Lead Programmer). Our goal is to leverage the unique strengths of each AI to maximize efficiency and analytical capability.

We will use two primary methods of interaction:

1.  **Email-style Messaging:** For standard, day-to-day communication, including task assignment, status updates, queries, and bug reports.
2.  **Gemini CLI Pipeline Mode:** For large-scale analysis tasks that require a context window larger than what is available to Claude.

## 2. Communication Methods

### 2.1. Email-style Messaging (Standard Workflow)

- **Purpose:** Coordination, tasking, and status updates.
- **Mechanism:** Asynchronous exchange of email-style text files via the `ai-bridge/.server/` directory structure.
- **Format:** Email-style headers with message content (exclusive format as of v9.0)
- **File Extension:** `.txt` (JSON support removed in v9.0)
- **When to use:** This is the default method for all communication unless a task meets the criteria for CLI Pipeline Mode.

**Message Format:**
```
ID: message-id-timestamp
From: sender-name
To: recipient-name
Subject: message-title

message content here
no escaping needed
can use any characters
```

**Advantages of Email Format:**
- ✅ Human-readable and easy to parse
- ✅ No escaping issues with quotes or special characters
- ✅ Simple line-by-line parsing
- ✅ Multi-line content support
- ✅ Works perfectly with shell commands and special characters

### 2.2. Gemini CLI Pipeline Mode (Heavy Analysis Workflow)

- **Purpose:** To leverage Gemini's large context window for deep codebase analysis, multi-file comparisons, and other high-complexity analytical tasks.
- **Mechanism:** A structured hand-off process where Claude requests Gemini to execute a command-line prompt.

## 3. CLI Pipeline Workflow

This section defines the protocol for initiating, executing, and returning the results of a Gemini CLI task.

### 3.1. Trigger Conditions

Claude should initiate a Gemini CLI task when a request meets one or more of the following criteria:

- **Large File Analysis:** The analysis involves one or more files exceeding **150KB** in size.
- **Multi-File Analysis:** The analysis requires understanding the relationships between more than **10** files simultaneously.
- **Codebase-Wide Analysis:** The task requires a holistic understanding of the entire `src/` directory or other large segments of the codebase.
- **Complex Refactoring Planning:** The task involves planning a complex refactoring that touches many different parts of the application.

*(Note: These thresholds are initial estimates and can be adjusted based on experience.)*

### 3.2. Hand-off Protocol (Claude to Gemini)

When a trigger condition is met, Claude will send an **email-style message** to Gemini with the `Subject` field set to `CLI Request`.

The message content will contain the request details in a structured format:

```
ID: claude-cli-20251007-030000
From: claude
To: gemini
Subject: CLI Request

Request ID: cli-20251007-030000
Command: gemini -p "<prompt>"

Prompt:
<The detailed, self-contained prompt for Gemini to execute>

Output Format: markdown | json | text
Expected Output: <A brief description of what the expected output should be>
```

### 3.3. Execution (Gemini)

Upon receiving a `cli_request`, I will:

1.  Extract the `prompt` from the message.
2.  Execute the command `gemini -p "<prompt>"` using the `run_shell_command` tool.
3.  Capture the output.

### 3.4. Return Protocol (Gemini to Claude)

After execution, Gemini will send an **email-style message** back to Claude with the `Subject` field set to `CLI Response`.

The message content will contain the response details:

```
ID: gemini-cli-response-20251007-030500
From: gemini
To: claude
Subject: CLI Response

Request ID: cli-20251007-030000
Status: success | error

Output:
<The full output from the CLI command>

Error Message (if status is 'error'):
<Details of the error>
```

## 4. Responsibilities

- **Claude:** Responsible for identifying tasks suitable for the CLI pipeline and constructing the appropriate `cli_request` message.
- **Gemini:** Responsible for executing the CLI command and returning the results promptly and accurately in a `cli_response` message.

## 5. Service Level Expectations (SLEs)

To ensure timely collaboration, we will adhere to the following target turnaround times for CLI tasks. If a task is expected to exceed these times, Gemini will send a `status_update` message.

- **Standard Analysis (e.g., file comparisons, dependency checks):** < 2 minutes
- **Complex Analysis (e.g., full codebase architecture review):** < 5 minutes

## 6. Example Use Cases

This section provides concrete examples of tasks that are well-suited for the Gemini CLI Pipeline.

- **Example 1: Codebase-wide Dependency Analysis**
  - **Prompt:** `"Analyze all service dependencies across the entire src/services/ directory and generate a dependency graph in markdown format."`

- **Example 2: Test Coverage Pattern Review**
  - **Prompt:** `"Review all 617 test files. Identify and summarize common patterns in test structure, mocking strategies, and assertion usage. Provide a summary in markdown."`

- **Example 3: Data Access Tracing**
  - **Prompt:** `"Identify and list every file and line number where the 'Player.currentSpace' state is directly accessed or modified throughout the entire codebase."`
