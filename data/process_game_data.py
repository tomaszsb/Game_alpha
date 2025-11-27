#!/usr/bin/env python3
"""
Process source CSV files into clean game data files.
This script converts Spaces.csv and DiceRoll Info.csv into the format expected by DataService.

REFACTORED: Path-first decision tree to fix REG-FDNY-FEE-REVIEW corruption
"""

import csv
import os
import re

SOURCE_DIR = '/home/user/Code2027/data/SOURCE_FILES'
OUTPUT_DIR = '/home/user/Code2027/public/data/CLEAN_FILES'

def is_valid_space_name(name):
    """
    Stricter validation to reduce false positives.
    Valid space names are UPPERCASE-WITH-HYPHENS format.
    """
    if not name or not name.strip():
        return False

    name = name.strip()

    # Must match pattern: UPPERCASE letters, numbers, and hyphens
    # Must start with uppercase letter
    if not re.match(r'^[A-Z][A-Z0-9\-]+$', name):
        return False

    # Reject question marks (indicates instructional/condition text)
    if '?' in name:
        return False

    # Reject positional references like "Space 2"
    if re.match(r'^Space\s+\d+$', name, re.IGNORECASE):
        return False

    # Reject condition keywords
    if name.upper() in ['YES', 'NO']:
        return False

    # Reject time indicators
    if re.search(r'\d+\s*(day|week|month)', name, re.IGNORECASE):
        return False

    # Reject short abbreviations (DOB, FDNY, etc. - real space names have hyphens)
    # Valid space names are like "REG-FDNY-FEE-REVIEW", not just "FDNY"
    if '-' not in name:
        # Allow exceptions for special spaces without hyphens
        if name not in ['START', 'FINISH']:
            return False

    # Minimum length check (exclude short abbreviations)
    if len(name) < 5:
        return False

    return True

def load_dice_data():
    """Load dice roll data from source to check which spaces have dice movement"""
    dice_file = f'{SOURCE_DIR}/DiceRoll Info.csv'
    dice_spaces = set()

    try:
        with open(dice_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)  # Skip header

            for row in reader:
                if len(row) >= 9:  # Need roll outcomes
                    space_name = row[0].strip()
                    outcome_type = row[1].strip()
                    visit_type = row[2].strip()

                    # Check for movement destinations in outcomes
                    rolls = [row[i].strip() if i < len(row) else '' for i in range(3, 9)]

                    # "Next Step" always indicates movement
                    if outcome_type == 'Next Step':
                        dice_spaces.add((space_name, visit_type))
                    # "Time outcomes" can also contain destinations (confusing naming!)
                    # Check if rolls contain space names (not time values like "5 days")
                    elif outcome_type == 'Time outcomes':
                        # Check if any roll value looks like a space name
                        has_space_names = any(is_valid_space_name(roll) for roll in rolls if roll)
                        if has_space_names:
                            dice_spaces.add((space_name, visit_type))
    except FileNotFoundError:
        print(f"⚠️  Warning: {dice_file} not found")

    return dice_spaces

def extract_destinations_from_logic_conditions(row):
    """
    Extract valid space names from LOGIC condition text.

    LOGIC spaces have condition questions in space_1...space_5 like:
    "Did you pass FDNY approval? YES - REG-FDNY-PLAN-EXAM - NO - Space 3"

    This function:
    1. Finds all UPPERCASE-HYPHENATED words in condition text
    2. Validates each as a potential space name
    3. Returns unique, sorted list of destinations
    """
    destinations = set()

    for i in range(1, 6):
        condition_text = row.get(f'space_{i}', '').strip()
        if not condition_text:
            continue

        # Find all potential space names (UPPERCASE-HYPHENATED pattern)
        potential_names = re.findall(r'[A-Z][A-Z0-9\-]{2,}', condition_text)

        for name in potential_names:
            if is_valid_space_name(name):
                destinations.add(name)

    return sorted(list(destinations))

def get_all_destination_columns(row):
    """Get all destination values from space_1 through space_5"""
    return [
        row.get('space_1', '').strip(),
        row.get('space_2', '').strip(),
        row.get('space_3', '').strip(),
        row.get('space_4', '').strip(),
        row.get('space_5', '').strip()
    ]

def create_movement_row(space_name, visit_type, movement_type, destinations):
    """Create a movement row with standardized format"""
    return {
        'space_name': space_name,
        'visit_type': visit_type,
        'movement_type': movement_type,
        'destination_1': destinations[0] if len(destinations) > 0 else '',
        'destination_2': destinations[1] if len(destinations) > 1 else '',
        'destination_3': destinations[2] if len(destinations) > 2 else '',
        'destination_4': destinations[3] if len(destinations) > 3 else '',
        'destination_5': destinations[4] if len(destinations) > 4 else '',
        'condition_1': '',
        'condition_2': '',
        'condition_3': '',
        'condition_4': '',
        'condition_5': ''
    }

def process_spaces_to_movement():
    """
    Convert Spaces.csv to MOVEMENT.csv with PATH-FIRST decision tree.

    NEW APPROACH:
    1. Check 'path' column FIRST (authoritative source)
    2. Check explicit dice indicators (requires_dice_roll, rolls)
    3. Check for stateful movement ("option from first visit")
    4. Fall back to standard destination counting
    """
    input_file = f'{SOURCE_DIR}/Spaces.csv'
    output_file = f'{OUTPUT_DIR}/MOVEMENT.csv'

    # Load dice data to cross-reference
    dice_spaces = load_dice_data()

    movements = []
    logic_spaces = []  # Track LOGIC spaces for reporting

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_name = row['space_name']
            visit_type = row['visit_type']

            # Get source data fields
            path = row.get('path', '').strip()
            requires_dice_roll = row.get('requires_dice_roll', '').strip()
            rolls = row.get('rolls', '0').strip()
            all_dest_columns = get_all_destination_columns(row)

            # SPECIAL CASE: Tutorial space (extract to separate data later)
            if space_name == 'START-QUICK-PLAY-GUIDE':
                movements.append(create_movement_row(space_name, visit_type, 'none', []))
                continue

            # PRIORITY 1: Check path column (AUTHORITATIVE)
            if path == 'LOGIC':
                # Extract destinations from condition text
                destinations = extract_destinations_from_logic_conditions(row)
                movement_type = 'choice'  # Present as choices - player knows their state
                movements.append(create_movement_row(space_name, visit_type, movement_type, destinations))
                logic_spaces.append((space_name, visit_type, len(destinations)))
                continue

            # PRIORITY 2: Check for dice-based MOVEMENT (not just dice for effects)
            # Only mark as dice movement if "Next Step" data exists in DiceRoll Info.csv
            # Note: requires_dice_roll=YES can be for card draws, not movement!
            key = (space_name, visit_type)
            if key in dice_spaces:
                # Has actual dice movement data (Next Step entries)
                movements.append(create_movement_row(space_name, visit_type, 'dice', []))
                continue

            # PRIORITY 3: Check for stateful movement patterns
            all_dest_lower = ' '.join(all_dest_columns).lower()
            if 'option from first visit' in all_dest_lower:
                # For Subsequent visits with "option from first visit"
                # Keep as 'choice' - MovementService will filter based on memory
                # Get destinations from First visit row (will be same space, First visit)
                destinations = []
                if visit_type == 'Subsequent':
                    # We'll process First visit first, so destinations might be empty here
                    # That's OK - we'll use same destinations as First visit
                    pass

                # For now, extract any valid space names present
                valid_dests = [d for d in all_dest_columns if is_valid_space_name(d)]
                movements.append(create_movement_row(space_name, visit_type,
                                                    'choice' if valid_dests else 'none',
                                                    valid_dests))
                continue

            # PRIORITY 4: Check for "Outcome from rolled dice" magic text
            if any('outcome' in d.lower() and 'dice' in d.lower() for d in all_dest_columns if d):
                movements.append(create_movement_row(space_name, visit_type, 'dice', []))
                continue

            # PRIORITY 5: Standard destination counting
            valid_destinations = [d for d in all_dest_columns if is_valid_space_name(d)]

            if len(valid_destinations) == 0:
                movement_type = 'none'
            elif len(valid_destinations) == 1:
                movement_type = 'fixed'
            else:
                movement_type = 'choice'

            movements.append(create_movement_row(space_name, visit_type, movement_type, valid_destinations))

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'visit_type', 'movement_type',
                      'destination_1', 'destination_2', 'destination_3', 'destination_4', 'destination_5',
                      'condition_1', 'condition_2', 'condition_3', 'condition_4', 'condition_5']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(movements)

    print(f"✓ Created {output_file} with {len(movements)} movement entries")

    # Report LOGIC spaces
    if logic_spaces:
        print(f"\n📋 LOGIC Movement Spaces:")
        for space, visit, dest_count in logic_spaces:
            print(f"   - {space} ({visit}): {dest_count} destinations extracted")

    # Report movement type distribution
    type_counts = {}
    for m in movements:
        mtype = m['movement_type']
        type_counts[mtype] = type_counts.get(mtype, 0) + 1

    print(f"\n📊 Movement Type Distribution:")
    for mtype, count in sorted(type_counts.items()):
        print(f"   - {mtype}: {count}")

def process_dice_info_to_outcomes():
    """
    Convert DiceRoll Info.csv to DICE_OUTCOMES.csv

    NOTE: User has manually edited DICE_OUTCOMES.csv (lines 11-19).
    This function is kept for reference but should NOT be run
    to avoid overwriting user's fixes.
    """
    input_file = f'{SOURCE_DIR}/DiceRoll Info.csv'
    output_file = f'{OUTPUT_DIR}/DICE_OUTCOMES.csv'

    print(f"\n⚠️  SKIPPING DICE_OUTCOMES.csv regeneration")
    print(f"   User has manual fixes (lines 11-19) that must be preserved")
    print(f"   If you need to regenerate, restore from backup first")
    return

    # Original code commented out - DO NOT RUN
    # outcomes = []
    # with open(input_file, 'r', encoding='utf-8') as f:
    #     lines = f.readlines()
    # ...

def main():
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 80)
    print("MOVEMENT DATA PROCESSING - PATH-FIRST APPROACH")
    print("=" * 80)
    print(f"Source: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}\n")

    process_spaces_to_movement()
    process_dice_info_to_outcomes()  # Will skip with warning

    print("\n" + "=" * 80)
    print("✓ Movement data processed successfully!")
    print("=" * 80)
    print("\nNEXT STEPS:")
    print("1. Review output for REG-FDNY-FEE-REVIEW (should have valid space names)")
    print("2. Verify user's manual fixes preserved (CON-INITIATION Subsequent)")
    print("3. Run validation script")

if __name__ == '__main__':
    main()
