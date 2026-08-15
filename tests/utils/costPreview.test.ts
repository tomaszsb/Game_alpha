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
import { getEndTurnCostPreview, getTryAgainCostPreview } from '../../src/utils/costPreview';
import type { SpaceEffect } from '../../src/types/DataTypes';
import type { IServiceContainer } from '../../src/types/ServiceContracts';

interface FakeOptions {
  autoFunding?: boolean;
  ownerFundingOffered?: number;
  moneySpent?: number;
  diceRoll?: string;
}

function makeGameServices(effects: SpaceEffect[], opts: FakeOptions = {}): IServiceContainer {
  const space = effects[0]?.space_name ?? 'TEST-SPACE';
  const visit = effects[0]?.visit_type ?? 'First';
  return {
    dataService: {
      getSpaceEffects: () => effects,
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

  it('regression: a completed card draw (no resolved-amount concept) still drops silently', () => {
    const effects: SpaceEffect[] = [
      { space_name: 'DRAW-SPACE', visit_type: 'First', effect_type: 'cards', effect_action: 'draw_e', effect_value: '2', condition: '', description: 'Draw 2 E cards', trigger_type: 'manual' },
    ];
    const gs = makeGameServices(effects);
    const preview = getEndTurnCostPreview(gs, 'DRAW-SPACE', 'First', 'p1', { manualActions: { 'cards:draw_e': 'Draw 2 E cards' } });
    expect(row(preview, 'expediting')).toBeUndefined();
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
