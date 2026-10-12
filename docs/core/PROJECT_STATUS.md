# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 12, 2026 (v3.7.19)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.19 — PENDING DEPLOY (committed + pushed). Live at last check was v3.7.15 (`/health` `091061e5`).** Trust `/health`, never this line.

## Current sprint
The town board (review → previews → A1 still town 3.7.6, A2 walk 3.7.7, pop-ups wait for the walk 3.7.8), then Tom's PC findings (3.7.12: folded top bar, solo targets, hover flicker fixed), result bubbles (3.7.14) and a tidier header (3.7.15). Then the two approved jobs: v3.7.16 the clipboard look for the four number boxes (Decision 4A; phone panel measured unchanged) v3.7.17 PC "play" pop-ups over the player panel, v3.7.18 the setup screen's Board choice (Street view default; every screen starts on the host's pick) and v3.7.19 a chime with each town result bubble (volume in data, Menu Sound switch, TV hint).

## Health
- **Tests (v3.7.19):** typecheck + build clean; `npm test` 260 files / 3832 green (exit 0); ghost gate green (11 files / 43 tests). Lint 0 errors.
- **Feedback dashboard:** ~49 open; all tracked in TODO.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.7.16-19, then Tom's look** (clipboard, pop-ups over the panel, Board choice at setup, bubble chimes on the real TV, plus 3.7.14 bubbles / 3.7.15 header), then flip the confirmed reports.
2. **Town A3 — DONE** (Tom, real TV, 10-12: names readable from the couch; walk 1.5 s; Town default via the v3.7.18 setup choice).
3. **Job 2 (reskin leaks → data)** waits for the Manager to bring it back; pull first (headerMenuItems, HeaderMenu, LiveTrophyBoard, PlayerPanelV2, ModalBase changed).
