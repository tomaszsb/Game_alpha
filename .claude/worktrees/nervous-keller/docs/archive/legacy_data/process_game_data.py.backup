#!/usr/bin/env python3
"""
Process source CSV files into clean game data files.
This script converts Spaces.csv and DiceRoll Info.csv into the format expected by DataService.
"""

import csv
import os

SOURCE_DIR = '/home/user/Code2027/data/SOURCE_FILES'
OUTPUT_DIR = '/home/user/Code2027/public/data/CLEAN_FILES'

def process_spaces_to_movement():
    """Convert Spaces.csv to MOVEMENT.csv with proper movement types"""
    input_file = f'{SOURCE_DIR}/Spaces.csv'
    output_file = f'{OUTPUT_DIR}/MOVEMENT.csv'

    movements = []

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_name = row['space_name']
            visit_type = row['visit_type']

            # Get destinations from space_1 through space_5 columns
            space_1 = row.get('space_1', '').strip()
            space_2 = row.get('space_2', '').strip()
            space_3 = row.get('space_3', '').strip()
            space_4 = row.get('space_4', '').strip()
            space_5 = row.get('space_5', '').strip()

            # Collect all destinations
            all_destinations = [space_1, space_2, space_3, space_4, space_5]
            destinations = [d for d in all_destinations if d and d.lower() not in ['', 'finish']]

            # Determine movement type
            movement_type = 'none'

            # Check if it says "Outcome from rolled dice" or similar
            if any('outcome' in d.lower() and 'dice' in d.lower() for d in all_destinations if d):
                movement_type = 'dice'
                destinations = []  # Will be loaded from DICE_OUTCOMES.csv
            elif len(destinations) == 0:
                movement_type = 'none'
            elif len(destinations) == 1:
                movement_type = 'fixed'
            else:
                movement_type = 'choice'

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

def process_dice_info_to_outcomes():
    """Convert DiceRoll Info.csv to DICE_OUTCOMES.csv"""
    input_file = f'{SOURCE_DIR}/DiceRoll Info.csv'
    output_file = f'{OUTPUT_DIR}/DICE_OUTCOMES.csv'

    outcomes = []

    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Parse "DiceRoll Info.csv" which has format:
    # Space, Type (Next Step/Time outcomes/etc), Visit, Roll1, Roll2, Roll3, Roll4, Roll5, Roll6
    current_space = None
    for line in lines[1:]:  # Skip header
        parts = [p.strip() for p in line.strip().split(',')]
        if len(parts) < 4:
            continue

        space_name = parts[0]
        outcome_type = parts[1]  # "Next Step", "Time outcomes", etc
        visit_type = parts[2]  # "First", "Subsequent"

        # Only process "Next Step" rows for movement destinations
        if outcome_type == 'Next Step':
            outcome_row = {
                'space_name': space_name,
                'visit_type': visit_type,
                'roll_1': parts[3] if len(parts) > 3 else '',
                'roll_2': parts[4] if len(parts) > 4 else '',
                'roll_3': parts[5] if len(parts) > 5 else '',
                'roll_4': parts[6] if len(parts) > 6 else '',
                'roll_5': parts[7] if len(parts) > 7 else '',
                'roll_6': parts[8] if len(parts) > 8 else ''
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
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Processing game data...")
    print(f"Source: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}\n")

    process_spaces_to_movement()
    process_dice_info_to_outcomes()

    print("\n✓ All game data processed successfully!")

if __name__ == '__main__':
    main()
