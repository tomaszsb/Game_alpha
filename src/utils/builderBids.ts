// builderBids — the pure rules of "Hire a Builder": a few builders bid, each shows a PRICE,
// the DAYS the job takes and how long that price is held; the work quality stays hidden until
// someone is hired. Nothing here touches state. The numbers (how many bidders, the price-hold
// options, the quality names and their problem points) come from TROPHIES.csv through
// trophyRules; the price/days themselves come from contractorTerms, the one formula the
// engine also charges with, so a quote and the bill can never disagree.
//
// Rules (Tom, 2026-10-08):
//  - each bidder is drawn independently (two identical bidders are possible);
//  - a bid's price holds for its own number of days; a lapsed bid is replaced by a fresh one;
//  - ANY change to the plan (scope or work cost) voids every bid;
//  - the quoted price and days are exactly what is paid and waited.

import { computeContractorTerms } from './contractorTerms';
import type { BuilderQuality, BuilderRules } from './trophyRules';
import { BUILDER_QUALITIES } from './trophyRules';

export interface BuilderBid {
  id: string;
  /** Hidden from the player until this builder is hired. */
  quality: BuilderQuality;
  /** The 1-6 size of the job as the builder reads it (feeds computeContractorTerms). */
  roll: number;
  /** Whole dollars, charged at signing. */
  price: number;
  /** Days the job adds to the schedule. */
  days: number;
  /** How many days the price is held, counted from the day it was quoted. */
  guaranteeDays: number;
  /** The last project day the price still holds. */
  expiresDay: number;
}

export type LapseReason = 'expired' | 'plan_changed';

export interface LapsedBid {
  reason: LapseReason;
  guaranteeDays: number;
  price: number;
  /** The project day it was found lapsed. */
  day: number;
}

export interface BuilderBidSet {
  /** Identifies the plan the bids were priced against; a different key voids them all. */
  planKey: string;
  bids: BuilderBid[];
  /** What lapsed the last time anything did, so the screen can say so plainly. */
  lapsed: LapsedBid[];
  /** Counter for bid ids, so an id is never reused within one player's life. */
  nextId: number;
  /** The bid that was signed, once one was (the screen shows what the deal turned out to be). */
  hiredId?: string;
}

export type Rng = () => number;

export interface BidContext {
  rng: Rng;
  /** The project's total work cost today (what computeContractorTerms prices against). */
  workCost: number;
  /** Anything else that makes today's plan different from yesterday's (scope, work packages). */
  scope: number;
  /** The player's project day. */
  day: number;
  rules: BuilderRules;
}

/** Deep copy (the set sits inside TEMP/REAL snapshots that must never share references). */
export function cloneBuilderBids(set: BuilderBidSet | undefined): BuilderBidSet | undefined {
  return set ? { ...set, bids: set.bids.map((b) => ({ ...b })), lapsed: set.lapsed.map((l) => ({ ...l })) } : undefined;
}

export function planKeyOf(scope: number, workCost: number): string {
  return `${Math.round(scope)}|${Math.round(workCost)}`;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** One fresh bidder: quality, job size and price-hold each drawn on their own. */
export function drawBid(ctx: BidContext, id: string): BuilderBid {
  const quality = pick(ctx.rng, BUILDER_QUALITIES);
  const roll = 1 + Math.min(5, Math.floor(ctx.rng() * 6));
  const guaranteeDays = pick(ctx.rng, ctx.rules.guaranteeDays);
  const terms = computeContractorTerms(ctx.workCost, roll, quality);
  return {
    id,
    quality,
    roll,
    price: terms.cost,
    days: terms.scheduleDays,
    guaranteeDays,
    expiresDay: ctx.day + guaranteeDays,
  };
}

/** Is this bid's price still held on `day`? (Held through its last day.) */
export function isBidLive(bid: BuilderBid, day: number): boolean {
  return day <= bid.expiresDay;
}

/**
 * Bring the bids up to date. No bids yet, or a changed plan: a whole new field (and, if there
 * WERE bids, a note that they lapsed because the plan changed). Otherwise only the lapsed ones
 * are replaced, each by a fresh independent draw. Returns the same set when nothing changed.
 */
export function refreshBids(prev: BuilderBidSet | undefined, ctx: BidContext): BuilderBidSet {
  const planKey = planKeyOf(ctx.scope, ctx.workCost);
  let nextId = prev?.nextId ?? 1;
  const fresh = (): BuilderBid => drawBid(ctx, `bid-${nextId++}`);

  if (!prev || prev.planKey !== planKey) {
    const lapsed: LapsedBid[] = prev
      ? prev.bids.map((b) => ({ reason: 'plan_changed' as const, guaranteeDays: b.guaranteeDays, price: b.price, day: ctx.day }))
      : [];
    const bids = Array.from({ length: ctx.rules.bidsOffered }, fresh);
    return { planKey, bids, lapsed: prev ? lapsed : [], nextId };
  }

  const lapsedNow: LapsedBid[] = [];
  const bids = prev.bids.map((b) => {
    if (isBidLive(b, ctx.day)) return b;
    lapsedNow.push({ reason: 'expired', guaranteeDays: b.guaranteeDays, price: b.price, day: ctx.day });
    return fresh();
  });
  if (lapsedNow.length === 0) return prev;
  return { planKey, bids, lapsed: lapsedNow, nextId };
}

/** The cheapest bid still held, with the days left on its price; undefined when none is live. */
export function cheapestLiveBid(set: BuilderBidSet | undefined, day: number): { price: number; days: number; daysLeft: number } | undefined {
  if (!set) return undefined;
  const live = set.bids.filter((b) => isBidLive(b, day));
  if (live.length === 0) return undefined;
  const best = live.reduce((a, b) => (b.price < a.price ? b : a));
  return { price: best.price, days: best.days, daysLeft: best.expiresDay - day };
}

/** A rough "about" figure for a player who has no bids yet: a middling builder on a middling job. */
export function typicalQuote(workCost: number): number {
  return computeContractorTerms(workCost, 3, 'MED').cost;
}
