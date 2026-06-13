# Next session starter — written 2026-06-13 by /koniec

## State at handoff
- **Version:** v3.0.76 — **DEPLOYED + LIVE** (verified: origin serves `index-z9qhpdgL.js`, commit 44e84ea). Unraid back up after the drive rebuild.
- **Branch:** master, clean + pushed (only `.claude/settings.local.json` + `ghost-history.jsonl`, intentional).
- **Last shipped:** no new code — a deploy/ops session that got v3.0.74–76 live and exposed two deploy-infra bugs.
- **Test suite:** 1805/1805 (last run 2026-06-12; no source changed this session). Typecheck + build clean.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Fix `deploy.sh` for the teacher layer (HIGH).** It WIPES `instances/` every deploy (classroom config dies) and resurrects old SOURCE/CLEAN. Fix: preserve `instances/`; drop the SOURCE/CLEAN restore (the server's on-boot stock-refresh handles stock). **Plus fix the migration** to read positions from CLEAN `GAME_CONFIG.csv`, not just SOURCE `Spaces.csv`. Must land before the teacher uses 🏫 Classroom Setup, or every deploy eats their work. (Full breakdown in TODO "Deploy infrastructure — teacher-layer gaps" + CLAUDE.md TACTICAL.)
2. **Eyeball 🏫 Classroom Setup live** (now reachable, never human-seen) + **board-layout decision**: the maintainer's custom tile layout was lost ~June 12 (unrecoverable). Current board = the stock grid. Keep it, or re-arrange once — but only after item 1 so it survives.
3. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever, deploy-independent. Then **Phase 3 build** (multi-teacher front door, design done).

## Decisions waiting on the user
- **Board layout:** keep the stock grid, or re-arrange a custom one? (Old custom layout is gone for good.)
- Rotate the Unraid root password (typed into chat 2026-06-12) — still pending.

## Suggested first move
Fix `deploy.sh` + the migration (item 1) — it's the thing actively eating work and blocks safe teacher-layer use. Want to start there, or do the onboarding design session first? Clean up the recovery tool early: `ssh unraid "rm /mnt/user/appdata/Game_alpha/server/data/recover-board.mjs"`.

## Reminders
- **Deploy ONLY via `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`** — NEVER `docker compose up` (spawns a parallel `game-alpha` container NPM doesn't route to). NPM routes the domain → port 3080; cf-cache is DYNAMIC (Cloudflare doesn't cache the HTML, so a stale page after deploy is the wrong-container trap, not a cache).
- Deploy runs from the Windows terminal, never from Claude's shell.
- A recovery tool `recover-board.mjs` is sitting on the live server in `server/data/` — delete it.
