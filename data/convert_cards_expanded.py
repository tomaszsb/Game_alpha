#!/usr/bin/env python3
"""
Convert code2026 cards.csv to expanded code2027 format
Preserves critical game mechanics while maintaining clean structure
"""

import csv
import os

def convert_cards_expanded():
    input_file = '/home/user/Code2027/data/code2026_cards_backup.csv'
    output_file = '/home/user/Code2027/public/data/CLEAN_FILES/CARDS_EXPANDED.csv'
    
    print(f"Converting cards with expanded mechanics from {input_file} to {output_file}")
    
    converted_cards = []
    
    with open(input_file, 'r', newline='', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        for row in reader:
            # Basic fields (kept from current structure)
            card_id = row.get('card_id', '')
            card_name = row.get('card_name', '')
            card_type = row.get('card_type', '')
            description = row.get('description', '')
            phase_restriction = row.get('phase_restriction', 'Any')
            effects_on_play = row.get('immediate_effect', 'Apply Effect')
            
            # EXPANDED FIELDS - Critical game mechanics  
            duration = row.get('duration', 'Immediate')
            duration_count = row.get('duration_count', '') or '0'
            
            # turn_effect appears in dice_effect column (column 21)
            turn_effect_from_dice = row.get('dice_effect', '')
            turn_effect = turn_effect_from_dice if 'turn' in turn_effect_from_dice.lower() else ''
            
            activation_timing = row.get('activation_timing', 'Immediate')
            
            # Financial mechanics
            loan_amount = row.get('loan_amount', '0') or '0'
            loan_rate = row.get('loan_rate', '0') or '0'
            investment_amount = row.get('investment_amount', '0') or '0' 
            work_cost = row.get('work_cost', '0') or '0'
            
            # Effect mechanics
            money_effect = row.get('money_effect', '')
            # Try both time_effect and tick_modifier columns (sometimes data is in time_effect)
            tick_modifier_raw = row.get('tick_modifier', '') or row.get('time_effect', '')
            tick_modifier = tick_modifier_raw if tick_modifier_raw and tick_modifier_raw != '' else '0'
            
            # Card interaction mechanics
            draw_cards = row.get('draw_cards', '')
            discard_cards_raw = row.get('discard_cards', '')

            # Parse card type from description if mentioned (e.g., "discard 1 Expeditor card" -> "1 E")
            discard_cards = discard_cards_raw
            if discard_cards_raw and description:
                import re
                # Match patterns like "discard 1 Expeditor card" or "discard 2 Expeditor cards"
                match = re.search(r'discard\s+(\d+)\s+(Expeditor|Work|Benefit|Investment|Law)\s+card', description, re.IGNORECASE)
                if match:
                    count = match.group(1)
                    card_type_name = match.group(2).upper()
                    # Map card type names to letters
                    type_map = {'EXPEDITOR': 'E', 'WORK': 'W', 'BENEFIT': 'B', 'INVESTMENT': 'I', 'LAW': 'L'}
                    card_type_letter = type_map.get(card_type_name, '')
                    if card_type_letter:
                        discard_cards = f"{count} {card_type_letter}"

            target = row.get('target', 'Self')
            scope = row.get('scope', 'Single')
            work_type_restriction = row.get('work_type_restriction', '')
            
            # Determine cost (unified logic)
            cost = 0
            if card_type == 'B' and loan_amount and loan_amount.isdigit():
                cost = int(loan_amount)
            elif card_type == 'I' and investment_amount and investment_amount.isdigit():
                cost = int(investment_amount)
            elif card_type == 'W' and work_cost and work_cost.isdigit():
                cost = int(work_cost)
            elif row.get('money_cost', '0').isdigit():
                cost = int(row.get('money_cost', '0'))
            
            # Create expanded card record
            converted_card = {
                'card_id': card_id,
                'card_name': card_name,
                'card_type': card_type,
                'description': description,
                'effects_on_play': effects_on_play,
                'cost': cost,
                'phase_restriction': phase_restriction,
                
                # Expanded mechanics
                'duration': duration,
                'duration_count': duration_count,
                'turn_effect': turn_effect,
                'activation_timing': activation_timing,
                
                'loan_amount': loan_amount,
                'loan_rate': loan_rate,
                'investment_amount': investment_amount,
                'work_cost': work_cost,
                
                'money_effect': money_effect,
                'tick_modifier': tick_modifier,
                
                'draw_cards': draw_cards,
                'discard_cards': discard_cards,
                'target': target,
                'scope': scope,
                'work_type_restriction': work_type_restriction
            }
            
            converted_cards.append(converted_card)
            
            # Log important cards with complex mechanics
            if turn_effect or int(tick_modifier) != 0 or money_effect:
                mechanics = []
                if turn_effect: mechanics.append(f"turn:{turn_effect}")
                if int(tick_modifier) != 0: mechanics.append(f"tick:{tick_modifier}")
                if money_effect: mechanics.append(f"money:{money_effect}")
                print(f"Complex: {card_type}{card_id[-3:] if len(card_id) >= 3 else card_id} - {' | '.join(mechanics)}")
    
    # Write expanded cards
    with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
        fieldnames = [
            'card_id', 'card_name', 'card_type', 'description', 'effects_on_play', 'cost', 'phase_restriction',
            'duration', 'duration_count', 'turn_effect', 'activation_timing',
            'loan_amount', 'loan_rate', 'investment_amount', 'work_cost',
            'money_effect', 'tick_modifier',
            'draw_cards', 'discard_cards', 'target', 'scope', 'work_type_restriction'
        ]
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for card in converted_cards:
            writer.writerow(card)
    
    print(f"\nExpanded conversion complete!")
    print(f"Converted {len(converted_cards)} cards")
    print(f"Output: {output_file}")
    
    # Count by type
    type_counts = {}
    complex_count = 0
    for card in converted_cards:
        card_type = card['card_type']
        type_counts[card_type] = type_counts.get(card_type, 0) + 1
        
        # Count complex mechanics
        if (card['turn_effect'] or 
            int(card.get('tick_modifier', 0)) != 0 or 
            card['money_effect'] or
            card['draw_cards'] or 
            card['discard_cards']):
            complex_count += 1
    
    print(f"\nCard counts by type:")
    for card_type, count in sorted(type_counts.items()):
        print(f"  {card_type}: {count}")
    
    print(f"\nComplex cards with special mechanics: {complex_count}")
    
    print(f"\nColumn count: {len(fieldnames)} (vs original 7)")

if __name__ == '__main__':
    convert_cards_expanded()