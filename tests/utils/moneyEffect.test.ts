import { describe, it, expect } from 'vitest';
import { moneyEffectPercent, moneyEffectDollars } from '../../src/utils/moneyEffect';

describe('moneyEffect (E067 "Tax Incentive Research": a percent of scope)', () => {
  it('reads a percent and leaves dollar values alone', () => {
    expect(moneyEffectPercent('10%')).toBe(10);
    expect(moneyEffectPercent(' 2.5 % ')).toBe(2.5);
    expect(moneyEffectPercent('-8000')).toBeNull();
    expect(moneyEffectPercent('')).toBeNull();
    expect(moneyEffectPercent(undefined)).toBeNull();
  });
  it('10% of a $6.3M scope is $630,000; plain dollars ignore the scope', () => {
    expect(moneyEffectDollars('10%', 6300000)).toBe(630000);
    expect(moneyEffectDollars('-8000', 6300000)).toBe(-8000);
    expect(moneyEffectDollars('2000', 0)).toBe(2000);
  });
  it('no scope yet means nothing to save, and junk is zero', () => {
    expect(moneyEffectDollars('10%', 0)).toBe(0);
    expect(moneyEffectDollars('10%', -5)).toBe(0);
    expect(moneyEffectDollars('abc', 100)).toBe(0);
    expect(moneyEffectDollars(undefined, 100)).toBe(0);
  });
});
