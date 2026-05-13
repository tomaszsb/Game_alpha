import { describe, it, expect } from 'vitest';
import {
  getManualEffectButtonStyle,
  formatManualEffectButton,
  formatDiceRollButton,
  formatDiceRollFeedback,
  formatActionFeedback
} from '../../src/utils/buttonFormatting';
import { SpaceEffect, DiceEffect } from '../../src/types/DataTypes';
import { DICE_BUTTON, DICE_FEEDBACK } from '../../src/constants/uiStrings';

describe('buttonFormatting', () => {
  // Mock colors object for styling tests
  const mockColors: any = {
    white: '#ffffff',
    secondary: {
      main: '#666666',
      bg: '#f0f0f0'
    },
    info: {
      main: '#2196f3'
    }
  };

  describe('getManualEffectButtonStyle', () => {
    it('should return enabled button style when not disabled', () => {
      const style = getManualEffectButtonStyle(false, mockColors);

      expect(style).toEqual({
        padding: '4px 8px',
        fontSize: '10px',
        fontWeight: 'bold',
        color: mockColors.white,
        backgroundColor: mockColors.info.main,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        transition: 'all 0.2s ease',
        transform: 'scale(1)',
        opacity: 1,
      });
    });

    it('should return disabled button style when disabled', () => {
      const style = getManualEffectButtonStyle(true, mockColors);

      expect(style).toEqual({
        padding: '4px 8px',
        fontSize: '10px',
        fontWeight: 'bold',
        color: mockColors.secondary.main,
        backgroundColor: mockColors.secondary.bg,
        border: 'none',
        borderRadius: '4px',
        cursor: 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        transition: 'all 0.2s ease',
        transform: 'scale(0.95)',
        opacity: 0.7,
      });
    });
  });

  describe('formatManualEffectButton', () => {
    it('should format card effect button for single card', () => {
      const effect: SpaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_w',
        effect_value: 1,
        condition: '',
        description: 'Draw 1 Work card'
      };

      const result = formatManualEffectButton(effect);
      expect(result).toEqual({
        text: 'Add Work Package',
        icon: '📐'
      });
    });

    it('should format card effect button for multiple cards', () => {
      const effect: SpaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_b',
        effect_value: 3,
        condition: '',
        description: 'Draw 3 Bank cards'
      };

      const result = formatManualEffectButton(effect);
      expect(result).toEqual({
        text: 'Get 3 Bank Loans',
        icon: '💰'
      });
    });

    it('should format turn effect button with description', () => {
      const effect: SpaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'turn',
        effect_action: 'end',
        effect_value: 0,
        condition: '',
        description: 'End your turn'
      };

      const result = formatManualEffectButton(effect);
      expect(result).toEqual({
        text: 'End your turn',
        icon: '⏹️'
      });
    });

    it('should format turn effect button without description', () => {
      const effect: SpaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'turn',
        effect_action: 'end',
        effect_value: 0,
        condition: '',
        description: ''
      };

      const result = formatManualEffectButton(effect);
      expect(result).toEqual({
        text: 'End Turn',
        icon: '⏹️'
      });
    });

    it('should format unknown effect type with fallback', () => {
      const effect: SpaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'unknown' as any,
        effect_action: 'test_action',
        effect_value: 5,
        condition: '',
        description: 'Unknown effect'
      };

      const result = formatManualEffectButton(effect);
      expect(result).toEqual({
        text: 'Unknown effect',
        icon: '⚡'
      });
    });

    it('should format unknown effect type without description', () => {
      const effect: SpaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'money' as any,
        effect_action: 'gain',
        effect_value: 100,
        condition: '',
        description: ''
      };

      const result = formatManualEffectButton(effect);
      expect(result).toEqual({
        text: 'money: gain 100',
        icon: '⚡'
      });
    });
  });

  describe('formatDiceRollButton', () => {
    const mockDiceOutcome = {
      space_name: 'TEST_SPACE',
      visit_type: 'First' as const,
      roll_1: 'SPACE_A',
      roll_2: 'SPACE_B',
      roll_3: 'SPACE_C',
      roll_4: 'SPACE_D',
      roll_5: 'SPACE_E',
      roll_6: 'SPACE_F'
    };

    it('should format button for dice effects with cards', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'W',
        roll_1: 'Draw 1',
        roll_2: 'Draw 2',
        roll_3: 'Draw 3',
        roll_4: 'Draw 4',
        roll_5: 'Draw 5',
        roll_6: 'Draw 6'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.WORK);
    });

    it('should format button for dice effects with money', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'money',
        roll_1: '100',
        roll_2: '200',
        roll_3: '300',
        roll_4: '400',
        roll_5: '500',
        roll_6: '600'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.FUNDING);
    });

    it('should format button for dice effects with fee', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'money',
        card_type: 'fee',
        roll_1: '50',
        roll_2: '100',
        roll_3: '150',
        roll_4: '200',
        roll_5: '250',
        roll_6: '300'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.FEE);
    });

    it('should format button for dice effects with time', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'time',
        roll_1: '1',
        roll_2: '2',
        roll_3: '3',
        roll_4: '4',
        roll_5: '5',
        roll_6: '6'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.TIME);
    });

    it('should format button for dice effects with quality', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'quality',
        roll_1: 'Poor',
        roll_2: 'Fair',
        roll_3: 'Good',
        roll_4: 'Great',
        roll_5: 'Excellent',
        roll_6: 'Perfect'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.QUALITY);
    });

    it('should format button for unknown dice effect type', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'unknown',
        roll_1: 'Effect 1',
        roll_2: 'Effect 2',
        roll_3: 'Effect 3',
        roll_4: 'Effect 4',
        roll_5: 'Effect 5',
        roll_6: 'Effect 6'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.EFFECTS);
    });

    it('should format button for space effects with dice condition for cards', () => {
      const spaceEffects: SpaceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_w',
        effect_value: 2,
        condition: 'dice_roll >= 4',
        description: 'Draw cards on good roll'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', [], spaceEffects, null);
      expect(result).toBe(DICE_BUTTON.BONUS);
    });

    it('should format button for space effects with dice condition for money', () => {
      const spaceEffects: SpaceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 500,
        condition: 'dice_roll == 6',
        description: 'Bonus money on 6'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', [], spaceEffects, null);
      expect(result).toBe(DICE_BUTTON.BONUS_FUNDING);
    });

    it('should format button for space effects with dice condition for other effects', () => {
      const spaceEffects: SpaceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'time',
        effect_action: 'subtract',
        effect_value: 1,
        condition: 'dice_roll <= 2',
        description: 'Time penalty on low roll'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', [], spaceEffects, null);
      expect(result).toBe(DICE_BUTTON.BONUS_EFFECTS);
    });

    it('should format button for movement with multiple destinations', () => {
      const result = formatDiceRollButton('TEST_SPACE', 'First', [], [], mockDiceOutcome);
      expect(result).toBe(DICE_BUTTON.NEXT_STEP);
    });

    it('should format button for movement with single destination', () => {
      const singleDestinationOutcome = {
        space_name: 'TEST_SPACE',
        visit_type: 'First' as const,
        roll_1: 'SPACE_A',
        roll_2: 'SPACE_A',
        roll_3: 'SPACE_A',
        roll_4: 'SPACE_A',
        roll_5: 'SPACE_A',
        roll_6: 'SPACE_A'
      };

      const result = formatDiceRollButton('TEST_SPACE', 'First', [], [], singleDestinationOutcome);
      expect(result).toBe(DICE_BUTTON.OUTCOME);
    });

    it('should return default text when no effects or outcomes', () => {
      const result = formatDiceRollButton('TEST_SPACE', 'First', [], [], null);
      expect(result).toBe(DICE_BUTTON.OUTCOME);
    });

    it('should handle missing card_type in dice effects', () => {
      const diceEffects: DiceEffect[] = [{
        space_name: 'TEST_SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        // card_type is missing
        roll_1: 'Draw 1',
        roll_2: 'Draw 2',
        roll_3: 'Draw 3',
        roll_4: 'Draw 4',
        roll_5: 'Draw 5',
        roll_6: 'Draw 6'
      }];

      const result = formatDiceRollButton('TEST_SPACE', 'First', diceEffects, [], null);
      expect(result).toBe(DICE_BUTTON.EFFECTS);
    });
  });

  describe('formatDiceRollFeedback', () => {
    it('should format feedback with card effects', () => {
      const effects = [{
        type: 'cards',
        cardCount: 2,
        cardType: 'W'
      }];

      const result = formatDiceRollFeedback(4, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(4)} → ${DICE_FEEDBACK.got(2, 'Work Package', 's')}`);
    });

    it('should format feedback with single card effect', () => {
      const effects = [{
        type: 'cards',
        cardCount: 1,
        cardType: 'B'
      }];

      const result = formatDiceRollFeedback(3, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(3)} → ${DICE_FEEDBACK.got(1, 'Bank Loan', '')}`);
    });

    it('should format feedback with positive money effect', () => {
      const effects = [{
        type: 'money',
        value: 500
      }];

      const result = formatDiceRollFeedback(5, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(5)} → ${DICE_FEEDBACK.gained(500)}`);
    });

    it('should format feedback with negative money effect', () => {
      const effects = [{
        type: 'money',
        value: -200
      }];

      const result = formatDiceRollFeedback(2, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(2)} → ${DICE_FEEDBACK.spent(200)}`);
    });

    it('should format feedback with positive time effect', () => {
      const effects = [{
        type: 'time',
        value: 3
      }];

      const result = formatDiceRollFeedback(1, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(1)} → ${DICE_FEEDBACK.timePenalty(3, 'days')}`);
    });

    it('should format feedback with single day time effect', () => {
      const effects = [{
        type: 'time',
        value: 1
      }];

      const result = formatDiceRollFeedback(1, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(1)} → ${DICE_FEEDBACK.timePenalty(1, 'day')}`);
    });

    it('should format feedback with negative time effect', () => {
      const effects = [{
        type: 'time',
        value: -2
      }];

      const result = formatDiceRollFeedback(6, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(6)} → ${DICE_FEEDBACK.timeSaved(2, 'days')}`);
    });

    it('should format feedback with movement effect', () => {
      const effects = [{
        type: 'movement',
        destination: 'BANK-SELECTION'
      }];

      const result = formatDiceRollFeedback(4, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(4)} → ${DICE_FEEDBACK.movedTo('BANK-SELECTION')}`);
    });

    it('should format feedback with multiple effects', () => {
      const effects = [
        { type: 'cards', cardCount: 1, cardType: 'E' },
        { type: 'money', value: 300 },
        { type: 'time', value: -1 }
      ];

      const result = formatDiceRollFeedback(6, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(6)} → ${DICE_FEEDBACK.got(1, 'Expeditor', '')}, ${DICE_FEEDBACK.gained(300)}, ${DICE_FEEDBACK.timeSaved(1, 'day')}`);
    });

    it('should format feedback with unknown effect type', () => {
      const effects = [{
        type: 'unknown',
        description: 'Something happened'
      }];

      const result = formatDiceRollFeedback(3, effects);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(3)} → Something happened`);
    });

    it('should format feedback with no effects', () => {
      const result = formatDiceRollFeedback(2, []);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(2)} ${DICE_FEEDBACK.ON_CURRENT_SPACE}`);
    });

    it('should format feedback with null effects', () => {
      const result = formatDiceRollFeedback(5, null as any);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(5)} ${DICE_FEEDBACK.ON_CURRENT_SPACE}`);
    });

    it('should format feedback with undefined effects', () => {
      const result = formatDiceRollFeedback(1, undefined as any);
      expect(result).toBe(`${DICE_FEEDBACK.prefix(1)} ${DICE_FEEDBACK.ON_CURRENT_SPACE}`);
    });

    it('should handle effects with missing properties gracefully', () => {
      const effects = [
        { type: 'cards' }, // Missing cardCount and cardType
        { type: 'money' }, // Missing value
        { type: 'time' }, // Missing value
        { type: 'movement' }, // Missing destination
        { type: 'unknown' } // Missing description
      ];

      const result = formatDiceRollFeedback(4, effects);
      // Missing cardCount/cardType fall back to 0/'' (safer than literal "undefined")
      expect(result).toBe(`${DICE_FEEDBACK.prefix(4)} → ${DICE_FEEDBACK.got(0, '', 's')}`);
    });

    it('should handle all card types correctly', () => {
      // v2.63.3 voice sweep: getCardTypeName returns friendly singulars
      // that pluralize cleanly with a trailing 's' suffix from DICE_FEEDBACK.got.
      const cardTypes = [
        { cardType: 'W', expected: 'Work Package' },
        { cardType: 'B', expected: 'Bank Loan' },
        { cardType: 'E', expected: 'Expeditor' },
        { cardType: 'L', expected: 'Life Event' },
        { cardType: 'I', expected: 'Investment' },
        { cardType: 'X', expected: 'X' } // Unknown type
      ];

      cardTypes.forEach(({ cardType, expected }) => {
        const effects = [{ type: 'cards', cardCount: 1, cardType }];
        const result = formatDiceRollFeedback(3, effects);
        expect(result).toBe(`${DICE_FEEDBACK.prefix(3)} → ${DICE_FEEDBACK.got(1, expected, '')}`);
      });
    });
  });

  describe('formatActionFeedback', () => {
    it('should format feedback with card effects', () => {
      const effects = [{
        type: 'cards',
        cardCount: 1,
        cardType: 'B'
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Got 1 Bank Loan');
    });

    it('should format feedback with multiple card effects', () => {
      const effects = [{
        type: 'cards',
        cardCount: 2,
        cardType: 'W'
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Got 2 Work Packages');
    });

    it('should format feedback with money effects', () => {
      const effects = [{
        type: 'money',
        value: 1000
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Gained $1,000');
    });

    it('should format feedback with negative money effects', () => {
      const effects = [{
        type: 'money',
        value: -500
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Spent $500');
    });

    it('should format feedback with time effects', () => {
      const effects = [{
        type: 'time',
        value: 2
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Time Penalty: 2 days');
    });

    it('should format feedback with single day time effect', () => {
      const effects = [{
        type: 'time',
        value: 1
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Time Penalty: 1 day');
    });

    it('should format feedback with movement effects', () => {
      const effects = [{
        type: 'movement',
        destination: 'ARCH-ENG-1'
      }];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Moved to ARCH-ENG-1');
    });

    it('should handle multiple effects', () => {
      const effects = [
        { type: 'cards', cardCount: 1, cardType: 'I' },
        { type: 'money', value: 500 }
      ];

      const result = formatActionFeedback(effects);
      expect(result).toBe('Got 1 Investment, Gained $500');
    });

    it('should return default message for no effects', () => {
      const result = formatActionFeedback([]);
      expect(result).toBe(DICE_FEEDBACK.ACTION_COMPLETED);
    });

    it('should handle undefined effects', () => {
      const result = formatActionFeedback(undefined as any);
      expect(result).toBe(DICE_FEEDBACK.ACTION_COMPLETED);
    });
  });
});