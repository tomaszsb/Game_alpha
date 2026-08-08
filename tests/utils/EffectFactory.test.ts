import { describe, it, expect, beforeEach } from 'vitest';
import { EffectFactory } from '../../src/utils/EffectFactory';
import { Card } from '../../src/types/DataTypes';
import { Effect } from '../../src/types/EffectTypes';

describe('EffectFactory', () => {
  const mockPlayerId = 'player1';

  describe('createEffectsFromCard', () => {
    it('should create a LOG effect for any card', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'TEST001',
        card_name: 'Test Card',
        card_type: 'W',
        description: 'A simple test card'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(1);
      expect(effects[0]).toEqual({
        effectType: 'LOG',
        payload: {
          action: 'card_play',
          message: 'Card played: Test Card by player player1',
          level: 'INFO',
          source: 'card:TEST001'
        }
      });
    });

    it('should create a RESOURCE_CHANGE effect for a card with a cost', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'COST001',
        card_name: 'Expensive Card',
        card_type: 'B',
        description: 'A card that costs money',
        cost: 100
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(2); // Cost effect + LOG effect

      // Find the RESOURCE_CHANGE effect
      const resourceEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(resourceEffect).toBeDefined();
      expect(resourceEffect).toEqual({
        effectType: 'RESOURCE_CHANGE',
        payload: {
          playerId: mockPlayerId,
          resource: 'MONEY',
          amount: -100,
          source: 'card:COST001',
          reason: 'Expensive Card: Card cost of $100'
        }
      });

      // Verify LOG effect is also present
      const logEffect = effects.find(e => e.effectType === 'LOG');
      expect(logEffect).toBeDefined();
      expect(logEffect?.payload.message).toContain('Card played: Expensive Card by player player1');
    });

    it('should create a CARD_DRAW effect for a card that draws other cards', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'DRAW001',
        card_name: 'Card Draw Test',
        card_type: 'E',
        description: 'A card that draws other cards',
        draw_cards: '2 W'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(3); // CARD_DRAW + RECALCULATE_SCOPE + LOG effects

      // Find the CARD_DRAW effect
      const cardDrawEffect = effects.find(e => e.effectType === 'CARD_DRAW');
      expect(cardDrawEffect).toBeDefined();
      expect(cardDrawEffect).toEqual({
        effectType: 'CARD_DRAW',
        payload: {
          playerId: mockPlayerId,
          cardType: 'W',
          count: 2,
          source: 'card:DRAW001',
          reason: 'Card Draw Test: Draw 2 W cards'
        }
      });

      // Find the RECALCULATE_SCOPE effect (should be present for W cards)
      const scopeEffect = effects.find(e => e.effectType === 'RECALCULATE_SCOPE');
      expect(scopeEffect).toBeDefined();
      expect(scopeEffect).toEqual({
        effectType: 'RECALCULATE_SCOPE',
        payload: {
          playerId: mockPlayerId
        }
      });

      // Verify LOG effect is also present
      const logEffect = effects.find(e => e.effectType === 'LOG');
      expect(logEffect).toBeDefined();
      expect(logEffect?.payload.message).toContain('Card played: Card Draw Test by player player1');
    });

    it('should handle cards with multiple effects', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'MULTI001',
        card_name: 'Multi Effect Card',
        card_type: 'I',
        description: 'A card with multiple effects',
        cost: 50,
        money_effect: '+100',
        draw_cards: '1 B'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(4); // Cost + Money + Card Draw + LOG effects

      // Check cost effect
      const costEffect = effects.find(e =>
        e.effectType === 'RESOURCE_CHANGE' &&
        e.payload.amount === -50
      );
      expect(costEffect).toBeDefined();

      // Check money effect
      const moneyEffect = effects.find(e =>
        e.effectType === 'RESOURCE_CHANGE' &&
        e.payload.amount === 100
      );
      expect(moneyEffect).toBeDefined();

      // Check card draw effect
      const cardDrawEffect = effects.find(e => e.effectType === 'CARD_DRAW');
      expect(cardDrawEffect).toBeDefined();
      expect(cardDrawEffect?.payload.cardType).toBe('B');
      expect(cardDrawEffect?.payload.count).toBe(1);

      // Check LOG effect
      const logEffect = effects.find(e => e.effectType === 'LOG');
      expect(logEffect).toBeDefined();
    });

    it('should handle cards with time effects', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'TIME001',
        card_name: 'Time Effect Card',
        card_type: 'L',
        description: 'A card that modifies time',
        tick_modifier: '+2'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert — exactly ONE time effect + the LOG effect. A duplicated
      // "TIME MODIFIER EFFECTS" block used to emit the tick twice, doubling
      // every timed card played through this factory (fb:c51f9f16 — E013's
      // "+2 days to all players" applied +4). Fixed 2026-07-02.
      expect(effects).toHaveLength(2);

      const timeEffects = effects.filter(e =>
        e.effectType === 'RESOURCE_CHANGE' &&
        e.payload.resource === 'TIME'
      );
      expect(timeEffects).toHaveLength(1);
      const timeEffect = timeEffects[0];
      expect(timeEffect).toEqual({
        effectType: 'RESOURCE_CHANGE',
        payload: {
          playerId: mockPlayerId,
          resource: 'TIME',
          amount: 2,
          source: 'card:TIME001',
          reason: 'Time Effect Card: +2'
        }
      });
    });

    it('should handle E066 special re-roll mechanics', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'E066',
        card_name: 'Investor Pitch Preparation',
        card_type: 'E',
        description: 'Gain 1 extra die throw this turn if you do not like the outcome'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(2); // TURN_CONTROL + LOG effects

      const turnControlEffect = effects.find(e => e.effectType === 'TURN_CONTROL');
      expect(turnControlEffect).toBeDefined();
      expect(turnControlEffect).toEqual({
        effectType: 'TURN_CONTROL',
        payload: {
          action: 'GRANT_REROLL',
          playerId: mockPlayerId,
          source: 'card:E066',
          reason: 'Investor Pitch Preparation: Gain 1 extra die throw this turn if you do not like the outcome'
        }
      });
    });

    it('should handle targeted cards', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'TARGET001',
        card_name: 'Targeted Card',
        card_type: 'L',
        description: 'A card that targets other players',
        target: 'all_players',
        money_effect: '+50'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(3); // Money effect + Targeted LOG + Regular LOG effects

      // Check for targeted card log
      const targetedLogEffect = effects.find(e =>
        e.effectType === 'LOG' &&
        (e.payload as any).message.includes('Targeted card played')
      );
      expect(targetedLogEffect).toBeDefined();
      expect((targetedLogEffect?.payload as any).message).toContain('target: all_players');
    });

    it('should handle cards with no effects gracefully', () => {
      // Arrange
      const mockCard: Card = {
        card_id: 'EMPTY001',
        card_name: 'Empty Card',
        card_type: 'W',
        description: 'A card with no special effects'
      };

      // Act
      const effects = EffectFactory.createEffectsFromCard(mockCard, mockPlayerId);

      // Assert
      expect(effects).toHaveLength(1); // Only LOG effect
      expect(effects[0].effectType).toBe('LOG');
      expect((effects[0].payload as any).message).toContain('Card played: Empty Card by player player1');
    });
  });

  describe('createEffectsFromSpaceEntry - fee effects', () => {
    it('should create FEE_DEDUCTION effect for loan percentage fee', () => {
      // Arrange
      const spaceEffects = [{
        space_name: 'BANK-FUND-REVIEW',
        visit_type: 'First' as const,
        effect_type: 'fee' as const,
        effect_action: 'deduct',
        effect_value: '1% for loan of up to $1.4M or 2% for loan between $1.5M and 2.75M or 3% above 2.75M',
        condition: '',
        description: 'Pay fees'
      }];

      // Act
      const effects = EffectFactory.createEffectsFromSpaceEntry(
        spaceEffects,
        mockPlayerId,
        'BANK-FUND-REVIEW',
        'First',
        undefined,
        'Test Player',
        true // skip logging
      );

      // Assert
      const feeEffect = effects.find(e => e.effectType === 'FEE_DEDUCTION');
      expect(feeEffect).toBeDefined();
      expect(feeEffect?.effectType).toBe('FEE_DEDUCTION');
      expect(feeEffect?.payload.playerId).toBe(mockPlayerId);
      expect(feeEffect?.payload.feeType).toBe('LOAN_PERCENTAGE');
      expect(feeEffect?.payload.feeDescription).toContain('1%');
    });

    it('should create FEE_DEDUCTION effect for fixed percentage fee', () => {
      // Arrange
      const spaceEffects = [{
        space_name: 'INVESTOR-FUND-REVIEW',
        visit_type: 'First' as const,
        effect_type: 'fee' as const,
        effect_action: 'deduct',
        effect_value: '5% of amount borrowed',
        condition: '',
        description: 'Pay investor fees'
      }];

      // Act
      const effects = EffectFactory.createEffectsFromSpaceEntry(
        spaceEffects,
        mockPlayerId,
        'INVESTOR-FUND-REVIEW',
        'First',
        undefined,
        'Test Player',
        true
      );

      // Assert
      const feeEffect = effects.find(e => e.effectType === 'FEE_DEDUCTION');
      expect(feeEffect).toBeDefined();
      expect(feeEffect?.payload.feeType).toBe('LOAN_PERCENTAGE');
      expect(feeEffect?.payload.feeDescription).toBe('5% of amount borrowed');
    });

    it('should create FEE_DEDUCTION effect for dice-based fee', () => {
      // Arrange
      const spaceEffects = [{
        space_name: 'REG-DOB-FEE-REVIEW',
        visit_type: 'Subsequent' as const,
        effect_type: 'fee' as const,
        effect_action: 'deduct',
        effect_value: 'Based on dice roll',
        condition: '',
        description: 'Pay based on dice roll'
      }];

      // Act
      const effects = EffectFactory.createEffectsFromSpaceEntry(
        spaceEffects,
        mockPlayerId,
        'REG-DOB-FEE-REVIEW',
        'Subsequent',
        undefined,
        'Test Player',
        true
      );

      // Assert
      const feeEffect = effects.find(e => e.effectType === 'FEE_DEDUCTION');
      expect(feeEffect).toBeDefined();
      expect(feeEffect?.payload.feeType).toBe('DICE_BASED');
      expect(feeEffect?.payload.feeDescription).toBe('Based on dice roll');
    });
  });

  describe('utility methods', () => {
    it('should create effect type summary correctly', () => {
      // Arrange
      const effects: Effect[] = [
        { effectType: 'LOG', payload: { message: 'test' } },
        { effectType: 'RESOURCE_CHANGE', payload: { resource: 'MONEY' } },
        { effectType: 'RESOURCE_CHANGE', payload: { resource: 'TIME' } },
        { effectType: 'CARD_DRAW', payload: { cardType: 'W' } }
      ] as any;

      // Act
      const summary = EffectFactory.getEffectTypeSummary(effects);

      // Assert
      expect(summary).toEqual({
        LOG: 1,
        RESOURCE_CHANGE: 2,
        CARD_DRAW: 1
      });
    });
  });

  describe('createEffectsFromDiceRoll - design fee percentage effects', () => {
    it('should create RESOURCE_CHANGE with percentageOfScope for percentage money effects', () => {
      // Arrange - Simulating ARCH-FEE-REVIEW dice effect
      const diceEffects = [{
        space_name: 'ARCH-FEE-REVIEW',
        visit_type: 'First' as const,
        effect_type: 'money' as const,
        card_type: '',
        roll_1: '8%',
        roll_2: '8%',
        roll_3: '10%',
        roll_4: '10%',
        roll_5: '12%',
        roll_6: '12%'
      }];

      // Act - Roll a 3 (should get 10%)
      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects,
        mockPlayerId,
        'ARCH-FEE-REVIEW',
        3,
        'Test Player'
      );

      // Assert
      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(moneyEffect).toBeDefined();
      expect(moneyEffect?.payload.resource).toBe('MONEY');
      expect(moneyEffect?.payload.amount).toBe(0); // Amount calculated at runtime
      expect(moneyEffect?.payload.percentageOfScope).toBe(10);
      expect(moneyEffect?.payload.feeCategory).toBe('architectural');
    });

    it('should set engineering fee category for ENG-FEE-REVIEW', () => {
      // Arrange
      const diceEffects = [{
        space_name: 'ENG-FEE-REVIEW',
        visit_type: 'First' as const,
        effect_type: 'money' as const,
        card_type: '',
        roll_1: '2%',
        roll_2: '2%',
        roll_3: '4%',
        roll_4: '4%',
        roll_5: '6%',
        roll_6: '6%'
      }];

      // Act - Roll a 5 (should get 6%)
      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects,
        mockPlayerId,
        'ENG-FEE-REVIEW',
        5,
        'Test Player'
      );

      // Assert
      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(moneyEffect).toBeDefined();
      expect(moneyEffect?.payload.percentageOfScope).toBe(6);
      expect(moneyEffect?.payload.feeCategory).toBe('engineering');
    });

    it('should handle 0% fee (subsequent visit with low roll)', () => {
      // Arrange
      const diceEffects = [{
        space_name: 'ARCH-FEE-REVIEW',
        visit_type: 'Subsequent' as const,
        effect_type: 'money' as const,
        card_type: '',
        roll_1: '0%',
        roll_2: '0%',
        roll_3: '1%',
        roll_4: '1%',
        roll_5: '2%',
        roll_6: '2%'
      }];

      // Act - Roll a 1 (should get 0%)
      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects,
        mockPlayerId,
        'ARCH-FEE-REVIEW',
        1,
        'Test Player'
      );

      // Assert - 0% should not create a RESOURCE_CHANGE effect
      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(moneyEffect).toBeUndefined();
    });

    // fb: 2026-08-08 — CON-INITIATION's Subsequent money row is a construction
    // change-order cost, not an architect/engineer design fee. It doesn't
    // contain "ARCH" in its dice source, so the old name-literal guess
    // silently mislabeled it 'engineering'. The CSV now carries an explicit
    // fee_category column that EffectFactory reads directly.
    it('should set construction fee category for CON-INITIATION when fee_category is present in the CSV row', () => {
      const diceEffects = [{
        space_name: 'CON-INITIATION',
        visit_type: 'Subsequent' as const,
        effect_type: 'money' as const,
        card_type: '',
        roll_1: '0%',
        roll_2: '2%',
        roll_3: '4%',
        roll_4: '6%',
        roll_5: '8%',
        roll_6: '10%',
        fee_category: 'construction'
      }];

      // Roll a 2 -> 2%
      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects,
        mockPlayerId,
        'CON-INITIATION',
        2,
        'Test Player'
      );

      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(moneyEffect).toBeDefined();
      expect(moneyEffect?.payload.percentageOfScope).toBe(2);
      // Not 'engineering' — the pre-fix bug this regression locks in.
      expect(moneyEffect?.payload.feeCategory).toBe('construction');
    });

    it('falls back to the ARCH-substring heuristic when fee_category is absent from the row (backward compat)', () => {
      const diceEffects = [{
        space_name: 'CON-INITIATION',
        visit_type: 'Subsequent' as const,
        effect_type: 'money' as const,
        card_type: '',
        roll_1: '0%',
        roll_2: '2%',
        roll_3: '4%',
        roll_4: '6%',
        roll_5: '8%',
        roll_6: '10%'
        // no fee_category field
      }];

      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects,
        mockPlayerId,
        'CON-INITIATION',
        2,
        'Test Player'
      );

      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      // Documents the pre-fix fallback behavior: without a CSV fee_category,
      // 'dice:CON-INITIATION' doesn't contain "ARCH" so it defaults to
      // 'engineering'. This is why the CSV column had to be added.
      expect(moneyEffect?.payload.feeCategory).toBe('engineering');
    });

    it('should still handle fixed money amounts (non-percentage)', () => {
      // Arrange
      const diceEffects = [{
        space_name: 'SOME-SPACE',
        visit_type: 'First' as const,
        effect_type: 'money' as const,
        card_type: '',
        roll_1: '1000',
        roll_2: '2000',
        roll_3: '3000',
        roll_4: '4000',
        roll_5: '5000',
        roll_6: '6000'
      }];

      // Act - Roll a 4 (should get 4000)
      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects,
        mockPlayerId,
        'SOME-SPACE',
        4,
        'Test Player'
      );

      // Assert
      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(moneyEffect).toBeDefined();
      expect(moneyEffect?.payload.amount).toBe(4000);
      expect(moneyEffect?.payload.percentageOfScope).toBeUndefined();
    });
  });

  describe('createEffectsFromDiceRoll - roll_group support', () => {
    it('should process dice effects with roll_group field (backward compat)', () => {
      // Effects with empty roll_group should work identically to effects without it
      const diceEffects = [
        {
          space_name: 'TEST-SPACE',
          visit_type: 'First' as const,
          effect_type: 'time',
          roll_1: '1 day', roll_2: '2 days', roll_3: '3 days',
          roll_4: '4 days', roll_5: '5 days', roll_6: '6 days',
          roll_group: ''  // empty = default group
        },
        {
          space_name: 'TEST-SPACE',
          visit_type: 'First' as const,
          effect_type: 'Next Step',
          card_type: 'Next',
          roll_1: 'SPACE-A', roll_2: 'SPACE-A', roll_3: 'SPACE-B',
          roll_4: 'SPACE-B', roll_5: 'SPACE-C', roll_6: 'SPACE-C',
          roll_group: ''
        }
      ];

      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects, mockPlayerId, 'TEST-SPACE', 3, 'Test Player'
      );

      // Both effects should use the same dice roll value (3)
      const timeEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME');
      expect(timeEffect).toBeDefined();
      expect((timeEffect?.payload as any).amount).toBe(3);
    });

    it('should process dice effects with roll_group undefined (backward compat)', () => {
      // Effects without roll_group field at all should work
      const diceEffects = [{
        space_name: 'ARCH-FEE-REVIEW',
        visit_type: 'First' as const,
        effect_type: 'money',
        card_type: '',
        roll_1: '8%', roll_2: '8%', roll_3: '10%',
        roll_4: '10%', roll_5: '12%', roll_6: '12%'
        // no roll_group field
      }];

      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects, mockPlayerId, 'ARCH-FEE-REVIEW', 1, 'Test Player'
      );

      const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE');
      expect(moneyEffect).toBeDefined();
      expect(moneyEffect?.payload.percentageOfScope).toBe(8);
    });
  });

  describe('createEffectsFromDiceRoll - CON-INITIATION quality/multiplier (fb:0520fd41)', () => {
    // Pre-fix these rows fell into parseDiceEffect's default branch and emitted
    // no Effect, so the whole contractor mechanic was silently dead even though
    // SpaceEffectService had handlers wired for it.
    it('emits CONTRACTOR_UPDATE for Quality dice rows (capital Q in CSV)', () => {
      const diceEffects = [{
        space_name: 'CON-INITIATION',
        visit_type: 'First' as const,
        effect_type: 'Quality',
        card_type: 'Quality',
        roll_1: 'HIGH', roll_2: 'HIGH', roll_3: 'MED',
        roll_4: 'MED', roll_5: 'LOW', roll_6: 'LOW',
      }];

      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects, mockPlayerId, 'CON-INITIATION', 1, 'Test Player'
      );

      const contractorEffect = effects.find(e => e.effectType === 'CONTRACTOR_UPDATE');
      expect(contractorEffect).toBeDefined();
      expect((contractorEffect?.payload as any).kind).toBe('quality');
      expect((contractorEffect?.payload as any).value).toBe('HIGH');
    });

    it('emits CONTRACTOR_UPDATE for Multiplier dice rows', () => {
      const diceEffects = [{
        space_name: 'CON-INITIATION',
        visit_type: 'First' as const,
        effect_type: 'Multiplier',
        card_type: 'Multiplier',
        roll_1: '1', roll_2: '2', roll_3: '3',
        roll_4: '4', roll_5: '5', roll_6: '6',
      }];

      const effects = EffectFactory.createEffectsFromDiceRoll(
        diceEffects, mockPlayerId, 'CON-INITIATION', 4, 'Test Player'
      );

      const contractorEffect = effects.find(e => e.effectType === 'CONTRACTOR_UPDATE');
      expect(contractorEffect).toBeDefined();
      expect((contractorEffect?.payload as any).kind).toBe('multiplier');
      expect((contractorEffect?.payload as any).value).toBe('4');
    });
  });
});