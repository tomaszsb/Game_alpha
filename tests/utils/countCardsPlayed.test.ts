import { describe, it, expect } from 'vitest';
import { countCardsPlayed } from '../../src/utils/endGameStats';

describe('countCardsPlayed', () => {
  it('counts only this player\'s committed plays of that card type', () => {
    const log = [
      { type: 'card_play', playerId: 'p1', isCommitted: true, details: { cardId: 'E012_1_x' } },
      { type: 'card_play', playerId: 'p1', isCommitted: true, details: { cardId: 'E040' } },
      { type: 'card_play', playerId: 'p1', isCommitted: false, details: { cardId: 'E041' } }, // undone by a push-back
      { type: 'card_play', playerId: 'p2', isCommitted: true, details: { cardId: 'E050' } },
      { type: 'card_play', playerId: 'p1', isCommitted: true, details: { cardId: 'L003' } },
      { type: 'card_draw', playerId: 'p1', isCommitted: true, details: { cardId: 'E060' } },
    ];
    expect(countCardsPlayed(log, 'p1', 'E')).toBe(2);
  });
});
