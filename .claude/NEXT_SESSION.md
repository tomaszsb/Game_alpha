# Next session starter — written 2026-10-17 by /koniec

## State at handoff
- **Version:** v3.8.0 pushed, **pending deploy**. `/health` on 10-17 = `84f4dcd8` (= v3.7.46 code, so 3.7.44-46 ARE live). Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped this session (Manager brief 10-17):** 3.8.0 `/class` landing page (own root in `main.tsx`, generic wording, Start goes to `/`) + "Print certificate" button and joke 1 on the end screen (`src/utils/certificate.ts`, `EndGameModal`). Finishing = the end screen opens, win or loss. Name comes from the game; nothing stored.
- **Tests (v3.8.0):** typecheck + build clean; `npm test` 278 files / 3928 green; ghost gate green (11 files / 43 tests, 1 skipped).

## Top 3 open items
1. **Tom: deploy 3.8.0, then play one game to the end and print the certificate to a real PDF** (not yet checked; only HTML + 375 px width). Tom still owes: student count, start date, "City College" or generic. Jokes 2-3 are in the reply to the Manager.
2. **Tom's device checks, then flips** (checklist in the TODO "Tom's checks" bullet; nothing flips until he confirms one by one) and the Safari test for the iPhone light-mode report.
3. **Three investigations are instrumented — read the next report's `diagnostics` FIRST** (`GET /api/feedback/<id>.json?token=$FEEDBACK_TOKEN`): orange money (fb:c65560a3), TV with no buildings (fb:a6474bad), the vanished scope, the ResizeObserver loop. Do not guess fixes.

## Decisions waiting on the user
- City College on `/class` or generic; which joke (1 used; he may swap).

## Flip after deploy
NOTHING flipped (Manager's rule). Waiting on Tom: 5b8a060c, 5617effb, aec545c4, 4e8a8550, 4db1b1d9, a49b598f, f9e897b0, bf9dd267, 3fec0e88, bf6176e5, 08dbbe87, 102e0953, a31aff46, plus the older list in TODO. Close without a fix: 4824bc44, 3ec9388f, 0a827891.

## Suggested first move
Read `/health`; ask Tom if 3.8.0 is deployed and for the three class facts. Game length is unmeasured (last baseline: 14% of outside games finished); offer to read finish times from the server records.

## Suggested model for next session
Sonnet 5: small follow-ups and reading one report's diagnostics.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). 3.8.0 changes no server code.
- Commit files BY NAME; `git diff --stat` after any scripted edit (CRLF; Python needs `encoding='utf-8'` on Windows).
- The app's CSP blocks inline `onclick`, including in `document.write` tabs (the certificate uses addEventListener).
