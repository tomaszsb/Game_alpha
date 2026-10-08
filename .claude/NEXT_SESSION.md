# Next session starter — written 2026-10-07 by /koniec

## State at handoff
- **Version:** v3.6.2 on origin (`43c7a92`). **LIVE (checked 2026-10-08 00:35 UTC): `/health` = `6b474341` (v3.5.1).** v3.6.0-3.6.2 (Fast switch, TV Menu, face/money/mentor, mat, phone fixes, Job 7) + the deploy.sh 127.0.0.1 fix are **pending deploy**. Re-read `/health`; never believe this line.
- **Branch:** master = origin/master, clean (only `idea.txt` untracked: read it, never modify or commit it).
- **Last shipped (2026-10-07, Manager Jobs 3-7):** 3.4.0 three-trophy win rule; 3.5.0 "Check my board"; 3.5.1 live trophy board; 3.6.0 rest of Job 5; 3.6.1 phone panel back to its old size; 3.6.2 phone page width fixed + FDNY second read 7 days (Job 7).
- **Tests:** `npm test` 245 files / 3690 green; typecheck + build clean; lint unchanged (3 old errors). **Ghost gate for v3.6.2 was still running at wrap-up** (started ~19:50 EDT, `$TEMP/ghost2.log`); green at v3.4.0 (smart-bot 43/50). Read `.claude/ghost-history.jsonl` (smart-bot, head 43c7a92) and tell the Manager.

## Top 3 open items
1. **Job 6 (builder and bank) — NOT started, needs Tom's answers:** how close counts as "close" for the bank-to-builder shortcut (30 days?); three named bidders or random each time; show the builder's likely price as a number at the bank? Ask him in ONE list.
2. **Deploy v3.6.x, then Tom looks on real devices** (list in TODO "Jobs 3-7"): TV Menu, Fast vs Normal, trophy board, panel (phone must be unchanged in size), the mat, and "Check my board" on a real classroom row (its first real run in Docker). Deploys were HELD while the Jarvis 2-seat run was live: no deploy until the Manager/Tom say its report is read.
3. **Tom's wording drafts** (trophy names, finished/out tags, "X is out", end-screen hint, Check-my-board texts, End Turn warnings, the two Job 7 route descriptions) and **17 untracked feedback reports** (`/start full`).

## Decisions waiting on the user
- Job 6 answers (above). Whether to fix the panel's +18px (649 vs 631 at 360 wide) by shortening something else.

## Flip after deploy
fb:feedback-1790939931163-adb1cc76, -1790512043564-612fbdc4, -1790939049674-a0cecb6a, -1790939744698-8cb652c4, -1790939218940-7fbea636, plus the older ones in TODO (glow: ae480630, 11662ac3, 95624c8e; phone-as-TV: 84b491f2, ec243622, a1260bfc, dc04ea53; b38110f3, ef974f1c). Flip only after Tom confirms on a real device.

## Suggested first move
Run `/health`, read the ghost result, then ask Tom the Job 6 list. Ask the Manager whether the Jarvis report is read before anyone deploys.

## Suggested model for next session
Sonnet 5 — Job 6 is rules + data + UI; raise effort before a bigger model.

## Reminders
- **Deploy stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, PowerShell); confirm with `/health`. The fixed deploy.sh now checks 127.0.0.1 (a false "DEPLOY FAILED" came from `localhost`); if it still says failed, check the public `/health`.
- A deploy ships HEAD. The Docker image leaves `tests/` out: the headless bot lives in `src/headless/` now.
- Commands for Tom go in PowerShell (no grep; `curl.exe`). Edit CRLF files with a script that keeps EOL (the Edit tool flips them).
- Tom's rules this session: the phone player panel must NOT get bigger; measure in a browser before claiming layout; his real go in chat, a relayed one is not enough.
