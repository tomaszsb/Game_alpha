# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 18, 2026 (v3.2.66)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.66 — PENDING DEPLOY, together with 3.2.65.** Live is v3.2.64: `/health` read `3a87964` at 2026-09-18. **Trust `/health` over this line**: status lines have gone stale within hours more than once. 3.2.46 stays permanently skipped.

## Current sprint
**Onboarding Phase C, teaching a beginner the game**, is still the main arc. The tutorial and the micro-lessons are still to do; the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows is still to do too.

**v3.2.66 — dependencies current, manual accurate, one real bug found.** `npm update` moved 113 packages within their ranges (React 19.3, Vite 8.3, framer-motion 12.43, …; audit still 0) — this changes the shipped bundle, so it deserves one real-browser look after deploy. `USER_MANUAL.md` was rewritten against the live panel (four boxes, "This turn", the commit control's real captions; it also had the win rule wrong — the game ends when a player *reaches FINISH*, not "lowest time"). **Found, not fixed (a balance decision, in TODO 🙋):** four "Pass help to your left/right" buttons give the pressing player a free expeditor instead of passing one on — the data pipeline never recognises the legacy "The person to your right takes a card." sentence, so it falls through to `draw_E`, while the engine's `transfer` action sits unused. Also found: this machine tests on Node 20.19 while production runs Node 24.

**v3.2.65 — security patches, a real UI bug fix, and one more copy fix from this morning's Jarvis report.** `npm audit` 9 → 0 vulnerabilities (`npm audit fix` itself crashes on an unrelated npm/arborist bug; each package bumped by hand or pinned via `overrides`). Fixed fb:ae480630's hidden second request: the commit control's highlight was gated to `player.visitType === 'First'`, so finishing a space's actions on a SUBSEQUENT visit never lit the control that had just become pressable — now tracks `commit.ready` alone. Added `byOrigin` (home/foreign) to `/api/admin/engagement-stats` so the maintainer's own testing can finally be told apart from real players — the prerequisite a 2026-08-15/09-01 TODO item had been waiting on. "Underwriting" (Bank Review's DiceResultModal title, unreachable by the glossary linker since titles don't route through `TextWithTerms`) → "reviewing"/"reviewed", Tom's pick. Full detail in CHANGELOG.

**v3.2.64 fixed the three worst copy offenders from the 2026-09-12 playtest (~50/150 recorded confusions):** "helper"/"help" (28 hits) → "team member" across `e_card_label` rows; the Lender's "pound of flesh" idiom (12 hits) → "squeeze you"; "THINGS YOU CAN DO" (10 hits) → "This turn". Also made `PlayerPanelV2`'s commit-caption fallbacks CSV-portable. `docs/user/USER_MANUAL.md` has drifted (still shows "Things you can do" and "What's affecting you", the latter removed in v3.2.62) — flagged in TODO, not patched.

**v3.2.62 is Tom's "My numbers" redesign (fb:adad1561, RESOLVED v3.2.63):** "What's affecting you" is gone. Four tappable at-a-glance boxes (Money, Time, Expeditors, Scope) each open their own page, and Time opens History. Which card family lands where is data (CARD_TYPES `numbers_section`).

## Health
- **Tests (v3.2.66):** `npx vitest run`, the whole suite including ghost: **3214/3214 across 224 files** (three `tests/server/**` filesystem errors — two EPERM renames, one ENOTEMPTY — confirmed non-regression: both files re-ran 160/160 in isolation; the documented Windows temp-dir pattern). **Run on Node 20.19; production is Node 24** (see TODO). Typecheck ✅, `node scripts/regen-clean-files.mjs` faithful (pipelineFaithful.test.ts green).
- **Flake note:** a lone `tests/server/**` failure is probably Windows temp-dir load (`EPERM`/`ENOTEMPTY`). Re-run before investigating.
- **Security:** `npm audit` **0 vulnerabilities** (was 9 as of the v3.2.64 deploy log — see CHANGELOG v3.2.65).
- **Deploy:** ⏳ v3.2.65 and v3.2.66 pending; v3.2.64 live (`/health` = `3a87964`, 2026-09-18). `bash deploy.sh` is Tom's to run, from a Windows terminal.
- **Dashboard feedback:** fb:adad1561 flipped resolved 2026-09-18 (Tom confirmed on a real phone). v3.2.61's 8 fixes were flipped resolved 2026-09-17. fb:93449bf2 is still deliberately unflipped: it needs the maintainer's eyes on the real TV. fb:9e31b860 is a design call in TODO. The three v3.2.64 copy fixes have no individual `fb:` ids (sourced from the 2026-09-12 playtest report directly).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **The teaching layer: tutorial, micro-lessons, tooltip voice pass.** The largest remaining part of Phase C. Never put a glossary term inside an action button.
2. **The playtest robot still has zero real completions.** On live v3.2.59 (09-14) all three games started but none finished: 90 destination toggles against 16 commits. v3.2.60 names the picked destination on the commit control (Tom's call). A local seeded re-run against the v3.2.60 build (2 games, same seed) showed it working where aimed — toggles fell from 41% to 22% of steps, and the bot committed through the signpost at "See the Design" and "Pick Your Path" — but still 0 completions: the stall moved to a push-back loop at Lender Review (51 steps in one game), the same Try Again trap TODO already records for Architect's Fee. Win/loss reading and waiting on `app-loading` remain Jarvis-side.
3. **Audit II leftovers, ranked in TODO.md.** #14 is done in v3.2.58. The biggest remaining are the win condition and the closed card-family union, each a dedicated session and Tom's call.

**The 2026-09-12 playtest produced two findings, and neither is a game defect (v3.2.59).** The "no 'Start Game' button" game was sampled while the app was still starting up — the server log shows it never created a game, and no commit since 09-09 touched that screen; the loading screen now carries `data-testid="app-loading"` + `data-phase` so the state is observable. The 26-step loop at "See the Design" is an affordance problem: the engine and UI both offer a working commit (`data-actionable` flips true once a destination is picked), but it is labelled "Sign off on the design" while the rows that look like movement only select. Both the harness waiting and the win/loss read belong to the Jarvis session. Still zero real bot completions in 11 nights.
