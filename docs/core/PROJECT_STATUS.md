# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 11, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.70** (deployed 2026-06-09)

## Current sprint
**2026-06-11 — codebase deficiency audit + bug triage (no new version, no source change).** Ran a full static audit → new **[docs/technical/DEFICIENCY_AUDIT.md](../technical/DEFICIENCY_AUDIT.md)** (13 findings, DEF-1..DEF-13). Build/typecheck/tests all green; the findings worth acting on are two security gaps (WebSocket `subscribe` skips token auth → state readable without token; feedback-read endpoints unauthenticated/expose reporter PII), a latent React hook-ordering bug (`useMemo` after early `return null` in player-panel sections), and a dead `npm run lint` (386 errors, mostly false `no-undef`; not in CI). Also triaged **3 new dashboard reports** (2026-06-11, v3.0.70) into TODO: bank-loan button mislabeled "Accept Owner Funding"; result-modal flash-close on fast click; Perplexity in-app-browser load failure (environmental). None fixed yet — all queued in TODO.

## Health
- **Tests:** 1628/1628 passing (re-confirmed this session via the koniec sweep — zero source changes). Typecheck + build clean.
- **Build / typecheck:** clean.
- **Lint:** `npm run lint` reports 386 errors (see DEFICIENCY_AUDIT DEF-4 — config is TS-unaware, ~84 false `no-undef`; not a regression, long-standing).
- **Deploy:** v3.0.70 live in production. Backups in `server/data/game-data/_migration_bak/`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af` + L66) — game-level tutorial; the biggest remaining product lever (recurring "overwhelming for newcomers" feedback theme).
2. **Teacher instance layer + space catalog** (design initiative) — master-library vs per-instance-config split: turns the manual data-sync into a dashboard button AND enables teachers to add/remove spaces. Needs a focused design/brainstorm session first (see TODO).
3. **Game length watch** — smart-bot avgTurns=149; not urgent (bot turns ≠ human minutes; under the ~40-min class-period budget). Trigger to trim mechanics/space requirements: when a *real* playtest game runs past ~40 min.
