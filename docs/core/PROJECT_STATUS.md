# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 19, 2026 (v3.2.70)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.70 — LIVE.** Tom deployed v3.2.69 + v3.2.70 on the evening of 2026-09-19; `/health` read `7c11b28` (the docs commit on top of v3.2.70) at 01:32 UTC 2026-09-20, the live bundle carries "3.2.70", and the live `ACTION_TOOLTIPS.csv` serves the new wording. **Trust `/health` over this line** — status lines have gone stale within hours more than once. 3.2.46 stays permanently skipped.

## Current sprint
**Onboarding Phase C, teaching a beginner the game,** is still the main arc. Tom answered all eight open design calls on 2026-09-19, so nothing waits on him. This session built the three approved items: **v3.2.69**, every "?" answers — the 7 card rows in beginner voice plus all 45 dice buttons, with a merged button explaining every outcome it fires (8 space/visit combinations, not the 1 the draft assumed); **v3.2.70**, the destination list opens itself when choosing where to go is the only thing left ("narrow"). What is left of the arc is the tutorial and the story-based micro-lessons. The decisions Tom closed with no code change are recorded in CHANGELOG v3.2.70.

## Health
- **Tests (v3.2.70):** `npm test` **216 files / 3280 tests green**. Ghost gates (`npm run test:ghost`): **11 files / 43 tests green**; smart-bot seed 100001 **49/50 wins, avgTurns 70.1, 0 hard failures — identical to the v3.2.68 baseline**, as expected (nothing this session touched the engine). Typecheck ✅, build ✅, `npm run lint` 0 errors (35 `no-explicit-any` warnings, permanent by policy). 72 tests added for v3.2.69 and 6 for v3.2.70, each proven by sabotage.
- **Deploy:** ✅ v3.2.69 + v3.2.70 live, verified 2026-09-19 (`/health` = `7c11b28`; bundle carries 3.2.70; the data file `ACTION_TOOLTIPS.csv` is served with "picked for you"). `bash deploy.sh` is Tom's, from a Windows terminal.
- **Nightly robot:** blind at its start step since v3.2.64 (waits for "THINGS YOU CAN DO"; the header is now "This turn") — the 09-19 03:00 run started 0 of 6 games. The fix is in the Jarvis repo, not here.
- **Dashboard:** fb:93449bf2 deliberately unflipped (needs Tom's eyes on the real TV). fb:ae480630 and fb:11662ac3 (commit highlight, Lender Review) **not flipped — v3.2.65 is live, so they need a live look.**

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **A real-phone check** of a modal or two on the live site (the bundle carries React 19.3, Vite 8.3 and framer-motion 13 since v3.2.67) — Tom's.
2. **The teaching layer:** the tutorial and story-based micro-lessons. Never put a glossary term inside an action button.
3. **The playtest robot** needs its Jarvis-side fix (start step, and reading `aria-expanded` on the picker before clicking). **Audit II leftovers** (win condition, closed card-family union) are each a dedicated session and Tom's call. **Accessibility** is research-only until Tom asks (TODO parking lot).
