# Unravel Codes — Beta (v3.0) Plan

**Status:** Draft — awaiting execution
**Started from:** v2.39.5
**Repo:** Same repo (`tomaszsb/Game_alpha` → rename to `Game_beta` as part of Workstream 0)
**Philosophy:** Targeted surgical refactor, not a rewrite. Keep working code; replace the 5 specific subsystems that cause the most pain.

---

## Why not a rewrite

The Alpha is 95% working. Thousands of fixes, edge cases, and school-floor lessons are baked into the current codebase. A from-scratch rewrite would spend months reaching feature parity before adding a single new capability, and would re-discover bugs that have already been fixed. Instead, Beta is a focused v3.0 effort on the same repo that replaces five specific subsystems, each independently valuable and shippable on its own version bump.

---

## The Five Workstreams

### Workstream 1 — Ghost Player (Regression Safety Net) **[DO FIRST]**

**Problem:** The user cannot manually test every space/card/path combination. Silent regressions are inevitable without automation.

**Deliverable:** A headless simulator that plays the game by choosing random valid actions, runs 1,000+ games per CI run, and reports any of:
- Stuck state (no valid actions available mid-game)
- Impossible resource values (`NaN`, negative money past allowed, undefined spaces)
- Unreachable spaces / dead-end loops
- Uncaught exceptions from any service
- Turn count exceeding a sane maximum

**Implementation sketch:**
- New folder `tests/ghost/` with `ghostPlayer.ts` (the bot) and `ghostPlayer.test.ts` (the runner)
- Bootstraps the full game via existing services (no UI, no React) — just `DataService` + `StateService` + `TurnService` + friends
- Picks random valid choices from what `TurnService` exposes as legal moves each turn
- Captures the full action log on failure so the exact sequence is reproducible
- Runs in CI alongside existing vitest suite

**Why first:** Every subsequent workstream benefits from this safety net. Without it, we're guessing whether changes to Try Again, the board, or TurnService broke anything.

**Version bump on ship:** v2.40.0

---

### Workstream 2 — Snapshot-based "Try Again"

**Problem:** The current REAL/TEMP dual-state model in TurnService is complex, hard to reason about, and the user reports it's "not 100% there." Because we can't test every space, silent bugs are likely.

**Deliverable:** Replace the REAL/TEMP logic with a snapshot-based checkpoint system.

**Implementation sketch:**
- On space arrival, `StateService.takeSnapshot(playerId, spaceId)` deep-clones player resources + space state into a named checkpoint
- `Try Again` → `StateService.restoreSnapshot(playerId, spaceId)` restores the clone and truncates any action log entries after that point
- Only one active snapshot per player (current space only) — scope per user's instruction
- Remove REAL/TEMP branches from TurnService, CardService, ResourceService
- All existing Try Again tests must pass against the new mechanism

**Risks:**
- Snapshot must capture *everything* that space effects touch (money, time, cards, scope, loans, modifiers) — an incomplete snapshot is a silent bug
- Must handle mid-space state (e.g., card drawn but not resolved) correctly
- Ghost Player (Workstream 1) will catch missed state

**Version bump on ship:** v2.41.0

---

### Workstream 3 — Living Map (Free-form Coordinate Board)

**Problem:** The current board uses computed grid paths. Arrows don't always match real player movement. The user wants to freely reposition spaces and add new ones without code changes.

**Deliverable:** Coordinate-driven board with dynamic SVG arrows.

**Implementation sketch:**
- Add `pos_x` and `pos_y` columns to `public/data/SOURCE_FILES/Spaces.csv` (default values computed from current layout)
- Update `processGameData.js` to propagate coordinates through to CLEAN_FILES
- New `BoardCanvas.tsx` (or rewrite of BoardV3.tsx) that:
  - Places spaces as absolutely-positioned tiles at `(pos_x, pos_y)`
  - Reads each space's `Destination` connections
  - Draws SVG `<path>` arrows between source and target coordinates
  - Uses curved quadratic paths with basic collision avoidance
  - Shows phase groupings via subtle background regions
- Optional admin mode: drag a space → coordinates save back to CSV via the existing Data Editor flow
- Keep `BoardV3.tsx` working until the new canvas is verified, then delete

**Risks:**
- Arrow routing across long distances / backward jumps will need thought
- Phase boundaries and visual hierarchy need to survive the transition
- Ghost Player must still be able to "see" the board graph through the data layer, not through the rendered DOM

**Version bump on ship:** v2.42.0 (or v3.0.0 if this is the last visible change)

---

### Workstream 4 — DI graph cleanup (revised scope, April 2026)

**Original framing (dropped):** "Split every service > 600 lines." The April 2026 audit concluded that raw line count is a weak proxy for bug risk — large services here are mostly cohesive (e.g. TurnService's turn lifecycle is genuinely one responsibility, implemented across many small methods), have thorough tests, and do not correlate with bug reports. Blanket decomposition produces churn without fewer bugs. The earlier Mar 23 extractions (TurnTransitionHandler, MovementExecutor) were driven by a specific function being painful — that's the right trigger for future splits, not a line budget.

**Revised problem:** The DI container mixes three different patterns — constructor injection (good), setter injection to resolve genuine circular dependencies (acceptable, needs to be documented as intentional), and setter injection where constructor injection would have worked fine (bad, just ceremony). The April 2026 setter-injection audit found 13 sites: 2 are genuine architectural cycles, 2 are downstream symptoms of one of those, 1 is possibly dead code, and 7–8 are false cycles that can be collapsed to constructor injection.

**Deliverable:**
1. ✅ Kill the false-cycle setter-injection sites — move dependencies into constructors. Target: setter count drops from 13 → ~5. *(Shipped v2.48.0, Apr 17, 2026.)*
2. ✅ Document the two real cycles (`State ↔ GameRules`, `Turn ↔ EffectEngine ↔ Card`) as intentional architectural decisions in `ARCHITECTURE.md`, with the reason each exists and the assertion guard that catches mis-initialization. *(Shipped with the doc pivot, Apr 17, 2026.)*
3. ✅ Investigate `EffectEngineService.setNegotiationService` — confirmed dead code. Entire effect-engine negotiation pathway removed (setter + field + 2 effect cases + 2 create helpers + 2 union discriminants + 2 type guards + 350-line test block). Production negotiation goes UI → `NegotiationService` directly. *(Shipped v2.48.1, Apr 18, 2026.)*
4. Only split a large service if a specific, concrete pain point is identified (a method that's genuinely too big, a team/AI context limit that keeps being hit, a recurring bug hot-spot per `git blame`). Do not split to hit a line target. *(Ongoing principle — no action unless a specific signal triggers it.)*

**Non-goals (explicit):**
- "No service file exceeds 600 lines." Dropped. Files are sized by what belongs together, not by a character budget.
- "No setter injection anywhere." Dropped. Setter injection is the accepted resolution for genuine cycles; the goal is eliminating *unnecessary* setter injection.

**Status: ✅ Complete** (shipped v2.48.0 + v2.48.1, Apr 17–18, 2026). Any future DI work falls under item 4 and waits for a concrete pain signal.

---

### Workstream 5 — Dictionary Integration Polish

**Problem:** Dictionary terms exist but are statically defined. As the external `dictionary-scraper` grows, the game doesn't automatically benefit.

**Deliverable:** Live-fetched dictionary with smart text highlighting.

**Implementation sketch:**
- On game startup, fetch the full term list from the `dictionary-scraper` (already running separately)
- Build a `TextWithTerms` React component that wraps any game text (space descriptions, card text, tooltips) and auto-underlines matching terms
- Proper matching: case-insensitive, word-boundary aware, handles basic plurals (`permit` matches `permits`), skips terms inside other HTML/JSX
- Click an underlined term → modal with the live definition pulled from the scraper
- Cache the term list to avoid per-render rebuild of the regex
- Fall back gracefully to the current static terms list if the scraper is unreachable

**Version bump on ship:** v3.0.0 — the final Beta milestone

---

### Workstream 6 — Engine-Data Separation (post-v3.0, added April 2026)

**Note:** This workstream is **not part of the original 5-workstream Beta scope**. It was added on 2026-04-26 in response to a new product requirement (multi-tenant educator licensing — schools edit data, contribute back to a shared catalog). The audit that motivates it found that the principle "engine is generic, all per-space variation lives in data" is aspirational, not actual.

**Problem:** ~25 hardcoded space-ID references across 9 source files, plus 2 type-level hardcodes. Educators cannot today: change the starting space, replicate path-choice lock-in mechanics on new spaces, replicate the scope-zero guard, replicate the design fee math, or rename existing spaces without silently breaking engine logic. File format (CSV vs JSON, raised in the lost prior chat) is mostly orthogonal — engine-data coupling is the actual blocker.

**Why now:** Prerequisite for the multi-tenant content vision. Each scenario also independently improves educator power without any user-facing change. None of this requires migrating the data format first.

**Deliverable:** Three phases, each independently shippable, all on the existing CSV pipeline. Voice rewrite (v2.51.0) ships first; this workstream starts after.

#### Phase 6.1 — Category A: Lift engine-behavior hardcodes into Spaces.csv flags

| # | Scenario | New Spaces.csv columns | Files to refactor | Effort |
|---|---|---|---|---|
| 1 | Starting space | `is_starting_space` (already in CLEAN_FILES output via processGameData; expose in source) | StateService.ts:1628, CardService.ts:98, processGameData.js:228 | S (~2-3h) |
| 2 | Scope-zero guard | `min_w_cards_to_leave: number` (default 0, OWNER-SCOPE-INITIATION = 1) | TurnService.ts:397 | S (~2-3h) |
| 3 | Setup-phase auto-handling | `auto_apply_funding: Yes/No`, `auto_trigger_card_types: 'B,I'` (CSV letters) | TurnService.ts:749/887/1975, CardService.ts:1177/1220, NotificationUtils.ts:66, processGameData.js:343 | M (~6-8h) |
| 4 | DOB path-choice memory + cross-space filter | `path_choice_memory_key`, `is_path_choice_lock_point` + new `PATH_CHOICE_RULES.csv` for cross-space exclusion rules | MovementService.ts:122/316/539; types in DataTypes:273, StateTypes:394 | L (~8-12h) |
| 5 | Resume-from-side-quest | `enables_resume_from_side_quest: Yes/No` | MovementService.ts:134/332 | S (~2-3h) |
| 6 | Clears resume point | `clears_resume_point_on_arrival: Yes/No`, `disables_resume_permanently: Yes/No` | MovementService.ts:341 | S (~1-2h) |
| 7 | Design fee math | `fee_calculation_method: flat/percentage_of_scope`, `fee_label: string` | SpaceEffectService.ts:157/164, FinancesSection.tsx:370 | S (~2-3h) |
| 8 | Regulatory-phase override | (no new column — switch `startsWith('REG-')` to `phase === 'REGULATORY'` since `phase` already exists) | TurnService.ts:760 | XS (~1h) |

**Effort:** ~25-35 hours total. **Recommended order: #8 → #1 → #6 → #5 → #7 → #2 → #3 → #4** (easy wins first; #4 is hardest because of cross-space filter coupling — defer to last so the refactor pattern is well-established by then).

#### Phase 6.2 — Category C: Loosen literal-typed unions

- `DataTypes.ts:273` + `StateTypes.ts:394`: change `pathChoiceMemory?: { 'REG-DOB-TYPE-SELECT'?: 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT' }` → `pathChoiceMemory?: Record<string, string>`.
- Sweep for any other literal-typed unions encoding known space IDs (search pattern: union of 2+ string literals matching `[A-Z]+-[A-Z\-]+`).

**Effort:** ~1-2 hours. Trivial but blocking — without this, scenario #4 doesn't work for educator-added spaces. Do as part of #4 or right after.

#### Phase 6.3 — Category B: Cosmetic mappings (lower priority)

| Mapping | New column | Files |
|---|---|---|
| NPC voice profile | `npc_voice_profile: string` | characters.ts:57, SpeechService |
| Display label override | `display_label_override: string` | boardLayout.ts:48 |
| Review-loop message | `review_loop_message: string` | DiceRollProcessor.ts:94 |

Phase color scheme stays code-side (educators won't add phases).

**Effort:** ~4-6 hours.

**Total Workstream 6 effort: ~30-45 hours** (1-2 weeks of focused work; parallelizable across sessions).

#### Test strategy (mandatory per scenario)

For each scenario lifted, three test categories:

1. **Protective tests (existing)** — existing tests exercising the current hardcoded behavior must pass unchanged. These verify the lift is behavior-preserving. Catalog before refactoring; if any change is needed, that's a behavior change, not a refactor.
2. **Parametric tests (new)** — apply the new flag to a *different* space and verify the behavior moves with the data. This is what locks in the "data-driven" claim. Without these, we've just renamed the hardcode. **One parametric test per scenario, minimum.**
3. **Data integrity tests (new)** — extend `processGameData.test.ts` to validate the new column structure (e.g., exactly one `is_starting_space=Yes`, enum values restricted to valid set, required columns present).

Plus the existing **Ghost Player gate** — 50 random games per CI run, ≥90% wins, all `GAME_CONFIG.csv` spaces visited. Catches subtle regressions where a flag isn't propagated correctly.

**Per-scenario CI gate:** `./tests/scripts/run-tests-batch-fixed.sh` (23 batches) green + `npm run typecheck` 0 errors + Ghost Player pass. No exceptions; revert if any fail.

#### Risks

- **Scenario #4 cross-coupling** (DOB path memory affects REG-FDNY-PLAN-EXAM choices) is the riskiest. Without careful `PATH_CHOICE_RULES.csv` design, we'd just replace one hardcode with a worse data structure. Defer to last; design the CSV schema before writing code.
- **Scenario #3 has 7+ touchpoints** — easy to miss one and leave OWNER-FUND-INITIATION half-data-driven. After each refactor: `git grep "OWNER-FUND-INITIATION"` should return zero hits in `src/services/` and `src/utils/`.
- **Type loosening in Phase 6.2 is permissive** — could mask bugs where a `pathChoiceMemory` key was previously type-enforced. Mitigation: Ghost Player still exercises the real flow; the type was overly strict, not load-bearing.
- **Cross-references break on rename.** An educator who renames `REG-DOB-PLAN-EXAM` will break the `path_choice_options` referencing it. Long-term mitigation: editor UI prevents renames or auto-updates references. Out of scope for Workstream 6 — flagged for the multi-tenant editor work later.
- **Behavior drift during refactor.** A "lift" should be 100% behavior-preserving. If a protective test starts failing, the refactor is wrong, not the test. Don't update the test to match new behavior — fix the refactor.

**Version bumps on ship:**
- Each scenario ships as its own version bump (next available patch/minor); each is independent and can be reverted in isolation.
- Phase 6.2 type loosening: rolled into scenario #4's ship (they're coupled).
- Phase 6.3: separate ship once Phase 6.1 is fully complete.

**Status:** Audit complete (2026-04-26). Phase 6.1 started ahead of the voice rewrite merge (which is blocked on user sign-off in `docs/authored-copy-review.md`):
- ✅ **#8 — REGULATORY-phase auto-roll** shipped v2.51.0 (2026-04-26). See CHANGELOG.
- ✅ **#1 — Starting space lifted to is_starting_space flag** shipped v2.52.0 (2026-04-26). See CHANGELOG.
- ✅ **#5 + #6 — Resume mechanic lifted (is_resume_hub + is_point_of_no_return)** shipped v2.53.0 (2026-04-27). See CHANGELOG.
- ✅ **#2 — Scope-zero guard lifted (min_w_cards_to_leave)** shipped v2.54.0 (2026-04-27). See CHANGELOG.
- ✅ **#7 — Design fee math lifted (fee_calculation_method + fee_label)** shipped v2.55.0 (2026-04-27). See CHANGELOG.
- ⏳ #3 next (setup-phase auto-handling — 7+ touchpoints, M effort), then #4 (DOB path-choice memory + Phase 6.2 type loosening — most complex, L effort).

---

## Workstream 0 — Prep & Cleanup (this commit)

Before any of the above starts:

1. **Alpha → Beta in-code rename** — UI labels, comments, internal strings. Safe, mechanical.
2. **Archive dead weight** — see "Archive candidates" section below.
3. **Write this plan** (BETA_PLAN_V3.md).
4. **Prune stale git worktree** (`nervous-keller` is marked prunable).

Infra renames (Docker container, `deploy.sh` name, GitHub repo, Unraid folder) are **deferred** until the user explicitly approves — each one has live-deployment implications.

---

## Execution order

1. **Workstream 0** — Cleanup + renames (this session)
2. **Workstream 1** — Ghost Player (next session)
3. **Workstream 2** — Snapshot Try Again
4. **Workstream 3** — Living Map
5. **Workstream 4** — TurnService decomposition
6. **Workstream 5** — Dictionary polish → ship v3.0.0
7. **Workstream 6** — Engine-Data Separation (post-v3.0; added April 2026 for the educator-licensing roadmap, not part of original Beta scope)

Each ships on its own version bump. If any workstream reveals that an earlier assumption was wrong, we pause and update this plan before continuing.

---

## Out of scope for Beta

- Teacher dashboard / student review UI (nice-to-have, not blocking)
- Real-time WebSocket replacement (current sync works fine for school scale)
- New tech stack (React + Vite + TypeScript stays)
- State library swap to Zustand (StateService refactor in Workstream 4 is sufficient)
- Multiplayer scale beyond current capability (schools = dozens-hundreds, not thousands)
- Mobile-first redesign
- 3D board

---

## Infra rename (deferred — needs user approval)

The following renames are NOT done in Workstream 0 because they touch live deployment:

| Item | Current | Proposed | Risk |
|---|---|---|---|
| Docker container name | `game_alpha` | `game_beta` | nginx routing on Unraid, feedback volume path |
| `deploy.sh` container refs | `game_alpha` | `game_beta` | Must be coordinated with container rename |
| `docker-compose.yml` service name | `game-alpha` | `game-beta` | — |
| Unraid folder | `/mnt/user/appdata/Game_alpha/` | `/mnt/user/appdata/Game_beta/` | Deploy command changes |
| GitHub repo | `tomaszsb/Game_alpha` | `tomaszsb/Game_beta` | Hardcoded URL in `GameLobby.tsx:51,64` — update check |
| Working directory | `current_game/game_alpha/` | `current_game/game_beta/` | Breaks memory paths, worktrees |

**Recommendation:** do all infra renames together in one coordinated session, with a rollback plan ready. Best timing is right after Workstream 1 ships (so Ghost Player can validate the post-rename build).

---

## Success criteria for v3.0.0 ship

- [ ] Ghost Player runs 1,000 games in CI, zero failures, in under 30s
- [ ] Snapshot Try Again replaces REAL/TEMP entirely; Ghost Player exercises it
- [ ] Board reads positions from CSV; moving a space in CSV updates the rendered board without code changes
- [ ] False-cycle setter-injection sites eliminated (see Workstream 4 audit — target ~5 remaining, all documented as genuine cycles)
- [ ] Two known genuine cycles (`State ↔ GameRules`, `Turn ↔ EffectEngine ↔ Card`) documented in `ARCHITECTURE.md` as intentional, with their assertion guards
- [ ] Dictionary terms auto-populate from `dictionary-scraper` at startup
- [ ] All existing vitest suites still green
- [ ] Version tag `v3.0.0` pushed
