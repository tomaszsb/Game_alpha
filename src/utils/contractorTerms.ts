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

export type ContractorQuality = 'HIGH' | 'MED' | 'LOW';

export interface ContractorTerms {
  /** Dollar amount charged at signing. */
  cost: number;
  /** Days added to the schedule at signing. */
  scheduleDays: number;
  /** price ÷ totalWorkCost — how the bid compares to the estimate (e.g. 1.04). */
  priceFactor: number;
}

const QUALITY_PRICE: Record<ContractorQuality, number> = { HIGH: 1.15, MED: 1.0, LOW: 0.9 };
const QUALITY_SPEED: Record<ContractorQuality, number> = { HIGH: 0.8, MED: 1.0, LOW: 1.3 };
const BASE_BID = 0.7;         // roll 1 → 0.8×, roll 6 → 1.3× the estimate
const BID_STEP = 0.1;
const DAYS_PER_ROLL = 10;     // roll 1 MED → 10 days, roll 6 MED → 60 days

export function computeContractorTerms(
  totalWorkCost: number,
  multiplier: number,
  quality: ContractorQuality,
): ContractorTerms {
  const safeWorkCost = totalWorkCost > 0 ? totalWorkCost : 0;
  const roll = multiplier >= 1 && multiplier <= 6 ? multiplier : 3;
  const priceFactor = (BASE_BID + roll * BID_STEP) * (QUALITY_PRICE[quality] ?? 1.0);
  const cost = Math.round(safeWorkCost * priceFactor);
  const scheduleDays = Math.round(roll * DAYS_PER_ROLL * (QUALITY_SPEED[quality] ?? 1.0));
  return { cost, scheduleDays, priceFactor };
}
