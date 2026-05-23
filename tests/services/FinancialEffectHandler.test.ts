// tests/services/FinancialEffectHandler.test.ts
//
// Regression lock for v2.70.4 (fb:3a57d5d0): the design-fee >20% rule is
// strict-any-phase — game ends regardless of which phase the player is in.
// The pre-v2.70.4 behavior split into "DESIGN phase ends game / other phases
// get a +2 week time penalty"; we want that split to stay gone.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinancialEffectHandler } from '../../src/services/FinancialEffectHandler';
import type {
  IResourceService,
  IStateService,
  IGameRulesService,
  ILoggingService,
  IDataService
} from '../../src/types/ServiceContracts';
import type { Effect, EffectContext } from '../../src/types/EffectTypes';

// Minimal player shape that checkDesignFeeCap reads. expenditures.design is
// seeded so the next fee tips us past 20% of scope.
function makePlayer(designSoFar: number, currentSpace: string) {
  return {
    id: 'p1',
    name: 'Player 1',
    currentSpace,
    expenditures: { design: designSoFar },
    costs: { architectural: 0, engineering: 0, total: 0 },
    costHistory: [],
  } as any;
}

function makeServices(opts: {
  projectScope: number;
  designSoFar: number;
  currentSpace: string;
  spaceConfigPhase?: string;  // undefined → dataService omitted
}) {
  const player = makePlayer(opts.designSoFar, opts.currentSpace);

  // Mutable state for getPlayer — trackDesignExpenditure -> updateTempState
  // adds to expenditures.design, then checkDesignFeeCap reads the updated player.
  let liveExpenditures = { ...player.expenditures };

  const stateService: Partial<IStateService> = {
    getPlayer: vi.fn((id: string) => {
      return id === 'p1'
        ? { ...player, expenditures: { ...liveExpenditures } } as any
        : null as any;
    }),
    updateTempState: vi.fn((_id: string, data: any) => {
      if (data?.expenditures) liveExpenditures = { ...liveExpenditures, ...data.expenditures };
    }),
    emitAutoAction: vi.fn(),
    endGame: vi.fn(),
    // trackDesignExpenditure reads gameState for turn-number cost-history entries.
    getGameState: vi.fn(() => ({ globalTurnCount: 1, turn: 1 } as any)),
  };

  const resourceService: Partial<IResourceService> = {
    addMoney: vi.fn(() => true),
    spendMoney: vi.fn(() => true),
    addTime: vi.fn(),
    spendTime: vi.fn(),
  };

  const gameRulesService: Partial<IGameRulesService> = {
    calculateProjectScope: vi.fn(() => opts.projectScope),
  };

  const loggingService: Partial<ILoggingService> = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const dataService: Partial<IDataService> | undefined = opts.spaceConfigPhase
    ? {
        getGameConfigBySpace: vi.fn((space: string) =>
          space === opts.currentSpace ? ({ space_name: space, phase: opts.spaceConfigPhase } as any) : undefined
        ),
      }
    : undefined;

  const handler = new FinancialEffectHandler(
    resourceService as IResourceService,
    stateService as IStateService,
    gameRulesService as IGameRulesService,
    loggingService as ILoggingService,
    dataService as IDataService | undefined
  );

  return { handler, stateService, resourceService, gameRulesService };
}

function makeFeeEffect(percentageOfScope: number, feeCategory: 'architectural' | 'engineering' = 'architectural'): Effect {
  return {
    effectType: 'RESOURCE_CHANGE',
    payload: {
      playerId: 'p1',
      resource: 'MONEY',
      amount: 0, // computed from percentageOfScope
      percentageOfScope,
      feeCategory,
      source: 'test-fee',
      reason: 'unit test design fee',
    },
  } as any;
}

const ctx: EffectContext = { source: 'test', triggerEvent: 'manual' } as any;

describe('FinancialEffectHandler — 20% design fee cap is strict-any-phase (v2.70.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ends game when ratio crosses 20% in DESIGN phase', () => {
    // Scope 100k. designSoFar = 18k (18%). New 5% fee adds 5k → 23%, over the cap.
    const { handler, stateService, resourceService } = makeServices({
      projectScope: 100_000,
      designSoFar: 18_000,
      currentSpace: 'ARCH-FEE-REVIEW',
      spaceConfigPhase: 'DESIGN',
    });
    handler.handleResourceChange(makeFeeEffect(5), ctx);
    expect(stateService.endGame).toHaveBeenCalledTimes(1);
    expect(stateService.emitAutoAction).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('GAME OVER'),
      })
    );
    // The deleted time-penalty fallback must NOT fire.
    expect((resourceService.addTime as any)).not.toHaveBeenCalled();
  });

  it('ends game when ratio crosses 20% in CONSTRUCTION phase (the v2.70.4 change)', () => {
    const { handler, stateService, resourceService } = makeServices({
      projectScope: 100_000,
      designSoFar: 18_000,
      currentSpace: 'CON-INITIATION',
      spaceConfigPhase: 'CONSTRUCTION',
    });
    handler.handleResourceChange(makeFeeEffect(5), ctx);
    expect(stateService.endGame).toHaveBeenCalledTimes(1);
    // Pre-v2.70.4 this branch fired addTime(+2) and a notification.
    expect((resourceService.addTime as any)).not.toHaveBeenCalled();
  });

  it('ends game when ratio crosses 20% in REGULATORY phase', () => {
    const { handler, stateService, resourceService } = makeServices({
      projectScope: 100_000,
      designSoFar: 18_000,
      currentSpace: 'REG-DOB-FEE-REVIEW',
      spaceConfigPhase: 'REGULATORY',
    });
    handler.handleResourceChange(makeFeeEffect(5), ctx);
    expect(stateService.endGame).toHaveBeenCalledTimes(1);
    expect((resourceService.addTime as any)).not.toHaveBeenCalled();
  });

  it('ends game when ratio crosses 20% with no dataService (UNKNOWN phase)', () => {
    // Defensive: dataService is an optional dependency; the rule must still fire.
    const { handler, stateService } = makeServices({
      projectScope: 100_000,
      designSoFar: 18_000,
      currentSpace: 'ARCH-FEE-REVIEW',
      // spaceConfigPhase omitted → dataService undefined → currentPhase = 'UNKNOWN'
    });
    handler.handleResourceChange(makeFeeEffect(5), ctx);
    expect(stateService.endGame).toHaveBeenCalledTimes(1);
  });

  it('does NOT end game when cumulative ratio stays under 20%', () => {
    // 18% + 1.5% = 19.5% — under the cap.
    const { handler, stateService } = makeServices({
      projectScope: 100_000,
      designSoFar: 18_000,
      currentSpace: 'ARCH-FEE-REVIEW',
      spaceConfigPhase: 'DESIGN',
    });
    handler.handleResourceChange(makeFeeEffect(1.5), ctx);
    expect(stateService.endGame).not.toHaveBeenCalled();
  });
});
