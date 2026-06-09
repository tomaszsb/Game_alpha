# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 9, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.70** (deployed 2026-06-09)

## Current sprint
**2026-06-09 — deploy + production data-sync (no new version, no source change).** Deployed v3.0.70, then a dashboard-cleanup pass: spot-checked 5 "resolved" feedback reports live and **caught one (fb:931a55de) that was fixed in code but never reached production** — surfacing the **data-deploy gap** (the server preserves its own writable CSV working-copy across deploys, so data fixes in `public/data` don't propagate; see CLAUDE.md TACTICAL + `project_data_deploy_gap` memory). Audited live-vs-master, found **5 stale CLEAN files**, fixed all 5 on the live server while preserving the user's board layout (only `pos_x`/`pos_y` are genuine live user-data — a blind copy would have wiped the board). Dashboard **9→4 open** (the 4 remaining are the parked onboarding/design cluster). Captured a **teacher-instance-layer + space-catalog** design initiative — the proper fix for the data-deploy gap, sharing a foundation with the long-standing "teachers add/remove spaces" vision.

## Health
- **Tests:** 1628/1628 (unchanged — zero source-code changes this session; deploy + live-data ops only). Typecheck + build re-confirmed clean.
- **Build / typecheck:** clean.
- **Deploy:** v3.0.70 live in production; 5 stale data files synced to the live server 2026-06-09 (verified serving, cf-cache MISS). Backups in `server/data/game-data/_migration_bak/`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af` + L66) — game-level tutorial; the biggest remaining product lever (recurring "overwhelming for newcomers" feedback theme).
2. **Teacher instance layer + space catalog** (design initiative) — master-library vs per-instance-config split: turns the manual data-sync into a dashboard button AND enables teachers to add/remove spaces. Needs a focused design/brainstorm session first (see TODO).
3. **Game length watch** — smart-bot avgTurns=149; not urgent (bot turns ≠ human minutes; under the ~40-min class-period budget). Trigger to trim mechanics/space requirements: when a *real* playtest game runs past ~40 min.
