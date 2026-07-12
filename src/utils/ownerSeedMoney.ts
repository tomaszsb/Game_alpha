// ownerSeedMoney — the single source of truth for the owner's personal seed
// money calculation (OWNER-FUND-INITIATION). Was duplicated between
// TurnService.handleAutomaticFunding (direct-arrival flow) and
// EffectEngineService's OWNER_SEED_MONEY case (data-driven effect flow),
// each with its own Math.random() call — a drift risk flagged in the
// 2026-07-11 blind code review. Pure + shared so both call paths pay out
// the same amount for the same project scope (same pattern as contractorTerms).

export interface OwnerSeedMoneyResult {
  /** 0.8-1.2, the fraction of project scope invested. */
  multiplier: number;
  /** Final dollar amount, rounded to the nearest $10,000. */
  amount: number;
}

export function calculateOwnerSeedMoney(projectScope: number): OwnerSeedMoneyResult {
  const multiplier = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  const rawAmount = Math.round(projectScope * multiplier);
  const amount = Math.round(rawAmount / 10000) * 10000;
  return { multiplier, amount };
}
