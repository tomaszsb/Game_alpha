#!/usr/bin/env python3
"""
Script to restore missing loan_amount, loan_rate, investment_amount, work_cost columns
from code2026 backup to current CARDS.csv
"""

import csv
from pathlib import Path

# Paths
backup_csv = Path("/mnt/d/unravel/current_game/code2027/data/code2026_cards_backup.csv")
current_csv = Path("/mnt/d/unravel/current_game/code2027/public/data/CLEAN_FILES/CARDS.csv")
output_csv = Path("/mnt/d/unravel/current_game/code2027/public/data/CLEAN_FILES/CARDS_new.csv")

# Read backup CSV to create lookup dictionary
backup_data = {}
print(f"Reading backup CSV: {backup_csv}")
with open(backup_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        card_id = row['card_id']
        backup_data[card_id] = {
            'loan_amount': row.get('loan_amount', ''),
            'loan_rate': row.get('loan_rate', ''),
            'investment_amount': row.get('investment_amount', ''),
            'work_cost': row.get('work_cost', '')
        }

print(f"Loaded {len(backup_data)} cards from backup")

# Read current CSV and add missing columns
print(f"\nReading current CSV: {current_csv}")
with open(current_csv, 'r', encoding='utf-8') as f_in, open(output_csv, 'w', encoding='utf-8', newline='') as f_out:
    reader = csv.DictReader(f_in)

    # Create new fieldnames with additional columns
    fieldnames = list(reader.fieldnames)
    # Insert new columns after phase_restriction (before is_transferable)
    insert_index = fieldnames.index('phase_restriction') + 1
    new_columns = ['loan_amount', 'loan_rate', 'investment_amount', 'work_cost']
    fieldnames[insert_index:insert_index] = new_columns

    writer = csv.DictWriter(f_out, fieldnames=fieldnames)
    writer.writeheader()

    matched = 0
    unmatched = 0

    for row in reader:
        card_id = row['card_id']

        # Add new columns from backup data
        if card_id in backup_data:
            row.update(backup_data[card_id])
            matched += 1
        else:
            # Card not in backup, set empty values
            row['loan_amount'] = ''
            row['loan_rate'] = ''
            row['investment_amount'] = ''
            row['work_cost'] = ''
            unmatched += 1
            print(f"  Warning: Card {card_id} not found in backup")

        writer.writerow(row)

print(f"\nProcessing complete:")
print(f"  - Matched cards: {matched}")
print(f"  - Unmatched cards: {unmatched}")
print(f"  - Output written to: {output_csv}")
print(f"\nNew column order:")
for i, col in enumerate(fieldnames, 1):
    print(f"  {i}. {col}")
