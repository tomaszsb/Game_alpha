import { describe, it, expect } from 'vitest';
import { getGameOverHeadline, lossTitle } from '../../src/utils/endGameLoss';

const players = [{ id: 'p1', name: 'Sunday' }, { id: 'p2', name: 'Max' }];

describe('getGameOverHeadline — what the shared TV says when the game is over', () => {
  it('a win names the winner (not just whoever is first in the list)', () => {
    expect(getGameOverHeadline({ winner: 'p2' }, players)).toEqual({ kind: 'win', title: 'Max Wins!', playerId: 'p2' });
  });

  it('a loss says so - it must NOT call the losing player a winner (fb:ef974f1c)', () => {
    const h = getGameOverHeadline({ gameEndReason: { type: 'bankruptcy', playerId: 'p1' } }, players);
    expect(h.kind).toBe('loss');
    expect(h.title).toBe('The project went under');
    expect(h.title).not.toMatch(/win/i);
    expect(h.detail).toContain('Sunday');
    expect(h.playerId).toBe('p1');
  });

  it('the design-fee cap has its own headline', () => {
    const h = getGameOverHeadline({ gameEndReason: { type: 'design_fee_cap', playerId: 'p2' } }, players);
    expect(h.title).toBe(lossTitle({ type: 'design_fee_cap', playerId: 'p2' }));
    expect(h.detail).toContain('Max');
  });

  it('no winner and no reason: a plain "Game over", never an invented winner', () => {
    expect(getGameOverHeadline({}, players)).toEqual({ kind: 'over', title: 'Game over' });
  });

  it('a loss for a player who is no longer listed still reads sensibly', () => {
    const h = getGameOverHeadline({ gameEndReason: { type: 'bankruptcy', playerId: 'gone' } }, players);
    expect(h.detail).toContain('The team');
  });
});
