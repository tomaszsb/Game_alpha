# Documentation Archive Index

This directory contains historical documentation snapshots from the Game Alpha development process. These documents are **read-only records** of past work, decisions, and analysis.

> **Policy**: Archive documents are never modified. They provide valuable historical context for understanding how features were designed, implemented, and refined.

---

## 📋 How to Use This Archive

### For Understanding Current Features
If you're working on a system and want to understand the architectural decisions and design trade-offs, check the relevant archive documents for historical context.

### Pattern
Each active feature typically has an archive record showing:
1. **Initial Planning**: Design documents and approach discussions
2. **Implementation Details**: What was actually done and why
3. **Lessons Learned**: What worked, what didn't, and why
4. **Post-Work Analysis**: Verification, cleanup, and final notes

---

## 📂 Organized by Topic

### Movement System Refactor (November 2025)
The November 14 movement system refactor fixed critical CSV processing bugs. These documents show the complete work lifecycle:

- **[MOVEMENT_REFACTOR_PLAN-20251114.md](./MOVEMENT_REFACTOR_PLAN-20251114.md)**
  - Initial planning and analysis of movement system issues
  - Problem statement: CSV data corruption, dice detection false positives
  - Proposed solutions and implementation strategy
  - *Relevant to*: `docs/systems/MOVEMENT_SYSTEM.md`

- **[MOVEMENT_IMPLEMENTATION_SUMMARY-20251114.md](./MOVEMENT_IMPLEMENTATION_SUMMARY-20251114.md)**
  - Detailed record of what was implemented
  - Files modified, code changes, technical approach
  - pathChoiceMemory implementation for regulatory compliance
  - *Relevant to*: `docs/systems/MOVEMENT_SYSTEM.md`, `src/services/MovementService.ts`

- **[POST_REFACTOR_CLEANUP-20251114.md](./POST_REFACTOR_CLEANUP-20251114.md)**
  - Testing and validation after the refactor
  - Documentation reorganization (moved 9 files to archive)
  - Final verification steps and checklist
  - *Relevant to*: `docs/architecture/TESTING_REQUIREMENTS.md`

- **[USER_FIXES_VERIFICATION-20251114.md](./USER_FIXES_VERIFICATION-20251114.md)**
  - Verification that user-reported issues were fixed
  - Test cases and validation results
  - Game progression verification
  - *Relevant to*: `docs/project/TECHNICAL_DEBT.md`

---

### Testing & Code Quality (November 2025)

- **[MANUAL_FUNDING_TEST_REFACTORING-20251105.md](./MANUAL_FUNDING_TEST_REFACTORING-20251105.md)**
  - Analysis of manual funding test suite refactoring
  - Issues found and resolution approach
  - Test patterns and best practices established
  - *Relevant to*: `docs/architecture/TESTING_REQUIREMENTS.md`

---

### Project Handover & AI Collaboration (October 2025)

- **[HANDOVER_REPORT-20251003.md](./HANDOVER_REPORT-20251003.md)**
  - Complete project handover documentation from October 3
  - Project status at transition point
  - Architectural decisions and rationale
  - Key lessons learned during initial development
  - **Most Valuable For**: Understanding the foundational architecture and design decisions
  - *Relevant to*: `docs/project/PRODUCT_CHARTER.md`, `docs/project/TECHNICAL_DEEP_DIVE.md`

- **[AI_COLLABORATION_WORKFLOW-ARCHIVED-20251007.md](./AI_COLLABORATION_WORKFLOW-ARCHIVED-20251007.md)**
  - Historical record of AI collaboration workflow (October 7)
  - Communication patterns used during initial development
  - File-based and IPC messaging approaches
  - **Status**: Superseded by current development practices
  - *Context Only*: Reference for understanding past workflow decisions

- **[GEMINI-ARCHIVED-20251007.md](./GEMINI-ARCHIVED-20251007.md)**
  - Notes on Gemini AI collaboration session (October 7)
  - Cross-AI communication patterns
  - Issues discovered during collaboration
  - **Status**: Historical record of AI workflow evolution
  - *Context Only*: Reference for understanding AI collaboration history

---

### Design Analysis & Exploration

- **[CARD_STRUCTURE_EXPANSION-ANALYSIS.md](./CARD_STRUCTURE_EXPANSION-ANALYSIS.md)**
  - Detailed analysis of card system design
  - Card types, structures, and mechanics analysis
  - Expansion possibilities and design trade-offs
  - **Most Valuable For**: Understanding card system design rationale
  - *Relevant to*: `docs/project/PRODUCT_CHARTER.md#the-card-system`, `docs/architecture/GAME_ACTIONS_GUIDE.md`

---

### Branch & Repository Management (November 2025)

- **[BRANCH_CLEANUP_SUMMARY-20251115.md](./BRANCH_CLEANUP_SUMMARY-20251115.md)**
  - Summary of branch cleanup on November 15
  - Branches merged or deleted
  - Git repository organization
  - *Relevant to*: Git workflow documentation (internal)

---

## 🔍 Finding Information

### By Feature/System

| System | Current Doc | Archive Reference | Last Updated |
|--------|-------------|-------------------|---------------|
| **Movement System** | `docs/systems/MOVEMENT_SYSTEM.md` | MOVEMENT_REFACTOR_PLAN-20251114.md, IMPLEMENTATION_SUMMARY | Nov 14, 2025 |
| **Card System** | PRODUCT_CHARTER.md, GAME_ACTIONS_GUIDE.md | CARD_STRUCTURE_EXPANSION-ANALYSIS.md | Oct (analysis) |
| **Testing Strategy** | `docs/architecture/TESTING_REQUIREMENTS.md` | MANUAL_FUNDING_TEST_REFACTORING-20251105.md | Nov 5, 2025 |
| **Architecture** | `docs/project/TECHNICAL_DEEP_DIVE.md` | HANDOVER_REPORT-20251003.md | Oct 3, 2025 |
| **UI/UX** | `docs/guides/UI_REDESIGN_IMPLEMENTATION_PLAN.md` | (No archive - in active development) | Nov 2025 |
| **Multi-Device** | README.md, CHANGELOG.md | (No archive - recent feature) | Nov 24, 2025 |

### By Date

**October 2025:**
- October 3: HANDOVER_REPORT (foundational architecture)
- October 7: AI_COLLABORATION_WORKFLOW, GEMINI notes (process history)

**November 2025:**
- November 5: MANUAL_FUNDING_TEST_REFACTORING (test patterns)
- November 14: MOVEMENT_REFACTOR_PLAN, IMPLEMENTATION_SUMMARY, POST_REFACTOR_CLEANUP, USER_FIXES_VERIFICATION
- November 15: BRANCH_CLEANUP_SUMMARY

---

## 📖 Reading Guide for New Developers

### To Understand the Project
1. Read: `README.md` (project overview)
2. Read: `PRODUCT_CHARTER.md` (vision and objectives)
3. Reference: [HANDOVER_REPORT-20251003.md](./HANDOVER_REPORT-20251003.md) (architectural decisions)
4. Consult: `TECHNICAL_DEEP_DIVE.md` (deep architecture)

### To Understand Specific Systems
- **Movement System**: Start with `docs/systems/MOVEMENT_SYSTEM.md`, then reference [MOVEMENT_REFACTOR_PLAN-20251114.md](./MOVEMENT_REFACTOR_PLAN-20251114.md) for design rationale
- **Card System**: Start with PRODUCT_CHARTER.md, then reference [CARD_STRUCTURE_EXPANSION-ANALYSIS.md](./CARD_STRUCTURE_EXPANSION-ANALYSIS.md) for detailed analysis
- **Testing**: Read `docs/architecture/TESTING_REQUIREMENTS.md`, reference [MANUAL_FUNDING_TEST_REFACTORING-20251105.md](./MANUAL_FUNDING_TEST_REFACTORING-20251105.md) for patterns
- **Testing Coverage**: See [USER_FIXES_VERIFICATION-20251114.md](./USER_FIXES_VERIFICATION-20251114.md) for comprehensive test validation

---

## 🔄 Relationship to Active Documentation

| Active Document | References Archive | Purpose |
|-----------------|-------------------|---------|
| README.md | No direct references | Current quick start |
| PRODUCT_CHARTER.md | Links to HANDOVER_REPORT | Vision with historical context |
| PROJECT_STATUS.md | References November work archives | Current status with background |
| TECHNICAL_DEEP_DIVE.md | References HANDOVER_REPORT | Current architecture with history |
| MOVEMENT_SYSTEM.md | Could reference refactor docs | Current system design |
| GAME_ACTIONS_GUIDE.md | Could reference card analysis | Current action patterns |
| TESTING_REQUIREMENTS.md | Could reference test patterns | Current test strategy |

---

## ✅ Archive Maintenance Policy

### What Goes In
- Completed work documentation (planning → implementation → verification)
- Historical decision records (why we chose approach A over B)
- Lessons learned and retrospectives
- Implementation details from major refactors
- Timestamped snapshots of project state

### What Stays Out
- Ongoing/In-progress work (stays in active docs)
- Personal notes or brainstorming (not documented)
- Superseded documents that have no historical value
- Duplicates of information in active docs

### Archives Are Never Edited
Once created, archive documents are frozen snapshots. This ensures:
- Historical accuracy
- Audit trail integrity
- Reliable timeline references
- Stable links from other documents

### Creating New Archives
When completing major work:
1. Document the complete work cycle (planning → implementation → verification)
2. Include date in filename (YYYY-MM-DD format)
3. Add summary line to this README.md
4. Link from relevant active docs for context

---

## 📞 Questions?

If you can't find information in active docs, check here. If it's not in the archive either, the knowledge may need to be documented.

See [DEVELOPMENT.md](../project/DEVELOPMENT.md) for current development practices and workflow.
