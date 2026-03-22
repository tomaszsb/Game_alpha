# TODO - Game Alpha

**Last Updated:** March 22, 2026
**Status:** Pre-Beta — Editor hardening
**Current Version:** 2.33.4

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
- ✅ Space Data Editor: card button labels (5 new CSV columns), title in header, path in movement section, negotiate-based preview, 27 regression tests (Mar 18, 2026)
- ✅ BoardV3 production migration: pre-allocated 190px slots, SVG arrow system with obstacle avoidance, data-driven path from CSV, 83 unit tests, replaces ProgressBarMap (Mar 16, 2026)
- ✅ Snake Map fixed-width slot grid: calculated fork lines, fixed-height branches, u-turn via spacer/entry extensions, 3 tile states (compact/hover/expanded), phase groups, adaptive row splitting (Mar 3, 2026)

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
- [ ] Audit all regex-parsing of description text for game logic (e.g., L card dice conditions were parsed from "Draw 1 if you roll a 3" — now fixed with `dice_roll_N` condition column)
- [ ] Identify remaining cases where EffectFactory parses free-text strings for rules
- [ ] Add dedicated CSV columns for any logic currently embedded in descriptions

### 2. TurnService decomposition (Medium Priority)
- [ ] Extract more logic from TurnService (84KB) into focused sub-handlers
- [ ] Follow the pattern already established with CardEffectHandler, SpaceArrivalProcessor
- [ ] Keep TurnService as an orchestrator, not an implementor

### 3. Dead code cleanup (Medium Priority)
- [x] Remove `PlayerPanel.tsx`, `NextStepButton.tsx`, `PlayerStatusPanel.tsx`, `PlayerStatusItem.tsx`, `TurnControlsWithActions.tsx` and their tests (Mar 22, 2026)
- [ ] Review `MobilePlayerPanel.tsx` — currently unused but may inform future mobile work
- [ ] Audit for other unused components/services

---

## 🧹 **Snake Map Cleanup** (after snake map is finalized)

### Dead imports in GameLayout.tsx
- [ ] Remove unused `GameBoard` import (line 14) — `<GameBoard>` is never rendered
- [ ] Remove unused `MovementPathVisualization` import (line 16) — never rendered
- [ ] Remove static placeholder center panel (lines 861-906) — "Game board will be displayed here" dead UI

### GameBoard.tsx — keep file for TVDisplay, but clean up
- [ ] Remove `validMoves` state — set but never read (`highlightedMoves` is what drives moves)
- [ ] Remove `console.log` debug statements (lines 244, 246)

### ProgressBarMap.tsx + ProgressBarMap.css
- [ ] Delete both files — `<ProgressBarMap>` is never rendered anywhere, fully replaced by BoardV3

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
