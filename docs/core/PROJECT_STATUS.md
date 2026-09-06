# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 6, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.52 — LIVE and verified.** `/health` → `648e212` (contains v3.2.52's `c091b5c`; `648e212` is a docs-only commit the Manager session added on top). Both halves confirmed against the live host: the data file serves the new labels, and the live `index-*.js` chunk carries the new code strings with `Determine Outcome` and `Moving to:` at zero. 3.2.46 stays permanently skipped; its commit landed renumbered as v3.2.49.

## Current sprint
**Onboarding Phase C — teaching a beginner the game instead of testing whether they already know it.** Three halves have now shipped against the 2026-09-03 audience fork (**beginners, not insiders**): v3.2.50 named the 27 board tiles, v3.2.51 authored 81 button labels, and **v3.2.52 fixed the places those labels never actually reached.**

v3.2.52 came off the 2026-09-05 robot playtest and its root cause was v3.2.51's own. `collapsePairedDiceActions` merges two dice rows that share one physical roll into a single button — and on merging, **overwrites the authored label** with a hardcoded `COLLAPSED_DICE_LABEL`. On 8 space/visit combinations, so **16 of the 46 authored dice labels never reached a player**, and the bureaucrat wording the maintainer's rule forbids survived in the one slot the CSV guard structurally cannot see. Same family as v3.2.51's own generator bug, one stage later: there the generator wrote the wrong column, here the renderer overwrites the right one.

Two more of v3.2.51's labels were fixed on their own merits: "Cut back your help" (the report's #1 confusion at 57 hits) never said it costs you *one* helper or that they are gone. Now "Let one helper go" / "Swap one helper for another", maintainer's wording.

**Still open in Phase C, and the bulk of it: the tutorial, tooltips and micro-lessons.** Tiles, buttons and now label delivery were all the mechanical half.

## Health
- **Tests (v3.2.52):** `npx vitest run` — the **whole** suite including ghost — **3130/3130 across 212 files**, 0 failures. Typecheck ✅, production build ✅. (`npm test` alone is the 202-file/3097 subset; `npm run test:ghost` is the other 10 files/33.)
- **Ghost baseline:** all four ghost suites pass, win-rate floor included. **Caveat, recorded honestly:** this run's reporter did not print the smart-bot batch line, so 50/0/0/70.8/21 was *not* directly observed this session — only the assertions passing. **Do not chase the old 47/3/0/86.9**; it belongs to the pre-v3.2.48 era when log volume moved the dice, and cannot return by construction.
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ✅ live and content-verified (see Current Version above). **Verify content by finding the chunk locally first** (`grep -rl "<string>" dist/assets/*.js`) — the build is code-split, so grepping `index-*.js` for a string that lives elsewhere gives a false failure. Data-file changes need `/data/CLEAN_FILES/SPACE_EFFECTS.csv` as well as `/health`.
- **Dashboard feedback:** fb:93449bf2 remains deliberately unflipped — it needs the maintainer's eyes on the real television, which a deploy alone cannot settle.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **The teaching layer — tutorial, tooltips, micro-lessons.** The remaining and largest part of Onboarding Phase C. Constraint already proven: never put a glossary term inside an action button.
2. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** The bot burned 250 of its 272 days on that one space with no mention of a cost in its stated reasoning. The 50 days are intended; this is about disclosure. Maintainer's call.
3. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are live but were never verified on real hardware — both only execute on a real panel.
