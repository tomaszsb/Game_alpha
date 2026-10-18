import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseLoanFeeTiers, calculateTieredLoanFee, DEFAULT_LOAN_FEE_TIERS } from '../../src/utils/loanFeeTiers';

// REVIEW.md 2026-10-18, section 4 case 1: the bank-loan fee was written three
// ways (data text with a $1.4M-$1.5M gap, hard-coded limits in
// FinancialEffectHandler, a dead copy in ConditionEvaluator). Now the data's
// fee cell is the one source: the charge is read from it.
describe('bank loan fee tiers come from the data', () => {
  const rows = readFileSync('public/data/CLEAN_FILES/SPACE_EFFECTS.csv', 'utf-8')
    .split(/\r?\n/).filter(l => l.startsWith('BANK-FUND-REVIEW,') && l.includes(',LOAN_TIERED,'));

  it('every shipped LOAN_TIERED cell parses, with no gap, to the default tiers', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cell = row.split(',')[4];
      expect(parseLoanFeeTiers(cell), cell).toEqual(DEFAULT_LOAN_FEE_TIERS);
    }
  });

  it('charges at the boundaries the text names', () => {
    const text = '1% for a loan up to $1.4M or 2% up to $2.75M or 3% above $2.75M';
    expect(calculateTieredLoanFee(text, 1_400_000)).toBe(14_000);
    expect(calculateTieredLoanFee(text, 1_450_000)).toBe(29_000); // was the unnamed gap
    expect(calculateTieredLoanFee(text, 2_750_000)).toBe(55_000);
    expect(calculateTieredLoanFee(text, 3_000_000)).toBe(90_000);
    expect(calculateTieredLoanFee(text, 0)).toBe(0);
  });

  it('editing the text changes the charge', () => {
    expect(calculateTieredLoanFee('2% for a loan up to $500K or 4% above $500K', 1_000_000)).toBe(40_000);
  });

  it('unreadable text falls back to the defaults, never to $0', () => {
    expect(parseLoanFeeTiers('the bank charges what it likes')).toBeNull();
    expect(calculateTieredLoanFee('the bank charges what it likes', 2_000_000)).toBe(40_000);
  });
});
