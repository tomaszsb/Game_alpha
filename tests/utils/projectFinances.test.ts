import { describe, it, expect } from 'vitest';
import { computeProjectFinances } from '../../src/utils/projectFinances';
import { Player } from '../../src/types/StateTypes';

// Minimal player factory — only the fields computeProjectFinances reads.
const makePlayer = (over: Partial<Player> = {}): Player =>
  ({
    id: 'p1',
    money: 0,
    timeSpent: 0,
    hand: [],
    activeCards: [],
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    expenditures: { design: 0, fees: 0, construction: 0 },
    ...over,
  } as unknown as Player);

// W-cards with cost + work_cost; non-W cards must be ignored.
const cards: Record<string, any> = {
  W1: { card_id: 'W1', card_name: 'Foundation', card_type: 'W', cost: 100000, work_cost: 60000, work_type_restriction: 'General Construction' },
  W2: { card_id: 'W2', card_name: 'Facade', card_type: 'W', cost: 50000, work_cost: 30000, work_type_restriction: 'General Construction' },
  W3: { card_id: 'W3', card_name: 'Riser', card_type: 'W', cost: 40000, work_cost: 20000, work_type_restriction: 'Plumbing' },
  E1: { card_id: 'E1', card_name: 'Expeditor', card_type: 'E', cost: 5000 },
};
const getCardById = (id: string) => cards[id];

describe('computeProjectFinances', () => {
  it('sums scope from W-card cost and ignores non-W cards', () => {
    const fin = computeProjectFinances(makePlayer({ hand: ['W1', 'W2', 'E1'] }), getCardById);
    expect(fin.scopeTotal).toBe(150000);
    expect(fin.workPackages.map((w) => w.id)).toEqual(['W1', 'W2']);
    expect(fin.construction.budget).toBe(90000); // sum work_cost
  });

  it('derives the same budget assumptions as the classic ledger (20% / 5% / 10%)', () => {
    const fin = computeProjectFinances(makePlayer({ hand: ['W1', 'W2'] }), getCardById);
    expect(fin.design.budget).toBe(30000); // 20% of 150k
    expect(fin.regulatory.budget).toBe(7500); // 5% of 150k
    // contingency = 10% of (design 30k + regulatory 7.5k + construction 90k) = 12750
    expect(fin.contingency.budget).toBe(12750);
  });

  it('reports a funding gap when commitments exceed money raised', () => {
    const fin = computeProjectFinances(
      makePlayer({ hand: ['W1', 'W2'], moneySources: { ownerFunding: 100000, bankLoans: 0, investmentDeals: 0, other: 0 } }),
      getCardById,
    );
    // commitments = scope 150k + design 30k + reg 7.5k + contingency 12.75k = 200.25k
    expect(fin.commitments).toBe(200250);
    expect(fin.fundingGap).toBe(100250); // 200.25k - 100k raised
  });

  it('has no funding gap once enough is raised', () => {
    const fin = computeProjectFinances(
      makePlayer({ hand: ['W1'], moneySources: { ownerFunding: 999999, bankLoans: 0, investmentDeals: 0, other: 0 } }),
      getCardById,
    );
    expect(fin.fundingGap).toBe(0);
  });

  it('excludes owner seed money from fundingRaised but includes it in totalCapital (fb:1783081115822-cac490a5 — "seed money isn\'t raised")', () => {
    const fin = computeProjectFinances(
      makePlayer({
        hand: ['W1', 'W2'],
        moneySources: { ownerFunding: 100000, bankLoans: 50000, investmentDeals: 25000, other: 0 },
      }),
      getCardById,
    );
    expect(fin.fundingRaised).toBe(75000); // bank + investor only, no owner seed money
    expect(fin.totalCapital).toBe(175000); // owner + fundingRaised
    // fundingGap is measured against every dollar available, not just outside
    // funding: commitments 200.25k − totalCapital 175k = 25.25k still short.
    expect(fin.commitments).toBe(200250);
    expect(fin.fundingGap).toBe(25250);
  });

  it('fundingRaised is 0 when the project is entirely owner-funded, but totalCapital still reflects it', () => {
    const fin = computeProjectFinances(
      makePlayer({ hand: ['W1'], moneySources: { ownerFunding: 999999, bankLoans: 0, investmentDeals: 0, other: 0 } }),
      getCardById,
    );
    expect(fin.fundingRaised).toBe(0);
    expect(fin.totalCapital).toBe(999999);
  });

  it('tracks contingency used only when an area overruns its budget', () => {
    const fin = computeProjectFinances(
      makePlayer({ hand: ['W1', 'W2'], expenditures: { design: 35000, fees: 1000, construction: 0 } }),
      getCardById,
    );
    // design overran 30k budget by 5k; regulatory under → 5000 used
    expect(fin.contingency.used).toBe(5000);
    expect(fin.design.spent).toBe(35000);
  });

  it('groups work packages by trade with a per-trade subtotal', () => {
    const fin = computeProjectFinances(makePlayer({ hand: ['W1', 'W2', 'W3', 'E1'] }), getCardById);
    expect(fin.scopeByTrade.map((g) => g.trade)).toEqual(['General Construction', 'Plumbing']);
    const gc = fin.scopeByTrade[0];
    expect(gc.total).toBe(150000); // W1 100k + W2 50k
    expect(gc.packages.map((w) => w.id)).toEqual(['W1', 'W2']);
    expect(fin.scopeByTrade[1].total).toBe(40000); // W3
    // every work package carries its trade
    expect(fin.workPackages.find((w) => w.id === 'W3')?.trade).toBe('Plumbing');
  });

  it('falls back to "Other work" when a W-card has no work type', () => {
    const noTrade = { card_id: 'W9', card_name: 'Misc', card_type: 'W', cost: 1000 };
    const fin = computeProjectFinances(
      makePlayer({ hand: ['W9'] }),
      (id) => (id === 'W9' ? noTrade : null),
    );
    expect(fin.scopeByTrade[0].trade).toBe('Other work');
  });

  it('allocates each work package its share of the soft costs + a full cost', () => {
    const fin = computeProjectFinances(makePlayer({ hand: ['W1', 'W2'] }), getCardById);
    // scope 150k → design 30k / regulatory 7.5k / contingency 12.75k (see above).
    // W1 is 100k of 150k scope = 2/3 share; W2 is 50k = 1/3 share.
    const w1 = fin.workPackages.find((w) => w.id === 'W1')!;
    expect(w1.breakdown.build).toBe(100000);
    expect(w1.breakdown.design).toBe(20000); // round(30000 * 2/3)
    expect(w1.breakdown.regulatory).toBe(5000); // round(7500 * 2/3)
    expect(w1.breakdown.contingency).toBe(8500); // round(12750 * 2/3)
    expect(w1.fullCost).toBe(133500); // 100000 + 20000 + 5000 + 8500

    // Every package's full cost reconciles (±rounding) to total commitments.
    const sumFull = fin.workPackages.reduce((s, w) => s + w.fullCost, 0);
    expect(Math.abs(sumFull - fin.commitments)).toBeLessThanOrEqual(2);
  });

  it('handles a player with no work packages', () => {
    const fin = computeProjectFinances(makePlayer(), getCardById);
    expect(fin.scopeTotal).toBe(0);
    expect(fin.workPackages).toEqual([]);
    expect(fin.fundingGap).toBe(0);
    expect(fin.contingency.budget).toBe(0);
  });
});
