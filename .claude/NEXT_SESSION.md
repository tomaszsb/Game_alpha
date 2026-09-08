# Next session starter — written 2026-09-08 by /koniec

## State at handoff
- **Version:** v3.2.55 — **LIVE and content-verified.** Tom deployed at 2026-09-08 ~18:49Z; `/health` read `5718946` (= HEAD, contains the feature commit `867e322`) and the served `index-DQy_iRYu.js` carries all nine hook strings, fetched and grepped rather than inferred from the version number. **Still verify with `curl -sS https://game.unravelcodes.com/health` before believing this line** — a handoff can only report what was true when it was written, and this one has been wrong within hours twice this week.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** v3.2.55, five `data-testid` hooks so the nightly playtest robot stops identifying controls by their copy. **110 insertions, 0 deletions — comments and attributes only, nothing a player can see.**
- **Test suite:** `npx vitest run` — whole suite incl. ghost — **3132/3132 across 213 files**, green on the **first** attempt. Typecheck ✅ build ✅. All nine hook strings verified present in the production bundle after terser.

## What actually happened (read this before touching the playtest)
The 09-06/07/08 robot runs abandoned every game at `PM-DECISION-CHECK`, which read as a game dead end — **and it wasn't.** The harness finds controls by regex over their **visible text**, and three releases each blinded a different handle, all three good changes: v3.2.52's toggle rename (`Move — 2 options` → `…places to pick from`) killed the destination opener, so the robot **could not move at all**; v3.2.53's gate rewording made it offer a `disabled` button as live, burning its three-strike budget; v3.2.54's row wrapper broke a direct-child selector. The screen was fine for a human throughout.

This also **settles the step-count collapse** that two sessions recorded as unattributable: destination clicks (`clicked:  ➡️`) were **7 on 09-05, then 0, 0, 0** — three seeds, across the exact release boundary, 0 model errors on 09-08. Mechanism, not correlation. The Jarvis runtime update is not needed to explain it.

## Top 3 open items
1. **Read the 03:26 report — the game half is live, the harness half is the open question.** v3.2.55's hooks are deployed and verified in the live bundle, but they are inert until `~/.hermes/scripts/game_playtest.py` on the Mac mini uses them — owned by a Jarvis session, **not this repo, do not edit it**. The number that settles it is `clicked:  ➡️`: **7 on 09-05, then 0, 0, 0.** ⚠️ Two cautions before reading a good result as success: the harness half ships a **prose fallback**, so a non-zero count alone does not prove the hooks are being used (a log line naming which path found the expander was requested — check whether it landed); and its "What's this?" guard tested `inner_text` (a bare `?`) against words that live only in `aria-label`, so a phantom `?` option may still reach the model.
2. **Finish the teaching layer — the tutorial and micro-lessons are still unbuilt**, and the 44 `ACTION_TOOLTIPS.csv` rows still need the maintainer's beginner-voice pass (item below). Hard constraint, structural in code: never put a glossary term inside an action button.
3. **Two design calls now waiting on Tom (both new, both in TODO.md "Decisions"):** should the destination picker auto-expand when picking is the only thing left? and should the "What's this?" control show more than a bare `?` in visible text? Both change what a player sees, so neither was built.

⚠️ This is a curated shortlist, **not the backlog** — read `TODO.md` before claiming anything about what else is open.

## Test failures to address
None. Green on master at v3.2.55, first attempt, no re-runs.

## Decisions waiting on the user
- **The destination-picker fold** and **the bare `?`** (item 3 above) — both fresh, both his.
- **The 44 tooltip rows' voice pass** — the tooltip is the one place a trade word SHOULD appear; buttons stay plain.
- **Normalize the stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`?** Not a live defect. Deployed data files, so a maintainer call.
- **`SOURCE_FILES/DiceRoll Info.csv` carries none of the 46 authored dice `button_label` values.** Flagged, not copied — blind-copying between those trees is a documented trap.
- **Card library Stage 4**, the group/school tier. Deferred 2026-08-25, not rejected.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** A browser cannot judge it: flip only after Tom confirms the TV reads well across a room. Rolled forward deliberately. v3.2.55 closed **no** dashboard reports — it came from the playtest and from code investigation.

## Suggested first move
**Check `/health` first, then ask Tom whether v3.2.55 is deployed and whether the Jarvis session's harness half landed.** Until both are true, nothing about the robot fix is testable. If he'd rather not chase it, the teaching layer's remainder is the real work — and the two new design calls in item 3 are cheap for him to answer while you start.

## Suggested model for next session
Sonnet 5 — the teaching layer's remainder is scoped content-and-copy work with a shipped precedent, and the open items need the maintainer's judgement, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **A robot playtest that gets stuck is not evidence of a game bug** until you confirm it can still SEE the control. This cost a whole release (v3.2.53 was shipped against the symptom). Cheapest check: run the harness's own regexes against the real button strings.
- **Never cite `file:NNN` for a file another session is editing.** Two claims about `game_playtest.py` were wrong in one day purely because of *when* it was read. Quote the matched text, check `mtime`, look for a `.bak-*` snapshot beside it.
- **Playtest timestamps are EDT; `/health` is Zulu.** Comparing directly produces a false "the run predates the deploy" conclusion.
- **Never patch a source file with a Python rewrite script.** `open(path,'w')` truncates before writing. Use the Edit tool.
- **Con-Initiation crash: do NOT attempt a harness repro.** Needs the maintainer's own foregrounded browser. Has burned three sessions.
- **Say which folder AND which session you are in, every time.** A Manager session also works in this repo.
- **`npm test` ≠ the full suite** — it excludes `tests/ghost/**`. `npx vitest run` runs both (213 files).
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts.
- **A lone `tests/server/**` failure in a full run is probably Windows temp-dir load, not a regression.** Re-run before investigating.
- **Verify deployed content by finding the chunk locally first** (`grep -rl "<string>" dist/assets/*.js`) — the build is code-split. Expect a brief 502 right after a deploy; it clears.
- **Deploy runs from a Windows terminal, not WSL.** Hand it over by default.
