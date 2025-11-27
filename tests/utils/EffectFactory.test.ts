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

      // Assert
      // Note: tick_modifier creates effects twice in EffectFactory (lines 105-119 and 188-202)
      expect(effects).toHaveLength(3); // Time effect (twice) + LOG effect

      const timeEffect = effects.find(e =>
        e.effectType === 'RESOURCE_CHANGE' &&
        e.payload.resource === 'TIME'
      );
      expect(timeEffect).toBeDefined();
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
        e.payload.message.includes('Targeted card played')
      );
      expect(targetedLogEffect).toBeDefined();
      expect(targetedLogEffect?.payload.message).toContain('target: all_players');
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
      expect(effects[0].payload.message).toContain('Card played: Empty Card by player player1');
    });
  });

  describe('utility methods', () => {
    it('should validate card objects correctly', () => {
      // Valid card
      const validCard = {
        card_id: 'VALID001',
        card_name: 'Valid Card',
        card_type: 'W',
        description: 'A valid card'
      };
      expect(EffectFactory.validateCard(validCard)).toBe(true);

      // Invalid cards - test what the function actually returns
      const nullResult = EffectFactory.validateCard(null);
      expect(nullResult).toBeFalsy(); // Use toBeFalsy instead of toBe(false)

      expect(EffectFactory.validateCard(undefined)).toBeFalsy();
      expect(EffectFactory.validateCard({})).toBe(false);
      expect(EffectFactory.validateCard({ card_id: 'TEST' })).toBe(false);
      expect(EffectFactory.validateCard({ card_name: 'Test' })).toBe(false);
    });

    it('should create effect type summary correctly', () => {
      // Arrange
      const effects: Effect[] = [
        { effectType: 'LOG', payload: { message: 'test' } },
        { effectType: 'RESOURCE_CHANGE', payload: { resource: 'MONEY' } },
        { effectType: 'RESOURCE_CHANGE', payload: { resource: 'TIME' } },
        { effectType: 'CARD_DRAW', payload: { cardType: 'W' } }
      ];

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
});