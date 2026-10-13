// The owner's seed money range is data (TROPHIES.csv `owner_seed_*`), not code (v3.7.23).
// With the shipped file every amount must equal the old 0.8 + random * 0.4, rounded to $10,000.
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { configureTrophyRules, getOwnerSeedRules } from '../../src/utils/trophyRules';
import { calculateOwnerSeedMoney } from '../../src/utils/ownerSeedMoney';
import type { TrophyRuleCsvRow } from '../../src/types/DataTypes';

const CSV = path.join(__dirname, '../../public/data/CLEAN_FILES/TROPHIES.csv');
function shippedRows(): TrophyRuleCsvRow[] {
  const [head, ...lines] = fs.readFileSync(CSV, 'utf-8').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map(l => { const v = l.split(','); const r: any = {}; cols.forEach((c, i) => { r[c] = v[i] ?? ''; }); return r as TrophyRuleCsvRow; });
}
const row = (key: string, value: string): TrophyRuleCsvRow => ({ kind: 'rule', key, value, text: '' });
const oldSeed = (scope: number, r: number) => {
  const multiplier = 0.8 + r * 0.4;
  return { multiplier, amount: Math.round(Math.round(scope * multiplier) / 10000) * 10000 };
};

describe('owner seed money comes from the data', () => {
  afterEach(() => { vi.restoreAllMocks(); configureTrophyRules([]); });

  it('the shipped file gives exactly the old amounts, for many scopes and rolls', () => {
    configureTrophyRules(shippedRows());
    expect(getOwnerSeedRules()).toEqual({ min: 0.8, max: 1.2, round: 10000 });
    for (const scope of [0, 1_900_000, 8_500_000, 10_800_000, 123_456_789]) {
      for (let i = 0; i <= 100; i++) {
        const r = i / 100;
        vi.spyOn(Math, 'random').mockReturnValue(r);
        expect(calculateOwnerSeedMoney(scope)).toEqual(oldSeed(scope, r));
        vi.restoreAllMocks();
      }
    }
  });

  it('an empty file keeps the stock range', () => {
    configureTrophyRules([]);
    expect(getOwnerSeedRules()).toEqual({ min: 0.8, max: 1.2, round: 10000 });
  });

  it('a reskin can retune it in the file', () => {
    configureTrophyRules([...shippedRows(), row('owner_seed_min', '0.5'), row('owner_seed_max', '0.7'), row('owner_seed_round', '5000')]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(calculateOwnerSeedMoney(1_000_000)).toEqual({ multiplier: 0.5, amount: 500_000 });
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const r = calculateOwnerSeedMoney(1_000_000);
    expect(r.multiplier).toBeGreaterThan(0.69);
    expect(r.amount).toBe(700_000);
  });

  it('a value that does not parse, or a backwards range, keeps the stock numbers', () => {
    configureTrophyRules([row('owner_seed_min', 'lots'), row('owner_seed_round', '0')]);
    expect(getOwnerSeedRules()).toEqual({ min: 0.8, max: 1.2, round: 10000 });
    configureTrophyRules([row('owner_seed_min', '1.5'), row('owner_seed_max', '1.0')]);
    expect(getOwnerSeedRules().min).toBe(0.8);
    expect(getOwnerSeedRules().max).toBe(1.2);
  });
});
