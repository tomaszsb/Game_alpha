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
//   mat           key = tile id                    value = what fills it (see MAT_CHECKS)   text = the tile's label
//   rule          key = bids_offered               value = how many builders bid at once
//   rule          key = time_cap_percent           value = days used as a % of the plan that takes a player out (0 = off)
//   guarantee     key = option id                  value = days a bid's price is held (each bidder gets one at random)
//   builder_quality key = HIGH | MED | LOW         value = quality event fired on hiring   text = the quality's name
//   builder_space key = the hiring space           value = the door from it to the bank (a space id)
//   builder_note_space key = a space id            (the player panel adds the builder-money line there)

import type { TrophyRuleCsvRow } from '../types/DataTypes';

export type TrophyId = 'time' | 'money' | 'quality';
export const TROPHY_IDS: readonly TrophyId[] = ['time', 'money', 'quality'];

/** What can fill a tile on the player's mat. The labels and order are data; the checks are these. */
export const MAT_CHECKS = ['scope_set', 'funded', 'architect_paid', 'engineer_paid', 'dob_approved', 'fdny_approved', 'builder_hired', 'finished'] as const;
export type MatCheck = typeof MAT_CHECKS[number];
export interface MatTile { id: string; check: MatCheck; label: string }

export type BuilderQuality = 'HIGH' | 'MED' | 'LOW';
export const BUILDER_QUALITIES: readonly BuilderQuality[] = ['HIGH', 'MED', 'LOW'];

/** The builder-bid numbers and names (see utils/builderBids.ts). All of it is data. */
export interface BuilderRules {
  /** The space where bids are shown and a builder is hired; '' = this board has none. */
  space: string;
  /** The space the door from it leads to (the bank's loan desk); '' = no door. */
  door: string;
  /** Spaces where the panel adds a line about the quote on the table. */
  noteSpaces: string[];
  /** How many builders bid at once. */
  bidsOffered: number;
  /** Days a price is held; each bidder is given one of these at random. */
  guaranteeDays: number[];
  /** Per quality: the quality event hiring fires (sized in `points`) and the name shown after hiring. */
  qualities: Record<BuilderQuality, { event: string; name: string }>;
}

export interface TrophyRules {
  /** The milestones on each player's mat, in order. */
  mat: MatTile[];
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
  /** A player is out when days used reach this % of the days planned (300 = three times as long; 0 = no limit). */
  timeCapPercent: number;
  /** Builder bids: where, how many, how long a price is held, and what quality each hire counts as. */
  builder: BuilderRules;
}

const DEFAULT_BUILDER: BuilderRules = {
  space: 'CON-INITIATION',
  door: 'LEND-SCOPE-CHECK',
  noteSpaces: ['LEND-SCOPE-CHECK', 'BANK-FUND-REVIEW', 'INVESTOR-FUND-REVIEW'],
  bidsOffered: 3,
  guaranteeDays: [100, 120, 150, 180],
  qualities: {
    HIGH: { event: 'builder_high', name: 'High' },
    MED: { event: 'builder_medium', name: 'Medium' },
    LOW: { event: 'builder_low', name: 'Low' },
  },
};

const DEFAULT_MAT: MatTile[] = [
  { id: 'scope', check: 'scope_set', label: 'Scope chosen' },
  { id: 'funded', check: 'funded', label: 'Funded' },
  { id: 'architect', check: 'architect_paid', label: 'Architect' },
  { id: 'engineer', check: 'engineer_paid', label: 'Engineer' },
  { id: 'dob', check: 'dob_approved', label: 'DOB approved' },
  { id: 'fdny', check: 'fdny_approved', label: 'FDNY approved' },
  { id: 'builder', check: 'builder_hired', label: 'Builder hired' },
  { id: 'finish', check: 'finished', label: 'Finished' },
];

const DEFAULT_RULES: TrophyRules = {
  mat: DEFAULT_MAT,
  names: { time: 'Fastest', money: 'On budget', quality: 'Best built' },
  trophiesToWin: 2,
  points: { review_passed: 0, review_sent_back: 1, violation: 2, cut_corner: 2, builder_high: 0, builder_medium: 1, builder_low: 2 },
  reviewEvents: ['review_passed', 'review_sent_back', 'builder_high', 'builder_medium', 'builder_low'],
  spaceEvents: { 'CHEAT-BYPASS': 'cut_corner' },
  timeCapPercent: 300,
  builder: DEFAULT_BUILDER,
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
    mat: [],
    timeCapPercent: DEFAULT_RULES.timeCapPercent,
    builder: { ...DEFAULT_BUILDER, space: '', door: '', noteSpaces: [], guaranteeDays: [], qualities: { ...DEFAULT_BUILDER.qualities } },
  };
  let sawBuilderSpace = false;
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
        } else if (key === 'time_cap_percent') {
          const n = parseInt(value, 10);
          if (Number.isFinite(n) && n >= 0) next.timeCapPercent = n;
        } else if (key === 'bids_offered') {
          const n = parseInt(value, 10);
          if (Number.isFinite(n) && n >= 1 && n <= 6) next.builder.bidsOffered = n;
        }
        break;
      case 'guarantee': {
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n >= 1) next.builder.guaranteeDays.push(n);
        break;
      }
      case 'builder_quality':
        if ((BUILDER_QUALITIES as readonly string[]).includes(key) && value) {
          next.builder.qualities[key as BuilderQuality] = { event: value, name: text || next.builder.qualities[key as BuilderQuality].name };
        }
        break;
      case 'builder_note_space':
        next.builder.noteSpaces.push(key);
        break;
      case 'builder_space':
        sawBuilderSpace = true;
        next.builder.space = key;
        next.builder.door = value;
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
      case 'mat':
        if ((MAT_CHECKS as readonly string[]).includes(value) && text) next.mat.push({ id: key, check: value as MatCheck, label: text });
        break;
    }
  }
  if (next.mat.length === 0) next.mat = DEFAULT_MAT; // a file with no mat rows keeps the stock mat
  // A file with no builder rows keeps the stock bids; a file that names the space but no
  // guarantee options keeps the stock options (a bid with no guarantee would never hold).
  if (!sawBuilderSpace) {
    next.builder.space = DEFAULT_BUILDER.space;
    next.builder.door = DEFAULT_BUILDER.door;
    next.builder.noteSpaces = [...DEFAULT_BUILDER.noteSpaces];
  }
  if (next.builder.guaranteeDays.length === 0) next.builder.guaranteeDays = [...DEFAULT_BUILDER.guaranteeDays];
  rules = next;
}

export function getTrophyRules(): TrophyRules {
  return rules;
}

/** The builder-bid rules (where, how many, how long a price is held, quality names and events). */
export function getBuilderRules(): BuilderRules {
  return rules.builder;
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
