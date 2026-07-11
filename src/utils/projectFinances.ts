// projectFinances — the canonical "where does the money stand" computation for
// the player's project, extracted so the new-view ledger (PlayerNumbersV2) has
// the financial depth the old classic ProjectLedger had WITHOUT duplicating its
// math inline. Pure + service-free (takes a card lookup) so it's unit-testable
// without React or the service container.
//
// Budget assumptions mirror the classic ledger exactly (design ~20% of scope,
// regulatory ~5%, contingency 10% of total uses) so a player comparing the two
// during the migration sees the same numbers.

import { Player } from '../types/StateTypes';

/** Minimal shape we read off a card — matches DataService.getCardById results. */
interface CardLike {
  card_id?: string;
  card_name?: string;
  card_type?: string;
  cost?: number | string;
  work_cost?: number | string;
  /** DOB work type (General Construction / Plumbing / Sprinklers / …) = the trade. */
  work_type_restriction?: string;
}

/**
 * The soft costs + buffer a single work package carries, allocated from the
 * project-wide budgets by this package's share of total scope. Drives the
 * per-item drill-down in the ledger so a player can see WHY the money they must
 * raise is bigger than the bare construction cost: the owner's prices fold in
 * design fees, city filings, and a contingency buffer.
 *
 * design + regulatory + contingency are each `<aggregate budget> × scopeShare`,
 * so summing every package's `fullCost` reconciles to `commitments` (the figure
 * "Still to raise" is measured against).
 */
export interface WorkPackageBreakdown {
  /** The build itself — this package's W-card `cost`. */
  build: number;
  /** Allocated share of the 20%-of-scope design budget. */
  design: number;
  /** Allocated share of the 5%-of-scope regulatory/filings budget. */
  regulatory: number;
  /** Allocated share of the contingency buffer. */
  contingency: number;
}

export interface WorkPackage {
  id: string;
  name: string;
  cost: number;
  trade: string;
  /** Loaded cost components (build + design + filings + buffer). */
  breakdown: WorkPackageBreakdown;
  /** build + design + regulatory + contingency — the fully-loaded cost. */
  fullCost: number;
}

/** Work packages grouped by trade (DOB work type), with a per-trade subtotal. */
export interface TradeGroup {
  trade: string;
  total: number;
  packages: WorkPackage[];
}

export interface ProjectArea {
  budget: number;
  spent: number;
}

export interface ProjectFinances {
  /** Sum of W-card `cost` values — what's being built. */
  scopeTotal: number;
  /** Each held/active work package with its cost + trade, for the scope lines. */
  workPackages: WorkPackage[];
  /** Work packages grouped by trade (DOB work type), preserving first-seen order. */
  scopeByTrade: TradeGroup[];
  /** Spent-vs-budget per project area (the old ledger's "uses" breakdown). */
  design: ProjectArea;
  regulatory: ProjectArea;
  construction: ProjectArea;
  /** Contingency buffer: how much overrun has eaten into it. */
  contingency: { budget: number; used: number };
  /** Outside money only — bank loans + investor deals + other. Excludes the
   *  owner's own seed money, which isn't "raised" from anyone (design
   *  decision 2026-07-10, fb:feedback-1783081115822-cac490a5). This is what
   *  the "Funding raised" ledger line displays. */
  fundingRaised: number;
  /** Every dollar the player has ever had access to — owner seed money PLUS
   *  fundingRaised. This is the real number for "can they cover the
   *  project," so fundingGap and the low-cash warning threshold use THIS,
   *  not the narrower display-only fundingRaised above. */
  totalCapital: number;
  /** Cash on hand right now. */
  cash: number;
  /** Total spent across all areas. */
  spent: number;
  /** Days burned. */
  days: number;
  /** Scope + budgeted uses the player is on the hook for. */
  commitments: number;
  /** commitments − totalCapital, floored at 0 (the old "deficit") — measured
   *  against every dollar available, not just outside funding. */
  fundingGap: number;
}

const num = (v: number | string | undefined): number => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
};

export function computeProjectFinances(
  player: Player,
  getCardById: (id: string) => CardLike | null | undefined,
): ProjectFinances {
  const ms = player.moneySources || { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
  const ex = player.expenditures || { design: 0, fees: 0, construction: 0 };

  const cardIds = [
    ...(player.hand || []),
    ...((player.activeCards || []).map((ac) => ac.cardId)),
  ];
  const wCards = cardIds
    .map((id) => getCardById(id))
    .filter((c): c is CardLike => !!c && c.card_type === 'W');

  // Scope + the project-wide budgets first, so each work package can carry its
  // allocated share of the soft costs (the per-item drill-down).
  const scopeTotal = wCards.reduce((s, c) => s + num(c.cost), 0);
  const constructionBudget = wCards.reduce((s, c) => s + num(c.work_cost), 0);

  const designBudget = Math.round(scopeTotal * 0.20);
  const regulatoryBudget = Math.round(scopeTotal * 0.05);
  const totalUseBudget = designBudget + regulatoryBudget + constructionBudget;
  const contingencyBudget = Math.round(totalUseBudget * 0.10);

  const workPackages: WorkPackage[] = wCards.map((c) => {
    const cost = num(c.cost);
    // Allocate the soft costs by this package's share of scope, so the drill-down
    // adds up within a row and every package's fullCost sums to `commitments`.
    const share = scopeTotal > 0 ? cost / scopeTotal : 0;
    const design = Math.round(designBudget * share);
    const regulatory = Math.round(regulatoryBudget * share);
    const contingency = Math.round(contingencyBudget * share);
    return {
      id: c.card_id || '',
      name: c.card_name || c.card_id || 'Work package',
      cost,
      trade: (c.work_type_restriction || '').trim() || 'Other work',
      breakdown: { build: cost, design, regulatory, contingency },
      fullCost: cost + design + regulatory + contingency,
    };
  });

  // Group by trade, preserving the order each trade first appears.
  const scopeByTrade: TradeGroup[] = [];
  const byTrade = new Map<string, TradeGroup>();
  for (const w of workPackages) {
    let g = byTrade.get(w.trade);
    if (!g) {
      g = { trade: w.trade, total: 0, packages: [] };
      byTrade.set(w.trade, g);
      scopeByTrade.push(g);
    }
    g.total += w.cost;
    g.packages.push(w);
  }

  const designSpent = num(ex.design);
  const regulatorySpent = num(ex.fees);
  const constructionSpent = num(ex.construction);
  const contingencyUsed =
    Math.max(0, designSpent - designBudget) + Math.max(0, regulatorySpent - regulatoryBudget);

  const fundingRaised = num(ms.bankLoans) + num(ms.investmentDeals) + num(ms.other);
  const totalCapital = num(ms.ownerFunding) + fundingRaised;
  const spent = designSpent + regulatorySpent + constructionSpent;
  const commitments = scopeTotal + designBudget + regulatoryBudget + contingencyBudget;
  const fundingGap = Math.max(0, commitments - totalCapital);

  return {
    scopeTotal,
    workPackages,
    scopeByTrade,
    design: { budget: designBudget, spent: designSpent },
    regulatory: { budget: regulatoryBudget, spent: regulatorySpent },
    construction: { budget: constructionBudget, spent: constructionSpent },
    contingency: { budget: contingencyBudget, used: contingencyUsed },
    fundingRaised,
    totalCapital,
    cash: num(player.money),
    spent,
    days: num(player.timeSpent),
    commitments,
    fundingGap,
  };
}
