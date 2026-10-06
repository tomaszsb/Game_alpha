/**
 * Regression: a construction change order is NOT a design fee (Tom, 2026-10-04:
 * "fees are not part of 20%"). Before this, trackDesignExpenditure booked every
 * percentage-of-scope fee with a feeCategory into expenditures.design — the tally
 * the 20% cap reads — so a return visit to Hire a Builder could end a project as
 * a "design fee" loss (78 of 226 bot games). Architect/engineer fees still count.
 */
import { describe, it, expect, vi } from 'vitest';
import { FinancialEffectHandler } from '../../src/services/FinancialEffectHandler';
import type { IStateService, IResourceService, IGameRulesService, ILoggingService } from '../../src/types/ServiceContracts';
import type { Effect, EffectContext } from '../../src/types/EffectTypes';

function run(feeCategory: 'architectural' | 'engineering' | 'construction', pct: number) {
  const player = {
    id: 'p1', name: 'P1', currentSpace: 'X',
    expenditures: { design: 0, fees: 0, construction: 0 },
    costs: { architectural: 0, engineering: 0, total: 0 },
    costHistory: [] as any[],
  } as any;
  const stateService = {
    getPlayer: vi.fn(() => player),
    updateTempState: vi.fn((_id: string, data: any) => {
      if (data?.expenditures) player.expenditures = { ...player.expenditures, ...data.expenditures };
      if (data?.costs) player.costs = data.costs;
      if (data?.costHistory) player.costHistory = data.costHistory;
      return { success: true } as any;
    }),
    emitGameEvent: vi.fn(),
    endGame: vi.fn(),
    getGameState: vi.fn(() => ({ globalTurnCount: 1 } as any)),
  } as unknown as IStateService;
  const resourceService = {
    addMoney: vi.fn(() => true), spendMoney: vi.fn(() => true), addTime: vi.fn(), spendTime: vi.fn(),
  } as unknown as IResourceService;
  const gameRulesService = { calculateProjectScope: vi.fn(() => 100_000) } as unknown as IGameRulesService;
  const loggingService = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ILoggingService;

  const handler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
  const effect = {
    effectType: 'RESOURCE_CHANGE',
    payload: { playerId: 'p1', resource: 'MONEY', amount: 0, percentageOfScope: pct, feeCategory, source: 't', reason: 't' },
  } as unknown as Effect;
  const result = handler.handleResourceChange(effect, { source: 'test', triggerEvent: 'SPACE_ENTRY' } as EffectContext);
  expect(result.success).toBe(true);
  return { player, handler, stateService };
}

describe('change orders vs. the 20% design-fee tally', () => {
  it('a change order books to construction and leaves the design tally alone', () => {
    const { player } = run('construction', 5);
    expect(player.expenditures.construction).toBe(5_000);
    expect(player.expenditures.design).toBe(0);
  });

  it('architect and engineer fees still count toward design', () => {
    expect(run('architectural', 3).player.expenditures.design).toBe(3_000);
    expect(run('engineering', 4).player.expenditures.design).toBe(4_000);
  });

  it('the 20% cap does not fire on change orders alone', () => {
    const { handler, stateService } = run('construction', 25); // 25% of scope in change orders
    handler.checkDesignFeeCap('p1');
    expect(stateService.endGame).not.toHaveBeenCalled();
  });

  it('the 20% cap still fires on design fees', () => {
    const { handler, stateService } = run('architectural', 20);
    handler.checkDesignFeeCap('p1');
    expect(stateService.endGame).toHaveBeenCalled();
  });
});
