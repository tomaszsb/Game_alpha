# Next session starter — written 2026-10-01 by /koniec

## State at handoff
- **Version:** v3.2.90 — **deployed** (`/health` = `d8a07f9`, 2026-10-01 ~07:21 EDT; deployed by me at Tom's word since he had to leave). Re-check `/health` before believing this line.
- **Branch:** master, pushed, clean (only `idea.txt` untracked — read it, never modify or commit it).
- **Last shipped (2026-10-01):** v3.2.90 — a player's phone no longer runs the TV screen. QR links carried `&mode=tv` since v3.2.81 (TV-mode host); now only `mode=remote` rides a personal link, `App.tsx` ignores `mode=tv` when `p=`/`playerId=` is present, and a phone never inherits/stores a TV choice.
- **Tests:** `npm test` 453 files / 7069 tests green; typecheck ✅, build ✅. ghost gates 11 files / 43 tests green.
- **Dashboard:** ~27 open (7 were untracked at /start; the phone-became-TV ones are now in TODO).

## Top 3 open items (full backlog in TODO.md)
1. **Tom re-scans a TV-mode QR on a real iPhone** (host in TV mode, scan a player's code → should see the controller). Then flip fb:84b491f2, fb:ec243622, fb:a1260bfc, fb:dc04ea53 (+ likely fb:1ef35f42). Same session: real-TV look at wake lock (fb:e766b9c2) and auto-center (fb:5de29661).
2. **Decisions waiting on Tom (TODO "Decisions waiting"):** (a) architect/engineer `try_again_fee_share` (now 1; check how the 20% design-fee cap counts a refunded fee first); (b) scope wording (fb:612fbdc4); (c) glow on later visits (fb:ae480630 part 1, fb:11662ac3, fb:95624c8e); (d) "go" on the "?" placement.
3. **fb:ef974f1c and fb:b38110f3 (09-27)** — NOT the QR cause. ef974f1c: a phone on the shared host view (URL has no `p=`/`mode`) after a game ended; b38110f3: a finished game still showing when starting a new one. Uninvestigated; pull screenshots from `/api/feedback/<id>.json` first. fb:ab383e78 (contractor bankruptcy) still awaits Tom's re-try.

## Decisions waiting on the user
- The four above.

## Flip after deploy
- fb:84b491f2, fb:ec243622, fb:a1260bfc, fb:dc04ea53 (full ids `feedback-1790851894177-84b491f2`, `-1790851788770-ec243622`, `-1790852064924-a1260bfc`, `-1790851979921-dc04ea53`) — v3.2.90 is live; flip only after Tom's phone re-scan.
- fb:ab383e78, fb:93449bf2 — as before (real-device confirmations).

## Suggested first move
Ask Tom whether the phone re-scan worked (controller, no "TV" badge) and whether he looked at the TV (sleep, auto-center). If yes, flip the four reports; then walk the decisions.

## Suggested model for next session
Sonnet 5 — real-device follow-ups and design questions.

## Reminders
- **Deploy normally stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`); this session I ran it only because he said so explicitly. Confirm with `/health`.
- **Commands for Tom go into Windows PowerShell:** no `grep`; use `curl.exe`.
- **Pull feedback screenshots from the per-id endpoint BEFORE writing a report up as unclear** — the public `open` endpoint never carries them.
- `App.tsx` and `networkDetection.ts` are CRLF; after Edit-tool changes check `grep -c $'\r$'` equals the line count (it held this session).
- Memory-graph MCP tool was broken last session; file-based memory is what works.
