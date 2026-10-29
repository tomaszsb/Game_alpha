# Next session starter — written 2026-10-27 by /koniec, updated 2026-10-29 (Game session, folder D:\Unravel\Current_Game\Game_Alpha)

## State at handoff
- **Version:** v3.9.5 (`aaeb28a2`) **LIVE** (`/health` = `7efdf156`, 2026-10-29; later commits are docs only). Check `/health` vs `git rev-parse --short HEAD` first.
- **Branch:** master, clean except the untracked `public/assets/inspector/` + `public/assets/trophies/` (other sessions'; do not add or delete).
- **Last shipped:** 3.9.5 the game draws glossary entries itself (frame off; full definition when a word has no short summary, 82 of 274). 3.9.4 pawn body C (Tom's pick). 3.9.3 players are big pawns (PixelLab pawn body tinted to the player's colour, face as the head) standing on the sign of their building; walker is the same pawn; building box grows by the pawn height so the camera keeps it below the date clocks (fb:fefe42f8).
- **Test suite:** `npm test` 344 files / 4,401 pass; build OK; `test:ghost` 16 files / 60 pass (4 skipped, rerun on v3.9.5). `npm run typecheck` showed 9 errors on 10-29, all in `tests/` (`finalStretch.test.ts`, `dataGate.test.ts` missing `@types/express`); not looked into.
- **Version rule:** patch caps at 99.

## Top 3 open items
1. **Round town (rest of fb:fefe42f8), step 1 done 10-29, waiting on Tom's "keep or change":** shared buildings in a 3 x 3 middle, one equal side of the ring per player, Owner's house + Your office in the player's colour. Pictures of the real board (1-4 players, TV + PC, today vs round) in `.tmp/round-town/` (`0-contact-sheet.png`), sent to Tom. Sketch code: `.tmp/round-town/sketch.patch` (apply on master; `TOWN.round.csv` is the data; `shoot.mjs` takes the pictures). Open fork: which season the shared middle shows (A whose turn it is, my pick; B pie quarters). Step 2 (the real build) priced at about 8% of the week, only on Tom's go. Plan in `docs/core/TIME_ON_BOARD_DESIGN.md` section 5 question 1.
2. **Tom looks at 3.9.5 (live) on PC and TV:** pawns (body C), a glossary word on a phone. Not seen: a real TV, the walk moving (test browser runs no animations), 4 players on one building.
3. **fb:5618257f blank board:** v3.9.1 records `nodesHidden`; the next blank-board report answers the hypothesis (unverified).

## Decisions waiting on the user
- Round town: keep or change, then the middle's season (A or B).
- Design items, not bugs: newspaper pop-up (fb:1b7607e9), site picture by scope (fb:cd4d445e), expediter rework (fb:f22035af, cd598be9, db1d1104), phone "show my board" button (fb:167f2d0f), async turns (fb:1df093dd), Money/Scope diagonal (fb:c0d3bfb8).
- Tom closed 10 reports on 10-27 (8cb652c4, ed1b0275, 612fbdc4, c61ec1f2, 1007f455, d27a73d0, 0aa9660c, 8ad42b52, 1c6980b4, adbcf2e5); 16 open. One open report is tracked nowhere yet: fb:75a8bfa3 ("Hard to follow, but enjoyed the game").
- Needs Tom's TV: Silk slow buttons (fb:5d7e02d9), TV player area too big (fb:7fbea636).

## Flip after deploy
- None automatic. Close-list proposed to Tom via the Manager (see the shared notes folder file `game-bugs-2026-10-27.md`).

## Suggested first move
Read Tom's answer on the round town. On "keep": settle the middle's season, then build step 2 from `.tmp/round-town/sketch.patch`.

## Suggested model for next session
Opus — step 2 rewrites the town's areas (rows become sides of a ring) under the live seasons.

## Reminders
- Tom deploys from PowerShell: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never run it yourself.
- Marking feedback resolved changes the live server: only on Tom's own yes.
- PixelLab scratch script for the pawns: `.tmp/pawns/gen.py` (key `PIXELLAB_API_KEY` in `.env`).
- 10-28 style test (mock-ups only, not the game): 3 looks (storybook street, blueprint, city diorama) in `.tmp/style-test/` — `0-contact-sheet.png` + 9 PNGs; waiting on Tom's pick. The round town is layout only and keeps today's look.
- Picture recipe for a TV game with no phones: start the game as PC, then open the same link with `mode=tv&role=tv` (TV setup otherwise waits for phones to scan). The "Add Player" button must be matched exactly: "Add players & start" also contains the words.
