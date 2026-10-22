# Next session starter — written 2026-10-21 by /koniec

## State at handoff
- **Version:** v3.8.40 **LIVE** (`/health` `e99f54b1` = the /koniec sweep commit, which contains fcd5f8f7; Tom deployed 10-21 ~01:43 EDT, container up 20 s at 05:43 UTC). Only a TODO docs commit (`b9b0f4cf`) is newer.
- **PENDING DEPLOY: v3.8.42** (v3.8.41 pulsing red 'short' warnings + v3.8.42 push-back keeps the drawer's lasting life event; code + tests green, build clean). Live is still v3.8.40.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Last shipped (all live since the 10-21 deploy):** neutral dice words; "you would be short" warnings (builder bids, known arrival fees); pop-ups snap flat after 1.2 s; the office (Your Office) keeps unlocked steps (engineer, city filing, Fire Dept. intake, first step of each only); expeditor card cost on the Money page; History shows the turn in progress ("not final yet"), push-backs with their days, and board names in turn headers; certificate logo + "Visit our other sites" links (setup, board, win/loss, certificate); wider end screen; admin list shows MINE/STUDENT + progress; "Hold until it fills" cue. Live since 10-20/21: hold-to-hire, opened walls, start screen, screenshots fixed, New York days.
- **Tests:** `npm test` 307 files / 4083 green; build clean; typecheck only the pre-existing `dataGate.test.ts` errors. Ghost: 45 passed, 1 skipped. One unreproduced failure of `E2E-LogicPlaythrough` in an earlier full run (pinned).

## Top 3 open items
1. **Read tonight's Jarvis robot report (first run on v3.8.40; Tom was to run RUN-ME 41 first)** (04:00 run): hold on Hire (2.6 s), opened walls back to Find an Engineer, the office's extra choices, game length. Not run against any of it yet.
2. **Office reports left:** the "?" help for "see how much work is added" names the owner at the architect/engineer/lender spaces (one sentence per space in `ACTION_TOOLTIPS.csv`); "turns 2-6 show no days" (c61ec1f2) is probably the old gear-marked push-back line, unconfirmed.
3. **Pop-up freeze cause** (ResizeObserver loop on a busy page; v3.8.34 only snaps it flat), plus the N3 design list (Inspector sign-off, Hire an Expeditor fork, TCO vs final CO; should a redesign cancel DOB approval?).

## Decisions waiting on the user
- Samsung/LG TVs from 2021 or older can't run the game (`es2020`); lowering the build target + legacy plugin is Tom's call (CHANGELOG 3.8.16).
- Backups: nothing copies `.env` or `server/data` off the Tower. Teacher password resets.
- "Finished games" number next to "created" in Site Stats (offered, not answered).
- Which logo on the certificate (the game's logo is used; Tom said "my logo").

## Flip after deploy
- The 10 live-fixed class reports were closed 10-21 (open count 65 to 56). Still open on purpose: fb:1007f455 (start screen, waits for a student to confirm); fb:83fcc4c4, fb:b5689dfa, fb:92e01028 (pop-up snap-flat is only a partial fix).

## Suggested first move
Check `/health` for `e99f54b1` (or newer docs-only); if not live, ask Tom to deploy (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, `ssh -t` and type yes if a screen is connected; never 02:45-04:45 EDT). Then read the Jarvis report.

## Suggested model for next session
Sonnet 5: small data/CSV rows and UI text; the pop-up diagnosis needs a real repro first.

## Reminders
- Reading live games: only the activity log and `games.json` (saved rarely); a live game's state is in server memory, so ask Tom for the History or game link.
- Footers/links come from `src/constants/otherSites.ts`; board path chart: `node scripts/build-board-flowchart.mjs` (re-run after data changes), page at `docs/technical/BOARD_PATH_FLOWCHART.html`, published as an Artifact.
- Tests that play real spaces must pin `Math.random` (CLAUDE.md TACTICAL, 2026-10-21).
