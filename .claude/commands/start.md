---
description: Begin a session — show the starter prompt left by /koniec at the end of the previous session, plus a one-paragraph recap pulled from the memory graph, then sweep dashboard feedback into TODO.md.
---

Begin-of-session briefing. The user just typed `/start` — they want to know where things stand before they decide what to work on.

## 1. Read the starter prompt

**First find the repo root**, then read the file from there — the session may have started in a subdirectory or a Claude Code worktree, in which case a CWD-relative path will miss the actual `NEXT_SESSION.md`. Use this sequence:

1. `Bash: git rev-parse --show-toplevel` to get the repo root path. Call this `$ROOT`.
2. If the current branch (`git rev-parse --abbrev-ref HEAD`) starts with `claude/` it's a worktree branch — the main checkout's `.claude/NEXT_SESSION.md` is what we want, not the worktree's. Resolve the main repo path by looking at the parent of `.claude/worktrees/` if present, otherwise just use `$ROOT`.
3. Read `<resolved-root>/.claude/NEXT_SESSION.md`. If on Windows and the absolute path is known to be `D:\Unravel\Current_Game\Game_Alpha\.claude\NEXT_SESSION.md`, just read that directly as a fallback.

If the file exists, present its contents verbatim under a clear heading. Don't paraphrase — it was written by the previous session specifically to be surfaced here.

If `NEXT_SESSION.md` does NOT exist at either path (first session, or previous session ended without `/koniec`), say so honestly and skip to step 2.

**Cache the "Top 3 open items" titles** from this file — step 4 (bundle hints) needs them.

## 2. One-paragraph recap from the memory graph

Search `mcp__memory__search_nodes` for "Session" to find the most recent `Session YYYY-MM-DD (vX.Y.Z)` entity. Summarize its observations in one paragraph (3–5 sentences):

- What shipped in the most recent session
- Anything open or deferred
- Anything that needs user input

Do not dump the full observation list — distill it. The starter prompt from step 1 already gives the actionable view; this paragraph is the rear-view mirror.

## 3. Quick state checks (parallel, lightweight)

Run these in a single message with parallel tool calls so the user sees them fast:

- `git status --short` — flag any uncommitted changes (the previous session may have left work in flight)
- `Read package.json` (just the `version` line) — confirm current version
- Check whether the deploy is pending by comparing the version line to the most recent `Session ...` entity in memory

Report each as a one-liner. Example:

> - **Version:** v2.63.3 — pending deploy (last session's notes flagged this).
> - **Uncommitted:** 7 files modified. Looks like the v2.63.3 work was never committed.
> - **Branch:** master.

## 4. Pull dashboard feedback and propose TODO.md sweep

This is the "kill two birds with one stone" step. Fresh dashboard feedback gets reconciled against `TODO.md`, and items that overlap with the starter prompt's top-3 are flagged as bundling candidates. **Nothing is written to `TODO.md` without explicit user approval.**

### 4a. Read the token

```bash
# From the repo root:
grep '^FEEDBACK_TOKEN=' .env 2>/dev/null | cut -d= -f2-
```

If `.env` doesn't exist, or the line is missing/empty, **skip the rest of step 4 with a single line**: `> Feedback fetch skipped — no FEEDBACK_TOKEN in .env (see .env.example).` Then proceed to step 5. Do NOT prompt the user about this — it's optional infrastructure.

### 4b. Fetch unresolved feedback

Single HTTPS GET against the deployed game server:

```
GET https://game.unravelcodes.com/api/public/feedback/open?token=<FEEDBACK_TOKEN>
```

Use Bash + `curl -sS --max-time 10` (not WebFetch — WebFetch may be blocked by Cloudflare on this domain). On any non-200 status, print one line with the status code and skip to step 5 — never block the briefing on a fetch failure.

Expected response shape: `{ "reports": [ { "id", "createdAt", "whatDoing", "whatWrong", "contact" }, ... ], "count": N }`.

### 4c. Reconcile against TODO.md

Read `TODO.md`. The dashboard-sourced section starts at the heading `## 🐛 **Open Feedback (Dashboard May 2026)**` (or whatever the current month/year heading is). For each fetched report:

1. **Already-tracked check.** Look for an HTML comment marker matching the report's id anywhere in `TODO.md`: `<!-- fb:<id> -->` (e.g. `<!-- fb:feedback-1715520000000-abc12345 -->`). If present, the item is already represented — skip it.
2. **New candidates.** Reports with no marker in `TODO.md` are candidates for new bullets.

For each candidate, draft a proposed TODO line in the existing bullet style:

```
- [ ] **<short title from whatWrong>** — <one-line context from whatDoing>. <!-- fb:<id> -->
```

Group candidates by date (`createdAt`'s YYYY-MM-DD). If today's date matches a recent batch the user has already labeled (G160/G163/G166 convention), reuse that bucket; otherwise stage them under a new subsection inside the Dashboard section:

```
### Newly arrived (YYYY-MM-DD)
```

### 4d. Bundle hints

For each candidate, do a quick keyword scan against the "Top 3 open items" titles cached in step 1.

- Lowercase, strip punctuation, drop stopwords (`the, a, an, of, for, to, in, on, and, or`).
- If 2+ tokens overlap, append a bundle hint to the candidate's preview line:
  ```
  🔗 may bundle with: <top-item title>
  ```

This is hints-only. Don't reorder, don't merge — just surface the overlap for the user to decide.

### 4e. Show proposed diff, wait for OK

Print a compact summary:

```
Dashboard feedback: N unresolved · M already tracked · K new candidate(s)
```

If K = 0, say `> No new feedback since last session.` and proceed to step 5.

If K > 0, list each new candidate with:
- The proposed bullet line (markdown, exactly as it'd appear in TODO.md, including the `fb:` marker).
- The target bucket (existing or `Newly arrived (YYYY-MM-DD)`).
- Any 🔗 bundle hints.

Cap the inline preview at **10 candidates**. If more, write the full proposal to `.claude/feedback-staged.md` and reference that file in the preview.

End the step with the explicit question:

> **Apply these K additions to TODO.md? (yes / no / edit)**

- On `yes` (or any clear affirmative): use `Edit` to insert the new bullets under the target bucket(s) in TODO.md.
- On `no` (or silence): leave TODO.md untouched. The candidates will reappear next `/start` until they're either accepted or the dashboard items are marked resolved.
- On `edit`: ask which lines the user wants to change, then apply only the approved subset.

**Do NOT** delete, strike through, or modify any existing TODO.md content in this step. No "mark done" sweeping. That belongs to `/koniec` if at all.

## 5. Hand control back to the user

End with a short, open question — NOT an assumption about what to work on. Examples:

- "Want to start by committing v2.63.3 and pushing the deploy, or jump into [top open item]?"
- "The decision on edge-routing approach (A/B/C) is still open — want to tackle that first, or pick something from the dashboard backlog?"

If step 4 surfaced bundle hints, mention them here: "The 🔗 hints from step 4 suggest the X feedback overlaps with the Y open item — want to bundle?"

Do not start any code work in this turn. `/start` is purely a briefing.
