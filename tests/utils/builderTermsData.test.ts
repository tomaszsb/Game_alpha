// The builder's price and schedule numbers are data (TROPHIES.csv), not code (v3.7.21, Job 2).
// Behaviour with the shipped file must be identical to the old typed-in numbers.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { configureTrophyRules, getBuilderRules } from '../../src/utils/trophyRules';
import { computeContractorTerms, type ContractorQuality } from '../../src/utils/contractorTerms';
import { drawBid } from '../../src/utils/builderBids';
import type { TrophyRuleCsvRow } from '../../src/types/DataTypes';

const CSV = path.join(__dirname, '../../public/data/CLEAN_FILES/TROPHIES.csv');
function shippedRows(): TrophyRuleCsvRow[] {
  const [head, ...lines] = fs.readFileSync(CSV, 'utf-8').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map(l => { const v = l.split(','); const r: any = {}; cols.forEach((c, i) => { r[c] = v[i] ?? ''; }); return r as TrophyRuleCsvRow; });
}
const row = (kind: string, key: string, value: string): TrophyRuleCsvRow => ({ kind, key, value, text: '' });

// The numbers that used to be typed into contractorTerms.ts.
const OLD_PRICE = { HIGH: 1.15, MED: 1.0, LOW: 0.9 } as const;
const OLD_SPEED = { HIGH: 0.8, MED: 1.0, LOW: 1.3 } as const;
const oldTerms = (work: number, m: number, q: ContractorQuality) => {
  const roll = m >= 1 && m <= 6 ? m : 3;
  const f = (0.7 + roll * 0.1) * OLD_PRICE[q];
  return { cost: Math.round(work * f), scheduleDays: Math.round(roll * 10 * OLD_SPEED[q]), priceFactor: f };
};

describe('builder price and schedule numbers come from the data', () => {
  afterEach(() => configureTrophyRules([]));

  it('the shipped file gives exactly the old numbers, for every job size and quality', () => {
    configureTrophyRules(shippedRows());
    for (const q of ['HIGH', 'MED', 'LOW'] as const) {
      for (const m of [0, 1, 2, 3, 4, 5, 6, 7]) {
        expect(computeContractorTerms(8_500_000, m, q)).toEqual(oldTerms(8_500_000, m, q));
      }
    }
  });

  it('an empty file keeps the stock numbers too', () => {
    configureTrophyRules([]);
    expect(computeContractorTerms(1_000_000, 4, 'LOW')).toEqual(oldTerms(1_000_000, 4, 'LOW'));
  });

  it('a reskin can retune them in the file', () => {
    configureTrophyRules([
      ...shippedRows(),
      row('rule', 'builder_base_price', '1'), row('rule', 'builder_days_per_roll', '5'),
      row('builder_price', 'HIGH', '2'), row('builder_speed', 'LOW', '2'),
    ]);
    const t = getBuilderRules().terms;
    expect(t.basePrice).toBe(1);
    expect(t.daysPerRoll).toBe(5);
    expect(computeContractorTerms(1000, 2, 'HIGH').priceFactor).toBeCloseTo((1 + 2 * 0.1) * 2);
    expect(computeContractorTerms(1000, 2, 'LOW').scheduleDays).toBe(Math.round(2 * 5 * 2));
  });

  it('a value that does not parse, or a backwards job-size range, keeps the stock numbers', () => {
    configureTrophyRules([row('rule', 'builder_base_price', 'lots'), row('rule', 'builder_roll_min', '5'), row('rule', 'builder_roll_max', '2')]);
    const t = getBuilderRules().terms;
    expect(t.basePrice).toBe(0.7);
    expect([t.rollMin, t.rollMax, t.rollDefault]).toEqual([1, 6, 3]);
  });

  it('a bidder draws its job size from the data range, one draw as before', () => {
    configureTrophyRules([...shippedRows(), row('rule', 'builder_roll_min', '2'), row('rule', 'builder_roll_max', '4'), row('rule', 'builder_roll_default', '3')]);
    const rules = getBuilderRules();
    const draw = (r: number) => drawBid({ rng: () => r, workCost: 1_000_000, day: 1, rules } as any, 'b').roll;
    expect(draw(0)).toBe(2);
    expect(draw(0.99)).toBe(4);
  });
});
