# Next session starter — written 2026-10-14 by /koniec

## State at handoff
- **Version:** v3.7.46 pushed. **LIVE when checked: `/health` = `3b2dbf72` = v3.7.43.** v3.7.44 (bug-report `diagnostics`), 3.7.45 (lint `any`s) and 3.7.46 (/challenge photo tour) are **pending deploy**. Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped this session (Manager: "continue the current backlog"):** 3.7.34 Life events tab only while an event is in action · 3.7.35 page flips proven in Edge + Money/Experts/Scope flip into each other · 3.7.36 Money page "where your money came from", the TV size panel stays put, 12 reports triaged · 3.7.37 admin games list home/off-network icons · 3.7.38 lint errors 0, duplicate-key fix · 3.7.39 every "Keep this size" tap logged · 3.7.40 E067 Tax Incentive Research pays 10% of scope as cash · 3.7.41 real fee in the replace list · 3.7.42 phone setup always shows an avatar · 3.7.43 DOB/FDNY in one place, a denial shows red · 3.7.44 reports carry `diagnostics` · 3.7.45 the 15 `any` warnings gone · 3.7.46 /challenge photo tour re-shot. Tooling: `scripts/uptime-check.mjs` (Tom scheduled it; texts after 3 misses; never sent a real alert).
- **Tests (v3.7.46):** typecheck + build clean; `npm test` 276 files / 3923 green; ghost gate green (11 files / 43 tests, 1 skipped). Lint 0 errors, 23 `set-state-in-effect` warnings (left on purpose).

## Top 3 open items
1. **Tom's device checks, then flips.** Checklist (plain words, by device): `.claude/tmp/TOM_CHECKLIST_2026-10-14.md` (gitignored; the TODO "Tom's checks" bullet summarizes it). Nothing flips until he confirms one by one (Manager's rule). Includes the Safari test on his iPhone for the light-mode report (UA `EdgiOS`; theory: Edge darkens the page; unproven).
2. **Three investigations are now instrumented — read the next report's `diagnostics` FIRST** (`GET /api/feedback/<id>.json?token=$FEEDBACK_TOKEN`; CLAUDE.md TACTICAL): orange money with no word (fb:c65560a3; live data says it should NOT be orange), TV with no buildings (fb:a6474bad; not reproduced), the 10-12 vanished scope; plus the ResizeObserver loop error (now names the observer). Do not guess fixes.
3. **Jarvis report of 10-15 03:00** is the first robot run on v3.7.43+ (three pop-ups, conditional Life events tab). Jarvis said it will message Game if anything trips; the robot reads none of `approval-tag-*`, `mat-tile-*`, `clipboard-tab-life`. It reached Hire a Builder once (10-14).

## Decisions waiting on the user
- None open that I know of. Decided 10-14: E067 as cash back; DOB "Option 1"; End Turn stays press-and-hold; finger-drag already works. Parking lot (26 items) all wait on Tom's word; the one that unblocks the most is recruiting 3-5 outside players.

## Flip after deploy
NOTHING flipped (Manager's rule). Waiting on Tom: 5b8a060c, 5617effb, aec545c4, 4e8a8550, 4db1b1d9 (tax card), a49b598f (DOB), f9e897b0 (may be fixed by 3.7.26), bf9dd267 (icons), 3fec0e88, bf6176e5, 08dbbe87, 102e0953, a31aff46, plus the older list in TODO. Close without a fix: 4824bc44, 3ec9388f, 0a827891.

## Suggested first move
Read `/health` and ask Tom (or the Manager) whether v3.7.46 is deployed and what he saw. If the deploy is done, the diagnostics are live: have him press the bug button next time orange money or the blank TV board appears.

## Suggested model for next session
Sonnet 5: device-feedback follow-ups and reading one report's diagnostics. Raise effort before a bigger model.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). v3.7.37/3.7.39/3.7.44 change the server, so the deploy restarts it.
- Commit files BY NAME (two sessions can share this folder); `git diff --stat` after any scripted edit (CLAUDE.md TACTICAL: CRLF, `io.open('w')` truncation, surrogates in heredocs).
- The permission check refuses to create standing jobs (e.g. Task Scheduler) and `sysctl`/host changes: hand Tom the command instead.
- The /challenge won/lost pictures are staged with made-up numbers; the teacher picture is old (needs a teacher login).
