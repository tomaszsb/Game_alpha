// tests/regression/ViolationRulesCsvDriven.test.ts

/**
 * Regression test: Homeowner Violation tier threshold, filing deadline, and
 * fee/daily-accrual rates are CSV-driven (2026-08-14, reskin item 2).
 *
 * Workstream 6 CSV-only-reskin audit (2026-08-03, TODO.md) found
 * violationRules.ts's numbers ($500k tier threshold, 180-day deadline,
 * 4%/8%/10%/20% fee rates, $500/$2000 daily rates) baked into TypeScript as
 * magic constants — a reskin CSV could reassign which card triggers the
 * mechanic (item 1, fixed separately) but couldn't touch the actual dollar
 * amounts without a code edit.
 *
 * Fix: the numbers now load from data/CLEAN_FILES/VIOLATION_RULES.csv
 * (DataService.getViolationRuleRows -> violationRules.ts's new
 * configureViolationRules, wired in App.tsx). Every consumer
 * (CardService.ts, TurnService.ts) reads the exported values at gameplay
 * time inside a method body, never at module-import time, so live-binding
 * reassignment is safe here — unlike CHARACTER_MAP (item 4), no synchronous-
 * at-import consumer exists that needs a pre-seeded object.
 *
 * Each test uses vi.resetModules() + a dynamic import to get a fresh copy of
 * violationRules.ts, since its exported values are mutable module-level
 * state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViolationRuleCsvRow } from '../../src/types/DataTypes';

// Mirrors public/data/CLEAN_FILES/VIOLATION_RULES.csv exactly (the shipped default).
const STOCK_ROWS: ViolationRuleCsvRow[] = [
  { tier: 'small', threshold: '500000', deadline_days: '180', fee_rate_ontime: '0.04', fee_rate_late: '0.08', daily_rate: '500' },
  { tier: 'large', threshold: '500000', deadline_days: '180', fee_rate_ontime: '0.10', fee_rate_late: '0.20', daily_rate: '2000' },
];

describe('Homeowner Violation numbers are CSV-driven (reskin item 2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loading the shipped CSV yields identical output to the previous hardcoded defaults', async () => {
    const rules = await import('../../src/utils/violationRules');
    const before = {
      threshold: rules.VIOLATION_TIER_THRESHOLD,
      deadline: rules.VIOLATION_DEADLINE_DAYS,
      smallOnTime: rules.computeFilingFee('small', true, 100000),
      smallLate: rules.computeFilingFee('small', false, 100000),
      largeOnTime: rules.computeFilingFee('large', true, 1000000),
      largeLate: rules.computeFilingFee('large', false, 1000000),
      smallDaily: rules.getViolationDailyRate('small'),
      largeDaily: rules.getViolationDailyRate('large'),
    };

    rules.configureViolationRules(STOCK_ROWS);

    expect(rules.VIOLATION_TIER_THRESHOLD).toBe(before.threshold);
    expect(rules.VIOLATION_DEADLINE_DAYS).toBe(before.deadline);
    expect(rules.computeFilingFee('small', true, 100000)).toBe(before.smallOnTime);
    expect(rules.computeFilingFee('small', false, 100000)).toBe(before.smallLate);
    expect(rules.computeFilingFee('large', true, 1000000)).toBe(before.largeOnTime);
    expect(rules.computeFilingFee('large', false, 1000000)).toBe(before.largeLate);
    expect(rules.getViolationDailyRate('small')).toBe(before.smallDaily);
    expect(rules.getViolationDailyRate('large')).toBe(before.largeDaily);
  });

  it('a reskin CSV with different numbers actually changes the economics', async () => {
    const rules = await import('../../src/utils/violationRules');

    const dndRows: ViolationRuleCsvRow[] = [
      { tier: 'small', threshold: '1000', deadline_days: '30', fee_rate_ontime: '0.10', fee_rate_late: '0.25', daily_rate: '5' },
      { tier: 'large', threshold: '1000', deadline_days: '30', fee_rate_ontime: '0.15', fee_rate_late: '0.30', daily_rate: '20' },
    ];
    rules.configureViolationRules(dndRows);

    expect(rules.VIOLATION_TIER_THRESHOLD).toBe(1000);
    expect(rules.VIOLATION_DEADLINE_DAYS).toBe(30);
    expect(rules.getViolationTier(999)).toBe('small');
    expect(rules.getViolationTier(1000)).toBe('large');
    expect(rules.computeFilingFee('small', true, 100)).toBe(10); // 10% of 100
    expect(rules.computeFilingFee('large', false, 100)).toBe(30); // 30% of 100
    expect(rules.getViolationDailyRate('small')).toBe(5);
    expect(rules.getViolationDailyRate('large')).toBe(20);

    const accrual = rules.computeDailyAccrual('large', 110, 100);
    expect(accrual.fee).toBe(10 * 20); // 10 overdue days at the new $20/day rate
  });

  it('missing CSV (empty rows) falls back to the built-in defaults without crashing', async () => {
    const rules = await import('../../src/utils/violationRules');
    const before = rules.VIOLATION_TIER_THRESHOLD;

    expect(() => rules.configureViolationRules([])).not.toThrow();

    expect(rules.VIOLATION_TIER_THRESHOLD).toBe(before);
    expect(rules.VIOLATION_TIER_THRESHOLD).toBe(500000);
  });

  it("missing a 'large' row falls back to the built-in defaults without crashing", async () => {
    const rules = await import('../../src/utils/violationRules');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const smallOnly: ViolationRuleCsvRow[] = [
      { tier: 'small', threshold: '1000', deadline_days: '30', fee_rate_ontime: '0.10', fee_rate_late: '0.25', daily_rate: '5' },
    ];
    expect(() => rules.configureViolationRules(smallOnly)).not.toThrow();

    expect(rules.VIOLATION_TIER_THRESHOLD).toBe(500000);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('a non-numeric field falls back to the built-in defaults without crashing', async () => {
    const rules = await import('../../src/utils/violationRules');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const malformed: ViolationRuleCsvRow[] = [
      { tier: 'small', threshold: '500000', deadline_days: '180', fee_rate_ontime: 'not-a-number', fee_rate_late: '0.08', daily_rate: '500' },
      { tier: 'large', threshold: '500000', deadline_days: '180', fee_rate_ontime: '0.10', fee_rate_late: '0.20', daily_rate: '2000' },
    ];
    expect(() => rules.configureViolationRules(malformed)).not.toThrow();

    expect(rules.computeFilingFee('small', true, 100000)).toBe(4000); // still the default 4%
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
