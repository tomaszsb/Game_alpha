# Movement System Architecture

**Last Updated:** November 2025
**Status:** Production - Fully Implemented

---

## 📚 Related Documentation

- **Recent Refactoring (Nov 14, 2025)**: See [Movement Refactor Plan](../archive/MOVEMENT_REFACTOR_PLAN-20251114.md) for design decisions and problem analysis
- **Implementation Details**: See [Movement Implementation Summary](../archive/MOVEMENT_IMPLEMENTATION_SUMMARY-20251114.md) for technical details
- **Post-Refactor Verification**: See [Post Refactor Cleanup](../archive/POST_REFACTOR_CLEANUP-20251114.md) and [User Fixes Verification](../archive/USER_FIXES_VERIFICATION-20251114.md)
- **Action Patterns**: See [Game Actions Guide](../architecture/GAME_ACTIONS_GUIDE.md) for how movement fits into overall action system

---

## Overview

The Movement System manages player navigation through game spaces using CSV-based configuration. It supports four movement types: fixed paths, player choices, dice-based outcomes, and terminal spaces.

---

## Movement Types

### 1. Fixed Movement (`movement_type: "fixed"`)
Player automatically moves to a single predetermined destination.

**Example:**
```csv
OWNER-SCOPE-INITIATION,First,fixed,OWNER-FUND-INITIATION
```

### 2. Choice Movement (`movement_type: "choice"`)
Player selects from multiple destination options.

**Example:**
```csv
PM-DECISION-CHECK,First,choice,ENG-INITIATION,ARCH-INITIATION,PM-DECISION-CHECK
```

### 3. Dice Movement (`movement_type: "dice"`)
Destination determined by dice roll, with outcomes defined in `DICE_OUTCOMES.csv`.

**Example:**
```csv
REG-DOB-PLAN-EXAM,First,dice
```

Dice outcomes are configured separately:
```csv
REG-DOB-PLAN-EXAM,First,REG-FDNY-FEE-REVIEW,REG-DOB-PLAN-EXAM,ARCH-INITIATION,ARCH-INITIATION,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW
```

### 4. Terminal Spaces (`movement_type: "none"`)
No movement possible (e.g., FINISH, tutorial spaces).

**Example:**
```csv
FINISH,First,none
```

---

## Movement Type Distribution (Current)

- **Dice:** 18 spaces (actual dice-based movement)
- **Fixed:** 20 spaces (linear progression paths)
- **Choice:** 11 spaces (player decisions, including conditional logic)
- **None:** 5 spaces (terminal/tutorial)

---

## Path Choice Memory

Some spaces lock player choices for subsequent visits to enforce game rules.

### REG-DOB-TYPE-SELECT Path Locking

**Business Rule:** Department of Buildings application type (Plan Exam vs Professional Certification) is locked once chosen.

**Implementation:**

**Player Interface:**
```typescript
interface Player {
  pathChoiceMemory?: {
    'REG-DOB-TYPE-SELECT'?: 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT';
    // Extensible for future spaces
  };
}
```

**Storage (MovementService.finalizeMove):**
```typescript
if (sourceSpace === 'REG-DOB-TYPE-SELECT' && player.visitType === 'First') {
  playerUpdate.pathChoiceMemory = {
    'REG-DOB-TYPE-SELECT': destinationSpace
  };
}
```

**Filtering (MovementService.getValidMoves):**
```typescript
if (player.currentSpace === 'REG-DOB-TYPE-SELECT' &&
    player.visitType === 'Subsequent' &&
    player.pathChoiceMemory?.['REG-DOB-TYPE-SELECT']) {

  validMoves = validMoves.filter(dest =>
    dest === player.pathChoiceMemory['REG-DOB-TYPE-SELECT']
  );
}
```

**CSV Configuration:**
```csv
REG-DOB-TYPE-SELECT,First,choice,REG-DOB-PLAN-EXAM,REG-DOB-PROF-CERT
REG-DOB-TYPE-SELECT,Subsequent,choice,REG-DOB-PLAN-EXAM,REG-DOB-PROF-CERT
```

On subsequent visits, the CSV shows both options, but `MovementService` filters to only the remembered choice at runtime.

---

## LOGIC Movement Type

Some spaces use conditional logic to determine destinations based on game state.

### Example: REG-FDNY-FEE-REVIEW

**CSV Data:**
- `path = "LOGIC"`
- Destination columns contain condition questions: "Did the scope change since last visit? YES - REG-FDNY-PLAN-EXAM - NO - Space 3"

**Processing:**
The data processing script (`data/process_game_data.py`) extracts valid space names from the conditional text and presents all possible destinations as choices. The player selects based on their game state.

**Result in MOVEMENT.csv:**
```csv
REG-FDNY-FEE-REVIEW,First,choice,CON-INITIATION,PM-DECISION-CHECK,REG-DOB-TYPE-SELECT,REG-FDNY-PLAN-EXAM
```

**Note:** The system presents choices but doesn't evaluate conditions. Players must know their own game state (e.g., "Did I pass FDNY approval?").

---

## Data Processing Pipeline

### Primary Script: `data/process_game_data.py`

**Decision Tree (Path-First Approach):**

```python
1. Check path column (AUTHORITATIVE)
   - If path="LOGIC" → Extract destinations from condition text

2. Check for dice movement data
   - Only if "Next Step" or "Time outcomes" exists in DICE_OUTCOMES.csv
   - Not just requires_dice_roll=YES flag

3. Check for stateful patterns
   - "option from first visit" → Keep as choice, filter at runtime

4. Fall back to standard destination counting
   - 0 destinations = "none"
   - 1 destination = "fixed"
   - 2+ destinations = "choice"
```

### Space Name Validation

**Valid Space Name Pattern:** `^[A-Z][A-Z0-9\-]+$`

**Validation Rules:**
- Starts with uppercase letter
- Contains only uppercase letters, numbers, hyphens
- Minimum 5 characters (except START, FINISH)
- Rejects question marks
- Rejects short abbreviations (DOB, FDNY)
- Rejects positional references ("Space 2")

### LOGIC Parser

Extracts valid space names from conditional text:
```python
# Find all UPPERCASE-HYPHENATED words
space_names = re.findall(r'[A-Z][A-Z0-9\-]{2,}', condition_text)

# Filter to valid space names
valid_destinations = [name for name in space_names if is_valid_space_name(name)]
```

---

## Validation

### Validation Script: `data/validate_movement_data.py`

**Checks Performed:**
- ✅ No question marks in destination fields
- ✅ All destinations are valid space names
- ✅ Dice-type spaces have matching DICE_OUTCOMES entries
- ✅ Non-none/dice types have destinations
- ✅ No duplicate or conflicting entries

**Current Status:** All validations passing ✅

---

## Key Services

### MovementService (`src/services/MovementService.ts`)

**Primary Methods:**
- `getValidMoves(playerId)` - Returns valid destination spaces for current player
- `validateMove(playerId, destination)` - Validates a proposed move
- `finalizeMove(playerId, destination)` - Executes the move and updates state
- `getMovementType(space, visitType)` - Returns movement type for a space

**Responsibilities:**
- Load movement data from `MOVEMENT.csv` and `DICE_OUTCOMES.csv`
- Apply path choice memory filtering
- Validate and execute player movements
- Track visit types (First/Subsequent)

### DataService (`src/services/DataService.ts`)

**Movement Data Methods:**
- `getMovement(space, visitType)` - Get movement configuration
- `getDiceOutcomes(space, visitType)` - Get dice roll outcomes

**Cache Busting:**
All CSV files load with `?_=${Date.now()}` parameter to prevent stale cached data in production browsers.

---

## CSV Data Files

### MOVEMENT.csv
```csv
space_name,visit_type,movement_type,destination_1,destination_2,destination_3,destination_4,destination_5
CON-INITIATION,First,fixed,CON-ISSUES
PM-DECISION-CHECK,First,choice,ENG-INITIATION,ARCH-INITIATION,PM-DECISION-CHECK
REG-DOB-PLAN-EXAM,First,dice
FINISH,First,none
```

### DICE_OUTCOMES.csv
```csv
space_name,visit_type,outcome_1,outcome_2,outcome_3,outcome_4,outcome_5,outcome_6
REG-DOB-PLAN-EXAM,First,REG-FDNY-FEE-REVIEW,REG-DOB-PLAN-EXAM,ARCH-INITIATION,ARCH-INITIATION,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW
```

---

## Manual Fixes Preserved

### DICE_OUTCOMES.csv (Lines 11-19)
User manually edited these dice outcome rows to correctly route players to/from REG-FDNY-FEE-REVIEW. These rows are preserved and not regenerated by processing scripts.

### CON-INITIATION Subsequent Visit
Source data has contradictory indicators (dice roll flag + single destination). Manual fix marks this as `fixed` movement, which is correct.

---

## Critical Spaces Reference

| Space | Movement Type | Notes |
|-------|--------------|-------|
| REG-FDNY-FEE-REVIEW | Choice | LOGIC type - 4 conditional destinations |
| REG-DOB-TYPE-SELECT | Choice | Path choice memory enforced on subsequent visits |
| OWNER-SCOPE-INITIATION | Fixed | Linear progression to OWNER-FUND-INITIATION |
| REG-DOB-PLAN-EXAM | Dice | 6 possible outcomes |
| REG-DOB-PROF-CERT | Dice | 6 possible outcomes |
| CON-INITIATION (Subsequent) | Fixed | Manual fix - overrides dice indicator |
| PM-DECISION-CHECK (First) | Choice | 3 options - not dice despite flag |

---

## Testing

**Test Coverage:**
- `tests/services/MovementService.test.ts` - 39 unit tests including pathChoiceMemory
- `tests/E2E/` - End-to-end movement scenarios
- `tests/regression/` - Regression tests for critical bugs

**Key Test Areas:**
- Path choice memory storage and filtering
- Dice outcome selection
- Movement type detection
- Visit type tracking
- Validation logic

---

## Related Documentation

**Historical Context:**
- `docs/archive/MOVEMENT_IMPLEMENTATION_SUMMARY-20251114.md` - Original implementation results
- `docs/archive/MOVEMENT_REFACTOR_PLAN-20251114.md` - Original refactor plan
- `docs/archive/USER_FIXES_VERIFICATION-20251114.md` - Analysis of manual CSV fixes

**Source Data:**
- `data/Spaces.csv` - Source space configuration
- `data/DiceRoll Info.csv` - Source dice data

**Processing Scripts:**
- `data/process_game_data.py` - Main CSV processor
- `data/validate_movement_data.py` - Validation tool

---

## Future Enhancements

**Potential Improvements:**
1. **Automatic condition evaluation** - System evaluates LOGIC conditions instead of player choice
2. **Path memory for more spaces** - Extend pathChoiceMemory to other stateful spaces
3. **Dynamic movement rules** - Rules that change based on cards played or game state
4. **Movement history** - Track all movements for analytics/replay

---

**System Status:** ✅ Production Ready
**Last Major Update:** November 14, 2025 (Movement system refactor)
