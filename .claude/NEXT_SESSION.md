# Next session starter — written 2026-10-27 by /koniec (Game session, folder D:\Unravel\Current_Game\Game_Alpha)

## State at handoff
- **Version:** v3.9.2 (`9c03aa12`) **pending deploy**. Live = `bcb8026f` (v3.8.100 + deploy.sh cleanup). Check `/health` vs `git rev-parse --short HEAD` first.
- **Branch:** master, clean except the untracked `public/assets/inspector/` + `public/assets/trophies/` (trophy-art session's; do not add or delete).
- **Last shipped:** 3.9.0 QR join codes labelled · 3.9.1 bug reports count board pieces React Flow kept hidden (for fb:5618257f) · 3.9.2 the waiting word opens in the panel's own "?" card under the waiting button (Tom 10-27) · qs 6.17.0.
- **Test suite:** `npm test` 359 files / 4,456 pass (4 skipped); build OK; audit 0. Ghost run at /koniec: see CHANGELOG/commit note if it failed.
- **Version rule:** patch caps at 99 — 3.8.100 had crossed it, so this session went to 3.9.0 (not renumbered).

## Top 3 open items
1. **Tom deploys 3.9.2 and taps the waiting word on his phone** — meaning should open in a card right under "Waiting for…", no jump to the glossary screen. Measured in a browser: button 60px, card 93px only when tapped, page height unchanged at 360x640 and 390x844.
2. **Dictionary website (other project):** the phone glossary entry is `dashboard.unravelcodes.com/dictionary?id=..&view=game&embedded=true` in a frame; its h1 is 60px uppercase (`text-6xl ... uppercase`), so "FOUNDATION" (413px) is cut in a 264px column at 360px. Smaller title on narrow screens + `break-words`. Server code there drifts uncommitted: `git diff` on the server first. Less urgent now that the waiting word no longer opens it.
3. **fb:5618257f blank board** (Tom's PC, 10-25, admin toolbar showing): hypothesis — unverified — React Flow kept all 14 town nodes `visibility:hidden` (never measured). 3.9.1 reports `nodesHidden`/`hiddenNodeIds`; the next blank-board report answers it.

## Decisions waiting on the user
- Design items, not bugs (each its own session, none started): bigger pawns + board layout (fb:fefe42f8, new 10-27), newspaper pop-up (fb:1b7607e9), expediter rework, phone split, async turns.
- Needs Tom's TV: Sony Bravia + Fire Stick Silk slow button presses (fb:5d7e02d9).

## Flip after deploy
- None. (6 reports were closed 10-27 on Tom's yes by the Manager: 75dd41ec, 52afd411, 5c8e37c4, b6b93adf, f9e897b0, 0a827891.)

## Suggested first move
Confirm Tom deployed 3.9.2 (`/health`), then ask which design item he wants next — or hand item 2 to the dictionary-site session.

## Suggested model for next session
Sonnet 5 — the open items are small checks or design talk.

## Reminders
- Tom deploys from PowerShell: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never run it yourself.
- Marking feedback resolved changes the live server: only on Tom's own yes (the Manager has been running the PATCH).
- Hand notes for the Manager live in the shared notes folder `C:\Users\tomas\AppData\Roaming\Claude\side-session-notes\local_580c64ad-3295-4178-a214-b5b4348db905\game-bugs-2026-10-27.md`.
