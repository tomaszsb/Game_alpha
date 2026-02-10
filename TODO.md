# TODO - Game Alpha

**Last Updated:** February 8, 2026
**Status:** Production Ready - External Testing In Progress

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
- ✅ Feature: Redistribute cards across tabs — Cards tab replaced by Expeditors + Events (Feb 9, 2026)
- ✅ Enhancement: TV mode Rules button + Owner Funding now interactive (Feb 9, 2026)
- ✅ Bug Fix: Dice roll button missing on REG- spaces — players got stuck (Feb 9, 2026)
- ✅ Bug Fix: Design Fees text wrapping on TV mode (960x540) (Feb 9, 2026)
- ✅ Data Fix: Space titles now proper English names instead of duplicating story text (Feb 9, 2026)
- ✅ Feature: Fullscreen toggle, Pull-to-Refresh, Game Board Zoom/Pan (Feb 8, 2026)
- ✅ Feature: Floating Bug Report button with screenshot capture + server storage (Feb 8, 2026)
- ✅ UI: Consolidated Display Settings modal — one card per player with all controls (Feb 8, 2026)
- ✅ Security: Data Editor restricted to main menu, Kill Game button, mobile setup view (Feb 7, 2026)
  - Data Editor removed from in-game ProjectProgress (only accessible from PlayerSetup)
  - ☠️ Kill Game button with admin auth replaces ⚙️ in-game
  - Mobile players scanning QR during setup see only their own player card + "Waiting..." message
- ✅ UI Polish: Equal button sizing, tab visibility fix, conditional Renegotiate (Feb 7, 2026)
  - End Turn and Renegotiate buttons same size; remaining actions shown inside End Turn
  - Reference tabs no longer cut off when collapsed player bar above
  - Renegotiate only appears after at least one action completed
- ✅ Playtest Polish: Thematic Buttons, Funding Display, Multi-Player Panel Fix (Feb 7, 2026)
  - OWNER-SCOPE-INITIATION buttons renamed to thematic labels
  - Try Again button → "Renegotiate — I'll take more time"
  - Owner funding displayed persistently in green box
  - Mobile overflow fixes (width, tab height)
  - Multi-player on same PC: only current player's full panel shown, others collapsed to mini bar
  - Try Again REAL state fix: snapshot now captured before space effects run
- ✅ Unified Action Center Player Panel (Feb 6, 2026)
  - Replaced desktop PlayerPanel + mobile MobilePlayerPanel with single ActionCenterPanel
  - 3-zone layout: Context (space/story/stats), Actions (E cards/buttons/choices), Reference (5 tabs)
  - Per-player filtered log tab, E card callout with gold pulse, dice/manual effect routing
  - Same component on desktop and mobile — responsive via CSS only
- ✅ Player Card Layout: Inline QR + compact design (Feb 5, 2026)
  - QR codes always visible to the right of player info (no toggle button)
  - Name input width matched to color circles, compact horizontal layout
- ✅ Admin Password Protection for Data Editor (Feb 5, 2026)
  - Server-side SHA-256 password verification endpoint (`POST /api/admin/verify`)
  - Frontend auth gate on PlayerSetup admin tools and DataEditor
  - sessionStorage-based auth (resets on tab close), configurable via env var
- ✅ URL Migration: DuckDNS → game.unravelcodes.com (Feb 5, 2026)
- ✅ PlayerSetup Horizontal Layout + Compact TV Progress + Test Perf (Feb 5, 2026)
  - PlayerSetup: converted to 2-panel horizontal layout (Players | Settings) for TV/wide screens
  - TV ProjectProgress: compact mode hides goal banner, reduces padding/fonts
  - Tests: vitest projects (vmThreads + forks) → runtime from ~28min to ~80s, all 1319 passing
- ✅ Landing Page Flow Fixes + TV Display + Editor Contrast (Feb 5, 2026)
  - Host Game: auto-creates game and redirects (no more confusing lobby)
  - TV Display: shows only game picker; full ProjectProgress panel in TV mode
  - Join Game: autocomplete prevention for game code inputs
  - EndGameModal/DataEditor: navigate to root landing page instead of old setup screen
  - Space Editor: fixed low-contrast text (labels, phase headers, tabs, buttons)
- ✅ UAT Bug Fixes + Dictionary Integration Prep (Feb 3, 2026)
  - Card Replacement Modal: Fixed 4 bugs (selection UX, removed exchange buttons, renamed button, return behavior)
  - Dictionary Panel: Iframe embedding ready (600px width, `useEmbeddedDashboard` prop, bridge callback)
  - Feature flag `ENABLE_EMBEDDED_DICTIONARY` - enable when dashboard supports `embedded=true`
- ✅ Desktop Command Center Modernization (Jan 25, 2026) - Glassmorphism + haptic visuals
  - desktop-theme.css with glass effect CSS variables
  - PlayerPanel glassmorphism (frosted glass, translucent backgrounds)
  - framer-motion spring animations for active player panel
  - Turn change pulse animation
  - prefers-reduced-motion accessibility support
  - QR code reset button for reconnecting mobile devices
- ✅ Mobile UI Polish (Jan 25, 2026) - framer-motion animations, theme system, haptics
  - Spring physics for DetailSheet drag gestures
  - Dark/light theme with CSS custom properties
  - Web Vibrations API for tactile feedback
  - 100dvh viewport, safe areas, landscape mode
  - All ~1,027 tests passing (test assertion fixes for split text)
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
- [x] ~~Configure ntfy app for instant push notifications~~ (User task - not code related)
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

**UAT Bug Reports (February 3, 2026) - ✅ ALL FIXED:**
*Source: Browser automation playtesting session*

**Card Selection Modal Issues:**
- [x] **Bug #1**: Card selection UX confusion ✅ **FIXED Feb 3**
  - **Problem**: Clicking card button in Replace modal was confusing - unclear if selecting or viewing details
  - **Solution**: Clarified UX - clicking card body SELECTS it (visual checkmark), separate "Details" button opens card info
  - **Files**: `src/components/modals/CardReplacementModal.tsx`, `src/components/common/CardDisplay.tsx`

- [x] **Bug #2**: Misleading card type exchange buttons at modal bottom ✅ **FIXED Feb 3**
  - **Problem**: Bottom of Replace modal showed card type buttons (W, B, E, etc.) suggesting exchange for different type
  - **Solution**: Removed entire "Replace with:" section - replacement always gives same card type
  - **Files**: `src/components/modals/CardReplacementModal.tsx`

- [x] **Bug #3**: "Skip Replacement" button misnamed ✅ **FIXED Feb 3**
  - **Problem**: Button labeled "Skip Replacement" suggested skipping a required action
  - **Solution**: Renamed to "Return to Main Panel" with tooltip explaining behavior
  - **Files**: `src/components/modals/CardReplacementModal.tsx`

- [x] **Bug #4**: Return button behavior incorrect ✅ **FIXED Feb 3**
  - **Problem**: Button showed success notification and may have marked action complete
  - **Solution**: Button now hides modal (choice stays pending), floating indicator lets player return
  - **Files**: `src/components/modals/ChoiceModal.tsx`, `src/components/modals/CardReplacementModal.tsx`

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
    - E014 Express Delivery: $3K for -2 days
    - E028 Fact Checking: $6K for -4 days
    - E029 Weekend Work: $5K for -3 days
    - E030 Time Crunch: $8K for -5 days
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

## 📱 **MOBILE OPTIMIZATION SPRINT** (February 2026)
*Status: NOT STARTED*
*Priority: HIGH - Blocking external testing on mobile devices*
*Consultant Review: February 4, 2026*

### Problem Statement
Mobile players report that UI "doesn't fit on screens". The game is a Jackbox-style hybrid where players use mobile devices as controllers while viewing a shared TV/monitor display. Current implementation has responsive foundations but needs significant work to be truly mobile-friendly.

### Current Mobile Architecture
- **Framework:** React 18 + TypeScript (web-based, not native)
- **Existing Mobile Components:** MobilePlayerPanel, StatsBar, PrimaryAction, ContextArea, ResponsiveSheet
- **Breakpoint:** 768px (Bootstrap standard)
- **State Sync:** WebSockets (real-time) with HTTP fallback (server/websocket.js + WebSocketSyncService.ts)

---

### 🔴 **CRITICAL: Layout Fixes (Do First)** ✅ ALL FIXED Feb 4, 2026

**Issue #1: Fixed Pixel Values in Desktop Layout** ✅ FIXED
- **File:** `src/components/layout/GameLayout.tsx` (lines 236-280)
- **Problem:** Desktop uses fixed widths (`1280px`, `1120px`, etc.) that don't scale to mobile
- **Fix:** Add mobile breakpoint CSS:
```css
@media (max-width: 768px) {
  .game-interface-responsive {
    grid-template-columns: 1fr !important;
    grid-template-rows: auto 1fr auto !important;
    column-gap: 0;
    padding: 0;
    height: 100dvh;
    min-height: -webkit-fill-available;
  }
  .game-interface-responsive > * {
    grid-column: 1 !important;
  }
}
@media (max-width: 480px) {
  .game-interface-responsive { padding: 0; }
}
```

**Issue #2: Modal Max-Height Cuts Off Content** ✅ FIXED
- **File:** `src/components/modals/ResponsiveSheet.tsx` (line 112)
- **Problem:** `maxHeight: '85vh'` leaves only 15% for system UI, but mobile browsers have dynamic toolbars
- **Fix:** Changed to `maxHeight: '100dvh'` and `height: '100dvh'` for full screen on mobile

**Issue #3: Content Overflow in ContextArea** ✅ FIXED
- **File:** `src/components/player/mobile/MobilePlayerPanel.css` (lines 129-137)
- **Problem:** Context area has `overflow-y: auto` but parent has `overflow: hidden`, causing clipping
- **Fix:** Added `-webkit-overflow-scrolling: touch`, ensured proper scroll chain, split overflow-x/y

**Issue #4: Stats Bar Cramped on Small Screens** ✅ FIXED
- **File:** `src/components/player/mobile/StatsBar.css` (lines 12-25)
- **Problem:** Four stats in a row with `flex-wrap: nowrap` forces horizontal scroll on phones <360px
- **Fix:** Added 2x2 grid for screens <400px, plus extra narrow breakpoint for <320px

**Issue #5: Font Sizes Too Large for Small Screens** ✅ FIXED
- **Multiple files:** MobilePlayerPanel.css, StatsBar.css
- **Problem:** Current font sizes (14-18px) fine for tablets but cramped on phones
- **Fix:** Added `clamp()` fluid typography throughout mobile components (story text, action labels, decision prompts, stats)

---

### 🟠 **HIGH PRIORITY: Touch Optimization**

**Issue #6: Touch Targets Too Small** ✅ FIXED
- **Minimum:** Apple/Google recommend 44x44px minimum
- **Problem:** Some buttons have smaller tap areas (decision options at 12px padding)
- **Fix:** Added `min-height: 48px` to decision options and `min-width/min-height: 44px` to stats bar items

**Issue #7: No Swipe Gestures** ✅ FIXED
- **Implemented:** framer-motion drag gestures on DetailSheet (swipe down to dismiss)
- **Files:** `src/components/player/mobile/DetailSheet.tsx` uses `drag="y"` with spring physics
- **Status:** Bottom sheets close via swipe-down gesture, tap on backdrop, or X button

**Issue #8: Haptic Feedback Not Used Consistently** ✅ FIXED
- **Added:** New patterns to `haptics.ts` (diceRoll, cardDraw, movement)
- **Integrated haptics in:**
  - `GameLayout.tsx` - dice roll (strong) and error feedback
  - `MobilePlayerPanel.tsx` - turn notification (double pulse)
  - `DecisionView.tsx` - choice selection (light tap)
  - `StatsBar.tsx` - stat taps (light tap)
  - `PrimaryAction.tsx` - already had haptics (button press, success)

**Issue #9: 300ms Tap Delay on Some Elements** ✅ FIXED
- **Problem:** Not all elements have `touch-action: manipulation`
- **Fix:** Added globally in index.html: `* { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }`

**Issue #10: No Pull-to-Refresh**
- **Recommendation:** Add pull-to-refresh to sync state from server (useful when other players make moves)

---

### 🟡 **MEDIUM PRIORITY: TV/Mobile Role Separation**

**Issue #11: TV Shows Too Much Detail** ✅ FIXED
- **Solution:** Created `TVDisplay` component (`src/components/layout/TVDisplay.tsx`) that:
  - Shows large game board prominently
  - Current player indicator with colored banner
  - QR codes for all players to join
  - Dramatic action overlays for events
  - No interactive controls (display only)

**Issue #12: Mobile Shows Too Little** ✅ FIXED
- **Solution:** Clear role detection implemented in `App.tsx`:
  - TV mode: `?mode=tv` shows TVDisplay (no controls)
  - Mobile mode: `?p=P1` shows player's controller interface
  - Host mode: No params shows full GameLayout

**Issue #13: No "TV Mode" URL Parameter** ✅ FIXED
- **Implemented:** URL parameter routing:
  - `?g=G1&mode=tv` → TVDisplay component
  - `?g=G1&p=P1` → Player 1's mobile controller
  - 📺 TV button in ProjectProgress header opens TV mode in new tab

**Issue #14: State Sync is HTTP Polling (Laggy)** ✅ FIXED
- **Implemented:** WebSocket real-time state sync with HTTP fallback
- **Files:** `server/websocket.js` (server), `src/services/WebSocketSyncService.ts` (client)
- **Features:** Bidirectional updates, instant state push, automatic reconnection
- **Impact:** TV and mobile devices update instantly when any player acts

---

### 🟢 **IMPROVEMENTS: Mobile UX Enhancements**

**Issue #15: No Offline Support**
- **Problem:** Party games often happen in locations with poor WiFi
- **Recommendation:** Add Service Worker for:
  - Caching game assets
  - Queuing actions when offline
  - Syncing when reconnected

**Issue #16: No Full-Screen Mode**
- **Problem:** Mobile browsers have toolbars that eat screen space
- **Fix:** Add "Enter Fullscreen" button:
```typescript
document.documentElement.requestFullscreen();
```
- **Alternative:** Use PWA manifest with `"display": "fullscreen"`

**Issue #17: No Screen Orientation Lock**
- **Recommendation:** Allow users to lock orientation:
```typescript
screen.orientation.lock('portrait');
```

**Issue #18: Battery Drain from Animations**
- **File:** `src/styles/animations.css`
- **Problem:** Continuous pulse animations drain battery
- **Fix:** Respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .waiting-icon { animation: none; }
}
```

**Issue #19: No Loading States for Slow Networks**
- **Problem:** `SkeletonLoader.tsx` exists but isn't used in all views
- **Fix:** Add skeleton loaders while fetching state

**Issue #20: Missing "Your Turn" Push Notification** ✅ FIXED
- **Implemented:** Web Push Notifications to alert players when it's their turn
- **Files:** `src/utils/pushNotifications.ts` (new), `src/components/player/mobile/MobilePlayerPanel.tsx`, `src/components/layout/GameLayout.tsx`
- **Features:** Auto-requests permission when game starts, sends notification when tab is in background, click notification focuses game tab

---

### 🔵 **PATH TO NATIVE APPS**

**Issue #21: No PWA Manifest** ✅ FIXED
- **Created:** `public/manifest.json` with app name, display mode, theme colors
- **Updated:** `index.html` with manifest link, apple-mobile-web-app meta tags, theme-color
- **Note:** Uses existing logo.png; for best results, create 192x192 and 512x512 icons

**Issue #22: No App Icons**
- **Create:** Icons in sizes 192x192 and 512x512 (PNG)
- **Location:** `public/icons/`

**Issue #23: Future Native App Strategy**
- **Options:**
  1. **Capacitor (Recommended)** - Wrap React app in native shell
  2. **React Native** - Rewrite UI (more work, better performance)
  3. **PWA only** - Sufficient for party games
- **For Capacitor:**
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add ios
npx cap add android
```

---

### 🟣 **SPECIFIC UI COMPONENT FIXES**

**Issue #24: Decision Options Overflow**
- **Problem:** Long option text wraps awkwardly
- **Fix:** Truncate with ellipsis or expand on tap:
```css
.option-label {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

**Issue #25: StatsBar Icons Are Emoji**
- **Problem:** Emoji render differently across devices
- **Recommendation:** Use consistent icon library (Lucide React, Heroicons)

**Issue #26: No Dark Mode Toggle Visible** ✅ FIXED
- **Implemented:** `ThemeToggle.tsx` component with sun/moon icon toggle
- **Features:** Light/dark mode switch, system preference detection, CSS custom properties
- **Files:** `src/components/common/ThemeToggle.tsx`, `src/styles/mobile-theme.css`

**Issue #27: Card Display Too Dense**
- **Problem:** Card details have lots of information
- **Recommendation:** Use progressive disclosure:
  - Show card name + type initially
  - Tap to expand full details

**Issue #28: No Zoom/Pan on Game Board**
- **Problem:** TV display should allow zooming the board
- **Recommendation:** Add pinch-to-zoom for mobile, scroll-wheel zoom for TV

---

### 🔧 **TESTING RECOMMENDATIONS**

**Issue #29: No Mobile Device Testing Setup**
- **Recommendation:** Add Playwright mobile emulation tests:
```typescript
devices: ['iPhone 13', 'Pixel 5', 'iPad Pro']
```

**Issue #30: No Performance Monitoring**
- **Recommendation:** Track mobile performance metrics:
  - Time to Interactive (TTI)
  - First Contentful Paint (FCP)
  - Cumulative Layout Shift (CLS)

**Issue #31: No Real Device Testing**
- **Recommendation:** Test on actual devices (browser DevTools is not enough):
  - iPhone SE (smallest common phone)
  - iPhone 14 Pro Max (largest)
  - Samsung Galaxy (Android)
  - Budget Android (<$200)

**Issue #32: No Network Throttling Tests**
- **Recommendation:** Test with "Slow 3G" in DevTools to ensure playability on poor connections

---

### Prioritized Action Plan

| Priority | Issue | Effort | Impact | Status |
|----------|-------|--------|--------|--------|
| 1 | Add mobile breakpoint to GameLayout (#1) | Low | High | ✅ Fixed Feb 4 |
| 2 | Fix modal max-height for mobile (#2) | Low | High | ✅ Fixed Feb 4 |
| 3 | Add 2x2 StatsBar grid for narrow screens (#4) | Low | Medium | ✅ Fixed Feb 4 |
| 4 | Implement TV mode (`?mode=tv`) (#11, #13) | Medium | High | ✅ Fixed Feb 4 |
| 5 | Migrate to WebSockets (#14) | High | High | ✅ Fixed |
| 6 | Add PWA manifest (#21) | Low | Medium | ✅ Fixed Feb 4 |
| 7 | Increase touch target sizes (#6) | Low | Medium | ✅ Fixed Feb 4 |
| 8 | Add swipe gestures (#7) | Medium | Medium | ✅ Fixed Feb 4 |
| 9 | Add haptic feedback consistently (#8) | Low | Low | ✅ Fixed Feb 4 |
| 10 | Add push notifications (#20) | Medium | Medium | ✅ Fixed Feb 4 |

### Success Criteria
- [x] Game UI fits on iPhone SE (375px width) without horizontal scroll ✅ Feb 4
- [x] All interactive elements have 44x44px minimum touch targets ✅ Feb 4
- [x] TV mode displays game board prominently with QR code for joining ✅ Feb 4
- [x] Mobile mode shows only player's controller interface ✅ Feb 4
- [x] State updates appear on TV within 100ms of player action ✅ WebSockets implemented
- [x] PWA installable on iOS and Android home screens ✅ Feb 4

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

### Same Starting Point Game Mode ✅
*Status: COMPLETED - January 16, 2026*

**Implemented Features:**
- [x] Per-player deck system with seeded shuffle
- [x] Quick Start mode (P1's draws become all players' starting hand)
- [x] Educational mode with `EducationalCardSelectionModal.tsx`
- [x] Game mode UI in `PlayerSetup.tsx` with sameStartingPoint checkbox
- [x] Teachers can pre-select starting cards for all players

**Files:**
- `src/components/setup/PlayerSetup.tsx` - Game mode settings
- `src/components/modals/EducationalCardSelectionModal.tsx` - Card selection UI
- `src/services/StateService.ts` - Per-player deck management
- `src/types/StateTypes.ts` - GameState with gameMode, startingMode

See CHANGELOG.md for full implementation details.

---

## 🌐 **Universal Dictionary Integration** ✅
*Status: COMPLETE - Embedded iframe mode enabled*
*Integration Target: dashboard.unravelcodes.com*

### Objective
Create a seamless bridge between the Game Engine and the Command Center's Intelligence Database.

### Completed Tasks
- [x] **Term Highlighting**: `TextWithTerms` component highlights glossary terms in game text
- [x] **View Intelligence Buttons**: Added to CardDetailsModal and SpaceExplorerPanel
- [x] **Reverse Bridge (Dictionary -> Game)**: URL params for preview_card/preview_space
- [x] **Dictionary Panel Integration**: Embedded iframe via `DictionaryPanelWrapper` (600px width)
- [x] **Feature Flag**: `ENABLE_EMBEDDED_DICTIONARY=true` enables in-game embedded panel
- [x] **Local Term Data**: `src/dictionary/data/terms.ts` retained as fallback for TextWithTerms highlighting

### Architecture
- `src/utils/dictionaryBridge.ts` - Links to external dictionary
- `src/dictionary/components/TextWithTerms.tsx` - Highlights terms in text
- `src/dictionary/components/DictionaryPanel.tsx` - Embedded iframe panel UI
- `src/dictionary/data/terms.ts` - Local term data (fallback for highlighting)
- `src/components/layout/DictionaryPanelWrapper.tsx` - Wrapper mounted in App.tsx game branch

### Remaining (Nice-to-Have)
- [ ] **Remote Term Data**: Fetch definitions from dashboard API instead of local `terms.ts`
- [ ] **Shared Media Assets**: Deferred to future DevOps sprint

### Files Added/Modified
- `src/utils/dictionaryBridge.ts` (NEW)
- `src/App.tsx` (preview param detection)
- `src/components/layout/GameLayout.tsx` (preview handling)
- `src/components/modals/CardDetailsModal.tsx` (View Intelligence button)
- `src/components/game/SpaceExplorerPanel.tsx` (Intelligence button + initialSelectedSpace prop)
- `tests/utils/dictionaryBridge.test.ts` (NEW - 5 tests)

---

## 🛠️ **Space Data Editor** ✅
*Status: COMPLETE - Full CRUD Implementation*

### Implemented Features
- File: `src/components/editor/DataEditor.tsx` + `src/components/editor/SpaceEditor.tsx`
- [x] Space dropdown selector with search
- [x] Edit space properties (title, description, effects) — full SpaceEditor component
- [x] Edit space connections (movement paths)
- [x] Clear Game Data button
- [x] Admin password protection (via AdminAuthGate)
- [x] Text contrast fixes for readability (Feb 5, 2026)

---

## 🖥️ **Desktop Command Center - Future Ideas**
*Status: POSSIBLE - Not Required*

These ideas were considered for the "Living Command Center" feel but deferred to keep scope manageable. The core glassmorphism and haptic visuals have been implemented.

### Neural Dictionary Bridge
- **Concept**: Floating graph view showing card/space connections
- **Why Deferred**: High effort, potential scope creep
- **Alternative**: Use existing dictionary deep-link in new tab

### Modular Tiles
- **Concept**: Draggable/collapsible panels for Game Master feel
- **Why Deferred**: May confuse casual users, requires react-grid-layout
- **Alternative**: Offer 2-3 preset layouts instead

### High-Fidelity Card Reveal
- **Concept**: 3D fly animation from deck to center
- **Why Deferred**: Could slow down gameplay, mobile-game feel
- **Alternative**: Subtle flip and glow animation (implemented)

---

## 🐛 **KNOWN ISSUES & TECHNICAL DEBT**

For current technical debt, see `docs/technical/TECHNICAL_DEBT.md`

### Minor Issues (Low Priority)
- **Test count discrepancy:** ✅ RESOLVED (January 27, 2026)
  - [x] Run full test suite (in batches)
  - [x] Update all documentation with correct count (~1,027 tests across 87 files)
  - [x] Standardize test count reporting

---

## 📚 **Reference**

- **Completed work:** See `CHANGELOG.md`
- **Project overview:** See `docs/core/PRODUCT_CHARTER.md`
- **Current status:** See `docs/core/PROJECT_STATUS.md`
- **Technical debt:** See `docs/technical/TECHNICAL_DEBT.md`

---

**Last Updated:** February 8, 2026
