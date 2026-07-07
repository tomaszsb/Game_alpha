import { describe, it, expect } from 'vitest';
import { getCardTypeName, getCardDisplayTitle, getCardEffectSummary } from '../../src/utils/cardTypeNames';
import { Card } from '../../src/types/DataTypes';

const baseCard = (overrides: Partial<Card>): Card => ({
  card_id: 'X001',
  card_name: 'Test Card',
  card_type: 'W',
  description: 'A test card',
  ...overrides,
} as Card);

describe('cardTypeNames', () => {
  describe('getCardTypeName', () => {
    it('should pluralize when count > 1', () => {
      expect(getCardTypeName('W', 1)).not.toContain('undefined');
      expect(getCardTypeName('W', 2).endsWith('s')).toBe(true);
    });
  });

  describe('getCardDisplayTitle', () => {
    it('should return the trade for a Work Package card', () => {
      // fb:995028c7 — all 176 W cards have card_name authored identical to
      // description; the trade is the real short title.
      const card = baseCard({
        card_type: 'W',
        card_name: 'Lobby renovation and security upgrade',
        description: 'Lobby renovation and security upgrade',
        work_type_restriction: 'General Construction',
      });
      expect(getCardDisplayTitle(card)).toBe('General Construction');
    });

    it('should fall back to card_name for a W card with no work_type_restriction', () => {
      const card = baseCard({ card_type: 'W', card_name: 'Untyped work', work_type_restriction: undefined });
      expect(getCardDisplayTitle(card)).toBe('Untyped work');
    });

    it('should return card_name unchanged for non-W card types', () => {
      const card = baseCard({ card_type: 'E', card_name: 'Return to Sender' });
      expect(getCardDisplayTitle(card)).toBe('Return to Sender');
    });
  });

  describe('getCardEffectSummary', () => {
    it('should summarize a day-saving expeditor as a negative day count', () => {
      // fb:17cc481c — "maybe activate can say + or - x days instead of Activate?"
      const card = baseCard({ card_type: 'E', tick_modifier: '-4' });
      expect(getCardEffectSummary(card)).toBe('-4 days');
    });

    it('should summarize a day-adding effect as a positive day count', () => {
      const card = baseCard({ card_type: 'L', tick_modifier: '3' });
      expect(getCardEffectSummary(card)).toBe('+3 days');
    });

    it('should combine days and cost when both are present', () => {
      const card = baseCard({ card_type: 'E', tick_modifier: '-4', cost: 500 });
      expect(getCardEffectSummary(card)).toBe('-4 days · -$500');
    });

    it('should show income as a positive dollar amount via money_effect when there is no cost', () => {
      const card = baseCard({ card_type: 'B', money_effect: '50000' });
      expect(getCardEffectSummary(card)).toBe('+$50,000');
    });

    it('should show a spend as a negative dollar amount via money_effect', () => {
      const card = baseCard({ card_type: 'E', money_effect: '-500' });
      expect(getCardEffectSummary(card)).toBe('-$500');
    });

    it('should return null when the card has no numeric time/money effect', () => {
      const card = baseCard({ card_type: 'E', tick_modifier: '0', money_effect: '0' });
      expect(getCardEffectSummary(card)).toBeNull();
    });
  });
});
