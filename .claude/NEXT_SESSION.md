# Next session starter — written 2026-10-03 by /koniec

## State at handoff
- **Version:** v3.2.99 — **DEPLOYED 2026-10-03: `/health` = `c252a50` = HEAD at 15:55 UTC.** Still **re-read `/health` (compare to `git rev-parse --short HEAD`) — never believe this line.**
- **Branch:** master, clean after the wrap-up commit (only `idea.txt` untracked — read it, never modify or commit it).
- **Last shipped (2026-10-03):** v3.2.99 "Resume as <name>" — the browser remembers WHICH player it was (`playerShortId` in `lastGameMemory.ts`); the bare-URL "which one are you?" picker lists that player first as "Resume as <name>" if still in the roster. Still a choice, never auto-redirect; v3.2.90 rule (personal link `p=` = controller) untouched. From the Manager handout 2026-10-01.
- **Tests:** `npm test` 469 files / 7231 tests green; typecheck + build clean. `test:ghost` 11 files / 43 tests green.

## Top 3 open items
1. **Sunday 10-04: Tom plays ONE real TV + phone game, then flip the reports.** Add to his checklist: join from a phone, close the tab, open the bare URL, expect **"Resume as <name>"**, tap lands on own controller. Also look at: fee warnings + push-back at the engineer, NEW tag, "?" inside outlines (light + dark), the "How are you using this screen?" question + Screen menu, a spectator link (watch-only).
2. **Tom reads the 176 reworded work packages** in `public/data/CLEAN_FILES/SCOPE_WORDING.csv` (`card_template` rows); reword in the file, no code.
3. **Wording candidates AFTER his real play (robot first-time-player reads relayed by Manager, NOT Tom's reports — no code change now):** "Tap to see the cost - press & hold to confirm" (11-13x/night), "Finish 2 things above first" (on Push back), "Will be re-drawn next turn", "$86,250 stays spent", "deficit"; 10-03 also looped at Find an Engineer between "Ask for another pass" and "Sign off". Evidence: Jarvis nightly reports 10-01..10-03 (~200 steps, 0 wins, 17-18 spaces) — see TODO for the caveats.

## Decisions waiting on the user
- None open. Decided 2026-10-03: "Remember what this screen is" stays ON by default. 30-student class: no real class/date — back burner, next after the immediate work (Manager DECISIONS); spectator board-click pass waits for it. Low-cash orange warning (5% of scope): tune after real play.

## Flip after deploy
fb:feedback-1790939931163-adb1cc76, -1790512043564-612fbdc4, -1790939049674-a0cecb6a, -1790939744698-8cb652c4, -1790939218940-7fbea636, plus the older ones in TODO (glow: ae480630, 11662ac3, 95624c8e; phone-as-TV: 84b491f2, ec243622, a1260bfc, dc04ea53; b38110f3, ef974f1c). Flip only after Tom confirms on a real device. (v3.2.99 closed no report.)

## Suggested first move
Run `/health` and ask Tom whether v3.2.99 is live and whether Sunday's TV + phone game happened (incl. the Resume-as step). If yes, flip the list; then the 176-package read.

## Suggested model for next session
Sonnet 5 — real-device follow-ups and small fixes.

## Reminders
- **Deploy stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`); confirm with `/health`.
- **Commands for Tom go into Windows PowerShell:** no `grep`; use `curl.exe`.
- Shell quirk: git-bash `/tmp` paths don't resolve for `node` — use relative files. `App.tsx` is CRLF: edit it with a byte-level (python newline='') replace, not the Edit tool.
- Pull feedback screenshots from `/api/feedback/<id>.json` BEFORE calling a report unclear.
