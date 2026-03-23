# Project Status

**Last Updated**: March 23, 2026
**Current Phase**: Pre-Beta — Editor Hardening (v2.34.1)
**Current Version**: 2.34.1

This document provides a high-level overview of the current work status for the Game Alpha project.

---

## Recently Completed

### Bug Fix: REG-DOB-TYPE-SELECT (March 23, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.34.1
- **Changes**: Fixed players permanently stuck at DOB Path Selection on subsequent visits — destination columns had placeholder text instead of actual space IDs

### Code Audit Sprint — Full (March 23, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.34.0
- **Changes**:
  - Phase 1: Deleted 37 unused files (~50+ KB) — MobilePlayerPanel, CardPortfolioDashboard, MovementPathVisualization, FinancialStatusDisplay, DiceRoller, PlayerViewStateService, financial subcomponents. Removed dead placeholder UI in GameLayout.
  - Phase 2: TurnService decomposed — extracted TurnTransitionHandler (218 lines) and MovementExecutor (141 lines). TurnService 2,148 → 1,984 lines.
  - Phase 3: Added 8 structured CSV columns to CARDS_EXPANDED.csv replacing regex parsing. Updated EffectFactory + CardService with structured-data-first, legacy-fallback approach. Fixed 6 incorrect tick_modifier values.
  - Test count: 1393 tests across 86 files (all passing)

### Code Audit Cleanup Sprint (March 22, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.33.6
- **Changes**:
  - Removed ~5,200 lines of dead code: PlayerPanel, TurnControlsWithActions, PlayerStatusPanel, PlayerStatusItem, NextStepButton, ProgressBarMap (6 source + 5 test files)
  - Cleaned GameLayout (dead imports) and GameBoard (unused state, debug logs)
  - Fixed mobile panel visibility — connected players' panels now hide on host screen
  - Added 9 player panel visibility tests, 6 ActionCenterPanel negotiate button tests

### L Card Dice Condition Fix (March 21, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.33.4
- **Changes**:
  - L card effects now have `dice_roll_N` condition — 1-in-6 chance per space
  - Previously fired on every arrival due to empty condition column

### Negotiate Button Visibility Fix (March 21, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.33.3
- **Changes**:
  - Negotiate button now shows on negotiable spaces even with 0 completed actions
  - Added ActionCenterPanel component tests (6 tests)

### Owner Funding: Fix Double Money Bug (March 21, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.33.2
- **Changes**:
  - Removed auto B/I card draws from OWNER-FUND-INITIATION (was double-counting money)
  - Added safety net in CardService to skip B/I card money at this space
  - Moved notification placement below story, above PM action

### Editor Preview: Single-Destination Auto-Move Fix (March 21, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.33.1
- **Changes**:
  - Editor preview shows "NEXT DESTINATION (auto-move)" for single-destination spaces
  - "CHOOSE YOUR DESTINATION" only shown for 2+ destinations, matching game behavior

### Space Data Editor: Card Labels, Title, Path, Preview (March 18, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.33.0
- **Changes**:
  - 5 new CSV columns for custom card button labels (w/b/i/l/e_card_label)
  - Title field moved to header bar (inline editable between space name and 1st/Sub toggle)
  - Path Type dropdown moved to Movement section
  - Negotiate-based preview: Try Again button hidden when Negotiate=NO
  - Card button labels flow through processGameData to SPACE_EFFECTS.csv description field
  - 27 regression tests covering all editor sections and field types

### BoardV3 — SVG Arrows & Pre-Allocated Layout (March 16, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.32.0
- **Changes**:
  - Migrated standalone BoardV3 prototype to React production component
  - Pre-allocated 190px slots eliminate layout shift on hover/expand
  - SVG arrow system with 3-pass routing: obstacle avoidance, parallel line separation, rounded corners
  - Data-driven path built from CSV via buildGamePathFromData()
  - DataService adapter layer converts typed objects to boardLayout string-indexed types
  - 83 unit tests for pure logic in boardLayout.ts
  - Replaces ProgressBarMap in GameLayout
  - Owner/Funding phase group headers removed for cleaner board

### Codebase Audit & Cleanup — Pre-Beta Hardening (March 10, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.31.0
- **Changes**:
  - 20 code issues identified and fixed (duplicates, dead code, stale config, missing implementations)
  - Merged MovementChoiceManager → MovementService, DiscardedCardsModal → DiscardPileModal
  - Created centralized DebugMode utility, consolidated remoteConfig.ts
  - CSS deduplication (@keyframes centralized), button colors moved to CSS variables
  - Build target changed to es2020 for TV browser compatibility
  - 8 test files fixed (0 regressions), DataEditor tests updated for current UI
  - Documentation cross-referenced and updated (ARCHITECTURE.md, CLAUDE.md, TODO.md, TESTING_GUIDE.md)
  - All 1398 tests passing (93 files, 0 failures), TypeScript clean, production build clean

### Snake Map — Fixed-Width Slot Grid (March 3, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.31.0
- **Changes**:
  - Complete rewrite of ProgressBarMap with fixed-width 120px slot grid layout
  - Calculated fork vertical lines using explicit `<div>` elements (replaces CSS pseudo-elements)
  - Fixed-height fork branches (36px) with overflow:visible — no more stubs on hover/click
  - U-turn connections via spacer/entry CSS extensions through 6px gap
  - Three tile states: compact (74px), hover (100px), expanded/current (120px)
  - Phase groups, direction arrows, fork dimming, visited content, player avatars
  - Adaptive row splitting based on container width

### UI Enhancements: Glossary, Active Indicators, Back Button, TV Mode (February 28, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.30.1
- **Changes**:
  - Browser back button closes topmost modal/panel instead of navigating away
  - TV mode navigates in same tab with toggle behavior; "Back to PC" button in TV header
  - Glossary button in toolbar opens/closes dictionary panel
  - Active indicators (green dot + glow) on Rules, Log, View, Glossary buttons
  - ActionButton `isActive` prop with green ring + dot CSS
  - Rules button now toggles instead of always opening

### NPC Character Identity System (February 28, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.30.0
- **Changes**:
  - Random visual appearance (ethnicity + gender) assigned to 9 NPC roles at game start
  - Shared character constants (`src/constants/characters.ts`) — single source of truth
  - Portrait images with "X says:" labels in story sections and modals
  - Separate PM Action section with player avatar for gameplay instructions
  - Board tile zone indicators (colored left border + NPC emoji)
  - `npcAppearances` stored in GameState, synced via ServerSyncService
  - Backward compatible — old saves gracefully fall back to emoji-only

### SOURCE_FILES/CLEAN_FILES Data Sync (February 28, 2026) ✅
- **Status**: ✅ Complete
- **Changes**:
  - Synced SOURCE_FILES (Data Editor) with CLEAN_FILES (game) — 30 rows had diverged
  - Regenerated CLEAN_FILES from SOURCE_FILES via processGameData pipeline
  - Editor changes now correctly flow through to the game on save and deploy

### Docker Container Hardening (February 24, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.29.1
- **Changes**:
  - Isolated Docker network (`game-net`) — no access to other containers
  - Read-only filesystem with tmpfs for /tmp
  - All Linux capabilities dropped, privilege escalation blocked

### Character Voice Narration — Phase 1 (February 22, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.29.0
- **Changes**:
  - Web Speech API narration with 6 distinct character voice profiles
  - SpeechService module with speak/stop/replay/mute + localStorage persistence
  - useModalSpeech hook for modal open/close lifecycle
  - CharacterBadge component showing character identity in modals
  - Speech controls (stop/replay/mute) in ModalBase header
  - DiceResultModal and ChoiceModal integration
  - 12 CSV rows rewritten to first-person character voice
  - Build clean, all 1344 tests passing (1 pre-existing flaky perf test)

### Security Hardening & Production Cleanup (February 13, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.28.1
- **Changes**:
  - 586 console.log statements removed from 16 service/component files
  - CORS restricted to specific origins (game.unravelcodes.com + localhost)
  - Security headers added (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
  - Debug endpoints require admin auth
  - Path traversal fixed in feedback endpoint
  - Error messages sanitized (no internal details leaked)
  - Source maps disabled in production
  - TypeScript strict check passes clean
  - All 1316 tests passing (88 files, 0 failures)

### Data Editor Input Helpers & Space Management (February 12, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.28.0
- **Changes**:
  - Card effect combobox with presets (Draw 1-3, Remove 1, Replace 1, No change)
  - Time/Fee number spinners with auto-formatting
  - LOGIC condition builder (Question + YES/NO destinations)
  - Add/Delete spaces with validation and confirmation
  - Reset to Baseline: Dockerfile BASELINE copy + server endpoint + UI button
  - Smart dice roll inputs: context-aware controls per die_roll category
  - Removed Clear Game Data and Export buttons (replaced by Reset to Baseline + Save)

### Live Save for Data Editor (February 12, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.27.3
- **Changes**:
  - Server-side save endpoint writes SOURCE_FILES and regenerates CLEAN_FILES
  - JS port of Python data processing scripts (runs in Docker Alpine)
  - Save button + Ctrl+S shortcut in Data Editor with inline status feedback
  - Export button kept as secondary local backup option

### Data Editor Visual Redesign (February 10, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.27.2
- **Changes**:
  - SpaceEditor reorganized into player-flow-matched fieldsets with colored borders
  - Live Player Preview panel shows story, effects, button labels, destinations
  - Card fields use colored emoji badges and type-tinted backgrounds
  - Button Labels Preview fieldset shows computed End Turn/Try Again labels

### Narrative UX Enhancements (February 10, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.27.1
- **Changes**:
  - Dice modals show space titles with narrative story summaries
  - Card effects use friendly names (Work Packages, Bank Loans, etc.)
  - End Turn button context-sensitive on negotiable spaces
  - Try Again → Negotiate on negotiable spaces

### Merged Landing + Lobby Screen (February 10, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.27.0
- **Changes**:
  - LandingPage and GameLobby merged into single 3-panel screen
  - Mode toggle (PC/TV) embedded in New Game panel
  - Admin-locked Browse Games panel with auto-refreshing game list
  - Deleted LandingPage.tsx, simplified App.tsx routing

### Redistribute Cards Across Tabs (February 9, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.26.0
- **Changes**:
  - Cards tab replaced by Expeditors (E cards) and Events (L cards) tabs
  - B/I funding cards now shown in Money tab
  - Thematic action labels (Hire Expeditor, Get Bank Loan, etc.)
  - New EventsSection component for L cards with active effects display

### TV Rules & Interactive Funding (February 9, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.25.2
- **Changes**:
  - Rules button added to TV display header for first-time players
  - Owner Funding space now interactive (manual trigger instead of auto)

### Bug Fixes from Playtesting (February 9, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.25.1
- **Fixes**:
  - Dice roll button missing on 6 REG- spaces (stuck turn bug)
  - Design Fees text wrapping on TV mode (960x540)
  - Space titles replaced with proper English names (all 54 rows)

### Feature: Fullscreen, Pull-to-Refresh, Board Zoom/Pan (February 8, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.25
- **Features**: Fullscreen toggle, pull-to-refresh on mobile, pinch/wheel zoom + drag pan on game board
- **Achievements**:
  - Fullscreen button in toolbar using Fullscreen API
  - PullToRefresh wrapper component with haptic feedback
  - Board zoom (0.5x–2.5x) with pinch, wheel, and overlay controls
  - Pan constrained to board bounds; double-tap/click resets

### Feature: Bug Report Button with Screenshot Capture (February 8, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.24
- **Features**: Floating draggable bug button, screenshot capture, feedback form, server storage
- **Achievements**:
  - html2canvas screenshot capture on click
  - Draggable button (zIndex 2500), ModalBase form with 3 fields + metadata
  - Server endpoints: POST/GET /api/feedback with ntfy notifications
  - Reports saved as JSON in server/data/feedback/

### UI: Consolidate Display Settings Modal (February 8, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.23
- **Features**: Per-player cards with all controls consolidated
- **Achievements**:
  - Merged 3 separate sections into unified per-player card list
  - Each card: visibility toggle, connection badge, QR/mobile controls, player-colored border
  - Quick presets moved to top, localhost warning shown once

### Security: Restrict Data Editor + Kill Game + Mobile Setup View (February 7, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.22
- **Features**: Data Editor restricted to main menu, in-game Kill Game button, simplified mobile setup
- **Achievements**:
  - Removed Data Editor access from in-game ProjectProgress (security fix)
  - ☠️ Kill Game button with admin password auth + confirmation dialog
  - Mobile players scanning QR during SETUP see only their own player card
  - "Waiting for host to start..." pulsing message on mobile setup

### UI Polish: Button Sizing, Tab Visibility, Conditional Renegotiate (February 7, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.21
- **Features**: Equal-size turn buttons, reference tabs visibility fix, conditional Renegotiate
- **Achievements**:
  - End Turn and Renegotiate buttons both flex: 1 with min-height: 48px
  - "Actions remaining" moved inside End Turn button as subtitle
  - Reference section changed to flex: 0 1 auto (no longer pushed off-screen)
  - Renegotiate hidden until completedActionCount > 0

### Playtest Polish: Thematic Buttons, Funding Display, Multi-Player Panel Fix (February 7, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.20
- **Features**: Thematic button names, persistent funding display, multi-player panel collapse, Try Again state fix
- **Achievements**:
  - OWNER-SCOPE-INITIATION buttons renamed to thematic narrative labels
  - Try Again → "Renegotiate — I'll take more time"
  - Auto effect results (owner seed money) shown persistently in green box
  - Multi-player on same PC: current player gets full panel, others collapse to mini bar
  - TurnStateManager always captures REAL state snapshot before space effects
  - Mobile overflow fixes (width, tab height capping)

### Unified Action Center Player Panel (February 6, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.19
- **Features**: Single unified panel replacing desktop + mobile, 3-zone decision-priority layout
- **Achievements**:
  - ActionCenterPanel with Context/Actions/Reference zones
  - E card callout with gold pulse when playable cards available
  - Per-player filtered log tab
  - `renderMode` prop on section components for tab rendering
  - Same component on all screen sizes (responsive CSS)
  - All 1319 tests passing (88 files, 0 failures)

### Player Card Layout: Inline QR Codes + Compact Design (February 5, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.18
- **Features**: Horizontal player cards, always-visible QR codes, compact name input
- **Achievements**:
  - QR code inline to the right of player info (no toggle button)
  - Name input width matched to color picker circles
  - "Optional: scan for personal screen" note under QR
  - Compact "Mobile" badge for connected players

### Admin Password Protection for Data Editor (February 5, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.17
- **Features**: Server-side password verification, frontend auth gates, sessionStorage auth
- **Achievements**:
  - `POST /api/admin/verify` endpoint with SHA-256 + timing-safe comparison
  - PlayerSetup admin tools locked behind password prompt
  - DataEditor wrapped with AdminAuthGate component
  - Configurable via `ADMIN_PASSWORD_HASH` env var in docker-compose
  - All 1319 tests passing (88 files, 0 failures)

### PlayerSetup Horizontal Layout + Compact TV + Test Performance (February 5, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.16
- **Features**: Horizontal setup screen, compact TV progress, vitest projects for fast tests
- **Achievements**:
  - PlayerSetup: 2-panel horizontal layout (Players | Settings/Admin/Start) for TV/wide screens
  - ProjectProgress compact mode for TV display (reduced padding, hidden goal banner)
  - Test suite: ~28 min → ~80s via vitest `test.projects` (vmThreads + forks pools)
  - Fixed E012/E066 integration tests (missing effect handlers, wrong dice mocking)
  - All 1319 tests passing (88 files, 0 failures)

### Landing Page Flow Fixes + TV Display + Editor Contrast (February 5, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.15
- **Features**: Fixed landing page button flows, full ProjectProgress on TV, editor readability
- **Achievements**:
  - Host Game auto-creates game and redirects (no lobby)
  - TV Display shows only game picker; TV mode renders full ProjectProgress panel
  - Autocomplete prevention on game code inputs
  - EndGameModal and DataEditor navigate to root landing page
  - Space Data Editor text contrast improvements across all editor components

### Mobile UI Polish with Animations & Theme System (January 25, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.12
- **Feature**: Enhanced mobile experience with native-feeling animations, theme support, and haptics
- **Achievements**:
  - **framer-motion Integration**: Spring physics for DetailSheet drag gestures
  - **Theme System**: CSS custom properties for light/dark mode with system preference detection
  - **Haptic Feedback**: Web Vibrations API for button presses and turn notifications
  - **CSS Fixes**: 100dvh viewport, safe areas for notched devices, 2x2 grid fallback
  - **Landscape Mode**: Side-by-side layout for phones in landscape orientation
  - **Touch Targets**: Material Design compliant (56dp tabs, 44px touch targets)
  - **Test Fixes**: Updated 8 test files for emoji+text split element assertions
- **Files Added**:
  - `src/styles/mobile-theme.css` - Theme CSS variables
  - `src/utils/haptics.ts` - Web Vibrations API utility
- **Test Status**: All ~1,027 tests passing (306 component + 564 services + 157 E2E/regression/other)

### Mobile PlayerPanel Redesign (January 24, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.11.1
- **Feature**: Context-aware mobile UI architecture with state machine design
- **Achievements**:
  - **PlayerViewStateService**: 5 view states (STORY, ACTION, DECISION, WAITING, SUMMARY)
  - **New Mobile Components**: MobilePlayerPanel, SpaceHeader, StatsBar, PrimaryAction, ContextArea
  - **DetailSheet**: Draggable bottom sheet with 5 tabs (Finances, Time, Cards, Scope, Log)
  - **PlayerPanelWrapper**: Responsive wrapper switches at 768px breakpoint
- **Files Added**: 16 new files
- **Test Status**: 43 new tests

### Universal Dictionary Integration (January 24, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.11
- **Feature**: Bidirectional bridge between Game and Dictionary Dashboard
- **Achievements**:
  - "View Intelligence" buttons in CardDetailsModal and SpaceExplorerPanel
  - URL preview support for dictionary → game deep links
  - New utility: `src/utils/dictionaryBridge.ts`
- **Test Status**: 5 new tests

### Same Starting Point Game Mode (January 16, 2026) ✅
- **Status**: ✅ Complete (Quick Start mode)
- **Version**: 2.11
- **Feature**: New game mode for fair skill-based comparison - all players start with identical cards
- **Achievements**:
  - **Per-Player Deck System**: Each player gets their own deck copy with identical shuffle order
  - **Seeded Shuffle**: Linear Congruential Generator (LCG) ensures reproducible deck order
  - **Quick Start Mode**: P1's natural draws become starting hand for ALL players
  - **Game Mode UI**: Checkbox and radio buttons in PlayerSetup.tsx
  - **Backward Compatible**: Default Battle Royale mode unchanged
- **Files Modified**:
  - `src/types/StateTypes.ts` - GameMode, StartingMode types, Decks/DiscardPiles interfaces
  - `src/types/ServiceContracts.ts` - Updated IStateService.startGame() signature
  - `src/services/StateService.ts` - seededShuffle(), startGameSameStart()
  - `src/services/CardService.ts` - Per-player deck draw/discard support
  - `src/services/TurnService.ts` - finalizeQuickStartHand() method
  - `src/components/setup/PlayerSetup.tsx` - Game mode UI controls
  - `src/components/setup/usePlayerValidation.ts` - Extended GameSettings interface
  - `src/components/layout/GameLayout.tsx` - Pass game mode settings to startGame()
- **Test Status**: All 108 related tests pass (StateService: 51, CardService: 30, TurnService: 27)
- **Pending**: Educational mode CardSelectionModal (Phase 3)

### Bug Fixes & UI/UX Improvements (January 15, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.10
- **Achievements**:
  - **Card Pickup Logging**: Fixed game log not showing card pickup events
    - Replaced legacy `window.addActionToLog` with proper LoggingService pattern
    - Updated CardEffectHandler and FinancialEffectHandler to use injected loggingService
  - **Uniform Card Viewers**: Made card viewers consistent across player panel and exchange modal
    - Extended CardDisplay component with selectable mode props
    - Refactored CardReplacementModal to use CardDisplay component
  - **Single-Destination Movement Fix**: Fixed "eCard button exists but no movement buttons" bug
    - Added fallback "Continue to [destination]" button for fixed-destination spaces
    - Works for spaces like BANK-FUND-REVIEW and INVESTOR-FUND-REVIEW
  - **Funding History Tracking**: Enhanced Sources of Money section to show per-card details
    - Added FundingEntry interface to DataTypes.ts
    - Added fundingHistory field to Player interface
    - ResourceService now records individual card contributions
    - SourcesOfMoneySection displays breakdown by funding source and card
- **Files Modified**:
  - `src/services/CardEffectHandler.ts` - LoggingService integration
  - `src/services/FinancialEffectHandler.ts` - LoggingService integration
  - `src/context/ServiceProvider.tsx` - Pass loggingService to handlers
  - `src/components/common/CardDisplay.tsx` - Added selectable mode
  - `src/components/modals/CardReplacementModal.tsx` - Use CardDisplay
  - `src/components/game/TurnControlsWithActions.tsx` - Single-destination button
  - `src/components/game/financial/SourcesOfMoneySection.tsx` - Funding history display
  - `src/services/ResourceService.ts` - Record funding history
  - `src/services/StateService.ts` - Initialize fundingHistory
  - `src/types/DataTypes.ts` - FundingEntry interface
- **Test Player Bug Reports**: ALL FIXED ✅
  - eCard issues (Jan 13) ✅
  - UI/UX issues (Jan 15) ✅
  - Funding display issues (Jan 15) ✅

### Service Extraction & Handler Pattern Refactoring (January 12-13, 2026) ✅
- **Status**: ✅ Complete
- **Version**: 2.6
- **Achievements**:
  - **ServerSyncService Extraction**: Extracted ~130 lines of network sync code from StateService
    - Created `src/services/ServerSyncService.ts` (215 lines)
    - Implemented StateProvider callback pattern for decoupling
    - Features: debounced sync (500ms), version tracking, graceful degradation
  - **EffectEngineService Handler Pattern**: Delegated effect processing to specialized handlers
    - FinancialEffectHandler: RESOURCE_CHANGE, FEE_DEDUCTION effects
    - CardEffectHandler: CARD_DRAW, CARD_DISCARD, CARD_ACTIVATION, PLAY_CARD effects
  - **Legacy Fallback Removal**: Removed 551 lines of duplicate legacy code from EffectEngineService
    - Service reduced from 2,104 to 1,553 lines (26% reduction)
    - Required handler enforcement (throws error if handler not set)
  - **Test Updates**: Updated EffectEngineService tests to initialize handlers in beforeEach blocks
- **Files Modified**:
  - `src/services/ServerSyncService.ts` - New file
  - `src/services/EffectEngineService.ts` - Legacy fallback removal
  - `tests/services/EffectEngineService.test.ts` - Handler setup in 4 beforeEach blocks
- **Test Status**: All 29 EffectEngineService tests pass, all 51 StateService tests pass
- **Impact**: Cleaner architecture, better separation of concerns, easier testing

---

### 0a. Multi-Device Bug Fixes & Mobile UX (December 29, 2025 - Evening) ✅
- **Status**: ✅ Complete
- **Version**: 2.4
- **Achievements**:
  - **Critical Bug Fix**: Multi-device state sync race condition
    - Problem: Phones with stale state could overwrite laptop's newer state
    - Fix: Version tracking + server rejection of stale updates (HTTP 409)
    - Test Added: `tests/regression/MultiplayerStateIsolation.test.ts`
  - **Mobile Quick Stats Bar**: Shows Money, Time, Cards, Scope at top of phone screen
  - **Sticky Action Button**: End Turn/Roll Dice fixed at bottom on mobile
  - **Card Display Improvements**: Cards now shown one per line with type emojis
  - **Game Code Display**: Visible on setup screen and in-game header
  - **Mid-Game QR Codes**: Can connect mobile devices via Display Settings after game starts
  - **Server Improvements**: Reduced logging, fixed dev/production path config
- **Files Modified**:
  - `src/services/StateService.ts` - Version tracking
  - `src/types/ServiceContracts.ts` - Interface updates
  - `src/App.tsx` - Version passing
  - `server/server.js` - Reject stale updates, path fixes
  - `src/components/player/PlayerPanel.tsx` - Quick stats, sticky button
  - `src/components/player/PlayerPanel.css` - Mobile styles
  - `src/components/modals/DiceResultModal.tsx` - Card display
  - `src/components/setup/PlayerSetup.tsx` - Game code display
  - `src/components/game/ProjectProgress.tsx` - Game code badge
  - `src/components/settings/GameDisplaySettings.tsx` - QR codes
  - `Dockerfile` - Production environment variables

### 0. Deployment & Multi-Game Support (December 29, 2025) ✅
- **Status**: ✅ Complete
- **Milestone**: **EXTERNAL TESTING INFRASTRUCTURE READY**
- **Achievements**:
  - **Docker Deployment**: Containerized app deployed to Unraid server
  - **External Access**: `https://game.unravelcodes.com`
  - **Multi-Game Sessions**: Server supports G1, G2, G3... independent games
  - **Game Persistence**: Auto-save to file, survives restarts
  - **Game Expiration**: 24-hour inactivity cleanup
  - **Visitor Logging**: IP, device, timestamps, actions tracked
  - **Push Notifications**: ntfy.sh integration for real-time alerts
  - **Rebranding**: "Unravel Codes: The Game" with logo and alpha notice
- **New Components**:
  - `src/components/setup/GameLobby.tsx` - Create/join game UI
  - `server/server.js` - Multi-game server with persistence & notifications
  - `Dockerfile`, `docker-compose.yml` - Container deployment
- **New API Endpoints**:
  - `GET /api/games` - List active games
  - `POST /api/games` - Create new game
  - `GET/POST /api/games/:gameId/state` - Game-specific state
  - `GET /api/logs` - Visitor logs
  - `GET /api/logs/summary` - Daily activity summary
- **Remaining**:
  - Configure ntfy for instant push (phone background settings)
  - ~~Set up game.unravelcodes.com subdomain~~ ✅ Done via Cloudflare

### 1. E2E Game Loop Verification & Bug Fixes (December 28, 2025) ✅
- **Status**: ✅ Complete
- **Milestone**: **GAMEPLAY PRODUCTION READY** - Full game verified from START to FINISH
- **Achievements**:
  - **Full Playthrough Verified**: 17-turn "Golden Path" from OWNER-SCOPE-INITIATION to FINISH
  - **Win Condition Validated**: Landing on FINISH triggers Game Over correctly
  - **Bug #1 Fixed**: moveIntent Persistence - Old movement intent from multi-path choices persisted incorrectly
    - Fix: Clear moveIntent in clearTurnActions() and when switching players
  - **Bug #2 Fixed**: Manual Action Completion Keys - `cards:replace_E` not matching
    - Fix: Expanded matching to support compound, simple, action keys + case-insensitive
  - **Bug #3 Documented**: Implicit Dice Movement - Spaces with dice movement but no manual dice effects
    - Production uses `requires_dice_roll=Yes` config; needs further UI verification
  - **E2E Tests Added**: E2E-LogicPlaythrough.test.ts (logic-level), E2E-FullGame.test.tsx (UI-level)
  - **Test Mocks Fixed**: Added missing clearPlayerMoveIntent to mock services
- **Files Modified**:
  - `src/services/MovementService.ts` - Clear moveIntent after move
  - `src/services/StateService.ts` - Add clearPlayerMoveIntent(), expand action matching
  - `src/services/TurnService.ts` - Clear moveIntent on turn switch, multi-key registration
  - `tests/mocks/mockServices.ts`, `tests/services/TurnService.test.ts` - Fix missing mock
- **Test Status**: 483 service tests, 266 component tests, 56 E2E tests (805 total)
- **Impact**: Game loop is now verified end-to-end, ready for external UAT

### 1a. Multiplayer Testing Verification (December 28, 2025) ✅
- **Status**: ✅ Complete
- **E2E Tests Added**:
  - `E2E-AllPaths.test.ts` - 10 tests covering all decision points
  - `E2E-Multiplayer2P.test.ts` - 10 tests for 2-player games
  - `E2E-Multiplayer4P.test.ts` - 12 tests for 3-4 player games
- **Verifications**:
  - Turn switching between 2, 3, and 4 players
  - State isolation (each player's cards, money, position separate)
  - All players can take different paths (ARCH, LEND, CHEAT)
  - Player order preserved throughout game
- **Test Status**: 80 E2E tests passing, 1 skipped (flaky UI test)

### 1b. Multi-Device Testing Verification (December 28, 2025) ✅
- **Status**: ✅ Complete
- **E2E Tests Added**: `E2E-MultiDevice.test.ts` - 24 tests
- **Verifications**:
  - Short ID generation (P1, P2, P3, P4) for QR code URLs
  - URL routing (?p=P1 → player-specific view)
  - 4 devices accessing 4 different player views simultaneously
  - Host device sees full game board view
  - Case sensitivity and edge cases handled

### 2. Performance Optimization: Selective Subscriptions & Caching (December 27, 2025) ✅
- **Status**: ✅ Complete
- **Problem**: Console logs showed `calculateProjectScope` being called 50+ times per "End Turn" action due to re-render cascade
- **Solutions Implemented**:
  - **Service-Level Caching**: GameRulesService now caches `calculateProjectScope` results, invalidated only when player's cards change
  - **Selective Subscriptions**: New `subscribeWithSelector()` method in StateService allows components to specify exactly which state they need
- **Components Optimized**:
  - `NextStepButton.tsx` - Only responds to action-related state changes
  - `GameBoard.tsx` - Only responds to position/movement changes
- **Files Modified**:
  - `src/services/GameRulesService.ts` - Added projectScopeCache
  - `src/services/StateService.ts` - Added subscribeWithSelector() method
  - `src/types/ServiceContracts.ts` - Updated IStateService interface
  - `src/components/player/NextStepButton.tsx` - Selective subscription
  - `src/components/game/GameBoard.tsx` - Selective subscription
- **Impact**: Significantly reduced re-render cascade during turn transitions

### 2. Dice Consolidation & REAL/TEMP State Model (December 26, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Consolidate 3 dice condition paths into 1 unified approach
  - Implement explicit REAL/TEMP state model for turn management
  - Remove old snapshot system and dead code
- **Achievements**:
  - **Part 1: Dice Condition Consolidation**:
    - Removed `applyDiceRollChanceEffect()` dead code (~77 lines)
    - Eliminated "if you roll a X" text parsing from descriptions
    - Migrated 40 CSV rows to use `dice_roll_X` condition column
    - Added `ConditionEvaluator.anyEffectNeedsDiceRoll()` helper
    - Updated `filterSpaceEffectsByCondition()` with optional `diceRoll` parameter
  - **Part 2: REAL/TEMP State Model**:
    - Implemented explicit state separation (REAL = committed, TEMP = working)
    - Added `createTempStateFromReal()`, `commitTempToReal()`, `discardTempState()`
    - Added `applyToRealState()`, `hasActiveTempState()`, `getTryAgainCount()`
    - Removed ~160 lines of old snapshot code
    - Simplified Try Again flow - no more conditional effect processing
  - **Code Impact**:
    - TurnService.ts: -113 lines (removed snapshot logic, text parsing)
    - StateService.ts: net reduction after removing old snapshot methods
    - Tests: 483 service tests passing
- **Files Modified**:
  - `src/services/TurnService.ts`, `src/services/StateService.ts`
  - `src/types/StateTypes.ts`, `src/types/ServiceContracts.ts`
  - `src/utils/ConditionEvaluator.ts`, `public/data/CLEAN_FILES/SPACE_EFFECTS.csv`
  - Multiple test files updated for new REAL/TEMP model
- **Impact**: Cleaner architecture, unified dice handling, explicit state lifecycle

### 2. Turn Flow Documentation & Architecture Analysis (December 25, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Document the complete turn processing flow with visual diagrams
  - Identify architectural improvements for state management
  - Document dead code and consolidation opportunities
- **Achievements**:
  - **Visual Diagrams Created**:
    - `TURN_FLOW_DIAGRAM.mmd` - Current implementation with effect processing pipeline
    - `TURN_FLOW_DIAGRAM_ASPIRATIONAL.mmd` - Proposed Real + Temporary State architecture
    - `current_process.drawio` - Draw.io version with collapsible sections
  - **Technical Debt Documented**:
    - "Real + Temporary State Model" proposal - simplifies Try Again logic
    - "Dice Condition Consolidation" - identified 3 implementations, 1 is dead code
    - `applyDiceRollChanceEffect()` - dead code (0 CSV rows use `dice_roll_chance`)
  - **Documentation Updates**:
    - Updated TURN_PROCESSING_FLOW.md with diagram references and dead code notes
    - Updated ARCHITECTURE.md with snapshot management and diagram links
    - Added comprehensive proposals to TECHNICAL_DEBT.md
- **Files Created/Modified**:
  - New: TURN_FLOW_DIAGRAM.mmd, TURN_FLOW_DIAGRAM_ASPIRATIONAL.mmd, current_process.drawio
  - Updated: TURN_PROCESSING_FLOW.md, ARCHITECTURE.md, TECHNICAL_DEBT.md, PROJECT_STATUS.md
- **Impact**: Clear documentation of turn flow architecture, identified refactoring opportunities, visual diagrams for onboarding

### 2. UI Consolidation & Per-Player Metrics (December 21, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Move Project Timeline to per-player display
  - Consolidate Design Fee Cap to single location
  - Improve color scheme consistency
- **Achievements**:
  - **Project Timeline Per Player**: Moved from global to individual player cards
    - Shows days spent / estimated days, progress %, work types
    - Color coding: green (<75%), orange (75-100%), red (>100%)
  - **Design Fee Cap Consolidation**: Removed from FinancesSection, consolidated to ProjectProgress
    - Summary badge still shown in FinancesSection header
    - Detailed visualization only in ProjectProgress (reduces redundancy)
  - **4-Tier Color Scheme**: Design fee now uses 10%/15%/20% thresholds
  - **Tests Updated**: 4 new ProjectProgress tests, 6 obsolete tests removed
  - **Test Suite**: 720+ tests passing across all suites
- **Files Modified**: ProjectProgress.tsx, FinancesSection.tsx, ProjectProgress.test.tsx, FinancesSection.test.tsx

### 2. Bug Fix Sprint Part 2 - 5 Bugs Resolved (December 20, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Fix remaining bugs from UAT testing
  - Improve card selection UX
  - Add per-player financial metrics
- **Achievements**:
  - **Bug #7**: REG-DOB-PROF-CERT now skips choice for dice-based movement
  - **Bug #8**: Try Again button works in single player mode (skip leaving effects, preserve snapshot)
  - **Bug #9**: Movement overlay uses player color and appears at start of move
  - **Bug #10**: Return card button allows player to choose which card (CARD_SELECTION choice type)
  - **Bug #11**: Design fee cap bar added to Project Progress per player
- **Files Modified**: TurnService.ts, StateService.ts, CommonTypes.ts, PlayerPanel.tsx, ProjectProgress.tsx

### 3. Bug Fix Sprint Part 1 - 6 Bugs Resolved (December 20, 2025) ✅
- **Status**: ✅ Complete
- **Achievements**:
  - **Bug #1**: Owner seed money tracked correctly (uses 'owner' sourceType at OWNER-FUND-INITIATION)
  - **Bug #2**: Bankruptcy check added when spending exceeds project scope
  - **Bug #3**: Timeline bar moved from modals to Project Progress section
  - **Bug #4**: Phase bar never regresses (uses max phase from visited spaces)
  - **Bug #5**: PM-DECISION-CHECK E card uses give_E action with selection modal
  - **Bug #6**: Journey timeline shows days spent per space (uses spaceVisitLog)

### 4. Bug Fix Sprint - L Card Dice Logic & UI Improvements (December 19, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Fix L card always being drawn (dice check not working)
  - Add modal notifications for automatic actions
  - Fix End Turn stuck on "Processing..." issue
  - Add financial health indicators
- **Achievements**:
  - **L Card Dice Bug**: Fixed dice-conditional L card effects to properly roll and check dice
    - EffectFactory now skips "if you roll a X" effects (handled by TurnService)
    - TurnService rolls dice and only draws L card if roll matches required number
    - Result: 1-in-6 chance per space, as designed
  - **Modal Notifications**: Added event system for automatic L card draws
    - StateService emits AutoActionEvent when L card drawn
    - GameLayout subscribes and displays DiceResultModal
    - No modal for misses (life events are surprises)
  - **End Turn Timeout**: Added 15-second timeout with error notification
  - **Money Source Tracking**: B=owner, L=bank, I=investment
  - **Money vs Scope Color**: Red when money < scope, green otherwise
  - **Tests Added**: 4 new tests for dice-conditional L card logic
- **Files Modified**: StateService.ts, TurnService.ts, EffectFactory.ts, GameLayout.tsx, NextStepButton.tsx, FinancesSection.tsx, ServiceContracts.ts

### 2. UAT Bug Fix Sprint - 5 Critical Bugs Resolved (December 14, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Fix bugs discovered during internal UAT testing
  - Add comprehensive regression tests
  - Restore missing UI features
  - Ensure stability for external UAT
- **Achievements**:
  - **Bug #1**: Story text not showing on player panels (import path fix)
  - **Bug #2**: Drawing both B and I cards at OWNER-FUND-INITIATION (CSV condition fix)
  - **Bug #3**: Infinite loop causing "Maximum update depth exceeded" (state update guard)
  - **Bug #4**: Space Explorer Panel crash on info button click (valid moves calculation fix)
  - **Bug #5**: START-QUICK-PLAY-GUIDE showing on game board (filter condition fix)
  - **Regression Tests**: 11 new tests added (3 GameRulesService, 8 GameBoard)
  - Test suite status: 90/90 tests passing (100%)
  - All fixes user-verified and working correctly
- **Impact**: Game stability significantly improved, ready for external UAT, comprehensive test coverage ensures issues won't recur

### 2. Technical Debt Cleanup - 11 Issues Resolved (December 6, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Resolve all 11 technical debt issues identified in December 5, 2025 analysis
  - Eliminate code duplication and dead code
  - Improve code quality and maintainability
- **Achievements**:
  - **Critical**: Fixed card effect double-application bug, fixed cost charging sequence
  - **Moderate**: Removed 194 lines of dead code, fixed loan interest model, project scope calculation, money source categorization, cost category semantics
  - **Low**: Added 125+ lines of architecture documentation, implemented safety limits
  - Test results: 615/~618 tests passing (99.5%)
  - 15+ files modified across services, types, and tests
- **Impact**: Cleaner codebase with better separation of concerns, comprehensive documentation of complex systems, improved code maintainability

### 2. Phase 1 Complete: TypeScript Strict Mode (November 30, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Eradicate all TypeScript strict mode errors.
  - Verify the entire test suite.
- **Achievements**:
  - Successfully resolved all 12 remaining TypeScript strict mode errors, achieving 0 errors.
  - Conducted a full test suite run, confirming 914 total tests.
  - 913 out of 914 tests are passing.
  - One test, `E2E-01_HappyPath.test.tsx`, has been marked as `.skip()` due to a pre-existing issue with the test infrastructure.
- **Impact**: The codebase is now fully compliant with TypeScript's strict mode, improving code quality and stability. Phase 1 of the finalization roadmap is complete.

### 2. Player Panel Button Fixes & Development Workflow (November 27-28, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Fix button positioning issues (buttons floating over game board)
  - Streamline development workflow for concurrent servers
  - Reduce TypeScript strict mode errors
- **Achievements**:
  - Fixed NextStepButton and TryAgainButton CSS positioning (position: static override in PlayerPanel.css)
  - Refactored NextStepButton to handle "End Turn" only (delegated roll actions to section buttons)
  - Installed `concurrently` package for dual-server startup with color-coded output
  - Reduced TypeScript errors from 28+ to 12 remaining
  - Created docs/archive/ directory and archived obsolete AI workflow documentation
- **Impact**: Cleaner UI, simplified development workflow, improved code organization

### 2. Multi-Device Features (November 24, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**:
  - Implement short URL system for QR codes
  - Add per-player panel visibility controls
- **Achievements**:
  - Added `shortId` field to Player interface (P1, P2, P3, etc.)
  - QR codes now use short URLs reducing URL length by ~90%
  - Implemented GameDisplaySettings component for panel visibility control
  - Added device detection badges (mobile vs desktop)
  - Smart layout adaptation: game board expands when panels hidden
  - localStorage persistence for settings across sessions
- **Impact**: Better user experience for multi-device scenarios, reduced QR code entry errors, classroom-friendly visibility controls

### 3. CSV-Based Movement System Refactor (November 14, 2025) ✅
- **Status**: ✅ Complete
- **Objectives**: Fix data corruption in movement CSV processing and implement path choice memory for regulatory compliance.
- **Achievements**:
  - Fixed REG-FDNY-FEE-REVIEW data corruption (LOGIC movement now returns valid space names)
  - Fixed dice detection false positives (41 → 18 dice spaces)
  - Implemented pathChoiceMemory for REG-DOB-TYPE-SELECT (DOB path locked per regulations)
  - Enhanced validation with path-first decision tree
  - Restored regression tests and added pathChoiceMemory test coverage (21 tests total)
  - Reorganized documentation structure (9 files moved to docs/archive/)
- **Impact**: Game progression now works correctly from start, all movement types validated, compliance with real-world DOB regulations

---

## Recently Completed (Continued)

### 4. Documentation Review & Consolidation (November 28, 2025) ✅
- **Status**: ✅ Complete
- **Objective**: Eliminate outdated information, remove redundancies, create smart documentation structure
- **Achievements**:
  - Updated PRODUCT_CHARTER.md with November 2025 status and accurate test coverage metrics
  - Fixed TECHNICAL_DEBT.md - moved usedTryAgain flag from "In Progress" to "Recently Resolved"
  - Created docs/archive/README.md index with 300+ line comprehensive guide
  - Added cross-references from active docs to archive documents
  - Updated README.md with audience-based documentation navigation
  - Added historical context sections to TECHNICAL_DEEP_DIVE.md and other major docs
- **Impact**: Documentation now current, organized, and maintainable with clear archive integration

---

## Current Status

**Phase 4 (Release Preparation)**: ✅ Complete — security audit, debug cleanup, typecheck, full test suite passing
**Next**: Phase 3B (External Testing) and Phase 5 (Public Release) — see TODO.md