# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 4, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.51 — committed and pushed, PENDING DEPLOY.** Live is still v3.2.50 (`/health` → `b4765b5`). 3.2.46 stays permanently skipped; its commit landed renumbered as v3.2.49 and the `hold/` branch was deleted 2026-09-04 once its source was verified byte-identical to master.

## Current sprint
**Onboarding Phase C — teaching a beginner the game instead of testing whether they already know it.** The audience fork was answered 2026-09-03 (**beginners, not insiders**), and two halves have now shipped against it. v3.2.50 gave the 27 board tiles distinct plain-English names, closing a defect nobody had logged: 12 of 27 tiles shared a label with another tile because `shortName()` strips the NPC prefix. **v3.2.51 did the same for the buttons** — a player was landing on "Cut a Corner" and being asked to "Determine Fee Amount", and `Determine …` covered 31 of the 45 dice buttons.

Underneath the wording, both halves turned out to be the *same structural defect*: **0 of 80 manual effect rows had ever carried an authored `button_label`**, exactly as 22 of 27 tiles had fallen through `shortName()`. And in both cases **no schema change was needed** — `w_/b_/i_/e_card_label` in `Spaces.csv` and `button_label` in `DiceRoll Info.csv` already existed, already read by the pipeline, and sat at 0% populated. 81 labels are now authored, the maintainer's wording verbatim.

The rule he set is worth carrying: *"buttons say what you're doing, in everyday words. No trade jargon on buttons."* The reason is structural rather than stylistic — `TextWithTerms` renders `<span role="button">` with `stopPropagation()`, so a glossary link inside a real `<button>` swallows the click. **A button is the one surface where a hard word can never explain itself**, which is why "expeditor" came off every button including `return_e`, and why vocabulary is taught in story prose and the glossary instead.

**Still open in Phase C, and the bulk of it: the tutorial, tooltips and micro-lessons.** Tiles and buttons were the mechanical half.

## Health
- **Tests (v3.2.51):** `npm test` **3096/3096 across 202 files**, `npm run test:ghost` **33/33 across 10 files**, 0 failures either way. Typecheck ✅, production build ✅.
- **Ghost baseline unchanged and re-confirmed:** `ghostPlayerSmartBot` at `baseSeed=100001` is **50 wins / 0 failures / 0 hard / avgTurns 70.8 / longGames 21** — now reproduced byte-identically on a **fourth** distinct tree. **Do not chase the old 47/3/0/86.9**; it belongs to the pre-v3.2.48 era when log volume moved the dice, and cannot return by construction.
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ⚠️ **v3.2.51 is NOT deployed.** Verify *content* by finding the chunk locally first (`grep -rl "<string>" dist/assets/*.js`) — but note v3.2.51's change is in the **data files**, not the bundle, so the real check is `/health` plus `/data/CLEAN_FILES/SPACE_EFFECTS.csv`.
- **Dashboard feedback:** fb:93449bf2 remains deliberately unflipped — it needs the maintainer's eyes on the real television, which a deploy alone cannot settle.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **The teaching layer — tutorial, tooltips, micro-lessons.** The remaining and largest part of Onboarding Phase C. Constraint already proven: never put a glossary term inside an action button.
2. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** The bot burned 250 of its 272 days on that one space with no mention of a cost in its stated reasoning. The 50 days are intended; this is about disclosure. Maintainer's call.
3. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are live but were never verified on real hardware — both only execute on a real panel.
