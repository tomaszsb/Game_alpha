# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 4, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.50** — **deployed and verified live** (`/health` returns `b4765b5`, matching HEAD). v3.2.48, v3.2.49 and v3.2.50 all shipped and deployed the same night. **3.2.46 stays permanently skipped** — its commit landed renumbered as v3.2.49, and the `hold/v3.2.46-session-log` branch was deleted 2026-09-04 once its source was verified byte-identical to master.

## Current sprint
**The audience question is settled, and the first onboarding work has shipped.** Asked directly on 2026-09-03, the maintainer answered the fork that had been gating everything: the game is for **beginners, not insiders** — a real tutorial, tooltips and story-based micro-lessons that explain each term in one or two plain sentences. The opposite branch (keep the jargon, lean into insider edge-case events) is rejected. **The jargon evidence is spent — the next move is to build the teaching layer, not gather more proof that it's needed.**

The first slice of that landed as **v3.2.50**, which also closed a defect nobody had ever logged: **12 of the 27 board tiles shared a label with another tile.** `shortName()` strips the NPC prefix, so `ARCH-`, `ENG-`, `REG-DOB-` and `REG-FDNY-FEE-REVIEW` all rendered as "Fee Review"; three spaces collapsed to "Scope Check", three to "Initiation", two to "Plan Exam". Only 5 of 27 spaces set `display_label_override`, so the other 22 fell through. Every space now carries a plain-English name in the maintainer's own words ("Meet the Owner", "Pick Your Path", "Check the Structure"). No schema change was needed — `display_label_override` already existed and already won over `shortName()` in the render path, which also feeds the panel header, move-confirmation copy and the log. A uniqueness guard over the real `GAME_CONFIG.csv` now lives in `tests/utils/boardCommon.test.ts`, verified against a seeded duplicate before being trusted.

**The infrastructure defect that blocked the previous sprint is fixed and independently proven.** `generateActionId()` minted log-entry ids from the same global `Math.random` the dice roll from, so *the number of lines written to the log decided what the dice did* — seeded games were unreproducible across any logging change. v3.2.48 moved four id generators onto a monotonic counter (`src/utils/sequentialId.ts`); the fourth, `LoggingService`'s session-id fallback, was not in the original diagnosis and fixing it was required. With that done, the long-held session-log fix landed as v3.2.49.

## Health
- **Tests (v3.2.50):** `npm test` **3091/3091 across 201 files**, `npm run test:ghost` **33/33 across 10 files**, 0 failures either way. Typecheck ✅ and production build ✅ re-verified 2026-09-04.
- **Ghost baseline — the numbers changed, and the old ones are a trap.** `ghostPlayerSmartBot` at `baseSeed=100001` is now **50 wins / 0 failures / 0 hard / avgTurns 70.8**, stable in win- and hard-failure count at two other seeds (200003 → 79.5 turns, 770077 → 73.4). **Do not chase the old 47/3/0/86.9** — decoupling *removes* draws from the stream, so it yields a new sequence rather than restoring a prior alignment. That signature belongs to the coupled era and cannot return by construction.
- **The decoupling was proven directly, not by two runs agreeing.** A temporary `warn()` on `TurnService.startTurn` (~3,500 extra log lines per 50-game batch) produced **byte-identical** results to the clean tree. `recordGhostHistory` now stamps every row with `head` + `tree`, so "same numbers" can never again be ambiguous between "two configurations agree" and "one configuration ran twice".
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ✅ **v3.2.50 live** — `/health` → `b4765b5`. Verify *content* by finding the chunk locally first (`grep -rl "<string>" dist/assets/*.js`) and fetching that chunk by name; the build is code-split and grepping `index-*.js` gives false "deploy failed" reads.
- **Dashboard feedback:** fb:93449bf2 remains deliberately unflipped — it needs the maintainer's eyes on the real television, which a deploy alone cannot settle.
- **Multi-agent note:** a second Claude session (Jarvis/Hermes manager, out of `C:\Users\tomas`) coordinates across projects and has committed here. **This session owns Game_Alpha's git** by the maintainer's decision.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Build the teaching layer — the rest of Onboarding Phase C.** Tiles are done; **button labels, the tutorial, and tooltips are not.** One hard constraint: a glossary term must never sit inside an action button — `TextWithTerms` renders `<span role="button">` with `stopPropagation()`, so it swallows the click and the action never fires.
2. **Decide whether ARCH-FEE-REVIEW's 50-day Try Again cost must be visible before you commit.** The bot burned 250 of its 272 days on that one space with no mention of a cost anywhere in its stated reasoning. The 50 days are intended; the question is disclosure, not balance. Maintainer's call.
3. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are live but were never verified on real hardware — both only execute on a real panel. fb:93449bf2 flips only after that.
