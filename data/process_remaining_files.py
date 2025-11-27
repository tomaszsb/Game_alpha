#!/usr/bin/env python3
"""
Generate remaining CSV files from Spaces.csv for the game system.
"""

import csv
import os

SOURCE_DIR = '/home/user/Code2027/data/SOURCE_FILES'
OUTPUT_DIR = '/home/user/Code2027/public/data/CLEAN_FILES'

def process_game_config():
    """Extract GAME_CONFIG.csv from Spaces.csv"""
    input_file = f'{SOURCE_DIR}/Spaces.csv'
    output_file = f'{OUTPUT_DIR}/GAME_CONFIG.csv'

    configs = {}  # Use dict to avoid duplicates

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_name = row['space_name']
            if space_name not in configs:
                # Correct starting space logic: Main path in SETUP phase, not instruction spaces
                phase = row.get('phase', '')
                path = row.get('path', '')
                is_starting = (phase == 'SETUP' and path == 'Main')

                configs[space_name] = {
                    'space_name': space_name,
                    'phase': phase,
                    'path_type': path,
                    'is_starting_space': 'Yes' if is_starting else 'No',
                    'is_ending_space': 'Yes' if space_name == 'FINISH' else 'No',
                    'min_players': '1',
                    'max_players': '4',
                    'requires_dice_roll': row.get('requires_dice_roll', 'Yes')
                }

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'phase', 'path_type', 'is_starting_space', 'is_ending_space',
                      'min_players', 'max_players', 'requires_dice_roll']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(configs.values())

    print(f"✓ Created {output_file} with {len(configs)} game config entries")

def process_space_content():
    """Extract SPACE_CONTENT.csv from Spaces.csv"""
    input_file = f'{SOURCE_DIR}/Spaces.csv'
    output_file = f'{OUTPUT_DIR}/SPACE_CONTENT.csv'

    contents = []

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            content = {
                'space_name': row['space_name'],
                'visit_type': row['visit_type'],
                'title': row.get('Event', ''),
                'story': row.get('Event', ''),
                'action_description': row.get('Action', ''),
                'outcome_description': row.get('Outcome', ''),
                'can_negotiate': row.get('Negotiate', 'No')
            }
            contents.append(content)

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'visit_type', 'title', 'story', 'action_description',
                      'outcome_description', 'can_negotiate']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(contents)

    print(f"✓ Created {output_file} with {len(contents)} space content entries")

def process_space_effects():
    """Extract SPACE_EFFECTS.csv from Spaces.csv"""
    input_file = f'{SOURCE_DIR}/Spaces.csv'
    output_file = f'{OUTPUT_DIR}/SPACE_EFFECTS.csv'

    effects = []

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_name = row['space_name']
            visit_type = row['visit_type']

            # Card effects (manual trigger) - check all card type columns
            card_types = {
                'w_card': 'W',
                'b_card': 'B',
                'i_card': 'I',
                'l_card': 'L',
                'e_card': 'E'
            }

            for col_name, card_letter in card_types.items():
                card_value = row.get(col_name, '').strip()
                if card_value:
                    # Determine trigger_type based on space and card type
                    trigger_type = 'manual'  # Default to manual

                    # OWNER-FUND-INITIATION: B and I cards are automatic (owner's seed money)
                    if space_name == 'OWNER-FUND-INITIATION' and card_letter in ['B', 'I']:
                        trigger_type = 'auto'

                    # PM-DECISION-CHECK: L cards are automatic (life surprises from dice)
                    # They have dice conditions like "Draw 1 if you roll a 1"
                    elif space_name == 'PM-DECISION-CHECK' and card_letter == 'L':
                        trigger_type = 'auto'

                    effects.append({
                        'space_name': space_name,
                        'visit_type': visit_type,
                        'effect_type': 'cards',
                        'effect_action': f'draw_{card_letter}',
                        'effect_value': card_value,
                        'condition': '',
                        'description': f'{card_value} {card_letter} cards',
                        'trigger_type': trigger_type
                    })

            # Time effect
            time_value = row.get('Time', '').strip()
            if time_value:
                # Parse time value (e.g., "5 days", "50 days")
                time_str = time_value.lower().replace('days', '').replace('day', '').strip()
                if time_str:
                    try:
                        time_num = int(time_str)
                        effects.append({
                            'space_name': space_name,
                            'visit_type': visit_type,
                            'effect_type': 'time',
                            'effect_action': 'add',
                            'effect_value': time_num,
                            'condition': '',
                            'description': f'Spend {time_value}',
                            'trigger_type': 'auto'
                        })
                    except ValueError:
                        pass

            # Fee effect
            fee_value = row.get('Fee', '').strip()
            if fee_value and fee_value not in ['', '0', '0%']:
                effects.append({
                    'space_name': space_name,
                    'visit_type': visit_type,
                    'effect_type': 'fee',
                    'effect_action': 'deduct',
                    'effect_value': fee_value,
                    'condition': '',
                    'description': f'Pay {fee_value} fees',
                    'trigger_type': 'auto'
                })

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'visit_type', 'effect_type', 'effect_action', 'effect_value',
                      'condition', 'description', 'trigger_type']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(effects)

    print(f"✓ Created {output_file} with {len(effects)} space effect entries")

def process_dice_effects():
    """Extract DICE_EFFECTS.csv from DiceRoll Info.csv"""
    dice_file = f'{SOURCE_DIR}/DiceRoll Info.csv'
    output_file = f'{OUTPUT_DIR}/DICE_EFFECTS.csv'

    effects = []

    # Parse dice info CSV (handle BOM)
    with open(dice_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_name = row['space_name']
            die_roll_raw = row['die_roll']  # e.g., "W Cards", "Fees Paid", "E cards"
            visit_type = row['visit_type']

            # Normalize effect_type for the switch statement in EffectFactory.ts
            # "W Cards" -> effect_type='cards', card_type='W'
            # "Fees Paid" -> effect_type='money', card_type=''
            # "Time outcomes" -> effect_type='time', card_type=''
            if 'card' in die_roll_raw.lower():
                effect_type = 'cards'
                card_type = die_roll_raw.split()[0] if ' ' in die_roll_raw else ''
            elif 'fee' in die_roll_raw.lower() or 'paid' in die_roll_raw.lower():
                effect_type = 'money'
                card_type = ''
            elif 'time' in die_roll_raw.lower():
                effect_type = 'time'
                card_type = ''
            else:
                # Keep original for unknown types
                effect_type = die_roll_raw
                card_type = die_roll_raw.split()[0] if ' ' in die_roll_raw else die_roll_raw

            # Create one row per space/visit_type/effect_type combination
            effect_row = {
                'space_name': space_name,
                'visit_type': visit_type,
                'effect_type': effect_type,
                'card_type': card_type,
                'roll_1': row.get('1', ''),
                'roll_2': row.get('2', ''),
                'roll_3': row.get('3', ''),
                'roll_4': row.get('4', ''),
                'roll_5': row.get('5', ''),
                'roll_6': row.get('6', '')
            }
            effects.append(effect_row)

    # Write output
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['space_name', 'visit_type', 'effect_type', 'card_type',
                      'roll_1', 'roll_2', 'roll_3', 'roll_4', 'roll_5', 'roll_6']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(effects)

    print(f"✓ Created {output_file} with {len(effects)} dice effect entries")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Processing remaining game data files...")
    print(f"Source: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}\n")

    process_game_config()
    process_space_content()
    process_space_effects()
    process_dice_effects()

    print("\n✓ All remaining files processed!")

if __name__ == '__main__':
    main()
