#!/usr/bin/env python3
"""
Convert code2026 cards.csv to code2027 format
Maps complex 50-column format to simplified 7-column format
"""

import csv
import os

def convert_cards():
    input_file = '/mnt/d/unravel/current_game/code2027/data/code2026_cards_backup.csv'
    output_file = '/mnt/d/unravel/current_game/code2027/public/data/CLEAN_FILES/CARDS_FULL.csv'
    
    print(f"Converting cards from {input_file} to {output_file}")
    
    converted_cards = []
    
    with open(input_file, 'r', newline='', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        for row in reader:
            # Extract basic info
            card_id = row.get('card_id', '')
            card_name = row.get('card_name', '')
            card_type = row.get('card_type', '')
            description = row.get('description', '')
            phase_restriction = row.get('phase_restriction', 'Any')
            
            # Determine cost based on card type
            cost = 0
            if card_type == 'B':  # Bank loans
                loan_amount = row.get('loan_amount', '0')
                if loan_amount and loan_amount.isdigit():
                    cost = int(loan_amount)
            elif card_type == 'I':  # Investor loans  
                investment_amount = row.get('investment_amount', '0')
                if investment_amount and investment_amount.isdigit():
                    cost = int(investment_amount)
            elif card_type == 'W':  # Work cards
                work_cost = row.get('work_cost', '0')
                if work_cost and work_cost.isdigit():
                    cost = int(work_cost)
                # If no work_cost, try to extract from description
                elif 'cost:' in description.lower() or '$' in description:
                    # Try to extract cost from description
                    import re
                    cost_match = re.search(r'\$([0-9,]+)', description)
                    if cost_match:
                        cost_str = cost_match.group(1).replace(',', '')
                        if cost_str.isdigit():
                            cost = int(cost_str)
            
            # Determine effects_on_play based on card type and data
            effects_on_play = 'Apply Effect'
            if card_type == 'W':
                effects_on_play = 'Apply Work'
            elif card_type == 'B':
                effects_on_play = 'Apply Loan'
            elif card_type == 'I':
                effects_on_play = 'Apply Investment'
            elif card_type == 'E':
                effects_on_play = 'Apply Equipment'
            elif card_type == 'L':
                effects_on_play = 'Apply Legal'
            
            # Create converted card
            converted_card = {
                'card_id': card_id,
                'card_name': card_name,
                'card_type': card_type,
                'description': description,
                'effects_on_play': effects_on_play,
                'cost': cost,
                'phase_restriction': phase_restriction
            }
            
            converted_cards.append(converted_card)
            print(f"Converted {card_type}{card_id[-3:] if len(card_id) >= 3 else card_id}: {card_name[:50]}{'...' if len(card_name) > 50 else ''}")
    
    # Write converted cards
    with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
        fieldnames = ['card_id', 'card_name', 'card_type', 'description', 'effects_on_play', 'cost', 'phase_restriction']
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for card in converted_cards:
            writer.writerow(card)
    
    print(f"\nConversion complete!")
    print(f"Converted {len(converted_cards)} cards")
    print(f"Output written to: {output_file}")
    
    # Count by type
    type_counts = {}
    for card in converted_cards:
        card_type = card['card_type']
        type_counts[card_type] = type_counts.get(card_type, 0) + 1
    
    print("\nCard counts by type:")
    for card_type, count in sorted(type_counts.items()):
        print(f"  {card_type}: {count}")

if __name__ == '__main__':
    convert_cards()