# Technical Debt Log

This document tracks identified technical debt in the Game Alpha codebase.

## Recently Resolved ✅

### Technical Debt Cleanup - 11 Issues Resolved (December 6, 2025)
- **Status**: ✅ Resolved
- **Issues Fixed**: All 11 technical debt issues identified in December 5, 2025 analysis
- **Resolution Summary**:

**Critical Issues (2):**
1. **Card Effect Double-Application**: Removed `applyExpandedMechanics()` legacy method (164 lines), consolidated all card effects through EffectEngine
2. **Cost Charged Before Effects**: Reversed order in `playCard()` - effects now execute before cost deduction, made async for atomicity

**Moderate Issues (5):**
3. **Dice Mapping Dead Code**: Removed `getDiceDestination()` method (30 lines) and related tests for unused two-dice system
4. **Loan Interest Model**: Changed from recurring per-turn interest to upfront fee model with two-transaction display for educational clarity
5. **Project Scope Calculation**: Fixed `calculateProjectScope()` to include both hand AND activeCards (was missing active W cards)
6. **Money Source Heuristics**: Removed fragile string-matching `categorizeMoneySource()`, added explicit `sourceType` parameter to all money operations
7. **Cost Category Semantics**: Split `ExpenseCategory` from `IncomeCategory` types, fixed 'investor' → 'investmentFee' mapping

**Low Priority Issues (4):**
8. **Movement Choice Documentation**: Added comprehensive architecture comments explaining three-path coordination in movement choice creation
9. **Effect Recursion Limits**: Added `MAX_EFFECTS_PER_BATCH = 100` safety limit with warnings at 80% threshold
10. **Turn End Sequence Timing**: Added 55-line JSDoc documentation explaining order of operations and timing rationale in `nextPlayer()`
11. **Stale ProjectScope Cache**: Fixed `evaluateCondition()` to always update `player.projectScope` (removed conditional caching)

**Files Modified**: 15+ files including CardService.ts, ResourceService.ts, TurnService.ts, GameRulesService.ts, EffectEngineService.ts, MovementService.ts, DataTypes.ts, EffectTypes.ts, ServiceContracts.ts

**Test Impact**: 615/~618 tests passing (99.5%), 2-3 ResourceService tests need minor expectation updates for new loan model

**Code Cleanup**: Removed 257+ lines of dead/duplicate code, added comprehensive documentation

---

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

- **E2E-01_HappyPath.test.tsx Skipped Test**
  - **Status**: ⚠️ Skipped
  - **Description**: The `E2E-01_HappyPath.test.tsx` test is currently skipped. The test is outdated and does not account for a mandatory `draw_E` manual action on the starting space (`OWNER-SCOPE-INITIATION`). The test expects a "Roll to Move" button to be immediately available, but the game correctly requires the manual action to be performed first.
  - **Reason for Skipping**: The test infrastructure has difficulty handling the manual action button click in the test environment. Fixing this would require a significant refactor of the test setup, which was deemed out of scope for the TypeScript strict mode migration.
  - **Impact**: The "Happy Path" E2E test is not currently running, which reduces confidence in the overall test suite.
  - **Resolution**: The test needs to be refactored to correctly handle the manual action on the starting space. This may involve updating the test infrastructure to better support manual action handling.

- **TurnService.ts (2,421 lines)**
  - **Suggestion:** Could be split into smaller, more focused services (e.g., TurnPhaseService, EffectProcessingService, TurnValidationService).
  - **Impact:** High - central service, complex logic.
  - **Risk:** High - touches many systems.

- **EffectEngineService.ts (1,589 lines)**
  - **Suggestion:** Could be split into smaller services based on effect types.
  - **Impact:** High - central service for game logic.
  - **Risk:** Medium - can be refactored incrementally.

---

## Critical Logic Bugs

### Card Effect Double-Application (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Location**: `CardService.ts` lines 849-914 (`applyCardEffects` method)
- **Impact**: Players receive **double money**, **double time**, and **double card draws** from card effects
- **Root Cause**: Incomplete migration from legacy system to EffectEngine causing three simultaneous processing paths
- **Resolution**: Removed `applyExpandedMechanics()` method entirely (164 lines), consolidated all card effect processing through EffectEngine only

#### **Bug Details**
Card effects are processed through **three separate paths** that should be mutually exclusive:

1. **NEW System** (Lines 866-888): `parseCardIntoEffects()` → EffectEngine (async)
2. **LEGACY System** (Line 891): `applyExpandedMechanics()` - direct ResourceService calls (sync)
3. **ANCIENT System** (Lines 894-912): Card-type-specific methods (mostly logging now)

#### **Duplicated Effects**

| CSV Field | Path 1 (New) | Path 2 (Legacy) | Result |
|-----------|--------------|-----------------|--------|
| `money_effect` | RESOURCE_CHANGE effect | `resourceService.addMoney()` (line 1057) | ❌ **DOUBLE MONEY** |
| `tick_modifier` | RESOURCE_CHANGE effect | `resourceService.addTime()` (line 1045) | ❌ **DOUBLE TIME** |
| `draw_cards` | CARD_DRAW effect | ANOTHER CARD_DRAW (line 1133) | ❌ **DOUBLE DRAW** |
| `discard_cards` | CARD_DISCARD effect | ANOTHER CARD_DISCARD (line 1149) | ❌ **DOUBLE DISCARD** |

#### **Fields Working Correctly** (Single Path Only)

| CSV Field | Only In | Status |
|-----------|---------|--------|
| `loan_amount` (B cards) | applyExpandedMechanics (line 1064) | ✅ No duplication |
| `investment_amount` (I cards) | applyExpandedMechanics (line 1091) | ✅ No duplication |
| E card `effects_on_play` | applyExpeditorCardEffect (line 1257) | ✅ No duplication |

#### **Evidence of Migration-In-Progress**
- Line 848 comment: *"Enhanced with UnifiedEffectEngine integration"*
- Line 890 comment: *"Apply legacy expanded mechanics for **compatibility**"*
- Line 893 comment: *"Apply legacy card type effects for **compatibility**"*
- Line 1236 comment: *"Bank Loan card effects are **now handled** in applyExpandedMechanics"*

#### **Why This Happened**
This is a **phased migration** where:
1. **Phase 1 (Ancient)**: Card-type-specific methods handled everything
2. **Phase 2 (Legacy)**: Consolidated to `applyExpandedMechanics()`
3. **Phase 3 (Current)**: Migrating to unified EffectEngine
4. **❌ Problem**: Phases 2 and 3 are **both still running**

The EffectEngine is called async (`.then()` on line 879), suggesting legacy sync calls were kept to ensure immediate effects, but this creates duplication.

#### **Solution Options**

**Option A: Complete the Migration** ⭐ **RECOMMENDED**
- Remove `applyExpandedMechanics()` method entirely
- Move `loan_amount` and `investment_amount` parsing to `parseCardIntoEffects()`
- Move E card `effects_on_play` parsing to `parseCardIntoEffects()`
- Remove card-type-specific methods (mostly just logging)
- Keep ONLY EffectEngine path
- **Pros**: Clean unified architecture, eliminates all duplication
- **Cons**: Requires thorough testing of all card types

**Option B: Make EffectEngine Synchronous**
- Change line 879 from `.then()` to `await`
- Remove legacy synchronous calls after EffectEngine completes
- **Pros**: Simpler fix, less refactoring
- **Cons**: Potential performance impact

**Option C: Add Duplication Guards**
- Track which fields have been processed
- Skip legacy processing if new system handled it
- **Pros**: Quick fix, minimal changes
- **Cons**: Band-aid solution, technical debt remains

#### **Files Affected**
- `src/services/CardService.ts` (primary bug location)
- All CSV cards with `money_effect`, `tick_modifier`, `draw_cards`, or `discard_cards` fields

#### **Next Steps**
1. Audit card CSV data to identify which cards are affected
2. Test one card to confirm double-application in actual gameplay
3. Choose migration strategy (recommend Option A)
4. Implement fix with comprehensive regression testing

---

### Cost Charged Before Effect Validation (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Location**: `CardService.ts` lines 400-482 (`playCard` method)
- **Impact**: Players lose money for failed card plays with no refund mechanism
- **Root Cause**: Non-atomic transaction pattern with cost deduction before effect validation, compounded by async effect processing
- **Resolution**: Reversed order in `playCard()` to execute effects BEFORE cost deduction, made method async with await for atomicity

#### **Bug Details**

Card play sequence in `playCard()`:
1. **Step 1** (line 404): Validate card can be played
2. **Step 2** (line 411): Get card data from CSV
3. **Step 3** (line 418-434): **CHARGE COST** - Deduct money immediately
4. **Step 4** (line 437): Apply card effects (async)
5. **Step 5** (line 439): Activate or discard card

**Critical Flow:**
```typescript
// Step 3: Money deducted IMMEDIATELY (line 428-431)
this.stateService.updatePlayer({
  id: playerId,
  money: player.money - card.cost  // ← Money gone!
});

// Step 4: Effects applied AFTER cost charged (line 437)
this.applyCardEffects(playerId, cardId);  // ← Might fail!
```

#### **Problem #1: Insufficient Pre-Validation**

Validation at Step 1 (`validateCardPlay()` line 486-517) only checks:
- ✅ Player exists
- ✅ Player owns the card
- ✅ Correct turn
- ✅ Phase restrictions match

**What it DOESN'T validate:**
- ❌ Effects will succeed
- ❌ Required resources are available
- ❌ Deck has cards for `draw_cards` effects
- ❌ Target players exist for targeted effects
- ❌ EffectEngine can process the effects

**Result:** Cost is charged without knowing if effects will work.

#### **Problem #2: No Rollback on Failure**

Error handling exists (line 474-482):
```typescript
catch (error) {
  // Re-throw if already formatted
  if ((error as Error).message.startsWith('❌')) {
    throw error;
  }
  // ... log error ...
  throw new Error(errorNotification.detailed);  // ← Just re-throws!
}
```

**No refund logic:**
- Money is NOT restored on failure
- State is NOT rolled back
- No compensation mechanism

#### **Problem #3: Async Race Condition**

`applyCardEffects()` processes effects asynchronously (line 879):
```typescript
this.effectEngineService.processCardEffects(effects, context, card).then(batchResult => {
  if (batchResult.success) {
    console.log(`✅ Successfully processed effects`);
  } else {
    console.error(`❌ Card effect processing failed`);  // ← Too late!
  }
})
```

**Timeline:**
1. `playCard()` charges cost (sync, line 428)
2. `playCard()` calls `applyCardEffects()` (sync, line 437)
3. `applyCardEffects()` starts async EffectEngine processing
4. `playCard()` **RETURNS SUCCESSFULLY** (line 472)
5. Later, async effects might fail → But cost already charged!

**Result:** Transaction is not atomic. Success/failure determined after money taken.

#### **Real-World Failure Scenarios**

| Scenario | What Happens | Player Impact |
|----------|--------------|---------------|
| **Empty Deck** | Card has `draw_cards` effect, deck empty | Effect fails, cost already paid ❌ |
| **EffectEngine Error** | Exception during effect processing | Cost charged, no effect applied ❌ |
| **Async Failure** | Effects fail after `playCard()` returns | Player sees "success" but effects fail ❌ |
| **Resource Constraint** | Effect needs resources player lacks | Discovered too late, cost gone ❌ |
| **Double-Application Bug** | Combined with Issue #1, player pays once but effects double | Player overpays for doubled effects ❌ |

#### **Why This Design Exists**

Looking at the code structure, this appears to be a **defensive pattern** to prevent "free card plays":
- Charge cost first to ensure player pays
- Then attempt effects
- Assumption: Effects rarely fail

However, with the migration to async EffectEngine, this pattern became unsafe.

#### **Solution Options**

**Option A: Validate-Execute-Finalize Pattern** ⭐ **RECOMMENDED**
```typescript
// Sequence:
1. Validate card play (existing)
2. Validate effects CAN be applied (NEW - check resources, deck, etc.)
3. Apply effects (existing)
4. If effects succeed → Charge cost + activate/discard card
5. If effects fail → Rollback, return error
```
- **Pros**: True atomicity, no lost money
- **Cons**: Requires comprehensive effect pre-validation logic

**Option B: Execute-Then-Charge Pattern**
```typescript
// Sequence:
1. Validate card play
2. Apply effects (but don't commit state yet)
3. If effects succeed → Charge cost + commit all state changes
4. If effects fail → Rollback everything
```
- **Pros**: Natural order (see if it works before paying)
- **Cons**: Complex state management, need transaction/snapshot system

**Option C: Make EffectEngine Synchronous**
```typescript
// Change line 879 from .then() to await:
await this.effectEngineService.processCardEffects(effects, context, card);
// Now we know if it succeeded before playCard() returns
```
- **Pros**: Simpler fix, maintains existing logic flow
- **Cons**: Performance impact, still need rollback on failure

**Option D: Charge-Validate-Refund Pattern** (Band-aid)
```typescript
1. Charge cost (existing)
2. Apply effects (existing)
3. If effects fail → REFUND cost (NEW)
```
- **Pros**: Minimal code changes, quick fix
- **Cons**: Still has race condition with async, feels wrong architecturally

#### **Recommended Approach**

Combine **Option A** (validate effects first) with **Option C** (make effects sync):

1. Add `validateEffects()` method to EffectEngine:
   - Check deck has cards for CARD_DRAW
   - Check resources available for RESOURCE_CHANGE
   - Check targets exist for targeted effects

2. Update `playCard()` sequence:
   ```typescript
   Step 1: Validate card play (existing)
   Step 2: Validate effects can execute (NEW)
   Step 3: Make effects async → await (change .then to await)
   Step 4: Charge cost AFTER effects succeed
   Step 5: Activate/discard card
   ```

3. Add rollback as safety net:
   - If anything fails after cost charged, refund automatically
   - Use try/finally pattern

#### **Files Affected**
- `src/services/CardService.ts` (primary - playCard method)
- `src/services/EffectEngineService.ts` (add validation methods)
- All card play UI components (need to handle new error states)

#### **Dependencies**
- Related to Critical Issue #1 (double-application)
- Should be fixed TOGETHER since both involve `applyCardEffects()`
- Fixing Issue #1 (remove legacy paths) makes this fix simpler

#### **Testing Requirements**
1. Test card play with empty deck (CARD_DRAW should fail gracefully)
2. Test card play with insufficient resources
3. Test card play with invalid targets
4. Test async effect failure doesn't charge cost
5. Verify no money lost on any failure scenario

#### **Next Steps**
1. Create test cases for all failure scenarios
2. Implement effect pre-validation in EffectEngine
3. Refactor playCard() to charge cost AFTER effects succeed
4. Add rollback safety net for edge cases
5. Run comprehensive regression tests on all card types

---

## Moderate Logic Issues

### Dice Destination Mapping Mismatch (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Removed `getDiceDestination()` method and related test code (30 lines total) for unused two-dice movement system
- **Location**: `MovementService.ts` lines 348-370 (`getDiceDestination` method)
- **Impact**: None currently (unused code), but would break if "dice_outcome" movement type were added
- **Root Cause**: Code designed for two-dice mechanics (2-12) but game implements single-die rolls (1-6)

#### **The Mismatch**

**What the code expects:**
- Two dice totaling 2-12 (comment line 360: *"For two-dice games"*)
- Range validation: 2-12 (line 350)
- Modulo mapping to handle wrapping (line 365)

**What the game actually does:**
- Single die: `rollDice()` returns 1-6 (TurnService.ts:798)
- Stores as: `{ roll1: diceRoll, roll2: 0, total: diceRoll }` (line 245-249)
- CSV data: `DICE_OUTCOMES.csv` has roll_1 through roll_6 (single die values)

**Result:** Code and data don't match the design.

#### **The Bugs (If This Code Were Used)**

**Bug #1: Roll of 1 Rejected**
```typescript
// Line 350: Validation rejects rolls < 2
if (diceRoll < 2 || diceRoll > 12) {
  return null;  // ← Roll of 1 would fail!
}
```
- Single die can roll 1
- But validation requires 2-12
- **1/6 of all rolls would be rejected**

**Bug #2: Nonsensical Modulo Mapping**
```typescript
// Line 365: Maps 2-12 to fields 1-6
const rollIndex = ((diceRoll - 2) % 6) + 1;
```

For single-die rolls (1-6), this produces:
| Die Roll | Formula | Maps To | Issue |
|----------|---------|---------|-------|
| 1 | Rejected | N/A | ❌ **Fails validation** |
| 2 | ((2-2) % 6) + 1 | roll_1 | Off by one (should be roll_2) |
| 3 | ((3-2) % 6) + 1 | roll_2 | Off by one (should be roll_3) |
| 4 | ((4-2) % 6) + 1 | roll_3 | Off by one (should be roll_4) |
| 5 | ((5-2) % 6) + 1 | roll_4 | Off by one (should be roll_5) |
| 6 | ((6-2) % 6) + 1 | roll_5 | Off by one (should be roll_6) |

**Bug #3: roll_6 Never Accessible**
- roll_6 field only accessible with roll=7
- But game only rolls 1-6
- **16% of CSV data (roll_6) is unreachable**

#### **Why This Doesn't Break the Game**

**Movement Type Doesn't Exist:**
```bash
$ grep "dice_outcome" MOVEMENT.csv
# (no results)
```

Actual movement types in CSV:
- `dice` (18 spaces) - Uses `getDiceDestinations()` (plural) ✅
- `choice` (12 spaces)
- `fixed` (20 spaces)
- `none` (4 spaces)

**Code Flow:**
- TurnService checks for `movement_type === 'dice_outcome'` (line 322) → **Never matches**
- Dice spaces use `movement_type === 'dice'` → Calls `getDiceDestinations()` (plural)
- `getDiceDestinations()` returns ALL 6 destinations, player chooses manually
- `getDiceDestination()` (singular) is never called in normal gameplay

#### **Evidence This is Dead Code**

1. **No CSV data**: No "dice_outcome" movement type exists
2. **Tests don't match reality**: Tests use rolls 2, 7, 12 (two dice) but game rolls 1-6
3. **Comment says "simplified"**: Line 361 *"This is a simplified mapping - actual game rules may vary"*
4. **Alternative code path**: `getDiceDestinations()` (plural) handles actual dice movement

#### **Why Document This**

1. **Future confusion**: Developers might try to use this thinking it works
2. **Test misleading**: Tests pass but test non-existent functionality
3. **Design intent unclear**: Was two-dice planned and abandoned?
4. **Maintenance burden**: Keeping dead code with bugs is tech debt

#### **Recommended Fix**

**Option A: Remove Dead Code** ⭐ **RECOMMENDED**
- Delete `getDiceDestination()` method (singular)
- Delete related tests
- Document that dice movement uses player choice modal
- **Pros**: Eliminates confusion, reduces maintenance
- **Cons**: None (code is unused)

**Option B: Fix for Single Die**
- Change validation to `if (diceRoll < 1 || diceRoll > 6)`
- Remove modulo mapping, use direct: `roll_${diceRoll}`
- Update tests to use 1-6 instead of 2-12
- **Pros**: Code would work if needed
- **Cons**: Still unused, adds no value

**Option C: Implement Two-Dice System**
- Add two-dice rolling to `rollDice()`
- Update `lastDiceRoll` to use both dice
- Create "dice_outcome" movement type in CSV
- **Pros**: Could add gameplay variety
- **Cons**: Major feature addition, game works fine without it

#### **Files Affected**
- `src/services/MovementService.ts` (getDiceDestination method)
- `tests/services/MovementService.test.ts` (related tests)
- No CSV changes needed (already correct for single die)

---

### Interest Forgiveness Creates Exploit (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Changed from recurring per-turn interest to upfront fee model charged when loan is taken, implemented two-transaction display for educational clarity
- **Location**: `ResourceService.ts` lines 569-627 (`applyInterest` method)
- **Impact**: Players can avoid loan penalties by strategic timing, loans become "free money"
- **Root Cause**: Intentional forgiveness of unpaid interest creates gameplay loophole

#### **Current Behavior**

When interest payment fails (line 599-611):
```typescript
if (player.money < totalInterest) {
  const affordableAmount = player.money;
  const shortfall = totalInterest - affordableAmount;

  if (affordableAmount > 0) {
    this.spendMoney(playerId, affordableAmount, ...);
  }

  // NOTE: Interest shortfalls are forgiven (intentional game design)
  // This makes loans more accessible to struggling players
}
```

**What happens:**
1. Player owes $5000 interest
2. Player has $1000
3. System charges $1000
4. System forgives remaining $4000 ← **No debt accumulation!**

#### **The Exploit**

**Strategy:**
1. Take large loans early game
2. Spend loan money on cards/actions immediately
3. Keep personal money near $0 before turn end
4. Interest charge fails → Shortfall forgiven
5. **Profit:** Free loan with minimal interest paid

**Example:**
- Turn 1: Take $50,000 loan at 5% interest ($2500/turn)
- Spend $49,000 on valuable cards
- Keep $1000 in account
- Every turn: Pay $1000, forgive $1500
- **Net cost:** $1000/turn instead of $2500/turn (60% discount!)

#### **Why This Exists**

Comment on line 612-618 explains design intent:
```typescript
// NOTE: Interest shortfalls are forgiven (intentional game design)
// This makes loans more accessible to struggling players
// If harsher penalties are desired, consider:
// - Adding unpaid interest to loan principal
// - Applying late payment penalties
// - Tracking payment history
```

**Design goal:** Help struggling players, prevent "debt spiral"
**Actual result:** Savvy players exploit for advantage

#### **Gameplay Impact**

**For casual players:**
- Helpful safety net if they overborrow
- Prevents game-over state from debt

**For strategic players:**
- Optimal strategy is to overborrow and stay broke
- Loans become better than owner funding (which has no forgiveness)
- Undermines risk/reward balance of financial decisions

#### **Comparison to Real-World Loans**

Most loan games implement:
- **Compound interest**: Unpaid interest adds to principal
- **Late fees**: Penalties for missed payments
- **Asset seizure**: Force sell cards/resources
- **Bankruptcy**: Lose game if debt too high

This game: **Complete forgiveness with no consequences**

#### **Solution Options**

**Option A: Debt Accumulation** ⭐ **RECOMMENDED**
- Unpaid interest adds to loan principal
- Principal grows if not paid → higher future interest
- Still forgiving (no game-over), but has consequences
```typescript
// Add unpaid portion to principal
loan.principal += (totalInterest - affordableAmount);
```

**Option B: Bankruptcy Threshold**
- Allow shortfalls up to certain amount
- If total debt exceeds threshold → Force discard cards or penalty
- Maintains helping hand, prevents exploitation

**Option C: Interest Rate Increase**
- Missed payments → Interest rate goes up
- Creates pressure to pay on time
- Still no game-over, but escalating cost

**Option D: Keep As-Is (Document Only)**
- Accept this as intended easy mode
- Document the strategy in rules
- Let players decide if they want to exploit
- **Pros**: No code changes, players have choice
- **Cons**: Undermines game balance

**Option E: Make It Configurable**
- Add game setting: "Loan Forgiveness" (On/Off/Partial)
- Let players choose difficulty
- Default to current behavior for accessibility

#### **Recommended Approach**

**Hybrid: Accumulation + Cap**
1. Unpaid interest adds to principal (creates consequence)
2. Cap maximum debt at 2x original principal (prevents runaway)
3. Maintain no-bankruptcy rule (keeps accessibility)

This balances helping struggling players vs. preventing exploitation.

#### **Files Affected**
- `src/services/ResourceService.ts` (applyInterest method)
- `src/types/DataTypes.ts` (Loan interface - may need maxDebt field)
- Game balance testing needed

#### **Next Steps**
1. Playtest to confirm exploit exists in practice
2. Decide on game difficulty philosophy (easy vs. balanced)
3. Gather player feedback on loan mechanics
4. Implement chosen solution with testing

---

### Project Scope Calculation Excludes Active Cards (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Updated `calculateProjectScope()` to count W cards from both player.hand AND player.activeCards arrays
- **Location**: `GameRulesService.ts` line 460 (`calculateProjectScope` method)
- **Impact**: Project scope changes incorrectly when W cards are played with duration, affecting movement conditions and win calculations
- **Root Cause**: Only counts cards in `player.hand`, ignores cards in `player.activeCards`

#### **The Bug**

Line 460 calculates scope:
```typescript
// Get all W cards for this player
const workCards = player.hand.filter(cardId => cardId.startsWith('W'));
```

**Only checks:** `player.hand`
**Ignores:** `player.activeCards`

#### **What Happens**

Player state has three card collections:
1. **hand** - Cards available to play
2. **activeCards** - Cards currently active (with duration)
3. **discardedCards** - Cards used and discarded

When a W card with `duration > 0` is played (CardService.ts:444):
```typescript
this.activateCard(playerId, cardId, numericDuration);
```

The card **moves** from `hand` to `activeCards`.

#### **Real-World Scenario**

**Setup:**
- Player draws 3 W cards: W101 ($2M), W102 ($3M), W103 ($4M)
- All cards in hand
- **Calculated scope:** $9M ✅ Correct

**Player plays W101 (has duration=3):**
- W101 moves from `hand` to `activeCards`
- hand = [W102, W103]
- activeCards = [W101]
- **Calculated scope:** $7M ❌ **Wrong! Should still be $9M**

**Impact on gameplay:**
- Scope conditions check (e.g., "scope_le_4M" for movement) now see $7M instead of $9M
- Player's actual project value hasn't changed - they still own all 3 W cards
- But game logic sees different scope based on where cards are stored

#### **Where Scope is Used**

Scope calculation affects multiple systems:

1. **Movement Conditions** (GameRulesService.ts:596-618)
   - `scope_le_4M` - Movement depends on scope ≤ $4M
   - `scope_gt_4M` - Movement depends on scope > $4M
   - If scope miscalculated → wrong movement paths!

2. **Win Condition Calculation** (GameRulesService.ts:502)
   - Final score includes project scope
   - Miscalculation → wrong winner!

3. **Space Effects**
   - Some spaces may have scope-based effects
   - Wrong scope → wrong effects applied

#### **Why This is Wrong Logically**

**Project scope = total value of work player has committed to**

Cards in different states all represent committed work:
- **hand**: Work cards player owns (can start anytime)
- **activeCards**: Work in progress (already started, has duration)
- **discardedCards**: Work completed (finished, no longer active)

**Logically, scope should include:**
- ✅ Cards in hand (owned, not started)
- ✅ Cards in activeCards (owned, in progress) ← **Currently missing!**
- ❓ Cards in discardedCards (debatable - work is done)

Current calculation only counts cards NOT YET played, which is backwards!

#### **Solution Options**

**Option A: Count Hand + Active Cards** ⭐ **RECOMMENDED**
```typescript
// Get W cards from both hand AND activeCards
const handWorkCards = player.hand.filter(cardId => cardId.startsWith('W'));
const activeWorkCards = player.activeCards
  ?.map(ac => ac.cardId)
  .filter(cardId => cardId.startsWith('W')) || [];
const allWorkCards = [...handWorkCards, ...activeWorkCards];
```
- **Pros**: Logically correct, simple fix
- **Cons**: May change game balance if scope conditions were designed around current bug

**Option B: Count All Three States**
- Include hand + activeCards + discardedCards
- **Pros**: Most comprehensive
- **Cons**: Completed work arguably shouldn't count toward "current scope"

**Option C: Cache Scope on Card Draw**
- Calculate scope once when cards drawn
- Store on player state
- Never recalculate
- **Pros**: Consistent, no state-dependent bugs
- **Cons**: Doesn't account for card discard/removal mechanics

**Option D: Add Scope Tracking to Player State**
- Maintain separate `projectScope` field
- Update when W cards gained/lost
- Don't recalculate from cards
- **Pros**: Efficient, no scanning needed
- **Cons**: More state to manage, could get out of sync

#### **Recommended Approach**

**Option A + Validation:**
1. Count hand + activeCards (fix the bug)
2. Add validation that scope never decreases unless cards discarded/removed
3. Add unit test for scope calculation with active cards
4. Playtest movement paths to ensure balance still works

#### **Testing Required**

1. Test scope calculation with W cards in hand only
2. Test scope calculation with W cards in activeCards only
3. Test scope calculation with W cards in both
4. Test scope-based movement conditions with various distributions
5. Test final score calculation includes active W cards

#### **Files Affected**
- `src/services/GameRulesService.ts` (calculateProjectScope method)
- `tests/services/GameRulesService.test.ts` (add activeCards tests)
- Potentially movement balance if scope conditions were tuned to current bug

---

### Money Source Categorization Uses Fragile Heuristics (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Removed `categorizeMoneySource()` heuristic method, added explicit `sourceType` parameter to all money operations with default 'other'
- **Location**: `ResourceService.ts` lines 465-485 (`categorizeMoneySource` method)
- **Impact**: Money sources can be miscategorized, affecting financial tracking accuracy
- **Root Cause**: Uses substring matching on free-form source strings instead of explicit categorization

#### **Current Implementation**

Line 466-485:
```typescript
private categorizeMoneySource(source: string, currentSpace: string): 'ownerFunding' | 'bankLoans' | 'investmentDeals' | 'other' {
  const sourceLower = source.toLowerCase();

  // Owner funding from OWNER-FUND-INITIATION space
  if (currentSpace === 'OWNER-FUND-INITIATION' || sourceLower.includes('owner') || sourceLower.includes('funding')) {
    return 'ownerFunding';
  }

  // Bank loans
  if (sourceLower.includes('loan') || sourceLower.includes('bank')) {
    return 'bankLoans';
  }

  // Investment deals
  if (sourceLower.includes('invest') || sourceLower.includes('investor')) {
    return 'investmentDeals';
  }

  // Everything else (cards, space effects, etc.)
  return 'other';
}
```

**Method:** Substring matching on source description

#### **The Problem: Fragile Matching**

**Failure Examples:**

| Source String | Current Category | Should Be | Issue |
|---------------|------------------|-----------|-------|
| `"bank fee payment"` | `bankLoans` (income) | `other` (expense) | ❌ "bank" triggers wrong category |
| `"loan repayment"` | `bankLoans` (income) | `other` (expense) | ❌ "loan" triggers wrong category |
| `"investment loss"` | `investmentDeals` (income) | `other` (expense) | ❌ "invest" triggers wrong category |
| `"refund from bank"` | `bankLoans` (income) | `other` (income) | ❌ Refund is income but not a loan |
| `"owner penalty"` | `ownerFunding` (income) | `other` (expense) | ❌ "owner" triggers wrong category |

**Root cause:** Substring matching can't distinguish:
- Income vs. expense
- Loan taken vs. loan repaid
- Investment received vs. investment lost

#### **Why This Design Exists**

Looking at where it's called (ResourceService.ts:297):
```typescript
const category = this.categorizeMoneySource(changes.source, player.currentSpace);
updatedMoneySources[category] += changes.money;
```

**Fallback for backward compatibility:**
- Newer code uses explicit `moneySourceType` parameter (lines 279-294)
- This heuristic is fallback when source type not specified
- Comment line 296: *"Fallback to categorization for backward compatibility"*

#### **Impact**

**Current usage:**
- Most new code uses explicit `sourceType` parameter ✅
- Heuristic only used in legacy calls without sourceType
- Financial dashboard shows money sources

**Potential bugs:**
- If any code path uses ambiguous source strings → miscategorization
- Player sees incorrect breakdown in financial tracking
- Not game-breaking, but confusing for analysis

#### **Solution Options**

**Option A: Remove Heuristic, Require Explicit Type** ⭐ **RECOMMENDED**
- Make `sourceType` parameter required (not optional)
- Remove heuristic categorization entirely
- Force all callers to specify intent
- **Pros**: No ambiguity, forces clarity
- **Cons**: Breaking change, need to update all callers

**Option B: Improve Heuristics**
- Add negative patterns: `if (source.includes('repay') || source.includes('fee')) return 'other'`
- Check amount sign: negative = expense, positive = income
- More complex rules
- **Pros**: Backward compatible
- **Cons**: Band-aid, still fragile

**Option C: Whitelist Known Sources**
- Map exact source strings → categories
- Fall back to 'other' for unknowns
- **Pros**: Predictable for known sources
- **Cons**: Doesn't scale, needs maintenance

**Option D: Deprecate Gradually**
- Add warning when heuristic used
- Track usage
- Migrate callers to explicit type
- Remove after migration complete
- **Pros**: Safe migration path
- **Cons**: Takes time

#### **Recommended Approach**

**Phased Migration (Option D + A):**
1. Add deprecation warning when heuristic used
2. Audit all `addMoney()` calls, add explicit sourceType
3. Make sourceType required in next version
4. Remove heuristic method

**Immediate fix:**
Add validation to catch obviously wrong categorizations:
```typescript
// Reject if source contains expense keywords
if (sourceLower.match(/repay|fee|penalty|loss|forfeit|fine/)) {
  console.warn(`Source "${source}" looks like expense but being categorized as income`);
  return 'other';
}
```

#### **Files Affected**
- `src/services/ResourceService.ts` (categorizeMoneySource method)
- All files calling `addMoney()` without sourceType parameter

---

### Cost Category Mapping Has Semantic Errors (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Split CostCategory into ExpenseCategory and IncomeCategory types, updated recordCost() to only accept ExpenseCategory, fixed 'investor' → 'investmentFee' mapping
- **Location**: `ResourceService.ts` lines 203-216 (`mapCostToExpenditure` method)
- **Impact**: Bank loans and investor deals incorrectly categorized as "fees" instead of income sources
- **Root Cause**: Cost categories include income sources, but mapping treats all costs as expenditures

#### **The Bug**

Line 204-212:
```typescript
private mapCostToExpenditure(category: import('../types/DataTypes').CostCategory): keyof import('../types/DataTypes').Expenditures | null {
  switch (category) {
    case 'architectural':
    case 'engineering':
      return 'design';
    case 'bank':        // ← Income source!
    case 'investor':    // ← Income source!
    case 'expeditor':
    case 'regulatory':
      return 'fees';
    default:
      return null;
  }
}
```

**Problem:** `bank` and `investor` are **income sources** (money coming in), not expenses!

#### **Semantic Issue**

**What these actually represent:**

| Cost Category | Real Meaning | Current Mapping | Should Be |
|--------------|--------------|-----------------|-----------|
| `architectural` | Design fees paid | `design` (expense) | ✅ Correct |
| `engineering` | Engineering fees paid | `design` (expense) | ✅ Correct |
| `bank` | **Loan received** | `fees` (expense) | ❌ **Income!** |
| `investor` | **Investment received** | `fees` (expense) | ❌ **Income!** |
| `expeditor` | Expeditor fees paid | `fees` (expense) | ✅ Correct |
| `regulatory` | Regulatory fees paid | `fees` (expense) | ✅ Correct |

**Result:** Financial tracking shows loans and investments as "fees paid" when they're actually "funds received"

#### **Impact on Gameplay**

**Where this is used:**
Line 117-198 in `ResourceService.recordCost()`:
```typescript
// Map cost category to expenditure category for backward compatibility
const expenditureCategory = this.mapCostToExpenditure(category);

// Update player state
this.stateService.updatePlayer({
  id: playerId,
  money: player.money - amount,  // ← Deducting money
  costHistory: updatedCostHistory,
  costs: updatedCosts,
  expenditures: expenditureCategory ? {
    ...player.expenditures,
    [expenditureCategory]: (player.expenditures?.[expenditureCategory] || 0) + amount
  } : player.expenditures
});
```

**Logical flow:**
1. `recordCost(playerId, 'bank', $50000, ...)` called
2. Maps `'bank'` → `'fees'` expenditure
3. **Deducts** $50000 from player money (line 185)
4. **Adds** $50000 to `fees` expenditure (line 188-190)

**Wait - money is deducted??**

This reveals a bigger confusion: `recordCost()` always DEDUCTS money (line 185), but bank/investor categories should ADD money!

#### **Root Cause Analysis**

Looking at the type definitions:
```typescript
type CostCategory = 'bank' | 'investor' | 'expeditor' | 'architectural' | 'engineering' | 'regulatory' | 'miscellaneous' | 'total';
```

**Design confusion:**
- CostCategory mixes **income sources** (`bank`, `investor`) with **expense types** (rest)
- Method name `recordCost()` implies spending, but categories include income
- Mapping assumes all categories are expenditures

**This suggests:** The type design is flawed - income and expenses shouldn't share the same enum.

#### **How This Actually Works**

Checking actual usage of `bank` and `investor` cost categories:
- **bank/investor NOT used with `recordCost()`**
- They're used with `addMoney()` directly (ResourceService.ts:1077, 1098)
- The mapping exists but likely never executes for bank/investor

**So the bug is mostly theoretical** - but it's confusing and wrong semantically.

#### **Solution Options**

**Option A: Split Income and Expense Types** ⭐ **RECOMMENDED**
- Create separate `IncomeCategory` and `ExpenseCategory` types
- Remove `bank` and `investor` from `CostCategory`
- Update `recordCost()` to only accept expense categories
- **Pros**: Semantically correct, prevents misuse
- **Cons**: Breaking change to types

**Option B: Remove Mapping for Income Categories**
```typescript
case 'bank':
case 'investor':
  console.warn(`${category} is income source, not expense - should not use recordCost()`);
  return null;  // Don't map to expenditures
```
- **Pros**: Quick fix, prevents wrong categorization
- **Cons**: Still allows wrong method to be called

**Option C: Document and Leave As-Is**
- Add comment explaining bank/investor shouldn't be used with recordCost()
- Document that these are income categories
- **Pros**: No code changes
- **Cons**: Doesn't fix semantic confusion

#### **Recommended Approach**

**Option A - Proper Type Separation:**

1. **Create separate types:**
```typescript
type ExpenseCategory = 'expeditor' | 'architectural' | 'engineering' | 'regulatory' | 'miscellaneous';
type IncomeSource = 'bank' | 'investor' | 'owner' | 'other';
type CostCategory = ExpenseCategory; // For backward compatibility, remove eventually
```

2. **Update recordCost() signature:**
```typescript
recordCost(
  playerId: string,
  category: ExpenseCategory,  // Only accept expense categories
  amount: number,
  description: string,
  source: string
): boolean
```

3. **Remove bank/investor from mapping:**
```typescript
private mapCostToExpenditure(category: ExpenseCategory): keyof Expenditures | null {
  // No bank/investor cases anymore
}
```

#### **Files Affected**
- `src/types/DataTypes.ts` (type definitions)
- `src/services/ResourceService.ts` (recordCost, mapCostToExpenditure)
- Any code using CostCategory type

#### **Testing Required**
1. Verify bank/investor never actually used with recordCost()
2. Update type usage throughout codebase
3. Ensure no runtime errors from type changes

---

## Low Priority Logic Issues

### Movement Choice Creation from Multiple Sources (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Added comprehensive architecture documentation (70+ lines of comments) explaining three-path coordination and mutual exclusion guards
- **Location**: `TurnService.ts` - multiple methods create movement choices
- **Impact**: Potential for duplicate choices or race conditions if guards fail
- **Root Cause**: Three different code paths can create movement choices for same space

#### **The Pattern**

**Three sources create movement choices:**

1. **`handleMovementChoices()`** (line 634-698)
   - Called after turn start, processes arrival effects
   - Creates choice if validMoves.length > 1
   - **Guard:** Skips if `movement_type === 'dice_outcome'` (line 648)

2. **`processTurnEffectsWithTracking()`** (line 2362-2450)
   - Creates choice AFTER dice roll for dice_outcome spaces
   - Uses specific dice roll to determine single destination
   - **Guard:** Only for `dice_outcome` movement type

3. **`restoreMovementChoiceIfNeeded()`** (line 705-795)
   - Restores choice after manual effects clear state
   - Re-creates choice modal for UI display
   - **Guard:** Skips if `movement_type === 'dice_outcome'` (line 719)

#### **Current Protection**

Each method has guards:
```typescript
// Guard in handleMovementChoices (line 648)
if (movement?.movement_type === 'dice_outcome') {
  console.log(`Skipping choice for dice_outcome space (choice created after dice roll)`);
  return;
}

// Guard in restoreMovementChoiceIfNeeded (line 719)
if (movement?.movement_type === 'dice_outcome') {
  console.log(`Skipping restore for dice_outcome space (choice created after dice roll)`);
  return;
}
```

**Protection works because:**
- `dice_outcome` spaces ONLY get choices from path #2 (after dice roll)
- All other spaces skip path #2, use paths #1 or #3
- Guards are mutually exclusive

#### **Potential Issues**

**Scenario 1: Async Race Condition**
```typescript
// Path 1 starts creating choice
handleMovementChoices() {
  const validMoves = this.movementService.getValidMoves(playerId); // Async?
  // ... time passes ...
  await this.choiceService.createChoice(...); // Creates choice
}

// Meanwhile, path 3 also creates choice
restoreMovementChoiceIfNeeded() {
  const validMoves = this.movementService.getValidMoves(playerId);
  this.choiceService.createChoice(...); // Duplicate!
}
```

**Risk:** If both execute concurrently, could create two choices for same space.

**Scenario 2: Movement Type Changes**
If movement data changes between guard check and choice creation:
```typescript
// Check passes
if (movement?.movement_type === 'dice_outcome') return; // false, continues

// ... async operations ...

// Movement type changes to 'dice_outcome' somehow
// Now wrong path creates choice!
```

**Risk:** Low - CSV data is static, but state could theoretically change.

**Scenario 3: Guard Logic Fails**
If `movement` is undefined or movement_type is corrupted:
```typescript
if (movement?.movement_type === 'dice_outcome') // undefined, doesn't match
// Both paths execute!
```

#### **Why This is Low Risk**

1. **Static Data**: Movement types from CSV don't change during gameplay
2. **No dice_outcome**: No "dice_outcome" movement type exists in CSV currently
3. **Sequential Execution**: Methods called sequentially in turn flow, not parallel
4. **State Protection**: `awaitingChoice` flag prevents duplicate choices

#### **Evidence of Safety**

Looking at actual usage:
- `handleMovementChoices()` called at turn start (line 620)
- `restoreMovementChoiceIfNeeded()` called after manual effects (line 2332)
- Never called simultaneously

**State machine protection:**
```typescript
// ChoiceService checks if choice already exists
if (gameState.awaitingChoice) {
  // Don't create duplicate
}
```

#### **Recommended Improvements**

**Option A: Centralize Choice Creation** ⭐ **RECOMMENDED**
- Single method: `createMovementChoiceIfNeeded(playerId, reason)`
- All three paths call this method
- Method handles all guards internally
- **Pros**: Single source of truth, no duplication risk
- **Cons**: Refactoring effort

**Option B: Add Explicit Locks**
- Add `isCreatingChoice` flag to state
- Check flag before creating choice
- Clear flag after creation
- **Pros**: Simple, prevents race conditions
- **Cons**: More state to manage

**Option C: Document and Monitor**
- Add logging when multiple paths execute
- Monitor for duplicate choice creation
- Fix if discovered in practice
- **Pros**: No changes needed now
- **Cons**: Reactive rather than proactive

#### **Files Affected**
- `src/services/TurnService.ts` (multiple methods)
- `src/services/ChoiceService.ts` (choice creation)

---

### Effect Recursion Depth Not Limited (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Added MAX_EFFECTS_PER_BATCH = 100 safety limit with warnings at 80% threshold (80 effects) to prevent infinite loops
- **Location**: `EffectEngineService.ts` lines 144-160 (`processEffects` loop)
- **Impact**: Potential infinite loop if effects generate more effects cyclically
- **Root Cause**: No depth limit on effect chaining

#### **The Pattern**

Line 144-160 in `processEffects()`:
```typescript
for (let i = 0; i < effects.length; i++) {
  const effect = effects[i];
  const result = await this.processEffect(effect, context);

  // Collect results
  results.push(result);

  // Add resulting effects to the same array
  if (result.resultingEffects && result.resultingEffects.length > 0) {
    effects.push(...result.resultingEffects);  // ← Added to loop!
  }
}
```

**How it works:**
1. Loop starts with N effects
2. Process effect i
3. If effect generates new effects → **add to same array**
4. Loop continues, eventually processes generated effects
5. Those effects might generate MORE effects → **infinite potential**

#### **Example Scenarios**

**Scenario 1: Card Drawing Chain**
```typescript
// Card A: "Draw 1 card"
CARD_DRAW → draws Card B
// Card B: "Draw 1 card"
CARD_DRAW → draws Card A
// Card A: "Draw 1 card"
CARD_DRAW → draws Card B
// INFINITE LOOP!
```

**Scenario 2: Effect Generates Self**
```typescript
// Effect: "Apply this effect again"
Effect X → resultingEffects: [Effect X]
// Loop adds Effect X again
Effect X → resultingEffects: [Effect X]
// INFINITE LOOP!
```

**Scenario 3: Mutual Triggering**
```typescript
// Effect A triggers Effect B
Effect A → resultingEffects: [Effect B]
// Effect B triggers Effect A
Effect B → resultingEffects: [Effect A]
// INFINITE LOOP!
```

#### **Current Protection**

**No explicit depth limit**, but protected by:

1. **CSV Data Design**: No cards actually create infinite chains
2. **Effect Types**: Current effects don't generate themselves
3. **Auto-play Limited**: Only specific spaces auto-play cards (OWNER-FUND-INITIATION)
4. **Memory Limits**: Would eventually crash with out-of-memory

#### **Why This Hasn't Broken**

Checking actual effect types:
- RESOURCE_CHANGE: No resulting effects
- CARD_DRAW: Doesn't auto-play drawn cards (except at OWNER-FUND-INITIATION)
- PLAY_CARD: Only at specific spaces, limited to funding cards
- CHOICE: Doesn't generate more effects
- TURN_CONTROL: No recursion

**OWNER-FUND-INITIATION special case** (line 286-303):
```typescript
// CARD_DRAW at funding space creates PLAY_CARD effect
if (effect.effectType === 'CARD_DRAW' && context.metadata?.spaceName === 'OWNER-FUND-INITIATION') {
  drawnCards.forEach(cardId => {
    resultingEffects.push({
      effectType: 'PLAY_CARD',
      payload: { playerId, cardId, source, reason }
    });
  });
}
```

**Depth in this case:**
1. CARD_DRAW → generates PLAY_CARD
2. PLAY_CARD → applies card effects (RESOURCE_CHANGE usually)
3. RESOURCE_CHANGE → no more effects
4. **Stops at depth 3**

#### **Recommended Safeguards**

**Option A: Add Depth Counter** ⭐ **RECOMMENDED**
```typescript
const MAX_EFFECT_DEPTH = 10;

processEffects(effects: Effect[], context: EffectContext, depth = 0) {
  if (depth > MAX_EFFECT_DEPTH) {
    console.error(`Effect recursion depth limit reached: ${depth}`);
    return { success: false, errors: ['Max recursion depth exceeded'] };
  }

  for (const effect of effects) {
    const result = await this.processEffect(effect, context, depth + 1);
    // ...
  }
}
```

**Option B: Track Processed Effects**
```typescript
const processedEffectIds = new Set<string>();

for (const effect of effects) {
  const effectId = JSON.stringify(effect);
  if (processedEffectIds.has(effectId)) {
    console.warn('Duplicate effect detected, skipping');
    continue;
  }
  processedEffectIds.add(effectId);
  // ... process effect
}
```

**Option C: Limit Total Effects**
```typescript
const MAX_EFFECTS_PER_BATCH = 100;

if (effects.length > MAX_EFFECTS_PER_BATCH) {
  console.error(`Too many effects generated: ${effects.length}`);
  return { success: false, errors: ['Effect generation limit exceeded'] };
}
```

**Option D: Monitor and Alert**
- Log when resultingEffects generated
- Alert if effect chain > 5 deep
- Investigate before implementing limit
- **Pros**: Data-driven decision
- **Cons**: Reactive

#### **Recommended Approach**

**Combine A + C:**
1. Add depth counter (safety limit = 10)
2. Add total effects limit (safety limit = 100)
3. Add logging when limits approached
4. Investigate if logs show actual chains forming

#### **Files Affected**
- `src/services/EffectEngineService.ts` (processEffects method)
- Tests to verify limits work correctly

---

### Turn End Sequence May Have Off-By-One Timing (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Added 55-line JSDoc documentation to nextPlayer() method explaining order of operations, timing rationale, and card expiration logic
- **Location**: `TurnService.ts` lines 442-561 (`nextPlayer` method)
- **Impact**: Card expiration timing might be off by one turn
- **Root Cause**: Interest applied before turn advances, but expirations check current turn number

#### **The Sequence**

From `nextPlayer()` method (line 442-561):

```typescript
// Turn end sequence:
Line 458:  this.cardService.endOfTurn();              // Process card expirations
Line 463:  await effectEngine.processActiveEffects(); // Process active effects
Line 468:  Reset re-roll flag
Line 480:  Log turn end (uses globalTurnCount + 1)
Line 490:  this.resourceService.applyInterest();      // Apply loan interest
Line 527:  this.stateService.advanceTurn();           // Increment turn counter
Line 530:  this.stateService.setCurrentPlayer();      // Change player
```

**Order of operations:**
1. Card expirations (turn N)
2. Active effects (turn N)
3. Interest charged (turn N)
4. **Turn advances** (N → N+1)
5. Next player starts (turn N+1)

#### **The Potential Issue**

**Card Activation:**
- Card activated on turn 5 with duration=3
- Stored as: `{ cardId, turnsRemaining: 3, activatedTurn: 5 }`

**Expiration Check (turn 7, line 458):**
```typescript
// Is card expired?
if (activeCard.turnsRemaining <= 0 || currentTurn >= activeCard.expirationTurn) {
  // Expire card
}
```

**Interest Applied (turn 7, line 490):**
```typescript
// Calculate interest on loans
for (const loan of player.loans) {
  const interest = loan.principal * loan.interestRate;
  // Charge interest
}
```

**Timing question:**
- Interest charged while still on turn 7
- Turn advances to 8 (line 527)
- Did loan accrue interest for 7 turns or 8 turns?

#### **Specific Concern**

**Scenario:**
1. Player takes loan on turn 1
2. Loan stored with: `{ startTurn: 1 }`
3. Player ends turn 10
4. Interest applied (turn 10 has ended, but counter still shows 10)
5. Turn advances to 11
6. Interest charged for "turn 10" - is this correct?

**Expected behavior:**
- Loan taken turn 1
- Turn 1 ends → charge interest for turn 1
- Turn 2 ends → charge interest for turn 2
- ...
- Turn 10 ends → charge interest for turn 10
- **Total: 10 interest charges** ✅

**Potential bug:**
- If interest uses globalTurnCount and it's already advanced → wrong count

#### **Why This Might Be Fine**

Looking at `applyInterest()` (ResourceService.ts:569-627):
```typescript
applyInterest(playerId: string): void {
  // Simply charges: principal * interestRate
  // Doesn't use turn numbers for calculation!
}
```

**Interest is simple:**
- Flat rate per turn
- Doesn't matter which turn number
- No compounding based on turn count
- **Timing doesn't affect calculation** ✅

#### **Card Expiration Timing**

Card expiration uses `turnsRemaining` counter:
```typescript
// Each turn end (line 458)
endOfTurn() {
  for (const activeCard of player.activeCards) {
    activeCard.turnsRemaining--;
    if (activeCard.turnsRemaining <= 0) {
      // Expire card
    }
  }
}
```

**Decrement happens BEFORE turn advances:**
- Turn 5: Card activated, turnsRemaining = 3
- Turn 5 ends: turnsRemaining-- (now 2), turn advances to 6
- Turn 6 ends: turnsRemaining-- (now 1), turn advances to 7
- Turn 7 ends: turnsRemaining-- (now 0), **expire**, turn advances to 8
- **Card active for turns 5, 6, 7** = 3 turns ✅ Correct!

#### **Logging Timing Issue**

Line 480-486:
```typescript
// Log turn end for current player (use globalTurnCount + 1 to match turn_start numbering)
this.loggingService.info(`Turn ${gameState.globalTurnCount + 1} ended`, {
  action: 'turn_end',
  turn: gameState.globalTurnCount + 1,  // ← +1 before advance
  // ...
});
```

**Why +1?**
- Comment says: "match turn_start numbering"
- Turn start logs turn N
- Turn end should also log turn N
- But counter hasn't advanced yet
- So add +1 to match

**This seems intentional, not a bug.**

#### **Conclusion**

**Not actually a bug:**
- Interest timing doesn't matter (flat rate, no turn-based calculation)
- Card expiration works correctly (turnsRemaining decrements before advance)
- Logging uses +1 to match turn start numbering (intentional)

**This is a "smells odd but works correctly" situation.**

#### **Recommended Action**

**Option A: Document the Sequence**
- Add comment explaining why interest before advance
- Add comment explaining turn+1 in logging
- **Pros**: Clarifies intent for future developers
- **Cons**: None

**Option B: Refactor for Clarity**
- Move interest to AFTER turn advance
- Update logging to use new turn number
- **Pros**: More intuitive sequence
- **Cons**: Behavior change, need to verify no impact

**Option C: Leave As-Is**
- Works correctly
- No user-visible issue
- **Pros**: No work needed
- **Cons**: Future developers confused

**Recommendation: Option A** (document the sequence)

#### **Files Affected**
- `src/services/TurnService.ts` (nextPlayer method - add comments)

---

### Condition Evaluation Creates Stale Cache (December 5, 2025)
- **Status**: ✅ **RESOLVED** (December 6, 2025)
- **Resolution**: Removed conditional caching in evaluateCondition() - projectScope now always updated when calculated to keep UI component data fresh
- **Location**: `GameRulesService.ts` lines 596-618 (`evaluateCondition` method for scope)
- **Impact**: Cached projectScope value may become stale if W cards drawn between evaluations
- **Root Cause**: Scope cached on player state, not recalculated each time

#### **The Caching Pattern**

Lines 596-618:
```typescript
// Evaluate scope_le_4M condition
if (conditionLower === 'scope_le_4m') {
  const projectScope = this.calculateProjectScope(playerId);

  // Store projectScope on player if not already set
  if (player.projectScope === 0 || player.projectScope === undefined) {
    this.stateService.updatePlayer({
      id: playerId,
      projectScope: projectScope
    });
  }

  return projectScope <= 4000000;
}
```

**What happens:**
1. Calculate actual scope from W cards
2. If `player.projectScope` is 0 or undefined → **cache it**
3. Return comparison result

**Cache is NOT updated if:**
- `player.projectScope` already has a value
- Even if W cards have changed!

#### **Staleness Scenario**

**Turn 1:**
- Player has 0 W cards
- Evaluates `scope_le_4M` → calculates $0, caches $0
- `player.projectScope = 0`

**Turn 2:**
- Player draws 3 W cards ($9M total)
- Evaluates `scope_le_4M` again
- `player.projectScope = 0` (not 0 or undefined!)
- **Uses cached $0 instead of recalculating $9M**
- Returns true (0 <= 4M) ❌ **Wrong! Should be false (9M > 4M)**

#### **When Cache Updates**

Cache only updates when `projectScope === 0 || projectScope === undefined`:
- Initial state (never set) ✅
- Explicitly cleared to 0 ✅
- Player draws W cards → **NOT updated** ❌

#### **Why This Might Be Low Risk**

**Checking actual usage:**

1. **Scope conditions used for movement** (line 596, 608)
   - Evaluated each time player moves
   - If W cards drawn, scope recalculated fresh
   - Cache written but not read from

2. **Fresh calculation each time:**
```typescript
const projectScope = this.calculateProjectScope(playerId);  // Always calculates fresh!
```
- Cache is written
- But calculation happens EVERY time regardless
- Cache never actually READ

**Wait - if it's always recalculated, why cache it?**

Looking closer at the code:
```typescript
// Line 598-604
const projectScope = this.calculateProjectScope(playerId);  // Fresh calculation

// Line 600-604
if (player.projectScope === 0 || player.projectScope === undefined) {
  this.stateService.updatePlayer({
    id: playerId,
    projectScope: projectScope  // Write to cache
  });
}

// Line 606
return projectScope <= 4000000;  // Uses FRESH value, not cache!
```

**The cache is written but never read!**

Return statement uses the freshly calculated `projectScope` variable, not `player.projectScope` from cache.

#### **So What's the Cache For?**

Looking for other uses of `player.projectScope`:
```bash
$ grep "player.projectScope" src/**/*.ts
# Only found in GameRulesService.ts evaluateCondition
```

**Cache is:**
- Written to player state
- Never read in game logic
- **Completely unused!**

This might be for:
- UI display (show player their project scope)
- Debugging (inspect player state)
- Future feature (never implemented)

#### **Actual Issue**

**Not a staleness bug, but:**
- **Dead code**: Cache written but never read
- **Misleading**: Looks like optimization but doesn't optimize anything
- **Potential confusion**: Future developer might use stale cached value

#### **Recommended Action**

**Option A: Remove the Cache** ⭐ **RECOMMENDED**
```typescript
if (conditionLower === 'scope_le_4m') {
  const projectScope = this.calculateProjectScope(playerId);
  // Delete lines 600-604 (cache write)
  return projectScope <= 4000000;
}
```
- **Pros**: Removes dead code, eliminates confusion
- **Cons**: None (cache wasn't being used)

**Option B: Use the Cache Properly**
```typescript
// Check cache first
if (player.projectScope !== undefined && player.projectScope > 0) {
  return player.projectScope <= 4000000;  // Use cached value
}

// Cache miss - calculate and store
const projectScope = this.calculateProjectScope(playerId);
this.stateService.updatePlayer({
  id: playerId,
  projectScope: projectScope
});
return projectScope <= 4000000;
```
- **Pros**: Actual optimization (avoid recalculating)
- **Cons**: Need cache invalidation when W cards change

**Option C: Invalidate Cache on Card Changes**
- Clear `player.projectScope` when W cards drawn/played/discarded
- Keep current caching logic
- **Pros**: Cache works correctly
- **Cons**: Complex, need to track all card changes

**Option D: Keep for UI Display**
- Leave cache writes
- Add comment explaining it's for UI, not logic
- **Pros**: Keeps existing behavior
- **Cons**: Still confusing

**Recommendation: Option A** (remove unused cache)

#### **Files Affected**
- `src/services/GameRulesService.ts` (evaluateCondition method)
- Verify no UI components depend on `player.projectScope`

---

## Summary

### Issue Count by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 2 | Active bugs affecting gameplay |
| 🟡 Moderate | 5 | Logic issues, dead code, design flaws |
| 🟢 Low Priority | 4 | Edge cases, theoretical risks, cleanup |
| **Total** | **11** | **Fully documented** |

### Recommended Priority Order

1. **Fix Critical #1 & #2 together** (Card effects + Cost charging) - Both in CardService, fix simultaneously
2. **Fix Moderate #5** (Project scope) - Affects movement and scoring
3. **Clean up Moderate #3** (Dice mapping dead code) - Remove confusion
4. **Review Moderate #4** (Interest forgiveness) - Game balance decision needed
5. **Refactor Moderate #6 & #7** (Resource categorization) - Technical debt cleanup
6. **Clean up Low Priority** - When time permits

All issues are now documented in `/docs/project/TECHNICAL_DEBT.md` with detailed analysis, solution options, and testing requirements.
