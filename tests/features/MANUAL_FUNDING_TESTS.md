# Manual Funding Test Coverage

This document describes the test coverage for the manual funding feature at OWNER-FUND-INITIATION.

## Test File
`tests/features/ManualFunding.test.ts`

**Current Status**: ✅ **14 passing / 0 failing (14 total) - 100% coverage**

## Features Tested

### 1. Condition-Based Effect Selection ✅ ALL PASSING
- **Test**: "should select B card effect when scope ≤ $4M" ✅
- **Test**: "should select I card effect when scope > $4M" ✅
- **Test**: "should handle edge case: scope exactly at $4M threshold" ✅
- **Coverage**: Verifies that `filterSpaceEffectsByCondition` correctly filters effects based on project scope
- **Status**: PASSING (3/3)
- **Note**: Core functionality verified! Condition filtering works correctly.

### 2. Compound Key Handling ✅ ALL PASSING
- **Test**: "should accept compound key 'cards:draw_b' for B card funding" ✅
- **Test**: "should accept compound key 'cards:draw_i' for I card funding" ✅
- **Test**: "should reject wrong compound key based on scope condition" ✅
- **Coverage**: Verifies that manual effects can be triggered with compound keys like "cards:draw_b"
- **Status**: PASSING (3/3)

### 3. Automatic Card Application at OWNER-FUND-INITIATION ✅ ALL PASSING
- **Test**: "should automatically apply B card when drawn at OWNER-FUND-INITIATION" ✅
- **Test**: "should automatically apply I card when drawn at OWNER-FUND-INITIATION" ✅
- **Test**: "should NOT auto-apply B/I cards drawn at other spaces" ✅
- **Coverage**: Verifies special handling that auto-plays funding cards at OWNER-FUND-INITIATION
- **Status**: PASSING (3/3)

### 4. Action Count and Completion Tracking ✅ ALL PASSING
- **Test**: "should count only ONE manual action when both B and I effects exist" ✅
- **Test**: "should track completion using compound key" ✅
- **Test**: "should recognize action as complete when checking with compound key" ✅
- **Coverage**: Verifies that condition filtering prevents counting both B and I effects
- **Status**: PASSING (3/3)

### 5. Integration: Complete Funding Flow ✅ ALL PASSING
- **Test**: "should complete full funding flow for small project (B card)" ✅
- **Test**: "should complete full funding flow for large project (I card)" ✅
- **Coverage**: End-to-end test of the entire funding flow
- **Status**: PASSING (2/2)

## Implementation Details Tested

### Key Functions
1. `TurnService.filterSpaceEffectsByCondition(effects, player)` - Filters effects by condition
2. `TurnService.triggerManualEffect(playerId, 'cards:draw_b')` - Handles compound keys
3. `StateService.calculateRequiredActions(player)` - Counts only applicable effects
4. `StateService.setPlayerCompletedManualAction('cards:draw_i', message)` - Tracks completion

### Data Flow
```
User clicks "Accept Owner Funding" button
  ↓
FinancesSection passes compound key: "cards:draw_i"
  ↓
TurnService.triggerManualEffect() parses compound key
  ↓
Finds matching effect (draw_i with condition scope_gt_4M)
  ↓
Draws I card at OWNER-FUND-INITIATION
  ↓
Automatically applies card effects (adds money)
  ↓
Marks completion with compound key "cards:draw_i"
  ↓
StateService.calculateRequiredActions() recognizes completion
  ↓
End Turn button becomes available
```

### Conditions Tested
- `scope_le_4M` - Project scope ≤ $4,000,000
- `scope_gt_4M` - Project scope > $4,000,000
- Edge case: scope = exactly $4,000,000 (should get B card)

### Compound Keys
- `"cards:draw_b"` - Draw B card (bank loan)
- `"cards:draw_i"` - Draw I card (investment)

## Root Cause and Solution

### The Original Problem (November 4, 2025)
Initial test failures (8/14 tests) were caused by **inconsistent project scope calculation** between services:

- **TurnService**: Calculated project scope by summing the `cost` field of all W (work) cards
- **StateService**: Read the `player.projectScope` field directly for condition evaluation

This created a double-mocking problem: tests had to set BOTH W cards AND the projectScope field.

### The Refactoring Solution (November 5, 2025) ✅

**A major refactoring established a single source of truth for project scope calculation:**

1. **`GameRulesService.calculateProjectScope()`** is now the ONLY method that calculates project scope
2. All services (TurnService, StateService, MovementService) delegate to GameRulesService
3. The deprecated `player.projectScope` field is now **ignored** throughout the codebase

**After refactoring, tests now:**
- ✅ Only mock W cards (single source of truth)
- ✅ Inject `gameRulesService` into StateService via `setGameRulesService()`
- ✅ Configure `mockGameRulesService.calculateProjectScope()` to calculate from W card mock IDs
- ✅ No longer need to set the `player.projectScope` field

```typescript
// Current approach (November 5, 2025):
beforeEach(() => {
  stateService = new StateService(mockDataService);
  mockGameRulesService = createMockGameRulesService();

  // IMPORTANT: Inject gameRulesService into StateService
  stateService.setGameRulesService(mockGameRulesService);

  // Configure calculateProjectScope to work with mock W cards
  mockGameRulesService.calculateProjectScope.mockImplementation((playerId: string) => {
    const player = stateService.getPlayer(playerId);
    if (!player || !player.hand) return 0;
    const wCards = player.hand.filter(cardId => cardId.startsWith('W'));
    let totalScope = 0;
    for (const cardId of wCards) {
      const match = cardId.match(/W_MOCK_(\d+)/);
      if (match) {
        totalScope += parseInt(match[1], 10);
      }
    }
    return totalScope;
  });
});

// Tests now only need to set W cards:
stateService.updatePlayer({
  id: playerId,
  hand: ['W_MOCK_2000000'] // W card representing $2M scope
  // No projectScope field needed!
});
```

### Architectural Impact
The refactoring eliminated:
- ✅ Duplicate calculation methods in TurnService and MovementService
- ✅ Incorrect $500k assumption in MovementService
- ✅ Stale cache issues with `player.projectScope` field
- ✅ Complex double-mocking in tests

**See full details:** `docs/PROJECT_SCOPE_REFACTORING_COMPLETE.md`

## Future Test Coverage

### Potential Enhancements:
1. **Error Handling**: Test what happens when no B/I cards are available
2. **State Persistence**: Test that completion state persists across turns
3. **UI Integration**: Test that buttons appear/disappear correctly (component tests)
4. **Subsequent Visits**: Test funding behavior on subsequent visits to OWNER-FUND-INITIATION
5. **Multiple W Cards**: Test project scope calculation with multiple W cards
6. **Edge Cases**: Test with projectScope exactly at boundaries (e.g., exactly $4,000,000)

## Manual Testing Checklist

All automated tests are now passing! Use this checklist for additional verification in the browser:

- [ ] At OWNER-FUND-INITIATION with scope ≤ $4M:
  - [ ] Single "Accept Owner Funding" button appears
  - [ ] Clicking button draws B card
  - [ ] Money is added to balance (bank loan amount)
  - [ ] Button disappears after click
  - [ ] End Turn becomes available

- [ ] At OWNER-FUND-INITIATION with scope > $4M:
  - [ ] Single "Accept Owner Funding" button appears
  - [ ] Clicking button draws I card
  - [ ] Money is added to balance (investment amount)
  - [ ] Button disappears after click
  - [ ] End Turn becomes available

- [ ] At scope = exactly $4M:
  - [ ] B card is selected (≤ includes equal)

- [ ] After completing funding:
  - [ ] Refreshing page preserves completion state
  - [ ] Moving to next space works correctly
  - [ ] Try Again resets the space properly

