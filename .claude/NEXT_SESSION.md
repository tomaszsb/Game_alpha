# Next session starter — written 2026-10-12 by /koniec

## State at handoff
- **Version:** v3.7.13 (`6bce651`+docs). **PENDING DEPLOY:** live was v3.7.11 (`1715e745`) at 03:14 UTC; one deploy ships 3.7.12 (other game session: top bar folded, solo targets, town flicker) + 3.7.13 (production image 867 → 402 MB, first deploy on the two-stage Dockerfile). Re-read `/health`; never believe this line.
- **Branch:** master = origin/master, clean.
- **Shipped this session:** 3.7.11 robot handle `setup-player-count` (+`data-players`/`data-max-players`); 3.7.13 slim image (tsx kept: Check my board runs `node --import tsx scripts/boardPlaytest.ts`). Other session: 3.7.10 DOB audit counts for Best built (Tom "a"), 3.7.12.
- **Jarvis robot (Mac):** seat step was never broken (2/3/4-seat starts proven live with its unchanged code); 10-11 was a one-off. Installed a hardened `game_playtest.py` (reads the new handle, retries setup once, saves `start-failure-*.png/.txt`), md5 9eba14a7…, backup `.bak-seatfix-20261012`; Jarvis repo commit `0b93f51` local, NOT pushed (Jarvis session pushes). Tonight 10-12 03:00 ET = 3 seats.
- **Tests (v3.7.13):** typecheck + build clean; `npm test` 3812/3813 (1 Windows-only EPERM flake in `instanceResolver` "swaps atomically", passes 43/43 alone); ghost gate 43 green, 939 s (slow: other session busy on the PC).

## Top 3 open items
1. **Deploy 3.7.12 + 3.7.13 (Tom), then read `/health` = the pushed HEAD.** First two-stage build: if it fails, `git revert 1b33cf4` restores the old Dockerfile.
2. **Job 2: reskin leaks → data** (Tom: yes; Manager + other session agreed). Scope: `contractorTerms.ts` numbers → `TROPHIES.csv` rule rows; fixed words (ProjectMat/MAT_CHECKS, TvMenu, LiveTrophyBoard incl. 3.7.12's solo lines, BoardCheckStrip) → `UI_STRINGS.csv`, defaults byte-identical, new rows APPENDED at the end; `LEND-SCOPE-CHECK` in `server/spaceProtection.js` + `trophyRules.ts` fallbacks/CHEAT-BYPASS from data. Leave HIGH/MED/LOW + event ids. Not the closed-union items. Test: a changed CSV value changes the game. **Wait for the weekly reset (11:00 UTC 10-12); week was 89%.** One session in `src/` at a time.
3. **Read the robot's 10-12 report** (`~/.hermes/playtest-reports/playtest-2026-10-12.txt` via `ssh hermes`): did the 3-seat game start? Any `start-failure-*` file? The second robot job (never finishes; never reaches Hire a Builder) belongs to the Jarvis session.

## Decisions waiting on the user
- Town A3 (his real-device look): walk 1.5 vs 2 s, default Town vs Classic. Parked: clipboard (D4), road jokes (D5), art.
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).
- Time limit is CLOSED at 300% (Tom 10-09).

## Flip after deploy
Unchanged from 10-09, flip only after Tom confirms on a real device: fb adb1cc76, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859.

## Suggested first move
Read `/health`; if 3.7.13 is live, check the robot's 10-12 report, then (after the weekly reset) start Job 2.

## Suggested model for next session
Sonnet 5 — Job 2 is mechanical moving of words/numbers into CSVs with tests.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell).
- Two game sessions share this folder: commit files BY NAME, never `git add -A`; coordinate version numbers by message.
- Edit CRLF files (Dockerfile, TownBoard.tsx…) with a script that keeps EOL.
