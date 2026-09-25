// tests/regression/BankReviewDays.test.ts
//
// Bank Review's Time column says "1 day per $200K". Until v3.2.76 it charged a flat
// 1 day on every visit (and on every push-back): the data pipeline kept only the
// leading number of the sentence and threw "per $200K" away. Tom, 2026-09-25: "it
// should charge what it says. Do not change the wording."
//
// This drives the REAL engine on the REAL CSVs (the ghost bootstrap): a loan of an
// exact size is put on the table, then the cost box, End Turn and a push-back must
// all agree on the days. Rounding is up — every $200K STARTED counts.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { getEndTurnCostPreview, getTryAgainCostPreview, getLoanOnTheTable } from '../../src/utils/costPreview';
import type { IServiceContainer } from '../../src/types/ServiceContracts';

const SPACE = 'BANK-FUND-REVIEW';

async function atBankReview(opts: { visit?: 'First' | 'Subsequent'; earlierLoan?: number } = {}) {
  const services = await bootstrapHeadlessServices();
  const { stateService, turnService } = services;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId,
    currentSpace: SPACE,
    visitType: opts.visit ?? 'First',
    visitedSpaces: [SPACE],
    money: 5_000_000,
    // A loan taken on an EARLIER visit lives in the turn-start snapshot, so it is not "on the table".
    loans: opts.earlierLoan
      ? [{ id: 'earlier', principal: opts.earlierLoan, interestRate: 0, startTurn: 1 }]
      : [],
  } as any);
  await turnService.startTurn(playerId);
  return { ...services, playerId, gs: services as unknown as IServiceContainer };
}

/** The bank names its terms: put a loan of exactly this size on the table. */
function draw(s: Awaited<ReturnType<typeof atBankReview>>, amount: number): void {
  s.resourceService.addMoney(s.playerId, amount, 'test', 'bank terms', 'bank');
}

/**
 * The exact step End Turn runs when the player leaves the space (TurnService step
 * 'leaving_effects'). Called on its own because a whole End Turn also ARRIVES at the
 * next space, where a random life event can add days of its own — that would make an
 * exact-days assertion flaky for reasons that have nothing to do with the bank.
 */
async function leave(s: Awaited<ReturnType<typeof atBankReview>>): Promise<number> {
  const p = s.stateService.getPlayer(s.playerId)!;
  const before = p.timeSpent;
  await (s.turnService as any).processLeavingSpaceEffects(s.playerId, SPACE, p.visitType);
  return s.stateService.getPlayer(s.playerId)!.timeSpent - before;
}

const endBox = (s: Awaited<ReturnType<typeof atBankReview>>) =>
  getEndTurnCostPreview(s.gs, SPACE, s.stateService.getPlayer(s.playerId)!.visitType, s.playerId)
    .find((r) => r.key === 'time')?.value;
const backBox = (s: Awaited<ReturnType<typeof atBankReview>>) =>
  getTryAgainCostPreview(s.gs, s.playerId).find((r) => r.key === 'time')?.value;

describe('Bank Review charges "1 day per $200K" (real engine, real data)', () => {
  it('the data says it: both visits carry the per-$200K scaling, the words are untouched', async () => {
    const { dataService } = await bootstrapHeadlessServices();
    for (const visit of ['First', 'Subsequent'] as const) {
      const time = dataService.getSpaceEffects(SPACE, visit).filter((e: any) => e.effect_type === 'time');
      expect(time).toHaveLength(1);
      expect(time[0].condition).toBe('per_200k');
      expect(String(time[0].effect_value)).toBe('1');
      expect(time[0].description).toBe('Spend 1 day per $200K');
    }
  });

  it('before the bank names a loan the boxes say "Varies", not a made-up number', async () => {
    const s = await atBankReview();
    expect(getLoanOnTheTable(s.stateService, s.playerId)).toBe(0);
    expect(endBox(s)).toBe('Varies');
    expect(backBox(s)).toBe('Varies');
  });

  it.each([
    [500_000, 3],     // 2.5 blocks -> a started block counts
    [1_000_000, 5],
    [1_400_000, 7],
    [2_750_000, 14],  // 13.75 -> 14
    [4_000_000, 20],
  ])('a $%i loan: both boxes show +%i days, and End Turn charges exactly that', async (loan, days) => {
    const s = await atBankReview();
    draw(s, loan);
    expect(getLoanOnTheTable(s.stateService, s.playerId)).toBe(loan);
    expect(endBox(s)).toBe(`+${days} days`);
    expect(backBox(s)).toBe(`+${days} days`);
    expect(await leave(s)).toBe(days);
  });

  it('a whole End Turn moves on and charges at least the days the box showed', async () => {
    const s = await atBankReview();
    draw(s, 1_400_000);
    const before = s.stateService.getPlayer(s.playerId)!.timeSpent;
    await s.turnService.endTurnWithMovement(true);
    // (>= : arriving at the next space can add days of its own, at random.)
    expect(s.stateService.getPlayer(s.playerId)!.timeSpent - before).toBeGreaterThanOrEqual(7);
    expect(s.stateService.getPlayer(s.playerId)!.currentSpace).toBe('PM-DECISION-CHECK');
  });

  it('a push-back charges the same days as its box says, and takes the loan back', async () => {
    const s = await atBankReview();
    const moneyBefore = s.stateService.getPlayer(s.playerId)!.money;
    const before = s.stateService.getPlayer(s.playerId)!.timeSpent;
    draw(s, 1_400_000);
    expect(backBox(s)).toBe('+7 days');

    const result = await s.turnService.tryAgainOnSpace(s.playerId);
    expect(result.success).toBe(true);
    const after = s.stateService.getPlayer(s.playerId)!;
    expect(after.timeSpent - before).toBe(7);
    // The loan was on the table, so it is thrown away with the rest of the attempt.
    expect(after.loans ?? []).toHaveLength(0);
    expect(after.money).toBe(moneyBefore);
  });

  it('a loan from an EARLIER visit is not counted again — only the new terms are', async () => {
    const s = await atBankReview({ visit: 'Subsequent', earlierLoan: 1_000_000 });
    expect(getLoanOnTheTable(s.stateService, s.playerId)).toBe(0);
    expect(endBox(s)).toBe('Varies');
    draw(s, 1_500_000);
    expect(getLoanOnTheTable(s.stateService, s.playerId)).toBe(1_500_000);
    expect(endBox(s)).toBe('+8 days'); // 7.5 -> 8, not (1.0M + 1.5M) = 13
    expect(await leave(s)).toBe(8);
  });

  it('leaving without ever drawing a loan still costs the one-block minimum (what the flat 1 charged)', async () => {
    const s = await atBankReview();
    expect(await leave(s)).toBe(1);
  });
});
