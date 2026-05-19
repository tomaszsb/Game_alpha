# Project Status

**Last Updated:** May 19, 2026
**Current Phase:** Beta — live in production
**Current Version:** 2.66.0 (Workstream 3 Phase D — drag-to-save wired through; BoardV3 retirement deferred to v2.66.1)

## Where We Are

The game is live at `https://game.unravelcodes.com`. The Beta regression gates (Ghost Player + test suite + typecheck) are in place and have caught real regressions. Workstream 6 (engine-data separation) closed Apr 29, 2026 with v2.58.0. Voice rewrite Pass 1 shipped May 6 (v2.60.0). Workstream 3 (Living Map) Phase A foundation shipped May 8 (v2.62.0); Phase B shipped across v2.63.0–v2.63.3; **Phase C closed v2.64.0 (2026-05-15)** with A* edge routing via `@jalez/react-flow-smart-edge`. v2.63.5 added `GET /api/public/feedback/open` so the `/start` slash command pulls fresh player feedback at session start. v2.63.6–v2.63.8 (May 15 AM) shipped a voice sweep + card-name source-of-truth consolidation, then restored the Ghost Player strict gate to 50 games × ≥90% wins via cancellation-aware abort + forward-bias bot heuristic. **v2.63.9–v2.64.7 (May 15 PM, 9 versions)** rapid-fire shipped a series of playtester-driven fixes: residual E-card voice leaks in the manual-effect path (TurnService + buttonFormatting prefix-extraction return_ case); the long-deferred Workstream 3 Phase C A* edge routing; PM-DECISION-CHECK self-loop data fix; a ResourceSnapshot-driven BeforeAfterBlock in the result modal showing money/scope/time/card deltas with `↔ N swapped` for replace actions; counting `activeCards` so auto-played funding cards (B/I) show up in the delta; time cost on every space header (`+5 days here · 47 days total`); suppression of redundant "Choose your next destination" rows in modals; and a `visualSummary` split so the modal's Summary block shows NPC narrative only (the auto tone+recap stays in `summary` for TTS).

## What's Open

For active priorities and detailed backlog, see [TODO.md](../../TODO.md).

For per-version history, see [CHANGELOG.md](../../CHANGELOG.md).

For Beta strategy and the v3.0.0 ship criteria, see [BETA_PLAN_V3.md](./BETA_PLAN_V3.md).

### Top-of-mind right now

0. **Workstream 7 — Plan Approval Mechanic** — ✅ COMPLETE (2026-05-16 → 2026-05-17). All 5 phases shipped v2.65.0 → v2.65.4 (foundation + badges + revoke triggers + REG-DOB-FINAL-REVIEW two-stage gate + end-game penalty + modal narration sweep). Original PM-DECISION-CHECK resume-hub bug (`fb:bbc94ec8`) closed as a side effect. See [BETA_PLAN_V3.md → Workstream 7](./BETA_PLAN_V3.md) and CHANGELOG for per-phase detail.
1. **Workstream 3 — Living Map, Phase D** — ✅ **drag-to-save shipped v2.66.0** (2026-05-19). Admin can drop a tile in edit mode and `pos_x`/`pos_y` persist through the existing `/api/admin/save-source-files` endpoint with a step-pinpointed status banner. Old `BoardV3.tsx` + `boardLayout.ts` retirement (~1,664 lines + 721 test lines) deferred to v2.66.1, after a few playtests verify drag-save is stable. See CHANGELOG v2.66.0 for the wire shape.
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
