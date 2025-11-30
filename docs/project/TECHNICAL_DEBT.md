# Technical Debt Log

This document tracks identified technical debt in the Game Alpha codebase.

## Recently Resolved ✅

### CSV-Based Movement System Data Corruption (November 14, 2025)
- **Status**: ✅ Resolved
- **Issues Fixed**:
  - REG-FDNY-FEE-REVIEW destination corruption (question text → valid space names)
  - Dice movement false positives (41 → 18 spaces, game no longer stuck at start)
  - REG-DOB-TYPE-SELECT path switching (implemented pathChoiceMemory for DOB compliance)
  - Missing validation in data processing pipeline
- **Resolution**:
  - Implemented path-first decision tree in data/process_game_data.py
  - Enhanced is_valid_space_name() with stricter regex validation
  - Added pathChoiceMemory to Player interface for regulatory compliance
  - Created validate_movement_data.py for ongoing data integrity checks
- **Test Coverage**: 21 new/restored tests (7 pathChoiceMemory + 14 regression tests)
- **Impact**: Game progression now works correctly from start, all critical spaces validated
- **Reference**: See [Movement Refactor Plan](../archive/MOVEMENT_REFACTOR_PLAN-20251114.md) for detailed problem analysis and solution design

### `usedTryAgain` Flag Refactoring (November 27-28, 2025)
- **Status**: ✅ Resolved
- **Description**: The "Try Again" feature was previously implemented using a persistent `usedTryAgain` boolean flag on the core `Player` state object. This proved to be a brittle, bug-prone pattern, as it required multiple, disparate functions (`rollDiceWithFeedback`, `handleAutomaticFunding`, etc.) to remember to manually clear the flag.
- **Resolution**: The flag has been removed from the core data model. The logic now uses ephemeral state management - a short-lived state variable in the UI component passes parameters to `endTurnWithMovement()` function. This correctly separates UI state from core game state and eliminates the bug-prone manual flag clearing.
- **Files Modified**: NextStepButton.tsx, PlayerPanel.tsx
- **Test Impact**: All 958 tests continue passing after refactor
- **Reference**: See [Project Status](./PROJECT_STATUS.md#4-documentation-review--consolidation-november-28-2025-) for implementation details

---

## High Priority Refactoring Candidates

- **TurnService.ts (2,421 lines)**
  - **Suggestion:** Could be split into smaller, more focused services (e.g., TurnPhaseService, EffectProcessingService, TurnValidationService).
  - **Impact:** High - central service, complex logic.
  - **Risk:** High - touches many systems.

- **EffectEngineService.ts (1,589 lines)**
  - **Suggestion:** Could be split into smaller services based on effect types.
  - **Impact:** High - central service for game logic.
  - **Risk:** Medium - can be refactored incrementally.
