# Testing Guide - Unravel Codes: The Game

**Last Updated:** April 30, 2026
**Status:** Beta (v2.58.0)

---

## ⚠️ MANDATORY: Before Every Commit

**Rule: If tests don't pass, the work isn't done. No exceptions.**

```bash
# REQUIRED before every commit (single source of truth):
./tests/scripts/run-tests-batch-fixed.sh   # 23 batches, must all be green
npm run typecheck                          # 0 errors required

# Plus the regression bot for any change that could affect gameplay:
npm test tests/ghost/ghostPlayer.test.ts   # strict + try-again-happy variants
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

4. **Regenerate CLEAN_FILES** (if you edited a SOURCE_FILES CSV manually rather than via the Data Editor)
   ```bash
   node server/processGameData.js
   ```
   The Data Editor's Live Save (Ctrl+S) does this automatically.

---

## 🚀 Test Execution

The project uses Vitest. All Jest references in this doc are historical — the codebase uses Vitest exclusively.

### **Essential Commands**
```bash
./tests/scripts/run-tests-batch-fixed.sh   # ✅ The recommended way to run everything
npm test tests/services/                   # Test service layer only
npm test tests/components/                 # Test components only
npm test tests/E2E                         # E2E scenarios
npm test tests/ghost/                      # Headless regression bot
npm run test:watch                         # Real-time testing for development
```

### ⚠️ `npm test` (running everything in one process) may hang

This is a known limitation: module-level mock isolation issues can cause the full `npm test` invocation to hang indefinitely. **Always use the batch script** (`run-tests-batch-fixed.sh`) which runs the suite in 23 segmented batches. This is the workflow used by every commit since early 2026.

## 📊 Test Count

99 test files at v2.58.0 (run via batch script). Counts of individual test cases inside files have been intentionally removed from this doc — they go stale fast. Run `./tests/scripts/run-tests-batch-fixed.sh` for the current authoritative tally per batch.

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

### **Test Hanging on full `npm test`**
- Known limitation — module-level mock isolation issues. Use the batch script instead.
- For individual files, hangs usually mean unmocked async operations or missing handler setters in test setup (see `tests/ghost/bootstrapServices.ts` for the canonical service-wiring pattern).

### **Mock Not Working**
```typescript
// ✅ Correct: Use vi.fn()
const mockFn = vi.fn().mockReturnValue('result');

// ❌ Incorrect: Don't use jest.fn()
const mockFn = jest.fn(); // This will fail
```

### **TypeScript Errors**
- `npm run typecheck` must return 0 errors before commit (since v2.47.2).
- Discriminated-union payload extracts via `Extract<Effect, { effectType: 'X' }>['payload']` is the preferred pattern for narrowing effect handlers.
- Bucket E intentional-`any` sites are documented as acceptable (catch blocks, Promise reject signatures, dynamic config indexing) — don't refactor those.

## Test Architecture Notes

- **Vitest** (not Jest) — use `vi.fn()` not `jest.fn()`.
- **Batch execution required** — see warning above; full `npm test` may hang.
- **Native TypeScript** — no compile step needed.
- **Real-time feedback** — `npm run test:watch` for TDD.

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

## Ghost Player Regression Bot

`tests/ghost/ghostPlayer.test.ts` is the headless-bot regression gate that plays 50 random games per CI run. Two variants:

- **Strict gate**: zero exceptions / invariant violations + ≥90% wins. Plus space coverage gate (every `GAME_CONFIG.csv` space visited at least once). The current baseline is ~96% wins (2/50 games timeout in scope/fund-review loops — a documented bot-strategy artifact, not a game bug).
- **Try-again-happy variant**: same 50 games but with p=0.2 chance of using Try Again on negotiable spaces. Catches Try Again–related state corruption.

Run both variants:
```bash
npm test tests/ghost/
```

If Ghost Player fails after a change, the action log captured in the test output is reproducible — the seed is logged, replay is deterministic.
