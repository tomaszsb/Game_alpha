# TODO - Game Alpha

**Last Updated:** March 24, 2026
**Status:** Pre-Beta — Editor hardening
**Current Version:** 2.34.2

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
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
