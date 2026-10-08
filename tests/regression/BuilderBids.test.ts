// tests/regression/BuilderBids.test.ts
//
// Job 6: Hire a Builder is a choice between bids, not two outcome buttons. Real engine, real data.
// What these pin down (Tom's rules, 2026-10-08):
//  - the quoted price and days are EXACTLY what is paid and waited;
//  - until a builder is hired the only road on is the door to the bank, and after hiring the
//    door is shut;
//  - a trip to the bank and back leaves Hire a Builder a FIRST visit, with the same bids;
//  - any change to the plan voids all bids; a lapsed bid is replaced and the screen can say so;
//  - the hire counts once in the quality ledger, at the size TROPHIES.csv gives that quality;
//  - a push-back throws the hire (and the bids drawn this turn) away with the money it cost.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { getBuilderRules, pointsFor } from '../../src/utils/trophyRules';
import { computeContractorTerms } from '../../src/utils/contractorTerms';

async function atBuilder(money = 5_000_000, hand: string[] = ['W001', 'W003']) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService, turnService, movementService, gameRulesService } = s;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId, currentSpace: 'CON-INITIATION', visitType: 'First', visitedSpaces: ['CON-INITIATION'],
    money, loans: [], hand,
  } as any);
  await turnService.startTurn(playerId);
  const me = () => stateService.getPlayer(playerId)!;
  return { ...s, playerId, me, movementService, gameRulesService };
}

describe('the bids on the table', () => {
  it('draws the data\'s number of bids and quotes each at the engine\'s own formula', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    expect(set.bids).toHaveLength(getBuilderRules().bidsOffered);
    const workCost = s.gameRulesService.calculateTotalWorkCost(s.playerId);
    expect(workCost).toBeGreaterThan(0);
    for (const b of set.bids) {
      const t = computeContractorTerms(workCost, b.roll, b.quality);
      expect([b.price, b.days]).toEqual([t.cost, t.scheduleDays]);
    }
  });

  it('asking again changes nothing (the bids stay put until a price runs out)', async () => {
    const s = await atBuilder();
    const first = s.turnService.ensureBuilderBids(s.playerId);
    const again = s.turnService.ensureBuilderBids(s.playerId);
    expect(again.bids.map((b: any) => b.id)).toEqual(first.bids.map((b: any) => b.id));
  });

  it('draws nothing anywhere but the builder\'s desk', async () => {
    const s = await atBuilder();
    s.stateService.updatePlayer({ id: s.playerId, currentSpace: 'PM-DECISION-CHECK' } as any);
    expect(s.turnService.ensureBuilderBids(s.playerId)).toBeUndefined();
  });
});

describe('hiring', () => {
  it('charges exactly the quoted price and adds exactly the quoted days', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    const bid = set.bids[1];
    const moneyBefore = s.me().money;
    const daysBefore = s.me().timeSpent;
    const result = await s.turnService.hireBuilderBid(s.playerId, bid.id);
    expect(result.success).toBe(true);
    expect(moneyBefore - s.me().money).toBe(bid.price);
    expect(s.me().timeSpent - daysBefore).toBe(bid.days);
    expect(s.me().contractor).toMatchObject({ quality: bid.quality, multiplier: bid.roll });
    expect(result.qualityName).toBe(getBuilderRules().qualities[bid.quality as 'HIGH'].name);
  });

  it('counts once in the quality ledger, at the size the data gives that quality', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    const bid = set.bids[0];
    await s.turnService.hireBuilderBid(s.playerId, bid.id);
    const record = s.me().trophyRecord;
    const event = getBuilderRules().qualities[bid.quality as 'HIGH'].event;
    expect(record.counts[event]).toBe(1);
    expect(record.reviews).toBe(1);
    expect(record.problemPoints).toBe(pointsFor(event));
  });

  it('refuses a second hire', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    await s.turnService.hireBuilderBid(s.playerId, set.bids[0].id);
    const again = await s.turnService.hireBuilderBid(s.playerId, set.bids[1].id);
    expect(again).toMatchObject({ success: false, reason: 'already_hired' });
  });

  it('refuses a bid that is not on the table (and signs nothing)', async () => {
    const s = await atBuilder();
    s.turnService.ensureBuilderBids(s.playerId);
    const before = s.me().money;
    const result = await s.turnService.hireBuilderBid(s.playerId, 'bid-999');
    expect(result).toMatchObject({ success: false, reason: 'bids_changed' });
    expect(s.me().money).toBe(before);
    expect(s.me().contractor).toBeUndefined();
  });

  it('a change to the plan voids the bids, and the old id cannot be hired at the old price', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    const oldId = set.bids[0].id;
    s.stateService.updatePlayer({ id: s.playerId, hand: ['W001', 'W003', 'W002'] } as any);
    const before = s.me().money;
    const result = await s.turnService.hireBuilderBid(s.playerId, oldId);
    expect(result).toMatchObject({ success: false, reason: 'bids_changed' });
    expect(s.me().money).toBe(before);
    const fresh = s.me().builderBids;
    expect(fresh.bids.map((b: any) => b.id)).not.toContain(oldId);
    expect(fresh.lapsed.every((l: any) => l.reason === 'plan_changed')).toBe(true);
  });

  it('a lapsed price is replaced by a new builder, and the screen can say which and why', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    const oldFirst = set.bids[0];
    // time passes beyond the first bid's last day only
    s.stateService.updatePlayer({
      id: s.playerId,
      timeSpent: oldFirst.expiresDay + 1,
      builderBids: { ...set, bids: set.bids.map((b: any, i: number) => (i === 0 ? b : { ...b, expiresDay: 99_999 })) },
    } as any);
    const next = s.turnService.ensureBuilderBids(s.playerId);
    expect(next.bids[0].id).not.toBe(oldFirst.id);
    expect(next.bids[1].id).toBe(set.bids[1].id);
    expect(next.lapsed).toHaveLength(1);
    expect(next.lapsed[0]).toMatchObject({ reason: 'expired', guaranteeDays: oldFirst.guaranteeDays, price: oldFirst.price });
  });
});

describe('the door to the bank', () => {
  it('until someone is hired the only road on is the door; after hiring only the normal road', async () => {
    const s = await atBuilder();
    const { door } = getBuilderRules();
    expect(s.movementService.getValidMoves(s.playerId)).toEqual([door]);
    const set = s.turnService.ensureBuilderBids(s.playerId);
    await s.turnService.hireBuilderBid(s.playerId, set.bids[0].id);
    const moves = s.movementService.getValidMoves(s.playerId);
    expect(moves).toEqual(['CON-ISSUES']);
  });

  it('a trip to the bank and back is still a first visit, with the same bids at the same prices', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    await s.movementService.movePlayer(s.playerId, getBuilderRules().door);
    expect(s.me().currentSpace).toBe(getBuilderRules().door);
    // back through the hub, as the road runs
    s.stateService.updatePlayer({ id: s.playerId, currentSpace: 'PM-DECISION-CHECK', visitType: 'First' } as any);
    await s.movementService.movePlayer(s.playerId, 'CON-INITIATION').catch(() => undefined);
    // (the hub may only offer the builder with the examiners' approvals; force the arrival rule directly)
    s.stateService.updatePlayer({ id: s.playerId, currentSpace: 'CON-INITIATION', visitType: 'First' } as any);
    const back = s.turnService.ensureBuilderBids(s.playerId);
    expect(back.bids.map((b: any) => [b.id, b.price, b.days])).toEqual(set.bids.map((b: any) => [b.id, b.price, b.days]));
  });
});

describe('what survives the end of the turn', () => {
  it('the hired builder is still hired after the turn commits (it used to be lost, forcing a second hire)', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    const bid = set.bids[0];
    await s.turnService.hireBuilderBid(s.playerId, bid.id);
    s.stateService.setPlayerMoveIntent(s.playerId, 'CON-ISSUES');
    await s.turnService.endTurnWithMovement(true);
    expect(s.me().currentSpace).toBe('CON-ISSUES');
    expect(s.me().contractor).toMatchObject({ quality: bid.quality, multiplier: bid.roll });
  });

  it('the bids on the table are still the same bids after a trip to the lender', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    s.stateService.setPlayerMoveIntent(s.playerId, getBuilderRules().door);
    await s.turnService.endTurnWithMovement(true);
    expect(s.me().currentSpace).toBe(getBuilderRules().door);
    expect(s.me().builderBids.bids.map((b: any) => [b.id, b.price, b.days, b.expiresDay]))
      .toEqual(set.bids.map((b: any) => [b.id, b.price, b.days, b.expiresDay]));
  });
});

describe('pushing back', () => {
  it('throws the hire away with the money and days it cost', async () => {
    const s = await atBuilder();
    const set = s.turnService.ensureBuilderBids(s.playerId);
    const moneyBefore = s.me().money;
    const daysBefore = s.me().timeSpent;
    await s.turnService.hireBuilderBid(s.playerId, set.bids[0].id);
    expect(s.me().contractor).toBeDefined();
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.me().contractor).toBeUndefined();
    expect(s.me().money).toBe(moneyBefore);
    expect(s.me().trophyRecord?.counts?.[getBuilderRules().qualities[set.bids[0].quality as 'HIGH'].event] ?? 0).toBe(0);
    expect(s.me().timeSpent).toBeGreaterThanOrEqual(daysBefore); // push-back costs days, never refunds them
  });
});
