# Next session starter — written 2026-10-06 by /koniec

## State at handoff
- **Version:** v3.3.4 (`4ec41ac` + a tiny type-only fix in the wrap-up commit) — **pushed; deploy handed to Tom 2026-10-06, NOT confirmed.** `/health` read `c252a50` (v3.2.99) at 00:49 UTC 10-07. **Re-read `/health` and compare to `git rev-parse --short HEAD` — never believe this line.** The wrap-up commit moves HEAD one docs commit past the deployed code; `/health` will show `4ec41ac` if Tom deployed before it.
- **Branch:** master, clean after the wrap-up commit (only `idea.txt` untracked — read it, never modify or commit it).
- **Last shipped (2026-10-06, Manager brief Jobs 1+2):** v3.3.0 change orders not design fees, tests no longer run twice, ghost FINISHED/LOST; v3.3.1 teacher-safety fixes (quoted line breaks, FINISH protected, built-board check at save, plain-number Time/Fee); v3.3.2 `Spaces.schema.json` + editor "More settings"; v3.3.3 one CSV reader (`src/utils/csvCore.js`), dice/modal columns kept, 2 more schemas; v3.3.4 a broken classroom can still save its fix.
- **Tests:** `npm test` 235 files / 3623 tests green (~130 s); typecheck + build clean. `test:ghost` 11 files / 43 tests green at v3.3.3 (strict 35/50 finished, smart-bot 43/50); a ghost run at v3.3.4 was started during wrap-up (v3.3.4 changed only server save code, which the ghost doesn't load).

## Top 3 open items
1. **Job 3 — the three-trophy win rule (NOT built; waits for Tom's yes).** Agreed on paper 2026-10-06 (memory `project-trifecta-win-rule`): winner holds 2 of 3 trophies; fastest = days used / days planned (plan = 300 + 100 per kind of work, +10%); on budget = money spent / planned (scope + 20% design + 5% permits + work, +10%); best built = problem points / number of reviews (sent back 1, violation +2, cut corner +2, sizes in data). No two-crown winner → lowest SUM of the three %. Out players (broke / over 20%) hold no trophy and the rest keep playing. **Tom's last open question: are the point sizes OK, and a yes to build?** Also in the brief: measure game length for 2/3/4 players before/after, check the L/E cards that hit other players, bot balance run, hold the Jarvis re-run until the Manager asks. Brief: `E:\Documents\People\AI\Manager\handouts\2026-10-05-game-trifecta-and-fixes.md`.
2. **Tom's real TV + phone game on the new version, then flip the reports** (list below); Tom reads the 176 reworded work packages in `public/data/CLEAN_FILES/SCOPE_WORDING.csv`.
3. **5 feedback reports untracked** (filed 2026-10-04/05: FDNY shows but DOB vanished, too many life events, zoom, phase vs important info, scope box diagonal) — run `/start full`. Also TODO has the editor leftovers (R3 half-done splices, dead old "Add space" button).

## Decisions waiting on the user
- Job 3 point sizes + go-ahead (above). Labels/help wording in `Spaces.schema.json` is a first draft for Tom to reword.

## Flip after deploy
fb:feedback-1790939931163-adb1cc76, -1790512043564-612fbdc4, -1790939049674-a0cecb6a, -1790939744698-8cb652c4, -1790939218940-7fbea636, plus the older ones in TODO (glow: ae480630, 11662ac3, 95624c8e; phone-as-TV: 84b491f2, ec243622, a1260bfc, dc04ea53; b38110f3, ef974f1c). Flip only after Tom confirms on a real device.

## Suggested first move
Run `/health`: did Tom deploy v3.3.4? Tell the Manager the reading (it asked). Then ask Tom the one Job 3 question (point sizes + yes) and, if yes, build it in small commits.

## Suggested model for next session
Sonnet 5 — Job 3 is rules + data + the end-game flow; raise effort before reaching for a bigger model.

## Reminders
- **Deploy stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, Windows PowerShell); confirm with `/health`. Tell the Manager the reading after he deploys.
- A deploy ships HEAD: never call part of a stack "safe to ship alone". Hold Job 3 deploys until the Manager says the Jarvis re-run baseline is handled.
- Commands for Tom go into PowerShell: no `grep`; use `curl.exe`.
- Scripted edits: write files with the Write tool; build backslashes with `chr(92)`; check CRLF before editing (SpaceEditor.tsx, SpaceDeckScreen.tsx are CRLF). Memory `reference-tool-quirks` has the rest.
- Pull feedback screenshots from `/api/feedback/<id>.json` BEFORE calling a report unclear.
