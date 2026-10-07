// trophyRecord — the per-player quality ledger behind the "best built" trophy.
// Pure helpers; the sizes of each event come from TROPHIES.csv via trophyRules.

import type { TrophyRecord } from '../types/DataTypes';
import { countsAsReview, pointsFor } from './trophyRules';

export function emptyTrophyRecord(): TrophyRecord {
  return { reviews: 0, problemPoints: 0, counts: {} };
}

/** Deep copy (the record sits inside TEMP/REAL snapshots that must never share references). */
export function cloneTrophyRecord(record: TrophyRecord | undefined): TrophyRecord | undefined {
  return record ? { ...record, counts: { ...record.counts } } : undefined;
}

/** The record after one quality event: reviews and problem points move by the data's sizes. */
export function withQualityEvent(record: TrophyRecord | undefined, eventId: string): TrophyRecord {
  const base = record ?? emptyTrophyRecord();
  return {
    reviews: base.reviews + (countsAsReview(eventId) ? 1 : 0),
    problemPoints: base.problemPoints + pointsFor(eventId),
    counts: { ...base.counts, [eventId]: (base.counts[eventId] ?? 0) + 1 },
  };
}
