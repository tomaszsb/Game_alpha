import { describe, it, expect } from 'vitest';
import { DiceService } from '../../src/services/DiceService';
import { DiceEffect } from '../../src/types/DataTypes';
import { DiceResultEffect } from '../../src/types/StateTypes';

describe('DiceService', () => {
  let diceService: DiceService;

  beforeEach(() => {
    diceService = new DiceService();
  });

  describe('rollDice', () => {
    it('should return a number between 1 and 6', () => {
      // Roll many times to verify range
      for (let i = 0; i < 100; i++) {
        const roll = diceService.rollDice();
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      }
    });

    it('should return an integer', () => {
      const roll = diceService.rollDice();
      expect(Number.isInteger(roll)).toBe(true);
    });
  });

  describe('getDiceRollEffect', () => {
    const mockDiceEffect: DiceEffect = {
      space_name: 'TEST_SPACE',
      visit_type: 'First',
      effect_type: 'cards',
      roll_1: 'Draw 1',
      roll_2: 'Draw 2',
      roll_3: 'Draw 3',
      roll_4: 'Draw 4',
      roll_5: 'Draw 5',
      roll_6: 'Draw 6'
    };

    it('should return correct effect for each dice roll', () => {
      expect(diceService.getDiceRollEffect(mockDiceEffect, 1)).toBe('Draw 1');
      expect(diceService.getDiceRollEffect(mockDiceEffect, 2)).toBe('Draw 2');
      expect(diceService.getDiceRollEffect(mockDiceEffect, 3)).toBe('Draw 3');
      expect(diceService.getDiceRollEffect(mockDiceEffect, 4)).toBe('Draw 4');
      expect(diceService.getDiceRollEffect(mockDiceEffect, 5)).toBe('Draw 5');
      expect(diceService.getDiceRollEffect(mockDiceEffect, 6)).toBe('Draw 6');
    });

    it('should return undefined for invalid dice roll', () => {
      expect(diceService.getDiceRollEffect(mockDiceEffect, 0)).toBeUndefined();
      expect(diceService.getDiceRollEffect(mockDiceEffect, 7)).toBeUndefined();
      expect(diceService.getDiceRollEffect(mockDiceEffect, -1)).toBeUndefined();
    });
  });

  describe('getDiceRollEffectValue', () => {
    const mockDiceEffect: DiceEffect = {
      space_name: 'TEST_SPACE',
      visit_type: 'First',
      effect_type: 'money',
      roll_1: '100',
      roll_2: '200',
      roll_3: undefined as any,
      roll_4: '400',
      roll_5: '',
      roll_6: '600'
    };

    it('should return effect value for valid rolls', () => {
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 1)).toBe('100');
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 2)).toBe('200');
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 4)).toBe('400');
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 6)).toBe('600');
    });

    it('should return empty string for undefined values', () => {
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 3)).toBe('');
    });

    it('should return empty string for empty values', () => {
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 5)).toBe('');
    });

    it('should return empty string for invalid dice roll', () => {
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 0)).toBe('');
      expect(diceService.getDiceRollEffectValue(mockDiceEffect, 7)).toBe('');
    });
  });

  describe('parseNumericValue', () => {
    it('should parse positive integers from effect strings', () => {
      expect(diceService.parseNumericValue('Draw 3')).toBe(3);
      expect(diceService.parseNumericValue('Gain 100')).toBe(100);
      expect(diceService.parseNumericValue('Add 5 cards')).toBe(5);
    });

    it('should parse negative integers from effect strings', () => {
      expect(diceService.parseNumericValue('Lose -50')).toBe(-50);
      expect(diceService.parseNumericValue('-3 penalty')).toBe(-3);
    });

    it('should handle "many" keyword as 3', () => {
      expect(diceService.parseNumericValue('Draw many cards')).toBe(3);
      expect(diceService.parseNumericValue('Many items')).toBe(3);
    });

    it('should return 0 for strings without numbers', () => {
      expect(diceService.parseNumericValue('No change')).toBe(0);
      expect(diceService.parseNumericValue('')).toBe(0);
    });
  });

  describe('getCardTypeName', () => {
    it('should return full names for known card types', () => {
      expect(diceService.getCardTypeName('W')).toBe('Work');
      expect(diceService.getCardTypeName('B')).toBe('Business');
      expect(diceService.getCardTypeName('E')).toBe('Expeditor');
      expect(diceService.getCardTypeName('L')).toBe('Life Events');
      expect(diceService.getCardTypeName('I')).toBe('Investment');
    });

    it('should return the input for unknown card types', () => {
      expect(diceService.getCardTypeName('X')).toBe('X');
      expect(diceService.getCardTypeName('Unknown')).toBe('Unknown');
    });
  });

  describe('generateEffectSummary', () => {
    it('should return "no special effects" message for empty effects', () => {
      const summary = diceService.generateEffectSummary([], 4);
      expect(summary).toBe('Rolled 4 - No special effects this turn.');
    });

    it('should generate positive summary for money gain', () => {
      const effects: DiceResultEffect[] = [
        { type: 'money', value: 500 }
      ];
      const summary = diceService.generateEffectSummary(effects, 6);
      expect(summary).toContain('Great roll!');
      expect(summary).toContain('gained funding');
    });

    it('should generate negative summary for money loss', () => {
      const effects: DiceResultEffect[] = [
        { type: 'money', value: -200 }
      ];
      const summary = diceService.generateEffectSummary(effects, 1);
      expect(summary).toContain('Challenging turn.');
      expect(summary).toContain('paid costs');
    });

    it('should generate positive summary for cards drawn', () => {
      const effects: DiceResultEffect[] = [
        { type: 'cards', cardCount: 2, cardType: 'W' }
      ];
      const summary = diceService.generateEffectSummary(effects, 5);
      expect(summary).toContain('Great roll!');
      expect(summary).toContain('drew 2 cards');
    });

    it('should use singular "card" for cardCount of 1', () => {
      const effects: DiceResultEffect[] = [
        { type: 'cards', cardCount: 1, cardType: 'E' }
      ];
      const summary = diceService.generateEffectSummary(effects, 3);
      expect(summary).toContain('drew 1 card');
      expect(summary).not.toContain('drew 1 cards');
    });

    it('should generate negative summary for time penalty', () => {
      const effects: DiceResultEffect[] = [
        { type: 'time', value: 3 }
      ];
      const summary = diceService.generateEffectSummary(effects, 2);
      expect(summary).toContain('Challenging turn.');
      expect(summary).toContain('faced delays');
    });

    it('should generate positive summary for time efficiency', () => {
      const effects: DiceResultEffect[] = [
        { type: 'time', value: -2 }
      ];
      const summary = diceService.generateEffectSummary(effects, 6);
      expect(summary).toContain('Great roll!');
      expect(summary).toContain('gained efficiency');
    });

    it('should include choice effect in summary', () => {
      const effects: DiceResultEffect[] = [
        { type: 'choice' }
      ];
      const summary = diceService.generateEffectSummary(effects, 4);
      expect(summary).toContain('must choose next move');
    });

    it('should generate mixed results for positive and negative effects', () => {
      const effects: DiceResultEffect[] = [
        { type: 'money', value: 500 },
        { type: 'time', value: 2 }
      ];
      const summary = diceService.generateEffectSummary(effects, 4);
      expect(summary).toContain('Mixed results.');
      expect(summary).toContain('gained funding');
      expect(summary).toContain('faced delays');
    });

    it('should combine multiple effect descriptions', () => {
      const effects: DiceResultEffect[] = [
        { type: 'cards', cardCount: 1, cardType: 'W' },
        { type: 'money', value: 100 }
      ];
      const summary = diceService.generateEffectSummary(effects, 5);
      expect(summary).toContain('drew 1 card');
      expect(summary).toContain('gained funding');
    });
  });
});
