# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 9, 2026 (v3.7.5)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.5 — LIVE (`/health` `54e860c1`, 2026-10-09 05:03 UTC).** Trust `/health`, never this line.

## Current sprint
Job 6 (Hire a Builder = three bids, 3.7.0), the feedback triage fixes (trophy board, board vs panel moves, scope-change warning, money list, one shared header Menu), the final-review FDNY flag (3.7.3), the 300% time limit (3.7.4) and the work-package Remove/Replace fix with biggest-plan caps (3.7.5). Deployed by Tom at the end of the session (the Jarvis-robot gate was still open).

## Health
- **Tests (v3.7.5):** `npm test` 253 files / 3778 green, typecheck + build clean, lint unchanged (3 old errors). Ghost gate green (11 files / 43 tests; smart bot 38/50 finished with the 300% limit on, 45/50 with it off). "Check my board" 3/3 and 2/2 on the stock board.
- **Feedback dashboard:** ~49 open; 19 triaged into TODO 2026-10-08.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Jarvis robot (game already live):** it must click `builder-bid-hire`, use the header Menu and handle the two pick-a-card pop-ups before v3.7.x ships; the Manager briefs it.
2. **Time limit:** Tom decides 300% (now) vs 500% (suggested) vs off after a few real games (it costs the smart bot ~7 finished games).
3. **Tom's wording drafts** (builder strings, trophy names, tags, Check-my-board texts) and a stopwatch on a real 3+ player game.
