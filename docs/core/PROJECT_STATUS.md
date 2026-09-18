# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 18, 2026 (v3.2.68)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.68 — PENDING DEPLOY.** Live is v3.2.67: `/health` read `01c8fba` at 2026-09-18 (it carries v3.2.65 and v3.2.66 too). **Trust `/health` over this line** — status lines have gone stale within hours more than once. 3.2.46 stays permanently skipped.

## Current sprint
**Onboarding Phase C, teaching a beginner the game,** is still the main arc; the tutorial, the micro-lessons and the "What's this?" tooltip copy are still to do. **Every open design call is now waiting on Tom, and he asked (2026-09-18) that they come first next session** — see `.claude/NEXT_SESSION.md`. This cycle (v3.2.65–68): `npm audit` 9 → 0; dependencies current with TypeScript 6, jsdom 29 and framer-motion 13 taken (nodemailer 10 deferred, ESLint 10 and vitest 5 blocked); lint passes again; `USER_MANUAL.md` rewritten to the live panel; the 2026-08-15 "Con-Initiation crash" reproduced and closed as the bankruptcy ending; the commit control now lights whenever it is pressable; and **v3.2.68 fixes four "Pass help" buttons that gave the presser a free expeditor** — they now pass one to the neighbour (the data pipeline never recognised the legacy sentence; option A, Tom's pick; optional like the other team-member actions). A per-row draft for the "What's this?" tooltips is waiting for his ok/edit/no (`AUTHORED_COPY_REVIEW.md`, last section): only 7 of the 44 rows are reachable, and the "?" on the 45 dice actions repeats the button's own label.

## Health
- **Tests (v3.2.68):** `npx vitest run`, ghost included: **3245/3245 across 226 files** (one `tests/server/instanceResolver` ENOTEMPTY flake, confirmed non-regression: both server files re-ran 160/160 in isolation — the documented Windows temp-dir pattern). Typecheck ✅, `npm run lint` 0 errors, build ✅, `npm audit` 0. **Run on Node 20.19; production is Node 24** (TODO).
- **Ghost, seed 100001:** smart-bot 49/50 wins, avgTurns 70.1, 0 hard failures (50/50 and 70.8 before v3.2.68 — a re-dealt sample, not a like-for-like comparison).
- **Deploy:** ⏳ v3.2.68 pending. `bash deploy.sh` is Tom's, from a Windows terminal.
- **Dashboard:** fb:adad1561 resolved. fb:93449bf2 deliberately unflipped (needs Tom's eyes on the real TV). fb:ae480630 and fb:11662ac3 (commit highlight, Lender Review) **not flipped — v3.2.65 is live now, so they need a live look.**

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's decisions, first** — the destination picker, the bare "?", tooltip copy, the `RoutingExplanationModal` test id, whether "pass a team member" should be mandatory, and two inert-data questions.
2. **The teaching layer:** tutorial, micro-lessons, tooltips. Never put a glossary term inside an action button.
3. **The playtest robot still has zero real completions** (harness-side; Tom decided 2026-09-16 the game stays as is). **Audit II leftovers** (win condition, closed card-family union) are each a dedicated session and Tom's call.
