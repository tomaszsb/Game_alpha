# TODO - Game Alpha

**Last Updated:** April 7, 2026
**Status:** Beta — regression gates in place
**Current Version:** 2.41.0

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
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
- [ ] **BUG-005/006: Stale CON-SAFETY-BRIEF data on live server** — local CSVs were fixed (Mar 31) but the editor's writable volume on the server still has old data referencing CON-SAFETY-BRIEF. Fix: clear the editor volume (`docker exec game_alpha rm -rf /app/data/game-data && docker restart game_alpha`) and redeploy.
- [ ] **BUG-006: MovementExecutor silent failure** — when all 3 movement strategies fail, no error is surfaced. Player is stuck with no indication. Fix: after all strategies exhaust, log `console.error` with full context and surface a visible error toast. Consider a "Reset Position" escape hatch.

### High — Blocks Gameplay Flow
- [ ] **BUG-001/002: Manual action completion not registering** — "Return 1 E cards" (CON-INSPECT) and "Draw 3 E cards" (REG-DOB-FINAL-REVIEW) dialogs close but `completedActionCount` does not increment, leaving End Turn disabled. Code trace shows the backend path (TurnService→CardEffectService→ChoiceService→setPlayerCompletedManualAction) is correct. Root cause likely one of: (a) ChoiceModal `handleChoiceClick` encounters stale `awaitingChoice` from React state closure, (b) WebSocket `state_update` echo overwrites local `completedActions` between manual action completion and next render, (c) `resolveChoice` validation fails silently (card ID mismatch between `getPlayerCards` which includes activeCards vs `player.hand.filter` in CardReplacementModal). Fix: add `console.error` breadcrumbs to `resolveChoice` failure paths, `applySpaceCardEffect` wasActuallyCompleted=false path, and `triggerManualEffectWithFeedback` skipped-action path. Then reproduce with debug logging enabled to isolate the exact failure point.
- [ ] **BUG-003: CON-ISSUES loop trap** — CON-SAFETY-BRIEF replaced CON-INSPECT at CON-ISSUES dice outcomes. Local CSVs already fixed (Mar 31) — CON-INSPECT restored for dice 1-2 (First) and 1-4 (Subsequent). ✅ Data fix already in codebase, just needs deploy with cache clear.

### Medium — Game Balance
- [ ] **BUG-004: Winning path dice odds too low** — CON-INSPECT First gives 50% chance of REG-DOB-FINAL-REVIEW; **Subsequent already gives 83%** (dice 1-5). First visit low odds are a design choice — only Subsequent matters for loop escapes. ✅ Already acceptable, can close if creator agrees.

### Ghost Player Hardening (prevent future blind spots)
- [ ] **Remove `force=true` from ghost `endTurnWithMovement`** — ghost currently bypasses the required-actions check, masking manual action failures (root cause of missing BUG-001/002). Ghost should fail when actions aren't completed, just like a real player.
- [ ] **Fix invariant check truthy bug** — `ghostPlayer.ts:195` checks `!effects && !movement` but `getSpaceEffects()` returns `[]` (truthy) for unknown spaces. Fix: check `effects.length === 0 && !movement` instead.
- [ ] **Add static CSV data validation test** — verify every space in GAME_CONFIG.csv has a MOVEMENT.csv entry, and every dice-movement space has DICE_EFFECTS entries for all 6 rolls. Catch data gaps at test time, not at play time.
- [ ] **Add action-completion assertion to ghost** — after triggering manual effects, assert `completedActionCount === requiredActions` before ending the turn. If mismatch, report as invariant violation.
- [ ] **Add game-length heuristic to ghost** — flag games that take >60 turns as suspicious (possible loop trap). Not a hard failure, but log for review.
- [ ] **Replace 5ms setTimeout hack** — `ghostPlayer.ts:249` uses `setTimeout(r, 5)` to wait for async choices. Replace with a proper await or polling loop on `awaitingChoice`.

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
- **Current Version**: v2.39.4
- **Last Deploy**: April 3, 2026
- **Status**: Stable

---

## 📝 **Remaining Backlog**

### High Priority
- [ ] Editor UX for per-action narrative — make "+ narrative" expander more discoverable
