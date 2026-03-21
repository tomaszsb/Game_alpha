#!/usr/bin/env python3
"""
Migrate dice conditions from description text to condition column in SPACE_EFFECTS.csv

Before: effect_value="Draw 1 if you roll a 1", condition=""
After:  effect_value="1", condition="dice_roll_1"
"""

import csv
import re
import os

def migrate_csv(input_path, output_path):
    """Migrate dice conditions from effect_value/description to condition column."""

    rows = []
    migrated_count = 0

    with open(input_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            effect_value = str(row.get('effect_value', '')).lower()
            description = str(row.get('description', '')).lower()

            # Check for dice condition pattern
            match = re.search(r'if you roll a (\d+)', effect_value) or \
                    re.search(r'if you roll a (\d+)', description)

            if match and row.get('effect_type') == 'cards' and 'draw_l' in row.get('effect_action', '').lower():
                required_roll = match.group(1)

                # Update the row
                row['condition'] = f'dice_roll_{required_roll}'
                row['effect_value'] = '1'
                row['description'] = f'Draw L card on roll of {required_roll}'

                migrated_count += 1
                print(f"Migrated: {row['space_name']} ({row['visit_type']}) -> dice_roll_{required_roll}")

            rows.append(row)

    # Write the updated CSV
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nMigration complete: {migrated_count} rows updated")
    return migrated_count

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, '..', 'public', 'data', 'CLEAN_FILES', 'SPACE_EFFECTS.csv')
    output_file = input_file  # Overwrite in place

    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    print()

    migrate_csv(input_file, output_file)
