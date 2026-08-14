/**
 * Pure calculation rules for the Homeowner Violation mechanic (L050/L051).
 * No state access, no side effects — CardService/TurnService apply the
 * numbers this module computes. Mirrors the tier/fee split confirmed with
 * the maintainer 2026-07-31 (see TODO.md).
 */

import type { ViolationRuleCsvRow } from '../types/DataTypes';

export type ViolationTier = 'small' | 'large';
export type ViolationVariant = 'flat' | 'daily';

/**
 * 2026-08-14: CSV-portability lift, reskin item 2 (last non-BLOCKING finding
 * from the 2026-08-03 Workstream 6 audit, TODO.md). Built-in fallback for
 * every number below — used verbatim when data/VIOLATION_RULES.csv is
 * missing or fails validation (see configureViolationRules), and as the
 * exported values' initial state so any caller that runs before the async
 * CSV fetch resolves still sees valid data.
 */
const DEFAULT_VIOLATION_TIER_THRESHOLD = 500000;
const DEFAULT_VIOLATION_DEADLINE_DAYS = 180;
const DEFAULT_FEE_RATES: Record<ViolationTier, { onTime: number; late: number }> = {
  small: { onTime: 0.04, late: 0.08 },
  large: { onTime: 0.10, late: 0.20 },
};
const DEFAULT_DAILY_RATES: Record<ViolationTier, number> = {
  small: 500,
  large: 2000,
};

/**
 * 2026-08-14: CSV-portability lift, reskin item 2. Mutable — reassigned in
 * place by configureViolationRules() once VIOLATION_RULES.csv loads at app
 * startup. Every consumer (CardService.ts, TurnService.ts) reads these at
 * gameplay time (inside a method body, when a card is actually played or a
 * game actually ends), never at module-import time, so a live-binding
 * reassignment here is picked up correctly everywhere.
 */
export let VIOLATION_TIER_THRESHOLD = DEFAULT_VIOLATION_TIER_THRESHOLD;
export let VIOLATION_DEADLINE_DAYS = DEFAULT_VIOLATION_DEADLINE_DAYS;
let FEE_RATES: Record<ViolationTier, { onTime: number; late: number }> = DEFAULT_FEE_RATES;
let DAILY_RATES: Record<ViolationTier, number> = DEFAULT_DAILY_RATES;

/**
 * Call once at app startup (after DataService.loadData() resolves) with
 * every row parsed from VIOLATION_RULES.csv, to let a reskin replace the
 * project-scope threshold, filing deadline, and fee/daily-accrual rates
 * without a code edit — e.g. a D&D-themed reskin could charge in gold
 * pieces at completely different rates. Only the numbers move; the 'small'/
 * 'large' tier names stay fixed (not reskin-extensible — the audit flagged
 * the hardcoded *numbers*, not the two-tier structure itself).
 *
 * Requires both a 'small' and a 'large' row with every field a valid
 * number; if either is missing or any field fails to parse, logs a clear
 * error and leaves every value at its built-in default untouched — the
 * game never crashes over a bad reskin CSV.
 */
export function configureViolationRules(rows: ViolationRuleCsvRow[]): void {
  if (!rows || rows.length === 0) return; // missing/empty VIOLATION_RULES.csv — built-in defaults stand

  const smallRow = rows.find(r => r.tier === 'small');
  const largeRow = rows.find(r => r.tier === 'large');
  if (!smallRow || !largeRow) {
    console.error("violationRules.ts: VIOLATION_RULES.csv must have a 'small' and a 'large' row — falling back to built-in defaults.");
    return;
  }

  const threshold = parseFloat(largeRow.threshold);
  const deadlineDays = parseFloat(smallRow.deadline_days);
  const smallOnTime = parseFloat(smallRow.fee_rate_ontime);
  const smallLate = parseFloat(smallRow.fee_rate_late);
  const largeOnTime = parseFloat(largeRow.fee_rate_ontime);
  const largeLate = parseFloat(largeRow.fee_rate_late);
  const smallDaily = parseFloat(smallRow.daily_rate);
  const largeDaily = parseFloat(largeRow.daily_rate);

  const parsed = [threshold, deadlineDays, smallOnTime, smallLate, largeOnTime, largeLate, smallDaily, largeDaily];
  if (parsed.some(n => isNaN(n))) {
    console.error('violationRules.ts: VIOLATION_RULES.csv has a non-numeric field — falling back to built-in defaults.', rows);
    return;
  }

  VIOLATION_TIER_THRESHOLD = threshold;
  VIOLATION_DEADLINE_DAYS = deadlineDays;
  FEE_RATES = {
    small: { onTime: smallOnTime, late: smallLate },
    large: { onTime: largeOnTime, late: largeLate },
  };
  DAILY_RATES = { small: smallDaily, large: largeDaily };
}

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
