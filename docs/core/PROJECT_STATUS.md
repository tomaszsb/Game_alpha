# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 7, 2026 (v3.6.2)
**Current Phase:** Beta — live in production
**Current Version:** **3.6.2 pushed (`43c7a92`). Live `/health` read `6b474341` (v3.5.1) at wrap-up; v3.6.0-3.6.2 + the deploy.sh fix wait for Tom/Manager.** Trust `/health`, never this line.

## Current sprint
Manager brief Jobs 3-7 (2026-10-07): the three-trophy win rule (3.4.0), "Check my board" (3.5.0), the live trophy board (3.5.1), the rest of Job 5 (speed switch, TV Menu, face/money/mentor, the mat; 3.6.0), phone fixes (3.6.1-3.6.2: panel no bigger on a phone, page no wider than the screen) and Job 7 (FDNY second read 7 days). Job 6 (builder and bank) waits on Tom's answers. Deploys were held while the Jarvis 2-seat robot run was live.

## Health
- **Tests (v3.6.2):** `npm test` 245 files / 3690 tests green, typecheck + build clean, lint unchanged (3 old errors). Ghost gate green at v3.4.0 (smart-bot 43/50 finished); **the v3.6.2 ghost run was still going at wrap-up (see NEXT_SESSION).**
- **Feedback dashboard:** ~48 open, 17 not tracked in TODO/CHANGELOG (2026-10-07 count).
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Job 6 (builder and bank)** — needs Tom's answers first (how close counts as "close", the bidders, the money warning).
2. **Deploy v3.6.x** when the Manager/Tom clear it, then Tom looks at the TV Menu, trophy board, panel and "Check my board" on real devices; wording drafts are his.
3. **Triage the 17 untracked feedback reports** (run `/start full`).
