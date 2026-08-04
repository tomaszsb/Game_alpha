# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 4, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.95** — confirmed live via `/health` (commit `8af3a93`).

## Current sprint
**2026-08-04 — took G160 (board-connector redirect handles) from "code-complete, unconfirmed" to a fully-featured, permanent, server-backed editing system, driven by real-browser testing round trips.** Fixed the actual "hover works, drag doesn't" bug: not a CSS/JS issue, the user had been testing in the standalone Board Layout Editor, a tool that was never wired to the waypoint props at all (see CLAUDE.md TACTICAL). From there, live testing surfaced feature requests one at a time and each was built and re-verified: multi-bend waypoints capped by connector length, manual bundling/unbundling for overlapping connectors leaving the same node, box-side anchor snapping (4 fixed points per tile, server-persisted), a fix for anchor handles landing on identical pixels ("pretty random" grabbing — resolved via collision detection + an offset-rosette spread, reusing the bundling work rather than a new picker menu), a restore-one-of-several picker component shared across both admin surfaces, and a previously-missing hide-connector control in the Board Layout Editor. One hotfix (v3.1.92) shipped mid-arc for a live crash caused by an un-migrated data-shape change, fixed via self-healing schema upgrade rather than a manual data patch.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2646 passed / 0 failed** (175 files). Ghost-gate background run from this session still pending confirmation (see NEXT_SESSION.md).
- **Lint:** clean on every touched file this session.
- **Deploy:** v3.1.95 confirmed live (`/health` → `8af3a93`).
- **Dashboard feedback:** one report (`fb:feedback-1778327469678-d27a73d0`) confirmed fixed-and-live this session; flip-to-resolved pending a yes/no from the user (see NEXT_SESSION.md).
- **Dictionary-scraper (separate repo/deploy):** unchanged this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **v3.1.95 hover-highlight/distinct-cursor confirmation** — shipped and deployed, needs one live playthrough to confirm the anchor-vs-node grab disambiguation actually reads clearly to the user.
2. **Demo video** — script + storyboard drafted; needs footage, then wire the "Watch demo" button.
3. **D&D-reskin engagement-data check** — held pending existing engagement-stats data review before any further work (see NEXT_SESSION.md).
