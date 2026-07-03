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

  const stateService = {
    getPlayer: vi.fn((id: string) => {
      return id === 'p1'
        ? { ...player, expenditures: { ...liveExpenditures } } as any
        : null as any;
    }),
    updateTempState: vi.fn((_id: string, data: any) => {
      if (data?.expenditures) liveExpenditures = { ...liveExpenditures, ...data.expenditures };
      return { success: true } as any;
    }),
    emitAutoAction: vi.fn(),
    endGame: vi.fn(),
    // trackDesignExpenditure reads gameState for turn-number cost-history entries.
    getGameState: vi.fn(() => ({ globalTurnCount: 1, turn: 1 } as any)),
  } as unknown as IStateService;

  const resourceService = {
    addMoney: vi.fn(() => true),
    spendMoney: vi.fn(() => true),
    addTime: vi.fn(),
    spendTime: vi.fn(),
  } as unknown as IResourceService;

  const gameRulesService = {
    calculateProjectScope: vi.fn(() => opts.projectScope),
  } as unknown as IGameRulesService;

  const loggingService = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as ILoggingService;

  const dataService = opts.spaceConfigPhase
    ? ({
        getGameConfigBySpace: vi.fn((space: string) =>
          space === opts.currentSpace ? ({ space_name: space, phase: opts.spaceConfigPhase } as any) : undefined
        ),
      } as unknown as IDataService)
    : undefined;

  const handler = new FinancialEffectHandler(
    resourceService,
    stateService,
    gameRulesService,
    loggingService,
    dataService
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
    // No winner + a reason, so EndGameModal can render the loss screen
    // (post-deploy playtest: loss endings left a blank page).
    expect(stateService.endGame).toHaveBeenCalledWith(undefined, { type: 'design_fee_cap', playerId: 'p1' });
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

describe('FinancialEffectHandler — SCOPE_PERCENTAGE authored fee (4b slice 4)', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeScopeServices(projectScope: number) {
    const player = { id: 'p1', name: 'Player 1', money: 5_000_000, loans: [], currentSpace: 'AUTH-CLASSROOM-1-1' } as any;
    const stateService = {
      getPlayer: vi.fn(() => player),
      updateTempState: vi.fn(),
      emitAutoAction: vi.fn(),
      endGame: vi.fn(),
      getGameState: vi.fn(() => ({ globalTurnCount: 1, turn: 1 } as any)),
    } as unknown as IStateService;
    const resourceService = {
      canAfford: vi.fn(() => true),
      spendMoney: vi.fn(() => true),
      addMoney: vi.fn(() => true),
    } as unknown as IResourceService;
    const gameRulesService = { calculateProjectScope: vi.fn(() => projectScope) } as unknown as IGameRulesService;
    const loggingService = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ILoggingService;
    const handler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
    return { handler, stateService, resourceService, gameRulesService };
  }

  const scopeFee = (desc: string): Effect => ({
    effectType: 'FEE_DEDUCTION',
    payload: { playerId: 'p1', feeType: 'SCOPE_PERCENTAGE', feeDescription: desc, source: 'AUTH-CLASSROOM-1-1' },
  } as any);

  it('charges the percentage against project scope, not loans', () => {
    const { handler, resourceService, gameRulesService } = makeScopeServices(1_000_000);
    handler.handleFeeDeduction(scopeFee('5% of scope'), ctx);
    expect(gameRulesService.calculateProjectScope).toHaveBeenCalledWith('p1');
    // 5% of 1,000,000 = 50,000 (charged even with zero loans).
    expect(resourceService.spendMoney).toHaveBeenCalledWith('p1', 50_000, expect.anything(), '5% of scope');
  });

  it('does NOT touch the 20% design-fee game-over cap (no instant-loss footgun)', () => {
    const { handler, stateService } = makeScopeServices(1_000_000);
    handler.handleFeeDeduction(scopeFee('25% of scope'), ctx); // would blow a real design cap
    expect(stateService.endGame).not.toHaveBeenCalled();
    const designWrite = (stateService.updateTempState as any).mock.calls
      .find((c: any[]) => c[1]?.expenditures?.design != null);
    expect(designWrite).toBeUndefined();
  });
});

describe('FinancialEffectHandler — mandatory bills can bankrupt (fb:f0bdd78a / 0aae9865)', () => {
  beforeEach(() => vi.clearAllMocks());

  // A plain RESOURCE_CHANGE money deduction (a bill), and a player left below
  // zero after it is charged so checkBankruptcy sees the deficit.
  function makeBillServices(moneyAfterCharge: number) {
    const player = { id: 'p1', name: 'Player 1', currentSpace: 'REG-DOB-FEE-REVIEW', money: moneyAfterCharge } as any;
    const stateService = {
      getPlayer: vi.fn(() => player),
      updateTempState: vi.fn(),
      emitAutoAction: vi.fn(),
      endGame: vi.fn(),
      getGameState: vi.fn(() => ({ globalTurnCount: 1, turn: 1 } as any)),
    } as unknown as IStateService;
    const resourceService = {
      canAfford: vi.fn(() => false),
      spendMoney: vi.fn(() => true), // pretend the deduction went through (into the red)
      addMoney: vi.fn(() => true),
    } as unknown as IResourceService;
    const gameRulesService = { calculateProjectScope: vi.fn(() => 0) } as unknown as IGameRulesService;
    const loggingService = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ILoggingService;
    const handler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
    return { handler, stateService, resourceService };
  }

  const bill = (amount: number): Effect => ({
    effectType: 'RESOURCE_CHANGE',
    payload: { playerId: 'p1', resource: 'MONEY', amount, source: 'reg-fee', reason: 'Filing fee' },
  } as any);

  it('charges the bill with allowNegative so an unpayable fee is not silently dropped', () => {
    const { handler, resourceService } = makeBillServices(-500);
    handler.handleResourceChange(bill(-2000), ctx);
    // 6th arg (allowNegative) must be true for a mandatory bill.
    expect(resourceService.spendMoney).toHaveBeenCalledWith('p1', 2000, 'reg-fee', 'Filing fee', undefined, true);
  });

  it('ends the game when the charge leaves the player below zero', () => {
    const { handler, stateService } = makeBillServices(-500);
    handler.handleResourceChange(bill(-2000), ctx);
    expect(stateService.endGame).toHaveBeenCalledTimes(1);
    expect(stateService.endGame).toHaveBeenCalledWith(undefined, { type: 'bankruptcy', playerId: 'p1' });
    expect(stateService.emitAutoAction).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('BANKRUPTCY') }),
    );
  });

  it('does NOT bankrupt when the charge leaves a non-negative balance', () => {
    const { handler, stateService } = makeBillServices(300);
    handler.handleResourceChange(bill(-2000), ctx);
    expect(stateService.endGame).not.toHaveBeenCalled();
  });
});
