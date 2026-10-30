# Next session starter — written 2026-10-27 by /koniec, updated 2026-10-30 (Game session, folder D:\Unravel\Current_Game\Game_Alpha)

## State at handoff
- **Version:** v3.9.8 ("Round town" is a third board choice on the setup screen and in the Menu; round town stages 1a + 1b in 3.9.6/3.9.7) committed and pushed, **NOT deployed** (Tom deploys; 3.9.6 and 3.9.7 are not deployed either). Live is v3.9.5 (`/health` = `7efdf156` on 10-30). Check `/health` vs `git rev-parse --short HEAD` first.
- **Branch:** master, clean except the untracked `public/assets/inspector/` + `public/assets/trophies/` (other sessions'; do not add or delete).
- **Last shipped:** 3.9.7 round town stage 1b (looks from `round_looks`, `townLooks.tsx`; facade signs). 3.9.6 round town stage 1a behind a switch (ring of 7 round a park with a fountain, a side per player, turning table, clocks on the rim, pulsing move choices, teacher town settings). 3.9.5 the game draws glossary entries itself. 3.9.4 pawn body C.
- **Test suite:** `npm test` 347 files / 4,427 pass (10-30, v3.9.8); build OK at v3.9.6; `test:ghost` not rerun (no engine change). `npm run typecheck`: the same 9 old errors, all in `tests/` (`finalStretch.test.ts`, `dataGate.test.ts` missing `@types/express`); not looked into.
- **Version rule:** patch caps at 99.

## Top 3 open items
1. **Round town (fb:fefe42f8), stages 1a + 1b built (v3.9.6, v3.9.7), waiting on Tom's look:** 1b pictures in `.tmp/round-town-build-1b/` (`0-contact-sheet.png`, `1-closeups.png`). after deploying, Tom picks "Round town" under Game Settings > Board on the setup screen (or Menu > Board on a running game, that screen only); `?town=round` still works too. A class: its "Town settings (round town)" strip, `round_town` = on. Pictures: `.tmp/round-town-build/` (TV/PC 1-4 players on and off, phone, turn and pulse sequences). Not on the round town yet: weather, small props. Nobody has tried it on a real Fire Stick. Next stages (Manager sequences, do NOT start without his go): 2 conversation bubbles + panel split + glossary viewer, 3 dialogue + Special Inspector, 4 cutaway, 5 fonts. Code: `src/utils/townRound.ts`, `TownBoard.tsx` (turning: `turnTransform`/`useTurn`), `TOWN.csv` `round_*`/`pulse_*`.
2. **Tom looks at 3.9.5/3.9.6 on PC and TV:** pawns (body C), a glossary word on a phone, then the round town.
3. **fb:5618257f blank board:** v3.9.1 records `nodesHidden`; the next blank-board report answers the hypothesis (unverified).

## Decisions waiting on the user
- Round town: keep, change, or go on to stage 1b (Manager sequences).
- Design items, not bugs: newspaper pop-up (fb:1b7607e9), site picture by scope (fb:cd4d445e), expediter rework (fb:f22035af, cd598be9, db1d1104), phone "show my board" button (fb:167f2d0f), async turns (fb:1df093dd), Money/Scope diagonal (fb:c0d3bfb8). Tom's two 10-29 ideas (drawings per scope; split the NPC out of the panel) are in TODO, not designed.
- One open report is tracked nowhere yet: fb:75a8bfa3 ("Hard to follow, but enjoyed the game").
- Needs Tom's TV: Silk slow buttons (fb:5d7e02d9), TV player area too big (fb:7fbea636).

## Flip after deploy
- None automatic.

## Suggested first move
Tom deploys v3.9.6 and opens one round game. Read his reaction; stage 1b only on the Manager's go.

## Suggested model for next session
Opus for stage 1b (buildings with the name on a facade sign touch the town's drawing and the robot's hooks).

## Reminders
- Tom deploys from PowerShell: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never run it yourself.
- Marking feedback resolved changes the live server: only on Tom's own yes.
- Picture recipe for a TV game with no phones: start the game as PC, then open the same link with `mode=tv&role=tv`. The "Add Player" button must be matched exactly ("Add players & start" also contains the words). Round town: start from `?town=round`; `.tmp/round-town-build/turn.mjs` passes the turn on the server to film a turn.
- PixelLab scratch script for the pawns: `.tmp/pawns/gen.py` (key `PIXELLAB_API_KEY` in `.env`).
