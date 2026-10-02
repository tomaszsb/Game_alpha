// tests/regression/BankPushBackInterest.test.ts
//
// Found 2026-09-30 from the nightly playtest robot (game G-DPED-BH4B): at Bank Review it
// took the bank's terms ("cash now $1.7M"), pushed for a lower rate, and the game ended
// "The project went under" with no money ever spent.
//
// Mechanism (real engine, real data): a B card pays its interest up front the moment it is
// drawn, and Try Again used to keep every outflow ("outflows stick, inflows revert", April
// 2026). So the LOAN was taken back but its INTEREST stayed paid; a player holding less cash
// than that interest was left below zero, Try Again ends the turn, and the turn-commit
// bankruptcy check (v3.2.83) ended the game.
//
// Tom, 2026-09-30: push-back tears up a deal nobody accepted — the money it quoted comes
// back "if no work was done; if work was done there should be some monetary penalty". The
// amount for the work-done spaces (architect / engineer fee reviews) he later set
// (2026-10-02): the quote comes back like any other, and a push-back there charges a
// revision fee of 0.5% of scope instead (`try_again_scope_pct`) — see FeeReviewPushBack.test.ts.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { calculatePushBackMoneyKept } from '../../src/utils/costPreview';

async function atSpaceWithCash(space: string, money: number, visit: 'First' | 'Subsequent' = 'First') {
  const s: any = await bootstrapHeadlessServices();
  const { stateService, turnService, resourceService, dataService } = s;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId, currentSpace: space, visitType: visit, visitedSpaces: [space], money, loans: [],
  } as any);
  await turnService.startTurn(playerId);
  const money$ = () => stateService.getPlayer(playerId)!.money as number;
  return { stateService, turnService, resourceService, dataService, playerId, money$ };
}

describe("Bank Review push-back with little cash (the robot's loss)", () => {
  it("taking the bank's terms and pushing back leaves cash where it was — no interest on a loan that was taken back", async () => {
    const s = await atSpaceWithCash('BANK-FUND-REVIEW', 0);
    await s.turnService.triggerManualEffectWithFeedback(s.playerId, 'cards:draw_B');
    expect(s.stateService.getTurnOutflow(s.playerId).moneySpent).toBeGreaterThan(0); // the interest was charged...
    await s.turnService.tryAgainOnSpace(s.playerId);
    const after = s.stateService.getPlayer(s.playerId)!;
    expect(after.loans ?? []).toHaveLength(0);
    expect(after.money).toBe(0); // ...and came back with the loan
  });

  it('…so pushing back can never end a game as bankruptcy', async () => {
    const s = await atSpaceWithCash('BANK-FUND-REVIEW', 0);
    await s.turnService.triggerManualEffectWithFeedback(s.playerId, 'cards:draw_B');
    await s.turnService.tryAgainOnSpace(s.playerId);
    await s.turnService.endTurnWithMovement(true);
    expect(s.stateService.getGameState().isGameOver).toBe(false);
  });

  it('Try Again is still charged its days', async () => {
    const s = await atSpaceWithCash('BANK-FUND-REVIEW', 0);
    await s.turnService.triggerManualEffectWithFeedback(s.playerId, 'cards:draw_B');
    const r = await s.turnService.tryAgainOnSpace(s.playerId);
    expect(r.success).toBe(true);
    expect(s.stateService.getPlayer(s.playerId)!.timeSpent).toBeGreaterThan(0);
  });
});

describe('every deal nobody accepted gives its quote back on push-back', () => {
  it("Investor Review: the 5% investment fee comes back", async () => {
    const s = await atSpaceWithCash('INVESTOR-FUND-REVIEW', 100_000);
    s.resourceService.recordCost(s.playerId, 'investmentFee', 50_000, '5% investment fee', 'handleAutomaticFunding', true);
    expect(s.money$()).toBe(50_000);
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.money$()).toBe(100_000);
  });

  it("Hire a Builder: the contractor's signing price comes back", async () => {
    const s = await atSpaceWithCash('CON-INITIATION', 100_000);
    s.resourceService.spendMoney(s.playerId, 80_000, 'space:CON-INITIATION', 'Contractor hired', undefined, true);
    expect(s.money$()).toBe(20_000);
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.money$()).toBe(100_000);
  });
});

describe('only the fee-review spaces carry a revision fee', () => {
  it('every other space reads as "no charge — the whole quote comes back"', async () => {
    const { dataService } = await atSpaceWithCash('BANK-FUND-REVIEW', 0);
    for (const space of ['BANK-FUND-REVIEW', 'INVESTOR-FUND-REVIEW', 'CON-INITIATION']) {
      expect(dataService.getSpaceContent(space, 'First')?.try_again_scope_pct).toBeUndefined();
    }
  });
});

describe('money the player chose to spend always stays', () => {
  it("a card played at a no-work space stays paid even though the deal's quote comes back", async () => {
    const s = await atSpaceWithCash('BANK-FUND-REVIEW', 100_000);
    s.resourceService.spendMoney(s.playerId, 10_000, 'card_play', 'Played card: test');
    s.resourceService.spendMoney(s.playerId, 30_000, 'space:BANK-FUND-REVIEW', 'quoted interest', undefined, true);
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.money$()).toBe(90_000);
  });
});

describe('calculatePushBackMoneyKept', () => {
  it('no revision fee: only deliberate spends stay', () => {
    expect(calculatePushBackMoneyKept({ moneySpent: 100, moneyDeliberate: 20 }, {})).toBe(20);
  });
  it('a revision fee is a percent of scope, on top of deliberate spends', () => {
    expect(calculatePushBackMoneyKept({ moneySpent: 100, moneyDeliberate: 20 }, { try_again_scope_pct: 0.5 }, 1_000_000)).toBe(5_020);
  });
  it('the whole quote comes back — even a big one — whatever the ledger says', () => {
    expect(calculatePushBackMoneyKept({ moneySpent: 300_000 }, { try_again_scope_pct: 0.5 }, 1_000_000)).toBe(5_000);
  });
  it('an out-of-range percent is clamped, never a surprise bill; no scope = no fee', () => {
    expect(calculatePushBackMoneyKept({ moneySpent: 0 }, { try_again_scope_pct: 700 }, 100)).toBe(100);
    expect(calculatePushBackMoneyKept({ moneySpent: 0 }, { try_again_scope_pct: -1 }, 100)).toBe(0);
    expect(calculatePushBackMoneyKept({ moneySpent: 0 }, { try_again_scope_pct: 0.5 }, 0)).toBe(0);
  });
});
