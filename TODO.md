# TODO - Game Alpha

**Last Updated:** April 7, 2026
**Status:** Beta — regression gates in place
**Current Version:** 2.41.1

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
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
- [ ] **BUG-004: Winning path dice odds too low** — CON-INSPECT First gives 50% chance of REG-DOB-FINAL-REVIEW; **Subsequent already gives 83%** (dice 1-5). First visit low odds are a design choice — only Subsequent matters for loop escapes. ✅ Already acceptable, can close if creator agrees.

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
- [ ] Editor UX for per-action narrative — make "+ narrative" expander more discoverable
