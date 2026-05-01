# Code Style Guide — Unravel Codes: The Game

**Last Updated:** April 30, 2026
**Status:** Beta (v2.58.0)

> **Scope:** project-specific conventions only. Generic React/TypeScript patterns (immutable updates, discriminated unions, hooks) are well-known and not repeated here. The rules below are the ones unique to this codebase or arrived-at through specific incidents.

---

## TypeScript

- **Strict mode is required.** `npm run typecheck` returns 0 errors. Every commit must keep that true.
- **No `any` is the rule, with documented carve-outs.** Tier 4 of the April 2026 deficiency cleanup narrowed 50 of 109 `any` usages. The remaining ~15 sites in Bucket E are intentional and documented in CHANGELOG (catch-block `error: any`, `Promise reject: any`, dynamic config indexing, open-bag `Record<string, any>` metadata, legacy browser checks). New `any` usages need a justification or get refactored.
- **Discriminated-union payload extracts** are the preferred pattern when a function takes one variant of an effect:
  ```typescript
  type RC = Extract<Effect, { effectType: 'RESOURCE_CHANGE' }>['payload'];
  function handleResourceChange(payload: RC) { /* ... */ }
  ```
- **Domain types at function boundaries.** Use `Card`, `Player`, `SpaceEffect` rather than re-typing fields locally.

## File size

- **No line-count budget.** The April 2026 audit explicitly dropped the prior "<200 lines per service / <300 max" rule. Large stable services (TurnService 2,076 lines, StateService 1,867, CardService 1,824) are accepted as cohesive — splitting on size alone produces churn without fewer bugs.
- **Split only on a concrete pain signal:** a method that's genuinely hard to edit, a bug hot-spot in `git blame`, or a documented AI-context-cost problem. The Mar 2026 extractions (`MovementExecutor`, `TurnTransitionHandler`) followed this principle — each was driven by a specific function being painful.
- See [BETA_PLAN_V3.md Workstream 4](../core/BETA_PLAN_V3.md) for the full rationale and the explicit *"do not resurrect the 600-line target"* note.

## Dependency injection

- **Constructor injection is the default.** Services receive their dependencies via constructor params.
- **Setter injection is permitted only for the two real cycles:** `StateService ↔ GameRulesService` and `TurnService ↔ EffectEngineService ↔ CardService`. These are documented in [ARCHITECTURE.md](./ARCHITECTURE.md#circular-dependency-resolution-setter-injection) with `assertDependenciesReady()` guards. Don't add new setter-injection methods casually — if a dep can be passed through the constructor, it must be.
- **No global state access.** Never read `window.gameServices` or similar. The Service Locator anti-pattern from the code2026 prototype was eliminated; don't reintroduce it.

## Engine-data separation (Workstream 6 invariant)

- **Per-space behavior lives in `Spaces.csv` flags, not hardcoded space-ID checks.** The list of flags as of v2.58.0: `is_starting_space`, `is_resume_hub`, `is_point_of_no_return`, `min_w_cards_to_leave`, `fee_calculation_method` + `fee_label`, `auto_apply_funding` + `auto_trigger_card_types`, `path_choice_memory_key` + `is_path_choice_lock_point`, `display_label_override`, `review_loop_message`. Plus `phase` (already-existing) drives regulatory-phase auto-rolls.
- When adding new per-space behavior, add a Spaces.csv flag rather than a hardcoded `if (spaceName === 'X-Y-Z')` check. After the refactor: `git grep "OWNER-FUND-INITIATION"` (or whatever space name) should return zero hits in `src/services/`.
- Cross-space rules go in `PATH_CHOICE_RULES.csv` (or a new sibling CSV).

## State management

- **Immutable updates only.** Never mutate `player.money += x` — return new objects via `{ ...player, money: player.money + x }`. The REAL/TEMP turn-state model depends on this.
- **REAL = committed, TEMP = working.** Effects apply to TEMP during a turn. End Turn → `commitTempToReal()`. Try Again → `discardTempState()` + `applyToRealState()` for cost-ledger penalties + `createTempStateFromReal()` for fresh working state. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full lifecycle.

## Testing

- **Vitest, not Jest.** Use `vi.fn()`. See [TESTING_GUIDE.md](./TESTING_GUIDE.md).
- **Run via batch script** (`./tests/scripts/run-tests-batch-fixed.sh`) — full `npm test` may hang due to module-level mock isolation.
- **Tests live in `tests/`**, mirror the `src/` layout. Mocks in `tests/mocks/`.

## Commit messages

- Subject line: `vX.Y.Z: short summary` for releases, or `fix:` / `docs:` / `chore:` for non-release work. Match the existing log.
- Body: explain *why*, not *what*. The diff shows what.

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architectural patterns, DI, real cycles
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) — Test execution + batch runner
- [BETA_PLAN_V3.md](../core/BETA_PLAN_V3.md) — Strategy + dropped-line-budget rationale
