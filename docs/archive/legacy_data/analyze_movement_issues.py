#!/usr/bin/env python3
"""
Analyze all spaces for movement configuration issues.
"""

import csv

MOVEMENT_FILE = '/home/user/Code2027/public/data/CLEAN_FILES/MOVEMENT.csv'
DICE_OUTCOMES_FILE = '/home/user/Code2027/public/data/CLEAN_FILES/DICE_OUTCOMES.csv'
SOURCE_SPACES = '/home/user/Code2027/data/SOURCE_FILES/Spaces.csv'
SOURCE_DICE = '/home/user/Code2027/data/SOURCE_FILES/DiceRoll Info.csv'

def load_movements():
    """Load movement data"""
    movements = {}
    with open(MOVEMENT_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row['space_name'], row['visit_type'])
            movements[key] = row
    return movements

def load_dice_outcomes():
    """Load dice outcome data"""
    outcomes = {}
    with open(DICE_OUTCOMES_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row['space_name'], row['visit_type'])
            outcomes[key] = row
    return outcomes

def load_source_dice():
    """Load source dice roll info"""
    dice_data = {}
    with open(SOURCE_DICE, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        for row in reader:
            if len(row) < 3:
                continue
            space_name = row[0]
            outcome_type = row[1]
            visit_type = row[2]

            key = (space_name, visit_type)
            if key not in dice_data:
                dice_data[key] = {}

            dice_data[key][outcome_type] = row[3:9] if len(row) >= 9 else []

    return dice_data

def is_valid_space_name(name):
    """Check if a string looks like a valid space name (not instructional text)"""
    if not name or name.strip() == '':
        return False

    # Instructional text indicators
    invalid_indicators = [
        'you', 'your', 'the', 'this', 'that', 'will', 'are', 'is',
        'choose', 'option', 'each', 'some', 'roll', 'dice', '?', 'YES', 'NO'
    ]

    name_lower = name.lower()
    for indicator in invalid_indicators:
        if indicator in name_lower:
            return False

    # Valid space names are typically ALL-CAPS with hyphens
    return name.replace('-', '').replace('_', '').isupper()

def main():
    print("=" * 80)
    print("MOVEMENT CONFIGURATION AUDIT")
    print("=" * 80)

    movements = load_movements()
    dice_outcomes = load_dice_outcomes()
    source_dice = load_source_dice()

    issues = []

    # Check each movement entry
    for key, movement in movements.items():
        space_name, visit_type = key
        movement_type = movement['movement_type']

        # Get destinations
        dests = [
            movement['destination_1'],
            movement['destination_2'],
            movement['destination_3'],
            movement['destination_4'],
            movement['destination_5']
        ]
        dests = [d for d in dests if d and d.strip()]

        # Issue 1: Movement type is 'dice' but no dice outcomes
        if movement_type == 'dice' and key not in dice_outcomes:
            issues.append({
                'space': space_name,
                'visit': visit_type,
                'issue': 'MISSING_DICE_OUTCOMES',
                'severity': 'CRITICAL',
                'description': f"Movement type is 'dice' but no dice outcomes found"
            })

        # Issue 2: Movement type is 'none' but dice outcomes exist
        if movement_type == 'none' and key in dice_outcomes:
            issues.append({
                'space': space_name,
                'visit': visit_type,
                'issue': 'WRONG_MOVEMENT_TYPE',
                'severity': 'CRITICAL',
                'description': f"Movement type is 'none' but dice outcomes exist - should be 'dice'"
            })

        # Issue 3: Movement type is 'none' but source has dice data
        if movement_type == 'none' and key in source_dice:
            source_data = source_dice[key]
            # Check if there's "Next Step" data
            if 'Next Step' in source_data:
                next_steps = source_data['Next Step']
                valid_dests = [d for d in next_steps if d and is_valid_space_name(d)]
                if valid_dests:
                    issues.append({
                        'space': space_name,
                        'visit': visit_type,
                        'issue': 'MISSING_DICE_DATA',
                        'severity': 'CRITICAL',
                        'description': f"Movement type is 'none' but source has Next Step data: {', '.join(valid_dests[:3])}"
                    })
            # Check if "Time outcomes" actually contains destinations
            if 'Time outcomes' in source_data:
                time_outcomes = source_data['Time outcomes']
                # If values look like space names (not time values like "1 day")
                valid_dests = [d for d in time_outcomes if d and is_valid_space_name(d)]
                if valid_dests:
                    issues.append({
                        'space': space_name,
                        'visit': visit_type,
                        'issue': 'MISSING_DICE_DATA',
                        'severity': 'CRITICAL',
                        'description': f"Movement type is 'none' but source has destination data: {', '.join(valid_dests[:3])}"
                    })

        # Issue 4: Invalid destination names (instructional text)
        if movement_type in ['fixed', 'choice']:
            invalid_dests = [d for d in dests if d and not is_valid_space_name(d)]
            if invalid_dests:
                issues.append({
                    'space': space_name,
                    'visit': visit_type,
                    'issue': 'INVALID_DESTINATIONS',
                    'severity': 'HIGH',
                    'description': f"Contains instructional text instead of space names: {invalid_dests[0][:50]}..."
                })

        # Issue 5: No destinations for non-none movement types
        if movement_type not in ['none', 'dice'] and len(dests) == 0:
            issues.append({
                'space': space_name,
                'visit': visit_type,
                'issue': 'NO_DESTINATIONS',
                'severity': 'CRITICAL',
                'description': f"Movement type is '{movement_type}' but no destinations specified"
            })

    # Report issues
    if not issues:
        print("\n✅ No issues found! All spaces have proper movement configuration.\n")
        return

    print(f"\n⚠️  Found {len(issues)} issues:\n")

    # Group by severity
    critical = [i for i in issues if i['severity'] == 'CRITICAL']
    high = [i for i in issues if i['severity'] == 'HIGH']

    if critical:
        print(f"\n🔴 CRITICAL ISSUES ({len(critical)}):")
        print("-" * 80)
        for issue in critical:
            print(f"\n  Space: {issue['space']} ({issue['visit']})")
            print(f"  Issue: {issue['issue']}")
            print(f"  Details: {issue['description']}")

    if high:
        print(f"\n🟠 HIGH PRIORITY ISSUES ({len(high)}):")
        print("-" * 80)
        for issue in high:
            print(f"\n  Space: {issue['space']} ({issue['visit']})")
            print(f"  Issue: {issue['issue']}")
            print(f"  Details: {issue['description']}")

    print("\n" + "=" * 80)
    print(f"TOTAL ISSUES: {len(issues)}")
    print("=" * 80 + "\n")

if __name__ == '__main__':
    main()
