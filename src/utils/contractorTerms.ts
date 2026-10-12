// contractorTerms — the single source of truth for what signing a contractor
// costs in money AND days (CON-INITIATION's Quality + Multiplier dice).
//
// v3.0.92 redesign (maintainer call, 2026-07-02 — "A and C, I want time to
// vary too"). The old formula charged scope × (roll × 0.1) × quality
// (HIGH 1.5 / MED 1.0 / LOW 0.6), i.e. 6%–90% of the scope estimate, averaging
// ~36% — the build always came in wildly "under budget" vs the estimates shown
// in "My numbers", and the multiplier's documented time meaning (ACTION_TOOLTIPS:
// "multiply scope days") was never implemented.
//
// New model — a bid centered on the estimate, plus a real schedule:
//   price = totalWorkCost × (0.7 + roll × 0.1) × qualityPrice
//     → 80%–130% of the estimate before quality; expected ≈ 105% overall.
//   scheduleDays = roll × 10 × qualitySpeed, rounded
//     → 8–78 days added at signing; expected ≈ 36.
//   quality is the trade dial ("Quality, cost, schedule — pick two"):
//     HIGH crew: +15% price, ×0.8 schedule (costs more, builds faster)
//     MED  crew: baseline
//     LOW  crew: −10% price, ×1.3 schedule (saves money, drags the job)
//
// Pure + shared so the engine charge, the dice modal, and any ledger display
// can never disagree (same pattern as projectFinances).
//
// v3.7.21: every number above (the quality factors, 0.7 + roll x 0.1, 10 days per roll, the 1-6 job size)
// is now data: TROPHIES.csv `builder_price` / `builder_speed` rows and the `builder_*` rules, read through
// utils/trophyRules.ts. The figures here are the stock values the file ships with.
import { getBuilderRules, type ContractorTermsRules } from './trophyRules';

export type ContractorQuality = 'HIGH' | 'MED' | 'LOW';

export interface ContractorTerms {
  /** Dollar amount charged at signing. */
  cost: number;
  /** Days added to the schedule at signing. */
  scheduleDays: number;
  /** price ÷ totalWorkCost — how the bid compares to the estimate (e.g. 1.04). */
  priceFactor: number;
}

export function computeContractorTerms(
  totalWorkCost: number,
  multiplier: number,
  quality: ContractorQuality,
  terms: ContractorTermsRules = getBuilderRules().terms,
): ContractorTerms {
  const safeWorkCost = totalWorkCost > 0 ? totalWorkCost : 0;
  const roll = multiplier >= terms.rollMin && multiplier <= terms.rollMax ? multiplier : terms.rollDefault;
  // Stock data: roll 1 -> 0.8x, roll 6 -> 1.3x the estimate before quality; roll 1 MED -> 10 days, roll 6 MED -> 60.
  const priceFactor = (terms.basePrice + roll * terms.priceStep) * (terms.qualityPrice[quality] ?? 1.0);
  const cost = Math.round(safeWorkCost * priceFactor);
  const scheduleDays = Math.round(roll * terms.daysPerRoll * (terms.qualitySpeed[quality] ?? 1.0));
  return { cost, scheduleDays, priceFactor };
}
