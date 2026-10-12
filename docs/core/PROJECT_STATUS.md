# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 12, 2026 (v3.7.9)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.9 — LIVE (`/health` `440c469f`, 2026-10-12 01:56 UTC).** Trust `/health`, never this line.

## Current sprint
The town board (Tom's 2026-10-07 idea): a review and plan (docs/core/TOWN_BOARD_REVIEW.md), two preview pictures, then step A1 (the still town, 3.7.6) and step A2 (the walk, 3.7.7); 3.7.8 holds a move's pop-up until the walk ends; 3.7.9 drops the old Final score, phone tag says Phone, lint errors 0. Menu → "Board: Town" on each screen; every screen starts on Classic. Layout and walk times are data (`TOWN.csv`).

## Health
- **Tests (v3.7.9):** `npm test` 255 files / 3801 green; lint 0 errors. (v3.7.7: 3798 green (exit 0; a late-check bug in the "Connected" light that left 11 stray errors under load is fixed), typecheck + build clean, lint 3 old errors then.) Ghost gate green (11 files / 43 tests).
- **Feedback dashboard:** ~49 open; all tracked in TODO.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Town step A3 — Tom looks on the real TV / PC / phone remote:** walk time 1.5 s vs 2 s (`TOWN.csv` `walk_ms`), the PC arrival pop-up that covers the walk (hold it until the walk ends?), and whether every screen should start on Town.
2. **Stopwatch on a real 3+ player game** (still owed; the walk adds a little).
3. **Flip-after-deploy feedback list** (NEXT_SESSION) once Tom confirms on a real device; Jarvis robot's next nightly run on the new screens.
