// ownerSeedMoney — the single source of truth for the owner's personal seed
// money calculation (OWNER-FUND-INITIATION). Was duplicated between
// TurnService.handleAutomaticFunding (direct-arrival flow) and
// EffectEngineService's OWNER_SEED_MONEY case (data-driven effect flow),
// each with its own Math.random() call — a drift risk flagged in the
// 2026-07-11 blind code review. Pure + shared so both call paths pay out
// the same amount for the same project scope (same pattern as contractorTerms).

import { getOwnerSeedRules } from './trophyRules';

// v3.7.23: the 0.8 to 1.2 range and the $10,000 rounding are data (TROPHIES.csv `owner_seed_min`,
// `owner_seed_max`, `owner_seed_round`), read through utils/trophyRules.ts; the stock file ships 0.8, 1.2, 10000.
export interface OwnerSeedMoneyResult {
  /** The fraction of project scope invested (stock 0.8-1.2). */
  multiplier: number;
  /** Final dollar amount, rounded to the nearest $10,000. */
  amount: number;
}

export function calculateOwnerSeedMoney(projectScope: number): OwnerSeedMoneyResult {
  const { min, max, round } = getOwnerSeedRules();
  // Rounded so the stock 1.2 - 0.8 is exactly 0.4 (floating point gives 0.3999...), keeping every amount as before.
  const spread = Math.round((max - min) * 1e6) / 1e6;
  const multiplier = min + Math.random() * spread;
  const rawAmount = Math.round(projectScope * multiplier);
  const amount = Math.round(rawAmount / round) * round;
  return { multiplier, amount };
}
