# TODO - Game Alpha

**Last Updated:** March 10, 2026
**Status:** Pre-Beta — Codebase audit cleanup complete
**Current Version:** 2.31.0

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
- ✅ Snake Map fixed-width slot grid: calculated fork lines, fixed-height branches, u-turn via spacer/entry extensions, 3 tile states (compact/hover/expanded), phase groups, adaptive row splitting (Mar 3, 2026)
- ✅ UI Enhancements: Glossary button, active indicators, back-button modal close, TV same-tab navigation (Feb 28, 2026)
- ✅ NPC Character Identity System: random portraits for 9 NPC roles, shown in story/modals/board tiles, separate PM Action section (Feb 28, 2026)
- ✅ Data sync fix: SOURCE_FILES and CLEAN_FILES now in sync — editor edits properly flow to game (Feb 28, 2026)
- ✅ Docker hardening: isolated network, read-only fs, cap-drop ALL, no-new-privileges (Feb 24, 2026)
- ✅ Character voice narration Phase 1: 6 character voices, speech controls, character badges (Feb 22, 2026)
- ✅ Security hardening: CORS, headers, path traversal fix, debug endpoint auth (Feb 13, 2026)
- ✅ Production cleanup: 586 console.log statements removed, source maps disabled (Feb 12, 2026)
- ✅ TypeScript check clean, full test suite passing (1316 tests, 0 failures) (Feb 13, 2026)
- ✅ Data Editor input helpers, add/delete spaces, baseline reset, smart dice roll inputs (Feb 12, 2026)

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

## 🚀 **PHASE 4: Release Preparation** ✅ COMPLETE
*Completed: February 13, 2026*

- ✅ 586 console.log statements removed from 16 files
- ✅ Security audit: CORS restricted, security headers added, path traversal fixed, debug endpoints locked, error messages sanitized, source maps disabled
- ✅ TypeScript strict check passes clean
- ✅ Production build verified, deployed
- ✅ 1316 tests passing (88 files, 0 failures)
- ✅ Documentation updated

---

## 🎉 **PHASE 5: Public Release** (Launch Day)
*Status: NOT STARTED*

- [ ] Deploy to production server
- [ ] Verify all systems operational
- [ ] Test from multiple devices
- [ ] Monitor for critical issues (first 24 hours)
- [ ] Announce release

---

## 🧹 **Snake Map Cleanup** (after snake map is finalized)

### Dead imports in GameLayout.tsx
- [ ] Remove unused `GameBoard` import (line 14) — `<GameBoard>` is never rendered
- [ ] Remove unused `MovementPathVisualization` import (line 16) — never rendered
- [ ] Remove static placeholder center panel (lines 861-906) — "Game board will be displayed here" dead UI

### GameBoard.tsx — keep file for TVDisplay, but clean up
- [ ] Remove `validMoves` state — set but never read (`highlightedMoves` is what drives moves)
- [ ] Remove `console.log` debug statements (lines 244, 246)

### ProgressBarMap.tsx
- [ ] Simplify `PHASE_COLORS` — `bg` and `text` fields are never used, only `border`
- [ ] Replace `motion.div` + `springTransition` with plain `<div>` — path is hardcoded/static, layout animations add overhead for no visual benefit

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

### Dictionary Integration ✅ (Feb 13, 2026)
- [x] Switch `loadTerms()` to fetch from dashboard API (`GET /api/glossary/live`) with CSV fallback
- [x] Verify `GlossaryTerm` JSON shape matches game's interface
- [x] Confirm `dictionaryBridge.ts` URL pattern still works

### Native App (Long-term)
- [ ] Evaluate Capacitor for wrapping React app in native shell

---

## 📚 **Reference**

- **Completed work:** See `CHANGELOG.md`
- **Project overview:** See `docs/core/PRODUCT_CHARTER.md`
- **Current status:** See `docs/core/PROJECT_STATUS.md`
- **Technical debt:** See `docs/technical/TECHNICAL_DEBT.md`
