# Technical Debt Log

This document tracks identified technical debt in the `code2027` codebase.

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

---

## In Progress

### `usedTryAgain` Flag in Player State
- **Status**: 🟡 In Progress (Refactor underway)
- **Description**: The "Try Again" feature was implemented using a persistent `usedTryAgain` boolean flag on the core `Player` state object. This proved to be a brittle, bug-prone pattern, as it required multiple, disparate functions (`rollDiceWithFeedback`, `handleAutomaticFunding`, etc.) to remember to manually clear the flag.
- **Impact**: This led to inconsistent state management, duplicate code, and hard-to-trace bugs where the flag was not cleared in all code paths (e.g., `triggerManualEffectWithFeedback`).
- **Resolution**: The flag is being removed from the core data model. The logic is being refactored to use a short-lived, ephemeral state variable in the `GameLayout.tsx` UI component, which passes a `skipAutoMove` parameter to the `endTurnWithMovement` function. This correctly separates UI state from core game state.
