# Testing Guide - Unravel Codes: The Game

**Last Updated:** August 1, 2026
**Status:** Beta (v3.1.85)

---

## ⚠️ MANDATORY: Before Every Commit

**Rule: If tests don't pass, the work isn't done. No exceptions.**

```bash
# REQUIRED before every commit (single source of truth):
./tests/scripts/run-tests-batch-fixed.sh   # 22 batches, must all be green
npm run typecheck                          # 0 errors required

# Plus the regression bot for any change that could affect gameplay (~15-20 min):
npm run test:ghost -- tests/ghost/ghostPlayer*.test.ts   # strict + negotiate-coverage + smart-bot + loop-detection
```

> **2026-08-01: the batch script's stale-path gap (found and documented here earlier the same day) is fixed.** 16 of its file paths pointed at classic-panel component tests deleted during the V2 migration, which hard-failed 5 of its then-23 batches every run. Each was swapped for the real V2/service-layer test that now covers that ground (verified by reading each candidate's actual test content, not guessed from filenames — see `run-tests-batch-fixed.sh`'s inline comments for the specific swaps), one dead batch (`performance-tests`, whose only file had no real successor) was removed outright, and the script was re-run end to end: **22/22 batches green.** "Must all be green" is achievable again as written.

### If ANY test fails:
1. ❌ **DO NOT commit**
2. ❌ **DO NOT push**
3. ✅ **Fix the failure first**

### CSV File Changes
If modifying any CSV files in `public/data/CLEAN_FILES/`:

1. **Check parser expectations**
   - Read the corresponding DataService parser method
   - Example: CARDS_EXPANDED.csv → check `DataService.parseCardsCsv()` (currently ~line 1031 — the file has grown since this doc was last checked; search for the method name rather than trusting the line number)
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
npm test                                   # Full fast suite (~2 min) — ghost excluded, see below
npm test tests/services/                   # Test service layer only
npm test tests/components/                 # Test components only
npm test tests/E2E                         # E2E scenarios
npm run test:ghost                         # Headless regression bot (~15-20 min, separate config)
npm run test:watch                         # Real-time testing for development
```

### `npm test` and the ghost regression bot are separate on purpose

`tests/ghost/` holds 4 gates that each play 50 full games and are deliberately
calibrated to take ~15-20 minutes (their own `it()` timeouts are 20-30 min —
see the comments in `tests/ghost/ghostPlayerStrict.test.ts`). Plain `npm test`
(`vitest.config.dev.ts`) used to include them via its broad
`tests/**/*.test.ts` glob, so a "fast feedback" run silently became a
20-30-minute one — indistinguishable from a hang to anyone who reasonably
didn't wait that long (root-caused 2026-07-18). `tests/ghost/**` is now
excluded from `vitest.config.dev.ts`; run it explicitly with
`npm run test:ghost` (its own config, `vitest.config.ghost.ts`) instead. This
matches what `run-tests-batch-fixed.sh` already did — it has never included
`tests/ghost/`.

## 📊 Test Count

183 test files in the repo as of v3.1.85 (`find tests -name "*.test.ts" -o -name "*.test.tsx" | wc -l`). Most recent full-suite report (main + ghost combined, CHANGELOG v3.1.84, 2026-07-31): **2582 passed / 1 skipped**. Counts of individual test cases inside files have been intentionally removed from this doc — they go stale fast, and this repo-wide number will too. For a current number, either run `npm test` (main suite) + `npm run test:ghost` (ghost gates) and add their totals, or check the top few entries of CHANGELOG.md for the latest reported "full suite" count. Note `./tests/scripts/run-tests-batch-fixed.sh` runs a curated 60-file subset across its 22 batches for fast pre-commit feedback, not the full 183 — as of 2026-08-01 all 60 paths are real and all 22 batches pass.

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
- Should no longer happen — `tests/ghost/`'s 15-20-min gates are excluded from `vitest.config.dev.ts` (2026-07-18 fix; see "npm test and the ghost regression bot are separate on purpose" above). If `npm test` still doesn't return in a couple minutes, that's a new regression, not the old known issue — use the batch script to bisect.
- For individual files, hangs usually mean unmocked async operations or missing handler setters in test setup (see `tests/ghost/bootstrapServices.ts` for the canonical service-wiring pattern).

### **The three heavy E2E files (`E2E-AllPaths`, `E2E-Multiplayer2P`, `E2E-Multiplayer4P`) time out intermittently**
- Added 2026-07-28. These three drive whole game loops through the full service graph and are the suite's heaviest files by far — running them concurrently starves whichever one shares a machine with the other two, producing a timeout-on-unresolved-await that lands on a different file/sub-test each run. `vitest.config.dev.ts` now runs them in their own `e2e-heavy` project, one at a time (`fileParallelism: false`), which reduces but does **not** eliminate the flake — see the file's own header comment for the measured before/after numbers. Don't read one green run as proof it's fixed.
- To reproduce a specific failure on demand: these tests now seed `Math.random()` via `tests/helpers/seededRandom.ts` (`E2E_SEED` env var, default `20260728`), so a given seed always deals the same decks and walks the same path. Use `scripts/sweep-e2e-seeds.sh [start] [end] [all]` to sweep a seed range and find one that reproduces a hang — once found, re-run that single seed (`E2E_SEED=<n> npx vitest run --config vitest.config.dev.ts tests/E2E-AllPaths.test.ts`) as often as needed with a debugger attached, instead of chasing a moving target.

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
- **Batch execution recommended for the pre-commit gate** — see `run-tests-batch-fixed.sh` above. Plain `npm test` is fine on its own now (~2 min, ghost excluded); the batch script's value is per-batch isolation, not working around a hang.
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

**Test Cases for Future Implementation:** *(note: the core Try Again scenarios below — rollback, multiple retries, state consistency — are now largely covered by `tests/ghost/tryAgainSemantics.test.ts`, 7 tests pinning the Beta snapshot/costLedger model. The specific scenarios listed here predate that file and are kept as a reference spec; check there first before assuming a gap.)

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

`tests/ghost/ghostPlayerStrict.test.ts` + siblings (`ghostPlayerNegotiateCoverage.test.ts`, `ghostPlayerSmartBot.test.ts`) are the headless-bot regression gate that plays 50 random games per CI run, split into separate files 2026-07-09 so the three batches run in parallel instead of sequentially. Two variants (of several — see `vitest.config.ghost.ts`'s header comment for the current full list of gates rather than a point-in-time CHANGELOG entry, which will drift):

- **Strict gate**: zero exceptions / invariant violations + ≥90% wins. Plus a separate `coverage.test.ts` gate, also 50 games, asserting every `GAME_CONFIG.csv` gameplay space was visited at least once. The current baseline is ~96% wins (2/50 games timeout in scope/fund-review loops — a documented bot-strategy artifact, not a game bug).
- **Try-again-happy variant** (`ghostPlayerNegotiateCoverage.test.ts`): same 50 games but with p=0.2 chance of using Try Again on negotiable spaces. Catches Try Again–related state corruption; win-rate is deliberately not a tight assertion here (see the file's own header for why).

`tests/ghost/` also holds several smaller, fast tests that aren't 50-game gates — `ghostPlayerLoopDetection.test.ts` (pure-logic loop-classifier unit tests, milliseconds), `dataIntegrity.test.ts` (static CSV validation, <1s), `authoredInsertion.test.ts`, `cardDrawRepro.test.ts`, `finalReviewStaleIntent.test.ts`, and `tryAgainSemantics.test.ts` (targeted regression pins, each using `bootstrapHeadlessServices()` rather than a full random-play batch). All of them run under `npm run test:ghost` alongside the heavy gates since they share the `tests/ghost/**` include in `vitest.config.ghost.ts`.

Run everything in `tests/ghost/`:
```bash
npm run test:ghost
```

If Ghost Player fails after a change, the action log captured in the test output is reproducible — the seed is logged, replay is deterministic.
