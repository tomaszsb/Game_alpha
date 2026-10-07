// trophyRules — the three-trophy win rule's numbers and names, read from
// TROPHIES.csv (kind,key,value,text). Same shape as violationRules.ts: built-in
// defaults stand when the file is missing or unreadable, and a reskin changes
// names, point sizes and which spaces count as a quality event by data alone.
//
//   trophy        key = time | money | quality     text = the trophy's name
//   rule          key = trophies_to_win            value = how many a winner must hold
//   points        key = quality event              value = problem points it adds
//   review        key = quality event              (this event counts as one review)
//   space_event   key = space id                   value = quality event fired on arrival

import type { TrophyRuleCsvRow } from '../types/DataTypes';

export type TrophyId = 'time' | 'money' | 'quality';
export const TROPHY_IDS: readonly TrophyId[] = ['time', 'money', 'quality'];

export interface TrophyRules {
  /** The name shown for each trophy. */
  names: Record<TrophyId, string>;
  /** How many of the three trophies a player must hold to win outright. */
  trophiesToWin: number;
  /** Problem points per quality event id. */
  points: Record<string, number>;
  /** Quality events that count as one review (the bottom of "problems per review"). */
  reviewEvents: string[];
  /** Space id -> quality event fired when a player arrives there. */
  spaceEvents: Record<string, string>;
}

const DEFAULT_RULES: TrophyRules = {
  names: { time: 'Fastest', money: 'On budget', quality: 'Best built' },
  trophiesToWin: 2,
  points: { review_passed: 0, review_sent_back: 1, violation: 2, cut_corner: 2 },
  reviewEvents: ['review_passed', 'review_sent_back'],
  spaceEvents: { 'CHEAT-BYPASS': 'cut_corner' },
};

let rules: TrophyRules = DEFAULT_RULES;

/** Read the CSV rows into the live rules. A row that does not parse is skipped; an empty file leaves the defaults. */
export function configureTrophyRules(rows: TrophyRuleCsvRow[]): void {
  if (!rows || rows.length === 0) {
    rules = DEFAULT_RULES;
    return;
  }
  const next: TrophyRules = {
    names: { ...DEFAULT_RULES.names },
    trophiesToWin: DEFAULT_RULES.trophiesToWin,
    points: {},
    reviewEvents: [],
    spaceEvents: {},
  };
  for (const row of rows) {
    const key = (row.key || '').trim();
    const value = (row.value || '').trim();
    const text = (row.text || '').trim();
    if (!key) continue;
    switch (row.kind) {
      case 'trophy':
        if ((TROPHY_IDS as readonly string[]).includes(key) && text) next.names[key as TrophyId] = text;
        break;
      case 'rule':
        if (key === 'trophies_to_win') {
          const n = parseInt(value, 10);
          if (Number.isFinite(n) && n >= 1 && n <= TROPHY_IDS.length) next.trophiesToWin = n;
        }
        break;
      case 'points': {
        const n = parseFloat(value);
        if (Number.isFinite(n) && n >= 0) next.points[key] = n;
        break;
      }
      case 'review':
        next.reviewEvents.push(key);
        break;
      case 'space_event':
        if (value) next.spaceEvents[key] = value;
        break;
    }
  }
  rules = next;
}

export function getTrophyRules(): TrophyRules {
  return rules;
}

/** Problem points a quality event adds (0 for an event the data does not size). */
export function pointsFor(eventId: string): number {
  return rules.points[eventId] ?? 0;
}

export function countsAsReview(eventId: string): boolean {
  return rules.reviewEvents.includes(eventId);
}

/** The quality event that arriving at this space fires, if the data names one. */
export function spaceEventFor(spaceId: string): string | undefined {
  return rules.spaceEvents[spaceId];
}
