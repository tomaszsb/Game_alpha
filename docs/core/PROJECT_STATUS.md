# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 12, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.120** — **3.0.115 deployed 2026-07-12** (commit `b46cb30`, confirmed by maintainer); **v3.0.116–120 built, not yet deployed.**

## Current sprint
**2026-07-11/12 — closed the entire 10-item blind code review batch via `/loop /fixloop`.** Highlights: the frozen legacy `turn` counter (duration cards never expired, wrong turn numbers recorded), the dead `endTurn()` DOB penalty made reachable, duration-card lifecycle unified on `duration_count`, replaced cards now land in the discard pile instead of vanishing, the 5% investment fee now charges into the red like other mandatory bills, two player-setup uniqueness bugs, the `canEndTurn` movement-intent no-op, and timed life events now correctly tick only on the holder's own turn instead of everyone's. That last fix surfaced a genuine pre-existing TEMP/REAL staleness bug (a cached snapshot going stale via a fallback write path) — a broad first fix attempt passed every test except the ghost `smart-bot` gate, which caught a real soft-lock regression; corrected with a much narrower write-side fix (see CLAUDE.md TACTICAL). Also flipped 3 dashboard reports queued from the prior session once v3.0.115's deploy was confirmed, and logged a direct player comment requesting a new starting scenario (cash-strapped homeowner facing a Notice of Violation) as a decision item. Detail in CHANGELOG.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2368/2369 passing, 1 skipped, 0 failures** (607s), including all 5 ghost simulation gates (strict/smart-bot/negotiate-coverage/coverage/authoredInsertion, 50 games each).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.0.115. v3.0.116–120 built and pushed, awaiting the next `deploy.sh` run.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.116–120** — fully verified, nothing blocking.
2. **Push-back/Lock-the-scope buttons don't preview cost before pressing** — real feature work (needs a dry-run cost preview for dice-based actions) + a specific UI layout the player requested. fb:feedback-1783080349985-a3dc215f.
3. **New starting scenario: cash-strapped homeowner facing a Notice of Violation** — direct player comment logged 2026-07-12; needs a maintainer scope decision (new preset vs. different starting money vs. new narrative branch) before any engineering.
