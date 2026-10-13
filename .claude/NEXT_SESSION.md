# Next session starter — written 2026-10-13 by /koniec

## State at handoff
- **Version:** v3.7.24. **LIVE: `/health` = `bdbef7b4` at 2026-10-13 15:50 UTC (Tom deployed). Nothing pending deploy.** Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped this session (Manager's brief "hold-to-confirm"):** 3.7.24: "Lock the scope" long hold did nothing (fb:f9ab4c3a, Tom's PC). The hold code was fine; the button was gated on "Pick where you're going first" and the destination list had vanished: the card question that "See what the plan covers" can raise (replace/discard) overwrote the one choice slot, and clearing it left it empty (proven: 9 of 25 seeded games at Lender Review). `StateService` now sets the list aside and puts it back (`keepMovement` / `discardSuspended`, CHANGELOG 3.7.24, CLAUDE.md TACTICAL "One choice slot"). **Tom won a full game on live 3.7.24, which settles the earlier "not clicked through with a real mouse" caveat. fb:f9ab4c3a is flipped resolved.**
- **Tests (v3.7.24):** typecheck + build clean; `npm test` 266 files / 3857 green; ghost gate: green (11 files / 43 tests, 1 skipped).

## Top 3 open items
1. **Tom looks at 3.7.16-23 (all live; list in TODO "Tom's checks after deploy"):** clipboard on a real phone (clip must not cover the "?"); PC pop-ups over the panel; setup gear Board choice; bubble chimes by ear on the real TV; the paid list after a bank loan ("Interest fee"); plus 3.7.14 bubbles / 3.7.15 header. The 3.7.20-23 flip list below stays UNFLIPPED until he confirms (Manager 10-13).
2. **Money/scope bug (Tom, live v3.7.15): scope NOT reproduced.** Waiting on Tom's full-reload result + a look at the same player on another screen (via the Manager). Do not guess a fix.
3. **Job 2 remainder, only if a real reskin needs it** (project-length constants, quality/event ids, header-menu words, `BoardCheckStrip`, server `spaceProtection` list, stock-name fallbacks; all in TODO).

## PARKED on purpose (Manager 10-13; do not start)
- **ResizeObserver "loop completed with undelivered notifications" (in all 5 of Tom's new reports, 2-8 each): source NOT found, parked until a session with Claude in Chrome connected exists.** The built-in browser fires no animation frames so the error cannot occur there. Suspects (hypothesis, unverified): React Flow node observers on the town board; `panelAnchor.tsx` sets state straight from its observer. Plan is in TODO.
- **Four design reports, logged in TODO, Tom decides order:** fb:5b8a060c (two bubbles from two buildings when accepting owner money), fb:5617effb (Funding check shows partial funding, orange with a percentage), fb:aec545c4 (town board redesign), fb:4e8a8550 (clipboard redesign). Inventory what exists and unify before proposing anything.
- **Three newer open reports NOT triaged (filed 10-13 after the last count):** fb:a49b598f (16:18 UTC), fb:f9e897b0 (16:14), fb:bf9dd267 (15:52). Run `/start full` or triage when asked.

## Decisions waiting on the user
- Parked: TV news cards ("lets wait"), own growing building, road jokes (D5), art (list in `docs/core/TOWN_BOARD_REVIEW.md`).
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).
- Side effects to confirm: the board is clickable while a play pop-up is open on a PC; the Jarvis 03:00 run now starts on the town board (watch its first report).

## Flip after deploy
NOTHING else flipped (Manager's rule). Fixed in 3.7.x, flip only after Tom confirms on a real device: fb adb1cc76, c0d3bfb8, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859. (fb:f9ab4c3a already flipped 10-13.)

## Suggested first move
Read `/health`. No new brief is queued by the Manager. Ask Tom what he saw on 3.7.16-24 (and heard on the TV chimes); if the Manager passes his money/scope reload result, start there (two-screen recipe in CLAUDE.md TACTICAL).

## Suggested model for next session
Sonnet 5, since look-and-feel follow-ups plus a state-sync investigation need reading, not a bigger model; raise effort first.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never write a deploy claim without reading `/health`.
- Two game sessions can share this folder: commit files BY NAME, never `git add -A`.
- A bare spend never writes a payment record: use `ResourceService.recordCost` (CLAUDE.md TACTICAL).
- A held button that "does nothing" is first a gated button: check `data-actionable` and the sub-line before suspecting the hold code.
- `sed -i` on CRLF files in Git Bash can flip them to LF; edit with node (`fs`) and check `git diff --stat` stays small.
