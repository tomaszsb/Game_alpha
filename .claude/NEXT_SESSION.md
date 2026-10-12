# Next session starter — written 2026-10-12 by /koniec

## State at handoff
- **Version:** v3.7.22. **LIVE: `/health` = `1936fa3d` at 2026-10-12 21:25 UTC = v3.7.19 (contains 3.7.16-19; someone deployed during the wrap-up). PENDING DEPLOY: 3.7.20 (loan fee in the paid list), 3.7.21 (Job 2 data), 3.7.22 (phase colours).** Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped (Manager's brief, Tom's words):** 3.7.16 clipboard look; 3.7.17 PC pop-ups over the player panel; 3.7.18 setup "Board: Street view (town) / Classic" (default Town, every screen starts on the host's pick); 3.7.19 chime per town result bubble. While Tom was away (Manager's order, budget line 20% of the week, ended ~8%): **3.7.20** the bank loan's up-front fee is now recorded in "What you've paid" (cash and the paid list agree; found by reproducing the ~$228K gap); **3.7.21** Job 2 in part: builder price/schedule numbers -> `TROPHIES.csv`, standings words + "My project" -> `UI_STRINGS.csv`, results identical (the rest is parked on purpose, see TODO); **3.7.22** a renamed phase gets its own board colour instead of grey (`phaseColorsFor`).
- **Tests (v3.7.22):** typecheck + build clean; `npm test` 264 files / 3845 green, exit 0; ghost gate green (11 files / 43 tests, 1 skipped); lint 0 errors. **One unexplained flake:** one full run failed `TrophyFlow > quality events land in the ledger, and a Try Again takes them back` (5 problem points, expected 3); 6 isolated reruns and a second full run were green. If it recurs, suspect shared module state (`trophyRules`' `rules`) across files in the same worker.

## Top 3 open items
1. **3.7.16-19 are LIVE; Tom deploys 3.7.20-22 and looks at all of it:** clipboard on a real phone (clip must not cover the "?"); PC pop-ups over the panel vs rules/card details centred; setup gear Board choice; bubble chimes BY EAR on the real TV ("Press OK once…" then sound); the paid list after taking a bank loan ("Interest fee"). Plus 3.7.14 bubbles / 3.7.15 header. Then the flip list below.
2. **Money/scope bug (Tom, live v3.7.15): scope NOT reproduced** (full account in TODO and CHANGELOG 3.7.20: PC + phone controller on a local server, server state read after every step, offline cycles, reloads, all consistent; the live server logged no rejected/invalid pushes and just replaces the whole state). Waiting on Tom's full-reload result + a look at the same player on another screen (via the Manager). Other screen empty too -> the state lost the work packages; other screen fine -> the phone had a stale copy (hypotheses, unverified). Do not guess a fix.
3. **Job 2 remainder, only if a real reskin needs it:** quality/event ids, header-menu words (robot reads them), `BoardCheckStrip`, server `spaceProtection` list, stock-name fallbacks (all in TODO).

## Decisions waiting on the user
- Parked: TV news cards ("lets wait"), own growing building, road jokes (D5), art (list in `docs/core/TOWN_BOARD_REVIEW.md`).
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).
- Side effects to confirm: the board is clickable while a play pop-up is open on a PC; the Jarvis 03:00 run now starts on the town board (watch its first report after deploy).

## Flip after deploy
Unchanged, flip only after Tom confirms on a real device: fb adb1cc76, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859.

## Suggested first move
Read `/health`. If 3.7.22 is live, ask Tom what he saw and heard; if the Manager passed his money/scope reload result, start there (the two-screen recipe is in CLAUDE.md TACTICAL).

## Suggested model for next session
Sonnet 5 — look-and-feel follow-ups plus a state-sync investigation that needs reading, not a bigger model; raise effort first.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never write a deploy claim without reading `/health`.
- Two game sessions can share this folder: commit files BY NAME, never `git add -A`; agree version numbers by message.
- A bare spend never writes a payment record: use `ResourceService.recordCost` for anything the player should see paid (CLAUDE.md TACTICAL).
- `rm -rf .tmp/*` is blocked by the safety check in this setup; leave `.tmp/` (gitignored) or ask Tom to clear it.
