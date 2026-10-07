# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 6, 2026 (v3.3.4)
**Current Phase:** Beta — live in production
**Current Version:** **3.3.4 — pushed (`4ec41ac`); Tom was handing the deploy over 2026-10-06.** Trust `/health`, never this line.

## Current sprint
**Manager brief 2026-10-05, Jobs 1 and 2 done; Job 3 (the three-trophy win rule) agreed on paper, not built.** Job 1 (v3.3.0): change orders are not design fees, `npm test` no longer runs everything twice, ghost bot reports FINISHED vs LOST. Job 2 (v3.3.1-4): teacher-safety fixes for "add a space" (quoted line breaks, FINISH protected, built-board check at save with a repair path, plain-number Time/Fee), one description per space/dice/modal CSV, a "More settings" editor section, one shared CSV reader. Job 3 rule as Tom shaped it: 2 of 3 trophies (days, money, problem points), % of own plan, lowest sum breaks ties, out players hold none. Details: CHANGELOG v3.3.0-3.3.4 and memory `project-trifecta-win-rule`.

## Health
- **Tests (v3.3.4):** `npm test` 235 files / 3623 tests green (~130 s), typecheck + build clean. `test:ghost` 11 files / 43 tests green at v3.3.3 (strict 35/50 finished, smart-bot 43/50).
- **Feedback dashboard:** ~36 open, 5 untracked (2026-10-04/05); several fixed-but-unflipped until Tom plays a real TV + phone game.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Job 3 build** — waits for Tom's yes on the point sizes (sent back 1, violation 2, cut corner 2) and the formula.
2. **Tom's real TV + phone game on the new version**, then flip the reports; read the 176 reworded work packages.
3. **Triage the 5 untracked feedback reports** (run `/start full`).
