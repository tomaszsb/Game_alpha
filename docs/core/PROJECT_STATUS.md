# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 2, 2026 (evening)
**Current Phase:** Beta — live in production
**Current Version:** **3.1.89** in the repo, pushed. **Not yet deployed** — v3.1.88 is what's currently live.

## Current sprint
**2026-08-02 evening — closed the last open naming decision, then built both top-3 items from the v3.1.88 handoff.** Named the Bank/Investor/Lender board characters from their existing narration voice (board tiles now show a discipline badge instead of the generic "Funding" label). Built G160 (drag a small handle on any board connector to bend its auto-routed path through one point) — code-complete and test-covered, but not yet visually confirmed in a real browser: this session's Browser pane wasn't compositing frames, confirmed via a clean git-revert A/B test rather than assumed. Built in-game engagement tracking (space-reached/game-finished/panel-opened events, reusing the existing acquisition-funnel pipeline) — deliberately dropped the spec's `game_abandoned` live event in favor of inferring it at aggregation time, and smoke-tested end-to-end against a running server.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2563 passed / 0 failed** (173 files — up from 2552: +3 for the waypoint-path math, +11 for the engagement-stats aggregation). Ghost gates **33/33 clean** (all 10 files, ~14 min) — confirms neither the board UI change nor the new tracking calls touched real gameplay behavior.
- **Lint:** clean on every touched file this session (0 errors; only pre-existing documented `set-state-in-effect` warnings, unchanged).
- **Deploy:** v3.1.89 pushed to master, not yet deployed — a fresh `bash deploy.sh` run is needed to make the live site match the repo.
- **Dashboard feedback:** not re-checked this session (no feedback-driven work; both fixes were maintainer/TODO-decided, not report-triaged).
- **Dictionary-scraper (separate repo/deploy):** unchanged this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **G160 real-browser confirmation** — code done, needs one real playthrough to confirm the drag-to-redirect handle actually works (see TODO.md).
2. **Demo video** — script + storyboard drafted; needs footage, then wire the "Watch demo" button.
3. **Deploy v3.1.89** — whenever convenient; nothing urgent is blocked on it.
