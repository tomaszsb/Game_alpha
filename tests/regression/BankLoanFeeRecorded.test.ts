// The bank's up-front loan fee must show in the player's paid list.
//
// Found 2026-10-12 (Tom's live game, v3.7.15): the Money pop-up said "Funding raised $2.5M, Spent so far
// $0, Nothing paid yet" while cash was ~$228K lower than raised - the bank's interest comes off the loan
// the moment it is drawn, as a bare spend that never wrote a cost record. Same engine path as
// BankPushBackInterest.test.ts, now checking the record, not only the cash.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

async function atBank(money: number) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService, turnService } = s;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId, currentSpace: 'BANK-FUND-REVIEW', visitType: 'First', visitedSpaces: ['BANK-FUND-REVIEW'], money, loans: [],
  } as any);
  await turnService.startTurn(playerId);
  return { stateService, turnService, playerId };
}

describe('the bank loan fee is a recorded payment', () => {
  it('lands in the paid list (not in the project-spending buckets), and cash reconciles with it', async () => {
    const s = await atBank(1_000_000);
    await s.turnService.triggerManualEffectWithFeedback(s.playerId, 'cards:draw_B');
    const p = s.stateService.getPlayer(s.playerId)!;
    const fee = (p.costHistory ?? []).filter((c: any) => c.category === 'loanFee');
    expect(fee).toHaveLength(1);
    expect(fee[0].amount).toBeGreaterThan(0);
    // Financing, not project spending: it must not inflate "Regulatory & filings" (expenditures.fees).
    expect(p.expenditures?.fees ?? 0).toBe(0);
    expect(p.costs?.loanFee).toBe(fee[0].amount);
    // Cash = start + loan raised - the recorded fee.
    const raised = (p.moneySources?.bankLoans ?? 0);
    expect(p.money).toBe(1_000_000 + raised - fee[0].amount);
  });

  it('a push-back takes the loan back, and the fee record goes with it', async () => {
    const s = await atBank(1_000_000);
    await s.turnService.triggerManualEffectWithFeedback(s.playerId, 'cards:draw_B');
    await s.turnService.tryAgainOnSpace(s.playerId);
    const p = s.stateService.getPlayer(s.playerId)!;
    expect((p.costHistory ?? []).filter((c: any) => c.category === 'loanFee')).toHaveLength(0);
    expect(p.money).toBe(1_000_000);
  });
});
