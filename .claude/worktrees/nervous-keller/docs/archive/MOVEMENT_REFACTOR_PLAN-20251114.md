# Movement System Refactor Plan

**Date Created:** 2025-11-14
**Date Completed:** 2025-11-14
**Purpose:** Fix CSV-based movement data processing to eliminate corruption and handle LOGIC movement type
**Status:** ✅ COMPLETED - See IMPLEMENTATION_SUMMARY.md for results

---

## CRITICAL: USER'S MANUAL FIXES TO PRESERVE

### DICE_OUTCOMES.csv (Lines 11-19) - DO NOT REGENERATE
These rows were manually fixed by user and must be preserved:

```csv
REG-DOB-AUDIT,Subsequent,REG-DOB-FINAL-REVIEW,REG-FDNY-FEE-REVIEW,REG-DOB-PLAN-EXAM,REG-DOB-PLAN-EXAM,ARCH-INITIATION,REG-FDNY-FEE-REVIEW
REG-DOB-FINAL-REVIEW,First,FINISH,FINISH,FINISH,FINISH,CON-INSPECT,REG-FDNY-FEE-REVIEW
REG-DOB-FINAL-REVIEW,Subsequent,FINISH,FINISH,FINISH,FINISH,FINISH,CON-INSPECT
REG-DOB-PLAN-EXAM,First,REG-FDNY-FEE-REVIEW,REG-DOB-PLAN-EXAM,ARCH-INITIATION,ARCH-INITIATION,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW
REG-DOB-PLAN-EXAM,Subsequent,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-DOB-PLAN-EXAM,ARCH-INITIATION,REG-FDNY-FEE-REVIEW
REG-DOB-PROF-CERT,First,REG-DOB-AUDIT,REG-DOB-AUDIT,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW
REG-DOB-PROF-CERT,Subsequent,REG-DOB-AUDIT,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW
REG-FDNY-PLAN-EXAM,First,CON-INITIATION or REG-DOB-PLAN-EXAM or REG-DOB-AUDIT or PM-DECISION-CHECK,CON-INITIATION or REG-DOB-PLAN-EXAM or REG-DOB-AUDIT or PM-DECISION-CHECK,REG-FDNY-PLAN-EXAM,REG-FDNY-PLAN-EXAM,ENG-INITIATION,ARCH-INITIATION
REG-FDNY-PLAN-EXAM,Subsequent,CON-INITIATION or REG-DOB-PLAN-EXAM or REG-DOB-AUDIT or PM-DECISION-CHECK,CON-INITIATION or REG-DOB-PLAN-EXAM or REG-DOB-AUDIT or PM-DECISION-CHECK,CON-INITIATION or REG-DOB-PLAN-EXAM or REG-DOB-AUDIT or PM-DECISION-CHECK,REG-FDNY-PLAN-EXAM,REG-FDNY-PLAN-EXAM,ENG-INITIATION
```

**Note:** Many of these point to REG-FDNY-FEE-REVIEW, which is the problematic LOGIC space. User has manually routed dice outcomes to it.

### MOVEMENT.csv (Lines 47-55) - VERIFY BEFORE OVERWRITING

```csv
CON-INITIATION,Subsequent,fixed,CON-ISSUES
CON-ISSUES,First,dice
CON-ISSUES,Subsequent,dice
CON-INSPECT,First,dice
CON-INSPECT,Subsequent,dice
REG-DOB-FINAL-REVIEW,First,dice
REG-DOB-FINAL-REVIEW,Subsequent,dice
FINISH,First,none
FINISH,Subsequent,none
```

**Action Required:** Verify each of these against source Spaces.csv to determine if:
- Fix corrects source data error → PRESERVE
- Fix was workaround for processing bug → REGENERATE (may be fixed by new script)

---

## PROBLEM ANALYSIS

### Root Cause
Data processing script (`process_game_data.py` and `fix_all_movements.py`) has flawed decision tree:

1. ❌ Checks dice data FIRST (inference)
2. ❌ Checks destination columns SECOND (inference)
3. ❌ NEVER checks "path" column (authoritative source)
4. ❌ `is_valid_space_name()` has false positives

### Consequence
**REG-FDNY-FEE-REVIEW corruption:**
- Source: `path = "LOGIC"`, destinations contain condition questions
- Script sees: Multiple destinations with uppercase letters
- Result: `movement_type = "choice"`, `destination_1 = "Did the scope change since last visit? YES - REG-FDNY-PLAN-EXAM - NO - Space 3"`
- Impact: Movement system breaks - question text is not a valid space name

**REG-DOB-TYPE-SELECT trap:**
- Source Subsequent: `space_1 = "Option from first visit"`, `space_2 = "Option from first visit"`
- Script sees: No valid space names (correctly filtered)
- Result: `movement_type = "none"`
- Impact: Player gets stuck on subsequent visits (should remember first choice per DOB rules)

---

## DECISIONS MADE

### Q1: REG-DOB-TYPE-SELECT Behavior
**Decision:** Implement state memory for path choice
**Rationale:** Real DOB process - once you choose Plan Exam vs Prof Cert, you're locked in for that application
**Implementation:** Add `pathChoiceMemory` to Player state, filter validMoves on subsequent visits

### Q2: LOGIC Movement Implementation
**Decision:** Parse conditions, extract destinations, present as player choices
**Rationale:** CSV contains all logic, should be treated logically
**Implementation:** Pattern match "YES - [dest] - NO - [dest]", resolve positional references, extract valid space names

### Q3: START-QUICK-PLAY-GUIDE
**Decision:** Extract to separate TUTORIAL.csv
**Rationale:** Instructional text conflates with movement data, causes confusion
**Implementation:** New tutorial data file, mark space as "none" in MOVEMENT.csv

### Q4: User's Manual Edits
**Decision:** Case-by-case verification
**Rationale:** Each edit was made for a reason, must understand context before overwriting
**Implementation:** Document each edit, preserve or supersede based on analysis

---

## IMPLEMENTATION PLAN

### Phase 1: Backup & Analysis ✓

**Backup files:**
```bash
cp public/data/CLEAN_FILES/MOVEMENT.csv public/data/CLEAN_FILES/MOVEMENT.csv.backup
cp public/data/CLEAN_FILES/DICE_OUTCOMES.csv public/data/CLEAN_FILES/DICE_OUTCOMES.csv.backup
cp data/process_game_data.py data/process_game_data.py.backup
```

**Analyze user's fixes:**
- [ ] Compare MOVEMENT.csv lines 47-55 to source Spaces.csv
- [ ] Determine if each fix corrects source error or works around processing bug
- [ ] Document findings in VERIFICATION_LOG.md

### Phase 2: Enhance is_valid_space_name()

**Current bugs:**
- Returns TRUE for "Did the scope change..." (has uppercase)
- Only checks if starts with "did you", not "did the"
- Doesn't reject question marks

**New implementation:**
```python
def is_valid_space_name(name):
    """Stricter validation with regex"""
    if not name or not name.strip():
        return False

    name = name.strip()

    # Must match pattern: UPPERCASE-WITH-HYPHENS
    if not re.match(r'^[A-Z][A-Z0-9\-]+$', name):
        return False

    # Reject questions
    if '?' in name:
        return False

    # Reject positional references
    if re.match(r'^Space \d+$', name, re.IGNORECASE):
        return False

    # Reject condition keywords
    if name.upper() in ['YES', 'NO']:
        return False

    return True
```

### Phase 3: Implement LOGIC Parser

**Input:** Condition text from Spaces.csv
```
"Did you pass FDNY approval before? YES - Space 2 - NO - Space 3"
```

**Parser steps:**
1. Extract pattern: `(.+?)\?\s*YES\s*-\s*(.+?)\s*-?\s*NO\s*-\s*(.+)`
2. Resolve positional references ("Space 2" → look up space_2 column)
3. Extract all valid space names mentioned
4. Return unique destinations

**Output:** List of valid destination space names
```python
['REG-FDNY-PLAN-EXAM', 'PM-DECISION-CHECK', 'CON-INITIATION', 'REG-DOB-TYPE-SELECT']
```

### Phase 4: Rewrite Processing Script

**New decision tree (path-first approach):**

```python
def process_spaces_to_movement():
    for row in source_csv:
        space_name = row['space_name']
        visit_type = row['visit_type']
        path = row.get('path', '').strip()

        # SPECIAL CASE: Tutorial
        if space_name == 'START-QUICK-PLAY-GUIDE':
            movement = create_none_movement(row)

        # PRIORITY 1: Path column (authoritative)
        elif path == 'LOGIC':
            movement = process_logic_movement(row)

        # PRIORITY 2: Explicit dice indicators
        elif requires_dice_roll(row) or has_dice_data(row):
            movement = process_dice_movement(row)

        # PRIORITY 3: Stateful movement
        elif 'option from first visit' in get_destinations(row).lower():
            movement = process_stateful_movement(row)

        # PRIORITY 4: Standard destination counting
        else:
            movement = process_standard_movement(row)

        movements.append(movement)
```

**Key functions:**

```python
def process_logic_movement(row):
    """
    Extract destinations from LOGIC condition text
    Mark as 'choice' - player chooses based on their game state
    """
    all_destinations = extract_destinations_from_conditions(row)
    valid_destinations = [d for d in all_destinations if is_valid_space_name(d)]

    return create_movement_row(
        row,
        movement_type='choice',
        destinations=valid_destinations
    )

def extract_destinations_from_conditions(row):
    """
    Parse all space_1...space_5 condition columns
    Extract valid space names from YES/NO branches
    """
    destinations = set()

    for i in range(1, 6):
        condition_text = row.get(f'space_{i}', '')
        if not condition_text:
            continue

        # Find all UPPERCASE-HYPHENATED words
        space_names = re.findall(r'[A-Z][A-Z0-9\-]{2,}', condition_text)

        for name in space_names:
            # Resolve positional references
            if re.match(r'^Space (\d+)$', name):
                index = int(re.match(r'^Space (\d+)$', name).group(1))
                resolved = row.get(f'space_{index}', '')
                # Recursively extract from resolved reference
                nested = extract_destinations_from_conditions({'space_1': resolved})
                destinations.update(nested)
            elif is_valid_space_name(name):
                destinations.add(name)

    return sorted(list(destinations))
```

### Phase 5: Validation Script

**Create validation script to verify output:**

```python
# data/validate_movement_data.py

def validate_movement_csv():
    errors = []
    warnings = []

    # Load data
    movements = load_csv('MOVEMENT.csv')
    dice_outcomes = load_csv('DICE_OUTCOMES.csv')

    for movement in movements:
        space = movement['space_name']
        visit = movement['visit_type']
        mtype = movement['movement_type']

        # Check 1: No question marks in destinations
        for i in range(1, 6):
            dest = movement.get(f'destination_{i}', '')
            if dest and '?' in dest:
                errors.append(f"{space} ({visit}): Destination has '?': {dest[:50]}")

        # Check 2: Dice type must have matching outcomes
        if mtype == 'dice':
            key = (space, visit)
            if key not in dice_outcomes:
                errors.append(f"{space} ({visit}): Type=dice but no DICE_OUTCOMES entry")

        # Check 3: Non-none types need destinations or dice data
        if mtype not in ['none', 'dice']:
            has_dest = any(movement.get(f'destination_{i}') for i in range(1, 6))
            if not has_dest:
                errors.append(f"{space} ({visit}): Type={mtype} but no destinations")

        # Check 4: Destinations must be valid space names
        for i in range(1, 6):
            dest = movement.get(f'destination_{i}', '')
            if dest and not is_valid_space_name(dest):
                warnings.append(f"{space} ({visit}): Invalid destination: {dest[:50]}")

    return errors, warnings
```

### Phase 6: Code Changes for State Memory

**Add to src/types/StateTypes.ts:**
```typescript
interface Player {
  // ... existing fields ...

  pathChoiceMemory?: {
    'REG-DOB-TYPE-SELECT'?: 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT';
  };
}
```

**Modify src/services/MovementService.ts:**
```typescript
getValidMoves(playerId: string): string[] {
  const player = this.stateService.getPlayer(playerId);
  const movement = this.dataService.getMovement(player.currentSpace, player.visitType);

  // Standard logic to get destinations...
  let validMoves = this.extractDestinations(movement);

  // SPECIAL: Filter by path choice memory
  if (player.currentSpace === 'REG-DOB-TYPE-SELECT' &&
      player.visitType === 'Subsequent' &&
      player.pathChoiceMemory?.['REG-DOB-TYPE-SELECT']) {

    const rememberedChoice = player.pathChoiceMemory['REG-DOB-TYPE-SELECT'];
    validMoves = validMoves.filter(m => m === rememberedChoice);
  }

  return validMoves;
}

// On first visit, store choice
movePlayer(playerId: string, destinationSpace: string): Promise<GameState> {
  const player = this.stateService.getPlayer(playerId);

  // SPECIAL: Remember path choice for DOB
  if (player.currentSpace === 'REG-DOB-TYPE-SELECT' &&
      player.visitType === 'First') {

    this.stateService.updatePlayer({
      id: playerId,
      pathChoiceMemory: {
        ...player.pathChoiceMemory,
        'REG-DOB-TYPE-SELECT': destinationSpace as 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT'
      }
    });
  }

  // Continue with normal movement...
}
```

---

## EXECUTION CHECKLIST

### Pre-Execution
- [x] Create this plan document
- [ ] Create backup copies of all CSV files
- [ ] Create backup copy of processing script
- [ ] Document user's manual fixes
- [ ] Get user approval to proceed

### Data Processing
- [ ] Enhance is_valid_space_name() function
- [ ] Implement LOGIC parser (extract_destinations_from_conditions)
- [ ] Rewrite process_spaces_to_movement() with path-first logic
- [ ] Create validation script (validate_movement_data.py)
- [ ] Run new processing script
- [ ] Generate MOVEMENT.csv (DO NOT regenerate DICE_OUTCOMES.csv)
- [ ] Run validation script
- [ ] Fix any errors reported
- [ ] Manual review of REG-FDNY-FEE-REVIEW row
- [ ] Manual review of REG-DOB-TYPE-SELECT row

### Code Changes
- [ ] Add pathChoiceMemory to Player interface
- [ ] Modify MovementService.getValidMoves() for state filtering
- [ ] Modify MovementService.movePlayer() to store choices
- [ ] Test compilation
- [ ] Run existing tests

### Validation
- [ ] Load game in browser
- [ ] Navigate to REG-FDNY-FEE-REVIEW
- [ ] Verify movement options show valid space names only
- [ ] Navigate to REG-DOB-TYPE-SELECT
- [ ] Choose Plan Exam
- [ ] Return to REG-DOB-TYPE-SELECT
- [ ] Verify only Plan Exam is available (choice remembered)
- [ ] Test other dice-based spaces
- [ ] Run full test suite

### Documentation
- [ ] Update this plan with results
- [ ] Create CHANGES.md documenting what was fixed
- [ ] Update any relevant documentation

---

## EXPECTED OUTCOMES

### REG-FDNY-FEE-REVIEW
**Before:**
```csv
REG-FDNY-FEE-REVIEW,First,choice,Did the scope change since the last visit? YES - REG-FDNY-PLAN-EXAM - NO - Space 3,Did Department of Buildings send you here? YES - REG-FDNY-PLAN-EXAM - NO - Space 4
```

**After:**
```csv
REG-FDNY-FEE-REVIEW,First,choice,CON-INITIATION,PM-DECISION-CHECK,REG-DB-TYPE-SELECT,REG-FDNY-PLAN-EXAM
```
(Extracted valid space names from all 5 condition columns)

### REG-DOB-TYPE-SELECT
**Before:**
```csv
REG-DOB-TYPE-SELECT,First,choice,REG-DOB-PLAN-EXAM,REG-DOB-PROF-CERT
REG-DOB-TYPE-SELECT,Subsequent,none
```

**After:**
```csv
REG-DOB-TYPE-SELECT,First,choice,REG-DOB-PLAN-EXAM,REG-DOB-PROF-CERT
REG-DOB-TYPE-SELECT,Subsequent,choice,REG-DOB-PLAN-EXAM,REG-DOB-PROF-CERT
```
(Same choices available, but MovementService filters at runtime based on memory)

### START-QUICK-PLAY-GUIDE
**Before:**
```csv
START-QUICK-PLAY-GUIDE,First,choice,Lastly you may have choices of where to go next.,These are alternative paths available to you.
```

**After:**
```csv
START-QUICK-PLAY-GUIDE,First,none
START-QUICK-PLAY-GUIDE,Subsequent,none
```
(Tutorial text moved to separate TUTORIAL.csv)

---

## ROLLBACK PROCEDURE

If something goes wrong:

```bash
# Restore CSV files
cp public/data/CLEAN_FILES/MOVEMENT.csv.backup public/data/CLEAN_FILES/MOVEMENT.csv
cp public/data/CLEAN_FILES/DICE_OUTCOMES.csv.backup public/data/CLEAN_FILES/DICE_OUTCOMES.csv

# Restore processing script
cp data/process_game_data.py.backup data/process_game_data.py

# Revert code changes
git checkout src/types/StateTypes.ts
git checkout src/services/MovementService.ts

# Clear any browser cache
# Reload game
```

---

## RISKS & MITIGATION

### Risk 1: Breaking working spaces
**Mitigation:** Validate ALL spaces, not just problem ones. Compare before/after.

### Risk 2: LOGIC parser extracts wrong destinations
**Mitigation:** Manual verification of REG-FDNY-FEE-REVIEW output. Cross-reference with user's dice outcomes.

### Risk 3: State memory not persisting
**Mitigation:** Test pathChoiceMemory in game, verify it saves/loads correctly.

### Risk 4: User's manual fixes overwritten
**Mitigation:** DO NOT regenerate DICE_OUTCOMES.csv. Case-by-case analysis of MOVEMENT.csv fixes.

---

## SUCCESS CRITERIA

✅ REG-FDNY-FEE-REVIEW destinations are valid space names only
✅ REG-DOB-TYPE-SELECT Subsequent not marked as "none"
✅ No question marks in any destination fields
✅ All dice-type spaces have matching DICE_OUTCOMES entries
✅ User's DICE_OUTCOMES.csv fixes preserved (lines 11-19)
✅ Validation script reports 0 errors
✅ Game loads without errors
✅ Movement from REG-FDNY-FEE-REVIEW works
✅ REG-DOB-TYPE-SELECT choice is remembered
✅ All existing tests pass

---

## NOTES & OBSERVATIONS

*To be filled in during execution...*

---

**END OF PLAN**
