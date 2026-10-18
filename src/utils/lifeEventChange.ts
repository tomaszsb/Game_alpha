import type { Player } from '../types/DataTypes';
import type { MutablePlayerState } from '../types/StateTypes';

/**
 * What one life event (L card) did to a player, so a push-back (Try Again)
 * can keep it. Rule: a life event is permanent; pushing back on the space
 * re-opens the deal, it does not undo what already happened to you.
 */
export interface LifeEventChange {
  moneyDelta: number;
  timeDelta: number;
  cardsAdded: string[];
  cardsRemoved: string[];
  /** Approval and violation fields the event changed, with their new values. */
  fields: Partial<MutablePlayerState>;
}

const KEPT_FIELDS = [
  'dobApprovalStatus', 'fdnyApprovalStatus', 'dobApprovedDestinations', 'fdnyApprovedDestinations',
  'violationStatus', 'violationVariant', 'violationTier', 'violationDeadlineDay',
  'violationPenaltyBase', 'violationAccrualCheckpoint',
] as const;

function minus(a: string[], b: string[]): string[] {
  const left = [...b];
  return a.filter((id) => {
    const i = left.indexOf(id);
    if (i === -1) return true;
    left.splice(i, 1);
    return false;
  });
}

export function diffLifeEventChange(before: Player, after: Player): LifeEventChange {
  const fields: Record<string, unknown> = {};
  for (const key of KEPT_FIELDS) {
    const b = (before as unknown as Record<string, unknown>)[key];
    const a = (after as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) fields[key] = a;
  }
  const beforeHand = before.hand ?? [];
  const afterHand = after.hand ?? [];
  return {
    moneyDelta: (after.money ?? 0) - (before.money ?? 0),
    timeDelta: (after.timeSpent ?? 0) - (before.timeSpent ?? 0),
    cardsAdded: minus(afterHand, beforeHand),
    cardsRemoved: minus(beforeHand, afterHand),
    fields: fields as Partial<MutablePlayerState>,
  };
}

/** Sum a turn's life-event changes into one. */
export function combineLifeEventChanges(changes: LifeEventChange[]): LifeEventChange {
  return changes.reduce<LifeEventChange>((acc, c) => ({
    moneyDelta: acc.moneyDelta + c.moneyDelta,
    timeDelta: acc.timeDelta + c.timeDelta,
    cardsAdded: [...minus(acc.cardsAdded, c.cardsRemoved), ...c.cardsAdded],
    cardsRemoved: [...acc.cardsRemoved, ...minus(c.cardsRemoved, acc.cardsAdded)],
    fields: { ...acc.fields, ...c.fields },
  }), { moneyDelta: 0, timeDelta: 0, cardsAdded: [], cardsRemoved: [], fields: {} });
}

/** Apply a combined change to a hand: remove what the event took, add what it gave. */
export function applyLifeEventHand(hand: string[], change: LifeEventChange): string[] {
  const kept = minus(hand, change.cardsRemoved);
  return [...kept, ...change.cardsAdded.filter((id) => !kept.includes(id))];
}
