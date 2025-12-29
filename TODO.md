# TODO - Game Alpha

**Last Updated:** December 29, 2025
**Status:** Production Ready - External Testing Infrastructure Deployed

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
*Status: IN PROGRESS - Ready for External Testing*
*Started: December 9, 2025*
*Internal Testing Complete: December 28, 2025*

### Objective
Validate gameplay, balance, and user experience with real players

### Tasks

**3A: Internal Testing** (2-3 days) - ✅ COMPLETE (December 28, 2025)
- [x] Initial UAT with Perplexity AI (December 9) - **8.5/10 rating**
- [x] Test all card types and effects (W, B, E, L, I) - ✅ All working
- [x] Verify space mechanics - ✅ Choice system works
- [x] Document issues found - See findings below
- [x] Complete full game playthrough (start to finish) ✅ December 28, 2025
- [x] Test multiplayer with 2-4 players ✅ December 28, 2025
  - 2-player: Turn switching, state isolation, different paths
  - 3-player: Odd player rotation verified
  - 4-player: Full rotation, all paths tested (ARCH, LEND, CHEAT)
- [x] Test multi-device functionality (QR codes, short URLs) ✅ December 28, 2025
  - Short ID generation (P1, P2, P3, P4)
  - URL routing (?p=P1 → player screen)
  - 4 devices accessing 4 player views simultaneously
  - Host device sees full game view

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

**Bug Fix Sprint (December 19) - ✅ COMPLETED:**
- ✅ **L Card Dice Bug**: L cards were always drawn (1-in-6 dice check not working)
  - Root cause: EffectFactory drew cards unconditionally, ignoring "if you roll a X" condition
  - Fix: EffectFactory skips dice-conditional effects, TurnService handles dice roll logic
  - Result: L cards now properly have 1-in-6 chance per space configuration
- ✅ **Modal Notifications**: Added modals for automatic L card draws
  - Event system: StateService.emitAutoAction() triggers modal in GameLayout
  - No modal for misses (life events are surprises)
- ✅ **End Turn Stuck**: Button stayed on "Processing..." indefinitely
  - Fix: Added 15-second timeout with error notification
- ✅ **Money Source Tracking**: Added sourceType to RESOURCE_CHANGE effects
  - B cards = 'owner', L cards = 'bank', I cards = 'investment'
- ✅ **Money vs Scope Color**: Red when money < scope, green otherwise

**Deployment Infrastructure (December 29) - ✅ COMPLETED:**
- [x] Docker deployment to Unraid server
- [x] DuckDNS setup for stable external URL: `unravel-game.duckdns.org:3080`
- [x] Multi-game session support (G1, G2, G3, etc.)
- [x] Game persistence (auto-save, survives restarts)
- [x] Game expiration (24 hours of inactivity)
- [x] Visitor logging (IP, device, actions)
- [x] Push notifications via ntfy.sh (needs phone config for instant delivery)
- [x] Rebranding to "Unravel Codes: The Game" with logo
- [x] Alpha version notice with feedback email

**Remaining Setup:**
- [ ] Configure ntfy app for instant push notifications (background mode)
- [ ] Set up Hostinger subdomain (game.unravelcodes.com) pointing to DuckDNS

**3B: External Testing** (5-7 days)
- [ ] Recruit 3-5 external players
- [ ] Share game link: `http://unravel-game.duckdns.org:3080`
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

**Bug Fix Sprint (December 20) - ✅ COMPLETED:**
- [x] **Bug #1**: Owner seed money tracked as external (should be owner funding)
  - Root cause: I cards at OWNER-FUND-INITIATION used 'investment' sourceType
  - Fix: Check if currentSpace === 'OWNER-FUND-INITIATION' and use 'owner' sourceType
- [x] **Bug #2**: No bankruptcy check when spending exceeds project scope
  - Fix: Added check after money spending in EffectEngineService - triggers game over
- [x] **Bug #3**: Move timeline bar from modals to Project Progress section
  - Added Project Timeline tracker to ProjectProgress component
  - Removed timeline from DiceResultModal
  - Shows total time, estimated project length, and progress percentage
- [x] **Bug #4**: Phase bar should never regress (side quests don't change phase)
  - Modified calculatePlayerProgress to use max phase from all visited spaces
  - Phase bar now tracks highest phase reached, not current space
- [x] **Bug #5**: PM-DECISION-CHECK E card button text and modal behavior
  - Changed effect_action from draw_E to give_E in SPACE_EFFECTS.csv
  - Added give_e action handler in TurnService with card selection modal
  - Updated button formatting to display "Select E card to give opponent"
- [x] **Bug #6**: Journey timeline should show days spent per space
  - Updated TimeSection to use spaceVisitLog instead of visitedSpaces
  - Now displays daysSpent for each visited space in the timeline
- [x] **Note**: B cards at OWNER-FUND-INITIATION already fixed (uses 'owner' sourceType)

**Bug Fix Sprint (December 20 - Part 2) - ✅ COMPLETED:**
- [x] **Bug #7**: REG-DOB-PROF-CERT should not give player choice
  - Fixed: Added 'dice' to movement type guards (same as 'dice_outcome')
  - Now skips choice creation for dice-based movement spaces
- [x] **Bug #8**: Try Again button not working in single player mode
  - Fixed: Skip leaving space effects when skipAutoMove=true
  - Fixed: Preserve original snapshot instead of overwriting after Try Again
- [x] **Bug #9**: Change space modal should show player color and appear at start of move
  - Fixed: Uses player.color for overlay background instead of hardcoded blue
  - Fixed: Added 'movement' type to AutoActionEvent, emitted BEFORE movePlayer
  - Added subscribeToAutoActions in PlayerPanel to show overlay immediately
- [x] **Bug #10**: Return one card button should allow player to choose which card
  - Added CARD_SELECTION choice type to CommonTypes.ts
  - Updated return_e and return_l handlers in TurnService to use choiceService
  - Now shows selection modal when multiple cards available to return
- [x] **Bug #11**: Design fee cap bar should be in Project Progress per player
  - Added design fee ratio calculation using player.expenditures.design and projectScope
  - Shows visual bar scaled to 20% threshold with color coding (green/orange/red)
  - Displays current design fees and cap amount in dollars

**E2E Game Loop Verification (December 28) - ✅ COMPLETED:**
- [x] **Full Playthrough Verified**: 17-turn "Golden Path" from OWNER-SCOPE-INITIATION to FINISH
- [x] **Win Condition Validated**: Landing on FINISH triggers Game Over and correctly identifies winner
- [x] **Bug #1 Fixed**: moveIntent Persistence - Movement intent now clears between turns
  - Root cause: Old moveIntent from multi-path choice spaces persisted to fixed/auto spaces
  - Fix: Clear moveIntent in clearTurnActions() and when switching players
- [x] **Bug #2 Fixed**: Manual Action Completion Keys - Fuzzy/case-insensitive matching
  - Root cause: `cards:replace_E` compound key not matching simple key lookups
  - Fix: Expand matching to support compound, simple, action keys + case-insensitive
- [x] **Bug #3 Documented**: Implicit Dice Movement - Spaces with dice movement but no manual dice effects
  - Workaround: Test forces roll; production uses `requires_dice_roll=Yes` config
- [x] **E2E Tests Added**: E2E-LogicPlaythrough.test.ts, E2E-FullGame.test.tsx
- [x] **Test Mocks Fixed**: Added missing clearPlayerMoveIntent to mock services

**UI Consolidation (December 21) - ✅ COMPLETED:**
- [x] **Project Timeline Per Player**: Moved timeline from global to per-player cards
  - Each player shows days spent / estimated days, progress %, work types
  - Color coding: green (<75%), orange (75-100%), red (>100%)
- [x] **Design Fee Cap Consolidation**: Removed from FinancesSection, kept in ProjectProgress
  - Detailed view consolidated to ProjectProgress component
  - Summary badge (X%/20%) still shown in FinancesSection header
- [x] **4-Tier Color Scheme**: Design fee colors now match 10%/15%/20% thresholds
  - Green (0-10%), Orange (10-15%), Deep Orange (15-20%), Red (20%+)
- [x] **Tests Updated**: 4 new ProjectProgress tests, 6 obsolete tests removed
- [x] **Test Suite Status**: 720+ tests passing

**Game Rule Enhancements (December 19) - ✅ COMPLETED:**
- [x] **20% Design Fee Cap Rule**
  - If design fees reach 20% of project scope during DESIGN phase → Game Over (loss)
  - If 20% cap reached during CONSTRUCTION phase → Time penalty (+2 weeks)
  - Affects: ARCH-FEE-REVIEW, ENG-FEE-REVIEW spaces
  - Implemented in EffectEngineService after design fee is applied

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

**Last Updated:** December 29, 2025
