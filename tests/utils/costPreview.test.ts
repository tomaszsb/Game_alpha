/**
 * getEndTurnCostPreview / getTryAgainCostPreview — the two turn-control
 * cost-preview functions behind TurnCommitControl's tap-to-compare bubble.
 *
 * Covers three related display gaps found via live playtesting and fixed
 * together (2026-08-15):
 *   1. Try Again silently dropped ANY money-bucketed row from its preview —
 *      correct for a fee (never charged on Try Again) but wrong for a
 *      drawn Bank Loan/Investment card (an inflow that genuinely reverts,
 *      same as Work/Expediting/Labor draws).
 *   2. A dice-determined fee (e.g. ARCH-FEE-REVIEW's "Roll for Fees Paid")
 *      vanished from the End Turn preview entirely once rolled, instead of
 *      showing the now-known resolved dollar amount.
 *   3. OWNER-FUND-INITIATION's owner seed money isn't a SPACE_EFFECTS.csv
 *      row at all (calculated at runtime, 80–120% of scope), so neither
 *      preview side ever mentioned it.
 */

import { describe, it, expect } from 'vitest';
import {
  getEndTurnCostPreview,
  getTryAgainCostPreview,
  calculatePushBackDays,
  calculateSpaceTimeAddTotal,
} from '../../src/utils/costPreview';
import type { SpaceEffect } from '../../src/types/DataTypes';
import type { IServiceContainer } from '../../src/types/ServiceContracts';

interface FakeLogEntry {
  type: string;
  playerId: string;
  globalTurnNumber: number;
  isCommitted?: boolean;
  visibility?: string;
  details?: Record<string, unknown>;
}

interface FakeOptions {
  autoFunding?: boolean;
  ownerFundingOffered?: number;
  moneySpent?: number;
  diceRoll?: string;
  globalTurnCount?: number;
  globalActionLog?: FakeLogEntry[];
  /** The space's `try_again_days` (SPACE_CONTENT.csv). Omit = no price set. */
  pushBackDays?: number;
}

function makeGameServices(effects: SpaceEffect[], opts: FakeOptions = {}): IServiceContainer {
  const space = effects[0]?.space_name ?? 'TEST-SPACE';
  const visit = effects[0]?.visit_type ?? 'First';
  const globalTurnCount = opts.globalTurnCount ?? 1;
  return {
    dataService: {
      getSpaceEffects: () => effects,
      getSpaceContent: () => ({
        can_negotiate: true,
        ...(opts.pushBackDays !== undefined ? { try_again_days: opts.pushBackDays } : {}),
      }),
      shouldAutoApplyFunding: () => !!opts.autoFunding,
    },
    gameRulesService: {
      calculateProjectScope: () => 0,
    },
    stateService: {
      getPlayer: () => ({
        currentSpace: space,
        visitType: visit,
        moneySources: { ownerFunding: opts.ownerFundingOffered ?? 0, bankLoans: 0, investmentDeals: 0, other: 0 },
      }),
      getTurnOutflow: () => ({ moneySpent: opts.moneySpent ?? 0, cardsConsumed: [], lifeEventsDrawn: [] }),
      getGameState: () => ({
        globalTurnCount,
        globalActionLog: (opts.globalActionLog ?? []).map((e) => ({
          isCommitted: true,
          visibility: 'player',
          ...e,
        })),
      }),
    },
  } as unknown as IServiceContainer;
}

function row(value: ReturnType<typeof getEndTurnCostPreview>, key: string): string | undefined {
  return value.find((r) => r.key === key)?.value;
}

describe('getTryAgainCostPreview — money bucket', () => {
  it('includes a Bank Loan card draw as "will be re-drawn", excluding the fee text', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'BANK-FUND-REVIEW', visit_type: 'First', effect_type: 'cards', effect_action: 'draw_B', effect_value: '1', condition: '', description: '', trigger_type: 'manual' },
      { space_name: 'BANK-FUND-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: '1', condition: '', description: '', trigger_type: 'auto' },
      { space_name: 'BANK-FUND-REVIEW', visit_type: 'First', effect_type: 'fee', effect_action: 'deduct', effect_value: '3%', condition: '', description: '', trigger_type: 'auto', fee_type: 'LOAN_TIERED' },
    ];
    const gs = makeGameServices(effects);
    const tryAgain = getTryAgainCostPreview(gs, 'p1');
    expect(row(tryAgain, 'money')).toBe('Will be re-drawn next turn');
    expect(row(tryAgain, 'money')).not.toContain('%');

    // Sanity: the End Turn side still shows both the draw and the fee together.
    const endTurn = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1');
    expect(row(endTurn, 'money')).toBe('+1 Bank Loan + 3% of your loan');
  });

  it('includes a dice-rolled Investment draw as "will be re-drawn", excluding the fee', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'INVESTOR-FUND-REVIEW', visit_type: 'First', effect_type: 'dice', effect_action: 'dice_outcome', effect_value: 'I cards', condition: '', description: '', trigger_type: 'manual' },
      { space_name: 'INVESTOR-FUND-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: '1', condition: '', description: '', trigger_type: 'auto' },
      { space_name: 'INVESTOR-FUND-REVIEW', visit_type: 'First', effect_type: 'fee', effect_action: 'deduct', effect_value: '5%', condition: '', description: '', trigger_type: 'auto', fee_type: 'LOAN_PERCENTAGE' },
    ];
    const gs = makeGameServices(effects);
    const tryAgain = getTryAgainCostPreview(gs, 'p1');
    expect(row(tryAgain, 'money')).toBe('Will be re-drawn next turn');
  });

  it('regression: a fee-only space (no draws) still shows nothing for money on Try Again', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'FEE-ONLY-SPACE', visit_type: 'First', effect_type: 'fee', effect_action: 'deduct', effect_value: '$5,000', condition: '', description: '', trigger_type: 'auto', fee_type: 'FIXED' },
      { space_name: 'FEE-ONLY-SPACE', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: '1', condition: '', description: '', trigger_type: 'auto' },
    ];
    const gs = makeGameServices(effects);
    expect(row(getTryAgainCostPreview(gs, 'p1'), 'money')).toBeUndefined();
  });

  it('combines "stays spent" with "will be re-drawn" when both apply', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'COMBO-SPACE', visit_type: 'First', effect_type: 'cards', effect_action: 'draw_B', effect_value: '1', condition: '', description: '', trigger_type: 'manual' },
    ];
    const gs = makeGameServices(effects, { moneySpent: 2000 });
    const tryAgain = getTryAgainCostPreview(gs, 'p1');
    expect(row(tryAgain, 'money')).toBe('$2,000 stays spent + Will be re-drawn next turn');
  });

  it('regression: Work/Expediting/Labor carry-over is unaffected by the money-bucket change', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'DRAW-SPACE', visit_type: 'First', effect_type: 'cards', effect_action: 'draw_e', effect_value: '2', condition: '', description: '', trigger_type: 'manual' },
    ];
    const gs = makeGameServices(effects);
    expect(row(getTryAgainCostPreview(gs, 'p1'), 'expediting')).toBe('Will be re-drawn next turn');
  });
});

describe('getEndTurnCostPreview — dice-resolved fee', () => {
  const diceEffects: SpaceEffect[] = [
    { space_name: 'ARCH-FEE-REVIEW', visit_type: 'First', effect_type: 'dice', effect_action: 'dice_outcome', effect_value: 'Fees Paid', condition: '', description: '', trigger_type: 'manual' },
    { space_name: 'ARCH-FEE-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: '50', condition: '', description: '', trigger_type: 'auto' },
  ];

  it('shows "Varies" before the dice roll resolves', () => {
    const gs = makeGameServices(diceEffects);
    const preview = getEndTurnCostPreview(gs, 'ARCH-FEE-REVIEW', 'First', 'p1', { manualActions: {} });
    expect(row(preview, 'money')).toBe('Varies');
  });

  it('shows the resolved dollar amount once rolled, instead of dropping the row', () => {
    const gs = makeGameServices(diceEffects, { moneySpent: 45000 });
    const preview = getEndTurnCostPreview(gs, 'ARCH-FEE-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'money')).toBe('$45,000 paid');
  });

  // 2026-08-18: a completed fixed-count draw used to go blank ("—") once
  // done. The count was never random for a non-dice `cards` row (it's a
  // fixed CSV value), so the pre-action fragment already WAS the real
  // outcome — dropping it just hid a number the player already knew.
  it('a completed fixed-count card draw keeps showing its known result instead of going blank', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'DRAW-SPACE', visit_type: 'First', effect_type: 'cards', effect_action: 'draw_e', effect_value: '2', condition: '', description: 'Draw 2 E cards', trigger_type: 'manual' },
    ];
    const gs = makeGameServices(effects);
    const preview = getEndTurnCostPreview(gs, 'DRAW-SPACE', 'First', 'p1', { manualActions: { 'cards:draw_e': 'Draw 2 E cards' } });
    expect(row(preview, 'expediting')).toBe('+2 Expeditors');
  });
});

describe('getEndTurnCostPreview — completed dice-driven card draw shows the real result', () => {
  const diceDrawEffects: SpaceEffect[] = [
    { space_name: 'BANK-FUND-REVIEW', visit_type: 'First', effect_type: 'dice', effect_action: 'dice_outcome', effect_value: 'W cards', condition: '', description: '', trigger_type: 'manual' },
  ];

  it('shows "Varies" before the roll resolves', () => {
    const gs = makeGameServices(diceDrawEffects);
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { manualActions: {} });
    expect(row(preview, 'work')).toBe('Varies');
  });

  it('shows the real drawn count + scope delta once the log has it, instead of "Varies" or blank', () => {
    const gs = makeGameServices(diceDrawEffects, {
      globalTurnCount: 3,
      globalActionLog: [
        {
          type: 'card_draw', playerId: 'p1', globalTurnNumber: 3,
          details: { cardType: 'W', count: 3, scopeDelta: 500000 },
        },
      ],
    });
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'work')).toBe('+3 Work Packages (+$500,000)');
  });

  it('sums multiple card_draw entries from the same turn (e.g. a re-roll)', () => {
    const gs = makeGameServices(diceDrawEffects, {
      globalTurnCount: 1,
      globalActionLog: [
        { type: 'card_draw', playerId: 'p1', globalTurnNumber: 1, details: { cardType: 'W', count: 1, scopeDelta: 100000 } },
        { type: 'card_draw', playerId: 'p1', globalTurnNumber: 1, details: { cardType: 'W', count: 2, scopeDelta: 200000 } },
      ],
    });
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'work')).toBe('+3 Work Packages (+$300,000)');
  });

  it('ignores a card_draw entry from a different turn or a different player', () => {
    const gs = makeGameServices(diceDrawEffects, {
      globalTurnCount: 5,
      globalActionLog: [
        { type: 'card_draw', playerId: 'p1', globalTurnNumber: 4, details: { cardType: 'W', count: 3, scopeDelta: 500000 } },
        { type: 'card_draw', playerId: 'p2', globalTurnNumber: 5, details: { cardType: 'W', count: 9, scopeDelta: 900000 } },
      ],
    });
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'work')).toBeUndefined();
  });

  it('falls back to blank when the roll is marked complete but the log entry has not landed yet', () => {
    const gs = makeGameServices(diceDrawEffects, { globalTurnCount: 1, globalActionLog: [] });
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'work')).toBeUndefined();
  });

  // 2026-08-19: found live — on the game's very first turn, globalTurnCount
  // is still 0 (advanceTurn hasn't incremented it yet), but LoggingService
  // stamps every entry logged that turn with globalTurnNumber 1 (its own
  // `globalTurnCount || 1` fallback). A naive `=== globalTurnCount` match
  // compares 1 to 0 and silently misses every turn-1 draw.
  it('matches turn-1 draws even though globalTurnCount is still 0 on the first turn', () => {
    const gs = makeGameServices(diceDrawEffects, {
      globalTurnCount: 0,
      globalActionLog: [
        { type: 'card_draw', playerId: 'p1', globalTurnNumber: 1, details: { cardType: 'W', count: 1, scopeDelta: 2200000 } },
      ],
    });
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'work')).toBe('+1 Work Package (+$2,200,000)');
  });

  // 2026-08-19: found live — a card drawn earlier the SAME turn is still
  // uncommitted TEMP state (only promoted to committed/real history once
  // End Turn actually resolves), so requiring isCommitted (as
  // getDisplayableLogEntries does, correctly, for the post-hoc Chronicle)
  // would find nothing for the one turn this preview needs to see.
  it('finds the draw even though it is still uncommitted TEMP state (not yet End Turn)', () => {
    const gs = makeGameServices(diceDrawEffects, {
      globalTurnCount: 1,
      globalActionLog: [
        { type: 'card_draw', playerId: 'p1', globalTurnNumber: 1, isCommitted: false, details: { cardType: 'W', count: 1, scopeDelta: 2200000 } },
      ],
    });
    const preview = getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'work')).toBe('+1 Work Package (+$2,200,000)');
  });

  it('regression: a completed labor (quality/multiplier) dice roll has no resolvable source yet, still drops to blank', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'CON-INITIATION', visit_type: 'First', effect_type: 'dice', effect_action: 'dice_outcome', effect_value: 'Quality', condition: '', description: '', trigger_type: 'manual' },
    ];
    const gs = makeGameServices(effects, { globalTurnCount: 1, globalActionLog: [] });
    const preview = getEndTurnCostPreview(gs, 'CON-INITIATION', 'First', 'p1', { diceRoll: 'rolled', manualActions: {} });
    expect(row(preview, 'labor')).toBeUndefined();
  });
});

describe('getEndTurnCostPreview — completed flat (non-dice) fee shows the real amount paid', () => {
  const flatFeeEffects: SpaceEffect[] = [
    { space_name: 'FIXED-FEE-SPACE', visit_type: 'First', effect_type: 'fee', effect_action: 'deduct', effect_value: '$5,000', condition: '', description: '', trigger_type: 'manual', fee_type: 'FIXED' },
  ];

  it('shows the declared amount before it is paid', () => {
    const gs = makeGameServices(flatFeeEffects);
    const preview = getEndTurnCostPreview(gs, 'FIXED-FEE-SPACE', 'First', 'p1', { manualActions: {} });
    expect(row(preview, 'money')).toBe('-$5,000');
  });

  it('shows the real amount actually paid once completed, instead of going blank', () => {
    const gs = makeGameServices(flatFeeEffects, { moneySpent: 5000 });
    const preview = getEndTurnCostPreview(gs, 'FIXED-FEE-SPACE', 'First', 'p1', {
      manualActions: { 'fee:deduct': 'Pay the fee' },
    });
    expect(row(preview, 'money')).toBe('$5,000 paid');
  });
});

describe('owner seed money (OWNER-FUND-INITIATION)', () => {
  const effects: SpaceEffect[] = [
    { space_name: 'OWNER-FUND-INITIATION', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: '1', condition: '', description: '', trigger_type: 'auto' },
  ];

  it('End Turn shows the actual offered amount, not nothing', () => {
    const gs = makeGameServices(effects, { autoFunding: true, ownerFundingOffered: 3640000 });
    const preview = getEndTurnCostPreview(gs, 'OWNER-FUND-INITIATION', 'First', 'p1');
    expect(row(preview, 'money')).toBe('+$3,640,000 offered');
  });

  it('Try Again shows it will be re-rolled, not nothing', () => {
    const gs = makeGameServices(effects, { autoFunding: true, ownerFundingOffered: 3640000 });
    const preview = getTryAgainCostPreview(gs, 'p1');
    expect(row(preview, 'money')).toBe('Will be re-drawn next turn');
  });

  it('regression: a non-auto-funding space never shows an owner-seed-money line', () => {
    const gs = makeGameServices(effects, { autoFunding: false, ownerFundingOffered: 3640000 });
    const preview = getEndTurnCostPreview(gs, 'OWNER-FUND-INITIATION', 'First', 'p1');
    expect(row(preview, 'money')).toBeUndefined();
  });
});

// v3.2.75 (Tom, 2026-09-24): pushing back at Investor Review, Hire a Builder and
// Final Approval was FREE — their time is a dice roll with no fixed time row, so
// the push-back charge (the sum of fixed rows) came to 0 and a bad roll could be
// thrown away for nothing. Real life says those steps take time. Such a space now
// sets `try_again_days`, which REPLACES the fixed-rows total.
describe('push-back price (try_again_days)', () => {
  const time = (value: string): SpaceEffect => ({
    space_name: 'S', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: value,
    condition: '', description: '', trigger_type: 'auto',
  });
  // Investor Review's shape: the time is a dice outcome, no fixed time row.
  const diceTimeOnly: SpaceEffect[] = [
    { space_name: 'INVESTOR-FUND-REVIEW', visit_type: 'First', effect_type: 'dice', effect_action: 'dice_outcome', effect_value: 'Time outcomes', condition: '', description: '', trigger_type: 'manual' },
  ];

  describe('calculatePushBackDays', () => {
    it('is the fixed time rows when the space sets no price (the original rule, unchanged)', () => {
      expect(calculatePushBackDays([time('5'), time('10')], undefined)).toBe(15);
      expect(calculatePushBackDays([time('5')], {})).toBe(5);
      expect(calculatePushBackDays([time('5')], null)).toBe(5);
    });

    it('is 0 for a dice-timed space with no price — the free re-roll this closes', () => {
      expect(calculatePushBackDays(diceTimeOnly, {})).toBe(0);
    });

    it('is the price when one is set', () => {
      expect(calculatePushBackDays(diceTimeOnly, { try_again_days: 15 })).toBe(15);
    });

    it('a price REPLACES the fixed rows rather than adding to them', () => {
      expect(calculateSpaceTimeAddTotal([time('50')])).toBe(50);
      expect(calculatePushBackDays([time('50')], { try_again_days: 10 })).toBe(10);
    });

    it('an explicit 0 is honored — a designer can still make a space free on purpose', () => {
      expect(calculatePushBackDays([time('50')], { try_again_days: 0 })).toBe(0);
    });
  });

  describe('the push-back cost box', () => {
    it('shows the price as the Time line', () => {
      const gs = makeGameServices(diceTimeOnly, { pushBackDays: 15 });
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBe('+15 days');
    });

    it('says "1 day", not "1 days"', () => {
      const gs = makeGameServices(diceTimeOnly, { pushBackDays: 1 });
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBe('+1 day');
    });

    it('a space with no price and no fixed row still shows no Time line (unchanged)', () => {
      const gs = makeGameServices(diceTimeOnly);
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBeUndefined();
    });

    it('a space with fixed rows and no price shows those rows (unchanged)', () => {
      const gs = makeGameServices([time('5')]);
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBe('+5 days');
    });

    it('the End Turn side is NOT touched by the price — its dice time still reads "Varies"', () => {
      const gs = makeGameServices(diceTimeOnly, { pushBackDays: 15 });
      expect(row(getEndTurnCostPreview(gs, 'INVESTOR-FUND-REVIEW', 'First', 'p1'), 'time')).toBe('Varies');
    });
  });
});
