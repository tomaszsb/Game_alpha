#!/usr/bin/env python3
"""
Validate MOVEMENT.csv for common errors and data integrity issues.
"""

import csv
import re

MOVEMENT_FILE = '/home/user/Code2027/public/data/CLEAN_FILES/MOVEMENT.csv'
DICE_OUTCOMES_FILE = '/home/user/Code2027/public/data/CLEAN_FILES/DICE_OUTCOMES.csv'

def is_valid_space_name(name):
    """Check if a string looks like a valid space name"""
    if not name or not name.strip():
        return False

    name = name.strip()

    # Must match pattern: UPPERCASE-WITH-HYPHENS
    if not re.match(r'^[A-Z][A-Z0-9\-]+$', name):
        return False

    # Reject questions
    if '?' in name:
        return False

    # Must have hyphen or be special case
    if '-' not in name and name not in ['START', 'FINISH']:
        return False

    # Minimum length
    if len(name) < 5:
        return False

    return True

def load_csv_dict(filepath, key_fields):
    """Load CSV and create dict keyed by specified fields"""
    data = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = tuple(row[field] for field in key_fields)
            data[key] = row
    return data

def main():
    print("=" * 80)
    print("MOVEMENT DATA VALIDATION")
    print("=" * 80)

    # Load data
    movements = load_csv_dict(MOVEMENT_FILE, ['space_name', 'visit_type'])
    dice_outcomes = load_csv_dict(DICE_OUTCOMES_FILE, ['space_name', 'visit_type'])

    errors = []
    warnings = []

    print(f"\nValidating {len(movements)} movement entries...")

    for key, movement in movements.items():
        space_name, visit_type = key
        movement_type = movement['movement_type']

        # Get all destinations
        destinations = [
            movement.get(f'destination_{i}', '').strip()
            for i in range(1, 6)
        ]
        destinations = [d for d in destinations if d]

        # CHECK 1: No question marks in destinations
        for dest in destinations:
            if '?' in dest:
                errors.append({
                    'space': space_name,
                    'visit': visit_type,
                    'issue': 'QUESTION_IN_DESTINATION',
                    'detail': f'Destination contains "?": {dest[:50]}...'
                })

        # CHECK 2: All destinations must be valid space names
        for dest in destinations:
            if not is_valid_space_name(dest):
                errors.append({
                    'space': space_name,
                    'visit': visit_type,
                    'issue': 'INVALID_DESTINATION',
                    'detail': f'Invalid space name: "{dest}"'
                })

        # CHECK 3: Dice type must have matching dice outcomes
        if movement_type == 'dice':
            if key not in dice_outcomes:
                errors.append({
                    'space': space_name,
                    'visit': visit_type,
                    'issue': 'MISSING_DICE_OUTCOMES',
                    'detail': f'Type is "dice" but no DICE_OUTCOMES entry found'
                })

        # CHECK 4: Non-none/dice types need destinations
        if movement_type not in ['none', 'dice']:
            if not destinations:
                errors.append({
                    'space': space_name,
                    'visit': visit_type,
                    'issue': 'NO_DESTINATIONS',
                    'detail': f'Type is "{movement_type}" but no destinations specified'
                })

        # CHECK 5: Detect likely LOGIC spaces that weren't parsed
        for dest in destinations:
            if 'YES' in dest.upper() or 'NO' in dest.upper() or ' or ' in dest:
                warnings.append({
                    'space': space_name,
                    'visit': visit_type,
                    'issue': 'POSSIBLE_UNPARSED_LOGIC',
                    'detail': f'Destination may contain condition text: {dest[:50]}...'
                })

    # Print results
    print(f"\n{'=' * 80}")
    print(f"VALIDATION RESULTS")
    print(f"{'=' * 80}")

    if not errors and not warnings:
        print("\n✅ VALIDATION PASSED - No errors or warnings found!")
        return 0

    if errors:
        print(f"\n❌ ERRORS ({len(errors)}):")
        print("-" * 80)
        for error in errors:
            print(f"\n  Space: {error['space']} ({error['visit']})")
            print(f"  Issue: {error['issue']}")
            print(f"  Detail: {error['detail']}")

    if warnings:
        print(f"\n⚠️  WARNINGS ({len(warnings)}):")
        print("-" * 80)
        for warning in warnings:
            print(f"\n  Space: {warning['space']} ({warning['visit']})")
            print(f"  Issue: {warning['issue']}")
            print(f"  Detail: {warning['detail']}")

    print(f"\n{'=' * 80}")
    print(f"Total Issues: {len(errors)} errors, {len(warnings)} warnings")
    print(f"{'=' * 80}")

    return 1 if errors else 0

if __name__ == '__main__':
    exit(main())
