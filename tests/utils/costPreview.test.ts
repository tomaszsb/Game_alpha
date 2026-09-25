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
  perAmountUnit,
  timeRowDays,
  hasLoanScaledTime,
  getLoanOnTheTable,
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
  /** Total borrowed right now (TEMP state) / at the start of the turn (REAL snapshot). */
  loanNow?: number;
  loanAtTurnStart?: number;
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
        loans: opts.loanNow ? [{ principal: opts.loanNow }] : [],
      }),
      getRealPlayerState: () => ({
        loans: opts.loanAtTurnStart ? [{ principal: opts.loanAtTurnStart }] : [],
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
      { space_name: 'BANK-FUND-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: '1', condition: 'per_200k', description: '', trigger_type: 'auto' },
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

// v3.2.76 (Tom, 2026-09-25): Bank Review's Time column says "1 day per $200K" but it
// charged a flat 1 day. "It should charge what it says. Do not change the wording."
// The pipeline now keeps the "per how much" in the row's `condition` (per_200k), so
// the dollar figure is data; these pin the one rule everything shares — the boxes,
// End Turn, the push-back and the panel's this-turn line.
describe('time that follows the loan ("1 day per $200K")', () => {
  const perLoan = (value = '1', condition = 'per_200k'): SpaceEffect => ({
    space_name: 'BANK-FUND-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add',
    effect_value: value, condition, description: 'Spend 1 day per $200K', trigger_type: 'auto',
  });
  const fixed = (value: string): SpaceEffect => ({ ...perLoan(value, ''), space_name: 'S' });

  describe('perAmountUnit — the "per how much" is read from the data, never typed in code', () => {
    it.each([
      ['per_200k', 200_000],
      ['per_1m', 1_000_000],
      ['per_1.5m', 1_500_000],
      ['per_250000', 250_000],
      ['PER_200K', 200_000],
      [' per_200k ', 200_000],
    ])('%s -> $%i', (condition, unit) => {
      expect(perAmountUnit(condition)).toBe(unit);
    });

    it.each([undefined, '', 'dice_roll_3', 'to_left', 'scope_gt_4m', 'per_', 'per_0k', 'per_k', 'per_200x'])(
      'a condition that is not a per-amount one (%s) is not scaled',
      (condition) => {
        expect(perAmountUnit(condition as string | undefined)).toBeNull();
      },
    );
  });

  describe('timeRowDays', () => {
    it('a fixed row charges its own days whatever the loan (unchanged)', () => {
      expect(timeRowDays(fixed('5'), 0)).toBe(5);
      expect(timeRowDays(fixed('5'), 4_000_000)).toBe(5);
    });

    it('a dice-conditional row is not a loan row', () => {
      expect(timeRowDays(perLoan('5', 'dice_roll_3'), 4_000_000)).toBe(5);
    });

    it('charges every $200K STARTED — rounded up, never down', () => {
      expect(timeRowDays(perLoan(), 200_000)).toBe(1);
      expect(timeRowDays(perLoan(), 200_001)).toBe(2);
      expect(timeRowDays(perLoan(), 500_000)).toBe(3); // 2.5 blocks
      expect(timeRowDays(perLoan(), 1_400_000)).toBe(7);
      expect(timeRowDays(perLoan(), 2_750_000)).toBe(14); // 13.75 blocks
      expect(timeRowDays(perLoan(), 4_000_000)).toBe(20);
    });

    it('the row\'s own number multiplies the blocks ("2 days per $1M")', () => {
      expect(timeRowDays(perLoan('2', 'per_1m'), 2_500_000)).toBe(6); // 3 blocks x 2 days
    });

    it('never charges less than one block — with no loan named yet it is the old flat 1', () => {
      expect(timeRowDays(perLoan(), 0)).toBe(1);
      expect(timeRowDays(perLoan(), undefined as unknown as number)).toBe(1);
    });
  });

  it('hasLoanScaledTime spots a per-amount time row and nothing else', () => {
    expect(hasLoanScaledTime([perLoan()])).toBe(true);
    expect(hasLoanScaledTime([fixed('5')])).toBe(false);
    expect(hasLoanScaledTime([perLoan('5', 'dice_roll_3')])).toBe(false);
  });

  describe('getLoanOnTheTable — the loan drawn THIS turn, not the pile', () => {
    const state = (now: number[] | undefined, start: number[] | null) => ({
      getPlayer: () => ({ loans: now?.map((principal) => ({ principal })) }),
      getRealPlayerState: () => (start ? { loans: start.map((principal) => ({ principal })) } : null),
    }) as never;

    it('is what was borrowed since the turn began', () => {
      expect(getLoanOnTheTable(state([1_000_000, 1_500_000], [1_000_000]), 'p1')).toBe(1_500_000);
    });

    it('is 0 before anything is drawn, even with old loans', () => {
      expect(getLoanOnTheTable(state([1_000_000], [1_000_000]), 'p1')).toBe(0);
    });

    it('is 0 when there is no turn in progress to compare against', () => {
      expect(getLoanOnTheTable(state([1_000_000], null), 'p1')).toBe(0);
    });

    it('is never negative, and a missing loans list is just nothing', () => {
      expect(getLoanOnTheTable(state([], [1_000_000]), 'p1')).toBe(0);
      expect(getLoanOnTheTable(state(undefined, []), 'p1')).toBe(0);
    });
  });

  describe('the days the shared rule adds up to', () => {
    it('calculateSpaceTimeAddTotal follows the loan; a fixed row beside it still adds', () => {
      expect(calculateSpaceTimeAddTotal([perLoan()], 1_400_000)).toBe(7);
      expect(calculateSpaceTimeAddTotal([perLoan(), fixed('2')], 1_400_000)).toBe(9);
      expect(calculateSpaceTimeAddTotal([perLoan()])).toBe(1); // no loan yet = the minimum
    });

    it('a push-back charges the same days as the loan on the table', () => {
      expect(calculatePushBackDays([perLoan()], {}, 2_750_000)).toBe(14);
    });

    it('an explicit push-back price still REPLACES it, whatever the loan', () => {
      expect(calculatePushBackDays([perLoan()], { try_again_days: 3 }, 4_000_000)).toBe(3);
    });
  });

  describe('the cost boxes', () => {
    const bank = [perLoan()];

    it('say "Varies" until the bank has named a loan — on both sides', () => {
      const gs = makeGameServices(bank);
      expect(row(getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1'), 'time')).toBe('Varies');
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBe('Varies');
    });

    it('show the true days for the loan on the table — the same number on both sides', () => {
      const gs = makeGameServices(bank, { loanNow: 1_400_000, loanAtTurnStart: 0 });
      expect(row(getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1'), 'time')).toBe('+7 days');
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBe('+7 days');
    });

    it('count only the new terms, not a loan from an earlier visit', () => {
      const gs = makeGameServices(bank, { loanNow: 2_500_000, loanAtTurnStart: 1_000_000 });
      // $1.5M drawn this turn = 8 days (7.5 rounded up); the $1.0M is history.
      expect(row(getEndTurnCostPreview(gs, 'BANK-FUND-REVIEW', 'First', 'p1'), 'time')).toBe('+8 days');
    });

    it('an explicit push-back price is fixed even before a loan is drawn (no "Varies")', () => {
      const gs = makeGameServices(bank, { pushBackDays: 3 });
      expect(row(getTryAgainCostPreview(gs, 'p1'), 'time')).toBe('+3 days');
    });
  });
});
