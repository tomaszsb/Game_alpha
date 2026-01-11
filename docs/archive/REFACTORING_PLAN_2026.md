# Codebase Refactoring Plan

**Created:** January 11, 2026
**Status:** In Progress

## Executive Summary

Comprehensive analysis of the Game Alpha codebase reveals significant technical debt in the form of oversized files that violate single-responsibility principles. The analysis identified **39,345 total lines** across source files, with major concerns in 3 service files and 5+ component files.

---

## Current State Analysis

### Critical Files By Size

| File | Lines | Issues |
|------|-------|--------|
| **TurnService.ts** | 3,239 | God object: 44 methods, 6+ responsibilities |
| **EffectEngineService.ts** | 2,104 | Massive switch (1180+ lines), 9 dependencies |
| **StateService.ts** | 1,910 | Mixed concerns: game state + UI state + sync |
| **CardService.ts** | 1,415 | Large but more focused |
| **EffectFactory.ts** | 1,098 | Effect creation utilities |
| **FinancialStatusDisplay.tsx** | 1,066 | Component with 4+ extractable sections |
| **GameLayout.tsx** | 829 | 15 state variables, 12+ handlers |
| **NegotiationModal.tsx** | 827 | 4 distinct view states |
| **TurnControlsWithActions.tsx** | 753 | Complex state machine |
| **PlayerPanel.tsx** | 735 | Sub-sections already large |

### Key Metrics
- **Total service code**: ~12,000 lines (30% of codebase)
- **Components over 200 lines**: 15+
- **Code duplication estimate**: 15-20% in largest files
- **Circular dependency workarounds**: 4+ setter injections

---

## Refactoring Priorities

### Tier 1: High Impact, Lower Risk (Recommended First)

#### 1. Extract CardEffectService from TurnService
**Impact**: Eliminates 508-line method, removes 80% duplication
**Lines saved**: ~400-500 lines from TurnService
**Current location**: `TurnService.applySpaceCardEffect()` (508 lines)

**Methods to extract**:
- `applyCardDraw(playerId, cardType, count)` - Consolidates 5 identical blocks
- `applyCardReplace(playerId, cardType, count)`
- `applyCardReturn(playerId, cardType, count)`
- `applyCardTransfer(playerId, cardType, count)`

**Why first**:
- Largest single method (508 lines = 15% of TurnService)
- 80% code duplication across draw_w, draw_b, draw_e, draw_l, draw_i
- Low coupling to other methods
- Easy to test in isolation

#### 2. Extract TurnStateManager from StateService
**Impact**: Separates REAL/TEMP state model
**Lines saved**: ~325 lines from StateService
**Current location**: Lines 1101-1486

**Methods to extract**:
- `createTempStateFromReal()`
- `commitTempToReal()`
- `applyToRealState()`
- `updateTempState()`
- `getEffectivePlayerState()`

**Why second**:
- Well-defined responsibility boundary
- Self-contained state management
- Improves StateService focus

#### 3. Create Shared UI Components
**Impact**: Eliminates component duplication
**Files affected**: PlayerPanel.tsx, TurnControlsWithActions.tsx, FinancialStatusDisplay.tsx

**Components to create**:
- `MovementDestinationChoice` - Used in 2 places identically
- `ExpandableSection` - Used 4+ times
- `TooltipButton` - Pattern repeated 5+ times

---

### Tier 2: Medium Impact, Medium Risk

#### 4. Extract SpaceEffectProcessor from TurnService
**Lines saved**: ~400 lines
**Current location**: `processSpaceEffectsAfterMovement()` (166 lines) + routing

#### 5. Extract MovementChoiceManager from TurnService
**Lines saved**: ~285 lines
**Centralizes**: Three-path choice creation architecture with scattered guard logic

#### 6. Extract FinancialEffectService from EffectEngineService
**Lines saved**: ~240 lines
**Current location**: RESOURCE_CHANGE case block

#### 7. Decompose FinancialStatusDisplay.tsx
**Lines saved**: Main component from 1066 to ~300
**Extract**:
- SourcesOfMoneySection (~200 lines)
- ProjectScopeSection (~110 lines)
- FeesSection (~80 lines)
- SurplusDeficitSection (~70 lines)

---

### Tier 3: High Impact, Higher Risk

#### 8. Extract DiceEffectEngine from TurnService
**Lines saved**: ~250 lines
**Consolidates**: rollDiceWithFeedback, rerollDice, rollDiceAndProcessEffects

#### 9. Decompose EffectEngineService processEffect()
**Current**: 1180+ line switch statement
**Extract**: Type-specific effect handlers (Card, Movement, Negotiation, Fee)

#### 10. Extract ServerSyncService from StateService
**Lines saved**: ~130 lines
**Separates**: Network sync from game state management

---

## Implementation Approach

### Phase 1: Foundation (Low Risk)
1. Create `src/services/card/CardEffectService.ts`
2. Move card draw/replace/return/transfer logic
3. Update TurnService to delegate
4. Add/update tests

### Phase 2: State Management (Medium Risk)
1. Create `src/services/state/TurnStateManager.ts`
2. Extract REAL/TEMP state logic
3. Update StateService to use TurnStateManager
4. Verify all state transitions work

### Phase 3: Shared Components (Low Risk)
1. Create `src/components/common/MovementDestinationChoice.tsx`
2. Create `src/components/common/ExpandableSection.tsx`
3. Update PlayerPanel and TurnControlsWithActions
4. Update FinancialStatusDisplay

### Phase 4: Service Decomposition (Higher Risk)
1. Extract remaining TurnService responsibilities
2. Decompose EffectEngineService switch
3. Clean up circular dependencies

---

## Estimated Impact

| Metric | Current | After Refactoring |
|--------|---------|-------------------|
| TurnService.ts | 3,239 lines | ~1,800 lines |
| EffectEngineService.ts | 2,104 lines | ~1,400 lines |
| StateService.ts | 1,910 lines | ~1,200 lines |
| Code duplication | 15-20% | <5% |
| New focused services | 0 | 6-8 |
| Testable units | Mixed | Improved |

---

## Risks and Mitigations

1. **Breaking changes**: All extractions maintain existing public APIs
2. **Test coverage**: Each extraction includes corresponding test updates
3. **Circular dependencies**: New services designed to avoid cycles
4. **Performance**: No expected degradation; fewer lines per file = faster parsing

---

## Verification Plan

1. Run full test suite after each extraction
2. Manual testing at key game spaces (CHEAT-BYPASS, CON-ISSUES, etc.)
3. Verify all 504 service tests pass
4. Verify all component tests pass
5. Deploy to staging for UAT validation

---

## Documentation Review Findings

From reviewing TODO.md, TECHNICAL_DEBT.md, and PROJECT_STATUS.md:

**Positive Indicators for Refactoring:**
- Many technical debt items already resolved (Dec 6, 2025 and Jan 8, 2026)
- Movement type issues fixed (previously a major pain point)
- External testing in progress - suggests stable foundation
- 967 tests passing with good coverage

**Current Bug Status:**
- Several bugs recently fixed (contextual dice rolls, CHEAT-BYPASS movement, etc.)
- External testing revealing edge cases being addressed
- Game still growing with new features being added

**Recommendation:** The codebase is in a good position for refactoring. Technical debt has been actively addressed, and the stable test suite provides safety for changes.

---

## Approved Approach

Given the game is in alpha/beta stage and still growing:

**Start with Tier 1 only (3 items):**
1. Extract CardEffectService from TurnService - Highest impact, lowest risk
2. Extract TurnStateManager from StateService - Clean separation
3. Create shared UI components - Reduces duplication

**Why this approach:**
- Tier 1 provides ~80% of the benefit with ~20% of the risk
- Leaves room for bug fixes and new features
- Can evaluate and continue to Tier 2 later
- Each extraction is independently valuable

---

## Progress Tracking

- [x] **Tier 1.1**: Extract CardEffectService from TurnService (Completed January 11, 2026)
  - Created `src/services/CardEffectService.ts` (343 lines)
  - Added `ICardEffectService` interface to ServiceContracts.ts
  - Updated TurnService with setter injection
  - Updated ServiceProvider.tsx and ServiceProviderOptimized.tsx
  - Added 23 tests in `tests/services/CardEffectService.test.ts`
  - Legacy code retained for backwards compatibility during transition
- [x] **Tier 1.2**: Extract TurnStateManager from StateService - DEFERRED (January 11, 2026)
  - Analysis: REAL/TEMP state methods (lines 1101-1486) are already well-organized
  - Methods directly modify `currentState` and call `notifyListeners()` and `updatePlayer()`
  - Extraction would add complexity without clear benefit due to tight coupling
  - Decision: Keep methods in StateService, they're already a clean logical section
- [x] **Tier 1.3**: Create shared UI components - ANALYSIS COMPLETE (January 11, 2026)
  - ExpandableSection: Two versions exist (common/player), consolidation opportunity identified
    - `common/ExpandableSection.tsx` - 97 lines, simpler
    - `player/ExpandableSection.tsx` - 128 lines, has headerActions/summary/keyboard nav
    - Follow-up task: Consolidate into single enhanced common version
  - MovementDestinationChoice: Already integrated into PlayerPanel and TurnControlsWithActions
  - TooltipButton: Pattern present but not duplicated excessively

- [x] **Tier 2.7**: Decompose FinancialStatusDisplay.tsx (Completed January 11, 2026)
  - Created `src/components/game/financial/` directory with extracted components:
    - `types.ts` - Shared types (FinancialStatus, CardGroup, FundingTransaction, etc.)
    - `FundingCardSection.tsx` - B/I card details (~135 lines)
    - `OwnerSeedMoneySection.tsx` - Owner seed money display (~120 lines)
    - `SourcesOfMoneySection.tsx` - Sources of money expandable section (~280 lines)
    - `ProjectScopeSection.tsx` - W cards grouped by work type (~145 lines)
    - `FeesSection.tsx` - Fees & costs expandable section (~90 lines)
    - `SurplusDeficitSection.tsx` - Final calculation display (~85 lines)
    - `index.ts` - Barrel exports
  - Main component reduced from **1,066 lines to 165 lines** (85% reduction)
  - All 90 player component tests passing
  - Build successful

**Follow-up Consolidation Tasks (Lower Priority):**
- [ ] Consolidate ExpandableSection: Enhance common version with player features, update imports
- [ ] Remove legacy applySpaceCardEffectLegacy from TurnService after verification
