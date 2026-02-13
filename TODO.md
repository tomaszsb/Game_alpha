# TODO - Game Alpha

**Last Updated:** February 12, 2026
**Status:** Production Ready - External Testing In Progress
**Current Version:** 2.28.0

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Recently Completed:**
- ✅ Data Editor input helpers, add/delete spaces, baseline reset, smart dice roll inputs (Feb 12, 2026)
- ✅ Live Save for Data Editor — server-side save + JS data processing (Feb 12, 2026)
- ✅ Data Editor visual redesign with player preview panel (Feb 10, 2026)
- ✅ Narrative UX — dice modals, friendly card names, context-sensitive labels (Feb 10, 2026)
- ✅ Merged Landing + Lobby into single 3-panel screen (Feb 10, 2026)
- ✅ Feedback reports with console logs & game state snapshot (Feb 9, 2026)
- ✅ Card tab redistribution, TV mode Rules, dice roll fixes (Feb 9, 2026)
- ✅ Fullscreen toggle, Pull-to-Refresh, Game Board Zoom/Pan (Feb 8, 2026)
- ✅ Floating Bug Report button with screenshot capture (Feb 8, 2026)

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

## 🚀 **PHASE 4: Release Preparation** (2-3 days)
*Status: NOT STARTED*

### 4A: Final Code Review (1 day)
- [ ] Verify no debug code remains
- [ ] Remove console.log statements
- [ ] Check for hardcoded values/URLs
- [ ] Security audit for sensitive data
- [ ] Final TypeScript check: `npm run typecheck`

### 4B: Production Build & Deployment (1 day)
- [ ] Test production build locally
- [ ] Configure environment variables
- [ ] Verify deployment scripts

### 4C: Final Documentation (1 day)
- [ ] Review all documentation for accuracy
- [ ] Write comprehensive final release notes
- [ ] Create launch announcement

---

## 🎉 **PHASE 5: Public Release** (Launch Day)
*Status: NOT STARTED*

- [ ] Deploy to production server
- [ ] Verify all systems operational
- [ ] Test from multiple devices
- [ ] Monitor for critical issues (first 24 hours)
- [ ] Announce release

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

### Dictionary Integration
- [ ] Remote term data from dashboard API (instead of local `terms.ts`)

### Native App (Long-term)
- [ ] Evaluate Capacitor for wrapping React app in native shell

---

## 📚 **Reference**

- **Completed work:** See `CHANGELOG.md`
- **Project overview:** See `docs/core/PRODUCT_CHARTER.md`
- **Current status:** See `docs/core/PROJECT_STATUS.md`
- **Technical debt:** See `docs/technical/TECHNICAL_DEBT.md`
