# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 14, 2026 (v3.7.46)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.46 pushed; live at the time of writing was `3b2dbf72` (= v3.7.43).** v3.7.44-46 wait for Tom's next deploy. Trust `/health`, never this line.

## Current sprint
Latest (10-14, from Tom's play on the TV and phone, "pretty good, nothing urgent"): the Life events tab only while an event is in action (3.7.34); pages flip into each other (3.7.35); the Money page's "where your money came from", the TV size panel that stays put, 12 reports triaged (3.7.36); the admin games list shows home / off-network (3.7.37); lint errors and a duplicate-key warning cleared (3.7.38); every "Keep this size" tap logged (3.7.39); E067 Tax Incentive Research pays 10% of scope (3.7.40); the real fee in the replace list (3.7.41); the avatar on the phone setup screen (3.7.42); DOB / FDNY in one place and a red denied tile (3.7.43); bug reports carry live `diagnostics` (3.7.44); the 15 `any` warnings cleared (3.7.45); the /challenge photo tour re-shot (3.7.46). Also: an outside uptime check built (`scripts/uptime-check.mjs`, scheduled by Tom, texts after 3 misses).

## Health
- **Tests (v3.7.46):** typecheck + build clean; `npm test` 276 files / 3923 green; ghost gate green (11 files / 43 tests, 1 skipped); lint 0 errors, 23 `set-state-in-effect` warnings (left on purpose).
- **Feedback dashboard:** 65 open, all tracked; 12 new ones triaged into TODO on 10-14.
- **Machine:** Node 24.10.0 (matches Dockerfile). Uptime check log: `.claude/tmp/uptime.log`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's device checks + flips** (checklist `.claude/tmp/TOM_CHECKLIST_2026-10-14.md`; nothing flips until he confirms one by one) and the Safari test for the iPhone light-mode report.
2. **Open investigations now instrumented:** orange money (fb:c65560a3), TV with no buildings (fb:a6474bad), the money/scope vanish (10-12), the ResizeObserver loop: read the report's `diagnostics` on the next one.
3. **Jarvis:** its 10-15 03:00 run is the first on the three-pop-up split and conditional Life events tab; it will tell Game if anything trips.
