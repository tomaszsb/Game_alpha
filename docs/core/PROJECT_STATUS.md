# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 12, 2026 (second session)
**Current Phase:** Beta — live in production
**Current Version:** **3.0.73** (deployed + live-verified 2026-06-12)

## Current sprint
**2026-06-12 (pm) — security hardening shipped (v3.0.72).** Every server endpoint audited and locked to the maintainer's access model: spectator **reads stay open by design** (classroom "jack-in-the-box" game), writes and PII reads require keys. Closed audit items DEF-1 (0 npm vulns), DEF-2 (read half ruled by-design; cross-game WebSocket write FIXED), DEF-5 (debug fail-open), DEF-6 (feedback PII) **plus four gaps the audit missed**: unauthenticated game delete/reset, public game-code list (defeated join-by-code), public visitor logs (IPs), legacy gamestate writes. Companion dashboard fix (feedback proxy sends FEEDBACK_TOKEN) already **deployed live** to the Unraid dictionary-scraper stack, so the dashboard survives the game deploy. New `server/authGuards.js` + 37 tests incl. live ws/curl verification.

## Health
- **Tests:** koniec sweep 1718/1718 green (components/utils/services/server; +37 new this session).
- **Build / typecheck:** clean. **npm audit: 0 vulnerabilities** (was 2 critical).
- **Lint:** `npm run lint` reports 386 errors (DEFICIENCY_AUDIT DEF-4 — config is TS-unaware; long-standing, not a regression).
- **Deploy:** v3.0.73 LIVE (commit 360f0ed, bundle index-Bc3AUC4f verified). All locks verified against production with curl (401s without keys, 200s with). v3.0.73 follow-up: /health no longer lists game codes.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — game-level tutorial; the biggest remaining product lever (recurring "overwhelming for newcomers" feedback theme). Moves up: the security project is fully shipped and live-verified.
2. **Teacher instance layer + space catalog** (design initiative) — master-library vs per-instance-config split; needs a focused design session first.
3. **Remaining audit items** — DEF-3 (hook-order crash risk) and DEF-4 (lint rehab). Plus user chore: rotate the Unraid root password (TODO).
