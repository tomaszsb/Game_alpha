/**
 * Tom, 2026-10-22: an expeditor played is spent and so is what it did. A push-back cannot undo an
 * action: the card does not come back, the money does not come back, and the days it saved stay saved.
 * (Before: day 100, Efficiency Boost -> 97, push back -> 110, i.e. the card was gone and its 3 days too.)
 */
import { describe, it, expect, vi } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';

async function playThenPushBack(cardId: string, daysOnClock: number) {
  const s: any = await bootstrapHeadlessServices();
  s.stateService.addPlayer('T');
  const id = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(id);
  s.stateService.startGame();
  s.stateService.updatePlayer({ id, hand: [cardId], currentSpace: 'REG-DOB-PLAN-EXAM', visitType: 'First', timeSpent: daysOnClock, money: 1_000_000 });
  { const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99); try { await s.turnService.startTurn(id); } finally { rng.mockRestore(); } }
  const atStart = s.stateService.getRealPlayerState(id).timeSpent;
  await s.cardService.playCard(id, cardId);
  const result = await s.turnService.tryAgainOnSpace(id);
  const p = s.stateService.getPlayer(id);
  return { atStart, after: p.timeSpent, hand: p.hand, penalty: Number(/(\d+) day/.exec(result.message ?? '')?.[1] ?? 0) };
}

describe('a push-back keeps the days a played expeditor saved', () => {
  it('Efficiency Boost (-3): the card stays spent and its 3 days stay saved', async () => {
    const r = await playThenPushBack('E003', 100);
    expect(r.hand).not.toContain('E003');
    expect(r.after).toBe(r.atStart + r.penalty - 3);
  });

  it('the clock never goes below zero', async () => {
    const r = await playThenPushBack('E003', 0);
    expect(r.after).toBeGreaterThanOrEqual(0);
  });
});
