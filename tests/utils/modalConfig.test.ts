import { describe, it, expect } from 'vitest';
import { shouldShake, getTtsText } from '../../src/utils/modalConfig';
import { SpaceContent } from '../../src/types/DataTypes';
import { DiceResultEffect } from '../../src/types/StateTypes';

describe('modalConfig', () => {
  describe('shouldShake', () => {
    it('should return false when shakeOn is empty or undefined', () => {
      expect(shouldShake('')).toBe(false);
      expect(shouldShake(undefined)).toBe(false);
    });

    it('should return true when shakeOn is "always"', () => {
      expect(shouldShake('always')).toBe(true);
      expect(shouldShake('always', {})).toBe(true);
    });

    it('should return true for "negative" with L-card effect', () => {
      const effects: DiceResultEffect[] = [
        { type: 'cards', description: 'Draw L card', cardType: 'L', cardCount: 1 }
      ];
      expect(shouldShake('negative', { effects })).toBe(true);
    });

    it('should return true for "negative" with money loss', () => {
      const effects: DiceResultEffect[] = [
        { type: 'money', description: 'Lost money', value: -500 }
      ];
      expect(shouldShake('negative', { effects })).toBe(true);
    });

    it('should return true for "negative" with time loss', () => {
      const effects: DiceResultEffect[] = [
        { type: 'time', description: 'Time added', value: 3 }
      ];
      expect(shouldShake('negative', { effects })).toBe(true);
    });

    it('should return true for "negative" with card removal', () => {
      const effects: DiceResultEffect[] = [
        { type: 'cards', description: 'Remove card', cardAction: 'remove', cardCount: 1 }
      ];
      expect(shouldShake('negative', { effects })).toBe(true);
    });

    it('should return false for "negative" with positive effects', () => {
      const effects: DiceResultEffect[] = [
        { type: 'money', description: 'Gained money', value: 1000 },
        { type: 'cards', description: 'Draw W card', cardType: 'W', cardCount: 1, cardAction: 'draw' }
      ];
      expect(shouldShake('negative', { effects })).toBe(false);
    });

    it('should return false for "negative" with no effects', () => {
      expect(shouldShake('negative', { effects: [] })).toBe(false);
    });

    it('should return true for "negative" with L-card type (CardModal)', () => {
      expect(shouldShake('negative', { cardType: 'L' })).toBe(true);
    });

    it('should return false for "negative" with non-L card type', () => {
      expect(shouldShake('negative', { cardType: 'W' })).toBe(false);
      expect(shouldShake('negative', { cardType: 'B' })).toBe(false);
    });

    it('should return false for unknown shakeOn value', () => {
      expect(shouldShake('unknown')).toBe(false);
    });
  });

  describe('getTtsText', () => {
    const mockContent: SpaceContent = {
      space_name: 'TEST-SPACE',
      visit_type: 'First',
      title: 'Test Space',
      story: 'Once upon a time...',
      action_description: 'Do the thing',
      outcome_description: 'The thing was done',
      can_negotiate: false,
      end_turn_label: 'End Turn',
      try_again_label: 'Try Again'
    };

    it('should return undefined when ttsField is empty or undefined', () => {
      expect(getTtsText('', mockContent)).toBeUndefined();
      expect(getTtsText(undefined, mockContent)).toBeUndefined();
    });

    it('should return story text for "story" field', () => {
      expect(getTtsText('story', mockContent)).toBe('Once upon a time...');
    });

    it('should return action text for "action" field', () => {
      expect(getTtsText('action', mockContent)).toBe('Do the thing');
    });

    it('should return outcome text for "outcome" field', () => {
      expect(getTtsText('outcome', mockContent)).toBe('The thing was done');
    });

    it('should return fallback summary for "summary" field', () => {
      expect(getTtsText('summary', mockContent, 'Dice result summary')).toBe('Dice result summary');
    });

    it('should return undefined for "summary" without fallback', () => {
      expect(getTtsText('summary', mockContent)).toBeUndefined();
    });

    it('should return undefined for unknown field name', () => {
      expect(getTtsText('unknown', mockContent)).toBeUndefined();
    });

    it('should handle null/undefined content gracefully', () => {
      expect(getTtsText('story', null)).toBeUndefined();
      expect(getTtsText('story', undefined)).toBeUndefined();
    });

    it('should return undefined when content field is empty', () => {
      const emptyContent = { ...mockContent, story: '' };
      expect(getTtsText('story', emptyContent)).toBeUndefined();
    });
  });
});
