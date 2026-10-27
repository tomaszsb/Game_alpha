# Next session starter — written 2026-10-27 by /koniec (Game session, folder D:\Unravel\Current_Game\Game_Alpha)

## State at handoff
- **Version:** v3.9.3 (`fb323b43` + docs commit) **pending deploy**. Live = v3.9.2 (`8161b8b4`, /health 2026-10-27 19:45 UTC). Check `/health` vs `git rev-parse --short HEAD` first.
- **Branch:** master, clean except the untracked `public/assets/inspector/` + `public/assets/trophies/` (other sessions'; do not add or delete).
- **Last shipped:** 3.9.3 players are big pawns (PixelLab pawn body tinted to the player's colour, face as the head) standing on the sign of their building; walker is the same pawn; building box grows by the pawn height so the camera keeps it below the date clocks (fb:fefe42f8).
- **Test suite:** `npm test` 344 files / 4,399 pass; build OK; `test:ghost` 16 files / 60 pass (4 skipped).
- **Version rule:** patch caps at 99.

## Top 3 open items
1. **Tom deploys 3.9.3 and looks at the pawns** on PC and TV; picks body A, B or C from `public/assets/pawns/contact_sheet.png`. Swap = copy `pawn_body_B.png`/`_C.png` (same folder) to `public/images/pawns/pawn_body.png` and set `BODY_W`/`BODY_H` in `src/components/board/PlayerPawn.tsx` (B 25x36, C 20x22). Not seen: a real TV, the walk moving (test browser runs no animations), 4 players on one building.
2. **Town layout (rest of fb:fefe42f8, design):** shared buildings in the middle, each player's area on the outskirts (P1 seems to get more ground), owner/office buildings in the player's colour. Needs Tom's go.
3. **fb:5618257f blank board:** v3.9.1 records `nodesHidden`; the next blank-board report answers the hypothesis (unverified).

## Decisions waiting on the user
- Pawn body A/B/C (above).
- Design items, not bugs: town layout, newspaper pop-up (fb:1b7607e9), site picture by scope (fb:cd4d445e), expediter rework (fb:f22035af, cd598be9, db1d1104), phone "show my board" button (fb:167f2d0f), async turns (fb:1df093dd), Money/Scope diagonal (fb:c0d3bfb8).
- Needs Tom's TV: Silk slow buttons (fb:5d7e02d9), TV player area too big (fb:7fbea636).

## Flip after deploy
- None automatic. Close-list proposed to Tom via the Manager (see the shared notes folder file `game-bugs-2026-10-27.md`).

## Suggested first move
Confirm the deploy (`/health`), then ask Tom which pawn body he wants and whether the town-layout redesign is next.

## Suggested model for next session
Sonnet 5 — pawn swap is a two-line change; the layout redesign is design talk first.

## Reminders
- Tom deploys from PowerShell: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never run it yourself.
- Marking feedback resolved changes the live server: only on Tom's own yes.
- PixelLab scratch script for the pawns: `.tmp/pawns/gen.py` (key `PIXELLAB_API_KEY` in `.env`).
