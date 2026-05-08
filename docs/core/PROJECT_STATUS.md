# Project Status

**Last Updated:** May 6, 2026
**Current Phase:** Beta — live in production
**Current Version:** 2.61.1

## Where We Are

The game is live at `https://game.unravelcodes.com`. The Beta regression gates (Ghost Player + 23-batch test suite + typecheck) are in place and have caught real regressions. Workstream 6 (engine-data separation) closed Apr 29, 2026 with v2.58.0.

## What's Open

For active priorities and detailed backlog, see [TODO.md](../../TODO.md).

For per-version history, see [CHANGELOG.md](../../CHANGELOG.md).

For Beta strategy and the v3.0.0 ship criteria, see [BETA_PLAN_V3.md](./BETA_PLAN_V3.md).

### Top-of-mind right now

1. **Voice rewrite merge** — `docs/core/AUTHORED_COPY_REVIEW.md` is fully drafted, awaiting user sign-off on 3 flagged speaker calls + 4 CSV structural changes. Then merge text into `Spaces.csv`, populate `ModalConfig.csv`, regenerate `CLEAN_FILES`.
2. **Story narrative authoring rollout** — v2.50.0 shipped infrastructure; only 2 spaces have authored narratives so far. Drafts for the rest live in `docs/core/narratives-draft.md`.
3. **Workstream 3 — Living Map** (blocking v3.0.0 ship): coordinate-driven board reading `pos_x`/`pos_y` from CSV. Not started.
4. **Workstream 5 — Live Dictionary** (blocking v3.0.0 ship): live-fetched terms from `dictionary-scraper`. Not started.

## Reading Map

| Question | Doc |
|---|---|
| What did we ship recently? | [CHANGELOG.md](../../CHANGELOG.md) |
| What's the user-facing change? | [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md) |
| What's the active backlog? | [TODO.md](../../TODO.md) |
| Why does the architecture look this way? | [BETA_PLAN_V3.md](./BETA_PLAN_V3.md), [ARCHITECTURE.md](../technical/ARCHITECTURE.md) |
| How do I run the tests / deploy? | [CLAUDE.md](./CLAUDE.md), [TESTING_GUIDE.md](../technical/TESTING_GUIDE.md) |
| What's the gameplay? | [USER_MANUAL.md](../user/USER_MANUAL.md) |

> This file used to be a rolling log of recently-completed work. That role has been collapsed into CHANGELOG.md (which is per-version) and the "Top-of-mind" list above (which captures pending work). Old per-week status entries are in git history if needed.
