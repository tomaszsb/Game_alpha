#!/usr/bin/env python3
"""
Fix L card migration issues:
1. Fix LEND-SCOPE-CHECK E/L card type bug
2. Convert all L card draws from manual to auto
"""

import csv
import shutil
from datetime import datetime

INPUT_FILE = '/mnt/d/unravel/current_game/code2027/public/data/CLEAN_FILES/SPACE_EFFECTS.csv'
BACKUP_FILE = f'/mnt/d/unravel/current_game/code2027/public/data/CLEAN_FILES/SPACE_EFFECTS.csv.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}'

# Create backup
print(f"Creating backup: {BACKUP_FILE}")
shutil.copy2(INPUT_FILE, BACKUP_FILE)

# Read all rows
rows = []
with open(INPUT_FILE, 'r') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        rows.append(row)

# Track changes
fixes_applied = {
    'e_l_bug_fixed': 0,
    'l_cards_auto': 0,
    'l_cards_already_auto': 0,
    'l_cards_empty_to_auto': 0
}

# Process each row
for i, row in enumerate(rows):
    space = row['space_name']
    visit = row['visit_type']
    effect_type = row['effect_type']
    effect_action = row['effect_action']
    trigger = row['trigger_type']

    # Fix 1: LEND-SCOPE-CHECK E/L bug
    # The second card effect for LEND-SCOPE-CHECK,First should be E not L
    if (space == 'LEND-SCOPE-CHECK' and
        visit == 'First' and
        effect_type == 'cards' and
        effect_action == 'draw_l' and
        row['condition'] == 'always'):

        print(f"\n✓ Fixing E/L migration bug:")
        print(f"  {space},{visit}: draw_l → draw_e (condition: {row['condition']})")
        row['effect_action'] = 'draw_e'
        row['description'] = 'Draw 1 E card'
        fixes_applied['e_l_bug_fixed'] += 1

    # Fix 2: All L card draws should be auto
    if effect_type == 'cards' and effect_action == 'draw_l':
        if trigger == 'manual':
            print(f"✓ {space},{visit}: manual → auto")
            row['trigger_type'] = 'auto'
            fixes_applied['l_cards_auto'] += 1
        elif trigger == 'auto':
            fixes_applied['l_cards_already_auto'] += 1
        elif not trigger or trigger.strip() == '':
            row['trigger_type'] = 'auto'
            fixes_applied['l_cards_empty_to_auto'] += 1

# Write fixed data
print(f"\nWriting fixed data to {INPUT_FILE}")
with open(INPUT_FILE, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

# Summary
print("\n" + "=" * 80)
print("FIXES APPLIED:")
print("=" * 80)
print(f"E/L migration bugs fixed: {fixes_applied['e_l_bug_fixed']}")
print(f"L cards changed from manual→auto: {fixes_applied['l_cards_auto']}")
print(f"L cards changed from empty→auto: {fixes_applied['l_cards_empty_to_auto']}")
print(f"L cards already auto (no change): {fixes_applied['l_cards_already_auto']}")
print(f"\nTotal L card effects now auto: {fixes_applied['l_cards_auto'] + fixes_applied['l_cards_empty_to_auto'] + fixes_applied['l_cards_already_auto']}")
print("\n" + "=" * 80)
print(f"Backup saved to: {BACKUP_FILE}")
print("=" * 80)
