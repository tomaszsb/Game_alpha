import { describe, it, expect } from 'vitest';
import {
  getViolationTier,
  computeFilingFee,
  computeDailyAccrual,
  getViolationDailyRate,
  VIOLATION_TIER_THRESHOLD,
  VIOLATION_DEADLINE_DAYS,
} from '../../src/utils/violationRules';

describe('violationRules', () => {
  describe('getViolationTier', () => {
    it('classifies scope below the threshold as small', () => {
      expect(getViolationTier(0)).toBe('small');
      expect(getViolationTier(VIOLATION_TIER_THRESHOLD - 1)).toBe('small');
    });

    it('classifies scope at or above the threshold as large', () => {
      expect(getViolationTier(VIOLATION_TIER_THRESHOLD)).toBe('large');
      expect(getViolationTier(VIOLATION_TIER_THRESHOLD + 1)).toBe('large');
      expect(getViolationTier(5_000_000)).toBe('large');
    });
  });

  describe('computeFilingFee', () => {
    it('charges half the small-tier rate (4%) when filed on time', () => {
      expect(computeFilingFee('small', true, 100000)).toBe(4000);
    });

    it('charges the full small-tier rate (8%) when filed late', () => {
      expect(computeFilingFee('small', false, 100000)).toBe(8000);
    });

    it('charges half the large-tier rate (10%) when filed on time', () => {
      expect(computeFilingFee('large', true, 1000000)).toBe(100000);
    });

    it('charges the full large-tier rate (20%) when filed late', () => {
      expect(computeFilingFee('large', false, 1000000)).toBe(200000);
    });

    it('rounds to the nearest dollar', () => {
      expect(computeFilingFee('small', true, 33333)).toBe(Math.round(33333 * 0.04));
    });
  });

  describe('getViolationDailyRate', () => {
    it('returns $500/day for small tier and $2000/day for large tier', () => {
      expect(getViolationDailyRate('small')).toBe(500);
      expect(getViolationDailyRate('large')).toBe(2000);
    });
  });

  describe('computeDailyAccrual', () => {
    it('charges nothing when timeSpent has not passed the checkpoint', () => {
      const result = computeDailyAccrual('small', 100, 100);
      expect(result.fee).toBe(0);
      expect(result.newCheckpoint).toBe(100);
    });

    it('charges nothing when timeSpent is still behind the checkpoint', () => {
      const result = computeDailyAccrual('small', 90, 100);
      expect(result.fee).toBe(0);
      expect(result.newCheckpoint).toBe(100);
    });

    it('charges for each overdue day since the checkpoint (small tier)', () => {
      const result = computeDailyAccrual('small', 110, 100);
      expect(result.fee).toBe(10 * 500);
      expect(result.newCheckpoint).toBe(110);
    });

    it('charges for each overdue day since the checkpoint (large tier)', () => {
      const result = computeDailyAccrual('large', 105, 100);
      expect(result.fee).toBe(5 * 2000);
      expect(result.newCheckpoint).toBe(105);
    });
  });

  it('deadline is 180 days', () => {
    expect(VIOLATION_DEADLINE_DAYS).toBe(180);
  });
});
