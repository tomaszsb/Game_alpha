// tests/regression/FeeReviewPushBack.test.ts
//
// Tom, 2026-10-02 (fb:adb1cc76 — an engineer's fee quote ended a game as bankruptcy):
//   - a fee quote is not real money until the player ends the turn;
//   - pushing back at an architect/engineer fee review is a REVISION: the quote comes
//     back, and the player pays 0.5% of scope (`try_again_scope_pct`) plus a few days (5);
//   - that revision fee is NOT a design fee — it never counts toward the 20% cap;
//   - the 20% design-fee game-over waits for End Turn (like bankruptcy), not the roll.
// Real engine, real data; scope is pinned so the numbers are exact.

import { describe, it, expect, vi } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

const SCOPE = 4_000_000;

async function atFeeReview(space: 'ARCH-FEE-REVIEW' | 'ENG-FEE-REVIEW', visit: 'First' | 'Subsequent', money: number) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService, turnService, resourceService, gameRulesService } = s;
  vi.spyOn(gameRulesService, 'calculateProjectScope').mockReturnValue(SCOPE);
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId, currentSpace: space, visitType: visit, visitedSpaces: [space], money, loans: [],
    expenditures: { design: 0, fees: 0, construction: 0 },
  } as any);
  await turnService.startTurn(playerId);
  const player = () => stateService.getPlayer(playerId)!;
  return { stateService, turnService, resourceService, playerId, player };
}

describe.each([
  ['ARCH-FEE-REVIEW', 'First'],
  ['ARCH-FEE-REVIEW', 'Subsequent'],
  ['ENG-FEE-REVIEW', 'First'],
  ['ENG-FEE-REVIEW', 'Subsequent'],
] as const)('%s (%s) push-back is a revision', (space, visit) => {
  it('the quote comes back; the player pays 0.5% of scope and 5 days', async () => {
    const s = await atFeeReview(space, visit, 500_000);
    s.resourceService.spendMoney(s.playerId, 300_000, `space:${space}`, 'Design fee quote', undefined, true);
    expect(s.player().money).toBe(200_000); // the quote is on the table...
    const r = await s.turnService.tryAgainOnSpace(s.playerId);
    expect(r.success).toBe(true);
    expect(s.player().money).toBe(500_000 - 20_000); // ...gone; only 0.5% of $4M stays
    expect(s.player().timeSpent).toBe(5);
  });

  it('a quote the player cannot afford cannot bankrupt them by pushing back', async () => {
    const s = await atFeeReview(space, visit, 30_000);
    s.resourceService.spendMoney(s.playerId, 250_000, `space:${space}`, 'Design fee quote', undefined, true);
    expect(s.player().money).toBeLessThan(0);
    await s.turnService.tryAgainOnSpace(s.playerId);
    await s.turnService.endTurnWithMovement(true);
    // $30k cash, $20k revision fee: still solvent, game not over.
    expect(s.stateService.getGameState().isGameOver).toBe(false);
    expect(s.player().money).toBe(10_000);
  });
});

describe('the revision fee is not a design fee', () => {
  it('a push-back leaves the 20% tally exactly where it was', async () => {
    const s = await atFeeReview('ENG-FEE-REVIEW', 'First', 500_000);
    s.stateService.updateTempState(s.playerId, { expenditures: { design: 100_000, fees: 0, construction: 0 } });
    s.stateService.applyToRealState(s.playerId, { expenditures: { design: 100_000, fees: 0, construction: 0 } } as any);
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.player().expenditures?.design).toBe(100_000);
  });
});

describe('the 20% design-fee cap waits for End Turn', () => {
  it('fees past 20% do not end the game at the roll — only when the turn is committed', async () => {
    const s = await atFeeReview('ENG-FEE-REVIEW', 'First', 5_000_000);
    s.stateService.updateTempState(s.playerId, { expenditures: { design: SCOPE * 0.25, fees: 0, construction: 0 } });
    expect(s.stateService.getGameState().isGameOver).toBe(false);
    await s.turnService.endTurnWithMovement(true);
    const gs = s.stateService.getGameState();
    expect(gs.isGameOver).toBe(true);
    expect(gs.gameEndReason?.type).toBe('design_fee_cap');
  });

  it('under the cap, End Turn carries on normally', async () => {
    const s = await atFeeReview('ENG-FEE-REVIEW', 'First', 5_000_000);
    s.stateService.updateTempState(s.playerId, { expenditures: { design: SCOPE * 0.1, fees: 0, construction: 0 } });
    await s.turnService.endTurnWithMovement(true);
    expect(s.stateService.getGameState().isGameOver).toBe(false);
  });
});
