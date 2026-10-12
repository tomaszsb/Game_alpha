# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 12, 2026 (v3.7.13)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.13 — PENDING DEPLOY (live was v3.7.11 `1715e745` at 03:14 UTC 10-12).** Trust `/health`, never this line.

## Current sprint
Town board shipped (3.7.6–3.7.8, opt-in per screen via Menu → "Board: Town"), then small fixes and plumbing: 3.7.9 end screen without the old Final score; 3.7.10 the DOB audit counts for "Best built"; 3.7.11 a `setup-player-count` handle for the Jarvis robot; 3.7.12 top bar starts folded, solo games show targets, town hover flicker fixed; 3.7.13 the production image drops its dev tools (867 → 402 MB; Check my board kept working).

## Health
- **Tests (v3.7.13):** typecheck + build clean; npm test: still running at wrap-up; ghost gate: still running at wrap-up
- **Feedback dashboard:** ~49 open; all tracked in TODO.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy 3.7.12 + 3.7.13** (Tom) — the first build on the two-stage Dockerfile.
2. **Reskin leaks → data (Job 2)** — approved; after the weekly reset, one session in `src/` at a time.
3. **Town step A3 — Tom's real-device look** (walk 1.5 vs 2 s, default Town vs Classic); the Jarvis robot's 3-seat night and its never-reached Hire a Builder screen.
