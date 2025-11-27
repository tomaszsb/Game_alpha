#!/usr/bin/env python3
"""
Comprehensive fix for all movement data issues.
Regenerates MOVEMENT.csv and DICE_OUTCOMES.csv with correct data.
"""

import csv
import os

SOURCE_DIR = '/home/user/Code2027/data/SOURCE_FILES'
OUTPUT_DIR = '/home/user/Code2027/public/data/CLEAN_FILES'

def is_valid_space_name(name):
    """Check if string is a valid space name (not time/instructional text)"""
    if not name or name.strip() == '':
        return False

    name = name.strip()

    # Time value patterns
    if any(x in name.lower() for x in ['day', 'days', 'week', 'weeks', 'month']):
        return False

    # Instructional text patterns (but allow valid space names with these words)
    if any(name.lower().startswith(x) for x in ['did you', 'do you', 'option from', 'space ', 'choose', 'roll']):
        return False

    # Must have at least one uppercase letter (space names are typically caps)
    if not any(c.isupper() for c in name):
        return False

    return True

def load_source_dice_data():
    """Load dice roll information from source"""
    dice_file = f'{SOURCE_DIR}/DiceRoll Info.csv'
    dice_data = {}

    with open(dice_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header

        for row in reader:
            if len(row) < 3:
                continue

            space_name = row[0].strip()
            outcome_type = row[1].strip()
            visit_type = row[2].strip()

            key = (space_name, visit_type)
            if key not in dice_data:
                dice_data[key] = {}

            # Store the roll outcomes
            rolls = [row[i].strip() if i < len(row) else '' for i in range(3, 9)]
            dice_data[key][outcome_type] = rolls

    return dice_data

def process_movements_comprehensive():
    """Process Spaces.csv into MOVEMENT.csv with comprehensive logic"""
    spaces_file = f'{SOURCE_DIR}/Spaces.csv'
    output_file = f'{OUTPUT_DIR}/MOVEMENT.csv'

    dice_data = load_source_dice_data()
    movements = []

    with open(spaces_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_name = row['space_name'].strip()
            visit_type = row['visit_type'].strip()

            # Get destination columns
            space_1 = row.get('space_1', '').strip()
            space_2 = row.get('space_2', '').strip()
            space_3 = row.get('space_3', '').strip()
            space_4 = row.get('space_4', '').strip()
            space_5 = row.get('space_5', '').strip()

            all_dests = [space_1, space_2, space_3, space_4, space_5]

            # Check if this space has dice outcomes in source data
            key = (space_name, visit_type)
            has_dice_data = key in dice_data and ('Next Step' in dice_data[key] or
                                                   'Time outcomes' in dice_data[key])

            # Determine movement type
            movement_type = 'none'
            destinations = []

            # Check for dice-based movement
            if has_dice_data:
                # Check if it's truly dice-based (has actual destination spaces in dice data)
                if 'Next Step' in dice_data[key]:
                    next_steps = dice_data[key]['Next Step']
                    valid_dice_dests = [d for d in next_steps if is_valid_space_name(d)]
                    if valid_dice_dests:
                        movement_type = 'dice'
                        destinations = []  # Will come from DICE_OUTCOMES

                # Some spaces use "Time outcomes" for destinations (confusing naming!)
                if movement_type == 'none' and 'Time outcomes' in dice_data[key]:
                    time_outcomes = dice_data[key]['Time outcomes']
                    valid_dice_dests = [d for d in time_outcomes if is_valid_space_name(d)]
                    if valid_dice_dests:
                        movement_type = 'dice'
                        destinations = []  # Will come from DICE_OUTCOMES

            # If not dice-based, check destination columns
            if movement_type == 'none':
                # Check for "Outcome from rolled dice" text
                if any('outcome' in d.lower() and 'dice' in d.lower() for d in all_dests if d):
                    movement_type = 'dice'
                    destinations = []
                else:
                    # Filter valid destination names
                    valid_dests = [d for d in all_dests if is_valid_space_name(d)]

                    if len(valid_dests) == 0:
                        movement_type = 'none'
                    elif len(valid_dests) == 1:
                        movement_type = 'fixed'
                        destinations = valid_dests
                    else:
                        movement_type = 'choice'
                        destinations = valid_dests

            # Build movement row
            movement_row = {
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

            movements.append(movement_row)

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'visit_type', 'movement_type',
                      'destination_1', 'destination_2', 'destination_3', 'destination_4', 'destination_5',
                      'condition_1', 'condition_2', 'condition_3', 'condition_4', 'condition_5']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(movements)

    print(f"✓ Created {output_file} with {len(movements)} movement entries")

    # Report dice-based spaces
    dice_spaces = [m for m in movements if m['movement_type'] == 'dice']
    print(f"  - {len(dice_spaces)} spaces use dice-based movement")

def process_dice_outcomes_comprehensive():
    """Process all dice outcomes from source data"""
    output_file = f'{OUTPUT_DIR}/DICE_OUTCOMES.csv'

    dice_data = load_source_dice_data()
    outcomes = []

    for key, data in dice_data.items():
        space_name, visit_type = key

        # Try "Next Step" first (most common for movement destinations)
        if 'Next Step' in data:
            rolls = data['Next Step']
            valid_rolls = [r if is_valid_space_name(r) else '' for r in rolls]

            # Only add if there are valid destinations
            if any(valid_rolls):
                outcome_row = {
                    'space_name': space_name,
                    'visit_type': visit_type,
                    'roll_1': valid_rolls[0] if len(valid_rolls) > 0 else '',
                    'roll_2': valid_rolls[1] if len(valid_rolls) > 1 else '',
                    'roll_3': valid_rolls[2] if len(valid_rolls) > 2 else '',
                    'roll_4': valid_rolls[3] if len(valid_rolls) > 3 else '',
                    'roll_5': valid_rolls[4] if len(valid_rolls) > 4 else '',
                    'roll_6': valid_rolls[5] if len(valid_rolls) > 5 else ''
                }
                outcomes.append(outcome_row)

        # Check "Time outcomes" for destination spaces (confusing naming in source!)
        elif 'Time outcomes' in data:
            rolls = data['Time outcomes']
            valid_rolls = [r if is_valid_space_name(r) else '' for r in rolls]

            # Only add if there are valid destination space names (not time values)
            if any(valid_rolls):
                outcome_row = {
                    'space_name': space_name,
                    'visit_type': visit_type,
                    'roll_1': valid_rolls[0] if len(valid_rolls) > 0 else '',
                    'roll_2': valid_rolls[1] if len(valid_rolls) > 1 else '',
                    'roll_3': valid_rolls[2] if len(valid_rolls) > 2 else '',
                    'roll_4': valid_rolls[3] if len(valid_rolls) > 3 else '',
                    'roll_5': valid_rolls[4] if len(valid_rolls) > 4 else '',
                    'roll_6': valid_rolls[5] if len(valid_rolls) > 5 else ''
                }
                outcomes.append(outcome_row)

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'visit_type', 'roll_1', 'roll_2', 'roll_3', 'roll_4', 'roll_5', 'roll_6']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(outcomes)

    print(f"✓ Created {output_file} with {len(outcomes)} dice outcome entries")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 80)
    print("COMPREHENSIVE MOVEMENT DATA FIX")
    print("=" * 80)
    print(f"Source: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}\n")

    process_movements_comprehensive()
    process_dice_outcomes_comprehensive()

    print("\n" + "=" * 80)
    print("✓ All movement data regenerated successfully!")
    print("=" * 80)

if __name__ == '__main__':
    main()
