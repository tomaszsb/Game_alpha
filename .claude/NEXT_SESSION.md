# Next session starter — written 2026-10-09 by /koniec

## State at handoff
- **Version:** v3.7.5 (`54e860c`). **LIVE: `/health` = `54e860c1` at 2026-10-09 05:03 UTC, so Tom's deploy finished (it read v3.7.2 at 04:57).** Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Last shipped (2026-10-08/09):** 3.7.0 Job 6 (Hire a Builder = three bids, door to the lender, hidden quality); 3.7.1 feedback fixes (trophy board "no race yet", board lights only offered roads, scope-change warning, DOB tag kept, Money page lists payments, glossary label); 3.7.2 one header Menu on PC/TV/remote; 3.7.3 final review asks FDNY only when needed (+ FDNY tag needed vs not); 3.7.4 300% time limit; 3.7.5 work-package Remove/Replace rolls fixed + design cap and time limit measured against the biggest plan.
- **Tests:** `npm test` 253 files / 3778 green; typecheck + build clean; lint unchanged (3 old errors). Ghost gate green at 3.7.5 (11 files / 43 tests; smart bot **38/50 = the floor**, 8 lost to the time limit; 45/50 with the limit off). Check my board 3/3 and 2/2 on the stock board; not yet run on a real classroom row in Docker.

## Top 3 open items
1. **The Jarvis robot (deploy already happened).** v3.7.x is live, so the nightly robot will meet the new screens: do not call it done until the robot clicks `builder-bid-hire` (not the old dice), opens the header Menu (`header-menu-button`) instead of loose header buttons, and handles the two pick-a-card pop-ups (`choice-option` for Remove; `card-replacement-modal` / `card-replacement-pick` for Replace). The Manager has all ids (contract in `E:\Documents\People\AI\Manager\handouts\2026-10-08-jarvis-robot-bid-choice-FINAL-CONTRACT.md`). First run after is a new baseline.
2. **Time limit: 300% / 500% / off — Tom's call after a few real games.** 300% costs the smart bot ~7 finished games (games run ~16% longer since the Remove/Replace fix). I suggested 500% (one number, `TROPHIES.csv` `rule,time_cap_percent`); not yet run at 500%. The Manager still thinks it is "parked" — it is built and pushed since 3.7.4.
3. **Tom's wording drafts + real-device looks:** `UI_STRINGS.csv` `BUILDER_BIDS.*`, trophy names, finished/out tags, Check-my-board texts, End Turn warnings; the new header Menu on a real TV/phone; the phone panel at Hire a Builder is ~105 px taller (Tom OK'd for now). Also 49-ish open feedback reports (19 triaged in TODO "Newly arrived 2026-10-08": trophy/board/etc. done; left: TV-vs-PC bar question closed by the Menu, wishlist parked, old 3.2.99 reports to confirm-and-close).

## Decisions waiting on the user
- Time limit value (above). Tom already answered: Remove/Replace fix = yes with biggest-plan cap; FDNY = fix the flag not the path; 300% accepted for now; phone panel OK.

## Flip after deploy
fb:feedback-1790939931163-adb1cc76, -1790512043564-612fbdc4, -1790939049674-a0cecb6a, -1790939744698-8cb652c4, -1790939218940-7fbea636, plus the older ones in TODO (glow: ae480630, 11662ac3, 95624c8e; phone-as-TV: 84b491f2, ec243622, a1260bfc, dc04ea53; b38110f3, ef974f1c). Newly fixed this session (flip once 3.7.x is confirmed live and Tom has looked): fb:67a9c44b, f6aebc05 (trophy board), 496cc1c8, 8f4769cc (roads), 21473ad9 (warning), 7c8375eb, eaba5e71, fa2a2ddf (Menu), bbeb13e2 (DOB tag), 712a9859 (Remove/Replace). Flip only after Tom confirms on a real device.

## Suggested first move
Read `/health`, then ask the Manager whether the Jarvis robot was updated before tonight's run (the game is live without that gate); then ask Tom for his time-limit choice (and offer the 500% run, ~18 min).

## Suggested model for next session
Sonnet 5 — remaining work is data tuning, the robot hand-off and small fixes; raise effort before a bigger model.

## Reminders
- **Deploy stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, PowerShell); confirm with `/health`.
- A new player field the turn snapshot copies must be written with `updateTempState`, and tests must END THE TURN before looking (CLAUDE.md TACTICAL, charter 3.99).
- Tom's rules: all screens look identical and menus hide (new header controls go in `HeaderMenu`); phone panel never bigger without his OK; his real go in chat (a relayed one is not enough for risky steps).
- Commands for Tom go in PowerShell. Edit CRLF files with a script that keeps EOL (the Edit tool flips them).
