// src/utils/endGameStats.ts
//
// fb:cc345da9 + fb:3483b37b — playtester reached the end of a game and saw a
// bare "Game completed at: {timestamp}" screen. Wanted: "what we built, how
// much, how long, how many changes to scope, how many fees" + the movement log.
//
// This file is the *data layer* of the upgraded end-screen: a pure function
// that takes a Player (post-win state) and returns a structured stats object
// that EndGameModal renders. Pulling it out as a pure helper makes the
// computation unit-testable without React or service mocks, and gives us one
// place to extend when new stat categories arrive.

import { Player, CardType } from '../types/DataTypes';

export interface FundingMix {
  owner: number;
  bank: number;
  investor: number;
  other: number;
  total: number;
}

export interface FeesBreakdown {
  architectural: number;
  engineering: number;
  regulatory: number;
  expeditor: number;
  investmentFee: number;
  miscellaneous: number;
  totalFees: number;
}

export interface ConstructionInfo {
  workCardCount: number;
  /** Sum of W-card `cost` fields. Caller-supplied because computing it
   *  requires DataService. Same value as projectScope. */
  constructionScope: number;
  contractorQuality?: 'HIGH' | 'MED' | 'LOW';
  contractorMultiplier?: number;
  contractorHiredAt?: string;
}

// Mirror of DataTypes ApprovalStatus minus the optional/undefined case.
// Surfaced here so end-screen render code doesn't have to know about the
// raw 4-state enum.
export type EndGameApprovalStatus = 'approved' | 'denied' | 'minor-objection' | 'none';

export interface ApprovalStatusPair {
  dob: EndGameApprovalStatus;
  fdny: EndGameApprovalStatus;
}

export interface JourneyStep {
  spaceName: string;
  daysSpent: number;
  entryTurn: number;
}

export interface CardCounts {
  W: number;
  B: number;
  E: number;
  L: number;
  I: number;
}

export interface EndGameStats {
  // Headline numbers
  projectScope: number;     // Caller-supplied from gameRulesService.calculateProjectScope
  totalSpent: number;       // Sum of all costHistory entries
  daysTotal: number;        // player.timeSpent
  turnsTaken: number;       // Last visit log entry's entryTurn (best per-player approximation)
  finalScore: number;       // player.score

  fundingMix: FundingMix;
  feesBreakdown: FeesBreakdown;
  construction: ConstructionInfo;
  approvals: ApprovalStatusPair;
  journey: JourneyStep[];
  cardCounts: CardCounts;
}

export interface BuildStatsOptions {
  /** Caller injects the result of gameRulesService.calculateProjectScope(playerId).
   *  Kept out of this pure helper so we don't drag service dependencies in. */
  projectScope: number;
}

/**
 * Derive the end-game stats panel from a player's post-win state.
 *
 * All numbers are taken from fields the game already tracks
 * (player.moneySources, player.costs, player.costHistory, player.spaceVisitLog,
 * player.contractor, player.{dob,fdny}ApprovalStatus, player.hand,
 * player.activeCards). The projectScope number is injected by the caller
 * since computing it requires the DataService.
 */
export function buildEndGameStats(player: Player, opts: BuildStatsOptions): EndGameStats {
  // === Funding mix (where money came from) ===
  const ms = player.moneySources || { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
  const fundingMix: FundingMix = {
    owner: ms.ownerFunding,
    bank: ms.bankLoans,
    investor: ms.investmentDeals,
    other: ms.other,
    total: ms.ownerFunding + ms.bankLoans + ms.investmentDeals + ms.other,
  };

  // === Fees breakdown (where money went) ===
  // player.costs is the running CostBreakdown summary; fall back to defaults
  // for legacy games where it might be unset.
  const c = player.costs || {
    bank: 0, investor: 0,
    expeditor: 0, architectural: 0, engineering: 0,
    regulatory: 0, investmentFee: 0, miscellaneous: 0,
    total: 0,
  };
  const feesBreakdown: FeesBreakdown = {
    architectural: c.architectural,
    engineering: c.engineering,
    regulatory: c.regulatory,
    expeditor: c.expeditor,
    investmentFee: c.investmentFee,
    miscellaneous: c.miscellaneous,
    // The "total fees" we display is the sum of *fee* categories — bank and
    // investor are funding repayment, not fees, so they don't belong here.
    totalFees:
      c.architectural + c.engineering + c.regulatory +
      c.expeditor + c.investmentFee + c.miscellaneous,
  };

  // === Total spent (sum of full cost history) ===
  // costHistory captures every individual outflow with its category. Summing
  // it gives "all money that left the player" — fees + repayments + misc.
  const totalSpent = (player.costHistory || []).reduce((sum, entry) => sum + entry.amount, 0);

  // === Construction info ===
  const workCardIds = [
    ...player.hand.filter(id => id.startsWith('W')),
    ...(player.activeCards || []).map(ac => ac.cardId).filter(id => id.startsWith('W')),
  ];
  const construction: ConstructionInfo = {
    workCardCount: workCardIds.length,
    constructionScope: opts.projectScope,
    contractorQuality: player.contractor?.quality,
    contractorMultiplier: player.contractor?.multiplier,
    contractorHiredAt: player.contractor?.hiredAt,
  };

  // === Approvals ===
  // DataTypes ApprovalStatus is 'none' | 'minor-objection' | 'approved' | 'denied'
  // (or undefined). Normalize undefined to 'none' for the end-screen view.
  const approvals: ApprovalStatusPair = {
    dob: normalizeApprovalStatus(player.dobApprovalStatus),
    fdny: normalizeApprovalStatus(player.fdnyApprovalStatus),
  };

  // === Journey ===
  // spaceVisitLog is already ordered by entryTurn/entryTime. The current
  // (winning) space is the final entry. Map to a thin shape for rendering.
  const journey: JourneyStep[] = (player.spaceVisitLog || []).map(rec => ({
    spaceName: rec.spaceName,
    daysSpent: rec.daysSpent,
    entryTurn: rec.entryTurn,
  }));

  // === Turns taken (best per-player approximation) ===
  // The global turn counter sits on GameState, not Player. The closest
  // per-player number is the entryTurn of the most recent visit — that's the
  // turn on which this player landed at the winning space.
  const turnsTaken = journey.length > 0 ? journey[journey.length - 1].entryTurn : 0;

  // === Cards by type ===
  // Count hand + activeCards together. Hand alone undercounts because some
  // cards are auto-activated on draw (B / I funding cards in particular).
  const cardCounts: CardCounts = { W: 0, B: 0, E: 0, L: 0, I: 0 };
  const all = [
    ...player.hand,
    ...(player.activeCards || []).map(ac => ac.cardId),
  ];
  for (const cardId of all) {
    const t = cardId.charAt(0) as CardType;
    if (t === 'W' || t === 'B' || t === 'E' || t === 'L' || t === 'I') {
      cardCounts[t]++;
    }
  }

  return {
    projectScope: opts.projectScope,
    totalSpent,
    daysTotal: player.timeSpent,
    turnsTaken,
    finalScore: player.score,
    fundingMix,
    feesBreakdown,
    construction,
    approvals,
    journey,
    cardCounts,
  };
}

function normalizeApprovalStatus(status: string | undefined): EndGameApprovalStatus {
  if (status === 'approved') return 'approved';
  if (status === 'denied') return 'denied';
  if (status === 'minor-objection') return 'minor-objection';
  return 'none';
}

// === Formatting helpers (kept here so the test file can pin them too) ===

export function formatMoney(amount: number): string {
  // Match the rest of the app's $123,456 format. Negative amounts get a leading
  // minus sign rather than parens.
  const abs = Math.abs(amount);
  const formatted = `$${abs.toLocaleString('en-US')}`;
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const pct = Math.round((part / whole) * 100);
  return `${pct}%`;
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
