# TODO - Game Alpha

**Last Updated:** April 21, 2026
**Status:** Beta — regression gates in place
**Current Version:** 2.49.0

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
- ✅ Logic-tree movement restored at REG-FDNY-FEE-REVIEW (v2.49.0) — Fixes a v2.45-era pipeline regression that silently emitted `movement_type='choice'` for `path=LOGIC` rows, downgrading the 5-question yes/no decision chain to a flat picker. `processGameData.js` now routes `path=LOGIC` with priority and emits `'logic'`. New hand-authored `public/data/CLEAN_FILES/LOGIC_QUESTIONS.csv` drives the walker (space_name, visit_type, question_id, question_text, yes_target, no_target). `DataService` loads it; `MovementService.handleLogicMovement` asks yes/no questions via a new `LOGIC_QUESTION` choice type and resolves targets (Q-id recurse / single-space terminal / comma-split sub-choice). `ChoiceModal` renders "Question N of M" progress from metadata. Regression gates: `processGameData.test.ts` 14/14 (7 new) including real-data + integrity checks; `MovementService.test.ts` 47/47 (7 new walker branch tests). `npm run typecheck` 0 errors. (Apr 21, 2026)

### **Backlog**
- Story-as-composed-stories (v2.50.0) — Design locked (accordion landing modal Option C + italic lead-in per-action modal Option B). SPACE_EFFECTS.narrative already keyed per action; SPACE_CONTENT.story becomes the non-action flavor header ("Event" kept for teachers and action-less spaces). No CSV schema changes needed. Implementation + mockup → component wiring.

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

## 📱 **PHASE 3B: External Testing**
*Status: NOT STARTED*

### Tasks
- [ ] Recruit 3-5 external players
- [ ] Share game link: `https://game.unravelcodes.com`
- [ ] Run controlled gameplay sessions
- [ ] Gather feedback on:
  - [ ] Rules clarity and difficulty
  - [ ] UI/UX intuitiveness
  - [ ] Game balance
  - [ ] Performance and stability
  - [ ] Multi-device experience
- [ ] Compile feedback report

### Phase 3C: Bug Fix Sprint (after testing)
- [ ] Address critical bugs found during testing
- [ ] Fix balance issues if identified
- [ ] Minor UI adjustments based on feedback
- [ ] Re-test fixes

---

## 🎉 **PHASE 5: Public Release** (Launch Day)
*Status: NOT STARTED*

- [ ] Deploy to production server
- [ ] Verify all systems operational
- [ ] Test from multiple devices
- [ ] Monitor for critical issues (first 24 hours)
- [ ] Announce release

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
- [ ] **Resolve 30 pre-existing typecheck errors** — `npm run typecheck` currently fails with 30 errors across `CardEffectHandler.ts`, `LoggingService.ts`, `MovementExecutor.ts`, `NegotiationService.ts`, `TurnService.ts`, `ModalBase.tsx`, `boardLayout.ts`. Docs claim "100% strict mode" but it's not true. Fix before the `tests/**/*` tsconfig duplication is removed — otherwise both landmines detonate at once.
- [ ] **Fix `tsconfig.json` tests include/exclude duplication** — `tests/**/*` appears in both arrays; pick one. Removing from `exclude` means tests get typechecked (expect a wave of errors since `allowJs` is loose and tests were effectively untyped). Do this after Tier 2 step 1.

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

### Tier 5 — Remaining Beta workstreams
- [ ] **Workstream 3: Living Map / coordinate board** (per `docs/core/BETA_PLAN_V3.md`).
- [ ] **Workstream 5: Live Dictionary integration** (per BETA_PLAN_V3).

---

## 🛠️ **Workflow & Deployment DX** (Backlog)

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
- **Current Version**: v2.41.1
- **Last Deploy**: April 8, 2026
- **Status**: Stable

---

## 📝 **Remaining Backlog**

### High Priority
- [x] Per-action modal editor — **COMPLETE.** Phase 1 (v2.42.0, card/cost actions), Phase 2 (v2.43.0, ChoiceModal), Phase 3 (v2.44.0, NegotiationModal), Phase 3b (v2.45.0, EndGameModal), Phase 4 (v2.46.0, per-dice-value DiceResultModal), Phase 5 (v2.47.0, context-aware editor hints). See CHANGELOG.md for per-phase details.
- [x] Delete dead-code `src/components/modals/SpaceInfoModal.tsx` — removed in v2.47.0 after full test suite (1520 passed, 4 skipped) confirmed nothing depended on it. Stale comment in `NarrativeBlock.tsx` also cleaned up. (Apr 10, 2026)
