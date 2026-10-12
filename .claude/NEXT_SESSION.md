# Next session starter — written 2026-10-12 by /koniec

## State at handoff
- **Version:** v3.7.15. **LIVE: `/health` = `091061e5` at 2026-10-12 04:56 UTC (Tom deployed; that commit contains 3.7.14 bubbles + 3.7.15 header). Nothing pending deploy.** Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped 10-11/12 (this session, "Pokemon board game review"):** town review + plan (`docs/core/TOWN_BOARD_REVIEW.md`), 3.7.6 still town, 3.7.7 walk, 3.7.8 pop-ups wait for the walk, 3.7.9 small fixes, 3.7.10 DOB audit counts for Best built, 3.7.12 folded top bar / solo targets / hover flicker, 3.7.14 bubbles, 3.7.15 header. The other session: 3.7.11 robot seat handle, 3.7.13 slim image.
- **Tests (v3.7.15):** typecheck + build clean; `npm test` 256 files / 3817 green, exit 0; ghost gate green at v3.7.15 (11 files / 43 tests). Lint 0 errors.

## Top 3 open items
1. **Tom looks at 3.7.14 + 3.7.15 live** (bubbles on the town, connection dot, "Invite a friend", Menu closing); then the flip list below once he confirms on a real device.
2. **Approved, build in order (TODO top of "Active"):** (1) clipboard look for the four number boxes (Decision 4A; phone panel not one pixel taller; frame from data), then (2) PC "play" pop-ups over the player panel, dark cover only over the panel, reading pop-ups stay centred, phone/robot hooks unchanged. Week resets 11:00 UTC 10-12 (was 92%). Tell the Manager at start and at each push; one session in `src/` at a time.
3. **Town A3: Tom's real-device look** — walk 1.5 vs 2 s (`TOWN.csv walk_ms`), bubbles, default Town vs Classic (`utils/boardStyle.ts`). Job 2 (reskin leaks → data) waits for the Manager to bring it back; it must pull first (headerMenuItems, HeaderMenu, LiveTrophyBoard changed in 3.7.12–3.7.15).

## Decisions waiting on the user
- Town A3 (above). Parked: TV news cards (Tom "lets wait", TODO trigger), own growing building, road jokes (D5), art (list in the review doc).
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).

## Flip after deploy
Unchanged, flip only after Tom confirms on a real device: fb adb1cc76, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859.

## Suggested first move
Read `/health`. If the week has reset and Tom's word stands, tell the Manager you are starting and build the clipboard look (measure the phone card at 360×640 and 390×844 before and after), then the PC pop-ups.

## Suggested model for next session
Sonnet 5 — two bounded UI jobs with clear rules; raise effort before a bigger model.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never write a deploy claim without reading `/health` (this session got it wrong once).
- Two game sessions can share this folder: commit files BY NAME, never `git add -A`; agree version numbers by message.
- Animated or game-driven checks: Playwright with `channel: "msedge"` (CLAUDE.md TACTICAL 2026-10-12).
