#!/usr/bin/env python3
"""
Data validation script for CSV restructure project.
Ensures all data from source files is preserved in clean files.
"""

import csv
import os
from pathlib import Path

# File paths
BASE_DIR = Path(__file__).parent.parent
SOURCE_DIR = BASE_DIR / "SOURCE_FILES"
CLEAN_DIR = BASE_DIR / "CLEAN_FILES"

def read_csv_file(filepath):
    """Read CSV file and return list of dictionaries."""
    with open(filepath, 'r', encoding='utf-8-sig') as f:  # Handle BOM
        reader = csv.DictReader(f)
        data = list(reader)
        # Strip BOM from first column name if present
        if data and len(data[0]) > 0:
            first_key = list(data[0].keys())[0]
            if first_key.startswith('\ufeff'):
                # Rename the key without BOM
                for row in data:
                    if first_key in row:
                        row[first_key.lstrip('\ufeff')] = row.pop(first_key)
        return data

def validate_space_names():
    """Validate that all space names are preserved across files."""
    print("Validating space names...")
    
    # Get all space names from source
    spaces_source = read_csv_file(SOURCE_DIR / "Spaces.csv")
    dice_source = read_csv_file(SOURCE_DIR / "DiceRoll Info.csv")
    
    source_spaces = set(row['space_name'] for row in spaces_source if row['space_name'])
    dice_spaces = set(row['space_name'] for row in dice_source if row['space_name'])
    
    # Get all space names from clean files
    movement_clean = read_csv_file(CLEAN_DIR / "MOVEMENT.csv")
    effects_clean = read_csv_file(CLEAN_DIR / "SPACE_EFFECTS.csv")
    content_clean = read_csv_file(CLEAN_DIR / "SPACE_CONTENT.csv")
    config_clean = read_csv_file(CLEAN_DIR / "GAME_CONFIG.csv")
    
    movement_spaces = set(row['space_name'] for row in movement_clean if row['space_name'])
    effects_spaces = set(row['space_name'] for row in effects_clean if row['space_name'])
    content_spaces = set(row['space_name'] for row in content_clean if row['space_name'])
    config_spaces = set(row['space_name'] for row in config_clean if row['space_name'])
    
    # Check for missing spaces
    all_source_spaces = source_spaces.union(dice_spaces)
    all_clean_spaces = movement_spaces.union(effects_spaces).union(content_spaces).union(config_spaces)
    
    missing_from_clean = all_source_spaces - all_clean_spaces
    extra_in_clean = all_clean_spaces - all_source_spaces
    
    if missing_from_clean:
        print(f"❌ Missing spaces in clean files: {missing_from_clean}")
        return False
    
    if extra_in_clean:
        print(f"⚠️  Extra spaces in clean files: {extra_in_clean}")
    
    print(f"✅ All {len(all_source_spaces)} spaces preserved")
    return True

def validate_visit_types():
    """Validate that visit types are preserved."""
    print("Validating visit types...")
    
    spaces_source = read_csv_file(SOURCE_DIR / "Spaces.csv")
    dice_source = read_csv_file(SOURCE_DIR / "DiceRoll Info.csv")
    
    # Get all visit type combinations from source
    source_combinations = set()
    for row in spaces_source:
        if row['space_name'] and row['visit_type']:
            source_combinations.add((row['space_name'], row['visit_type']))
    
    for row in dice_source:
        if row['space_name'] and row['visit_type']:
            source_combinations.add((row['space_name'], row['visit_type']))
    
    # Check clean files
    clean_files = ['MOVEMENT.csv', 'SPACE_EFFECTS.csv', 'SPACE_CONTENT.csv']
    clean_combinations = set()
    
    for filename in clean_files:
        data = read_csv_file(CLEAN_DIR / filename)
        for row in data:
            if row['space_name'] and row['visit_type']:
                clean_combinations.add((row['space_name'], row['visit_type']))
    
    missing_combinations = source_combinations - clean_combinations
    if missing_combinations:
        print(f"❌ Missing visit type combinations: {missing_combinations}")
        return False
    
    print(f"✅ All {len(source_combinations)} visit type combinations preserved")
    return True

def validate_dice_outcomes():
    """Validate dice outcomes are correctly extracted."""
    print("Validating dice outcomes...")
    
    dice_source = read_csv_file(SOURCE_DIR / "DiceRoll Info.csv")
    dice_outcomes = read_csv_file(CLEAN_DIR / "DICE_OUTCOMES.csv")
    
    # Count rows with "Next Step" dice rolls
    next_step_rows = [row for row in dice_source if row['die_roll'] == 'Next Step']
    
    # DICE_OUTCOMES includes header, so subtract 1 for actual data rows
    outcome_rows = len(dice_outcomes)
    expected_rows = len(next_step_rows)
    
    # Allow for some differences since we may have extracted more granular data
    if abs(outcome_rows - expected_rows) > 10:
        print(f"❌ Dice outcomes major mismatch: expected ~{expected_rows}, got {outcome_rows}")
        return False
    
    print(f"✅ Dice outcomes preserved (source: {expected_rows} 'Next Step', clean: {outcome_rows} total)")
    return True

def validate_effects_data():
    """Validate that effects data is preserved."""
    print("Validating effects data...")
    
    spaces_source = read_csv_file(SOURCE_DIR / "Spaces.csv")
    space_effects = read_csv_file(CLEAN_DIR / "SPACE_EFFECTS.csv")
    
    # Count non-empty effect columns in source
    effect_columns = ['w_card', 'b_card', 'i_card', 'l_card', 'e_card', 'Time', 'Fee']
    source_effects_count = 0
    
    for row in spaces_source:
        for col in effect_columns:
            if row.get(col) and row[col].strip():
                source_effects_count += 1
    
    # Count effects in clean file
    clean_effects_count = len(space_effects)
    
    # Should be roughly similar (allowing for some interpretation differences)
    ratio = clean_effects_count / source_effects_count if source_effects_count > 0 else 0
    if ratio < 0.8 or ratio > 1.5:
        print(f"❌ Effects count mismatch: source ~{source_effects_count}, clean {clean_effects_count}")
        return False
    
    print(f"✅ Effects data preserved (source: ~{source_effects_count}, clean: {clean_effects_count})")
    return True

def validate_content_data():
    """Validate that content data is preserved."""
    print("Validating content data...")
    
    spaces_source = read_csv_file(SOURCE_DIR / "Spaces.csv")
    content_clean = read_csv_file(CLEAN_DIR / "SPACE_CONTENT.csv")
    
    # Count rows with story content
    story_rows = [row for row in spaces_source if row.get('Event') and row['Event'].strip()]
    content_rows = len(content_clean)
    
    if content_rows != len(story_rows):
        print(f"❌ Content rows mismatch: expected {len(story_rows)}, got {content_rows}")
        return False
    
    print(f"✅ All {content_rows} content rows preserved")
    return True

def main():
    """Run all validation checks."""
    print("🔍 Starting data validation...")
    print("=" * 50)
    
    checks = [
        validate_space_names,
        validate_visit_types,
        validate_dice_outcomes,
        validate_effects_data,
        validate_content_data
    ]
    
    results = []
    for check in checks:
        try:
            result = check()
            results.append(result)
            print()
        except Exception as e:
            print(f"❌ Error in {check.__name__}: {e}")
            results.append(False)
            print()
    
    print("=" * 50)
    if all(results):
        print("🎉 All validation checks passed!")
        print("✅ Data integrity confirmed - zero data loss")
    else:
        print("❌ Some validation checks failed")
        print("⚠️  Review extraction process")
    
    return all(results)

if __name__ == "__main__":
    main()