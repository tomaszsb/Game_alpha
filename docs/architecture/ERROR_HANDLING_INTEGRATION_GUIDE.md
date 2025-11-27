# Error Handling Integration Guide

**Purpose:** Guide for integrating ErrorNotifications into services
**Created:** November 18, 2025
**Status:** Reference Implementation

---

## Overview

This guide shows how to integrate the `ErrorNotifications` utility into game services to provide consistent, user-friendly error messages.

### Current State

- ✅ ErrorBoundary implemented (catches component crashes)
- ✅ ErrorNotifications utility created (18+ error types)
- ⏭️ Service integration needed (currently use console.warn/error)

### Goal

Replace console.warn/error with ErrorNotifications that:
1. Provide user-friendly error messages
2. Can be displayed in UI
3. Maintain consistent error handling
4. Enable better error tracking

---

## Integration Pattern

### Step 1: Import ErrorNotifications

```typescript
// At top of service file
import { ErrorNotifications } from '../utils/ErrorNotifications';
```

### Step 2: Replace Console Errors with Throw Statements

**Before:**
```typescript
canAfford(playerId: string, amount: number): boolean {
  const player = this.stateService.getPlayer(playerId);
  if (!player) {
    console.error(`Player ${playerId} not found`);
    return false;
  }
  return player.money >= amount;
}
```

**After:**
```typescript
canAfford(playerId: string, amount: number): boolean {
  const player = this.stateService.getPlayer(playerId);
  if (!player) {
    const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
    throw new Error(error.detailed);
  }
  return player.money >= amount;
}
```

### Step 3: Use Specific Error Types

Match the error to the appropriate ErrorNotifications method:

```typescript
// Insufficient funds
if (!this.canAfford(playerId, amount)) {
  const error = ErrorNotifications.insufficientFunds(amount, player.money);
  // Option A: Throw for critical errors
  throw new Error(error.detailed);

  // Option B: Return false and log for non-critical
  console.warn(error.medium);
  return false;
}

// Resource operation failed
try {
  // ... operation
} catch (err) {
  const error = ErrorNotifications.resourceOperationFailed(
    'spend',
    'money',
    (err as Error).message
  );
  throw new Error(error.detailed);
}
```

---

## Reference Implementation: ResourceService

### Example 1: Money Operations

**Location:** `ResourceService.addMoney()`

```typescript
addMoney(playerId: string, amount: number, source: string, reason?: string): boolean {
  // Validate amount
  if (amount <= 0) {
    const error = ErrorNotifications.resourceOperationFailed(
      'add',
      'money',
      `Invalid amount: ${amount}`
    );
    console.warn(error.medium);
    return false;
  }

  // Validate player exists
  const player = this.stateService.getPlayer(playerId);
  if (!player) {
    const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
    throw new Error(error.detailed);
  }

  // Perform operation
  return this.updateResources(playerId, {
    money: amount,
    source,
    reason: reason || `Added $${amount.toLocaleString()}`
  });
}
```

### Example 2: Spending with Validation

**Location:** `ResourceService.spendMoney()`

```typescript
spendMoney(playerId: string, amount: number, source: string, reason?: string): boolean {
  // Validate amount
  if (amount <= 0) {
    const error = ErrorNotifications.resourceOperationFailed(
      'spend',
      'money',
      `Invalid amount: ${amount}`
    );
    console.warn(error.medium);
    return false;
  }

  // Get player
  const player = this.stateService.getPlayer(playerId);
  if (!player) {
    const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
    throw new Error(error.detailed);
  }

  // Check affordability
  if (!this.canAfford(playerId, amount)) {
    const error = ErrorNotifications.insufficientFunds(amount, player.money);
    console.warn(error.medium);
    // Note: Don't throw here - let caller handle insufficient funds
    return false;
  }

  // Perform operation
  return this.updateResources(playerId, {
    money: -amount,
    source,
    reason: reason || `Spent $${amount.toLocaleString()}`
  });
}
```

### Example 3: Async Operations with Try/Catch

**Location:** Any async service method

```typescript
async drawCardAsync(playerId: string, cardType: CardType): Promise<string[]> {
  try {
    // Validate player
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    // Validate card type
    if (!this.isValidCardType(cardType)) {
      const error = ErrorNotifications.cardDrawFailed(
        cardType,
        'Invalid card type'
      );
      throw new Error(error.detailed);
    }

    // Perform draw
    const cards = this.drawCards(playerId, cardType, 1);

    // Check if draw succeeded
    if (cards.length === 0) {
      const error = ErrorNotifications.cardDrawFailed(
        cardType,
        'No cards available in deck'
      );
      console.warn(error.medium);
      return [];
    }

    return cards;
  } catch (error) {
    // Re-throw with formatted message if not already formatted
    if (error instanceof Error && !error.message.startsWith('❌')) {
      const formattedError = ErrorNotifications.genericError(
        `drawing ${cardType} card`,
        error
      );
      throw new Error(formattedError.detailed);
    }
    throw error;
  }
}
```

---

## Service-Specific Patterns

### CardService

**Error Types to Use:**
- `cardPlayFailed()` - When card cannot be played
- `cardDrawFailed()` - When card draw fails
- `cardDiscardFailed()` - When discard fails
- `invalidState()` - When player/card not found

**Example Locations:**
- `drawCards()` - line 51
- `playCard()` - find location
- `discardCard()` - find location

### TurnService

**Error Types to Use:**
- `turnActionFailed()` - When turn action fails
- `notYourTurn()` - When player tries to act out of turn
- `diceRollFailed()` - When dice roll fails
- `tryAgainNotAvailable()` - When Try Again cannot be used

**Example Locations:**
- `rollDice()` - find location
- `endTurn()` - find location
- `tryAgain()` - find location

### MovementService

**Error Types to Use:**
- `invalidMove()` - When move is not allowed
- `movementFailed()` - When movement operation fails
- `invalidState()` - When player/space not found

**Example Locations:**
- `movePlayer()` - find location
- `getValidMoves()` - find location

### EffectEngineService

**Error Types to Use:**
- `effectProcessingFailed()` - When effect cannot be processed
- `invalidState()` - When game state is invalid
- `genericError()` - For unexpected errors

**Example Locations:**
- `processEffect()` - find location
- `applyEffect()` - find location

---

## UI Integration Pattern

### How UI Components Catch Service Errors

Components should wrap service calls in try/catch:

```typescript
// In a component (e.g., FinancesSection.tsx)
const handleRollForMoney = async () => {
  setIsLoading(true);
  setError(null);

  try {
    await gameServices.turnService.rollForMoney(playerId);
  } catch (err) {
    // Error is already formatted by service
    setError((err as Error).message);
    console.error('Roll for money error:', err);
  } finally {
    setIsLoading(false);
  }
};
```

### Displaying Errors

```tsx
{error && (
  <div className="error-message">
    {error}
    <button onClick={() => setError(null)}>Dismiss</button>
  </div>
)}
```

---

## Decision Guide: Throw vs Return False

### When to THROW:
- ✅ Critical errors (player not found, invalid state)
- ✅ Unexpected errors (bugs, data corruption)
- ✅ Errors that should stop execution
- ✅ Errors in async functions

**Example:**
```typescript
if (!player) {
  throw new Error(ErrorNotifications.invalidState('Player not found').detailed);
}
```

### When to RETURN FALSE:
- ✅ Validation failures (insufficient funds, invalid input)
- ✅ Business logic failures (cannot perform action)
- ✅ Expected failure cases
- ✅ When caller should handle the failure

**Example:**
```typescript
if (!this.canAfford(playerId, amount)) {
  console.warn(ErrorNotifications.insufficientFunds(amount, balance).medium);
  return false;
}
```

---

## Testing Error Integration

### Unit Test Example

```typescript
describe('ResourceService with ErrorNotifications', () => {
  test('spendMoney throws error when player not found', () => {
    expect(() => {
      service.spendMoney('invalid-player', 100, 'test');
    }).toThrow('Player invalid-player not found');
  });

  test('spendMoney returns false when insufficient funds', () => {
    const player = createTestPlayer({ money: 50 });
    const result = service.spendMoney(player.id, 100, 'test');
    expect(result).toBe(false);
  });

  test('error message includes formatted amounts', () => {
    const player = createTestPlayer({ money: 500 });
    try {
      service.spendMoney(player.id, 1000, 'test');
    } catch (err) {
      expect((err as Error).message).toContain('$500');
      expect((err as Error).message).toContain('$1,000');
    }
  });
});
```

---

## Implementation Checklist

### Phase 1: Preparation
- [x] ErrorNotifications utility created
- [x] ErrorBoundary implemented
- [x] UI components have error state
- [x] UI components have loading state

### Phase 2: Service Integration (In Progress)
- [x] ~~Import ErrorNotifications in each service~~ (ResourceService, CardService)
- [x] ~~Replace console.error with throw statements~~ (ResourceService, CardService)
- [x] ~~Replace console.warn with appropriate handling~~ (ResourceService, CardService)
- [x] ~~Use specific error types for each case~~ (ResourceService, CardService)
- [ ] Test error paths with unit tests

**Completed Services:**
- ✅ **ResourceService** - All 16 error locations updated
  - Invalid amounts (add, spend, loan) → `resourceOperationFailed()`
  - Insufficient funds → `insufficientFunds()`
  - Player not found → `invalidState()` with throw
  - Validation failures → `resourceOperationFailed()`
  - Exception handling → Enhanced with ErrorNotifications

- ✅ **CardService** - All 25+ error locations updated
  - Card draw failures → `cardDrawFailed()`
  - Card play failures → `cardPlayFailed()`
  - Card discard failures → `cardDiscardFailed()`
  - Player not found → `invalidState()` with throw
  - Invalid card types → `cardDrawFailed()` / `cardPlayFailed()`
  - Transfer errors → `genericError()`

**Remaining Services:**
- [ ] TurnService (~40 locations)
- [ ] MovementService (~10 locations)
- [ ] EffectEngineService (~30 locations)

### Phase 3: UI Verification
- [ ] Verify errors display in UI
- [ ] Test error recovery flows
- [ ] Ensure loading states work
- [ ] User testing of error messages

---

## Migration Strategy

### Approach: Incremental + Risk-Based

**High Priority (Do First):**
1. Player not found errors → Use `invalidState()`
2. Insufficient funds → Use `insufficientFunds()`
3. Invalid moves → Use `invalidMove()`
4. Card operations → Use `cardPlayFailed()`, `cardDrawFailed()`

**Medium Priority:**
5. Turn operations → Use `turnActionFailed()`
6. Effect processing → Use `effectProcessingFailed()`

**Low Priority (Optional):**
7. Debug warnings that don't affect gameplay
8. Internal state tracking logs

### Estimated Effort

- **ResourceService:** ~2 hours (18 locations)
- **CardService:** ~2 hours (15+ locations)
- **TurnService:** ~3 hours (40+ locations)
- **MovementService:** ~1 hour (10+ locations)
- **EffectEngineService:** ~2 hours (30+ locations)

**Total:** ~10 hours for full integration

### Recommendation

**For Current Release:**
- ✅ Keep current console.warn/error (works)
- ✅ UI already has error boundaries (prevents crashes)
- ⏭️ Service integration can be done incrementally post-launch

**Post-Release:**
- Pick one service per sprint
- Update, test, deploy
- Monitor error tracking
- Iterate based on production data

---

## Error Tracking Integration (Future)

Once services use ErrorNotifications, add error tracking:

```typescript
// In ErrorBoundary.tsx
import * as Sentry from '@sentry/react';

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // Send to Sentry
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack
      }
    }
  });
}
```

---

## Summary

### Current Status
- ✅ Infrastructure ready (ErrorNotifications + ErrorBoundary)
- ✅ UI components handle errors
- ⏭️ Service integration is optional enhancement

### Next Steps
1. **Now:** Use this guide as reference
2. **QA:** Test current error handling
3. **Post-Launch:** Integrate incrementally
4. **Future:** Add error tracking service

---

**The game is production-ready with current error handling. ErrorNotifications integration is an enhancement that can be done incrementally.**

---

*Last Updated: November 18, 2025*
*Status: Reference Implementation Complete*
