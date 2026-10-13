# Next session starter — written 2026-10-13 by /koniec

## State at handoff
- **Version:** v3.7.33. **LIVE: `/health` = `788a5ea4` = HEAD at 2026-10-13 22:17 UTC (Tom deployed).** Nothing pending deploy. Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped this session (Manager brief "four reports", all live):** 3.7.25 one bubble per kind per tap (fb:5b8a060c) · 3.7.26 orange part-way "Funded 78%" + the loan-fee line (fb:5617effb) · 3.7.27/28/30 town names earned as the game goes, the trailer on its site, two construction sites (new building / renovation, by the scope's `card_kind` tags in SCOPE_WORDING.csv), and per-player owner house + office + site in multiplayer (fb:aec545c4) · 3.7.29/31/32 clipboard: Money+Scope side by side on a phone, the player's colour, page tabs (Money, Time, Expeditors, Scope, Life events), eight round icons wearing their building's picture, flipping pages, play pop-ups as clipboard pages (fb:4e8a8550) · 3.7.33 "This turn" rows in two columns, button left and proposed result right (Tom, extra ask).
- **Tests (v3.7.33):** typecheck + build clean; `npm test` 272 files / 3896 green; ghost gate green (11 files / 43 tests, 1 skipped). Phone panel measured 647 px at 360x640 and 390x844 (was 649).

## Top 3 open items
1. **Tom looks at 3.7.14-3.7.33 on real devices (list in TODO "Tom's checks after deploy"):** the town at game start and after a scope; a 2-4 player game (long town, colour dots); the clipboard tabs and the page flip on a PC and a phone; the eight icons; "This turn" two columns with a LONG label on a phone. **Nothing flips until he confirms** (Manager's rule). Flip list below.
2. **Never seen in motion:** the page flip animation and the old page leaving after a flip (the Browser pane fires no animation frames; modals sit at opacity 0 there). Verify with Playwright + Edge (`chromium.launch({ channel: "msedge" })`, CLAUDE.md TACTICAL) before anyone calls it done; also check the 4-player town on a real TV.
3. **Two small choices for Tom:** what the Life events page should hold (today only the life-event cards, or "No life events yet"); whether the "Remove / Replace / No change" rolls get worded in "This turn"'s right column (today a dash). Also still open: money/scope bug (NOT reproduced; needs Tom's full-reload result + the same player on another screen; do not guess a fix).

## PARKED on purpose (Manager; do not start)
- ResizeObserver "loop completed with undelivered notifications" (in Tom's reports): source NOT found; needs a session with Claude in Chrome connected. Suspects (unverified): React Flow node observers on the town board; `panelAnchor.tsx` sets state from its observer.
- **Three open reports NOT triaged (filed 10-13):** fb:a49b598f, fb:f9e897b0, fb:bf9dd267 (an icon for home vs off-network game, player count). Run `/start full` or triage when asked.

## Decisions waiting on the user
- Parked: TV news cards, own growing building, road jokes (D5), art (list in `docs/core/TOWN_BOARD_REVIEW.md`).
- Unraid cleanup, his call: `docker rmi game_alpha-game-alpha:latest` (609 MB), `docker builder prune` (23.4 GB).
- Side effects to confirm: the board is clickable behind a PC play pop-up; the Jarvis 03:00 run starts on the town board and now meets "?" signs, per-player buildings and the clipboard tabs (watch its first report for broken handles; the `action-button`, `move-expander` and Close hooks are unchanged).

## Flip after deploy
NOTHING flipped (Manager's rule: Tom confirms on a real device first). Live now; flip only after his word: fb 5b8a060c, 5617effb, aec545c4, 4e8a8550 (this session), plus the older list: adb1cc76, c0d3bfb8, 612fbdc4, a0cecb6a, 8cb652c4, 7fbea636, ae480630, 11662ac3, 95624c8e, 84b491f2, ec243622, a1260bfc, dc04ea53, b38110f3, ef974f1c, 67a9c44b, f6aebc05, 496cc1c8, 8f4769cc, 21473ad9, 7c8375eb, eaba5e71, fa2a2ddf, bbeb13e2, 712a9859.

## Suggested first move
Read `/health`. Ask Tom what he saw on 3.7.25-33 (the town reveal, the tabs and flip, the two columns on his phone). If he wants the flip proven first, run the Playwright + Edge check.

## Suggested model for next session
Sonnet 5; the work is look-and-feel follow-ups from Tom's device checks. Raise effort before a bigger model.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never write a deploy claim without reading `/health`.
- Two game sessions can share this folder: commit files BY NAME, never `git add -A`.
- A room's building depends on WHO asks: `buildingOfRoom(layout, space, { kind, seat })`, never `roomToBuilding` for a player (CLAUDE.md TACTICAL).
- The phone panel must not grow: measure the card at 360x640 and 390x844 before and after any panel change (647 px now).
- Quoting trap: a bash heredoc or `node -e` holding apostrophes/backticks breaks; write patch scripts and tests with the Write tool.
