/**
 * The bank's loan fee, read from the fee cell in the data (BANK-FUND-REVIEW's
 * `Fee` in Spaces.csv → SPACE_EFFECTS.csv `effect_value`), so the sentence a
 * player reads and the amount the game charges come from ONE place.
 *
 * Before 2026-10-18 the dollar limits were typed into FinancialEffectHandler
 * (1% to $1.4M, 2% to $2.75M, 3% above) while the cell said "between $1.5M and
 * 2.75M", which left a $1.4M-$1.5M gap and meant editing the text changed
 * nothing (independent review, REVIEW.md section 4 case 1).
 *
 * Shape the cell must have: tiers joined by " or ", each "N% ... up to $X"
 * (M or K allowed), the last one "N% above ...". Example:
 *   "1% for a loan up to $1.4M or 2% up to $2.75M or 3% above $2.75M"
 */
export interface LoanFeeTier {
  /** Highest loan this rate applies to; null = no limit (the last tier). */
  upTo: number | null;
  /** Fraction, e.g. 0.01 for 1%. */
  rate: number;
}

/** Used when the cell can't be read; matches the shipped data. */
export const DEFAULT_LOAN_FEE_TIERS: LoanFeeTier[] = [
  { upTo: 1_400_000, rate: 0.01 },
  { upTo: 2_750_000, rate: 0.02 },
  { upTo: null, rate: 0.03 },
];

function money(num: string, unit: string | undefined): number {
  const n = parseFloat(num);
  const u = (unit || '').toUpperCase();
  return Math.round(u === 'M' ? n * 1_000_000 : u === 'K' ? n * 1_000 : n);
}

/** Parse the fee cell into tiers, or null when it doesn't have the shape above. */
export function parseLoanFeeTiers(text: string): LoanFeeTier[] | null {
  const parts = String(text || '').split(/\s+or\s+/i);
  const tiers: LoanFeeTier[] = [];
  for (const [i, part] of parts.entries()) {
    const rate = part.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!rate) return null;
    const last = i === parts.length - 1;
    const cap = part.match(/up to\s*\$\s*([\d.]+)\s*([MK])?/i);
    if (last) {
      if (!/above/i.test(part) || cap) return null;
      tiers.push({ upTo: null, rate: parseFloat(rate[1]) / 100 });
    } else {
      if (!cap) return null;
      tiers.push({ upTo: money(cap[1], cap[2]), rate: parseFloat(rate[1]) / 100 });
    }
  }
  for (let i = 1; i < tiers.length - 1; i++) {
    if ((tiers[i].upTo ?? 0) <= (tiers[i - 1].upTo ?? 0)) return null;
  }
  return tiers.length >= 2 ? tiers : null;
}

/** The fee in dollars for a loan, from the data cell (defaults if unreadable). */
export function calculateTieredLoanFee(feeText: string, loan: number): number {
  if (!(loan > 0)) return 0;
  const tiers = parseLoanFeeTiers(feeText) ?? DEFAULT_LOAN_FEE_TIERS;
  const tier = tiers.find(t => t.upTo === null || loan <= t.upTo) ?? tiers[tiers.length - 1];
  return Math.round(loan * tier.rate);
}
