# Next session starter — written 2026-10-12 by /koniec

## State at handoff
- **Version:** v3.7.17 — **PENDING DEPLOY** (committed + pushed). Live when last read was v3.7.15 (`/health` `091061e5`). Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped this session:** v3.7.16 clipboard look for the four number boxes (frame picked in `TOWN.csv` `panel_frame`; phone card measured 648.59 px at 360x640 and 390x844 before AND after); v3.7.17 PC "play" pop-ups open over the player panel (`ModalBase anchor="panel"` + `PanelAnchorContext` from GameLayout's PC branch; reading pop-ups, phone, remote, windows <769 px unchanged; robot test ids untouched). Town walk stays 1.5 s (Tom 10-12), not touched.
- **Tests (v3.7.17):** typecheck + build clean; `npm test` 258 files / 3824 green, exit 0; ghost gate green (11 files / 43 tests, 1 skipped); lint 0 errors.

## Top 3 open items
1. **Tom deploys 3.7.16 + 3.7.17, then looks:** clipboard on a real phone (clip must not cover the "?"), PC pop-ups over the panel (dice, life event, choice, negotiation) vs rules / card details staying centred; plus 3.7.14 bubbles and 3.7.15 header. Then the flip list below once he confirms on a real device.
2. **Town A3: Tom's real-device look** — bubbles, default Town vs Classic (`utils/boardStyle.ts`). Walk is settled at 1.5 s.
3. **Job 2 (reskin leaks → data)** waits for the Manager to bring it back; pull first (headerMenuItems, HeaderMenu, LiveTrophyBoard, PlayerPanelV2, ModalBase, GameLayout changed).

## Decisions waiting on the user
- Parked: TV news cards ("lets wait"), own growing building, road jokes (D5), art (list in `docs/core/TOWN_BOARD_REVIEW.md`).
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).
- Side effect to confirm: the board is now clickable while a play pop-up is open on a PC (the old full-screen cover blocked it). Tell me if that bites.

## Flip after deploy
Unchanged, flip only after Tom confirms on a real device: fb adb1cc76, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859.

## Suggested first move
Read `/health`. If 3.7.17 is live, ask Tom what he saw on the clipboard and the pop-ups; otherwise hand him the deploy command.

## Suggested model for next session
Sonnet 5 — small look-and-feel follow-ups; raise effort before a bigger model.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never write a deploy claim without reading `/health`.
- Two game sessions can share this folder: commit files BY NAME, never `git add -A`; agree version numbers by message.
- Phone-panel measuring recipe (PC game at 360/390 px wide) is in CLAUDE.md TACTICAL; animated checks use Playwright `channel: "msedge"`.
