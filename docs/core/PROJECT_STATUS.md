# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 12, 2026 (v3.7.15)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.15 — PENDING DEPLOY. LIVE is v3.7.13 (`/health` `6bce6516`, 2026-10-12 04:03 UTC); one deploy ships 3.7.14 (town result bubbles) + 3.7.15 (connection dot by the version tag, "Invite a friend" in the Menu, Menu closes on ✕ / outside click / Esc) → `/health` `13d731a`.** Trust `/health`, never this line.

## Current sprint
The town board (review → previews → A1 still town 3.7.6, A2 walk 3.7.7, pop-ups wait for the walk 3.7.8), then Tom's PC findings (3.7.12: folded top bar, solo targets, hover flicker fixed), result bubbles (3.7.14) and a tidier header (3.7.15). Approved and queued: the clipboard look for the four number boxes (Decision 4A) and the PC "play" pop-ups opening over the player panel.

## Health
- **Tests (v3.7.15):** typecheck + build clean; `npm test` 256 files / 3817 green (exit 0); ghost gate green at v3.7.15 (11 files / 43 tests). Lint 0 errors (38 old warnings).
- **Feedback dashboard:** ~49 open; all tracked in TODO.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy 3.7.14 + 3.7.15** (Tom), then read `/health` = `13d731a`.
2. **Clipboard look (4A), then PC pop-ups over the panel** — both approved; after the weekly reset; one session in `src/` at a time; tell the Manager at start and at each push.
3. **Town A3 — Tom's real-device look** (walk time 1.5 vs 2 s, default Town vs Classic); Job 2 (reskin leaks) waits for the Manager to bring it back.
