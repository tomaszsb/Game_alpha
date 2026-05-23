# Project Status

**Last Updated:** May 23, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.0** 🎉 — Workstream 3 retired. Twelve versions shipped May 22–23 (v2.69.7 deploy.sh cp-a nesting race fix; v2.69.8 hide START-QUICK-PLAY-GUIDE legacy tile; v2.69.9 pan buttons on BoardCanvas Controls; v2.70.0 CHEAT-BYPASS money penalty + roll_group validation; v2.70.1 reloadAllData generalization + paired-dice button dedup; v2.70.2 bug reports stamped with deploy version; v2.70.3 suppress duplicate Next-Step dice button; v2.70.4 strict-any-phase 20% design fee end-game; v2.70.5 dictionary discoverability — Phase A of newcomer jargon mode; v2.70.6 `npm audit fix` cleared both moderate vulns; **v3.0.0 BoardV3 retired** — BoardCanvas (React Flow, coordinate-driven, drag-to-save) is the only board renderer; -2,400 LoC net).

## Where We Are

The game is live at `https://game.unravelcodes.com`. The Beta regression gates (Ghost Player + test suite + typecheck) are in place and have caught real regressions. Workstream 6 (engine-data separation) closed Apr 29, 2026 with v2.58.0. Voice rewrite Pass 1 shipped May 6 (v2.60.0). Workstream 3 (Living Map) Phase A foundation shipped May 8 (v2.62.0); Phase B shipped across v2.63.0–v2.63.3; **Phase C closed v2.64.0 (2026-05-15)** with A* edge routing via `@jalez/react-flow-smart-edge`. v2.63.5 added `GET /api/public/feedback/open` so the `/start` slash command pulls fresh player feedback at session start. v2.63.6–v2.63.8 (May 15 AM) shipped a voice sweep + card-name source-of-truth consolidation, then restored the Ghost Player strict gate to 50 games × ≥90% wins via cancellation-aware abort + forward-bias bot heuristic. **v2.63.9–v2.64.7 (May 15 PM, 9 versions)** rapid-fire shipped a series of playtester-driven fixes: residual E-card voice leaks in the manual-effect path (TurnService + buttonFormatting prefix-extraction return_ case); the long-deferred Workstream 3 Phase C A* edge routing; PM-DECISION-CHECK self-loop data fix; a ResourceSnapshot-driven BeforeAfterBlock in the result modal showing money/scope/time/card deltas with `↔ N swapped` for replace actions; counting `activeCards` so auto-played funding cards (B/I) show up in the delta; time cost on every space header (`+5 days here · 47 days total`); suppression of redundant "Choose your next destination" rows in modals; and a `visualSummary` split so the modal's Summary block shows NPC narrative only (the auto tone+recap stays in `summary` for TTS).

## What's Open

For active priorities and detailed backlog, see [TODO.md](../../TODO.md).

For per-version history, see [CHANGELOG.md](../../CHANGELOG.md).

For Beta strategy and the v3.0.0 ship criteria, see [BETA_PLAN_V3.md](./BETA_PLAN_V3.md).

### Top-of-mind right now

0. **Workstream 7 — Plan Approval Mechanic** — ✅ COMPLETE (2026-05-16 → 2026-05-17). All 5 phases shipped v2.65.0 → v2.65.4 (foundation + badges + revoke triggers + REG-DOB-FINAL-REVIEW two-stage gate + end-game penalty + modal narration sweep). Original PM-DECISION-CHECK resume-hub bug (`fb:bbc94ec8`) closed as a side effect. See [BETA_PLAN_V3.md → Workstream 7](./BETA_PLAN_V3.md) and CHANGELOG for per-phase detail.
1. **Workstream 3 — Living Map** — ✅ **FULLY RETIRED in v3.0.0** (2026-05-23). Phases A–C shipped earlier (coordinate columns, BoardCanvas, A* edge routing). Phase D: drag-to-save shipped v2.66.0 + reopen-revert fixed v2.69.4 + deploy.sh cp -a nesting race fixed v2.69.7. v3.0.0 deleted `BoardV3.tsx` (879 lines), `boardLayout.ts` (785 lines), `BoardV3.css`, and `tests/utils/boardLayout.test.ts` (721 lines). PHASE_COLORS / shortName / truncate relocated to new `src/utils/boardCommon.ts`. TVDisplay swapped to BoardCanvas. BoardToggle dropped Old/New buttons. Net: -2,400 lines. Tagged v3.0.0 in git.
2. **Voice rewrite Pass 2** — modal copy. The doc has `### Modals fired here` tables for ~50 spaces with per-effect modal text. Blocked on a mapping pass: doc uses human-readable labels ("Take Owner's Money") whereas `ModalConfig.csv` keys by engine effect_action values (`add`, `draw_E`). Worth scripting; the doc parser in `scripts/merge-voice-rewrite.mjs` is a starting point.
3. **Story narrative authoring** — creator-driven content. Tool ready (`scripts/set-narrative.mjs`); rollout pace is whatever the user chooses to author. 5 of ~75 card-effect rows have narratives so far.
4. **Workstream 5 — Live Dictionary** — ✅ **closed v2.67.0** (2026-05-20). CORS allow_origins added on the scraper side, same-origin guard removed on the game side. Live terms now hydrate on every game start; bundled CSV remains as offline-resilience fallback.

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
