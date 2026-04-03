# Manual Funding Test Refactoring - November 5, 2025

**Date:** November 4-5, 2025
**Context:** Test failures during manual funding feature development
**Outcome:** ✅ Complete refactoring - all 14 tests passing

---

## The Original Problem (November 4, 2025)

Initial test failures (8/14 tests) were caused by **inconsistent project scope calculation** between services:

- **TurnService**: Calculated project scope by summing the `cost` field of all W (work) cards
- **StateService**: Read the `player.projectScope` field directly for condition evaluation

This created a double-mocking problem: tests had to set BOTH W cards AND the projectScope field.

### Why This Was a Problem

**Fragile Tests:**
- Tests needed to mock W cards for TurnService
- Tests also needed to set `player.projectScope` for StateService
- If these got out of sync, tests would fail mysteriously

**Code Duplication:**
- TurnService had its own project scope calculation
- MovementService had its own (incorrect $500k assumption)
- StateService relied on stale `player.projectScope` field

**Cache Issues:**
- The `player.projectScope` field could become stale
- No automatic recalculation when W cards changed

---

## The Refactoring Solution (November 5, 2025) ✅

**A major refactoring established a single source of truth for project scope calculation:**

1. **`GameRulesService.calculateProjectScope()`** is now the ONLY method that calculates project scope
2. All services (TurnService, StateService, MovementService) delegate to GameRulesService
3. The deprecated `player.projectScope` field is now **ignored** throughout the codebase

### Code Changes

**Before Refactoring:**
```typescript
// TurnService (duplicate calculation)
const wCards = player.hand.filter(id => id.startsWith('W'));
let projectScope = 0;
for (const cardId of wCards) {
  const card = this.dataService.getCardById(cardId);
  if (card) projectScope += card.cost || 0;
}

// StateService (relied on stale field)
const scope = player.projectScope || 0;

// MovementService (hardcoded assumption!)
const projectScope = 500000; // WRONG!
```

**After Refactoring:**
```typescript
// All services delegate to GameRulesService
const projectScope = this.gameRulesService.calculateProjectScope(playerId);

// GameRulesService - single source of truth
calculateProjectScope(playerId: string): number {
  const player = this.stateService.getPlayer(playerId);
  if (!player || !player.hand) return 0;

  const wCards = player.hand.filter(id => id.startsWith('W'));
  let totalScope = 0;

  for (const cardId of wCards) {
    const card = this.dataService.getCardById(cardId);
    if (card) totalScope += card.cost || 0;
  }

  return totalScope;
}
```

### Test Changes

**Before Refactoring:**
```typescript
// Had to mock BOTH W cards AND projectScope field
stateService.updatePlayer({
  id: playerId,
  hand: ['W001', 'W002'],  // For TurnService
  projectScope: 3500000    // For StateService (duplicate!)
});
```

**After Refactoring:**
```typescript
// Current approach - single source of truth
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

---

## Architectural Impact

The refactoring eliminated:
- ✅ Duplicate calculation methods in TurnService and MovementService
- ✅ Incorrect $500k assumption in MovementService
- ✅ Stale cache issues with `player.projectScope` field
- ✅ Complex double-mocking in tests

### Services Affected

**GameRulesService (NEW):**
- Single source of truth for project scope calculation
- Injected into StateService, TurnService, MovementService

**StateService:**
- Now delegates to GameRulesService for scope calculation
- No longer reads `player.projectScope` field
- Accepts GameRulesService via `setGameRulesService()`

**TurnService:**
- Removed duplicate scope calculation
- Delegates to GameRulesService

**MovementService:**
- Removed incorrect $500k hardcoded assumption
- Delegates to GameRulesService

---

## Test Results

**Before Refactoring:** 6/14 tests passing (8 failures)
**After Refactoring:** 14/14 tests passing ✅

### Test Suite Breakdown
- Condition-based effect selection: 3/3 passing ✅
- Compound key handling: 3/3 passing ✅
- Automatic card application: 3/3 passing ✅
- Action count and completion: 3/3 passing ✅
- Integration flows: 2/2 passing ✅

---

## Lessons Learned

### Key Insights

1. **Single Source of Truth:** Duplicated business logic across services leads to fragile tests and maintenance burden
2. **Dependency Injection:** Using DI (e.g., `setGameRulesService()`) makes services testable
3. **Mock Strategy:** Mock IDs can encode test data (e.g., `W_MOCK_2000000` = $2M scope)
4. **Deprecate Don't Delete:** The `player.projectScope` field still exists but is ignored (backward compatibility)

### Best Practices Established

✅ **Create dedicated service for business rules** (GameRulesService)
✅ **Use dependency injection** for testability
✅ **Single calculation method** for derived values
✅ **Tests should mock once** (W cards), not twice (W cards + derived value)

---

## Related Documentation

- **Current Test Coverage:** `tests/features/MANUAL_FUNDING_TESTS.md`
- **Test File:** `tests/features/ManualFunding.test.ts`

---

**Refactoring Status:** ✅ COMPLETE
**Test Status:** 14/14 passing (100%)
