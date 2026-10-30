# Next session starter — written 2026-10-30 by /koniec (Game session, folder D:\Unravel\Current_Game\Game_Alpha; other sessions add below)

## State at handoff
- **Version:** v3.9.8 pushed, **NOT deployed**. Live is **v3.9.5** (`/health` = `7efdf156`, 10-30). **3.9.6, 3.9.7 and 3.9.8 are pushed but NOT deployed** (Tom deploys). Check `/health` vs `git rev-parse --short HEAD` first.
- **Branch:** master, clean except the untracked `public/assets/inspector/` + `public/assets/trophies/` (other sessions'; do not add or delete).
- **Last shipped:** the round town, opt-in (fb:fefe42f8). 3.9.6: ring of the 7 shared buildings round a park with a fountain, a side per player (owner's house + office in the player's colour), a table that turns to whoever's turn it is, clocks on the rim, pulsing move choices, teacher Town settings strip. 3.9.7: each building drawn by its job (`round_looks` in TOWN.csv, drawings in `src/components/board/townLooks.tsx`), names on signs on the front walls, room choices on the sign. 3.9.8: "Round town" as a third board choice.
- **Test suite:** `npm test` 347 files / 4,427 pass (v3.9.8); build OK; typecheck = the 9 old errors in `tests/` (`finalStretch.test.ts`, `dataGate.test.ts` missing `@types/express`). `test:ghost` not rerun (no engine change since 3.9.5).
- **Version rule:** patch caps at 99.

## How Tom picks Round town
- Setup screen > Game Settings > **Board: Round town** (every screen of that game). In a running game: **Menu > Board** goes Town, Round town, Classic (that screen only). Also still works: a `?town=round` link, or a class's Town settings strip `round_town` = on. Default stays Street view, so the class and the robot see no change.

## Top 3 open items
1. **Tom deploys and plays one round-town game on his TV.** Stage 2 (talk bubbles, panel split, glossary viewer) waits for that test; the Manager sequences it.
2. **Round town NOT done:** no test that no two signs overlap at EVERY table pose for 1-4 players (checked by eye at the start pose and mid-turn only); the trailer's sign is small (~11 px on a 4-player TV); weather and small props are not drawn on the round town; **never tried on a real Fire Stick**; the teacher Town settings strip was never clicked in a browser (component + server tests only).
3. **fb:5618257f blank board:** v3.9.1 records `nodesHidden`; the next blank-board report answers the hypothesis (unverified).

## Decisions waiting on the user
- Round town: keep, change, or go on to stage 2 (after the TV test).
- From the mock-ups, worth taking later (stage 5 for fonts/palette): a soft shadow under each building, darker ink outlines, roof details (water tower, drafting triangle), white room chips with a coloured edge, heavy rounded sign letters, the paler sky-to-sand backdrop.
- Design items, not bugs: newspaper pop-up (fb:1b7607e9), site picture by scope (fb:cd4d445e), expediter rework (fb:f22035af, cd598be9, db1d1104), phone "show my board" button (fb:167f2d0f), async turns (fb:1df093dd), Money/Scope diagonal (fb:c0d3bfb8); Tom's two 10-29 ideas are in TODO, not designed. fb:75a8bfa3 is tracked nowhere yet. Needs Tom's TV: fb:5d7e02d9, fb:7fbea636.

## Flip after deploy
- None automatic.

## Suggested first move
Ask Tom how the round town looked on his TV after the deploy, before any stage-2 work.

## Suggested model for next session
Sonnet 5 for loose ends (sign-overlap test, trailer sign); Opus if stage 2 starts (panel split touches the phone panel rule).

## Reminders
- Tom deploys from PowerShell: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never run it yourself. Marking feedback resolved changes the live server: only on Tom's own yes.
- Round-town pictures: `.tmp/round-town-build/` (1a) and `.tmp/round-town-build-1b/` (1b; `turn.mjs` passes a turn on the server, `closeup.mjs` shoots every building). TV with no phones: start as PC, then open the same link with `mode=tv&role=tv`.
- The Vite watcher on D: missed edits several times: `curl localhost:3000/src/<file>` before trusting a browser check; restart the preview if stale.
