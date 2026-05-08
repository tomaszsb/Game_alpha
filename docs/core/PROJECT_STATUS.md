# Project Status

**Last Updated:** May 8, 2026
**Current Phase:** Beta — live in production
**Current Version:** 2.63.0

## Where We Are

The game is live at `https://game.unravelcodes.com`. The Beta regression gates (Ghost Player + test suite + typecheck) are in place and have caught real regressions. Workstream 6 (engine-data separation) closed Apr 29, 2026 with v2.58.0. Voice rewrite Pass 1 shipped May 6 (v2.60.0). Workstream 3 (Living Map) Phase A — data-layer foundation — shipped May 8 (v2.62.0).

## What's Open

For active priorities and detailed backlog, see [TODO.md](../../TODO.md).

For per-version history, see [CHANGELOG.md](../../CHANGELOG.md).

For Beta strategy and the v3.0.0 ship criteria, see [BETA_PLAN_V3.md](./BETA_PLAN_V3.md).

### Top-of-mind right now

1. **Workstream 3 — Living Map, Phase B** (blocking v3.0.0 ship). Phase A foundation shipped v2.62.0 — `pos_x`/`pos_y` columns + pipeline + `IDataService.getPosition()`. Next: install `@xyflow/react`, build `BoardCanvas.tsx` (custom node + smoothstep edges + phase grouping via `parentId`), feature-flag side-by-side with BoardV3. Then Phase C/D delete `BoardV3.tsx` + `boardLayout.ts` (~1,664 lines).
2. **Voice rewrite Pass 2** — modal copy. The doc has `### Modals fired here` tables for ~50 spaces with per-effect modal text. Blocked on a mapping pass: doc uses human-readable labels ("Take Owner's Money") whereas `ModalConfig.csv` keys by engine effect_action values (`add`, `draw_E`). Worth scripting; the doc parser in `scripts/merge-voice-rewrite.mjs` is a starting point.
3. **Story narrative authoring** — creator-driven content. Tool ready (`scripts/set-narrative.mjs`); rollout pace is whatever the user chooses to author. 5 of ~75 card-effect rows have narratives so far.
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
