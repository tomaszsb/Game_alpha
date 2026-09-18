# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 18, 2026 (v3.2.63)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.63 — PENDING DEPLOY.** Live is v3.2.62: `/health` read `337ebf0` at 2026-09-18 09:28Z. **Trust `/health` over this line**: status lines have gone stale within hours more than once. 3.2.46 stays permanently skipped.

## Current sprint
**Onboarding Phase C, teaching a beginner the game**, is still the main arc. The tutorial, the micro-lessons and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows are still to do.

**v3.2.63 names the "My numbers" placeholders (fb:adad1561):** the five approved wording rows (`NUMBERS.*` in UI_STRINGS.csv) replace the v3.2.62 placeholder text — see CHANGELOG. **Do not flip fb:adad1561 yet** — that waits until Tom has seen the four boxes on a real phone.

**v3.2.62 is Tom's "My numbers" redesign (fb:adad1561):** "What's affecting you" is gone. Four tappable at-a-glance boxes (Money, Time, Expeditors, Scope) each open their own page, and Time opens History. Which card family lands where is data (CARD_TYPES `numbers_section`). v3.2.61 cleared eight untriaged reviewer reports.

## Health
- **Tests (v3.2.63):** `npx vitest run`, the whole suite including ghost: **3209/3209 across 224 files**, green on the first attempt. Typecheck ✅, production build ✅. No `src/` files changed (data + docs only), so lint N/A.
- **Flake note:** a lone `tests/server/**` failure is probably Windows temp-dir load (`EPERM`/`ENOTEMPTY`). Re-run before investigating. It did not occur this session.
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ⏳ v3.2.63 pending; v3.2.62 live (`/health` = `337ebf0`, 2026-09-18 09:28Z). `bash deploy.sh` is Tom's to run, from a Windows terminal.
- **Dashboard feedback:** 9 open (was 17). v3.2.61's 8 fixes were flipped resolved 2026-09-17. fb:93449bf2 is still deliberately unflipped: it needs the maintainer's eyes on the real TV. fb:9e31b860 and fb:adad1561 are design calls in TODO.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **The teaching layer: tutorial, micro-lessons, tooltip voice pass.** The largest remaining part of Phase C. Never put a glossary term inside an action button.
2. **The playtest robot still has zero real completions.** On live v3.2.59 (09-14) all three games started but none finished: 90 destination toggles against 16 commits. v3.2.60 names the picked destination on the commit control (Tom's call). A local seeded re-run against the v3.2.60 build (2 games, same seed) showed it working where aimed — toggles fell from 41% to 22% of steps, and the bot committed through the signpost at "See the Design" and "Pick Your Path" — but still 0 completions: the stall moved to a push-back loop at Lender Review (51 steps in one game), the same Try Again trap TODO already records for Architect's Fee. Win/loss reading and waiting on `app-loading` remain Jarvis-side.
3. **Audit II leftovers, ranked in TODO.md.** #14 is done in v3.2.58. The biggest remaining are the win condition and the closed card-family union, each a dedicated session and Tom's call.

**The 2026-09-12 playtest produced two findings, and neither is a game defect (v3.2.59).** The "no 'Start Game' button" game was sampled while the app was still starting up — the server log shows it never created a game, and no commit since 09-09 touched that screen; the loading screen now carries `data-testid="app-loading"` + `data-phase` so the state is observable. The 26-step loop at "See the Design" is an affordance problem: the engine and UI both offer a working commit (`data-actionable` flips true once a destination is picked), but it is labelled "Sign off on the design" while the rows that look like movement only select. Both the harness waiting and the win/loss read belong to the Jarvis session. Still zero real bot completions in 11 nights.
