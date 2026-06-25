# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 24, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.84** — **deployed live 2026-06-24 (commit `b48f1cd`), badge confirmed.** Seven playtest-feedback fixes from the new-panel QA pass; two improve the live default game, five are in the opt-in new panel.

## Current sprint
**2026-06-24 — new-panel playtest fixes (v3.0.84).** `/start` swept **18 dashboard reports from one playthrough** on the opt-in redesigned panel; triaged into clear bugs / design decisions / a bigger "change-legibility" project, and shipped the **7 clear bugs**. **Live default game:** the Life Event "bottom line" now **names** what was lost/gained (e.g. "lost 2 Expeditors (Speed Demon, Paper Pusher)") instead of "lost 2 resources" — receipt snapshot captures the hand by identity at both engine emission sites ([lifeEventReceipts.ts](../../src/utils/lifeEventReceipts.ts)); and the card-choice prompt reads "Choose 1 Expeditor to remove" not "…1 E card…" ([CardEffectHandler.ts](../../src/services/CardEffectHandler.ts)). **Opt-in new panel** ([PlayerPanelV2.tsx](../../src/components/player/PlayerPanelV2.tsx)): glossary terms are now tappable (missing `onTermClick`); "what's affecting you" items are tappable with a pick-list for multi-card chips; finished Life Events render grayed; and impossible "Replace Expeditor" actions are hidden. New-panel changes verified live in a running game (G36).

## Health
- **Tests:** **full suite green** (vitest exit 0; +~10 new across receipts + PlayerPanelV2). The `ButtonNesting` regression test passes (relevant — added button elements this session).
- **Build / typecheck:** clean (build proven by the successful live deploy). **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.84 deployed live (`b48f1cd`), badge confirmed.** ⚠️ First deploy attempt shipped the OLD code because the fixes were uncommitted — `deploy.sh` does `git pull origin master` then stamps the badge from HEAD, so **commit + push BEFORE handing over the deploy command**. Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000); Vite-only → red "Couldn't start a new game".

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Remaining new-panel feedback — Pile 2 (design calls for the maintainer).** From the same 18-report sweep: buttons look too alike (per-type color/icon?); first-visit green dot should be on the action buttons, not just commit; "buttons vanish with no confirmation/undo"; the E-card "Funding phase" label vs. being activatable in Setup (tighten rule or fix label?). These need a maintainer ruling before building.
2. **Pile 3 — the "change-legibility" project.** "Let me recall my scope/cost/work packages" + bring back the between-turns move popup → the Project Chronicle / ledger initiative already in TODO (P1 Chronicle → P5 a11y).
3. **Decision pending — make the new panel the default?** Still opt-in; keep the toggle until the maintainer confirms feature-complete. Plus tracked low-pri items: optional `effects_on_play` prose for 74 E + 49 L cards; glossary duplicate-key bug; the deferred outcome-modal restyle.
