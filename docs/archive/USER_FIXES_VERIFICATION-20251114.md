# Verification Log: User's Manual CSV Fixes

**Date:** 2025-11-14
**Purpose:** Analyze each manual fix to determine if it should be preserved or can be regenerated

---

## MOVEMENT.csv Fixes (Lines 47-55)

### Line 47: CON-INITIATION,Subsequent,fixed,CON-ISSUES

**Source Data (Spaces.csv line 47):**
```csv
CON-INITIATION,CONSTRUCTION,Subsequent,...,space_1=CON-ISSUES,requires_dice_roll=YES,rolls=2
```

**Analysis:**
- Source says `space_1 = CON-ISSUES` (single destination)
- Source says `requires_dice_roll = YES` and `rolls = 2`
- **Contradiction!** Dice roll indicator BUT only one destination

**Old script would have marked as:** `dice` (because requires_dice_roll = YES)
**User changed to:** `fixed` with destination CON-ISSUES
**Reason:** User recognized the single destination overrides the dice indicator

**Decision:** ✅ **PRESERVE** - This is a source data quirk. The "rolls=2" might be for contractor quality/multiplier (mentioned in Action text), not for movement.

---

### Lines 48-49: CON-ISSUES (First/Subsequent) → dice

**Source Data (Spaces.csv lines 48-49):**
```csv
CON-ISSUES,First,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=Yes,rolls=1
CON-ISSUES,Subsequent,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=Yes,rolls=1
```

**Analysis:**
- No destinations in space_1...space_5 columns
- `requires_dice_roll = Yes` and `rolls = 1`
- Must get destinations from DiceRoll Info.csv

**Check DiceRoll Info.csv:**
```csv
CON-ISSUES,Next Step,First,CON-INSPECT,CON-INSPECT,REG-FDNY-FEE-REVIEW,REG-DOB-FEE-REVIEW,ENG-INITIATION,ARCH-INITIATION
CON-ISSUES,Next Step,Subsequent,CON-INSPECT,CON-INSPECT,CON-INSPECT,CON-INSPECT,REG-FDNY-FEE-REVIEW,REG-DOB-FEE-REVIEW
```

**User's fix:** `movement_type = dice`
**Expected from new script:** `dice` (requires_dice_roll = Yes)

**Decision:** ✅ **CAN REGENERATE** - New script will produce same result. User fix matches correct logic.

---

### Lines 50-51: CON-INSPECT (First/Subsequent) → dice

**Source Data (Spaces.csv lines 50-51):**
```csv
CON-INSPECT,First,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=No,rolls=1
CON-INSPECT,Subsequent,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=No,rolls=1
```

**Analysis:**
- No destinations in space columns
- `requires_dice_roll = No` BUT `rolls = 1`
- Mixed signals!

**Check DiceRoll Info.csv:**
```csv
CON-INSPECT,Next Step,First,REG-DOB-FINAL-REVIEW,REG-DOB-FINAL-REVIEW,REG-DOB-FINAL-REVIEW,CON-ISSUES,REG-FDNY-FEE-REVIEW,REG-DOB-FEE-REVIEW
CON-INSPECT,Next Step,Subsequent,REG-DOB-FINAL-REVIEW,REG-DOB-FINAL-REVIEW,REG-DOB-FINAL-REVIEW,REG-DOB-FINAL-REVIEW,REG-DOB-FINAL-REVIEW,CON-ISSUES
```

**User's fix:** `movement_type = dice`
**Expected from new script:** `dice` (has dice data, despite requires_dice_roll = No)

**Decision:** ✅ **CAN REGENERATE** - New script will detect dice data exists and mark as dice.

---

### Lines 52-53: REG-DOB-FINAL-REVIEW (First/Subsequent) → dice

**Source Data (Spaces.csv lines 52-53):**
```csv
REG-DOB-FINAL-REVIEW,First,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=YES,rolls=1
REG-DOB-FINAL-REVIEW,Subsequent,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=YES,rolls=1
```

**Analysis:**
- No destinations in space columns
- `requires_dice_roll = YES` and `rolls = 1`
- Clear dice indicator

**Check DiceRoll Info.csv:**
```csv
REG-DOB-FINAL-REVIEW,Next Step,First,FINISH,FINISH,FINISH,FINISH,CON-INSPECT,REG-FDNY-FEE-REVIEW
REG-DOB-FINAL-REVIEW,Next Step,Subsequent,FINISH,FINISH,FINISH,FINISH,FINISH,CON-INSPECT
```

**User's fix:** `movement_type = dice`
**Expected from new script:** `dice` (requires_dice_roll = YES)

**Decision:** ✅ **CAN REGENERATE** - New script will produce same result.

---

### Lines 54-55: FINISH (First/Subsequent) → none

**Source Data (Spaces.csv lines 54-55):**
```csv
FINISH,END,First,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=No,rolls=
FINISH,END,Subsequent,...,space_1=,space_2=,space_3=,space_4=,space_5=,requires_dice_roll=No,rolls=
```

**Analysis:**
- No destinations
- No dice indicators
- Terminal space (phase = END)

**User's fix:** `movement_type = none`
**Expected from new script:** `none` (no destinations, no dice data)

**Decision:** ✅ **CAN REGENERATE** - New script will produce same result.

---

## DICE_OUTCOMES.csv Fixes (Lines 11-19)

### ⚠️ CRITICAL: DO NOT REGENERATE

User has manually edited these dice outcome rows. Many reference REG-FDNY-FEE-REVIEW, which is currently corrupted in MOVEMENT.csv.

**Analysis:** These fixes appear to route dice outcomes TO the problem space (REG-FDNY-FEE-REVIEW), not FROM it. Once we fix REG-FDNY-FEE-REVIEW's movement type, these dice outcomes will correctly send players there.

**Example:**
- REG-DOB-PLAN-EXAM rolls dice → might send player to REG-FDNY-FEE-REVIEW
- REG-FDNY-FEE-REVIEW (once fixed) → will present choice of valid destinations

**Decision:** ✅ **PRESERVE ALL** - Do not regenerate DICE_OUTCOMES.csv at all.

---

## Summary

### MOVEMENT.csv Fixes

| Line | Space | Can Regenerate? | Notes |
|------|-------|-----------------|-------|
| 47 | CON-INITIATION,Subsequent | ❌ NO - PRESERVE | Source has contradictory indicators, user's fix is intentional |
| 48-49 | CON-ISSUES | ✅ Yes | New script will produce same result |
| 50-51 | CON-INSPECT | ✅ Yes | New script will detect dice data |
| 52-53 | REG-DOB-FINAL-REVIEW | ✅ Yes | New script will produce same result |
| 54-55 | FINISH | ✅ Yes | New script will produce same result |

### DICE_OUTCOMES.csv Fixes

| Lines | Action |
|-------|--------|
| 11-19 | ❌ DO NOT REGENERATE - Preserve all user edits |

---

## Action Plan

1. **Regenerate MOVEMENT.csv** with new script
2. **After regeneration:** Manually verify line 47 (CON-INITIATION,Subsequent)
3. **If different:** Restore user's fix: `CON-INITIATION,Subsequent,fixed,CON-ISSUES`
4. **DO NOT touch DICE_OUTCOMES.csv** - preserve entirely
5. **Validate:** Ensure lines 48-55 match user's fixes (should be identical)

---

**Conclusion:** Only 1 out of 9 fixes needs special preservation (CON-INITIATION Subsequent). All others should be automatically reproduced by the corrected processing script.
