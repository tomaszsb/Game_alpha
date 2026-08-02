# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 2, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.88** in the repo, pushed. **Confirmed live mid-session** via `/health` reporting commit `8afb6de` (bundle-verified) — that commit carries every fix through the fee-expenditure tracking bug; the final two commits (5 decision resolutions + the CHEAT-BYPASS test fix, both docs/test-only, no gameplay code) are pushed but not yet in a fresh deploy.

## Current sprint
**2026-08-02 — a dependency-ordered backlog-clearing session through TODO.md's "Architecture / code health" bucket**, not a feature sprint. Several items explicitly flagged "1-2 sessions, do NOT do casually" turned out already resolved by past sessions that never removed the stale TODO line (ActiveEffect typing, the notification-bus unification, and the TEMP/REAL `TurnTransaction` boundary — the last one shipped back in v3.0.70/June) — the real value came from the verification passes themselves, which surfaced 3 real, previously-unknown bugs: `CardService.discardCards` silently dropping its audit-trail text, a real ~5.3ms/call performance trap discovered while fixing `getGameState()`'s shallow-copy risk, and (the most significant) `FinancialEffectHandler` never recording fee charges into the player's own spending ledger, so "Regulatory & filings" showed $0 regardless of real spend. Also resolved 5 decision-gated TODO items with the maintainer (lint stays manual, the G160 waypoint-redirect feature is approved for next session, the old PixelLab key stays in git history, the CHEAT-BYPASS routing tests are now seed-proof) and scoped a new in-game engagement-tracking feature as a ready-to-build spec for next session.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2548 passed / 0 failed** (172 files — up from 2543 baseline: +2 gap-closing tests for genuinely untested scenarios found auditing DEF-11, +2 pinning the fee-expenditure fix, +1 pinning the discard-reason fix, -1 confirmed-superseded skipped test deleted with its file, -1 confirmed-dead test deleted with `EffectFactory.validateCard`). Ghost gates **33/33**, re-run after every state/engine-touching change (StateService, DataService, EffectEngineService) tonight — unchanged, confirms none of the fixes touched real gameplay behavior beyond their intended scope.
- **Lint:** unchanged this session (not re-audited).
- **E2E determinism:** the CHEAT-BYPASS routing tests are now bankruptcy-proof for any seed — a test-only $150,000 cash buffer added right before the risky roll (worst-case penalty is -$100,000). Verified against `E2E_SEED=20` (the documented former failure case) and a 30-seed sweep, both clean.
- **Deploy:** confirmed live mid-session via `/health` bundle-verification (commit `8afb6de`) — first real confirmation the `/health` version-reporting fix from the prior session actually works in production.
- **Dashboard feedback:** 7 open as of a live check this session, all already tracked elsewhere in TODO.md; none relate to tonight's fixes (those were found via code investigation, not filed player reports).
- **Dictionary-scraper (separate repo/deploy):** unchanged this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **G160 per-edge waypoint redirect** — approved by the maintainer this session, not yet scoped/built.
2. **In-game engagement tracking** (how far players get, what draws their attention) — freshly scoped this session as a ready-to-build spec; not yet implemented.
3. **Demo video** — script + storyboard drafted; needs footage, then wire the "Watch demo" button.
