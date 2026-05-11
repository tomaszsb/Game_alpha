# TODO - Game Alpha

**Last Updated:** May 6, 2026
**Status:** Beta — regression gates in place; Workstream 6 closed
**Current Version:** 2.63.1

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🔎 **Audit-Recovered Items** (April 30, 2026)
*Source: documentation audit — items that were quietly mentioned in deleted/trimmed docs but never landed anywhere actionable. Captured here so they aren't lost again.*

- [ ] **TransactionalLogging integration tests** — TESTING_GUIDE used to flag five "Test Cases for Future Implementation" (standard turn commit, single Try Again rollback, multiple Try Again then commit, system logs always committed, error logs always committed) covering the LoggingService session lifecycle integration with TurnService. Architecture exists; integration coverage doesn't. Decide whether the unit tests in `tests/services/TransactionalLogging.test.ts` (11 tests) are sufficient, or write the integration variant. Spec retained in `docs/technical/TESTING_GUIDE.md` → "Transactional Logging Test Cases".
- [ ] **Turn Numbering System tests** — TESTING_GUIDE used to carry a 📋 PLANNED section with detailed test specs for `tests/services/TurnNumbering.test.ts` (game-round progression, turn-within-round cycling, global turn counter, multi-player rotation, log entry context, visibility filtering) plus `tests/components/GameLog.TurnHierarchy.test.tsx` and `tests/integration/TurnProgression.test.ts`. Spec was deleted from TESTING_GUIDE in the doc-trim pass — find it in git history (commit `3f8c14f`) if implementation gets picked up. Likely safe to drop entirely if turn-numbering UI hasn't surfaced bugs.
- [ ] **Ghost Player Workstream 1.1 — bot heuristic for the 2/50 loop case** — Roughly 2 in 50 random-move games exceed the 300-turn cap and stall in scope/fund-review loops. Documented in v2.40.0 release as "ACCEPTED — bot-strategy artifact, not a game bug." A small heuristic (prefer choices that move forward over backward) would let us tighten the strict gate from ≥90% wins back to 50/50.
- [x] **CardEffectService — migrate setter to constructor injection** (v2.59.0, May 2026) — `TurnService.setCardEffectService` was the last false-cycle setter from the April 2026 cleanup. Now passed via constructor as the 14th (optional) param. Setter removed; ServiceProvider + 9 test files migrated.
- [ ] **Phase 6.4 (Workstream 6 sub-lift): NPC voice profile** — Lifting `extractPrefix` + `CHARACTER_MAP` + `CHARACTER_PROFILES` to a per-space `npc_voice_profile` data flag. Touches 6 callers (5 components + SpeechService) including pure-utility functions. Scoped out in v2.58.0 because educator-added spaces fall back to narrator voice (acceptable degradation). Probably never lifted unless an educator complains — flagging here so the deferral is explicit, not silent.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
- ✅ Story as composed per-action narratives (v2.50.0) — Flat `Action`/`Outcome` text blocks on landing-on-space replaced by an N-row accordion, one row per authored effect. First-uncompleted row auto-expands, completed rows collapse with a green ✓, auto-triggered Life events render pre-collapsed with "Life event happened — click to read". New `StoryAccordion.tsx` (ordering E→W→B→I→dice→money→time→L, effect icons/labels, `isCompletedEffect` covers dice/auto/manual); `ActionCenterPanel.tsx` inserts accordion after Event header and gates legacy blocks behind `hasAnyActionNarrative` so un-authored spaces fall back gracefully. Sample narratives authored on OWNER-SCOPE-INITIATION/First (e_card) and ARCH-FEE-REVIEW/First+Subsequent (l_card, e_card). Regression gates: `StoryAccordion.test.tsx` 6/6 new; `processGameData.test.ts` 19/19 (+5 real-data fingerprint tests). `npm run typecheck` 0 errors. (Apr 21, 2026)
- ✅ Logic-tree movement restored at REG-FDNY-FEE-REVIEW (v2.49.0) — Fixes a v2.45-era pipeline regression that silently emitted `movement_type='choice'` for `path=LOGIC` rows, downgrading the 5-question yes/no decision chain to a flat picker. `processGameData.js` now routes `path=LOGIC` with priority and emits `'logic'`. New hand-authored `public/data/CLEAN_FILES/LOGIC_QUESTIONS.csv` drives the walker (space_name, visit_type, question_id, question_text, yes_target, no_target). `DataService` loads it; `MovementService.handleLogicMovement` asks yes/no questions via a new `LOGIC_QUESTION` choice type and resolves targets (Q-id recurse / single-space terminal / comma-split sub-choice). `ChoiceModal` renders "Question N of M" progress from metadata. Regression gates: `processGameData.test.ts` 14/14 (7 new) including real-data + integrity checks; `MovementService.test.ts` 47/47 (7 new walker branch tests). `npm run typecheck` 0 errors. (Apr 21, 2026)

### **Backlog**
- Story authoring rollout (post-v2.50.0) — Infrastructure shipped in v2.50.0; authoring is creator-driven (voice is creative, not just a deterministic transformation of a doc — see `docs/core/AUTHORED_COPY_REVIEW.md` voice rule "Per-action narratives stay ambient/narrator-from-above. Not bound by this rule"). Two ways to author:
  - **Live Data Editor** at `https://game.unravelcodes.com/admin` — fill in the `*_card_narrative` columns per (space, visit). Saves write through `processGameData` on the server and update CLEAN_FILES automatically.
  - **JSON + script (offline)** — write a file like `scripts/narratives-<space>.json` with `[{space_name, visit_type, column, narrative}]` entries, then `node scripts/set-narrative.mjs scripts/narratives-<space>.json && node scripts/regen-clean-files.mjs`. See `scripts/set-narrative.mjs` header for full usage.

  As of v2.60.0: 5 of ~75 card-effect rows have authored narratives (samples from v2.50.0 — OWNER-SCOPE-INITIATION/First/E, ARCH-FEE-REVIEW/First+Sub/L+E). Priority order from earlier triage: high-traffic REG/PM/ARCH/ENG first, then CON, then setup spaces. Legacy flat `Action`/`Outcome` blocks render wherever a space has no authored narrative on any effect, so rollout can be incremental with zero gameplay risk.

- Voice rewrite merge — Pass 1 shipped v2.60.0 (May 2026). Spaces.csv text fields (Title/Event/Action/Outcome/end_turn_label/try_again_label), the 2 Negotiate flag flips (REG-DOB-FEE-REVIEW Subsequent → NO; ARCH-INITIATION Subsequent → YES), and the 2 Subsequent-row deletions (OWNER-SCOPE-INITIATION, OWNER-FUND-INITIATION) all merged. CLEAN_FILES regenerated.

  **Pass 2 — ModalConfig.csv population (open).** The doc has `### Modals fired here` tables for ~50 spaces with `effect_action`/`modal_title`/`modal_description`/`modal_button_label`/`modal_summary` per modal. Blocked on a mapping pass: the doc uses human-readable labels (`"Take Owner's Money"`, `"Time: 1 day"`, `"e_card: Draw 3"`) whereas `ModalConfig.csv` keys by the engine's internal `effect_action` value (`add`, `draw_E`, etc., possibly with `dice_value`). Need to walk each space's `SPACE_EFFECTS.csv` rows, match doc-side modal entries to engine-side action keys, then generate ModalConfig rows. ~50 spaces × 2-3 modals each ≈ 100-150 rows. Worth scripting (see `scripts/merge-voice-rewrite.mjs` for the doc parser as a starting point).

- Educational "Learn More" content per space — Hidden educational field per space, revealed via a Learn More icon. Explains why the step exists, why it matters, and historical/regulatory context (NYC-specific: real DOB code sections, ZR citations, Triangle Shirtwaist → FDNY history, 1916 zoning resolution backstory, etc.). Separate "field guide" instructional register from the in-character NPC voice — clicking Learn More gets a teacher, not a character. Constraints to lock before authoring: (a) one paragraph default (~200 words), max ~500 for spaces with rich history; (b) every fee/rate/code claim sourced to nyc.gov / ZR / NYC Admin Code; (c) footer disclaimer ("educational, not legal advice — verify current rules at nyc.gov"). Author a 2-space calibration sample (suggest REG-FDNY-PLAN-EXAM with the Triangle Shirtwaist hook + BANK-FUND-REVIEW for contrast) before scaling to all ~50 spaces. Separate workstream from the voice rewrite — do not block v2.51.0. Target version TBD — content authoring + reading UI; not blocked by engine-data separation work.

- ✅ **Engine-data separation (Workstream 6) — COMPLETE.** Shipped v2.51.0 → v2.58.0 (Apr 26–29, 2026). 8 of 8 Category A scenarios shipped + Phase 6.2 type loosening + 2 of 3 Phase 6.3 cosmetic mappings. Phase 6.4 (NPC voice profile lift) deferred — see Audit-Recovered Items above. See [`docs/core/BETA_PLAN_V3.md`](docs/core/BETA_PLAN_V3.md) → **Workstream 6** for full ship list and CHANGELOG for per-version detail.

- **Data storage format (CSV → JSON / per-space markdown)** — DEFERRED pending engine-data separation. Originally framed (in a lost prior chat) as "convert CSVs to per-space JSON to support educator editing and multi-tenant overrides." Re-analysis 2026-04-26 found that file format is mostly orthogonal to the actual needs — the blocker is engine-data separation (above), not file format. Once engine is fully data-driven, format choice becomes a question of editor ergonomics + multi-tenant override storage. Current bet: per-space markdown-with-frontmatter (mechanics in YAML frontmatter, prose body for narratives + Learn More) is the natural fit, but defer the decision until Phases 1–2 of engine separation reveal the full data shape. Do not migrate now.

- **Multi-tenant catalog (educator licensing + contribution model)** — DEFERRED pending engine-data separation + format decision. The vision: schools license the game, edit data/spaces for their context, and contribute changes back to a shared catalog so other schools can adopt them. Implementation likely needs: (a) backend storage for tenant edits (database, not flat files), (b) auth + tenant identity, (c) override layer (tenant edits as patches over base content), (d) publish/curate workflow (auto-share or moderated catalog?), (e) editor UI tenant-scoping. None of this is file-format-driven — works with CSV or JSON or markdown. Real prerequisite is engine-data separation: educators must be able to edit *all* of a space's behavior via data before tenant overrides become meaningful.

- ✅ Tier 4 Bucket D — service-surface `any` narrowed (12 sites across 5 files). `NegotiationService` (5): `initiateNegotiation(context: any)` / `completeNegotiation(agreement: any)` → `Record<string, unknown>`; `playerHasCard/removeCardsFromPlayer/addCardsToPlayer` player params → `Player`, helpers now return `Partial<Player>`. `StateService` (4): `updateNegotiationState(negotiationState: any)` → `NegotiationState | null` (matches interface contract); dropped 3 `(result as any).committedState/updatedState` casts — `TurnStateManager` return types already carry those fields. `DiceRollProcessor` (1): `DiceRollEffectsResult.gameState: any` → `GameState`. `GameLayout.tsx` (1): `useState<any>` → `useState<TurnEffectResult | null>`, ad-hoc setter object now supplies full shape. `GameRulesService` (1): `extractValidDestinations(movement: any)` → `Movement`. `npm run typecheck` 0 errors; 23/23 test batches green. Cumulative Tier 4: 50/109 original `any` usages eliminated. (Apr 18, 2026)
- ✅ Tier 4 Bucket C — CardService `card: any` narrowed to `Card` (10 sites across `CardService.ts` and `GameRulesService.ts`). `parseCardIntoEffects`, the 5 `apply*CardEffect` helpers, `handleReturnToSender`, `handleFavorCalledIn`, and `isTimeReductionBlockedByZeroTime` all now take `Card`. Also dropped 2 unnecessary `cardType as any` casts (parser already returns `CardType`). The narrowing surfaced a dead `movement_effect` branch in `parseCardIntoEffects` — not on the `Card` type, not in any live CSV, only exerciser was one test; branch + test deleted. `npm run typecheck` 0 errors; 23/23 test batches green. (Apr 18, 2026)
- ✅ Tier 4 Bucket B — effect/payload `any` narrowing (28 sites across 8 files). `EffectEngineService` (9): `cardData: any` → `Card`, default-case `as any` → type-guarded cast, `CARD_ACTIVATION` replay uses `isResourceChangeEffect`, agreement-data → `Record<string, unknown>`. `FinancialEffectHandler` (7): `payload: any` → `Extract<Effect, {effectType:'RESOURCE_CHANGE'|'FEE_DEDUCTION'}>['payload']`; `player: any` → `Player`; `updateData: any` → `Partial<Player>`. `CardEffectHandler` (3): CARD_DRAW/DISCARD payload extracts; `cardData` → `Card | undefined`; added `count ?? 1` fallback. `buttonFormatting.ts` (4+1): new exported `DiceFeedbackEffect` interface, `colors: any` → `typeof colors`, `diceOutcome` → `DiceOutcome | null | undefined`; `?? 0`/`?? ''` fallbacks now render `"Got 0 s"` instead of old buggy `"got undefined undefineds"`. `NotificationUtils.ts` (2): `effects: any[]` → `DiceFeedbackEffect[]`. 3 player-panel section components: `effect: any` → `SpaceEffect`. One test assertion updated for the behavior improvement. `npm run typecheck` 0 errors; 23/23 test batches green. **Buckets C/D/E (~81 sites) remain.** (Apr 18, 2026)
- ✅ Tier 3 dead negotiation-effect pathway removed — `EffectEngineService.setNegotiationService` + its private field, the `INITIATE_NEGOTIATION` and `NEGOTIATION_RESPONSE` effect cases, the `createNegotiationEffect` and `createNegotiationResponseEffect` helpers, the two effect discriminants in `EffectTypes.ts`, and their type guards — all deleted. Production negotiation goes UI → `NegotiationService.initiateNegotiation()` directly (`NegotiationModal.tsx:92`, `TurnService.ts:1576`); the effect-engine pathway had no callers outside tests. Also removed the 350-line `Multi-Player Interactive Effects` describe block in `EffectEngineService.test.ts` that was the sole exerciser. `npm run typecheck` 0 errors; 23/23 test batches green. (Apr 18, 2026)
- ✅ Tier 3 false-cycle setter injection killed — Migrated 7 false-cycle setters to constructor injection: `cardService.setChoiceService`, `effectEngineService.setDataService/setNotificationService/setFinancialEffectHandler/setCardEffectHandler`, `FinancialEffectHandler.setDataService/setNotificationService`, `CardEffectHandler.setDataService/setNotificationService`. Optional constructor params so downstream test files only needed surgical rewires. Kept the 2 real cycles (StateService↔GameRulesService, TurnService↔EffectEngineService↔CardService) as documented setter injection. Rewired `ServiceProvider.tsx`, `tests/ghost/bootstrapServices.ts`, and 7 E2E/integration test files. `npm run typecheck` 0 errors; 23/23 test batches green. (Apr 17, 2026)
- ✅ Tier 2 deficiency cleanup — Cleared all 30 pre-existing TypeScript errors across 8 files. Root causes were mostly stale open-bag types (`LogPayload`/`EffectContext.metadata` both `Record<string, unknown>`), framer-motion type drift in `ModalBase`, a stale `NegotiationState.playerSnapshots` shape still expecting the pre-v2 `availableCards` structure, dead props passed to `PlayerPanelWrapper`, `toSpace: null` where the event type wanted `string | undefined`, and a `string | null` narrowing gap in `TurnService.endTurn`. `npm run typecheck` now returns 0 errors; 23/23 test batches green. (Apr 17, 2026)
- ✅ Tier 1 deficiency cleanup — App.tsx empty blocks removed, 4 stale CSV backups purged from `public/data/CLEAN_FILES/`, `.gitignore` extended with `*.csv.backup*` / `*.csv.pre-*` patterns, `package.json` rebranded (`code2027/1.0.0` → `unravel-codes/2.47.0`), README/PRODUCT_CHARTER/CLAUDE.md version and phase lines reconciled to Beta / v2.47.0 / ~1,480 tests. All 23 test batches green. (Apr 16, 2026)
- ✅ Per-action modal editor Phase 5 — Editor expander placeholders and a new "Tokens: …" help line now reflect the interpolation tokens available for each effect action (cards show `{count}/{cardType}`, time/fee show `{amount}`, dice shows `{diceValue}`, etc.) instead of a stale hardcoded `{count}/{amount}` hint. Helper `getModalConfigTokens()` wired into both `ModalConfigExpander` and `CardFieldWithLabel`. Closes the per-action modal editor initiative. (Apr 10, 2026)
- ✅ Per-action modal editor Phase 4 — DiceResultModal honors per-dice-value ModalConfig overrides. New `dice_value` column in `ModalConfig.csv` (8th); composite lookup key `space|visit|action|dice_value`. `DataService.getModalConfig()` takes an optional `diceValue` argument with dice-specific-wins-over-generic precedence. Phase 4 rows are skipped by `processGameData`'s SPACE_EFFECTS merge so they don't pollute unrelated actions. SpaceEditor adds "🎲 Dice Outcome Modals" fieldset with 7 slots (Any Roll + Roll 1..6), shown only on dice-roll spaces. Supports `{diceValue}`/`{spaceName}`/`{count}` tokens. 3 new DiceResultModal tests + 1 new DataService precedence test; 22/22 pass. (Apr 10, 2026)
- ✅ Per-action modal editor Phase 3b — EndGameModal honors ModalConfig overrides keyed by `space|visit|end_game` (winner's final space). Custom title replaces "Game Complete!", description replaces victory subtitle, summary replaces "Well played!" banner, button label replaces "Play Again". Supports `{winnerName}`/`{spaceName}`. SpaceEditor adds "🏁 End Game Modal" fieldset. Also discovered SpaceInfoModal is orphaned dead code (no imports); deliberately skipped. 17/17 EndGameModal tests pass. (Apr 10, 2026)
- ✅ Per-action modal editor Phase 3 — NegotiationModal honors ModalConfig overrides keyed by `space|visit|negotiate`. Custom title replaces step header, description replaces "Select a player…" prompt, button label replaces "Make Offer". Supports `{playerName}`/`{partnerName}`/`{spaceName}`. SpaceEditor adds "🤝 Negotiation Modal" fieldset. Also fixed stale `currentPlayerId` closure that could leave the modal stuck in initialization. 8/8 NegotiationModal tests pass. (Apr 10, 2026)
- ✅ Per-action modal editor Phase 2 — ChoiceModal now honors ModalConfig overrides keyed by `space|visit|choice`. DataService exposes `getModalConfig()`, ChoiceModal interpolates `{playerName}`/`{spaceName}`, SpaceEditor adds "❓ Choice Modal" fieldset. 40+ tests pass. (Apr 10, 2026)
- ✅ Per-action modal editor Phase 1 — ModalConfig.csv data model, template interpolation, pipeline integration, editor UI with `+ modal config` expanders on card/cost actions. 13 files changed, 2 new. (Apr 9, 2026)
- ✅ BUG-001/002 root cause fix — WebSocket self-echo race condition. Server echo during HTTP POST round-trip could overwrite completedActions. Fix: pre-increment WS version before POST to suppress echo. Also fixed DiceResultEffect type union. (Apr 8, 2026)
- ✅ G148 playtest bug fixes — MovementExecutor error handling (BUG-006), deploy cache clear (BUG-003/005), manual action debug breadcrumbs (BUG-001/002), ghost player hardened (force=true removed, invariant fix, action-completion assertion, game-length heuristic), static CSV data integrity test (5 tests). (Apr 8, 2026)
- ✅ Ghost Player regression gate — headless bot plays 50 random games, catches silent breakages in any space/card/effect. Strict gate (zero exceptions, ≥90% wins) + space coverage gate (every GAME_CONFIG.csv space visited). (Apr 4, 2026)
- ✅ Beta Try Again semantics — money paid sticks, cards played stay consumed, money received reverts, cards drawn revert. L cards permanent. Cost ledger + 7 semantics tests + try-again-happy ghost variant. (Apr 5-6, 2026)
- ✅ Resume from side quest — PM-DECISION-CHECK now offers destinations from the main-path space where the player detoured, so they can skip back to where they left off instead of redoing completed phases. CHEAT-BYPASS disables this (point of no return). 8 new tests. (Apr 3, 2026)
- ✅ Console.log cleanup — 203 console.log/warn calls replaced with debug-gated `debugLog`/`debugWarn` across 30 files; suppressed in production, enable via `?debug=true` or `localStorage` (Apr 3, 2026)
- ✅ Remove TEST cards from production — TEST001-TEST006 test artifacts removed from CARDS_EXPANDED.csv (Apr 3, 2026)
- ✅ Progress Bar Financial Overview — stacked funding bar (owner/bank/investor) vs scope, spent overlay, funding gap indicator, compact summary in collapsed mode (Apr 3, 2026)
- ✅ Scope-zero guard — players cannot leave OWNER-SCOPE-INITIATION without W cards (Apr 3, 2026)
- ✅ WebSocket authentication + schema validation — game token auth on WS/HTTP, state structure validation (Apr 2, 2026)
- ✅ Fix modal exit animations — modals pass computed `isOpen` to ModalBase instead of early-returning null; 9 modals fixed (Apr 2, 2026)
- ✅ April 2026 audit fixes — process.stderr crash, admin rate limiting, non-root Docker, NTFY exposure, .gitignore, config URL (Apr 2, 2026)
- ✅ Phase 3 Animation Polish — ModalBase migrated to framer-motion, exit animations, prefers-reduced-motion support (Apr 1, 2026)
- ✅ Phase 2 Per-Action Narrative — `narrative` column in SPACE_EFFECTS, NarrativeBlock component, 3 modals updated, editor narrative textareas (Apr 1, 2026)
- ✅ Phase 1 Modal Standardization — data-driven shake & TTS via `shake_on`/`tts_field` columns, editor dropdowns, 4 modals updated, 20 new tests (Mar 31, 2026)
- ✅ Code audit recommendations — all items resolved: `parseUtils.ts` (8 shared utilities), `fee_type` column in SPACE_EFFECTS.csv, 3 metadata columns in DICE_EFFECTS.csv, 62 new tests (Mar 31, 2026)
- ✅ Affordability checks on all money paths + Try Again button gated by can_negotiate (Mar 31, 2026)
- ✅ Fix phantom space CON-SAFETY-BRIEF — test artifact in DICE_OUTCOMES.csv replaced with CON-INSPECT (Mar 31, 2026)
- ✅ Bug report fixes: "Start Game" button, Fee vs Fees editor differentiation, feedback PATCH API, scope bug diagnostic logging (Mar 30, 2026)
- ✅ Fix Try Again/Negotiate: pay-and-wait model (shouldAdvanceTurn), updateActionCounts in clearTurnActions/discardTempState, regression test (Mar 30, 2026)

*For full history, see CHANGELOG.md*

---

## 🐛 **G148 Playtest Bug Fixes** (April 2026)
*Source: Full playthrough bug report — 6 bugs found, 2 critical. See `docs/user/bug_report.docx`*

### Critical — Game-Breaking
- [x] **BUG-005/006: Stale CON-SAFETY-BRIEF data on live server** — deploy.sh now clears editor cache before build. (Apr 8, 2026)
- [x] **BUG-006: MovementExecutor silent failure** — both failure paths now log console.error and surface error toast to player. (Apr 8, 2026)

### High — Blocks Gameplay Flow
- [x] **BUG-001/002: Manual action completion not registering** — Root cause: WebSocket self-echo race condition. Server broadcasts state_update to ALL clients (including sender) after HTTP POST. The echo arrives before the HTTP response, overwrites local state that already has the completedAction set. Fix: pre-increment WS known version before HTTP POST so echo is rejected (V+1 > V+1 = false). Debug breadcrumbs also added for future diagnosis. (Apr 8, 2026)
- [x] **BUG-003: CON-ISSUES loop trap** — Deploy with cache clear fixes this. (Apr 8, 2026)

### Medium — Game Balance
- [x] **BUG-004: Winning path dice odds too low** — CON-INSPECT Subsequent gives 83% (dice 1-5), First 50% is intentional design choice. Closed per creator approval. (Apr 8, 2026)

### Ghost Player Hardening (prevent future blind spots)
- [x] **Remove `force=true` from ghost `endTurnWithMovement`** — ghost now fails when actions aren't completed. (Apr 8, 2026)
- [x] **Fix invariant check truthy bug** — now checks `effects.length === 0 && !movement`. (Apr 8, 2026)
- [x] **Add static CSV data validation test** — 5 tests verify GAME_CONFIG↔MOVEMENT↔DICE_OUTCOMES cross-references. (Apr 8, 2026)
- [x] **Add action-completion assertion to ghost** — asserts `completedActionCount === requiredActions` before ending turn. (Apr 8, 2026)
- [x] **Add game-length heuristic to ghost** — flags games >60 turns as suspicious. (Apr 8, 2026)
- [x] **Replace 5ms setTimeout hack** — replaced with polling loop + 10s Promise.race timeout. (Apr 8, 2026)

---

## 📱 **External Testing & Public Release**
*Reframed April 30, 2026 — the prior "Phase 3B / Phase 5 NOT STARTED" framing was misleading because the game has been live at https://game.unravelcodes.com since December 2025. The items below are what's still genuinely open.*

### G148 playthrough (April 2026) — closed
- [x] Bug report processed; all 6 bugs (4 critical, 2 medium) fixed in v2.41.0–v2.41.1.

### Open
- [ ] **Recruit 3–5 external players** for a structured UAT pass against v2.58.0 (now that Workstream 6 is closed). Prior internal/playtest UAT happened informally; this is the structured one.
- [ ] **Compile post-Beta feedback report** — currently no rolling channel for player-reported issues other than the in-app feedback button. Decide if the existing `/api/feedback` flow is enough or if we need a triage cadence.
- [ ] **Bug-fix sprint after structured UAT** — placeholder for whatever surfaces.

---

## 🧹 **Code Audit Recommendations** (March 2026)
*Source: External code audit — high professional quality overall, three risk areas identified*

### 1. Structured CSV columns over parsed text (High Priority)
- [x] Audit all regex-parsing of description text for game logic — 44 operations found across 14 files (Mar 23, 2026)
- [x] Phase 1: CARDS_EXPANDED.csv — added 8 structured columns (card_mechanic, dice ranges, investor_payout), updated EffectFactory + CardService (Mar 23, 2026)
- [x] Phase 2: SPACE_EFFECTS.csv — added `fee_type` column (LOAN_PERCENTAGE, FIXED, DICE_BASED) (Mar 31, 2026)
- [x] Phase 3: DICE_EFFECTS.csv — added `roll_action`, `roll_is_percentage`, `roll_numeric_only` metadata columns (Mar 31, 2026)
- [x] Encapsulate remaining regex — created `src/utils/parseUtils.ts` with 8 reusable utilities, 43 tests (Mar 31, 2026)

### 2. TurnService decomposition (Medium Priority)
- [x] Extract TurnTransitionHandler from `nextPlayer()` — 136 → 27 lines (Mar 23, 2026)
- [x] Extract MovementExecutor from `endTurnWithMovement()` — 153 → ~70 lines (Mar 23, 2026)
- [x] TurnService reduced from 2,148 → 1,984 lines (Mar 23, 2026)
- [x] Stress test MovementExecutor edge cases — 19 tests covering dice/intent/auto-move/edge cases (Mar 31, 2026)

### 3. Dead code cleanup (Medium Priority)
- [x] Remove `PlayerPanel.tsx`, `NextStepButton.tsx`, `PlayerStatusPanel.tsx`, `PlayerStatusItem.tsx`, `TurnControlsWithActions.tsx` and their tests (Mar 22, 2026)
- [x] Deleted MobilePlayerPanel (21 files), CardPortfolioDashboard, MovementPathVisualization, FinancialStatusDisplay, DiceRoller, PlayerViewStateService + 5 test files (Mar 23, 2026)
- [x] Removed dead placeholder UI in GameLayout.tsx (Mar 23, 2026)

---

## 🔬 **April 2026 Deficiency Review — Forward Plan**
*Source: Consolidated review (Apr 16, 2026). Tier 1 shipped in v2.47.1. Tiers 2–5 remain.*

### Tier 2 — TypeScript rigor (small but cascading)
- [x] **Resolve 30 pre-existing typecheck errors** — shipped in v2.47.2 (Apr 17, 2026). `npm run typecheck` returns 0 errors. See CHANGELOG.
- [x] **Fix `tsconfig.json` tests include/exclude duplication** (v2.59.0, May 2026) — Removed `tests/**/*` from `exclude`. Surfaced 379 latent type errors and fixed them across ~30 test files. Tests are now genuinely typechecked. See CHANGELOG v2.59.0 for the full pattern list.

### Tier 3 — DI graph cleanup (revised Apr 17, 2026)
*Original framing was "split every service > 600 lines + eliminate all setter injection." Revised after an April 17 audit determined both targets were largely cosmetic. See `docs/core/BETA_PLAN_V3.md` Workstream 4 for the full rationale. **Do not resurrect the 600-line target.***
- [x] **Kill false-cycle setter-injection sites** — shipped in v2.48.0 (Apr 17, 2026). See CHANGELOG.
- [x] **Investigate `EffectEngineService.setNegotiationService`** — confirmed dead code; entire effect-engine negotiation pathway removed in v2.48.1 (Apr 18, 2026). See CHANGELOG.
- [ ] **Service decomposition — deferred pending concrete pain signal.** TurnService (2,076 lines), StateService (1,867), CardService (1,824), EffectEngineService (1,477), MovementService (1,078), PlayerSetup.tsx (1,126), GameLayout.tsx (1,022) are all large but stable. Do not split on size alone. Split only when (a) a specific method becomes painful to edit, (b) a bug hot-spot clusters in a specific region per `git blame`, or (c) AI context cost on a specific workflow becomes a documented problem.

### Tier 4 — Type safety pass
- [x] **Bucket B — effect/payload shape narrowing (28 sites)** — shipped in v2.48.2 (Apr 18, 2026). See CHANGELOG.
- [x] **Bucket C — CardService card params (10 sites + 1 dead branch removed)** — shipped in v2.48.3 (Apr 18, 2026). See CHANGELOG.
- [x] **Bucket D — service-surface API narrowing (12 sites)** — shipped in v2.48.4 (Apr 18, 2026). See CHANGELOG.
- [ ] **Bucket E — intentional / leave as-is (~15 sites).** `error: any` catch blocks (5× — idiomatic, TS lets you throw anything), `consoleCapture args: any[]` (matches native console signature), `EffectFactory.validateCard(card: any)` (type guard input is supposed to be loose), `(window as any).opera` (legacy browser check), `configCache as any[mode]` (dynamic index access), `ChoiceService reject: (reason: any)` (Promise reject standard), `StateTypes details?: Record<string, any>` open-bag metadata, `DataTypes.effectData: any` (deferred payload union), 2× `null as any` in TurnStateManager TEMP state clearing. **Documented as intentional. Not blocked on typecheck.**

### Tier 5 — Remaining Beta workstreams (blocking v3.0.0 ship)
- [ ] **Workstream 3: Living Map / coordinate board** (per `docs/core/BETA_PLAN_V3.md`). NOT STARTED — Spaces.csv has no `pos_x`/`pos_y` columns; BoardV3 still uses computed grid layout.
- [ ] **Workstream 5: Live Dictionary integration** (per BETA_PLAN_V3). NOT STARTED — `TextWithTerms` still uses static glossary; no `dictionary-scraper` fetch on startup.
- [ ] **Workstream 2 ship gap: snapshot Try Again must replace REAL/TEMP entirely** per BETA_PLAN_V3 success criterion. Currently REAL/TEMP coexists with `TurnCostLedger`; v3.0.0 criterion is technically unmet. Decide: tighten the criterion (current implementation is good enough), or do the replacement.

---

## 🛠️ **Workflow & Deployment DX** (Backlog — STALLED)
*Flagged April 30, 2026: these 5 items have sat un-picked since they were added. They're nice-to-have but nothing blocks them. Decision needed: pick up, drop, or accept as standing low-priority.*

### Deployment Automation
- [ ] **Backend Version Logging** — Update `server/server.js` to log `process.env.VITE_GIT_COMMIT` on startup for instant verification via `docker logs`.
- [ ] **Sync Status Utility** — Create `scripts/check-sync.sh` to compare local commit vs remote commit vs live site version.
- [ ] **Webhook Deployment** — Set up a webhook receiver on Unraid to trigger `deploy.sh` via HTTP, enabling "push-to-deploy" from GitHub or local CLI.
- [ ] **Persistence Protection** — Verify `deploy.sh` backup/restore logic for `game-data/` works correctly with Docker volumes.

### Context Management
- [ ] **GEMINI.md setup** — Create project-level `GEMINI.md` with explicit server paths (`/mnt/user/appdata/Game_alpha/`) and SSH commands to minimize research turns.

---

## 🎨 **UI Improvements**

### Progress Bar — Financial Overview ✅
- [x] Add money breakdown visualization to progress bar area (Apr 3, 2026)
  - Total scope as bar background, stacked owner/bank/investor segments
  - Spent overlay, funding gap indicator, compact collapsed summary

---

## 🔒 **April 2026 Code Audit — Completed**
*Source: External code audit (April 2026) — 437 files reviewed*

### Security & Logic ✅
- [x] WebSocket authentication — game token generated on creation, validated on WS connect and HTTP state endpoints (Apr 2, 2026)
- [x] WebSocket state_push schema validation — validates top-level state structure (players, gamePhase, etc.) on both WS and HTTP push (Apr 2, 2026)
- [x] Consolidate money formatting — FinancesSection, ProjectLedger, CardDisplay, buttonFormatting, ErrorNotifications now use `FormatUtils.formatMoney()` (Apr 2, 2026)
- [x] MovementExecutor.ts `process.stderr.write()` → `console.error()` crash fix (Apr 2, 2026)
- [x] Admin rate limiting (5 attempts per 15 min) on `/api/admin/verify` (Apr 2, 2026)
- [x] Docker hardening (Reverted non-root user due to volume issues; other hardening active) (Apr 2, 2026)
- [x] Modal exit animations visible (fb1, Apr 2, 2026)

### Accessibility & Types ✅
- [x] Fix interactive `<div onClick>` → `<button>` in ProjectLedger.tsx (Apr 2, 2026)
- [x] Replace `any` types in EffectTypes.ts and ServiceContracts.ts (Apr 2, 2026)

---

## 🚀 **Deployment Status**
- **Production URL**: `https://game.unravelcodes.com` (Port 3080 on Unraid)
- **Current Version**: v2.63.1
- **Last Deploy**: see git log / `docker logs game_alpha` for live build
- **Status**: Stable

---

## 📝 **Remaining Backlog**

### High Priority
- [x] Per-action modal editor — **COMPLETE.** Phase 1 (v2.42.0, card/cost actions), Phase 2 (v2.43.0, ChoiceModal), Phase 3 (v2.44.0, NegotiationModal), Phase 3b (v2.45.0, EndGameModal), Phase 4 (v2.46.0, per-dice-value DiceResultModal), Phase 5 (v2.47.0, context-aware editor hints). See CHANGELOG.md for per-phase details.
- [x] Delete dead-code `src/components/modals/SpaceInfoModal.tsx` — removed in v2.47.0 after full test suite (1520 passed, 4 skipped) confirmed nothing depended on it. Stale comment in `NarrativeBlock.tsx` also cleaned up. (Apr 10, 2026)
