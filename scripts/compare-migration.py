#!/usr/bin/env python3
"""
Compare SPACE_EFFECTS data migration from code2026 to code2027
Identify migration errors and L cards that need to be changed from manual to auto
"""

import csv
from collections import defaultdict

# Read code2026 data
code2026_effects = defaultdict(list)
with open('/mnt/d/unravel/current_game/code2026/game/data/SPACE_EFFECTS.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        key = (row['space_name'], row['visit_type'])
        code2026_effects[key].append(row)

# Read code2027 data
code2027_effects = defaultdict(list)
with open('/mnt/d/unravel/current_game/code2027/public/data/CLEAN_FILES/SPACE_EFFECTS.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        key = (row['space_name'], row['visit_type'])
        code2027_effects[key].append(row)

print("=" * 80)
print("MIGRATION ANALYSIS: code2026 → code2027")
print("=" * 80)

# Track issues
l_cards_manual = []
e_l_mismatches = []
missing_effects = []
extra_effects = []

# Compare each space
all_keys = set(code2026_effects.keys()) | set(code2027_effects.keys())

for key in sorted(all_keys):
    space_name, visit_type = key
    old_effects = code2026_effects.get(key, [])
    new_effects = code2027_effects.get(key, [])

    # Build card type mapping from code2026
    old_cards = {}
    for effect in old_effects:
        if effect['effect_type'] == 'l_cards':
            old_cards['L'] = effect
        elif effect['effect_type'] == 'e_cards':
            old_cards['E'] = effect
        elif effect['effect_type'] == 'w_cards':
            old_cards['W'] = effect
        elif effect['effect_type'] == 'b_cards':
            old_cards['B'] = effect
        elif effect['effect_type'] == 'i_cards':
            old_cards['I'] = effect

    # Check code2027 card effects
    for effect in new_effects:
        if effect['effect_type'] == 'cards':
            action = effect['effect_action']

            # Extract card type from action (draw_l, draw_e, etc.)
            if action.startswith('draw_'):
                card_type = action.split('_')[1].upper()

                # Check if L card is manual (should be auto)
                if card_type == 'L' and effect['trigger_type'] == 'manual':
                    l_cards_manual.append({
                        'space': space_name,
                        'visit': visit_type,
                        'effect': effect
                    })

                # Check if card type matches what was in code2026
                old_type_key = f"{card_type.lower()}_cards"
                if old_type_key not in [e['effect_type'] for e in old_effects]:
                    # This card type didn't exist in code2026 - potential migration error
                    # Check if it should have been a different type
                    for old_card_type in ['l_cards', 'e_cards', 'w_cards', 'b_cards', 'i_cards']:
                        if old_card_type in [e['effect_type'] for e in old_effects]:
                            # Found a card type in old but current type doesn't match
                            old_expected = old_card_type.split('_')[0].upper()
                            if old_expected != card_type:
                                e_l_mismatches.append({
                                    'space': space_name,
                                    'visit': visit_type,
                                    'expected': old_expected,
                                    'actual': card_type,
                                    'effect': effect
                                })

# Print L cards that are manual (should be auto)
print("\n" + "=" * 80)
print("L CARDS MARKED AS MANUAL (should be AUTO):")
print("=" * 80)
if l_cards_manual:
    for item in l_cards_manual:
        print(f"\n{item['space']},{item['visit']}")
        print(f"  Effect: {item['effect']['effect_action']} - {item['effect']['description']}")
        print(f"  Condition: {item['effect']['condition']}")
        print(f"  Trigger: {item['effect']['trigger_type']} ← SHOULD BE 'auto'")
else:
    print("No issues found")

# Print E/L mismatches
print("\n" + "=" * 80)
print("POTENTIAL CARD TYPE MIGRATION ERRORS:")
print("=" * 80)
print("(Checking for L/E card type swaps during migration)")

# More detailed check - compare card counts
for key in sorted(all_keys):
    space_name, visit_type = key
    old_effects = code2026_effects.get(key, [])
    new_effects = code2027_effects.get(key, [])

    # Count card types in old data
    old_card_counts = defaultdict(int)
    for effect in old_effects:
        if effect['effect_type'].endswith('_cards'):
            card_type = effect['effect_type'].split('_')[0].upper()
            old_card_counts[card_type] += 1

    # Count card types in new data
    new_card_counts = defaultdict(int)
    for effect in new_effects:
        if effect['effect_type'] == 'cards' and effect['effect_action'].startswith('draw_'):
            card_type = effect['effect_action'].split('_')[1].upper()
            new_card_counts[card_type] += 1

    # Compare counts
    if old_card_counts != new_card_counts:
        print(f"\n{space_name},{visit_type}:")
        print(f"  code2026: {dict(old_card_counts)}")
        print(f"  code2027: {dict(new_card_counts)}")

        # Show detailed effects
        for effect in new_effects:
            if effect['effect_type'] == 'cards':
                print(f"    → {effect['effect_action']}: {effect['description']}")

# Summary
print("\n" + "=" * 80)
print("SUMMARY:")
print("=" * 80)
print(f"L cards that need manual→auto conversion: {len(l_cards_manual)}")
print(f"Spaces with card type count mismatches: {len([k for k in all_keys if code2026_effects.get(k) and code2027_effects.get(k) and sum(1 for e in code2026_effects[k] if e['effect_type'].endswith('_cards')) != sum(1 for e in code2027_effects[k] if e['effect_type'] == 'cards' and e['effect_action'].startswith('draw_'))])}")

print("\n" + "=" * 80)
