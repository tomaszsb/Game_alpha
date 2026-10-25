# Unravel Codes — Beta (v3.0) Plan

**Status:** Executed — v3.0.0 shipped 2026-05-23; all workstreams closed. One remaining W3 (Living Map) follow-on — per-section connector show/hide + redirect — is tracked in TODO ("G160"). Success-criteria section updated 2026-07-18.
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

**Status: ✅ CLOSED 2026-07-12 (criterion rewritten; full replacement declined).** Shipped as per-turn `TurnCostLedger` + logging sessions layered ON TOP of REAL/TEMP (v2.40.0), not the replacement sketched below. Maintainer decision 2026-07-12 after audit: zero bugs traced to the overlap in the ledger's lifetime; the ledger tracks 3 narrow fields vs. REAL/TEMP's ~18-field / 83-call-site scope, so a full replacement would relocate complexity, not remove it. Full replacement is parked in TODO with an explicit trigger (Try Again needing to preserve a 4th type of "sticky outflow"). Original deliverable text below preserved for history.

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

**Problem:** The current board uses a computer-generated snake/zig-zag grid. `src/utils/boardLayout.ts` (~785 lines) walks the space graph from MOVEMENT.csv and computes a position for each space — left-to-right on odd rows, right-to-left on even, wrapping on row width. `BoardV3.tsx` (~879 lines) renders the result. Arrows are auto-drawn between adjacent positions in the walk.

This means: arrows don't always match how players actually move (forward jumps, regulatory loops, branches all share a generic snake template). Adding a new space means touching the walker. You can't reposition spaces visually — the layout is reverse-engineered from the data, not authored.

**Deliverable:** Coordinate-driven board. Each space has explicit `(pos_x, pos_y)` in Spaces.csv. Repositioning is a CSV edit; new spaces are a row + position.

**Library decision (May 2026):** Three independent agent passes (ChatGPT, Perplexity, Gemini) all converged on **React Flow / `@xyflow/react`** as the right off-the-shelf choice. MIT-licensed, React-native (custom JSX nodes via `nodeTypes`), drag/edit/snap-to-grid built in, mobile-first touch handling, ~40–60 KB gzipped, actively maintained. Free tier covers everything we need. GoJS was the "pay once" alternative ($3,995/dev) — overkill for this project. dagre / elkjs are layout engines (paired with React Flow only as needed for seed positions on brand-new spaces). Detailed comparison in the session notes; not duplicating here.

**Implementation phases:**

| Phase | What | Time | Visible change? |
|---|---|---:|---|
| A | Add `pos_x` / `pos_y` columns to Spaces.csv. Seed defaults by running the current `boardLayout.ts` walker once and writing positions back. Update `processGameData.js` + `GameConfig` type to propagate. Add `IDataService.getPosition(spaceName)`. | ~1–2h | None — board still renders identically because positions match what BoardV3 was already computing. |
| B | `npm i @xyflow/react`. New `BoardCanvas.tsx` (~150 lines) using React Flow with custom `BoardNode` JSX component (preserves current tile look + player tokens overlay). `smoothstep` curved edges. Phase grouping via React Flow Group Nodes (`parentId` pattern — phase becomes a draggable container, children move with it). `nodesDraggable={isAdmin}` for read/edit toggle. Feature-flag side-by-side with BoardV3. | ~3–4h | New rendering path available behind a flag. |
| C | ✅ **Shipped v2.64.0 (2026-05-15).** Collision-aware edges via `@jalez/react-flow-smart-edge@4.0.0` (A* pathfinding, v12-compatible fork of the archived `@tisoap` package). Edge type flipped from `smoothstep` to `smart` in `BoardCanvas.tsx`. Vendor-reactflow chunk +22KB minified / +7KB gzipped. Test stub at `tests/stubs/smartEdgeStub.ts` works around the package's CJS-in-ESM dist that crashes jsdom. Phase background regions + drag-to-save persistence still open (Phase D). | shipped | Visible: edges route around tiles instead of cutting through them. |
| D | ✅ **FULLY SHIPPED.** Drag-to-save wired v2.66.0 (2026-05-19); reopen-revert cache fix v2.69.4; deploy.sh cp -a nesting race fix v2.69.7 (2026-05-22 — was silently losing user edits across deploys). **v3.0.0 (2026-05-23)** deleted `BoardV3.tsx` (879 lines) + `boardLayout.ts` (785 lines) + `BoardV3.css` + `tests/utils/boardLayout.test.ts` (721 lines). `PHASE_COLORS`/`shortName`/`truncate` relocated to new `src/utils/boardCommon.ts`. `TVDisplay.tsx` swapped from `<BoardV3>` to `<BoardCanvas isAdmin={false} edgesVisible={true}>`. `GameLayout.tsx` dropped `boardImpl` state + `unravel:boardImpl` localStorage + `?board=` URL selector. `BoardToggle.tsx` dropped Old/New buttons + `BoardImpl` type export. Net: +186/-2,871. Git tag `v3.0.0` pushed. | shipped | Living Map is now THE board. No fallback exists. |

**Total ≈ 6–10 hours** across 2–3 sessions.

**Risks worth flagging:**
- Long-distance / backward jumps look like spaghetti as straight lines — hence the `smoothstep` default + smart-edge plugin in Phase C if needed.
- Bundle weight: React Flow adds ~40–60 KB gzipped; this is offset by deleting `BoardV3.tsx` + `boardLayout.ts`. Net change small. Editor-mode interactions live in a separate chunk so player-mode (the common case) only loads the rendering subset.
- Ghost Player: doesn't read the DOM; reads `MovementService.getValidMoves()` which is graph-data only. Zero ghost-test risk.
- Mobile/touch: pinch/zoom/pan/drag all native in React Flow.

**Existing assets to leverage:** HTML prototypes in `docs/archive/prototypes/` — `dynamic_path_mockup.html` (coordinate-driven board with player tokens), `svg_arrows_prototype.html` (curve math + arrow heads), `elk_prototype.html` (auto-routing fallback), `board_v3_prototype.html` (current snake-board for parity testing). Reference, not "drop in" — they have their own assumptions.

**Version bump on ship:** v2.62.0 → v2.63.0 across the phases. v3.0.0 is reserved for when both Living Map and Workstream 5 (Live Dictionary) are in.

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

### Workstream 5 — Dictionary Integration Polish ✅ SHIPPED v2.67.0 (2026-05-20)

**Problem (original):** Dictionary terms exist but were assumed to be statically defined. As the external `dictionary-scraper` grows, the game doesn't automatically benefit.

**What was actually true at audit time (2026-05-20):** The infrastructure had already been built incrementally — `loadTerms()` in [terms.ts](../../src/dictionary/data/terms.ts) tried the dashboard API first (`https://dashboard.unravelcodes.com/api/glossary/live`) with CSV fallback. `TextWithTerms` already did case-insensitive word-boundary matching, longest-first regex, with aliases-as-plurals via the `aliases` field. `DictionaryContext` already triggered re-render on async load. The only gap was a same-origin guard at `terms.ts:137-139` (and equivalent in `remoteConfig.ts:76-81`) that always skipped the API call because the scraper's CORS allowlist didn't include `https://game.unravelcodes.com`.

**Actual ship (v2.67.0):**
- Scraper side ([dictionary-scraper main.py:248-258](../../../dictionary-scraper/dashboard/backend/main.py)): added `https://game.unravelcodes.com` + `http://...` to `allow_origins`. Container redeploy.
- Game side: removed the same-origin guard in `loadTerms()` and the parallel guard in `fetchRemoteConfig()`. Existing API-first-then-CSV-fallback logic now executes the API leg in production.
- CSV fallback refresh: `public/data/CLEAN_FILES/GLOSSARY.csv` re-exported from a live snapshot (249 terms), preserving per-row extras the API doesn't return (`why_it_matters`, `game_card_id`, etc.). Server-side copy at `server/data/game-data/CLEAN_FILES/GLOSSARY.csv` synced.
- Test simplification in `tests/dictionary/terms.test.ts` — removed the `window.location.origin` override that existed solely to bypass the now-removed guard.

**Version bump on ship:** v2.67.0 (initial ship). **v3.0.0 followed on 2026-05-23** when the last gate — Workstream 3 Phase D BoardV3 retirement — closed. Workstream 5 itself was fully complete as of v2.67.0; v3.0.0 just waited for W3 to catch up. v2.70.5 (2026-05-23) bulked up the existing dictionary's discoverability (Phase A of newcomer jargon mode, fb:0aa9660c+fb:8ad42b52): solid blue underline + ⓘ marker + one-time onboarding toast. Phase C (plain-English short-label aliases for tiles + buttons) deferred per user.

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

**Status:** Audit complete (2026-04-26). Phase 6.1 started ahead of the voice rewrite merge (which is blocked on user sign-off in `docs/core/AUTHORED_COPY_REVIEW.md`):
- ✅ **#8 — REGULATORY-phase auto-roll** shipped v2.51.0 (2026-04-26). See CHANGELOG.
- ✅ **#1 — Starting space lifted to is_starting_space flag** shipped v2.52.0 (2026-04-26). See CHANGELOG.
- ✅ **#5 + #6 — Resume mechanic lifted (is_resume_hub + is_point_of_no_return)** shipped v2.53.0 (2026-04-27). See CHANGELOG.
- ✅ **#2 — Scope-zero guard lifted (min_w_cards_to_leave)** shipped v2.54.0 (2026-04-27). See CHANGELOG.
- ✅ **#7 — Design fee math lifted (fee_calculation_method + fee_label)** shipped v2.55.0 (2026-04-27). See CHANGELOG.
- ✅ **#3 — Setup-phase auto-handling lifted (auto_apply_funding + auto_trigger_card_types)** shipped v2.56.0 (2026-04-27). See CHANGELOG.
- ✅ **#4 — Path-choice memory lifted (path_choice_memory_key + is_path_choice_lock_point + new PATH_CHOICE_RULES.csv) + Phase 6.2 type loosening** shipped v2.57.0 (2026-04-28). See CHANGELOG. **Phase 6.1 + 6.2 complete.**
- ✅ **Phase 6.3 (cosmetic mappings) + runtime starting-space defense** shipped v2.58.0 (2026-04-29). 2 of 3 sub-lifts: display label override + review-loop message. NPC voice profile sub-lift scoped out — see Phase 6.4 below. Workstream 6 effectively closed.
- ✅ **CSV-only-reskin audit II (2026-09-10)** — its bug (4 condition evaluators with opposite defaults) + 4 cheapest leaks shipped v3.2.56, incl. finishing #8 (auto-roll now the `auto_roll_dice` flag, not the phase name) and hand-playability as data (`CARD_TYPES.is_playable_from_hand`). Remaining leaks ranked in TODO.md. See CHANGELOG.
- ⏳ **Phase 6.4 (deferred — NPC voice profile)**: would lift `extractPrefix` + `CHARACTER_MAP` + `CHARACTER_PROFILES` to a per-space `npc_voice_profile` data flag. Touches 6 callers (5 components + SpeechService) including pure utility functions, requires either injecting dataService into utilities or adding parallel data-aware helpers. **Deferred** because educator-added spaces today fall through to the narrator voice — acceptable degradation. Probably never lifted unless an educator complains.

---

### Workstream 7 — Plan Approval Mechanic (post-v3.0, added May 2026)

**Note:** Like Workstream 6, this is **not part of the original 5-workstream Beta scope**. Added 2026-05-16 in response to playtester feedback (`fb:bbc94ec8`: "I want to return to where I was when I last hit PM-DECISION-CHECK"). Investigation revealed that the resume-hub code at `MovementService.ts:148` silently fails for `dice` and `logic` movement types because `extractDestinationsFromMovement` only reads `destination_1..5` columns — those types' destinations live in `DICE_OUTCOMES.csv` / `LOGIC_QUESTIONS.csv`. Rather than patch the resume-hub block, this workstream models the real-life NYC mechanic (you walk out of DOB/FDNY with an *approval*, not just a destination), which subsumes the bug fix and adds gameplay depth.

#### Problem

Today, visiting DOB or FDNY is purely a movement event — you roll, you go. The game doesn't model the *outcome* of the inspection (you got approved / got a minor objection / got denied). Players have no persistent state from regulatory visits, which (a) breaks the resume-hub semantic for dice-typed sources, (b) wastes the rich approval/denial mechanic that mirrors real NYC permit flow, (c) gives the player no carry-over from past inspections — every visit feels like a fresh roll.

#### Real-life model

NYC reality: DOB Plan Examiner reviews your plans. Outcome is one of approval (move to next stage), minor objection (revise and resubmit), or denial (fix substantial issues at architect/engineer first, then come back). FDNY same shape. Approval is sticky — valid until you change scope, get audited, or revisit and get a different result. DOB's final clerk (REG-DOB-FINAL-REVIEW) verifies both prior approvals *plus* other paperwork (insurance, structural calcs, energy compliance) before signing off on the CO.

#### Data model

Two player-state fields per approval, plus a destinations memo:

| Field | Type | Meaning |
|---|---|---|
| `dobApprovalStatus` | `'none' \| 'minor-objection' \| 'approved' \| 'denied'` | DOB plan exam status |
| `fdnyApprovalStatus` | `'none' \| 'minor-objection' \| 'approved' \| 'denied'` | FDNY plan exam status |
| `dobApprovedDestinations` | `string[]` | Destinations DOB granted last approval (used by PM-DECISION-CHECK resume hub) |
| `fdnyApprovedDestinations` | `string[]` | Same, FDNY |

All four added to `Player` in `src/types/StateTypes.ts` + `src/types/DataTypes.ts`. Default values: status `'none'`, destinations `[]`.

#### Roll mappings (no MOVEMENT.csv / DICE_OUTCOMES.csv data changes required)

**REG-FDNY-PLAN-EXAM — First visit (harder):**

| Roll | Outcome | Effect |
|---|---|---|
| 1, 2 | Approved | Status → `approved`. Store `[CON-INITIATION, REG-DOB-PLAN-EXAM, REG-DOB-AUDIT, PM-DECISION-CHECK]`. Player picks one. |
| 3, 4 | Minor objection | Status → `minor-objection`. Stay, lose time, no fee, re-roll next turn. |
| 5 | Engineer denial | Status → `denied`. Clear destinations. Forced to ENG-INITIATION. DOB unchanged. |
| 6 | Architect denial | Status → `denied`. Clear destinations. Forced to ARCH-INITIATION (harder than engineer — first-time inspections find bigger issues). |

**REG-FDNY-PLAN-EXAM — Subsequent (easier, re-submission):**

| Roll | Outcome |
|---|---|
| 1, 2, 3 | Approved (same destinations as First) |
| 4, 5 | Minor objection |
| 6 | Engineer denial → ENG-INITIATION |

**REG-DOB-PLAN-EXAM — both visits:** existing dice mapping already encodes the same three-outcome shape with different destinations. Approved rolls route to REG-FDNY-FEE-REVIEW (forward in regulatory chain); objection rolls loop; denial rolls route to ARCH-INITIATION (architect rework). On approval, `dobApprovedDestinations = [REG-FDNY-FEE-REVIEW]` (single destination — DOB's "approval" semantically means "next stage is FDNY").

| Visit | Approved | Objection | Denial |
|---|---|---|---|
| First | 1, 5, 6 | 2 | 3, 4 |
| Subsequent | 1, 2, 3, 6 | 4 | 5 |

**REG-DOB-AUDIT:** revocation source. If audit dice routes to REG-DOB-PLAN-EXAM (rolls 2, 3 First / 3, 4 Subsequent), DOB approval is revoked → `dobApprovalStatus = minor-objection`. Other audit destinations leave approval intact.

#### Revoke triggers

| Trigger | Effect |
|---|---|
| Re-visit the same examiner | New roll replaces old approval (good or bad). |
| Add W cards / change scope | `dobApprovalStatus → 'none'` (approval was for old scope). FDNY unaffected. |
| Land on REG-DOB-AUDIT with adverse roll | See above. |
| Specific L cards | Data-driven via new `revokes_approval: 'dob' \| 'fdny' \| 'both' \| ''` column in `CARDS_EXPANDED.csv`. |

#### REG-DOB-FINAL-REVIEW — two-stage check

**Stage 1 (logic):** verify `dobApprovalStatus === 'approved'` AND `fdnyApprovalStatus === 'approved'`. If either is missing/denied, route player back to the missing examiner (DOB first if both missing). Lose time, no fee.

**Stage 2 (existing dice):** the existing REG-DOB-FINAL-REVIEW dice roll stays, modeling the clerk's review of other paperwork (insurance, structural calcs, energy compliance). Only fires after Stage 1 passes.

#### End-game without DOB sign-off

Reaching FINISH with `dobApprovalStatus !== 'approved'`:
- Game still ends.
- Penalty: +30 days + $50K emergency-processing fee on final stats.
- End-game modal narrates: "DOB never signed off — your CO came late and cost the owner."
- Stats screen flags this.

#### PM-DECISION-CHECK after approval (the original bug fix)

When player returns to PM-DECISION-CHECK with valid approvals:
- If `fdnyApprovalStatus === 'approved'`, append `fdnyApprovedDestinations` to valid moves.
- If `dobApprovalStatus === 'approved'`, append `dobApprovedDestinations`.
- The current `extractDestinationsFromMovement(resumeMovement)` block at `MovementService.ts:148` is **removed** — replaced with reads of the stored approval destinations. No more re-deriving destinations from a dice space at runtime.

#### Player panel UI

Two new status badges in player panel header. Per user's pick.

- Visual states: `none` grey ("Not visited"), `minor-objection` yellow ("Re-submit"), `approved` green ✓, `denied` red ✗.
- Layout: `🪪 DOB · ✓` and `🚒 FDNY · ✓`. Tooltip explains state.
- Multiplayer: per-player, self-only on the panel.

#### Phased rollout

| Phase | Scope | Visible to player? |
|---|---|---|
| **7.1** | Data model (4 player fields), `ApprovalService`, wire DOB/FDNY/AUDIT dice resolution to set state, replace MovementService.ts:148 with stored-destination reads. **Original PM-DECISION-CHECK bug fixed as a side effect.** | No (internal state only) |
| **7.2** | Player panel badges. Players SEE their approval state. | Yes |
| **7.3** | Revoke triggers — W-card scope-change revoke, L-card `revokes_approval` column, audit revocation logic. | Yes (badges change in response) |
| **7.4** | End-game penalty path + REG-DOB-FINAL-REVIEW two-stage rework. | Yes (penalty visible in stats; final-review behaves differently) |
| **7.5** | Modal narration sweep — DOB/FDNY/AUDIT modal copy uses approval language. NPC voice per `AUTHORED_COPY_REVIEW.md`. | Yes (copy change only) |

Each phase shippable in isolation. Phase 7.1 alone closes the original bug and is the safest first step.

#### Test strategy

- **`ApprovalService` unit tests** — grant/revoke/query for all 4 states × 2 approvals.
- **MovementService integration** — DOB/FDNY dice → approval set; PM-DECISION-CHECK return → approved destinations offered.
- **End-game test** — FINISH without DOB approval → penalty applied (Phase 7.4).
- **Data integrity test** (`tests/ghost/dataIntegrity.test.ts` extension) — L cards with `revokes_approval` set use only valid enum values.
- **Existing tests** — the 5 `Resume from side quest` cases in `MovementService.test.ts` must be updated: their `archScopeMovement` mock changes meaning (now an approval-source check, not a destination-extract source). Update mock setup to use approval state instead of inferring destinations from a Movement row.
- **Ghost Player gate** — random bot doesn't need changes; the new approval state is read-only from its perspective.

#### Risks

- **Save-game compatibility:** existing in-flight games won't have the new fields. `StateService` load path needs defaulting (`status = 'none'`, destinations = `[]`).
- **Onboarding:** approvals are new mental load. Worth a one-time intro modal on first DOB/FDNY visit — schedule as part of Phase 7.5.
- **Voice consistency:** approval language must fit NPC voice rules. DOB clerk and FDNY inspector are different speakers — modal narration switches speaker per space (already wired via `CHARACTER_MAP`).
- **State-combination matrix:** 4 statuses × 2 approvals × multiple revoke triggers = many cases. `ApprovalService` unit tests must cover the full grid.
- **Educator portability:** approval status fields are hardcoded by name. Educator-added regulatory spaces wouldn't get approval semantics. Acceptable for now (same posture as Phase 6.4 NPC voice deferral); revisit if educators ask.

#### Open questions — all resolved 2026-05-16

1. ✅ **First-visit FDNY:** keep harder, no data change. First denial uses architect (roll 6); Subsequent denial uses engineer (roll 6).
2. ✅ **DOB approved destinations:** `[REG-FDNY-FEE-REVIEW]` (one destination).
3. ✅ **End-game penalty:** +30 days + $50K.
4. ✅ **REG-DOB-FINAL-REVIEW:** two-stage (logic + dice), not replace.
5. ✅ **Multiplayer:** per-player, self-only.

**Effort estimate:** ~6–10 hours across 2–3 sessions. Phase 7.1 is ~2–3 hours alone.

**Status: COMPLETE 2026-05-17.**
- ✅ **Phase 7.1** shipped v2.65.0 (2026-05-16). Data model + ApprovalService + dice-resolution wiring + resume-hub bug fix. See CHANGELOG.
- ✅ **Phase 7.2** shipped v2.65.1 (2026-05-16). Player panel badges (🪪 DOB · 🚒 FDNY, 4 states each). See CHANGELOG.
- ✅ **Phase 7.3** shipped v2.65.2 (2026-05-17). W-card scope-change revoke + data-driven `revokes_approval` column on `CARDS_EXPANDED.csv` (L003, L020, L023 seeded). See CHANGELOG.
- ✅ **Phase 7.4** shipped v2.65.3 (2026-05-17). REG-DOB-FINAL-REVIEW Stage-1 gate (missing approvals → forced route to examiner) + end-game penalty for missing DOB sign-off (+30 days, +$50K) surfaced in EndGameModal. See CHANGELOG.
- ✅ **Phase 7.5** shipped v2.65.4 (2026-05-17). NPC-voiced outcome banner appended to DiceResultModal Summary on DOB/FDNY/AUDIT rolls and on REG-DOB-FINAL-REVIEW gate bounces. Audit-specific revocation language; FDNY First→architect vs Subsequent→engineer differentiation. See CHANGELOG.

---

## Workstream 0 — Prep & Cleanup (this commit)

Before any of the above starts:

1. **Alpha → Beta in-code rename** — UI labels, comments, internal strings. Safe, mechanical.
2. **Archive dead weight** — see "Archive candidates" section below.
3. **Write this plan** (BETA_PLAN_V3.md).
4. ✅ **Prune stale git worktree** (`nervous-keller`) — done; worktree no longer in `git worktree list`.

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

Status as of v2.58.0 (April 30, 2026):

- [x] **False-cycle setter-injection sites eliminated.** Shipped v2.48.0 (Apr 17, 2026) — 7 false-cycle setters migrated to constructor injection.
- [x] **Two known genuine cycles documented in ARCHITECTURE.md as intentional with assertion guards.** Shipped v2.48.0; see ARCHITECTURE.md → "Circular Dependency Resolution".
- [x] **All existing vitest suites still green.** 23 batches green at v2.58.0; `npm run typecheck` 0 errors.
- [~] **Ghost Player regression gate in place.** Original criterion ("1,000 games in CI, zero failures, in under 30s") was rephrased during Workstream 1 to **50 random games per CI run, zero exceptions/invariant violations, ≥90% wins, all `GAME_CONFIG.csv` spaces visited**. Actual baseline: 96% wins, ~110 avg turns. The 1,000-game number was aspirational; 50 is the proven gate.
- [x] **Try Again is safe and self-contained** — criterion rewritten 2026-07-12/18 to match what shipped (maintainer decision, TODO "Resolved 2026-07-12"): per-turn `TurnCostLedger` + logging sessions layered on top of REAL/TEMP (v2.40.0), instead of the originally-scoped full snapshot replacement. Audited: zero bugs traced to the REAL/TEMP overlap in the ledger's lifetime. Full replacement parked in TODO with an explicit trigger (a 4th sticky-outflow type).
- [x] **Board reads positions from CSV** (Workstream 3 — Living Map). Shipped across v2.62.0–v2.69.5. `Spaces.csv` has `pos_x`/`pos_y` columns; `BoardCanvas` renders from them via `dataService.getPosition()`. Drag-to-save (v2.66.0) persists admin edits through `/api/admin/save-source-files`, with v2.69.4 fixing a `DataService` cache that was making positions appear to revert on editor reopen. v2.68.0 added a standalone `BoardLayoutEditor` so layout can be edited from the lobby without a running game. v2.69.5 fixed an `@xyflow/react` panOnDrag interaction that was breaking hover/click during gameplay. Phase D BoardV3 retirement (delete ~1,664 lines of `BoardV3.tsx`/`boardLayout.ts` + 721 test lines) still deferred pending a few playtests on the v2.69.x flow.
- [x] **Dictionary terms auto-populate from dictionary-scraper at startup** (Workstream 5). Shipped v2.67.0 (2026-05-20). The infrastructure (`loadTerms` API-first, `TextWithTerms` regex with aliases, `DictionaryContext` re-render on async load) had been in place since v2.30-ish but was gated by a same-origin guard added when the scraper's CORS allowlist didn't include `game.unravelcodes.com`. v2.67.0 removed the guard and added the game origin to the scraper allowlist; live terms now load on every game start. CSV fallback (`public/data/CLEAN_FILES/GLOSSARY.csv`) refreshed from API snapshot and remains the offline-resilience path.
- [x] **Version tag `v3.0.0` pushed** — shipped 2026-05-23 (commit `f13a325`, "retire BoardV3, ship v3.0.0" — Workstream 3 Phase D landed in the same commit).

**v3.0.0 readiness:** SHIPPED 2026-05-23. All criteria closed — 6 met as written, 2 consciously resized with maintainer sign-off (Ghost gate at its proven 50-game form; Try Again criterion rewritten 2026-07-12 to the shipped `TurnCostLedger` design). See [TODO.md](../../TODO.md) for the active backlog.

## Workstream 6 - open reskin leaks (moved from TODO.md 2026-10-13; full wording in [TODO-full-2026-10-13.md](../archive/TODO-full-2026-10-13.md))

*Audit I (2026-08-03) closed 2026-08-14, every finding fixed (CHANGELOG v3.1.96-v3.2.2). Audit II (2026-09-10, a cloud session's D&D-compatibility audit, 14 leaks, each re-verified in code): fixed in v3.2.56 (A1 condition evaluators 4 copies to 1, A2 DiceService speaker table, A3 `expeditorPhase.tsx`, B1 auto-roll flag, B2 `is_playable_from_hand`) and v3.2.58 (#14 project-scope family). Job 2 (v3.7.21, v3.7.23) moved the builder price/schedule numbers, the standings and mat words and the owner seed-money range into data. Still open, ranked by reskin impact, each taken on only when a real reskin needs it:*
- **Five card families are a closed union** (`DataTypes.ts` `CardType = 'W'|'B'|'E'|'L'|'I'`, ~58 `card_type === X` comparisons, the ID-prefix-as-type convention in `GameRulesService.getCardType`, the hardcoded W/E tabs in `EducationalCardSelectionModal.tsx` and `GameSettingsPanel.tsx`). B2 and #14 opened the first two data seams; the rest is a dedicated session.
- **Resources are a fixed `money`/`timeSpent` pair** (`StateTypes.ts:74-75`); **the d6 is baked into the CSV schema** (`roll_1..roll_6`, `DataTypes.ts`); **project-length constants** remain in code.
- **Architect / Engineer / Contractor are hardcoded by name** (Tom's proposal 2026-09-28: one data-driven "vendor" concept, like the five card flavors). `CON-INITIATION` alone is named in ~10 files. Pairs with the CardType unification.
- **Small:** the end-game "regulatory-heavy" insight is keyed on a phase NAME (`EndGameModal.tsx`, `endGameInsights.ts`; fails soft); the replace-picker phase chip shows only for `cardType === 'E'` (`CardReplacementModal.tsx`; cosmetic); a condition expression grammar (`<stat> <op> <literal>`) would retire A1's named-threshold table (a proposal, not a leak).
- **Left typed in code on purpose after Job 2:** the quality/event ids (`HIGH/MED/LOW`, `review_passed`, `review_sent_back`, `violation`), the header-menu words (the robot reads them), `BoardCheckStrip` (teacher tool), `LEND-SCOPE-CHECK` in `server/spaceProtection.js`, the stock names and the `CHEAT-BYPASS` default in `trophyRules.ts`.

---

## N3 design prep: five open design questions (2026-10-23, design only, nothing built)

Written by the Game_Alpha session for the Manager. Sources: the independent review notes in `D:\Unravel\Independent_Review\` (`PLAYTEST.md` Part 2, `RESEARCH-2.md` §1d and §6, `CHECK.md` §6), plus the current data files. No per-space visitor or robot hit counts exist in this repo, so numbers are counted from `DICE_OUTCOMES.csv` and `MOVEMENT.csv`, or taken from `CHECK.md` (six robot games: 20, 47, 83, 89, 126 and 170 turns). The picks are mine; every item still needs Tom before anything is built. Each lists the plain problem, the options with the real cost, what could go wrong, and one pick.

### 1. Inspector sign-off (full report vs sign today)
- **The student's problem.** After Site Inspection the game walks straight to Final Approval. A real job cannot close until every special inspection item is signed (TR1), but the student never meets that wait, and the Special Inspector they may have hired (live since v3.8.22) does nothing at the end.
- **Options.**
  - **A. Two new spaces, data only (the review's version).** `SI-SIGNOFF` (choice) leads to `SI-FULL-REPORT` (+10 days, safe) or `SI-RUSH` (+1 day; 2 in 6 an item is missing and you go back to Trouble On Site). About 10 rows across `MOVEMENT`, `SPACE_CONTENT`, `SPACE_EFFECTS`, `DICE_OUTCOMES`, `TROPHIES`; the Site Inspection outcomes that point at `REG-DOB-FINAL-REVIEW` are re-pointed. About a day. Tests: the pipeline-faithful test, a ghost game that passes through, a data test that every space reached exists. Two new tile positions on the board.
  - **B. Only if you hired a Special Inspector.** Same spaces, reached only by a player who has the inspector. Teaches why the hire matters, but needs a conditional edge in the engine and is the riskiest for the ghost games.
  - **C. Do nothing, add a line to the Final Approval "?" tip.** Hours, no new decision.
- **What could go wrong.** One more stop on a back half that already runs long. If "sign today" is too cheap everyone rushes; if it is too costly nobody does. The rush path sends you back to Trouble On Site, which feeds the loop it was meant to shorten.
- **Pick: A.** Data only, sourced, and the first real time-against-risk choice at the end. Build it together with item 3 so the board is re-drawn once.
- **Needs Tom first:** yes, the 10 days / 1 day / 2-in-6 numbers and the wording.

### 2. Hire an Expeditor fork (veteran / junior / yourself)
- **The student's problem.** Forced expeditors were cut in v3.8.20 (5 `draw_E` rows remain), but the student still never *chooses* to hire one. A real expeditor does not make the city faster; they stop you losing time to mistakes.
- **Options.**
  - **A. A fork space `EXP-HIRE` before the filing choice (data only).** Veteran (-$15K, +3 days, 3 steady cards), Junior (-$3K, +1 day, 2 cards, 1 in 6 a "filing error" event), Do it yourself (+15 days once, no cards). About 12 rows in the same files as item 1, and the owner's `draw_E,3` becomes `draw_E,1`. Tests: pipeline/data tests, a ghost game, and the card-count checks beside `tests/ghost/expeditorDaysSaved.test.ts`.
  - **B. Make it a three-button choice at the Owner, no new tile.** Fewer tiles; needs a small code change because spaces offer card draws, not priced choices.
  - **C. Bids, like the builder bids.** Most teaching, medium code, most risk (TODO: "bids for expeditors").
- **What could go wrong.** "Junior can be bad" depends on the open product choice about day-adding cards in a solo hand (TODO, Decisions waiting on Tom). If Veteran is always best, the fork teaches nothing. "Yourself" at +15 days can put Fastest out of reach.
- **Pick: A, after the day-adding-cards decision.** It stays in the data and copies the `SI-HIRE` pattern.
- **Needs Tom first:** yes, that decision, then the three prices.

#### 2 REPLACED (2026-10-25, design only, nothing built): "reps you hold, with a salary" instead of the three-person fork
Tom's idea: the player can always HIRE a rep or FIRE a rep. Each rep costs a salary while held, so nobody holds too many. A rep is good at ONE thing or bad at ONE thing. The effect is bigger than today's 3 days, or lasts a whole phase without the card being used up. Hiring draws 3 rep cards and the player keeps 1, 2 or all 3.

**What exists today (inventory, so we unify instead of adding a layer).**
- 75 expeditor (E) cards in `CARDS_EXPANDED.csv`, all "Immediate, Player Controlled", used up when played. 43 save days (-1 to -5), 15 add days (+2, +4: bad luck cards, left out of solo decks since v3.8.57), 18 also move money (for example Overtime -2 days for $1,000). By phase: 34 filing, 11 any, 10 each for design, building and funding. There is no "area" column; `phase_restriction` is the nearest thing.
- They come from `draw_E` rows in `SPACE_EFFECTS.csv`: the owner's start (1, was 3), the architect's fee review (1), the city fee review (2), and the quick-play guide. "Let a team member go" is the existing `return_e` row on the lender, the bank, the architect's fee review and the cheat-bypass space, so FIRE already exists as a data row.
- Days a played expeditor saved stay saved through a push-back (the cost ledger `daysSaved`, `CardService` ~line 620). A push-back can also SPEND expeditors instead of days (`expeditorsForPushBack`, v3.8.21): the held hand is already a place where help sits.
- Bills: the money checks happen once, at End Turn (bankruptcy and the 20% design cap are checked there). The builder price and the lender's interest already follow that rule. Nothing today charges money for HOLDING a card.
- Robot: I found no expeditor handling by name in `ghostPlayer.ts`; the robot only meets E cards through the normal card flow. Check this before building.

**Smallest version that does what Tom said.**
- Keep the E cards as the reps (no new card type, no new deck). Add 3 data columns to E cards: `area` (Code / Permits / Inspections), `sign` (good or bad), `salary` (money per turn). The existing day number becomes the size of the effect.
- HIRE a rep: one desk action that draws 3 E cards; the player keeps 1, 2 or all 3 (the same "pick from several" screen the card replacement uses). FIRE a rep: the existing `return_e` action, available at those same desks plus the hire desk.
- A held rep is not played. It works by itself: **on a space of its area, each visit is that many days shorter (good) or longer (bad), for as long as the rep is held.** This is "good through the phase without the card being used up". A fired rep goes to the discard pile.

**Salary: what, when, and if you cannot pay.**
- Charged once per turn, at End Turn, with the other bills (the natural place; the end-turn warning already lists bills). Proposal: $2,000 a turn per rep, tuned later from ghost games.
- If cash cannot cover it, the LAST rep hired leaves (a free forced fire) until the bill fits. Salary alone can never cause bankruptcy, and a student who over-hires loses reps, not the game. "Too many" is prevented by the running cost; the forced fire is the safety net.
- Count the salary as a regulatory/other cost, NOT a design fee, so the 20% design cap and the trophy money race (`spent`) are not skewed unless Tom wants salary to count against "On budget" (a question below).

**What "good at one thing / bad at one thing" means on the real spaces.**
- Code: the design stage (architect and engineer spaces, `ARCH-*`, `ENG-*`). Permits: the city and fire filing spaces (`REG-DOB-*`, `REG-FDNY-*`). Inspections: `SI-*`, Site Inspection and Final Approval. The 10 funding cards would fold into Permits or be dropped (the lender is not a permit area). Tom named code consulting, permits and inspections, so three areas.
- A BAD rep: hiring it is only worth it if its salary is lower or it is paired with a good one. With draw-3, bad reps are decoys; the student must READ the card. That teaches "read the contract before you sign" and fits the builder bids. Keep at most one bad card in each draw of 3, so the draw is not a trap.

**Lasting vs one-time bigger.** Lasting-per-visit (above) is simpler to explain ("this rep makes every city filing 2 days shorter while you pay them"), keeps the card in the hand, and needs no "used up" bookkeeping. Bigger one-time stays the existing mechanic. Lasting is safer for the robot only if the robot does not hold reps (it would never pay), and it moves the trophy race gently: -2 days on 4 filings is -8 days, a visible but not decisive swing for "Fastest". One-time bigger swings the race harder in one turn.

**Game length and bankruptcy: how to measure.** Run `npm run test:ghost` with a robot that hires 1, 2 and 3 reps, and the same games with none; compare median days and the share of games ending in bankruptcy, plus the salary total against the job's profit. Pass if median days fall by 5-10% with one rep and bankruptcy does not rise. Use the counting-test pattern from the Banker (`bankerCounting.test.ts`) over the 75 cards.

**Data vs code.** Data only: the 3 new columns on E cards, the rep values, the salary, the hire and fire rows and texts. Code: (1) a hire screen that draws 3 and keeps 1-3 (reuse the card-pick modal); (2) the lasting effect (a rule at space arrival: held rep + matching area = day change; this is the one real engine change); (3) the End Turn salary and the forced fire. Saved games: the new fields are optional on the card rows and a rep is just a held card, so old saves load (a held E card with no area acts exactly as today).

**Phone.** The hire screen is the existing pick-from-cards pop-up (no growth of the player panel); held reps already show in the hand list. Add a salary note in one line there. Measure at 360x640 and 390x844 when built.

**Tom's answers (2026-10-25) and what they change.** Items 1-3 are PROVISIONAL, the Manager is confirming them with Tom.
1. How a rep helps: **A** (a held rep makes every visit in its area shorter or longer for as long as it is held). Provisional, confirming.
2. Cannot pay the salary: **the student picks who goes** (Tom: "give a rep to a friend was a life card event I think?"). Checked: it is not a life card. "Pass a team member to your left/right" is the `transfer` action on a space (in `SPACE_EFFECTS.csv` at `PM-DECISION-CHECK`, `INVESTOR-FUND-REVIEW`, `ARCH-SCOPE-CHECK`, handled by `CardEffectService.handleTransferCard`). "Let a team member go" is `return_e` (4 rows, `handleReturnCards`), and `give_e` ("Fire Expeditor") exists in the engine but no data row uses it today. In all of them the PLAYER picks which expeditor goes, using the card-pick pop-up (`ChoiceModal`, card choice types). So "the student picks who leaves when the salary cannot be paid" is an existing pattern: reuse that pop-up, no new screen. Provisional, confirming.
3. **REVERSED to YES: the salary counts toward "On budget"** (Tom: "do architect fees and engineer fees count? if yes then filing reps too should count"). Verified in code: `ResourceService.mapCostToExpenditure` sends architect and engineer costs to `expenditures.design` and regulatory fees AND the `expeditor` category to `expenditures.fees`; `projectFinances.spent` = design + fees + construction; the money race is `moneySpent / moneyPlanned` with `moneyPlanned` = design + regulatory + construction + contingency budgets (`GameRulesService.ts:656`). Loan fees are the one cost kept out. So an expeditor card's money effect (for example Overtime -$1,000) ALREADY counts today, and a salary booked as an `expeditor` cost would count with no new code. Provisional, confirming.
   - **My pick: its own line, "Team salaries"**, counted in `spent` (a new `reps` area next to design / fees / construction) rather than inside `fees`. Reason: the Money pop-up reads `fees` against a 5%-of-scope budget, and a rep costs about $71,000 a game, so inside `fees` it would show as a huge "Regulatory & filings" overrun. Cost: a small code change (the `Expenditures` type, `projectFinances`, one Money row). The no-code fallback is booking it as `expeditor` (inside fees).
   - **The planned-money denominator:** do NOT add a salary allowance to `moneyPlanned` (it would be a guess that rewards hiring). Reps simply spend the budget, mostly the contingency share (about 12.5% of the plan). A rep then has to earn its cost in days saved, which is the trade-off Tom wants. Risk: on a small job a rep is a big share of the budget (about $71,000 on a $1M scope is 7%). So the salary should scale with the job: the weekly rate as a percent of scope (about 0.12% of scope a week) instead of a flat $1,250. The ghost run decides the number.
   - **Measuring (ghost player):** run the same seeded games with 0, 1, 2 and 3 reps. Compare, per player, the On-budget place and percent (`moneySpent / moneyPlanned`), the Fastest place, the median days, and the bankruptcy share. Pass: one good rep does not lower On-budget place more than one place, and 3 reps do not cause bankruptcy. Use the counting-test pattern from `bankerCounting.test.ts`.

4. NEW, a good rep may QUIT (about 1 in 20; the student can keep them by paying a higher salary). A bad rep has about a 1 in 20 chance of a DISASTER: a stop work order, +7 days.
5. NEW, Tom asks whether salary should be counted every 7 days of game time.

**(a) The 1-in-20 chance: per what?** Three ways, with the numbers for a typical human game (about 35 turns, a 400-day plan, 4 to 8 visits to a rep's area; the robot's long games of 20 to 170 turns are distorted by loops, so I used the class games that ended at turns 27 to 31 plus a normal run):
- Per turn: 1.75 chances per rep per game. Too many, and it hits when the rep did nothing.
- Per 7 days: about 2.9 per rep per game. Even more.
- **Per visit to the rep's own area [my pick]:** about 0.2 to 0.4 per rep per game, so one game in three has an event for one rep, about one event a game with three reps. It ties the risk to the work the rep is doing. The roll is made when the student arrives on a space of the rep's area.
- **Stop work order: reuse, do not invent.** The game has no reusable stop-work event, only a dice outcome at `CON-STEER` (30 days, -$25,000) and `SI-SKIP`. What it does have is the time-change effect and the life-event cards (`+days`, via `activeEffects`). So the disaster is one effect "+7 days" with a log line and a toast "Stop work order: a week lost", no new space. Data: the 7 and the line; code: the roll hook on arrival.

**(b) "Quit unless you raise the salary" on a phone.** A pop-up (the existing choice pop-up), not a new panel row, so the panel never grows: "Your Code rep wants $3,000 a turn (was $2,000) to stay. [Pay more] [Let them go]". If the student ignores it and ends the turn, the rep goes. A rep who stays at the higher salary keeps the higher pay for the rest of the game (stored on that held card), which is what makes the 1-in-20 worth paying attention to. Measure at 360x640 and 390x844 when built.

**(c) Salary every 7 days vs once per turn.**
- How: charge by the days that passed. Store one number on the player, `salaryBilledThroughDay`. At End Turn the weeks due are floor((days now - billed-through) / 7); charge that many weeks per rep, then move billed-through forward by 7 per week. A turn of 3 days may charge nothing, a turn of 15 days charges 2 weeks and keeps 1 day for next time. Hiring sets the billed day to today (no back pay).
- Why it is better than per turn: turns cost very different numbers of days, so per turn punishes quick turns and under-charges long ones. Days is the project's own clock. A rep who SAVES days also saves salary (small and honest), and a bad rep who ADDS days costs more salary as well, which teaches that delay is expensive. A push-back that adds days adds salary; the billed-through day is stored outside the turn snapshot, so a push-back cannot undo a bill.
- Solo: no difference, days are the player's own.
- Plain words for the student: "Each rep is paid every 7 days on your project clock."
- **My pick: every 7 days.**

**(d) The weekly rate.** $2,000 a turn over about 35 turns is $70,000 per rep per game. A 400-day plan is about 57 weeks, so the same cost is about **$1,250 a week** ($71,000 per game). Round to $1,250. Both are estimates; the ghost run tunes it (see "Game length and bankruptcy" above).

**Questions for Tom (one decision each; my pick first).**
A. (STILL WAITING ON TOM) When does the 1-in-20 roll happen? (1) When you arrive on a space of the rep's area [my pick]. (2) Once each turn. (3) Once every 7 days.
B. How is salary counted? (1) Every 7 days of your project clock, about 0.12% of the job's scope a week (about $1,250 on a $1M job) [my pick]. (2) Once each turn, $2,000. (3) Every 7 days but a flat rate that does not grow when a rep asks for a raise.
C. When a good rep asks for a raise, how big? (1) +50% of the salary, for the rest of the game [my pick]. (2) +$1,000 a week. (3) The student names a price and the rep may say no (more work, not recommended now).

### 3. TCO vs final CO at the end
- **The student's problem.** The last step is a dice space (first visit: 4 in 6 finish, 1 Site Inspection, 1 Fire Dept. fees). Nothing at the end asks the student to pick between Fastest and Best built, which is where the trophy race is hottest.
- **Options.**
  - **A. Two short spaces before FINISH (data only).** "Open now on a Temporary CO" (+5 days, -$10K renewal, 1 quality point for open items) or "Wait for the final CO" (+30 days, $0). About 10 rows, same files as item 1. Tests as item 1, plus the end-screen trophy-count tests.
  - **B. Make the choice on the Final Approval screen, no new tile.** Fewer rows; needs an end-of-game code path.
  - **C. Also model the TCO expiring** (the old parking-lot item "Loan-repayment deadline + TCO mechanic"). Most real; needs a timer in the engine. Weeks.
- **What could go wrong.** "TCOs expire about every 90 days" is the reviewer's own guess, marked "check" and not sourced; do not print it as fact. With items 1 and 3 together the end gets three extra stops: measure game length before and after.
- **Pick: A, no expiry.** Park the expiry (C).
- **Needs Tom first:** yes, numbers, wording, and a source for the TCO rules (the NYC Buildings CO worksheet linked in `PLAYTEST.md`).

### 4. "After 2 failed rolls at one space, the 3rd is a choice"
- **The student's problem.** Some games run very long (CHECK: 20 to 170 turns, middle about 85) because bad luck loops.
- **What the data says (counted from `DICE_OUTCOMES.csv`).** The rule as written ("2 failed rolls at one space") would almost never fire. Only DOB Plan Exam (1 in 6) and Fire Dept. Review (2 in 6) send you back to *the same space*; every other loop is a bigger circle.
- **What the robot's move logs say (2026-10-23, read-only from the Mac: 29 nightly `moves-*.txt` files, 36 logged games, Sep 25 to Oct 23).** Caveats first: these are two-seat robot games that stop at a step cap or at a time limit, so almost none reach the end (Final Approval was reached in 3 of the 36, Site Inspection in 5, The Audit in 4). They cannot tell us the full game length; the 20 to 170 turn range in `CHECK.md` came from solo robot games and is not re-measured here. A "step" counts pop-up clicks too, so the longest logs (up to 282 steps) are mostly clicking, not travelling.
  - **Where the robot loops is early, in design and filing.** City Checks Plans was reached in 26 of 36 games, 1.9 times a game on average and up to 9 times in one game; in 11 games it was visited 3 or more times. Of the 70 times a robot arrived there, 15 (21%) went back to Find an Architect and 29 (41%) went on to Fire Dept. Intake. Fire Dept. Review: 58 arrivals in 22 games, up to 7 visits in one game, 9 games with 3 or more; from there robots went to Find an Engineer 9 times, on to Hire a Builder 8 times, back to Find an Architect 5 times. Find an Architect was visited 2.9 times a game on average (up to 11), in 16 games 3 or more times.
  - **Return arrivals (a space the player had been at before), 661 in 36 games, median 13 a game.** Most are hubs, not luck: "Pick Your Path" (rethink the plan) 107 together and the "YOU MOVED" office 71. Of the real spaces: Architect's Fee 42, Find an Architect 38 (plus 21 on its "I want another look" visit), City Checks Plans 34, See the Design 33, Engineer's Fee 30, Fire Dept. Review 30, Check the Structure 27, Find an Engineer 25.
  - **Longest run of consecutive return arrivals in one game: 32** (Oct 19), other long ones 19, 16, 16. In those, the run is the architect, engineer and plan-exam loop.
  - **Reading it.** The circles that cost robots the most time are plan exam sending them back to the architect and the fee/design/engineer chain that follows (a redesign walks the player through 4 to 6 spaces again), not a same-space repeat. The back-half loops (Final Approval to Site Inspection to Trouble On Site) matter in `CHECK.md`'s long solo games but are barely visible here because few robot games get that far (hypothesis, unverified for those).
- **Options.**
  - **A. Count "sent back to the architect or engineer" (or any earlier step) in a row.** After 2 in a row the 3rd step is a choice (pay days or money, or redesign). A counter in player state; the choice reuses push-back pricing (`try_again_days`). About 3 days: a small change in `MovementService`, a state field, a pop-up, ghost tests for a loop, and a saved-game check.
  - **B. The rule as written (same space only).** Cheaper but covers perhaps 1 in 6 of the bad loops. I would not build it.
  - **C. Soften the back-step chances in the data.** Hours, but it makes the game easier everywhere and later collides with a teacher "luck level".
- **What could go wrong.** If the price is not real, rework stops costing anything and the lesson goes. A counter not reset when a game loads, or when Try Again undoes a move, will miscount.
- **Pick (firmer now): A, counting being sent back to an earlier step, and building it first for the plan-exam to architect circle**, where the robot data shows the loops (3 or more visits to City Checks Plans in 11 of 36 games). Do not count the office and "Pick Your Path" hubs; they are the player's own choice. Re-measure with the robot after it ships, and run a long solo robot game once to check the back half.
- **Needs Tom first:** yes, two in a row or three, and what the choice costs.

### 5. "Show the trophy race all game; approvals stamp the mat"
- **The student's problem.** Students cannot steer toward their two trophies if they cannot see where they stand.
- **What already exists.** The live trophy board is built (`LiveTrophyBoard.tsx`, Job 5): each player's place and how far behind, in the Progress strip (`ProjectProgress.tsx`) and on the TV (`TVDisplay.tsx`). So the first half is largely done. Not checked: whether a phone shows it without scrolling (hypothesis, unverified: it sits in the Progress panel only). The second half is not built: nothing stamps when DOB or FDNY approves or a builder is hired.
- **Options.**
  - **A. Stamps only.** A small stamp and a line on the mat when `dobApprovalStatus`, `fdnyApprovalStatus` or the builder changes. About 2 days: one event from `ApprovalService`, one component, tests for the event and a render test, and the phone check at 360x640 and 390x844 (Tom's rule: the panel never grows).
  - **B. A one-line strip on the phone** ("2nd fastest, 1st on budget") always in view. About 2 days; risks a taller panel.
  - **C. Both.** About 4 days.
- **What could go wrong.** Phone space. The Browser pane fires no animation frames, so animation needs another way to check. Stamps on a TV need a real-TV look. Wording must stay real-world, no game words.
- **Pick: A first.** It is the missing half and adds no height if it appears in the existing mat area.
- **Needs Tom first:** not to build A (no new rules), but he should see it on a phone.

### 5b. Trophy markers: a plus or minus and the new place, after Commit or Negotiate (design only, 2026-10-25, nothing built)
- **What Tom wants (his answers).** After he presses Commit or Negotiate, the balloon above the building he is at (town view) shows, next to each trophy that changed, a GREEN PLUS or a RED MINUS and the player's current place. Each trophy gets its own picture: Fastest = a calendar or a watch; Best built = a clipboard with checkmarks; On budget = coins and paper money. Today all three use one shared trophy emoji.
- **What it touches.**
  - The town balloon: `TownBoard.tsx` draws the result bubbles (`+$ / -$, +/- days, scope`) from `resultBubbles()` / `mergedResultBubbles()` in `src/utils/townLayout.ts` (kind money / days / scope, tone good / bad / info). A trophy bubble is a fourth kind in the same list, so the bubbles, their timing and their colours are reused.
  - The numbers: `buildLiveBoard()` in `src/utils/liveTrophies.ts` already gives each player's `place`, `of`, `behind` and `value` (percent of own plan) for the three races. Compute it once before and once after the commit and compare.
  - The live board: `LiveTrophyBoard.tsx` (Progress strip and TV) and the end-game table in `EndGameModal.tsx` use `theme.emoji.trophy` (`src/styles/theme.ts:365`, one 🏆). They would take the three pictures in place of the shared one.
- **Plus or minus: places or points? Proposal: PLACES.** Plus = the player moved UP at least one place in that race, minus = moved DOWN, nothing shown if the place is the same. Why: a place is what the student is playing for and what the board already shows ("2nd of 3"); points of percent are small (a 0.4 move) and a sign on a tiny number reads as noise. Points stay in the hover text. A tie keeps the better place, as the board already does. Edge: a solo player has no race, so no marker.
- **Provisional places.** `LiveRow.solid` says a place can still change while other players are behind in days. The marker uses the same wording as the board (italic or a small "for now"); a change in a provisional place is shown, but the board's note stays.
- **Phone.** The balloon floats over the town, so it adds no height to the player panel. It must fit the balloon's width at 360 px: at most the two trophies that changed, picture + sign + place (like "calendar + 2nd"), no sentence. The panel itself is not touched. Measure the balloon at 360x640 and 390x844 on a late-game player when built.
- **Art.** Three small pictures, one per trophy, in the same size as the 🏆. Tom picks the style: (1) emoji style (calendar, clipboard, money bag: zero art cost, but looks differ by device), (2) simple line icons drawn once as SVG (same look everywhere, a few hours, no brand marks), (3) hand-drawn in the game's own look (best fit, needs an artist). Names stay from `TROPHIES.csv`; the picture keys would be a new column there so a different board can swap the art by data.
- **Cost.** With emoji or SVG icons: about 2 days (bubble kind + before/after compare + three icons + tests + the phone and TV check). With drawn art: add the art time. No new rules, no engine change.
- **Questions for Tom.** (1) Emoji, simple line icons, or drawn pictures? (2) A marker only when the PLACE changes (my proposal), or also when the percent moves a little? (3) Should the same pictures replace the shared trophy in the Progress strip, the TV board and the end-game table, or only in the balloon?
- **Fairness and brands.** No brand names or logos in any picture or word.

### Which of these need Tom before any building
1. Inspector sign-off: yes (numbers and wording).
2. Hire an Expeditor fork: yes (the day-adding-cards choice first, then prices).
3. TCO vs final CO: yes (numbers, wording, a source for TCO rules).
4. Bad-luck cap: yes (the count and the price), after reading the robot's long games.
5. Trophy race: no for the stamps; he should look at it on a phone.

---

## Design prep: role play step 1, the Banker/Lender as a second role (2026-10-23, inventory first, nothing built)

Source: `D:\Unravel\Independent_Review\RESEARCH-2.md` §4.

- **The goal in plain words.** Today every player is the project manager and the bank, the lender and the investor are scenery. Step 1 lets a second person (or a robot) be the Banker/Lender who decides the money terms, so waiting players have a job and the money spaces become a real deal between two people. Any empty seat must be a robot, so a solo student still plays the whole game.
- **What already exists.**
  - **The characters are in the data**: `CHARACTERS.csv` has The Banker (`BANK`), The Lender and The Investor; each money space has a speaker (`npc_speaker` in `GAME_CONFIG.csv`). Spaces: `LEND-SCOPE-CHECK` (choice), `BANK-FUND-REVIEW` and `INVESTOR-FUND-REVIEW` (fixed), with the lender's wording in `AUTHORED_COPY_REVIEW.md`.
  - **The money terms are mostly data already**: loan cards (60 B cards at 5, 10 or 15 percent), fee reviews that charge a share of the scope (`try_again_scope_pct`), the quote-comes-back push-back model (Tom 2026-10-02), and the game's own limit of 20 percent plus bankruptcy checked at End Turn.
  - **Players are all the same kind** (1 to 4, one project manager each), with a join picker, per-phone ids and a TV spectator. There is no "seat" that is not a project manager.
  - **A robot exists, but only as a tester** (`src/headless/ghostPlayer.ts`; it picks random legal moves and the nightly Jarvis run plays through the browser). Neither plays a role well. No code path today lets a robot fill a seat in a live game (hypothesis, unverified: a grep for bot or AI player seats found nothing outside the ghost player and the stats code).
- **Options.**
  1. **Robot banker only (smallest, recommended first).** No second person. The Banker is a rule table: given the project manager's scope and the cost to raise (the number the panel already shows as "to raise"), the Banker offers a rate and a limit. The player still chooses among the same buttons, but the offers now depend on rules written in a data file (for example: lend if the cost is under 80 percent of the limit, charge more if the builder is cheap). Steps: (a) write the rule table as a small CSV and read it in one service; (b) show the Banker's reasoning in the existing pop-up (the "why" tip pattern); (c) tests that the offers follow the rules and never break the 20 percent cap; (d) one ghost game with the rules. About 1 week. It teaches the Banker's side without a new seat.
  2. **Second human seat for the Banker.** A new seat kind, a join choice, a banker's screen on a phone, turn rules for when the banker acts, and saving. It touches turns, phones, the TV and the saved game. Weeks to months (the review says so too), and not before the dice-to-choice work.
  3. **Banker as a robot that a person can take over later** (the final shape the review wants). Build option 1 so its decisions come through one function (`decide(offer, situation)`), so a human screen can answer the same question later. No extra cost now beyond that one rule.
- **What could go wrong.** A banker who only says yes or no teaches nothing; each side needs its own goal (the review's lesson). A rule table can make the game easier or unwinnable at some projects: measure with the robot across the 400 project cards before shipping. Saved games and the TV need no change in option 1, but any new state goes in the saved game and needs a loading test. A seat model added later will have to replace today's "every player is a project manager" rule in several places, so keep the Banker out of the player list for now.
- **Pick: option 3 (build option 1 through one `decide` function).** It is small, it teaches the lender's side, and it leaves the human-seat path open without committing to it.
- **Needs Tom first:** yes. (1) Is a rule-following banker acceptable as step 1, rather than a human? (2) The Banker's own goal in one plain sentence (for example "lend safely and be repaid"). (3) Whether the lender should refuse a project outright, since today nothing can end a game before the project manager chooses to go on.


### Banker role, step 1 update (2026-10-23): the rule-table robot banker, build plan (design only, nothing built)

Tom's decisions: step 1 is a rule-table robot banker (no AI), built through one `decide` function a human seat can use later. Its goal, in Tom's words "a and b 50 50 weight": half **a, get repaid on time** (a cautious lender) and half **b, earn the most profit** (bigger, riskier loans at a higher cost).

**What the lender and bank spaces already do (inventory, read from the data and code).**
- **The route.** `LEND-SCOPE-CHECK` (the lender looks over the plan; a dice row "see what the plan covers", 5 days, may hand an L card) leads by a choice to `BANK-FUND-REVIEW` or `INVESTOR-FUND-REVIEW`, and both go on to `PM-DECISION-CHECK`. A return visit is the "you again" version with colder wording and fewer options.
- **The bank.** The player draws one B card ("See the bank's terms"). There are 60 B cards, each with a fixed `loan_amount` ($500K to above $1.4M in steps) and `loan_rate` (5, 10 or 15). The bank lends the smaller of the card's amount and the player's funding gap rounded up to the next $10K (`CardService`, around line 1775, v3.8.x). The interest is charged once, at that moment, as a fee (`loan_amount x loan_rate`). A filing fee also applies: 1% up to $1.4M, 2% up to $2.75M, 3% above (`LOAN_TIERED`), plus 1 day per $200K. Push-back on the terms is the existing "push back" button (the quote comes back, a fee review charges 0.5% of scope and days).
- **The investor.** An I card ("what they'll put in") with a dice outcome for the amount and for how long they take, and a 5% of amount borrowed fee (`LOAN_PERCENTAGE`). `investor_payout` exists on I cards.
- **The numbers a banker could read.** `computeProjectFinances` (`src/utils/projectFinances.ts`) already gives scope, the design, regulatory and contingency budgets (20%, 5%, 10%), the commitments and the **funding gap**, and `player.moneySources` (owner funding, bank loans, investment deals). The turn history has the days used and how many times the player has pushed back.
- **What does not exist.** There is **no repayment**: interest is a one-time fee and nothing ever comes due, so "get repaid on time" has no moment in the game today (the parked item "Loan-repayment deadline + TCO mechanic" is exactly this). The game's real money endings are the 20% design-fee cap and bankruptcy, both checked once at End Turn (`FinancialEffectHandler`).

**Inputs the banker sees.** The player's funding gap, scope and total cost (from `computeProjectFinances`); money already raised from each source; days used against days planned; how many times this player has already asked this lender (the visit count); whether the player holds a builder bid and an expeditor (they lower risk); the card the player drew (its amount and rate); the project type. These are all already in state; the banker invents nothing.

**How the 50/50 score is made.** Score = 0.5 x `safe` + 0.5 x `profit`, each from 0 to 1.
- **`safe` (a): the likelihood the loan is repaid.** Because nothing comes due yet, define it as the likelihood the project can carry the loan to the end: `safe = 1 - clamp(loan / (cost to finish))` blended with a cushion term `(cash on hand + other money raised) / cost to finish`, then lowered a step for each push-back already made and for a project already past its planned days. Source: all from `computeProjectFinances` and the turn history. This is a rule table, not a model: five bands (for example loan under 40% of the cost = 1.0, 40 to 60% = 0.75, 60 to 80% = 0.5, 80 to 100% = 0.25, over 100% = 0) with the bands in a data file so Tom can tune them.
- **`profit` (b): what the banker earns.** `earn = interest (loan x rate) + filing fee (tier) + investor-style fee`, divided by the most any B card could earn at that cost (the biggest amount at the 15% rate). Source: `loan_amount`, `loan_rate`, the tiered fee rule, all in the data already.
- **Why it is a real trade-off.** A bigger loan at a higher rate raises `profit` and lowers `safe`; a small cheap loan does the reverse. With a 50/50 weight the score peaks in the middle, which is the lesson ("the bank wants to be repaid and to earn").
- **Where each number comes from, in one line for Tom:** the repayment number comes from the player's own project numbers; the profit number from the loan card's own terms.

**The approve / refuse / counter rule (one `decide(offer, situation)` function, data-driven).**
- Score at or above 0.60: **approve** the card's terms as drawn.
- Between 0.35 and 0.60: **counter**: a smaller amount (to the biggest amount that keeps `safe` at 0.6) at the same rate, or the same amount at the next rate up (5 to 10 to 15), whichever scores higher. The student can accept, push back (existing button) or go to the investor.
- Below 0.35: **refuse**, with the reason, and an alternative (the investor, or a smaller scope). A refusal never ends the game: the student always keeps the investor route and the push-back.
- All three outcomes use today's buttons and today's money code; only the terms offered change. The result is returned as a small object `{ answer, amount, rate, reasons[] }`, so a human seat can later return the same object.

**How a student is told why, in plain words (the main teaching value).** The banker's pop-up lists the top two reasons from `reasons[]`, written in the banker's own voice and real-world words (no scores, no dice or card talk): "You are asking me for 80 percent of what the job costs, and you have almost no cushion. I would want less on the table." "I would lend you this much at 10 percent: the rate pays me for the risk." Each reason is a line in a data file keyed by band, so it can be edited like the other authored copy. The existing "why" tip pattern (`ACTION_TOOLTIPS.csv` `why,<SPACE>`) carries the real-world cause (banks lend against the project, and they price risk).

**Build plan in small steps, with cost (about 1 to 1.5 weeks).**
1. The rule table file (bands, thresholds, reason lines) and a pure `decide()` with tests (2 days).
2. Read the inputs from state in one adapter (`bankerInputs(player)`), with tests on real projects from the 400 cards (1 day).
3. Wire the decision into the bank pop-up only: the terms shown follow `decide()`; the money code is untouched (1 day).
4. The reason lines in the pop-up, measured on the phone (the panel must not grow: the pop-up replaces existing text, not adds a block) (1 day).
5. The same for the investor, if step 3 works (1 day, optional).
6. Robot runs (below) and tuning (1 to 2 days).

**What could go wrong.**
- **Too easy.** If the bands approve nearly everything, the banker teaches nothing. Measure the approve share per project size.
- **Impossible.** A project that is cheap to build but has a large soft cost could be refused by every route, a dead end. The investor route and push-back must always stay, and a "last offer" at the bottom band should exist so no player is locked out.
- **A bankruptcy loop.** A refusal that leaves the player short, then a push-back that costs days and money, then another refusal, can end in bankruptcy or the 20% cap. Cap the refusals per game (for example two, then the third is a counter) the same way the bad-luck-cap pick works.
- **A "repaid on time" with no repayment.** The word promises something the game does not do. Either word it as "can this project carry the loan" (this plan), or build the parked repayment deadline first. I would not build the repayment deadline in step 1.
- **Saved games.** The decision is computed when the pop-up opens and not stored, so there is no new saved state in this plan.
- **The 50/50 weight is Tom's choice** and may later become a teacher dial.

**Test plan with the existing robot.** (1) Unit tests of `decide()` per band and per weight. (2) The ghost player (`src/headless/ghostPlayer.ts`, random legal moves) plays 50 games with the new banker and the suite checks the old things: no crash, the win-rate floor, no bankruptcy loop (a game never refuses the same player more than the cap). (3) A new counting test over the 400 projects: the approve, counter and refuse share by project size must stay within a band Tom picks (my starting guess: about 60% approve, 30% counter, 10% refuse; unverified). (4) The nightly Jarvis run (read-only report) after it ships, looking at game length and how often the robot reaches the end.

**Pick: build steps 1 to 4 only (the bank, not the investor), with the refusal cap and the always-open investor route, wording the first number as "can this project carry the loan".** It reuses every number the game has, adds no saved state and leaves the human seat open through the single `decide` function.

**Tom's answers, 2026-10-24 (all five questions ANSWERED; these WIN over the older text above where they differ).**
1. **"Repaid on time" now means: the project finishes on schedule, judged against the schedule fixed at the moment of the loan.** Early is best, on time is good, late is bad. This REPLACES the "can this project carry the loan" wording and the "no end-of-game change" line. The banker's `safe` score becomes the likelihood of finishing on schedule. A settlement at finish (late costs extra, early saves something) touches game balance: see the safety check below.
2. **After TWO refusals the bank declines for good and sends the student to the investor.** This REPLACES the forced counter-offer at the cap.
3. **Bank only in the first build; the investor stays as it is today.** Tom's later idea (parked, not designed): the investor could face a HARDER approval than the bank, because it gives away much more.
4. **First visit is reviewed more strictly; a return visit is easier ONLY when the bank has already lent to this project.** A student refused on the first visit and coming back is judged as new. The 60/30/10 mix and the 0.60/0.35 cut-offs stay unverified guesses: the Game session tunes them with the robot and shows Tom (first visit stricter than 60/30/10). The existing colder "you again" return wording must be reworded to sound supportive.
5. **The Game session drafts the reason lines** (banker's voice, plain words, no scores, fit the phone without growing the pop-up); Tom reads them in the game on a phone before they ship and marks the ones that sound wrong.

Not started: the Banker BUILD waits for Tom's go (the safety check is below).
**Safety check before the Banker build (read-only, 2026-10-25; nothing changed in the code).**
- **Can the investor leave a student with no money option after two bank refusals? No.** The investor's dice always hand over 1 or 2 investor cards (never zero), every investor card pays $4M to $12M, and none is restricted to a phase; an empty pile reshuffles its discards. So the investor can never refuse. What it costs is the 5% fee and 30 to 70 days. Reaching it from the bank is two hops: `BANK-FUND-REVIEW` always moves to `PM-DECISION-CHECK`, which offers `LEND-SCOPE-CHECK` again (a 5-day look at the plan), which offers the investor. Not a dead end, but "sends the student to the investor" is not automatic today. Build choice: after the second refusal make the bank's onward move go straight to `INVESTOR-FUND-REVIEW`.
- **What a finish-on-schedule settlement would touch.** (1) The schedule at the moment of the loan is NOT stored anywhere today; a new field written when the bank loan is taken (next to the `loans[]` record, `CardService` bank-card branch) is needed. Planned days come from `calculateEstimatedProjectLength`; days used are `timeSpent`. (2) At the finish, `GameRulesService.computeStandings` already compares days used with days planned for the trophies; the settlement belongs at the same finish check, written through `updateTempState` so a push-back cannot undo it. (3) It changes `moneySpent`, so the trophy money race and the bankruptcy check at End Turn feel it; the 300% time cap already ends the worst runs. (4) Only games that take a bank loan are affected.
- **Real numbers (24 seeded robot games, smart bot, 20 finished, 4 out):** days used divided by days planned at the finish ran from 0.29 to 3.28; 6 of 20 finished at or under plan, 14 over, about 1.8 times plan in the middle. Only 2 of the 20 took a bank loan ($230K and $160K); 12 took investor money. So today's robot is mostly late, and a harsh late fee would hit nearly every banked game.
- **Proposed late and early amounts (a gentle first table; Tom to react).** Finished 10% or more early: the bank gives back 25% of the interest it charged. Within 10% either way: nothing. 11 to 50% late: pay 0.5% of the loan. 51 to 100% late: 1%. More than twice the plan: 2%. On a typical $1.5M loan that is $7.5K, $15K or $30K against an interest charge of $75K to $225K, so it nudges and does not bankrupt. Rates are data-file numbers so Tom can tune them.

### Robot Banker BUILT (v3.8.66, 2026-10-24, pending Tom's deploy)
Steps 1-4 built per Tom's answers: `decide()` in `src/utils/bankerRules.ts`, cut-offs and reason lines in `public/data/CLEAN_FILES/BANKER.csv`, adapter `bankerInputs.ts`, wired into the bank draw only (`CardService.consultBanker`), two refusals route straight to the investor (`MovementService`), schedule stored on the loan record, settlement at the finish (`TurnService`). Counting test (400 projects x 60 bank cards, seed 20261024; the days-used and push-back mixes are guesses):
- First visit: small projects approve 21.6 / counter 52.9 / refuse 25.5; medium 29.9 / 57.8 / 12.3; large 41.0 / 57.4 / 1.7; all 30.8 / 56.0 / 13.2.
- Return visit (bank already lent): small 47.8 / 47.0 / 5.2; medium 60.8 / 38.3 / 0.9; large 84.9 / 15.1 / 0.0; all 64.5 / 33.5 / 2.0.
- Caveat: small projects are refused more than large ones (the loan is a bigger share of a small job's remaining cost). Tom to judge. Retune in BANKER.csv: approve_first 0.70, counter_first 0.50, approve_return 0.60, counter_return 0.40.
- NOT verified: phone width (the pop-up text is capped at 150 characters, about the old story's 126-139, but no 360x640 / 390x844 measurement was taken) and a real TV. The pop-up push-back count (`pushBacks`) is not wired in the live path yet (0).
