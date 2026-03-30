# TODO - Game Alpha

**Last Updated:** March 29, 2026
**Status:** Pre-Beta — Editor hardening
**Current Version:** 2.36.2

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
- ✅ Block useless time-reduction cards when timeSpent=0, expand glossary highlighting to 7 more components (Mar 29, 2026)
- ✅ Centralize UI strings — `src/constants/uiStrings.ts` shared by source + tests, fixed 57 stale test failures, 6 test files updated (Mar 29, 2026)
- ✅ Fix card replacement spinner, duplicate Expeditor tab buttons, Try Again choice leak — 3 bug fixes, 5 new/updated tests (Mar 29, 2026)
- ✅ `roll_group` column for independent dice rolls — editor field, data pipeline, processing logic, 7 new tests (Mar 29, 2026)
- ✅ Real-world language — removed "card", "dice", "roll", "play", "draw", "discard" from all player-facing UI across 20 files (Mar 25, 2026)
- ✅ Unified card selection modals — return/replace/give all use CardReplacementModal with card artwork and details (Mar 25, 2026)
- ✅ Fix card return/replace/give modals — processGameData mapped all card actions to draw_E, 11 spaces affected, 7 new pipeline tests (Mar 25, 2026)
- ✅ Glossary highlighting fix (TextWithTerms race condition), Quick Stats row removed, End Turn subtitle black text, 5 new tests + 20 fixed tests (Mar 25, 2026)
- ✅ ProjectLedger data model rework: new Scope section, contractor costs from dice rolls, separated arch/eng fees, deficit indicator, reordered categories (Mar 24, 2026)
- ✅ Code Audit Sprint: dead code cleanup (37 files), TurnService decomposition (2 new handlers), structured CSV columns (8 new CARDS_EXPANDED columns replacing regex parsing) (Mar 23, 2026)
- ✅ Space Data Editor: card button labels (5 new CSV columns), title in header, path in movement section, negotiate-based preview, 27 regression tests (Mar 18, 2026)
- ✅ BoardV3 production migration: pre-allocated 190px slots, SVG arrow system with obstacle avoidance, data-driven path from CSV, 83 unit tests, replaces ProgressBarMap (Mar 16, 2026)

*For full history, see CHANGELOG.md*

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
- [ ] Phase 2: SPACE_EFFECTS.csv — add `fee_type` column, structured `card_action`/`card_count` (requires processGameData.js changes)
- [ ] Phase 3: DICE_EFFECTS.csv — structured roll columns (low priority, current parsing works well)
- [ ] Encapsulate remaining regex in EffectFactory/CardService into reusable utility functions with tests

### 2. TurnService decomposition (Medium Priority)
- [x] Extract TurnTransitionHandler from `nextPlayer()` — 136 → 27 lines (Mar 23, 2026)
- [x] Extract MovementExecutor from `endTurnWithMovement()` — 153 → ~70 lines (Mar 23, 2026)
- [x] TurnService reduced from 2,148 → 1,984 lines (Mar 23, 2026)
- [ ] Stress test MovementExecutor edge cases (multi-path intersections)

### 3. Dead code cleanup (Medium Priority)
- [x] Remove `PlayerPanel.tsx`, `NextStepButton.tsx`, `PlayerStatusPanel.tsx`, `PlayerStatusItem.tsx`, `TurnControlsWithActions.tsx` and their tests (Mar 22, 2026)
- [x] Deleted MobilePlayerPanel (21 files), CardPortfolioDashboard, MovementPathVisualization, FinancialStatusDisplay, DiceRoller, PlayerViewStateService + 5 test files (Mar 23, 2026)
- [x] Removed dead placeholder UI in GameLayout.tsx (Mar 23, 2026)

---

## 🧹 **Snake Map Cleanup** (after snake map is finalized)

### Dead imports in GameLayout.tsx
- [x] Removed unused `GameBoard` and `MovementPathVisualization` imports (Mar 22, 2026)
- [x] Removed static placeholder center panel and player panel placeholder (Mar 23, 2026)

### GameBoard.tsx — keep file for TVDisplay, but clean up
- [x] Removed unused `validMoves` state and debug console.logs (Mar 22, 2026)

### ProgressBarMap.tsx + ProgressBarMap.css
- [x] Deleted both files and unused import in GameLayout — fully replaced by BoardV3 (Mar 22, 2026)

---
## plan to fix negotiate button

Here is the comprehensive summary of our research, the evolution of our understanding, and the final technical plan to resolve the "Try Again/Negotiate" and movement issues.

  1. The Research Process: What We Found
  We started by tracing the history of the "Try Again" button through the CHANGELOG.md and the core service files (TurnService.ts, StateService.ts, ActionCenterPanel.tsx).

  Key Findings:
   * Service vs. UI Disconnect: The UI was showing the button based on "any completed action," but the backend service was hard-coded to reject the action unless the space was explicitly marked
     can_negotiate=true.
   * State De-sync: When a turn was reset via "Try Again," the StateService reverted money and cards but failed to trigger a recalculation of "Required Actions." This left the "End Turn" button enabled
     incorrectly.
   * Premature Movement: On multi-path spaces, the code was resolving the "Movement Choice" as soon as a destination was clicked, instead of waiting for the player to click the "End Turn" (CSV-labeled) button.

  ---

  2. Correcting Assumptions
  During our discussion, we pivoted on several key architectural points to align with your vision:

   * Turn Flow (The "Wait" Rule):
       * Initial Assumption: I thought "Try Again" let you stay on the space and retry immediately.
       * Correction: You clarified that "Try Again" must apply the penalty and immediately end the turn, forcing the player to wait for the next round to try that space again.
   * Visit Type Preservation:
       * Initial Assumption: I thought "Try Again" might always reset to a "First Visit."
       * Correction: You clarified that if the original attempt was a Subsequent Visit, the retry must also be a Subsequent Visit. The history must be reverted exactly to the state before that specific attempt
         began.
   * Button Labels:
       * Initial Assumption: I suggested dynamic labels like "Confirm Move."
       * Correction: You clarified that we must strictly use the labels defined in the CSV (via the Space Editor), as those are the "source of truth." We only need to fix the timing of the movement logic.

  ---

  3. Detailed Fix Plan

  Step 1: Turn Service Logic (The "Pay-and-Wait" Model)
   * Update TurnService.tryAgainOnSpace to set shouldAdvanceTurn: true.
   * In the "Try Again" flow, before advancing the turn, I will modify the player's visitedSpaces and spaceVisitLog to remove the entry for the current space. This ensures the next round's arrival is processed
     with the correct visit type (preserving First/Subsequent status).

  Step 2: Movement Timing (The "Confirm" Rule)
   * Modify the interaction between ActionCenterPanel and TurnService.
   * When a player selects a destination on a multi-path space, it will only update the moveIntent state.
   * The actual movePlayer and endTurnWithMovement calls will be restricted to the "End Turn" (CSV-labeled) button click. I will disable any "Auto-resolve" logic in the MovementService.

  Step 3: State Synchronization (The "UI Refresh" Rule)
   * Modify StateService.ts to call updateActionCounts() inside the clearTurnActions and discardTempState methods.
   * This ensures that as soon as "Try Again" is clicked, the game state recognizes that 0 actions are now complete, correctly disabling the "End Turn" button for that player before the turn advances.

  Step 4: Regression Prevention (The "Validation" Rule)
  I will implement a new test suite, tests/regression/TryAgainVisitType.test.ts, which will:
   1. Verify that "Try Again" on a Subsequent Visit results in a Subsequent Visit next round.
   2. Verify that selecting a destination does not change the player's coordinates until the final button is clicked.
   3. Verify that the "Try Again" button ends the turn and applies the time penalty to the player's persistent state.
## 🔮 **FUTURE: Nice-to-Have Improvements**

### Mobile & PWA
- [ ] App icons (192x192, 512x512) for PWA install
- [ ] Offline support / Service Worker (for poor WiFi venues)
- [ ] Screen orientation lock
- [ ] Skeleton loaders for slow networks
- [ ] Replace emoji icons with icon library (Lucide/Heroicons)

### Testing
- [ ] Mobile device testing with Playwright emulation
- [ ] Performance monitoring (TTI, FCP, CLS)
- [ ] Real device testing (iPhone SE, Galaxy, budget Android)
- [ ] Network throttling tests (Slow 3G)

### Native App (Long-term)
- [ ] Evaluate Capacitor for wrapping React app in native shell

---

## 📚 **Reference**

- **Completed work:** See `CHANGELOG.md`
- **Project overview:** See `docs/core/PRODUCT_CHARTER.md`
- **Current status:** See `docs/core/PROJECT_STATUS.md`
- **Technical debt:** See `docs/technical/TECHNICAL_DEBT.md`
