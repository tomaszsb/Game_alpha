# TODO - Game Alpha

**Last Updated:** December 14, 2025
**Status:** Production Ready - UAT Pending

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md`
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---

## 🎯 **Current Priority: User Acceptance Testing**

**Target Release:** December 2025
**Next Milestone:** UAT Completion (Dec 10-15)

### **Recently Completed:**
- ✅ TypeScript Strict Mode (Nov 30) - 0 errors
- ✅ Technical Debt Cleanup (Dec 6) - 11 issues resolved
- ✅ UI Documentation (Nov 30) - 1,500+ lines
- ✅ Documentation Consolidation (Dec 9) - 36→15 files

---

## 📱 **PHASE 3: User Acceptance Testing** (1-2 weeks)
*Status: IN PROGRESS - Internal Testing*
*Started: December 9, 2025*

### Objective
Validate gameplay, balance, and user experience with real players

### Tasks

**3A: Internal Testing** (2-3 days) - IN PROGRESS
- [x] Initial UAT with Perplexity AI (December 9) - **8.5/10 rating**
- [x] Test all card types and effects (W, B, E, L, I) - ✅ All working
- [x] Verify space mechanics - ✅ Choice system works
- [x] Document issues found - See findings below
- [ ] Complete full game playthrough (start to finish)
- [ ] Test multiplayer with 2-4 players
- [ ] Test multi-device functionality (QR codes, short URLs)

**UAT Findings (December 9, 2025):**
- ✅ **GOOD**: Core mechanics working well (8.5/10 rating → 9.5/10 after fixes)
- ✅ **GOOD**: Card system fully functional (W, E, L cards)
- ✅ **GOOD**: Strategic choices work (PM-DECISION-CHECK)
- ✅ **GOOD**: UI layout clear and intuitive
- ✅ **FIXED**: Space Explorer restored (ℹ️ icons on each space)
- ✅ **FIXED**: "Try Again" button tooltip added
- ✅ **FIXED**: Manual action button styling standardized
- ✅ **FIXED**: End Turn disabled bug at PM-DECISION-CHECK (3 root causes fixed)
- ✅ **FIXED**: Finances showing $0 (fixed via conditional funding - Dec 14)
- 📝 **NOTE**: Time consequences not visible (by design?)

**PM-DECISION-CHECK Bug Fix (December 9):**
- Root cause #1: CSV had `effect_action="draw_E"` → Fixed to `"replace_E"`
- Root cause #2: CSV had `effect_value="Replace 1"` → Fixed to `"1"`
- Root cause #3: Button formatting didn't handle `replace_` actions → Fixed
- Result: Button now shows "Replace 1 E card" correctly, End Turn enables after action

**Bug Fix Sprint (December 14) - ✅ COMPLETED:**
- ✅ **Bug #1**: Story text not showing on player panels
  - Root cause: StorySection using wrong ExpandableSection component (common/ vs player/)
  - Fix: Changed import from `../../common/ExpandableSection` to `../ExpandableSection`
- ✅ **Bug #2**: Drawing both B and I cards at OWNER-FUND-INITIATION
  - Root cause: Missing condition values in SPACE_EFFECTS.csv (empty conditions default to true)
  - Fix: Added `scope_le_4M` and `scope_gt_4M` conditions to draw_B and draw_I effects
  - Impact: Also fixed "Finances showing $0" issue from UAT findings
- ✅ **Bug #3**: Infinite loop causing "Maximum update depth exceeded"
  - Root cause: GameRulesService.evaluateCondition() updating projectScope every render
  - Fix: Added check to only update projectScope if value changed
- ✅ **Bug #4**: Space Explorer Panel crash on info button click
  - Root cause: GameBoard.getSpaceDetails() calling getValidMoves() with space name instead of player ID
  - Fix: Replaced with proper connection calculation logic iterating through spaces
- ✅ **Bug #5**: START-QUICK-PLAY-GUIDE showing on game board
  - Root cause: GameBoard filter only excluded Tutorial spaces, not instruction spaces
  - Fix: Added filter condition `config?.path_type !== 'none'`

**Regression Tests Added (December 14):**
- ✅ GameRulesService: 3 new tests for Bug #3 (infinite loop prevention)
- ✅ GameBoard: 8 new tests for Bugs #4 & #5 (NEW FILE: GameBoard.test.tsx)
- ✅ Bug #2 coverage: Multi-layered (unit tests + CSV tracking + manual verification)
- ✅ Test suite status: 90/90 tests passing
- ✅ All fixes user-verified and working correctly

**3B: External Testing** (5-7 days)
- [ ] Recruit 3-5 external players
- [ ] Run controlled gameplay sessions
- [ ] Gather feedback on:
  - [ ] Rules clarity and difficulty
  - [ ] UI/UX intuitiveness
  - [ ] Game balance (fair for all players)
  - [ ] Performance and stability
  - [ ] Multi-device experience
- [ ] Compile feedback report

**3C: Bug Fix Sprint** (1-2 days)
- [ ] Address critical bugs found during testing
- [ ] Fix balance issues if identified
- [ ] Minor UI adjustments based on feedback
- [ ] Re-test fixes
- [ ] Update CHANGELOG.md with fixes

### Success Criteria
- ✅ No critical bugs found
- ✅ Game completes successfully (start to win)
- ✅ All mechanics functioning correctly
- ✅ UI feedback positive from users
- ✅ Performance acceptable (no lag/hangs)

### Contingency
- If critical bugs: Add 2-3 day fix sprint
- If balance issues: Minor game rule adjustments
- If UI issues: Polish cycles until resolved

---

## 🚀 **PHASE 4: Release Preparation** (2-3 days)
*Status: NOT STARTED*
*Target: December 15-19, 2025*

### Objective
Prepare final release package and deployment

### Tasks

**4A: Final Code Review** (1 day)
- [ ] Code review all changes from UAT
- [ ] Verify no debug code remains
- [ ] Remove console.log statements
- [ ] Check for hardcoded values/URLs
- [ ] Security audit for sensitive data
- [ ] Final TypeScript check: `npm run typecheck`

**4B: Production Build & Deployment** (1 day)
- [ ] Build production version: `npm run build`
- [ ] Test production build locally
- [ ] Prepare deployment scripts
- [ ] Set up hosting environment
- [ ] Configure backend server for production
- [ ] Set environment variables (VITE_SERVER_URL, NODE_ENV)

**4C: Final Documentation** (1 day)
- [ ] Review all documentation for accuracy
- [ ] Write comprehensive final release notes
- [ ] Prepare deployment instructions
- [ ] Update version numbers
- [ ] Create launch announcement

### Success Criteria
- ✅ Production build complete and tested
- ✅ All documentation finalized
- ✅ No debug code in production
- ✅ Performance optimized
- ✅ Security reviewed

---

## 🎉 **PHASE 5: Public Release** (Launch Day)
*Status: NOT STARTED*
*Target: December 19-20, 2025*

### Launch Checklist
- [ ] Deploy to production server
- [ ] Verify all systems operational
- [ ] Test from multiple devices
- [ ] Monitor for critical issues (first 24 hours)
- [ ] Announce release
- [ ] Provide support channels

### Post-Launch Tasks
- [ ] Monitor user feedback
- [ ] Address critical bugs within 24-48 hours
- [ ] Plan first patch/update based on feedback
- [ ] Document lessons learned

---

## 🔮 **FUTURE: Planned Features**

### Multi-Game Session Support
*Status: NOT STARTED - Deferred*
*Estimated: 45-60 minutes*

**Objective:** Enable multiple independent game sessions on a single server

**Implementation:**
- [ ] Add game ID generation (G1, G2, G3)
- [ ] Server: Store multiple game states in Map<gameId, GameState>
- [ ] Frontend: Update URLs to include game ID (`?g=G1&p=P1`)
- [ ] Create landing page for create/join game
- [ ] Ensure complete state isolation between games

**Why deferred:** Core game is complete, this is an enhancement for scaling

---

## 🐛 **KNOWN ISSUES & TECHNICAL DEBT**

For current technical debt, see `docs/technical/TECHNICAL_DEBT.md`

### Minor Issues (Low Priority)
- **Test count discrepancy:** Docs show varying counts (958/966/967)
  - [ ] Run full test suite
  - [ ] Update all documentation with correct count
  - [ ] Standardize test count reporting

---

## 📚 **Reference**

- **Completed work:** See `CHANGELOG.md`
- **Project overview:** See `docs/core/PRODUCT_CHARTER.md`
- **Current status:** See `docs/core/PROJECT_STATUS.md`
- **Technical debt:** See `docs/technical/TECHNICAL_DEBT.md`

---

**Last Updated:** December 14, 2025
