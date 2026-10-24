# Next session starter — written 2026-10-25 by /koniec (v3.8.64)

*2026-10-24 addendum: a side session tried the eslint 10 upgrade and stopped (no game work; see TODO). Lint currently has 4 errors + 23 warnings.*

## State at handoff
- **Version:** v3.8.64 (3.8.47-64; live is e15f13aa = 3.8.49) committed + pushed; **LIVE** (`/health` 228e187b checked 2026-10-24; Tom deployed) (older note: v3.8.46 was LIVE, `/health` `22f1de48` = HEAD, checked 10-23 13:00 UTC; Tom deployed 3.8.41-46 in one go).
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Last shipped 3.8.58-64 (all pending deploy; live is 3.8.49):** 58 old classroom write key refused; 59 the 17 contrast spots fixed (axe 17 → 0); 60 design notes (logo upload, robot banker); 61 npm 12.2.1 in Dockerfile + deploy gate (first deploy is its real test); 62 phone mode buttons say "Play alone on this phone" / "Put it on a TV"; 63 npm audit fix 9 → 0; 64 reminder email validated + BuilderBids random pinned. Earlier, **3.8.41-57:** v3.8.41 pulsing red "you would be short" warnings; v3.8.42 a push-back no longer erases the drawer's own lasting life event (also solo); v3.8.43 per-space "?" help on the work button, plain History notes, no doubled "outcome came back"; v3.8.44 hint "Tap: see the cost. Hold: do it.", bank loans named for your project, "$X to raise" instead of "deficit"; v3.8.45 days saved by a played expeditor stay saved through a push-back (Tom: spent means spent); v3.8.46 certificate asks for a real name when the game name is "Player N".
- **Tests:** `npm test` 311 files / 4135 green (v3.8.64); ghost 15 passed, 1 skipped (v3.8.63; 3.8.64 touched no game logic); build clean; typecheck only the old `dataGate.test.ts` errors. One unexplained one-off `BuilderBids.test.ts` failure seen once (test now pins Math.random; cause unknown, hypothesis: load).

## Added after the wrap-up: v3.8.47-49 (committed + pushed, NOT deployed; Tom deploys)
- "Step 1: put the game on a big screen" for phone-first students (see CHANGELOG 3.8.47). Open for Tom: a real-TV test (Samsung, Fire TV, Google TV), what TV type his TV Bro is on and how he installed it, and whether the host should get a nudge to add one player per phone before students type the code (a new TV game starts with only "Player 1").

- Side topic this session (not game work): a separate session, nextcloud-setup, set up Nextcloud + a whiteboard on the Tower for Tom's work competition; it waits on Tom for DNS, Nginx Proxy Manager and Cloudflare Access for files./board.unravelcodes.com. Nothing in this repo.

## Top 3 open items
1. **Read the Jarvis robot report on v3.8.46** (hold on Hire, opened walls, the office's extra choices, game length). Not read yet.
2. **Office reports left:** "turns 2-6 show no days" (c61ec1f2; History now says "Pushed back on the quote: N days added", unconfirmed by the student); the "?" for the work button at the owner spaces is fine as is.
3. **Pop-up freeze cause** (ResizeObserver loop on a busy page; v3.8.34 only snaps it flat), plus the N3 design list (Inspector sign-off, Hire an Expeditor fork, TCO vs final CO; should a redesign cancel DOB approval?).

## Decisions waiting on the user
- Samsung/LG TVs from 2021 or older can't run the game (`es2020`); lowering the build target + legacy plugin is Tom's call (CHANGELOG 3.8.16).
- Backups: nothing copies `.env` or `server/data` off the Tower. Teacher password resets.
- "Finished games" number next to "created" in Site Stats (offered, not answered). Which logo on the certificate.
- Solo trophy scoring (every solo finisher gets all 3 trophies even at 963 days vs a 440 plan): told to the Manager only, not decided.

## Flip after deploy
- fb:0a4acf7a (architect "owner decides" help) fixed in v3.8.43, now live: PATCH resolved once Tom says yes. Do NOT flip fb:c61ec1f2 (unconfirmed). Still open on purpose: fb:1007f455, fb:83fcc4c4, fb:b5689dfa, fb:92e01028.

## Suggested first move
Ask whether to PATCH fb:0a4acf7a, then read the Jarvis report for v3.8.46 and see whether anything tripped.

## Suggested model for next session
Sonnet 5: small data/CSV rows and UI text; the pop-up diagnosis needs a real repro first.

## Reminders
- Bills count at End Turn; a push-back keeps cards spent, money paid, life events (and their lasting effects) and days an expeditor saved; quoted deals come back.
- Tests that play real spaces must pin `Math.random` or set state AFTER `startTurn` (arrival adds random days).
- Per-space tooltip lines: `dice_outcome_<W|I|...>_<SPACE>` rows in `ACTION_TOOLTIPS.csv`; card-kind wording: `type:B` row in `SCOPE_WORDING.csv`.
- Reading live games: only the activity log and `games.json` (saved rarely); a live game's state is in server memory.
