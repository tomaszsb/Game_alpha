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

export interface LifeEventSnapshot {
  money: number;
  timeSpent: number;
  handSize: number;
  activeEffectsCount: number;
  dobApprovalStatus?: string;
  fdnyApprovalStatus?: string;
}

/**
 * Snapshot the player fields an auto-applied L-card can change. Kept narrow on
 * purpose: money, time, approval state, hand size, active-effects count — the
 * fields the Kids A–E life-event effects touch. Wider state changes belong in
 * their own modal. Returns null when the player is missing so callers can skip.
 */
export function snapshotPlayerForLifeEvent(player: Player | null | undefined): LifeEventSnapshot | null {
  if (!player) return null;
  return {
    money: player.money,
    timeSpent: player.timeSpent,
    handSize: (player.hand ?? []).length,
    activeEffectsCount: (player.activeEffects ?? []).length,
    dobApprovalStatus: player.dobApprovalStatus,
    fdnyApprovalStatus: player.fdnyApprovalStatus,
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

  // The L-card itself lands in hand, so handSize bumps by at least 1. Subtract
  // the primary card draw so the receipt only shows *additional* gains (Kid B
  // free Expeditor draws) and losses (Kid E forced discards).
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
