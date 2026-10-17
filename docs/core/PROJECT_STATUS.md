# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 17, 2026 (v3.8.4)
**Current Phase:** Beta — live in production
**Current Version:** **v3.8.4 pushed; live at the time of writing was `de31c02a` (= v3.8.2 + docs).** v3.8.3 (How to play text) and v3.8.4 (press-and-hold caption + `commit_tap` tracker, restarts the server) wait for Tom's deploy. Trust `/health`, never this line.

## Current sprint
10-17, Manager brief for a friend's structural-engineering class, then onboarding: `/class` landing page + printable certificate + one joke (3.8.0), avatar fix on the phone setup card (3.8.1), `/class?src=` campaign tag (3.8.2), "How to play" rewritten in plain permit words (3.8.3), "Press and hold" caption on the commit button + `commit_tap` tracker (3.8.4). Measured: outside players 46 games, 4 finished (9%), 31 never got past the first space; a person's real finish is ~35-45 min. Hypothesis (unproven): the press-and-hold at the first space is the wall; `PLAYTEST_COMMIT_TAP` in `visitors.log` will say.

## Health
- **Tests (v3.8.4):** typecheck + build clean; `npm test` 279 files / 3936 green; ghost gate green (see NEXT_SESSION); lint 0 errors, 23 `set-state-in-effect` warnings (left on purpose).
- **Feedback dashboard:** 65 open, all tracked; 12 new ones triaged into TODO on 10-14.
- **Machine:** Node 24.10.0 (matches Dockerfile). Uptime check log: `.claude/tmp/uptime.log`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's device checks + flips** (checklist `.claude/tmp/TOM_CHECKLIST_2026-10-14.md`; nothing flips until he confirms one by one) and the Safari test for the iPhone light-mode report.
2. **Open investigations now instrumented:** orange money (fb:c65560a3), TV with no buildings (fb:a6474bad), the money/scope vanish (10-12), the ResizeObserver loop: read the report's `diagnostics` on the next one.
3. **Jarvis:** its 10-15 03:00 run is the first on the three-pop-up split and conditional Life events tab; it will tell Game if anything trips.
