// src/utils/lifeEventReceipts.ts
//
// Shared "what just happened" receipt logic for auto-applied Life Event cards.
//
// History: the snapshot/diff lived privately inside CardEffectHandler (v3.0.40),
// but a second emission path — SpaceArrivalProcessor's 1-in-6 dice piggyback —
// emitted the life_event modal WITHOUT receipts, so players on that (common)
// path saw only the raw card text and none of the realized outcome
// (fb:7a2a2956 / fb:701b26e3, v3.0.66 playtest). Rather than mirror the diff in
// two places (the exact parallel-system trap the v3.0.6x audit is closing),
// both paths now call this one module.

import type { Player } from '../types/DataTypes';
import type { LifeEventEffectSummary } from '../services/StateService';
import { getCardTypeName } from './cardTypeNames';

/** A card held in hand, captured so the diff can name what was lost/gained. */
export interface SnapshotCard {
  id: string;
  /** Card-type code (W/B/E/L/I) — turned into a player-facing name by the diff. */
  type: string;
  /** Card name (for E cards this is the expeditor's name). */
  name: string;
}

export interface LifeEventSnapshot {
  money: number;
  timeSpent: number;
  handSize: number;
  activeEffectsCount: number;
  dobApprovalStatus?: string;
  fdnyApprovalStatus?: string;
  /**
   * The player's hand at snapshot time. Optional — only populated when the
   * caller passes a card resolver (both engine call sites do). When present on
   * both before/after, the diff names *which* cards were lost/gained
   * (fb:0fc63fc1 "doesn't tell which resource", fb:0001f5df "which expeditors
   * got taken"); when absent it falls back to the count-only label.
   */
  handCards?: SnapshotCard[];
}

/** Resolves a card id to the bits the receipt needs to name it. */
export type CardResolver = (id: string) => { card_type?: string; card_name?: string } | undefined | null;

/**
 * Snapshot the player fields an auto-applied L-card can change. Kept narrow on
 * purpose: money, time, approval state, hand size, active-effects count — the
 * fields the Kids A–E life-event effects touch. Wider state changes belong in
 * their own modal. Returns null when the player is missing so callers can skip.
 *
 * Pass `resolveCard` (the engine paths have `dataService`) to also capture the
 * hand by identity, so the diff can name the specific cards lost/gained.
 */
export function snapshotPlayerForLifeEvent(
  player: Player | null | undefined,
  resolveCard?: CardResolver,
): LifeEventSnapshot | null {
  if (!player) return null;
  const hand = player.hand ?? [];
  return {
    money: player.money,
    timeSpent: player.timeSpent,
    handSize: hand.length,
    activeEffectsCount: (player.activeEffects ?? []).length,
    dobApprovalStatus: player.dobApprovalStatus,
    fdnyApprovalStatus: player.fdnyApprovalStatus,
    handCards: resolveCard
      ? hand.map((id) => {
          const card = resolveCard(id);
          return { id, type: card?.card_type ?? '', name: card?.card_name ?? '' };
        })
      : undefined,
  };
}

/**
 * Diff two snapshots into player-facing receipt lines, in reading order:
 * money/time deltas first (most concrete), then approval flips, then card
 * gains/losses, then duration. Returns [] if either snapshot is missing or
 * nothing changed.
 *
 * `primaryCardId` is the L-card itself; pass it so the +1 hand bump from the
 * card landing in hand is subtracted and only *extra* gains/losses show.
 */
export function diffLifeEventSnapshot(
  before: LifeEventSnapshot | null,
  after: LifeEventSnapshot | null,
  primaryCardId?: string
): LifeEventEffectSummary[] {
  if (!before || !after) return [];
  const out: LifeEventEffectSummary[] = [];

  const moneyDelta = after.money - before.money;
  if (moneyDelta !== 0) {
    const sign = moneyDelta > 0 ? '+' : '-';
    out.push({
      kind: 'money',
      amount: moneyDelta,
      label: `${sign}$${Math.abs(moneyDelta).toLocaleString()}`,
    });
  }

  const timeDelta = after.timeSpent - before.timeSpent;
  if (timeDelta !== 0) {
    const sign = timeDelta > 0 ? '+' : '-';
    out.push({
      kind: 'time',
      amount: timeDelta,
      label: `${sign}${Math.abs(timeDelta)} day${Math.abs(timeDelta) === 1 ? '' : 's'}`,
    });
  }

  // ApprovalStatus is lowercase ('approved'); the v3.0.40 original compared to
  // 'APPROVED' and so never fired — this revoke receipt was dead until v3.0.68.
  if (before.dobApprovalStatus === 'approved' && after.dobApprovalStatus !== 'approved') {
    out.push({ kind: 'approval_revoke', label: 'DOB approval revoked — you will need to re-apply' });
  }
  if (before.fdnyApprovalStatus === 'approved' && after.fdnyApprovalStatus !== 'approved') {
    out.push({ kind: 'approval_revoke', label: 'FDNY approval revoked — you will need to re-apply' });
  }

  // Card gains/losses. When the caller captured the hand by identity (handCards
  // on both snapshots), name *which* cards moved; otherwise fall back to the
  // count-only label. The L-card itself lands in hand, so its draw is excluded
  // (by id when we have detail, else by subtracting 1 from the count delta) —
  // the receipt should show only *additional* gains (Kid B free Expeditor draws)
  // and losses (Kid E forced discards).
  if (before.handCards && after.handCards) {
    const { lost, gained } = diffHandCards(before.handCards, after.handCards, primaryCardId);
    if (gained.length > 0) {
      out.push({ kind: 'card_gained', amount: gained.length, label: describeCardMove('gained', gained) });
    }
    if (lost.length > 0) {
      out.push({ kind: 'card_lost', amount: -lost.length, label: describeCardMove('lost', lost) });
    }
  } else {
    const handDelta = after.handSize - before.handSize - (primaryCardId ? 1 : 0);
    if (handDelta > 0) {
      out.push({
        kind: 'card_gained',
        amount: handDelta,
        label: `gained ${handDelta} extra resource${handDelta === 1 ? '' : 's'}`,
      });
    } else if (handDelta < 0) {
      const lost = Math.abs(handDelta);
      out.push({
        kind: 'card_lost',
        amount: handDelta,
        label: `lost ${lost} resource${lost === 1 ? '' : 's'}`,
      });
    }
  }

  const effectsDelta = after.activeEffectsCount - before.activeEffectsCount;
  if (effectsDelta > 0) {
    out.push({
      kind: 'duration_start',
      amount: effectsDelta,
      label: `this will keep affecting you over the next few turns`,
    });
  }

  return out;
}

/**
 * Multiset diff of two hands by card id. Returns the cards that left (`lost`)
 * and the cards that arrived (`gained`), excluding one instance of the primary
 * L-card (it just landed in hand and isn't a "gain" the player chose).
 */
function diffHandCards(
  before: SnapshotCard[],
  after: SnapshotCard[],
  primaryCardId?: string,
): { lost: SnapshotCard[]; gained: SnapshotCard[] } {
  const count = (cards: SnapshotCard[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const c of cards) m.set(c.id, (m.get(c.id) ?? 0) + 1);
    return m;
  };

  // Pool of available "after" cards to match "before" cards against.
  const afterPool = count(after);
  if (primaryCardId && (afterPool.get(primaryCardId) ?? 0) > 0) {
    afterPool.set(primaryCardId, afterPool.get(primaryCardId)! - 1);
  }

  const lost: SnapshotCard[] = [];
  for (const c of before) {
    if ((afterPool.get(c.id) ?? 0) > 0) {
      afterPool.set(c.id, afterPool.get(c.id)! - 1); // present in both — matched
    } else {
      lost.push(c);
    }
  }

  // Whatever remains in the pool arrived after the event — map back to descriptors.
  const gained: SnapshotCard[] = [];
  for (const c of after) {
    if ((afterPool.get(c.id) ?? 0) > 0) {
      gained.push(c);
      afterPool.set(c.id, afterPool.get(c.id)! - 1);
    }
  }

  return { lost, gained };
}

/**
 * Build a player-facing label for a set of cards that moved, e.g.
 * "lost 2 Expeditors (Speed Demon, Paper Pusher)". Groups by type when they
 * all share one (the common case), otherwise names them as resources. Names
 * fall back to the type when a card_name is missing.
 */
function describeCardMove(verb: 'lost' | 'gained', cards: SnapshotCard[]): string {
  const names = cards.map((c) => c.name).filter(Boolean);
  const types = new Set(cards.map((c) => c.type).filter(Boolean));
  const namePart = names.length > 0 ? ` (${names.join(', ')})` : '';

  if (types.size === 1) {
    const type = [...types][0];
    return `${verb} ${cards.length} ${getCardTypeName(type, cards.length)}${namePart}`;
  }
  return `${verb} ${cards.length} resource${cards.length === 1 ? '' : 's'}${namePart}`;
}
