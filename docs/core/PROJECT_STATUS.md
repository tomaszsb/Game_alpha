# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 29, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.87** — **built + pushed, PENDING DEPLOY.** Cluster B playtest leftovers + a full "no game language" copy sweep. The voice sweep touches the **live default game** (player copy now describes outcomes, never the die number/🎲); Cluster B mixes shared-modal fixes (glossary dup-key, roll-result clarity, expeditor-replace phase chip) into both panels.

## Current sprint
**2026-06-29 — Cluster B + voice sweep + backlog hygiene (v3.0.87).** Closed the last three 2026-06-23 new-panel reports (glossary duplicate-key React warning; the "effect applied but nothing changed" empty-header on routing-only rolls; the missing phase chip when choosing which expeditor to replace). Then a full **no-game-language sweep** per the maintainer's voice rule: removed the raw die number + 🎲/🃏 iconography from all player-facing copy and reframed wording to describe outcomes (Life Events now 📰, generic resources 📄; editor/teacher surfaces left as-is). Plus process work: TODO.md pruned of ~248 accumulated completed items (+ a Parking lot for deferred non-actions), `/koniec` taught to *delete* completed items not just check them off, and a ghost-run progress heartbeat added so long test batches are observable.

## Health
- **Tests:** typecheck + build clean; targeted sweep (components/utils/services) **1719/1719 green**; ghost fast unit tests green. (The 50-game ghost gates not run this session — ~50 min.)
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.87 PENDING** (built + pushed). Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master + stamps the badge from HEAD). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **New panel default — DECIDED 2026-06-29: not yet.** The redesigned player panel stays opt-in; the maintainer judged it not ready to flip. (This keeps the deferred outcome-modal restyle parked behind it.)
2. **Land the teacher card-insertion feature.** Phases 1–3 are live (verified 2026-06-14); the full authored-space feature (Phase 4a/4b) is built + green on the `phase-4a-card-insertion` branch, unmerged by standing decision. Its gate (Phases 1–3 live) is now cleared.
3. **Onboarding Phase C** (plain-English aliases for tiles/buttons) — core to the non-DOB-savvy-player goal; blocked only on the maintainer writing the alias strings. Plus the fuller Project Chronicle (P2–P5).
