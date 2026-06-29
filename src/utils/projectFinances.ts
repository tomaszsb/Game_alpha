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

export interface WorkPackage {
  id: string;
  name: string;
  cost: number;
  trade: string;
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
  /** Money raised across all sources. */
  fundingRaised: number;
  /** Cash on hand right now. */
  cash: number;
  /** Total spent across all areas. */
  spent: number;
  /** Days burned. */
  days: number;
  /** Scope + budgeted uses the player is on the hook for. */
  commitments: number;
  /** commitments − fundingRaised, floored at 0 (the old "deficit"). */
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

  const workPackages: WorkPackage[] = wCards.map((c) => ({
    id: c.card_id || '',
    name: c.card_name || c.card_id || 'Work package',
    cost: num(c.cost),
    trade: (c.work_type_restriction || '').trim() || 'Other work',
  }));
  const scopeTotal = workPackages.reduce((s, w) => s + w.cost, 0);

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
  const constructionBudget = wCards.reduce((s, c) => s + num(c.work_cost), 0);

  const designBudget = Math.round(scopeTotal * 0.20);
  const regulatoryBudget = Math.round(scopeTotal * 0.05);
  const totalUseBudget = designBudget + regulatoryBudget + constructionBudget;
  const contingencyBudget = Math.round(totalUseBudget * 0.10);

  const designSpent = num(ex.design);
  const regulatorySpent = num(ex.fees);
  const constructionSpent = num(ex.construction);
  const contingencyUsed =
    Math.max(0, designSpent - designBudget) + Math.max(0, regulatorySpent - regulatoryBudget);

  const fundingRaised =
    num(ms.ownerFunding) + num(ms.bankLoans) + num(ms.investmentDeals) + num(ms.other);
  const spent = designSpent + regulatorySpent + constructionSpent;
  const commitments = scopeTotal + designBudget + regulatoryBudget + contingencyBudget;
  const fundingGap = Math.max(0, commitments - fundingRaised);

  return {
    scopeTotal,
    workPackages,
    scopeByTrade,
    design: { budget: designBudget, spent: designSpent },
    regulatory: { budget: regulatoryBudget, spent: regulatorySpent },
    construction: { budget: constructionBudget, spent: constructionSpent },
    contingency: { budget: contingencyBudget, used: contingencyUsed },
    fundingRaised,
    cash: num(player.money),
    spent,
    days: num(player.timeSpent),
    commitments,
    fundingGap,
  };
}
