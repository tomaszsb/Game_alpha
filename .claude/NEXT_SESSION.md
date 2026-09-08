# Next session starter — written 2026-09-07 by /koniec

## State at handoff
- **Version:** v3.2.54 — committed (`c67e517`) and pushed, **NOT deployed.** Live is **v3.2.53 (`d474eea`)**, content-verified 2026-09-07 16:02Z. Trust `/health`, never this line.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** two versions off the 2026-09-06/07 robot playtests. **v3.2.53** — the commit spine named the wrong gate on all 12 choice-movement spaces: at `PM-DECISION-CHECK` it demanded *Finish "Swap one helper for another" above first* while the real requirement was picking a destination, and `replace_e` is **skippable** so doing it could never help. `'Pick where you're going first'` was unreachable dead code. **v3.2.54** — the teaching layer's first increment: a **"What's this?"** disclosure per action row, a sibling of the action button (never a child), opening the 44 already-authored `ACTION_TOOLTIPS.csv` rows with live glossary terms.
- **Test suite:** `npx vitest run` — whole suite incl. ghost — **3131/3131 across 213 files**, green on the first attempt. Typecheck ✅ build ✅.

## Top 3 open items
1. **Finish the teaching layer — the tutorial and the micro-lessons are still unbuilt.** v3.2.54 built the per-action explanation surface and proved the wiring end-to-end in the running app. The guided-first-turn and micro-lesson halves have not been started. Hard constraint, now structural in code and comments: never put a glossary term inside an action button.
2. **The 44 tooltip rows need a beginner-voice pass — the maintainer's wording.** They predate the 2026-09-03 "beginners, not insiders" fork and still read like it ("Expeditors are your secret weapon"). **The tooltip is the one place a trade word SHOULD appear** — it's where the glossary link works. Buttons stay plain; explanations may teach the hard word.
3. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** Disclosure, not balance — the 50 days are intended (`SPACE_EFFECTS.csv:57`) and already computed into `getTryAgainCostPreview`; the bubble just only reveals on press-and-hold. Full evidence at TODO.md:26-27. Maintainer's call.

⚠️ This is a curated shortlist, **not the backlog** — read `TODO.md` before claiming anything about what else is open.

## Test failures to address
None. Green on master at v3.2.54.

## Decisions waiting on the user
- **The tooltip voice pass** (item 2) and **the ARCH-FEE-REVIEW disclosure** (item 3) — the two that unblock real work.
- **Normalize the stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`?** Not a live defect — `DataService.parseCsvLine` trims every field, and `DICE_ROLL_INFO.csv` isn't fetched at runtime. Only strict/external CSV tooling is affected. Deployed data files, so it's a maintainer call. (TODO.md)
- **`server/data/game-data/SOURCE_FILES/DiceRoll Info.csv` carries none of the 46 authored dice `button_label` values** the `public/data` copy has. Flagged, not copied — blind-copying between those trees is a documented trap.
- **Card *type* names** ("Work Package"/"Bank Loan"/"Expeditor") deliberately left alone; renaming via `getCardTypeName` would reach the log, card details and outcome banners.
- **Card library Stage 4**, the group/school tier. Deferred 2026-08-25, not rejected.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** A browser cannot judge it: flip only after he confirms the TV reads well across a room. Rolled forward deliberately. v3.2.53 and v3.2.54 closed **no** dashboard reports — both came from the playtest and from code investigation.

## Suggested first move
**Deploy v3.2.54, then read last night's robot report.** The deploy is the blocker — v3.2.53's Pick Your Path fix went live 2026-09-07, so the 03:26 run is the first real test of whether that dead end is gone. Then ask whether he wants the tutorial started or the tooltip voice pass settled first.

## Suggested model for next session
Sonnet 5 — the teaching layer's remainder is scoped content-and-copy work with a shipped precedent to follow, and items 2–3 need the maintainer, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **Reading the robot report: do NOT attribute the step-count collapse.** Games fell from 80 steps (09-05) to 5–22 (09-06/07), and **two** causes sit in that one window: the v3.2.52 deploy and a Jarvis agent-runtime update (2026-09-05 04:30, `PATCHES BROKEN`, `[arg-coerce]` in the tool executor). This dataset cannot separate them.
- **Playtest timestamps are EDT; `/health` is Zulu.** Comparing them directly produces a false "the run predates the deploy" conclusion — it caused a cross-session dispute on 2026-09-07. The disproof that needs no clock: grep the report for strings `git log -S` dates to a specific commit.
- **TODO.md:96's "Things you can do" experiment cannot be read yet** — it's a hit-*volume* test and exposure collapsed. Wait for a run whose games reach the step cap again.
- **Never patch a source file with a Python rewrite script.** `open(path,'w')` truncates before writing; a `UnicodeEncodeError` on the *write* emptied a test file to 0 bytes this session despite this being written down. Use the Edit tool. Full entry now in CLAUDE.md TACTICAL.
- **Con-Initiation crash: do NOT attempt a harness repro.** Needs the maintainer's own foregrounded browser. Has burned three sessions.
- **Say which folder AND which session you are in, every time.** A Manager session also works in this repo and commits occasionally.
- **`npm test` ≠ the full suite** — it excludes `tests/ghost/**`. `npx vitest run` runs both (213 files).
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts.
- **A lone `tests/server/**` failure in a full run is probably load, not a regression.** Five different tests failed across four runs this session and none repeated — Windows temp-dir races (`EPERM: rename`, `ENOTEMPTY: rmdir`). Re-run before investigating.
- **Verify deployed content by finding the chunk locally first** (`grep -rl "<string>" dist/assets/*.js`) — the build is code-split. Expect a brief 502 right after a deploy; it clears.
- **Deploy runs from a Windows terminal, not WSL.** Hand it over by default.
