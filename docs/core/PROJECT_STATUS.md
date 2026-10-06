# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 3, 2026 (v3.2.99)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.99 — deployed** (`/health` → `c252a50`, 2026-10-03 15:55 UTC). Trust `/health`, never this line.

## Current sprint
**Tom's two-device test and its fallout (v3.2.91–98).** The "phone shows the TV view" bug was a remembered *Remote* switch, not a regression. That led to: design-fee quotes that wait for End Turn with 0.5% push-backs and orange/red warnings (v3.2.91); one dice-picked project type per player with `{project}` blanks on all 176 work packages, a NEW tag, log/discard wording (v3.2.92–95); one-colour header, glow all game, "?" inside every outline (v3.2.93–94); a "What is this screen?" question (PC/TV/phone) that replaces the old checkbox, with Remote never remembered (v3.2.97); an in-game Screen menu, read-only spectators, finished games no longer offered back, and an honest TV loss headline (v3.2.98).

## Health
- **Tests (v3.3.0):** `npm test` 231 files / 3567 tests green in ~130 s (the old "469 / 7231" counted every test twice — see CHANGELOG v3.3.0), typecheck + build clean. `test:ghost` 11 files / 43 tests green; ghost now reports FINISHED vs LOST (strict 35/50 finished, smart-bot 43/50).
- **Feedback dashboard:** ~27 open; several fixed-but-unflipped until Tom plays a real TV + phone game (list in NEXT_SESSION).
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Sunday 10-04: play one real TV + phone game on v3.2.99** (incl. close tab -> bare URL -> "Resume as <name>"), then flip the reports.
2. **Tom to read the 176 reworded work packages** (SCOPE_WORDING.csv) for awkward sentences.
3. **30-student class: no real class/date yet (back burner, next after immediate work);** spectator pass on the board's own clicks waits for it.
