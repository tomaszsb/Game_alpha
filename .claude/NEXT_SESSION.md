# Next session starter — written 2026-10-12 by /koniec

## State at handoff
- **Version:** v3.7.19 — **PENDING DEPLOY** (committed + pushed). Live when last read was v3.7.15 (`/health` `091061e5`). Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped this session (all via the Manager's brief, Tom's words):** v3.7.16 clipboard look for the four number boxes (phone card 648.59 px at 360x640 and 390x844 before AND after); v3.7.17 PC "play" pop-ups over the player panel (`ModalBase anchor="panel"`); v3.7.18 setup gear -> "Board: Street view (town) / Classic", default Town, stored on `GameState.boardStyle`, every screen starts on it, a screen's Menu switch is now remembered per game; v3.7.19 a chime per town result bubble (`playResultChime`, volume `TOWN.csv bubble_sound_volume`, Menu "Sound: On/Off", TV note "Press OK once"). Town walk stays 1.5 s (Tom 10-12).
- **Tests (v3.7.19):** typecheck + build clean; `npm test` 260 files / 3832 green, exit 0; ghost gate green (11 files / 43 tests, 1 skipped); lint 0 errors.

## Top 3 open items
1. **Tom deploys 3.7.16-19, then looks:** clipboard on a real phone (clip must not cover the "?"); PC pop-ups over the panel vs rules/card details centred; setup gear Board choice; bubble chimes BY EAR on the real TV (does the TV show "Press OK once…" and does an OK press turn sound on? loud enough at 0.2?). Plus 3.7.14 bubbles / 3.7.15 header. Then the flip list below.
2. **Money/scope bug (Tom, live v3.7.15) — cause NOT found.** Phone showed Scope $0, "Nothing paid yet", 8 empty dots, while Money $2.27M / Time 23 days / 4 Expeditors were right (cash < raised, $0 spent). Needs the game's token to read server state (the Manager won't carry it). Waiting on Tom's full phone reload + a look at the same player on another screen, relayed by the Manager. Other screen empty too → state lost the work packages; other screen fine → phone had a stale/partial copy after its reconnects (hypotheses, unverified). Evidence: `E:\Documents\People\AI\Manager\evidence\2026-10-12-money-scope\`.
3. **Job 2:** (Town A3 is DONE: Tom on the real TV 10-12, "yes i can read the names from the couch"; walk stays 1.5 s; Town is the default via the v3.7.18 setup choice; "street view" = the town board, confirmed.) Job 2 (reskin leaks → data) waits for the Manager; pull first (headerMenuItems, HeaderMenu, LiveTrophyBoard, PlayerPanelV2, ModalBase, GameLayout, boardStyle, TownBoard changed).

## Decisions waiting on the user
- Parked: TV news cards ("lets wait"), own growing building, road jokes (D5), art (list in `docs/core/TOWN_BOARD_REVIEW.md`).
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).
- Side effects to confirm: the board is clickable while a play pop-up is open on a PC; the Jarvis 03:00 run now starts on the town board (watch its first report after deploy).

## Flip after deploy
Unchanged, flip only after Tom confirms on a real device: fb adb1cc76, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859.

## Suggested first move
Read `/health`. If 3.7.19 is live, ask Tom what he saw and heard; if the Manager passed his money/scope result, start there (ask for the other-screen comparison).

## Suggested model for next session
Sonnet 5 — small look-and-feel follow-ups, plus a state-sync investigation that needs reading, not a bigger model; raise effort first.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never write a deploy claim without reading `/health`.
- Two game sessions can share this folder: commit files BY NAME, never `git add -A`; agree version numbers by message.
- Phone-panel measuring recipe (PC game at 360/390 px wide) and the board/sound design notes are in CLAUDE.md TACTICAL; animated checks use Playwright `channel: "msedge"`.
