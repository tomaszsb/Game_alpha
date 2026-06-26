# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 26, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.86** — **deployed live 2026-06-26 (commit `6e017d7`), badge confirmed.** Pile 3 change-legibility (recall modals + move popup). Shipped alongside v3.0.85 (Pile 2 panel UX + expeditor phase-gate fix). All new-panel work behind the opt-in toggle; the live default game is unchanged except the phase-gate fix, the SETUP→OWNER relabel, and the 2026-06-25 narration/avatar/version-badge fixes.

## Current sprint
**2026-06-26 — Pile 2 + Pile 3 of the new-panel feedback (v3.0.85 → v3.0.86).** Worked the maintainer's design rulings and the recall cluster from the 2026-06-23 playtest. **Pile 2 (v3.0.85):** per-type action icons, first-visit glow on the action buttons, a grayed `✓` trace for used actions (no more "buttons vanish"), and reversible move-picks (check/uncheck until End Turn) — plus a correctness fix so a phase-restricted **expeditor can't be activated outside its work phase** (the shared `canPlayCard` had a carve-out the classic panel never had; now matched), the owner spaces relabeled `SETUP`→`OWNER`, and the held 2026-06-25 fixes (Pays/Costs label, E-only Activate, tappable dice-result rows, Owner 1st-person narration, color-ring avatars, version badge). **Pile 3 (v3.0.86):** the between-turns "you moved" popup is back; a **"📋 My numbers"** modal recalls scope + each work package's cost + money/time; a **"📜 History"** modal shows the committed-action timeline (the Project Chronicle's first slice). All verified live.

## Health
- **Tests:** typecheck + build clean; targeted sweep (components/utils/services) **1714/1714 green** (+~24 new across the session). ⚠️ `tests/E2E-LogicPlaythrough.test.ts` is a known **intermittent** flake (60s hang ~1-in-3, passes 5/5 on clean re-run — async race in the *test*, not the engine; tracked in TODO).
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.86 deployed live (`6e017d7`), badge confirmed.** Always **commit + push BEFORE** handing over the deploy command (`deploy.sh` pulls master + stamps the badge from HEAD). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Decision pending — make the new panel the default?** Pile 2 + Pile 3 are done, so the new panel now matches *and exceeds* the classic panel (recall modals, phase-correct Activate). The toggle stays until the maintainer confirms it's feature-complete enough to flip the default.
2. **Fuller Project Chronicle (P2–P5 in TODO).** This session shipped the readable-history *first slice*. Remaining: inline ▲/▼ deltas on the figures, click-an-entry-to-replay-its-highlight, a TV-persistent feed via `NotificationService`, tiered work cards, time-feel, and the a11y/pedagogy pass.
3. **Low-pri / tracked:** the deferred outcome-modal (before→after) restyle; optional `effects_on_play` prose for 74 E + 49 L cards; the glossary duplicate-key bug; the E2E-LogicPlaythrough test flake.
