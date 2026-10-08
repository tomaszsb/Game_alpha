# Next session starter — written 2026-10-07 by /koniec (second wrap-up of the day; no game source changed after the first)

## State at handoff
- **Version:** v3.6.3 on origin (`51790a5` = docs on top of code `445c73b`). **LIVE (checked 2026-10-08 02:11 UTC): `/health` = `445c73b2` = v3.6.3; Tom deployed it, so everything built 2026-10-07 is live.** Re-read `/health`; never believe this line.
- **Branch:** master = origin/master, clean (only `idea.txt` untracked: read it, never modify or commit it).
- **Last shipped (2026-10-07, Manager Jobs 3-7):** 3.4.0 three-trophy win rule; 3.5.0 "Check my board"; 3.5.1 live trophy board; 3.6.0 rest of Job 5; 3.6.1 phone panel back to its old size; 3.6.2 phone page width fixed + FDNY second read 7 days (Job 7).
- **Tests:** `npm test` 245 files / 3690 green; typecheck + build clean; lint unchanged (3 old errors). **Ghost gate green at v3.6.3 (head 445c73b): 11 files / 43 tests, smart-bot 43/50 finished, identical to before Job 3; Manager told.**

## Top 3 open items
1. **Job 6 (builder and bank) — DESIGN SETTLED WITH TOM, NOT BUILT; needs his explicit go.** Tom's decisions: three random bidders drawn independently (identical ones possible); each bid shows PRICE, DAYS and its OWN price-guarantee days; quality hidden until hired (high 0 / medium 1 / low 2 problem points for Best built, in data); guarantee options must cover a bank/investor round trip through the hub (investor worst case ~80 days) so **100/120/150/180 days**, random per bidder, in a data file; a door from Hire a Builder to the bank (return via PM-DECISION-CHECK, no direct loan->builder road); return with scope unchanged and a bid inside its guarantee keeps it at the quoted price, an expired bidder is replaced by a fresh random one; ANY scope change voids all bids (DOB/FDNY re-scrutiny already happens: scope change takes approvals back); money line at the bank ("cheapest quote $X, good N more days" / "likely about $X"). Still unanswered: quoted price+days = exactly what you pay and wait? Effect: the two dice buttons at Hire a Builder go away (robot clicks them by text). Cost estimate given: 4-7% of his week. Plan: pure bid logic + data file, then engine/state (TEMP rollback), then the door + hub return, then the bank line; small commits, no deploy. The Manager was sent the design for comments; read its reply.
2. **Deploy v3.6.x, then Tom looks on real devices** (list in TODO "Jobs 3-7"): TV Menu, Fast vs Normal, trophy board, panel (phone must be unchanged in size), the mat, and "Check my board" on a real classroom row (its first real run in Docker). Deploys were HELD while the Jarvis 2-seat run was live: no deploy until the Manager/Tom say its report is read.
3. **Tom's wording drafts** (trophy names, finished/out tags, "X is out", end-screen hint, Check-my-board texts, End Turn warnings, the two Job 7 route descriptions) and **17 untracked feedback reports** (`/start full`).

## Manager's comments on Job 6 (received 2026-10-08, deploy hold LIFTED; Job 6 itself has its own hold)
- **Guarantee numbers:** keep 100/120/150/180 in the data file, but do NOT type 80: a TEST derives the worst bank/investor round trip (loan desk + bank per $200K or investor worst roll + hub, from the movement/effects data) and fails if the smallest option is not above it plus a stated margin.
- **Robot:** removing the two dice buttons ("See how good his work is", "See what it adds up to") stalls the Jarvis robot (nightly 04:00 + RUN-ME 7). **Job 6 does NOT deploy until (a) the ghost bot picks a bid and Check-my-board still finishes, and (b) the Jarvis session has updated its robot.** At the START of the build, give the Manager the exact new labels/test ids so it can brief Jarvis. The next robot run is a new baseline, not comparable with the 10-06/10-07 runs.
- **Per-bidder expiry stays (Tom decided).** Test the "let one lapse on purpose to re-roll" case; the screen must say plainly which bids lapsed and why.
- **Number cannot lie:** quoted price and days are exactly what is paid and waited; if a card/dice can still change it, show "about" and say so.
- **Quality:** confirm the ledger counts it ONCE; Check-my-board's "unclear" must not read a low-quality builder as a board fault.
- **Teacher editor:** the new bidder data file and the new door must be in the editor's protection lists (BANK-FUND-REVIEW anchor note in the editor review) and covered by Check my board.
- **Owed:** Tom's stopwatch on a real 3+ player game (Job 3's 2-3x longer games unmeasured by a human).
- Jarvis 2-seat report (live v3.4.0): ran out of time at 145/150 min, 40 turns per seat, no end, seats uneven 144 vs 479 steps (cause unknown).

## Decisions waiting on the user
- Job 6 go + the open question (above). Whether to fix the panel's +18px (649 vs 631 at 360 wide) by shortening something else.

## Flip after deploy
fb:feedback-1790939931163-adb1cc76, -1790512043564-612fbdc4, -1790939049674-a0cecb6a, -1790939744698-8cb652c4, -1790939218940-7fbea636, plus the older ones in TODO (glow: ae480630, 11662ac3, 95624c8e; phone-as-TV: 84b491f2, ec243622, a1260bfc, dc04ea53; b38110f3, ef974f1c). Flip only after Tom confirms on a real device.

## Suggested first move
Run `/health`; read the Manager's reply to the Job 6 design (it was sent at wrap-up); then ask Tom for his go on Job 6 (and the one open question: quoted price+days = what you pay and wait).

## Suggested model for next session
Sonnet 5 — Job 6 is rules + data + UI; raise effort before a bigger model.

## Reminders
- **Deploy stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, PowerShell); confirm with `/health`. The fixed deploy.sh now checks 127.0.0.1 (a false "DEPLOY FAILED" came from `localhost`); if it still says failed, check the public `/health`.
- A deploy ships HEAD. The Docker image leaves `tests/` out: the headless bot lives in `src/headless/` now.
- Commands for Tom go in PowerShell (no grep; `curl.exe`). Edit CRLF files with a script that keeps EOL (the Edit tool flips them).
- Tom's rules this session: the phone player panel must NOT get bigger; measure in a browser before claiming layout; his real go in chat, a relayed one is not enough.
