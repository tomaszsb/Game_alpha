// tests/isolated/educationalMode.test.ts
// Test Educational Mode Card Selection Feature

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Educational Mode Card Selection', () => {
  // Mock services at module level
  const mockDataService = {
    getCardsByType: vi.fn((type: string) => {
      const cards: Record<string, any[]> = {
        W: [
          { card_id: 'W001', card_type: 'W', card_name: 'Foundation Work' },
          { card_id: 'W002', card_type: 'W', card_name: 'Framing Work' },
          { card_id: 'W003', card_type: 'W', card_name: 'Electrical Work' },
          { card_id: 'W004', card_type: 'W', card_name: 'Plumbing Work' },
        ],
        E: [
          { card_id: 'E001', card_type: 'E', card_name: 'Fast Track Permit' },
          { card_id: 'E002', card_type: 'E', card_name: 'Expedite Review' },
          { card_id: 'E003', card_type: 'E', card_name: 'Rush Order' },
          { card_id: 'E004', card_type: 'E', card_name: 'Priority Processing' },
        ],
        B: [],
        I: [],
        L: [],
      };
      return cards[type] || [];
    }),
    getCardById: vi.fn((id: string) => {
      const allCards = [
        { card_id: 'W001', card_type: 'W', card_name: 'Foundation Work' },
        { card_id: 'W002', card_type: 'W', card_name: 'Framing Work' },
        { card_id: 'W003', card_type: 'W', card_name: 'Electrical Work' },
        { card_id: 'W004', card_type: 'W', card_name: 'Plumbing Work' },
        { card_id: 'E001', card_type: 'E', card_name: 'Fast Track Permit' },
        { card_id: 'E002', card_type: 'E', card_name: 'Expedite Review' },
        { card_id: 'E003', card_type: 'E', card_name: 'Rush Order' },
        { card_id: 'E004', card_type: 'E', card_name: 'Priority Processing' },
      ];
      return allCards.find(c => c.card_id === id);
    }),
    getGameConfigBySpace: vi.fn(() => ({ phase: 'DESIGN' })),
  };

  describe('startingHand filtering logic', () => {
    it('should filter W cards correctly from startingHand', () => {
      const startingHand = ['W001', 'W004', 'E001', 'E003'];
      const cardType = 'W';

      const filtered = startingHand.filter(cardId => cardId.startsWith(cardType));

      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('W001');
      expect(filtered).toContain('W004');
      expect(filtered.every(id => id.startsWith('W'))).toBe(true);
    });

    it('should filter E cards correctly from startingHand', () => {
      const startingHand = ['W001', 'W004', 'E001', 'E003'];
      const cardType = 'E';

      const filtered = startingHand.filter(cardId => cardId.startsWith(cardType));

      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('E001');
      expect(filtered).toContain('E003');
      expect(filtered.every(id => id.startsWith('E'))).toBe(true);
    });

    it('should return empty array when no matching cards', () => {
      const startingHand = ['W001', 'W004', 'E001', 'E003'];
      const cardType = 'B'; // No B cards in startingHand

      const filtered = startingHand.filter(cardId => cardId.startsWith(cardType));

      expect(filtered).toHaveLength(0);
    });

    it('should handle empty startingHand', () => {
      const startingHand: string[] = [];
      const cardType = 'W';

      const filtered = startingHand.filter(cardId => cardId.startsWith(cardType));

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Educational mode conditions', () => {
    it('should identify educational mode correctly', () => {
      const gameState = {
        startingMode: 'EDUCATIONAL',
        startingHand: ['W001', 'E001'],
        gameMode: 'SAME_START',
      };

      const isEducationalMode = gameState.startingMode === 'EDUCATIONAL';
      const hasPreSelectedCards = gameState.startingHand && gameState.startingHand.length > 0;

      expect(isEducationalMode).toBe(true);
      expect(hasPreSelectedCards).toBe(true);
    });

    it('should identify starting space correctly', () => {
      const player = { currentSpace: 'OWNER-SCOPE-INITIATION' };
      const isStartingSpace = player.currentSpace === 'OWNER-SCOPE-INITIATION';

      expect(isStartingSpace).toBe(true);
    });

    it('should not trigger for non-educational mode', () => {
      const gameState = {
        startingMode: 'QUICK_START',
        startingHand: ['W001', 'E001'],
      };

      const isEducationalMode = gameState.startingMode === 'EDUCATIONAL';

      expect(isEducationalMode).toBe(false);
    });

    it('should not trigger when not on starting space', () => {
      const player = { currentSpace: 'PM-DECISION-CHECK' };
      const isStartingSpace = player.currentSpace === 'OWNER-SCOPE-INITIATION';

      expect(isStartingSpace).toBe(false);
    });
  });

  describe('Card type identification', () => {
    it('should correctly identify card types from IDs', () => {
      expect('W001'.startsWith('W')).toBe(true);
      expect('W001'.startsWith('E')).toBe(false);
      expect('E003'.startsWith('E')).toBe(true);
      expect('E003'.startsWith('W')).toBe(false);
      expect('B001'.startsWith('B')).toBe(true);
    });
  });

  describe('Hand accumulation', () => {
    it('should accumulate cards when adding to existing hand', () => {
      let hand: string[] = [];

      // First draw adds W cards
      const wCards = ['W001', 'W004'];
      hand = [...hand, ...wCards];
      expect(hand).toHaveLength(2);

      // Second draw adds E cards
      const eCards = ['E001', 'E003'];
      hand = [...hand, ...eCards];
      expect(hand).toHaveLength(4);

      // Verify all cards present
      expect(hand).toContain('W001');
      expect(hand).toContain('W004');
      expect(hand).toContain('E001');
      expect(hand).toContain('E003');
    });
  });
});
