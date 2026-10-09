// tests/regression/TimeCap.test.ts
//
// Tom, 2026-10-08 (fb:391cc247): like the design-fee cap, a project that takes far longer than planned ends
// for that player ("no one in their right mind would keep financing it"). He chose 300% of the plan.
import { describe, it, expect, afterEach } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { configureTrophyRules, getTrophyRules } from '../../src/utils/trophyRules';
import { lossTitle, lossLine } from '../../src/utils/endGameLoss';

async function game(hand = ['W001', 'W003']) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService } = s;
  stateService.addPlayer('T');
  const id = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(id);
  stateService.startGame();
  stateService.updatePlayer({ id, hand, money: 9e6 } as any);
  const planned = s.gameRulesService.calculateEstimatedProjectLength(id).estimatedDays as number;
  return { ...s, id, planned };
}

afterEach(() => configureTrophyRules([]));

describe('the time cap', () => {
  it('is 300% by default and comes from TROPHIES.csv', async () => {
    expect(getTrophyRules().timeCapPercent).toBe(300);
    configureTrophyRules([{ kind: 'rule', key: 'time_cap_percent', value: '250', text: '' }]);
    expect(getTrophyRules().timeCapPercent).toBe(250);
  });

  it('a project just under three times its plan is fine', async () => {
    const g = await game();
    expect(g.planned).toBeGreaterThan(0);
    g.stateService.updatePlayer({ id: g.id, timeSpent: Math.floor(g.planned * 3) - 1 } as any);
    (g.turnService as any).effectEngineService.checkTimeCap(g.id);
    expect(g.stateService.getPlayer(g.id).outReason).toBeUndefined();
  });

  it('a project at three times its plan is taken out (time_cap)', async () => {
    const g = await game();
    g.stateService.updatePlayer({ id: g.id, timeSpent: g.planned * 3 } as any);
    (g.turnService as any).effectEngineService.checkTimeCap(g.id);
    expect(g.stateService.getPlayer(g.id).outReason).toBe('time_cap');
  });

  it('0 in the data switches it off', async () => {
    const g = await game();
    configureTrophyRules([{ kind: 'rule', key: 'time_cap_percent', value: '0', text: '' }]);
    g.stateService.updatePlayer({ id: g.id, timeSpent: g.planned * 10 } as any);
    (g.turnService as any).effectEngineService.checkTimeCap(g.id);
    expect(g.stateService.getPlayer(g.id).outReason).toBeUndefined();
  });

  it('a project with no plan yet cannot run late', async () => {
    const g = await game([]);
    g.stateService.updatePlayer({ id: g.id, timeSpent: 5000 } as any);
    (g.turnService as any).effectEngineService.checkTimeCap(g.id);
    expect(g.stateService.getPlayer(g.id).outReason).toBeUndefined();
  });

  it('the end screen says why in plain words', () => {
    const reason = { type: 'time_cap', playerId: 'p' } as any;
    expect(lossTitle(reason)).toBe('The owner pulled the plug');
    expect(lossLine(reason, 'Sam')).toContain('longer than planned');
  });
});
