# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 23, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.83** — **deployed live 2026-06-23 (commit `e4d956b`).** Three more player-panel redesign increments + the scoreboard now reachable on the shared screen, all opt-in, so live default behaviour is unchanged.

## Current sprint
**2026-06-23 — player-panel redesign increments 3–5 + scoreboard live (v3.0.83).** Still behind the opt-in classic/new toggle (off by default; presentation only). Shipped: **E-card play from the influence zone** ([PlayerPanelV2.tsx](../../src/components/player/PlayerPanelV2.tsx) — playable Expeditors as Activate rows, gate+play via the canonical `cardService.canPlayCard`/`playCard` service rule, no drift); the **detailed-card view** ([PlayerCardDetailV2.tsx](../../src/components/player/PlayerCardDetailV2.tsx) — §5 model: type chip, key-facts icon rows, "why this matters" callout; reuses the ModalBase shell so the v3.0.71 flash-close fix stays intact; document-variant seam); and the **scoreboard "who" screen** ([ScoreboardV2.tsx](../../src/components/player/ScoreboardV2.tsx)) **wired into the live TV** as an opt-in "📊 Standings" overlay (phase-rail soft standings, default hidden). Furthest-phase calc extracted to a shared helper ([lifecycleProgress.ts](../../src/utils/lifecycleProgress.ts)) and ProjectProgress consolidated onto it. Card-detail "what it does" now hides the systematic `"Apply Card"` placeholder (audit: all 74 E + 49 L cards carry it; W/B/I authored). Began with a review of an externally-merged change-legibility/time-feel UX spec → captured as a TODO section + design-doc §10.

## Health
- **Tests:** **full suite green — 2190 passed / 1 skipped** (incl. ghost gate); +14 new this session (panel, detail, scoreboard, helper). Classic panel untouched.
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.83 deployed live (`e4d956b`), badge confirmed.** Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev browser verify needs BOTH servers** — Express (3001, game creation) + Vite (3000, client); Vite-only → red "Couldn't start a new game" (auto-memory `project_local_app_start`).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Player-panel redesign — continue.** E-card play + detail view + scoreboard landed (opt-in). Next: **outcome-modal (before→after) restyle** — DEFERRED until the panel is closer to default (shared live-turn modal); then app-wide dark mode + glossary flat-style alignment. The redesign can run a full turn end-to-end now.
2. **Decision pending — make the new panel the default?** Still opt-in; keep the toggle until the maintainer confirms feature-complete.
3. **Optional content + tracked follow-ups:** author real `effects_on_play` prose for the 74 E + 49 L cards (low); glossary duplicate-key bug (pre-existing, spawned task); the change-legibility/companion/time-feel UX initiative (P1 Chronicle → P5 a11y, now a TODO section).
