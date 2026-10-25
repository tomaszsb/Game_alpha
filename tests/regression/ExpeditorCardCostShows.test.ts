// "I just spent 8000 by using an expeditor ... did not see it on the detail page" (Farmingdale class,
// fb:f3b3cbb7 / 0ed31c3c, 2026-10-19). An expeditor card's money cost dropped the cash but was not
// counted as spending, so the Money page ("Spent so far", "Regulatory & filings") never showed it.
import { describe, it, expect, vi } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

async function play(cardId: string) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService, turnService } = s;
  stateService.addPlayer('Test');
  const id = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(id);
  stateService.startGame();
  stateService.updatePlayer({ id, currentSpace: 'REG-DOB-PLAN-EXAM', visitType: 'First', visitedSpaces: ['REG-DOB-PLAN-EXAM'], money: 1_000_000, hand: [cardId] } as any);
  { const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99); try { await turnService.startTurn(id); } finally { rng.mockRestore(); } }
  await s.cardService.playCard(id, cardId);
  return stateService.getPlayer(id);
}

describe('expeditor card costs are counted as spending', () => {
  it('Time Crunch (-$8,000, -5 days) lands in the fees spent and the paid list', async () => {
    const p = await play('E030');
    expect(p.money).toBe(992_000);
    expect(p.expenditures.fees).toBe(8_000);
    expect(p.costs?.expeditor).toBe(8_000);
  });
  it('a smaller expeditor card (Double Check, -$1,000) is counted too', async () => {
    const p = await play('E017');
    expect(p.expenditures.fees).toBe(1_000);
    expect(p.costs?.expeditor).toBe(1_000);
  });
});
