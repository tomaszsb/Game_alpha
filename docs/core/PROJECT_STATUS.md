# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 13, 2026
**Current Phase:** Beta — live in production (Unraid back up after drive rebuild)
**Current Version:** **3.0.76** — **DEPLOYED + LIVE** (verified 2026-06-13: origin serves `index-z9qhpdgL.js`, commit 44e84ea)

## Current sprint
**2026-06-13 — deploy/ops session: v3.0.74–76 finally live, but the deploy exposed two infra bugs.** The teacher instance layer (Phases 1–2, built 2026-06-12) is now serving in production. Getting there took untangling a **wrong-container deploy** (a stray `docker compose up` spun a parallel `game-alpha` container that NPM never routed to — the canonical path is `bash deploy.sh` → `game_alpha`/3080). The verification then surfaced that **`deploy.sh` is not teacher-layer-aware**: it wipes `instances/` every deploy and resurrects old SOURCE/CLEAN, and the Phase-1 migration reads positions from SOURCE while the editor saves them to CLEAN — together these **silently lost the maintainer's custom board layout** (~June 12, unrecoverable; board is now the stock grid). Both bugs are tracked; neither is shipped-fixed yet.

## Health
- **Tests:** 1805/1805 green (last run 2026-06-12; no source changed 2026-06-13). Typecheck + build clean this session.
- **Build / typecheck:** clean. **Lint:** 386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** LIVE. ⚠️ **Do NOT deploy with `docker compose up`** — only `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. NPM routes the domain → port 3080 (the `game_alpha` container); cf-cache is DYNAMIC (Cloudflare doesn't cache the HTML).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Fix `deploy.sh` for the teacher layer** — preserve `instances/` across deploys (or teacher customizations die every deploy) + stop restoring old SOURCE/CLEAN so the data-deploy gap is genuinely dead. **+ fix the migration to read positions from CLEAN, not just SOURCE.** Highest priority — blocks safe use of Classroom Setup.
2. **Eyeball 🏫 Classroom Setup live** (now reachable) + decide whether to re-arrange the board (current = stock grid; old custom layout is gone).
3. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever; design session, deploy-independent. Then Phase 3 build.
