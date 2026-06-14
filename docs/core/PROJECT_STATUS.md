# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 14, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.78** — **DEPLOYED + LIVE** (verified 2026-06-14: origin serves `index-BqK6wriC.js` content-type js; Phase 3 endpoints respond — `login`→400, `instances/mine`→401)

## Current sprint
**2026-06-14 — teacher instance layer Phase 3 (multi-teacher front door) built end-to-end + toolchain refresh.** Earlier in the session: fixed the two deploy/migration bugs (v3.0.77, deployed + verified live) and **proved the data-deploy gap dead** (a repo CSV sentinel reached origin via a normal deploy). Then built all of **Phase 3**: teacher accounts + sessions (scrypt, no third-party auth), multi-classroom server plumbing (`/data/i/<id>/`, games carry an `instanceId`), and the **combined-login UI** (one box: blank username = admin master password, a username = teacher account → their classroom; admin "Manage Classrooms & Teachers" screen). Verified end-to-end against a local server. Finally upgraded **Vite 7→8** (+plugin-react 6, vitest) which cleared both npm-audit highs → 0 vulnerabilities. **Nothing of Phase 3/Vite 8 is live yet** — Phase 3d is deploy + verify, which then unblocks Phase 4 (card insertion).

## Health
- **Tests:** **full suite 2095 passed / 1 skipped (2096) on the new Vite 8/vitest toolchain** (~52 min; ghost smart-bot 47/50, 0 hard failures, deterministic = baseline). Typecheck + build clean.
- **Build / typecheck:** clean. **npm audit: 0 vulnerabilities** (was 2 high — esbuild via Vite, now patched). **Lint:** 386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.78 LIVE + playtested** (maintainer confirmed no new deficiencies). ⚠️ Deploy ONLY `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` — never `docker compose up`. NPM routes the domain → port 3080; cf-cache is DYNAMIC.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Phase 4 — card insertion** (teacher-authored spaces / "replace one card with several"). **Now unblocked** (Phase 3 live + playtested). The spec's biggest-risk phase — start with a design pass, not code.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever, deploy-independent. Likely candidate for "remaining work before Phase 4".
3. **Ghost-run progress heartbeat** (small) — full suite is ~52 min with no mid-run visibility; add a tail-able per-game heartbeat. Sketch in TODO.
