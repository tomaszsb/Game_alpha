# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 12, 2026 (third session)
**Current Phase:** Beta — live in production (server temporarily down: drive migration)
**Current Version:** **3.0.76** (**PENDING DEPLOY** — v3.0.74/75/76 all queued; Unraid drives being replaced, Docker intentionally stopped)

## Current sprint
**2026-06-12 (pm/eve) — the teacher instance layer, designed and built in one session.** Deck-of-cards model designed with the user, hardened by 4 external reviews + Q&A (spec: [TEACHER_LAYER_DESIGN.md](./TEACHER_LAYER_DESIGN.md)). Shipped: **Phase 1** (v3.0.74 — stock refreshes every deploy, classroom config preserved, one-time live-board migration, atomic version-stamped bakes; **kills the data-deploy gap**), **Phase 2** (v3.0.75 server core: two-tier space protection, detour resolution, teacher copies, validation report; v3.0.76 UI: lobby → Admin Tools → 🏫 Classroom Setup with hybrid switch-off confirm + copy editor). **Phase 3 design settled** (admin-mediated full accounts, games carry their classroom) — build gated on Phases 1–2 running live. Phase 4 stays behind its design gate.

## Health
- **Tests:** koniec sweep 1805/1805 green (components/utils/services/server; +89 new this session).
- **Build / typecheck:** clean. **Lint:** 386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** BLOCKED on hardware — user replacing failing Unraid drives (Docker stopped deliberately; both public domains show tunnel-down 404s, expected). First boot after deploy runs the one-time classroom-1 migration — **check the boot log for "🏫 Migrated live board"**.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.74–76 + verify** once the new drive is in — migration log line, then eyeball the new Classroom Setup screen (no human has seen it yet).
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever; design session, deploy-independent.
3. **Phase 3 build** (multi-teacher front door — design done) after 1–2 prove out live; DEF-3/DEF-4 cleanup as filler.
