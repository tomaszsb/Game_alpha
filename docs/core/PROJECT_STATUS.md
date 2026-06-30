# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 30, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.90** — **deployed + confirmed live 2026-06-30** (`aa1edba`). Cost drill-down in the new-view ledger ("My numbers"): tap any work package to see its full cost (build + design + filings + buffer), "Total scope" collapses behind a drill-down, and a new "Full project budget" line reconciles scope with "Still to raise" — resolving the confusing "Still to raise > Total scope" presentation. Opt-in new panel only. Prior live: v3.0.89 (the ledger itself), confirmed live 2026-06-29.

## Current sprint
**2026-06-30 — ledger cost drill-down.** Shipped **v3.0.90** (opt-in new panel only). [projectFinances.ts](../../src/utils/projectFinances.ts) now allocates the design (20%) / regulatory (5%) / contingency budgets to each work package by its share of scope (each gets a `fullCost`; the per-item fulls reconcile to `commitments`). [PlayerNumbersV2.tsx](../../src/components/player/PlayerNumbersV2.tsx): each package taps open to its cost breakdown; "Total scope" is itself a drill-down (collapsed by default → progressive disclosure, the accordion follow-up); a "Full project budget" line ties the scope list to "Still to raise" with the maintainer's diegetic explanation ("the owner's prices fold in design, filings & a safety buffer"). Verified live in game G52.

## Health
- **Tests:** typecheck + build clean; targeted sweep (components/utils/services) **1738/1738 green** (+3 new this session). Full `npm test` hangs on Windows (known) → targeted sweep is the gate. (50-game ghost gates not run — opt-in-panel-only, no engine/movement/card touch.)
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.90 deployed + confirmed live 2026-06-30 (`aa1edba`).** Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master + stamps the badge from HEAD). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Before→after outcome modal** (the "what just happened" / dice-result modal) — next planned new-view piece. Gate it to the new panel so live classic is untouched; reuse `projectFinances` + ledger styling to show before-vs-after and name which resource/expeditor changed. Resolves fb:dc7652ec / 0001f5df / 0fc63fc1 / 3aad5f84.
2. **Remaining new-view ledger follow-ups:** wire dark mode + fix glossary-link contrast in the V2 modals (they're light-only today). (The "Still to raise" confusion + a first slice of accordion/progressive-disclosure shipped v3.0.90.)
3. **Onboarding Phase C** (plain-English aliases for tiles/buttons) — blocked only on the maintainer writing the alias strings. Plus the migration goal: get the new panel ready to become default.
