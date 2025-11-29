# Expanded Card Structure Analysis

## Current vs Original Comparison

### Current Code2027 (7 columns):
```csv
card_id,card_name,card_type,description,effects_on_play,cost,phase_restriction
```

### Original Code2026 (50 columns):
```csv
card_id,card_type,card_name,description,flavor_text,target,scope,phase_restriction,space_restriction,work_type_restriction,immediate_effect,duration,duration_count,turn_effect,money_cost,money_effect,percentage_effect,time_effect,tick_modifier,dice_trigger,dice_effect,conditional_logic,draw_cards,discard_cards,card_type_filter,movement_effect,space_effect,inspection_effect,player_state_check,game_state_check,stacking_limit,usage_limit,cooldown,combo_requirement,prerequisite,priority,queue_effect,loan_amount,loan_rate,investment_amount,work_cost,activation_timing,chain_effect,nullify_effect,environmental_factor,social_factor,political_factor,rarity,distribution_level
```

## Critical Missing Mechanics

### 1. **Turn Control System** (CRITICAL)
- `turn_effect`: "Skip next turn" (E029, E030, L014)
- `duration`: "Immediate", "Permanent", "Temporary"
- `duration_count`: How many turns effect lasts
- `activation_timing`: "Immediate", "Player Controlled"

**Example Lost Logic:**
- E029: Reduce time by 3 BUT skip next turn
- E030: Skip turn THEN reduce time by 5 
- L014: Skip your next turn (funding delay)

### 2. **Financial Mechanics** (CRITICAL)
- `loan_amount`: B001=500000, B002=600000 (actual loan amounts)
- `loan_rate`: All B cards = 5% (interest rates)
- `investment_amount`: I cards = 4M-12M (investment levels)
- `work_cost`: W cards = actual construction costs
- `money_effect`: Direct money gains/losses
- `percentage_effect`: Percentage-based effects

### 3. **Time & Timing System** (HIGH PRIORITY)
- `tick_modifier`: -3, -5 (time reductions in ticks)
- `time_effect`: Time-based modifications
- `cooldown`: Prevents immediate reuse
- `priority`: Card play order

### 4. **Card Interaction System** (HIGH PRIORITY)
- `draw_cards`: Force card draws
- `discard_cards`: Force discards
- `card_type_filter`: Which card types affected
- `target`: "Self", "All Players", "Choose Player"
- `scope`: "Single", "Multiple"

### 5. **Conditional Logic** (MEDIUM PRIORITY)
- `conditional_logic`: Complex if/then rules
- `dice_trigger`: Triggered by specific dice rolls
- `prerequisite`: Required conditions
- `combo_requirement`: Card combination rules

### 6. **Game State Effects** (MEDIUM PRIORITY)
- `movement_effect`: Force player movement
- `space_effect`: Affect space properties
- `inspection_effect`: Modify inspections
- `player_state_check`: Check player conditions
- `game_state_check`: Check game conditions

## Proposed Expanded Structure (20 Essential Columns)

```csv
card_id,card_name,card_type,description,effects_on_play,cost,phase_restriction,
duration,duration_count,turn_effect,activation_timing,
loan_amount,loan_rate,investment_amount,work_cost,
money_effect,tick_modifier,
draw_cards,discard_cards,target,scope
```

### Priority 1 (Immediate Need):
1. `duration` - "Immediate", "Permanent", "Turns"
2. `duration_count` - Number of turns for temporary effects  
3. `turn_effect` - "Skip next turn", etc.
4. `activation_timing` - "Immediate", "Player Controlled"
5. `loan_amount` - Actual loan amounts for B cards
6. `loan_rate` - Interest rates for B cards
7. `investment_amount` - Investment amounts for I cards
8. `work_cost` - Construction costs for W cards

### Priority 2 (Core Mechanics):
9. `money_effect` - Direct money changes
10. `tick_modifier` - Time reductions/increases
11. `draw_cards` - Force draw effects
12. `discard_cards` - Force discard effects
13. `target` - Who is affected
14. `scope` - Single or multiple targets

### Priority 3 (Advanced Features):
15. `conditional_logic` - If/then rules
16. `dice_trigger` - Dice-activated effects
17. `movement_effect` - Player movement
18. `space_effect` - Space modifications
19. `stacking_limit` - Max copies playable
20. `usage_limit` - Max uses per game

## Examples of Lost Complex Cards

### E029 - Weekend Work (Turn Skip + Time Reduction):
```csv
E029,Weekend Work,E,"Reduce the current filing time by 3 ticks but skip your next turn.",Apply Card,0,Any,Immediate,,Skip next turn,Immediate,,,,,,-3,,,Self,Single
```

### E030 - Time Crunch (Turn Skip + Major Time Reduction):
```csv  
E030,Time Crunch,E,"Skip your next turn. Then reduce your current filing time by 5 ticks.",Apply Card,0,Any,Immediate,,Skip next turn,Immediate,,,,,,-5,,,Self,Single
```

### B001 - Small Business Loan (Loan Amount + Rate):
```csv
B001,Small Business Loan,B,"Low interest loan for initial funding",Apply Loan,0,Any,Permanent,,,,500000,5,,,,,,Self,Single
```

## Impact Assessment

### What Works Now:
- Basic card playing
- Simple cost display  
- Phase restrictions
- Card types (W/B/E/L/I)

### What's Broken/Missing:
- Turn skipping effects (E029, E030, L014)
- Actual loan amounts and rates
- Time tick modifications
- Complex card interactions
- Conditional effects
- Player targeting system

## Recommended Action Plan

1. **Phase 1**: Add 8 essential columns for turn control and financial mechanics
2. **Phase 2**: Add 6 columns for card interactions and targeting  
3. **Phase 3**: Add conditional logic and advanced features

This would restore the core game mechanics while maintaining the clean architecture.