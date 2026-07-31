/**
 * Pure calculation rules for the Homeowner Violation mechanic (L050/L051).
 * No state access, no side effects — CardService/TurnService apply the
 * numbers this module computes. Mirrors the tier/fee split confirmed with
 * the maintainer 2026-07-31 (see TODO.md).
 */

export type ViolationTier = 'small' | 'large';
export type ViolationVariant = 'flat' | 'daily';

/** Total project scope at/above this threshold counts as the "large job" tier. */
export const VIOLATION_TIER_THRESHOLD = 500000;

/** Days a player has to file the Affidavit of Correction before the fee escalates. */
export const VIOLATION_DEADLINE_DAYS = 180;

/** Fee rate charged against the added Work Package's cost, by tier and on-time/late. */
const FEE_RATES: Record<ViolationTier, { onTime: number; late: number }> = {
  small: { onTime: 0.04, late: 0.08 },
  large: { onTime: 0.10, late: 0.20 },
};

/** Per-day accrual rate once L051's deadline has passed unfiled. */
const DAILY_RATES: Record<ViolationTier, number> = {
  small: 500,
  large: 2000,
};

export function getViolationTier(projectScope: number): ViolationTier {
  return projectScope >= VIOLATION_TIER_THRESHOLD ? 'large' : 'small';
}

/** Fee owed when filing the Affidavit, based on whether it's filed by the deadline. */
export function computeFilingFee(tier: ViolationTier, filedOnTime: boolean, penaltyBase: number): number {
  const rate = filedOnTime ? FEE_RATES[tier].onTime : FEE_RATES[tier].late;
  return Math.round(penaltyBase * rate);
}

export function getViolationDailyRate(tier: ViolationTier): number {
  return DAILY_RATES[tier];
}

/**
 * Daily accrual owed for L051 once time has passed the deadline.
 * `checkpoint` is the timeSpent value already charged up through; returns 0
 * if no new overdue days have elapsed since.
 */
export function computeDailyAccrual(tier: ViolationTier, timeSpent: number, checkpoint: number): { fee: number; newCheckpoint: number } {
  const overdueDays = timeSpent - checkpoint;
  if (overdueDays <= 0) {
    return { fee: 0, newCheckpoint: checkpoint };
  }
  return { fee: overdueDays * getViolationDailyRate(tier), newCheckpoint: timeSpent };
}
