# Testing Guide - Code2027

## ⚠️ MANDATORY: Before Every Commit

**Rule: If tests don't pass, the work isn't done. No exceptions.**

```bash
# REQUIRED before every commit:
npm test -- tests/services/    # All service tests (438 tests, ~10s)
npm test -- tests/E2E-*.test.ts # All E2E tests (~5 tests, ~2s)
```

### If ANY test fails:
1. ❌ **DO NOT commit**
2. ❌ **DO NOT push**
3. ✅ **Fix the failure first**

### CSV File Changes
If modifying any CSV files in `public/data/CLEAN_FILES/`:

1. **Check parser expectations**
   - Read the corresponding DataService parser method
   - Example: CARDS_EXPANDED.csv → check `DataService.parseCardsCsv()` at line 365
   - Verify column count matches `expectedColumns` array

2. **Validate schema**
   ```bash
   head -1 public/data/CLEAN_FILES/YOUR_FILE.csv | awk -F',' '{print NF " columns"}'
   ```

3. **Preserve known fixes**
   - L003: discard_cards must be "1 E" (not "1")
   - Check git history for any previous fixes to that file

4. **Run data generation scripts** (if regenerating)
   ```bash
   python3 data/convert_cards_expanded.py
   python3 data/process_spaces_csv.py
   python3 data/process_dice_outcomes.py
   ```

---

## 🚀 Quick Start (Lightning Fast Tests)

Our test suite runs in **seconds, not minutes** thanks to the Vitest migration and performance optimizations.

### **Essential Commands**
```bash
npm test                    # Run full test suite (<30 seconds)
npm run test:watch          # Real-time testing for development
npm run test:services       # Test service layer only
npm run test:isolated       # Ultra-fast pure logic tests
```

## 📊 Performance Achievement

**Before Optimization**: 15+ minute timeouts, unusable for TDD
**After Vitest Migration**: Sub-30-second full suite, instant feedback

| Test Category | Tests | Execution Time | Status |
|---------------|-------|----------------|--------|
| Service Tests | 90+ tests | ~300ms | ⚡ Lightning fast |
| Transactional Tests | 11 tests | ~96ms | 🔄 Logging architecture |
| Isolated Tests | 22 tests | ~50ms | 🚀 Ultra-fast |
| Full Suite | 95+ test files | <30 seconds | ✅ Production ready |

## 🛠️ Writing Tests

### **Service Test Template**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourService } from '../src/services/YourService';

describe('YourService', () => {
  let service: YourService;
  let mockDependency: any;

  beforeEach(() => {
    mockDependency = {
      someMethod: vi.fn().mockReturnValue('expected result')
    };
    service = new YourService(mockDependency);
  });

  it('should perform action successfully', async () => {
    const result = await service.performAction('input');
    
    expect(result.success).toBe(true);
    expect(mockDependency.someMethod).toHaveBeenCalledWith('input');
  });
});
```

### **Component Test Template**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YourComponent } from '../src/components/YourComponent';

describe('YourComponent', () => {
  it('should render correctly', () => {
    const mockProps = {
      data: { id: '1', name: 'Test' },
      onAction: vi.fn()
    };

    render(<YourComponent {...mockProps} />);
    
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### **Isolated Unit Test Template**
```typescript
import { describe, it, expect } from 'vitest';

// Pure logic tests - no dependencies, ultra-fast
describe('Pure Function Tests', () => {
  it('should calculate correctly', () => {
    const result = calculateSomething(10, 20);
    expect(result).toBe(30);
  });

  it('should complete within performance budget', () => {
    const start = performance.now();
    
    // Your logic here
    const result = complexCalculation(1000);
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5); // Under 5ms
    expect(result).toBeGreaterThan(0);
  });
});
```

## 🎯 Test Categories

### **Service Tests** (`tests/services/`)
- Test business logic and service interactions
- Use mock dependencies via dependency injection
- Cover all public methods and error cases
- **Performance**: ~100-200ms per service

### **Component Tests** (`tests/components/`)
- Test UI rendering and user interactions
- Mock all service dependencies
- Focus on props and event handling
- **Performance**: Fast with proper mocking

### **Isolated Tests** (`tests/isolated/`)
- Pure logic functions with zero dependencies
- Mathematical calculations, utility functions
- Performance benchmarking tests
- **Performance**: ~20-50ms total

### **Integration Tests** (`tests/E2E-*`)
- End-to-end scenarios testing service interactions
- Real business workflows
- Multi-step game mechanics
- **Performance**: Seconds with optimized mocks

## 🔧 Mock Strategies

### **Lightweight Mocks** (Recommended)
```typescript
// Fast: Only mock what you need
const mockService = {
  essentialMethod: vi.fn(() => 'result'),
  // Only include methods actually used in test
};
```

### **Full Service Mocks** (When Needed)
```typescript
import { createMockDataService } from '../mocks/mockServices';

const mockDataService = createMockDataService();
// Pre-built comprehensive mocks for complex scenarios
```

## 📋 Best Practices

### **Performance Guidelines**
- Keep tests under 100ms each when possible
- Use isolated tests for pure logic
- Mock heavy dependencies (DataService, network calls)
- Batch related tests in same describe block

### **Code Quality**
- One assertion per test (generally)
- Clear, descriptive test names
- Setup/teardown in beforeEach/afterEach
- Mock only what's needed for the test

### **Debugging Tests**
```bash
npm run test:verbose       # Full output for debugging
npm run test:debug         # Extra detailed information
npm test -- --reporter=verbose  # Vitest verbose reporter
```

## 🚨 Common Issues & Solutions

### **Test Hanging**
- **Fixed**: Vitest migration resolved all hanging issues
- If you see hangs, check for unmocked async operations

### **Mock Not Working**
```typescript
// ✅ Correct: Use vi.fn()
const mockFn = vi.fn().mockReturnValue('result');

// ❌ Incorrect: Don't use jest.fn()
const mockFn = jest.fn(); // This will fail
```

### **TypeScript Errors**
- All type errors resolved with Vitest migration
- Use `any` type for complex mocks if needed
- Ensure service interfaces match implementations

## 🎉 Migration Complete

The test suite has been completely migrated from Jest to Vitest with incredible performance improvements:

- **✅ 91 test files** converted and working
- **✅ 295+ tests** running in seconds
- **✅ Real-time feedback** for TDD workflow
- **✅ Zero compilation hangs** with native TypeScript support

**Ready for continuous testing and rapid development!**

---

## 🧪 Transactional Logging Test Cases

To ensure the correctness of the Dual-Layer Logging feature and prevent regressions, the following tests are required.

### Unit Tests (`LoggingService`) ✅ IMPLEMENTED

**Test File**: `tests/services/TransactionalLogging.test.ts` (11 comprehensive tests)

-   ✅ `startNewExplorationSession()` generates unique IDs and updates game state
-   ✅ `log()` creates entries with `isCommitted: false` during active sessions
-   ✅ System logs are immediately committed (`isCommitted: true`)
-   ✅ `commitCurrentSession()` marks all session entries as committed
-   ✅ `cleanupAbandonedSessions()` removes old uncommitted entries
-   ✅ Explicit `isCommitted` flag in payload overrides default behavior
-   ✅ Error logs are always committed regardless of session state

### Integration Tests (`TurnService`) ✅ ARCHITECTURE IMPLEMENTED

**Status**: Core integration points implemented in production code. Session lifecycle is properly managed in:
- `TurnService.startTurn()` - Starts new exploration sessions
- `TurnService.endTurn()` and `TurnService.endTurnWithMovement()` - Commits sessions
- `TurnService.tryAgainOnSpace()` - Handles session abandonment and restart

**Test Cases for Future Implementation:**

-   **Test Case 1: Standard Turn (Commit)**
    -   **Action:** Simulate a player taking a full turn and clicking "End Turn".
    -   **Assertion:** Verify that all actions logged during that turn are now marked `isCommitted: true`.

-   **Test Case 2: Single 'Try Again' (Rollback)**
    -   **Action:** Simulate a player taking several actions, then clicking "Try Again".
    -   **Assertion 1:** Verify the exploratory actions are in the log but are all marked `isCommitted: false`.
    -   **Assertion 2:** Verify a single `Try Again` action exists in the log and is marked `isCommitted: true`.

-   **Test Case 3: Multiple 'Try Again' then Commit**
    -   **Action:** Simulate a player using 'Try Again' twice, then finally completing a turn and clicking "End Turn".
    -   **Assertion:** Verify that only the actions from the *final, successful* attempt are marked `isCommitted: true`. All previous attempts' actions should remain `isCommitted: false`.

-   **New Test: State Consistency**
    -   **Action:** Move a player, trigger effects that change their money/cards, then use 'Try Again'.
    -   **Assertion:** Verify that the player's entire state (money, cards, position, etc.) is identical to the pre-move snapshot, except for any applied time penalty.

-   **New Test: Session ID Integrity**
    -   **Action:** Use 'Try Again'.
    -   **Assertion:** The `currentExplorationId` in the game state must be a **new** and different ID than the one from the abandoned session.

### Edge Case Tests (New)

The following scenarios must be tested to ensure production stability:

-   **Browser Refresh:** Test what happens if the game is reloaded mid-exploration. The log should show an abandoned session with no data loss.
-   **Multiplayer:** Run tests with multiple players using 'Try Again' to ensure their session IDs and log entries do not conflict.
-   **Empty Try Again:** Test clicking 'Try Again' at the very start of a move before any actions are taken.
-   **Commit Failure:** Simulate an error during the commit process (e.g., in `commitCurrentSession`) and ensure the log is not left in a corrupted, partially-committed state.

---

## 🎯 Turn Numbering System Test Strategy

**Status**: 📋 PLANNED - Test requirements defined for upcoming implementation

### Turn Progression Testing

**Test File**: `tests/services/TurnNumbering.test.ts` (To be created)

#### **Core Turn Logic Tests**
- ✅ **Game Round Progression**: Verify `gameRound` increments only after all players complete their turns
- ✅ **Turn Within Round**: Verify `turnWithinRound` cycles from 1 to player count, then resets
- ✅ **Global Turn Counter**: Verify `globalTurnCount` increments monotonically for each player turn
- ✅ **Player Rotation**: Verify turn order maintains consistent player sequence across rounds

#### **Multi-Player Scenarios**
- ✅ **4-Player Game**: Test complete round progression with all players
- ✅ **2-Player Game**: Test edge case with minimum players
- ✅ **Mixed Turn Durations**: Test when players take different amounts of time per turn
- ✅ **Try Again Impact**: Verify Try Again doesn't affect turn numbering progression

#### **Log Entry Context Tests**
- ✅ **Turn Context Accuracy**: Verify all log entries include correct `gameRound`, `turnWithinRound`, `globalTurnNumber`
- ✅ **Visibility Filtering**: Verify `visibility` field properly filters system/debug logs from player view
- ✅ **Backwards Compatibility**: Verify existing logs without new fields display correctly

### Game Log UI Testing

**Test File**: `tests/components/GameLog.TurnHierarchy.test.tsx` (To be created)

#### **Display Hierarchy Tests**
- ✅ **Round Grouping**: Verify actions are correctly grouped by game round
- ✅ **Player Grouping**: Verify player actions are grouped within rounds
- ✅ **Turn Labeling**: Verify correct turn labels (e.g., "Player 1 (Turn 1)", "Game Round 2")
- ✅ **Collapsible Sections**: Verify round and player sections can expand/collapse

#### **Visibility Tests**
- ✅ **Player View**: Verify only `visibility: 'player'` logs are shown to players
- ✅ **Debug View**: Verify debug mode shows all log levels
- ✅ **System Logs Hidden**: Verify exploration session logs are hidden from player view

### Integration Testing

**Test Files**: `tests/integration/TurnProgression.test.ts` (To be created)

#### **End-to-End Turn Flow**
- ✅ **Complete Game Round**: Simulate all players taking turns, verify proper progression
- ✅ **Try Again Integration**: Verify Try Again preserves turn numbering integrity
- ✅ **Log Accuracy**: Verify game log displays match actual game progression
- ✅ **State Consistency**: Verify UI turn displays match internal game state

#### **Edge Cases**
- ✅ **First Turn**: Verify game initialization sets correct starting turn numbers
- ✅ **Game End**: Verify final turn numbers are preserved in game end logs
- ✅ **Player Disconnection**: Test turn progression with player dropout scenarios
- ✅ **State Migration**: Test loading games saved with old turn numbering system

---

## Movement System Refactor Tests (November 2025)

### Test Coverage Added

**Test File**: `tests/services/MovementService.test.ts`
**New Tests**: 7 pathChoiceMemory unit tests
**Status**: ✅ All 39 MovementService tests passing

#### **Path Choice Memory Tests**
- ✅ **Store Plan Exam Choice**: Verify pathChoiceMemory stores REG-DOB-PLAN-EXAM on first visit
- ✅ **Store Prof Cert Choice**: Verify pathChoiceMemory stores REG-DOB-PROF-CERT on first visit
- ✅ **Filter to Remembered Choice (Plan Exam)**: Verify subsequent visit returns only Plan Exam if originally chosen
- ✅ **Filter to Remembered Choice (Prof Cert)**: Verify subsequent visit returns only Prof Cert if originally chosen
- ✅ **First Visit Returns All Choices**: Verify both options available on first visit
- ✅ **No Memory for Other Destinations**: Verify pathChoiceMemory only stores for DOB-related destinations
- ✅ **Preserve Existing Memory**: Verify existing pathChoiceMemory is not overwritten

### Regression Tests Restored

**Test Files**:
- `tests/regression/ButtonNesting.regression.test.tsx` (7 tests)
- `tests/regression/CardCountNaN.regression.test.tsx` (7 tests)

**Purpose**: Prevent regressions of bugs fixed in commit baa3ddf
**Status**: ✅ All 14 regression tests passing

#### **Button Nesting Tests**
- Verify no nested button elements in UI components
- Test modal buttons, action buttons, and interactive elements
- Ensure accessibility compliance

#### **Card Count NaN Tests**
- Verify card counts never display as NaN
- Test edge cases with zero cards, undefined states
- Validate card section rendering with various card types

### Running Movement Refactor Tests

```bash
# Run all MovementService tests (including new pathChoiceMemory tests)
npm test -- tests/services/MovementService.test.ts

# Run restored regression tests
npm test -- tests/regression/

# Verify all tests pass
npm test
```

### Test Metrics

**Total New/Restored Coverage**: 21 tests
- 7 pathChoiceMemory unit tests
- 14 restored regression tests
- 100% success rate (39/39 MovementService tests passing)