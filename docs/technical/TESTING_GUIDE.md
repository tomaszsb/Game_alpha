# Testing Guide - Game Alpha

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

> **Note**: The project was migrated from Jest to Vitest for superior performance. All references to Jest in this document are historical—the codebase uses Vitest exclusively.

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

| Test Category         | Tests                   | Status                |
|-----------------------|-------------------------|-----------------------|
| Service Tests         | 445 tests               | ✅ Passing            |
| Component Tests       | 277 tests               | ✅ Passing            |
| Utils Tests           | 129 tests               | ✅ Passing            |
| E2E/Integration Tests | 45 tests                | ✅ Passing            |
| Isolated Tests        | 22 tests                | ✅ Passing            |
| Features Tests        | 23 tests                | ✅ Passing            |
| Regression Tests      | 66 tests                | ✅ Passing            |
| Performance Tests     | 9 tests                 | ✅ Passing            |
| **Full Suite**        | **914 tests total**     | **✅ 913 Passing / ⚠️ 1 Skipped** |

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
- **✅ 967 tests** running in seconds
- **⚠️ 1 test skipped** (`E2E-01_HappyPath.test.tsx` due to a pre-existing issue with the test infrastructure)
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

---

## 🤖 AI-Based User Acceptance Testing (UAT)

**Purpose**: Structured testing guide for AI assistants to perform comprehensive UAT

**Status**: Active - Used for UAT Phase 3 (December 2025)

**Target Audience**: AI assistants (Claude, Perplexity, ChatGPT, etc.) performing gameplay testing

---

### Testing Objective

Play Game Alpha for 10-15 turns with the goal of maximizing financial gain. Test core game mechanics, identify bugs, and report on user experience.

### Setup Requirements

1. Navigate to the game URL (provided by tester)
2. Open browser console (F12) to monitor logs
3. Start a new game with 2-4 players
4. Tester acts as Player 1

---

### Core Gameplay Actions

**Perform throughout test:**
- Click "Roll the Dice" or "Roll to Move" buttons when available
- Make movement choices when presented
- Draw cards when prompted
- Complete required actions (e.g., "Replace 1 E card")
- Monitor the action counter (e.g., "1/2 actions completed")
- Click "End Turn" only when all actions are complete

---

### Test Cases

#### Test Case 1: PM-DECISION-CHECK Space
**Goal:** Verify conditional dice effects are optional

**Steps:**
1. Try to land on the space named "PM-DECISION-CHECK"
2. When you land there, you'll see "Replace 1 E cards" as a required action
3. Complete that action (click button to replace an E card)
4. **Check:** Does the action counter show "1/1" or "2/2"?
5. **Check:** Do movement destination buttons appear immediately?
6. **Expected:** Should show "1/1" and allow movement without dice roll
7. **Report:** Actual counter value and whether movement was allowed

#### Test Case 2: Multi-Path Movement Bug
**Goal:** Test if clicking a destination causes premature movement

**Steps:**
1. Land on a space that offers multiple movement paths (multiple destination buttons)
2. Click ONE destination button
3. **DO NOT click "End Turn" yet**
4. **Check:** Did the player piece move immediately?
5. **Expected:** Player should NOT move until "End Turn" is clicked
6. **Report:** Did movement happen before or after "End Turn"?

#### Test Case 3: Dice Outcome Spaces
**Goal:** Verify dice-based movement works correctly

**Steps:**
1. Try to land on "CHEAT-BYPASS" or similar dice outcome spaces
2. **Check:** Does it show "Roll to Move" button?
3. Click the button and roll the dice
4. **Check:** Does a single destination appear in a modal?
5. **Check:** Can you select it and move successfully?
6. **Report:** Describe the flow and any issues

#### Test Case 4: Card Effects with Duration
**Goal:** Verify effects persist and expire correctly

**Steps:**
1. Play any card that has a duration (e.g., "3 turns")
2. Note which effect it applies
3. **Check:** Does the effect persist across multiple turns?
4. **Check:** When it expires, do you see a notification?
5. **Report:** Effect behavior and expiration handling

#### Test Case 5: Turn Sequence & UI States
**Goal:** Verify smooth turn transitions

**Steps:**
1. Complete several full turns
2. **Check:** Is "End Turn" disabled during wait periods?
3. **Check:** Do you see banner notifications (not full-screen overlays)?
4. **Check:** Do turn transitions feel smooth?
5. **Report:** Any confusing UI states or delays

#### Test Case 6: Action Counter Accuracy
**Goal:** Verify action tracking is correct

**Steps:**
1. Throughout gameplay, monitor the "X/Y actions completed" counter
2. **Check:** Does it accurately reflect required vs completed actions?
3. **Check:** Can you move only when all actions are complete?
4. **Report:** Any instances where the counter seemed wrong

---

### Console Log Monitoring

**Watch for:**
- React errors or warnings
- Log messages containing "WARN" or "ERROR"
- TypeScript errors
- Any unusual network requests

**Save logs:**
- Copy entire console output for final report
- Note timestamp of any errors

---

### Final Report Format

After 10-15 turns, provide:

#### 1. Summary
Overall experience (smooth, confusing, buggy, etc.)

#### 2. Test Results
For each test case above, report findings:
- Test Case #: [Name]
- Result: PASS / FAIL / PARTIAL
- Details: [Specific observations]
- Issues: [Any bugs or unexpected behavior]

#### 3. Bugs Found
List any unexpected behavior or errors:
- **Bug #**: [Description]
- **Severity**: Critical / Major / Minor
- **Steps to Reproduce**: [Detailed steps]
- **Expected**: [What should happen]
- **Actual**: [What actually happened]

#### 4. Confusing Moments
UX issues or unclear instructions:
- **Issue**: [Description]
- **Location**: [Where in UI]
- **Suggestion**: [How to improve]

#### 5. Console Logs
Full console output (copy/paste entire console)

#### 6. Financial Outcome
Your final cash/assets value

---

### Success Criteria

- ✅ Complete 10-15 turns without crashes
- ✅ Successfully test all 6 test cases
- ✅ Provide detailed feedback on each test
- ✅ Capture complete console logs
- ✅ Submit structured report following format above

---

### Usage Instructions

**For AI Testers:**
1. Copy this entire section as your testing prompt
2. Follow test cases sequentially
3. Document all observations
4. Provide comprehensive final report

**For Human Testers Guiding AI:**
1. Share game URL with AI assistant
2. Provide this testing guide as instructions
3. Review AI's report for accuracy
4. File GitHub issues for confirmed bugs

---

### Version History

**v1.0** (December 14, 2025)
- Initial AI-based UAT testing guide
- 6 core test cases covering main mechanics
- Structured report format
- Console monitoring requirements

---

**Next Section**: [Return to Top](#testing-guide---game-alpha)