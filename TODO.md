# TODO - Game Alpha

**Last Updated:** January 25, 2026
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
- ✅ Mobile UI Polish (Jan 25, 2026) - framer-motion animations, theme system, haptics
  - Spring physics for DetailSheet drag gestures
  - Dark/light theme with CSS custom properties
  - Web Vibrations API for tactile feedback
  - 100dvh viewport, safe areas, landscape mode
  - All 870 tests passing (test assertion fixes for split text)
- ✅ Mobile PlayerPanel Redesign (Jan 24, 2026) - Context-aware mobile UI architecture
  - New state machine service: `PlayerViewStateService` (5 states: STORY, ACTION, DECISION, WAITING, SUMMARY)
  - Mobile components: MobilePlayerPanel, SpaceHeader, StatsBar, PrimaryAction, ContextArea
  - Draggable DetailSheet with 5 tabs (Finances, Time, Cards, Scope, Log)
  - Responsive wrapper switches at 768px breakpoint
  - 43 new tests for mobile components
- ✅ Universal Dictionary Integration (Jan 24, 2026) - Bidirectional bridge between Game and Dictionary Dashboard
  - "View Intelligence" buttons in CardDetailsModal and SpaceExplorerPanel
  - URL preview support (`?action=preview_card&id=W001`)
  - New utility: `src/utils/dictionaryBridge.ts`
- ✅ Educational Card Selection Modal (Jan 18, 2026) - Complete Same Starting Point feature
  - Created `EducationalCardSelectionModal.tsx` with filter tabs and multi-select
  - Wired to PlayerSetup.tsx for Educational mode
  - Teachers can pre-select starting cards for all players
- ✅ Try Again State Restoration Fix (Jan 18, 2026) - Cards now properly cleared on Try Again
  - Fixed: `discardTempState()` and `createTempStateFromReal()` now restore player state from REAL
  - Root cause: Main player state wasn't being restored when TEMP was discarded
- ✅ Same Starting Point Game Mode (Jan 16, 2026) - New game mode for fair skill-based comparison
  - Per-player deck system with seeded shuffle
  - Quick Start mode (P1's draws become all players' starting hand)
  - Game mode UI in PlayerSetup.tsx
- ✅ Service Extraction Refactoring (Jan 12-13, 2026) - ServerSyncService, EffectEngineService handlers, 551 lines legacy code removed
- ✅ Movement Bug Fixes (Jan 10, 2026) - Descriptive choices, loop explanations, logic paths
- ✅ Financial Bug Fixes (Jan 9, 2026) - Auto-play funding cards at all funding spaces, fee validation
- ✅ Contextual Dice Roll for Movement (Jan 9, 2026) - CHEAT spaces manual, REG spaces auto-roll
- ✅ Action Button Tooltips (Jan 6, 2026) - 45 tooltips explaining "why" for all buttons
- ✅ HTTPS/SSL Support (Jan 6, 2026) - game.unravelcodes.com via Cloudflare
- ✅ Content Spelling Fixes (Jan 6, 2026) - 21+ corrections in SPACE_CONTENT.csv
- ✅ New Test Coverage (Jan 6, 2026):
  - TooltipService tests (17 tests)
  - Tooltip component tests (15 tests)
  - networkDetection utility tests (19 tests)
  - ConnectionStatus component tests (7 tests)
- ✅ Building Trade Dictionary (Jan 1, 2026) - 95 terms, separate project at `../dictionary/`
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

**Multi-Device Bug Fixes & Mobile UX (December 29 - Evening) - ✅ COMPLETED:**
- [x] **Critical Bug Fix**: Multi-device state sync race condition (version tracking + HTTP 409)
- [x] **Mobile Quick Stats Bar**: Money, Time, Cards, Scope visible at top
- [x] **Sticky Action Button**: End Turn/Roll Dice fixed at bottom on mobile
- [x] **Card Display**: Cards shown one per line with type emojis in modals
- [x] **Game Code Display**: Visible on setup screen and in-game header
- [x] **Mid-Game QR Codes**: Connect mobile devices via Display Settings after game starts
- [x] **Server Improvements**: Reduced logging, fixed dev/production path config
- [x] **Regression Test**: MultiplayerStateIsolation.test.ts (6 tests)

**Remaining Setup:**
- [ ] Configure ntfy app for instant push notifications (background mode)
- [x] ~~Set up Hostinger subdomain (game.unravelcodes.com) pointing to DuckDNS~~ ✅ Done via Cloudflare (Jan 6, 2026)

**3B: External Testing** (5-7 days)
- [ ] Recruit 3-5 external players
- [ ] Share game link: `https://game.unravelcodes.com`
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

**Test Player Bug Reports (January 8, 2026) - ✅ ALL FIXED:**
*Source: External test player feedback (post-it notes transcribed)*

**Critical Bugs (Gameplay Blockers):**
- [x] REG-DOB-PLAN-EXAM: No action or movement buttons ✅ **FIXED Jan 9** - Now auto-rolls dice on arrival
- [x] REG-DOB-PROF-CERT: No actions, no movement buttons, gameplay stuck ✅ **FIXED Jan 9** - Now auto-rolls dice on arrival
- [x] CHEAT-BYPASS: No dice roll button ✅ **FIXED Jan 9** - Added manual "Roll Dice" button
- [x] Various spaces: eCard button exists but no movement buttons ✅ **FIXED Jan 15** - Added single-destination "Continue" button fallback

**eCard Issues (January 13, 2026 - ✅ FIXED):**
- [x] **ARCH-SCOPE-CHECK, INVESTOR-FUND-REVIEW, REG-DOB-FEE-REVIEW, CON-ISSUES**: Replace eCard modal missing
  - **Root cause**: SPACE_EFFECTS.csv had `draw_E` instead of `replace_E` for replace actions
  - **Fix**: Updated SPACE_EFFECTS.csv with correct effect_action values
- [x] **ARCH-SCOPE-CHECK, INVESTOR-FUND-REVIEW, CON-ISSUES Subsequent**: Transfer to left/right player not working
  - **Root cause**: SPACE_EFFECTS.csv had `draw_E` instead of `transfer` for give-to-neighbor actions
  - **Fix**: Added `transfer` action with `left`/`right` condition, updated CardEffectService to handle direction
- [x] **"I Forgo eCard" confusing message**: Skip message unclear
  - **Fix**: Updated CardReplacementModal button to "Skip Replacement", improved notification message
- [x] **eCard time changes not visible**: E cards with tick_modifier didn't notify
  - **Root cause**: FinancialEffectHandler.processTimeChange() only logged time additions, not reductions
  - **Fix**: Added `notifyTimeChange()` method for time reductions, updated logging to show "Reduced filing time"
- [x] **PM-DECISION-CHECK "duplicate button"**: Data verified correct (First: replace_E, Subsequent: give_E)
  - **Status**: Needs live testing to reproduce - may have been a visit type detection issue
- [x] **Return to Sender eCard "Hold"**: Feature not implemented
  - **Status**: Documented as missing feature - no "hold" functionality exists in codebase
- [x] **Skip turn mechanism replaced** (January 20, 2026)
  - E cards (E014, E028, E029, E030) previously had "skip turn" penalties that didn't work well:
    - Skipping a turn at timed spaces could cost MORE time than the benefit
    - Single player mode bypass (same player continues immediately)
  - **Fix**: Replaced skip turn with money costs (overtime wages):
    - E014 Express Delivery: $3K for -2 ticks
    - E028 Fact Checking: $6K for -4 ticks
    - E029 Weekend Work: $5K for -3 ticks
    - E030 Time Crunch: $8K for -5 ticks
  - L cards (L014, L024, L035) still use skip turn (forced penalties make sense)

**Financial Issues:**
- [x] INVESTOR-FUND-REVIEW: If cards are split, finances do not reflect added funds ✅ **FIXED Jan 9** - Auto-play B/I cards at all funding spaces
- [x] Error codes screen: Blank fund review ✅ **FIXED Jan 9** - Same root cause as above
- [x] Card did not move to finance section (cosmetic) ✅ **FIXED Jan 15** - Added fundingHistory tracking with individual card amounts
- [x] Fee spaces: Can continue without paying if not enough money ✅ **FIXED Jan 9** - Added canAfford() check

**UI/UX Issues (January 15, 2026 - ✅ FIXED):**
- [x] Goal in player panel - should be in Project Progress Overview
  - **Fix**: Moved Win Condition Banner from PlayerPanel to ProjectProgress component
- [x] Acronyms need full names for clarity
  - **Fix**: Added space titles from SPACE_CONTENT.csv to PlayerPanel and ProjectProgress
- [x] Time selection doesn't show time elapsed per move
  - **Fix**: Added time cost display (⏱️ Xd) to movement choice buttons in TurnControlsWithActions
- [x] REG-FEE-REVIEW: "Choose carefully" message doesn't designate destination
  - **Status**: Already fixed in Jan 8 bug fix with `getLogicMovementWithExplanation()` method
- [x] Game log doesn't show when card is picked up
  - **Fix**: Updated CardEffectHandler and FinancialEffectHandler to use LoggingService instead of legacy window.addActionToLog
- [x] Card viewers uniform look across player panel and exchange modal
  - **Fix**: Refactored CardReplacementModal to use CardDisplay component, added selectable mode to CardDisplay

*See `docs/technical/TECHNICAL_DEBT.md` for full details and prioritization*

---

**Bug Fix Sprint (January 10, 2026) - ✅ COMPLETED:**
- [x] **Movement Bug #1**: CHEAT modal non-descriptive
  - **Problem**: Movement choice modal only showed destination names without context
  - **Fix**: Enhanced choice labels to include space titles (e.g., "CON-INITIATION - Construction begins with permits in hand")
  - **Files**: TurnService.ts - Updated 3 choice creation locations
- [x] **Movement Bug #2**: REG-DOB-AUDIT loop unexplained
  - **Problem**: Player sent back to same/similar review spaces without understanding why
  - **Fix**: Added `getReviewLoopExplanation()` method with notifications explaining the outcome
  - **Result**: Players now see messages like "The examiner found minor issues that need to be addressed"
- [x] **Movement Bug #3**: REG-FDNY-PLAN-EXAM dead end (CRITICAL)
  - **Problem**: "or" destinations in DICE_OUTCOMES.csv only picked first option
  - **Root cause**: `getDiceDestination()` split on " or " but only returned first choice
  - **Fix**: Added `getDiceDestinationChoices()` method to return ALL options as separate choices
  - **Result**: Players can now choose between all available destinations
- [x] **Movement Bug #4**: CON-ISSUES no action/movement buttons
  - **Fix**: Added debug logging to TurnControlsWithActions for CON-ISSUES space
  - **Result**: Console will show detailed state to diagnose if issue recurs
- [x] **Movement Bug #5**: REG-FDNY-FEE-REVIEW logic path not shown
  - **Problem**: Auto-selection happened without showing player why
  - **Fix**: Added `getLogicMovementWithExplanation()` method with condition explanations
  - **Result**: Players see "Because your project scope ($X) exceeds $4M, you'll proceed to..."
- [x] **Tests**: All 504 service tests pass

**Bug Fix Sprint (January 9, 2026) - ✅ COMPLETED:**
- [x] **Financial Bug #1 & #2**: Funding cards not updating moneySources at BANK/INVESTOR-FUND-REVIEW
  - **Root cause**: Auto-play logic only triggered at OWNER-FUND-INITIATION, not other funding spaces
  - **Fix**: Extended auto-play to all funding spaces (OWNER-FUND-INITIATION, BANK-FUND-REVIEW, INVESTOR-FUND-REVIEW)
  - **Result**: B/I cards drawn at any funding space now auto-apply, updating bankLoans/investmentDeals correctly
- [x] **Financial Bug #3**: Fee spaces allowing continuation without payment
  - **Root cause**: `spendMoney()` return value was ignored in FEE_DEDUCTION handler
  - **Fix**: Added `canAfford()` check before fee deduction, returns failure with notification if insufficient funds
  - **Result**: Players cannot proceed at fee spaces if they can't afford the fee
- [x] **Tests Added**: Updated 4 existing FEE_DEDUCTION tests + 1 new insufficient funds test (29 tests pass)

**Bug Fix Sprint (January 8, 2026) - ✅ COMPLETED:**
- [x] **Issue #1**: Logic Movement Type Implementation for REG-FDNY-FEE-REVIEW
  - **Problem**: REG-FDNY-FEE-REVIEW narrative said "answer questions" / "assess 4 criteria" but was free choice
  - **Decision**: After design review, only REG-FDNY-FEE-REVIEW uses `logic` type (other spaces remain strategic free choice)
  - **Resolution**:
    - [x] Phase 1: Designed scope-based conditions for REG-FDNY-FEE-REVIEW
    - [x] Phase 2: Updated MOVEMENT.csv - changed movement_type to `logic` with conditions
    - [x] Phase 3: Added 3 tests to MovementService.test.ts (all 32 tests pass)
  - **Result**:
    - Large projects (>$4M) → Must go through FDNY-PLAN-EXAM
    - Small projects (≤$4M) → Can skip to REG-DOB-TYPE-SELECT
    - All projects → CON-INITIATION and PM-DECISION-CHECK always available
  - **Reference**: See `docs/technical/TECHNICAL_DEBT.md` - "Logic Movement Type Dead Code"

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

### Multi-Game Session Support ✅
*Status: COMPLETED - December 29, 2025*

**Implemented Features:**
- [x] Game ID generation (G1, G2, G3...)
- [x] Server: Multiple game states with persistence
- [x] Frontend: URLs include game ID (`?g=G1&p=P1`)
- [x] GameLobby component for create/join
- [x] Complete state isolation between games
- [x] 24-hour game expiration
- [x] Game code display on setup and in-game

See CHANGELOG.md for full implementation details.

### Same Starting Point Game Mode 📋
*Status: PLANNED - January 15, 2026*
*Estimated Effort: Major feature (multi-phase implementation)*

**Overview:** Add a new game mode where all players start with identical cards, enabling fair skill-based comparison. Requested by playtesters who want to see how different decisions lead to different outcomes when everyone starts equal.

**Game Modes:**
| Mode | Description | Default |
|------|-------------|---------|
| **Battle Royale** | Current behavior - shared decks, random draws | ✅ Yes |
| **Same Starting Point** | Per-player decks, identical starting cards | No |

**Same Starting Point Sub-Modes:**
| Sub-Mode | Description |
|----------|-------------|
| **Quick Start** | First player's natural card draws get "baked in" as starting hand for all players |
| **Educational** | Teacher manually selects starting cards (full card details visible, no maximum) |

**Architecture Changes Required:**

1. **Per-Player Deck System** (High effort)
   - Change from shared `decks` to `playerDecks: Record<playerId, Decks>`
   - Each player gets their own shuffled copy of each deck
   - Separate discard piles per player
   - Files: `StateService.ts`, `CardService.ts`, `GameState` types

2. **Starting Cards System** (Medium effort)
   - Quick Start: Clone P1's first-turn draws to all players
   - Educational: UI to browse/select specific cards before game start
   - Files: `StateService.ts`, new card selection component

3. **Global L Card Events** (Low effort)
   - L cards with `scope: Global` already exist in CSV
   - Ensure Global events affect all players immediately
   - Files: `CardService.ts`, `EffectEngineService.ts`

4. **Consolidated Game Settings UI** (Medium effort)
   - Replace win condition section in `PlayerSetup.tsx`
   - Add checkbox: "☐ Same Starting Point" (default OFF)
   - If checked: Radio buttons for Quick Start / Educational
   - Remove `GameDisplaySettings.tsx` from post-game, integrate into setup

**Data Model Changes:**
```typescript
interface GameState {
  gameMode: 'BATTLE_ROYALE' | 'SAME_START';
  startingMode?: 'QUICK_START' | 'EDUCATIONAL';
  playerDecks?: Record<string, Decks>;  // Per-player decks
  playerDiscardPiles?: Record<string, DiscardPiles>;  // Per-player discards
  startingHand?: string[];  // Card IDs all players start with
}
```

**Implementation Phases:**
- [ ] Phase 1: Per-player deck system (architecture change)
- [ ] Phase 2: Quick Start mode (P1 draws → copy to all)
- [ ] Phase 3: Educational mode (teacher selects cards UI)
- [ ] Phase 4: Global L Card broadcasting verification
- [ ] Phase 5: Consolidated Game Settings UI

---

## 🌐 **Universal Dictionary Integration** ✅
*Status: COMPLETED - January 24, 2026*
*Integration Target: dashboard.unravelcodes.com*

### Objective
Create a seamless bridge between the Game Engine and the Command Center's Intelligence Database.

### Completed Tasks
- [x] **Term Lookup Service**: Created `src/utils/dictionaryBridge.ts` utility with `openInDictionary()`, `getPreviewParams()`, and `clearPreviewParams()` functions.
- [x] **External Intelligence Link**: Added "📖 View Intelligence" button to CardDetailsModal and "📖 Intelligence" button to SpaceExplorerPanel. Opens `https://dashboard.unravelcodes.com/dictionary?id={id}&view=game` in new tab.
- [x] **Reverse Bridge (Dictionary -> Game)**:
  - [x] App.tsx detects `?action=preview_card&id=W001` or `?action=preview_space&id=SPACE_ID` on load.
  - [x] GameLayout opens appropriate modal and shows error notification if asset not found.
  - [x] URL params cleared after processing to prevent re-triggers.
- [ ] **Shared Media Assets**: Deferred to future DevOps sprint - assets remain local for now.

### Files Added/Modified
- `src/utils/dictionaryBridge.ts` (NEW)
- `src/App.tsx` (preview param detection)
- `src/components/layout/GameLayout.tsx` (preview handling)
- `src/components/modals/CardDetailsModal.tsx` (View Intelligence button)
- `src/components/game/SpaceExplorerPanel.tsx` (Intelligence button + initialSelectedSpace prop)
- `tests/utils/dictionaryBridge.test.ts` (NEW - 5 tests)

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

**Last Updated:** January 25, 2026
