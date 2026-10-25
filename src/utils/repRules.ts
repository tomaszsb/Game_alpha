// The reps you hold: the people on your team who work ONE area for a weekly salary (BETA_PLAN_V3.md, N3 item 2).
// Pure: no services, no state. Every number and every name lives in REPS.csv (kind,key,value,text), read through
// DataService and handed to configureRepRules; DEFAULT_REP_ROWS below is the same table, used when the file is
// missing (the live server keeps its own copy of the data folder) and by tests. A test pins the two as identical.
//
// A rep is GOOD or BAD at ONE area (Code = design, Permits = city and fire filing, Inspections = site checks).
// While held, every visit to a space of that area is shorter (good) or longer (bad) by `days_shift` days.
// Each rep costs a salary per 7 days of game time, billed at End Turn for whole weeks.
// On arriving in the rep's own area there is a 1-in-`quit_one_in` roll (at most once per rep per 7 days):
//   good rep -> asks for a raise or quits;  bad rep -> a stop work order.

import type { HeldRep } from '../types/DataTypes';

export interface RepRow { kind: string; key: string; value: string; text: string }

export type RepArea = 'Code' | 'Permits' | 'Inspections';
export type RepSign = 'good' | 'bad';

export interface RepDef {
  id: string;
  name: string;
  area: RepArea;
  sign: RepSign;
  /** Starting salary per 7 days. */
  salary: number;
  /** One plain line the hire pop-up and the Team list show. */
  blurb: string;
}

export const DEFAULT_REP_ROWS: RepRow[] = [
  { kind: 'rule', key: 'days_shift', value: '3', text: 'Days a held rep takes off (good) or adds (bad) to each visit in its area' },
  { kind: 'rule', key: 'week_days', value: '7', text: 'Days of game time one salary payment covers' },
  { kind: 'rule', key: 'quit_one_in', value: '20', text: 'The roll on arrival in the rep\'s own area: 1 in this many' },
  { kind: 'rule', key: 'offer_size', value: '3', text: 'Reps shown when you hire' },
  { kind: 'rule', key: 'max_bad_per_offer', value: '1', text: 'Most bad reps in one hire offer' },
  { kind: 'rule', key: 'raise_out_of', value: '4', text: 'A raise offer is accepted this many chances in...' },
  { kind: 'raise', key: '10', value: '1', text: '' },
  { kind: 'raise', key: '20', value: '2', text: '' },
  { kind: 'raise', key: '30', value: '3', text: '' },
  { kind: 'stop', key: 'a', value: '15000', text: '7' },
  { kind: 'stop', key: 'b', value: '10000', text: '10' },
  { kind: 'stop', key: 'c', value: '5000', text: '15' },
  { kind: 'rule', key: 'loops_before_offer', value: '2', text: 'Send-backs in a row before the student may send a filing rep round the circle' },
  { kind: 'circle', key: 'ARCH-INITIATION', value: '1', text: 'twice' },
  { kind: 'circle', key: 'ARCH-FEE-REVIEW', value: '2', text: 'twice' },
  { kind: 'circle', key: 'ARCH-SCOPE-CHECK', value: '3', text: 'twice' },
  { kind: 'circle', key: 'ENG-INITIATION', value: '4', text: 'twice' },
  { kind: 'circle', key: 'ENG-FEE-REVIEW', value: '5', text: 'twice' },
  { kind: 'circle', key: 'ENG-SCOPE-CHECK', value: '6', text: 'twice' },
  { kind: 'circle', key: 'REG-DOB-FEE-REVIEW', value: '7', text: '' },
  { kind: 'circle', key: 'REG-DOB-TYPE-SELECT', value: '8', text: '' },
  { kind: 'circle', key: 'REG-DOB-PLAN-EXAM', value: '9', text: '' },
  { kind: 'area', key: 'ARCH-', value: '', text: 'Code' },
  { kind: 'area', key: 'ENG-', value: '', text: 'Code' },
  { kind: 'area', key: 'REG-', value: '', text: 'Permits' },
  { kind: 'area', key: 'SI-', value: '', text: 'Inspections' },
  { kind: 'area', key: 'TR8-', value: '', text: 'Inspections' },
  { kind: 'area', key: 'CON-INSPECT', value: '', text: 'Inspections' },
  { kind: 'rep', key: 'CODE-1', value: '500', text: 'Priya Nair|Code|good|Code consultant. Has read the building code cover to cover.' },
  { kind: 'rep', key: 'CODE-2', value: '500', text: 'Sam Okafor|Code|good|Plan reviewer on retainer. Catches problems before the city does.' },
  { kind: 'rep', key: 'CODE-3', value: '500', text: 'Alicia Brandt|Code|good|Used to work at the city. Knows what examiners look for.' },
  { kind: 'rep', key: 'CODE-4', value: '250', text: 'Kyle Doran|Code|bad|New to the business. Cheap, and says he knows the code.' },
  { kind: 'rep', key: 'PERMITS-1', value: '500', text: 'Marcus Webb|Permits|good|Permit filer. A hundred filings a year, and it shows.' },
  { kind: 'rep', key: 'PERMITS-2', value: '500', text: 'Lena Kowalski|Permits|good|Used to be a clerk at the buildings department.' },
  { kind: 'rep', key: 'PERMITS-3', value: '500', text: 'Omar Haddad|Permits|good|Registered filer. Knows every form and every line to call.' },
  { kind: 'rep', key: 'PERMITS-4', value: '250', text: 'Jared Finch|Permits|bad|Will file anything, fast. Cheap.' },
  { kind: 'rep', key: 'INSPECT-1', value: '500', text: 'Rosa Delgado|Inspections|good|Special inspector with a clean record.' },
  { kind: 'rep', key: 'INSPECT-2', value: '500', text: 'Walt Pruitt|Inspections|good|Retired site inspector. Walks a site and sees everything.' },
  { kind: 'rep', key: 'INSPECT-3', value: '500', text: 'Naomi Cho|Inspections|good|Runs the testing lab. Reports arrive when she says they will.' },
  { kind: 'rep', key: 'INSPECT-4', value: '250', text: 'Bobby Tran|Inspections|bad|Signs off quickly and charges little.' },
];

export interface RepRules {
  rules: Record<string, number>;
  raises: Array<{ pct: number; accept: number }>;
  stops: Record<string, { cost: number; days: number }>;
  areas: Array<{ prefix: string; area: RepArea }>;
  reps: RepDef[];
  /** The plan exam, architect, engineer circle in walking order (rank 1 = first stop, highest rank = the exam). */
  circle: Array<{ space: string; rank: number; twice: boolean }>;
}

const AREAS: RepArea[] = ['Code', 'Permits', 'Inspections'];

export function buildRepRules(rows: RepRow[]): RepRules {
  const out: RepRules = { rules: {}, raises: [], stops: {}, areas: [], reps: [], circle: [] };
  for (const r of rows) {
    const v = parseFloat(r.value);
    if (r.kind === 'rule' && !isNaN(v)) out.rules[r.key] = v;
    else if (r.kind === 'raise' && !isNaN(v)) out.raises.push({ pct: parseFloat(r.key), accept: v });
    else if (r.kind === 'stop' && !isNaN(v)) out.stops[r.key] = { cost: v, days: parseFloat(r.text) || 0 };
    else if (r.kind === 'circle' && !isNaN(v) && r.key) out.circle.push({ space: r.key, rank: v, twice: r.text === 'twice' });
    else if (r.kind === 'area' && (AREAS as string[]).includes(r.text)) out.areas.push({ prefix: r.key, area: r.text as RepArea });
    else if (r.kind === 'rep' && !isNaN(v)) {
      const [name, area, sign, ...rest] = r.text.split('|');
      if (name && (AREAS as string[]).includes(area) && (sign === 'good' || sign === 'bad')) {
        out.reps.push({ id: r.key, name, area: area as RepArea, sign, salary: v, blurb: rest.join('|') });
      }
    }
  }
  out.raises.sort((a, b) => a.pct - b.pct);
  out.circle.sort((a, b) => a.rank - b.rank);
  // Longest prefix first, so 'CON-INSPECT' is matched before any shorter 'CON-' row a board might add.
  out.areas.sort((a, b) => b.prefix.length - a.prefix.length);
  return out;
}

let current: RepRules = buildRepRules(DEFAULT_REP_ROWS);

/** Called once at load with REPS.csv rows. A file with no usable rep rows keeps the built-in table. */
export function configureRepRules(rows: RepRow[]): void {
  const merged = new Map<string, RepRow>();
  for (const r of DEFAULT_REP_ROWS) merged.set(`${r.kind}|${r.key}`, r);
  // A file that names a table (reps, areas, raises, stops) replaces the whole table.
  const fileKinds = new Set(rows.filter(r => ['rep', 'area', 'raise', 'stop', 'circle'].includes(r.kind)).map(r => r.kind));
  for (const k of [...merged.keys()]) {
    const [kind] = k.split('|');
    if (fileKinds.has(kind)) merged.delete(k);
  }
  for (const r of rows) if (r.kind) merged.set(`${r.kind}|${r.key}`, r);
  const built = buildRepRules([...merged.values()]);
  current = built.reps.length > 0 ? built : buildRepRules(DEFAULT_REP_ROWS);
}

export function getRepRules(): RepRules {
  return current;
}

export function resetRepRules(): void {
  current = buildRepRules(DEFAULT_REP_ROWS);
}

/** Which area a space belongs to, or null (the office, the bank, the finish line...). */
export function repAreaOf(spaceName: string | undefined, rules: RepRules = current): RepArea | null {
  if (!spaceName) return null;
  for (const a of rules.areas) {
    if (a.prefix.endsWith('-') ? spaceName.startsWith(a.prefix) : spaceName === a.prefix) return a.area;
  }
  return null;
}

export function getRepDef(id: string, rules: RepRules = current): RepDef | undefined {
  return rules.reps.find(r => r.id === id);
}

export const weekDays = (rules: RepRules = current) => rules.rules.week_days || 7;

/** The state a rep starts with the day it is hired: nothing owed yet. */
export function newHeldRep(def: RepDef, today: number): HeldRep {
  return { id: def.id, salary: def.salary, hiredDay: today, salaryBilledThroughDay: today };
}

/** Whole weeks of salary owed up to `today`, and what they cost. A turn of 3 days may owe nothing. */
export function salaryDue(held: HeldRep, today: number, rules: RepRules = current): { weeks: number; amount: number } {
  const wd = weekDays(rules);
  const weeks = Math.max(0, Math.floor((today - held.salaryBilledThroughDay) / wd));
  return { weeks, amount: weeks * held.salary };
}

/** What a rep is owed when they leave early: the days since the last bill, pro rata, so hiring for a day is not free. */
export function salaryOnLeaving(held: HeldRep, today: number, rules: RepRules = current): number {
  const wd = weekDays(rules);
  const days = Math.max(0, today - held.salaryBilledThroughDay);
  return Math.round((days * held.salary) / wd);
}

/** Total weekly pay of a roster, for the Team list. */
export function weeklyPay(reps: HeldRep[] | undefined): number {
  return (reps ?? []).reduce((s, r) => s + r.salary, 0);
}

/**
 * How many days a held roster adds to (+) or takes off (-) one visit to `spaceName`, never taking off more than
 * the visit itself costs (`visitDays`): a good rep shortens a 5-day space to 2, not below 0.
 */
export function visitShift(
  reps: HeldRep[] | undefined,
  spaceName: string,
  visitDays: number,
  rules: RepRules = current,
): { delta: number; helped: string[]; hurt: string[] } {
  const area = repAreaOf(spaceName, rules);
  const shift = rules.rules.days_shift ?? 3;
  const helped: string[] = [];
  const hurt: string[] = [];
  if (!area) return { delta: 0, helped, hurt };
  let delta = 0;
  for (const h of reps ?? []) {
    const def = getRepDef(h.id, rules);
    if (!def || def.area !== area) continue;
    if (def.sign === 'good') { delta -= shift; helped.push(h.id); } else { delta += shift; hurt.push(h.id); }
  }
  return { delta: Math.max(delta, -Math.max(0, visitDays)) + 0, helped, hurt };
}

/** The reps in `area` that are rolled for on this arrival: not rolled for in the last `week_days` days. */
export function repsDueForRoll(reps: HeldRep[] | undefined, area: RepArea, today: number, rules: RepRules = current): HeldRep[] {
  const wd = weekDays(rules);
  return (reps ?? []).filter(h => {
    const def = getRepDef(h.id, rules);
    if (!def || def.area !== area) return false;
    return h.lastRollDay === undefined || today - h.lastRollDay >= wd;
  });
}

/** True when the 1-in-N roll hits. */
export function rollHits(rng: () => number, rules: RepRules = current): boolean {
  const n = Math.max(1, Math.round(rules.rules.quit_one_in ?? 20));
  return rng() * n < 1;
}

/** Whether a raise of `pct` percent is accepted (accept chances in raise_out_of). */
export function raiseAccepted(pct: number, rng: () => number, rules: RepRules = current): boolean {
  const row = rules.raises.find(r => r.pct === pct);
  const out = rules.rules.raise_out_of || 4;
  return !!row && rng() * out < row.accept;
}

/** The new weekly salary after a raise: a percent of the CURRENT salary, to the whole dollar. */
export const raisedSalary = (salary: number, pct: number) => Math.round(salary * (1 + pct / 100));

/** The offer for a hire: `offer_size` reps the player does not hold, at most `max_bad_per_offer` of them bad. */
export function pickOffers(heldIds: string[], rng: () => number, rules: RepRules = current): RepDef[] {
  const size = rules.rules.offer_size ?? 3;
  const maxBad = rules.rules.max_bad_per_offer ?? 1;
  const pool = rules.reps.filter(r => !heldIds.includes(r.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: RepDef[] = [];
  let bad = 0;
  for (const r of pool) {
    if (out.length >= size) break;
    if (r.sign === 'bad') { if (bad >= maxBad) continue; bad++; }
    out.push(r);
  }
  return out;
}

export interface StopWorkOption { id: 'a' | 'b' | 'c'; cost: number; days: number }

/** The three ways out of a stop work order. (a) needs a good rep in that area; the caller says whether there is one. */
export function stopWorkOptions(hasGoodRepInArea: boolean, cash: number, rules: RepRules = current): StopWorkOption[] {
  const opts: StopWorkOption[] = [];
  for (const id of ['a', 'b', 'c'] as const) {
    const s = rules.stops[id];
    if (!s) continue;
    if (id === 'a' && !hasGoodRepInArea) continue;
    // A price the player cannot cover is not offered, except the cheapest way out, which always is.
    if (id !== 'c' && s.cost > cash) continue;
    opts.push({ id, cost: s.cost, days: s.days });
  }
  return opts;
}

/** The robot's rule for the stop work order: short of cash -> do it yourself; a good rep in the area -> use them; else the culprit. */
export function robotStopWork(options: StopWorkOption[], cash: number): StopWorkOption['id'] {
  if (cash < 30000) return 'c';
  if (options.some(o => o.id === 'a')) return 'a';
  if (options.some(o => o.id === 'b')) return 'b';
  return 'c';
}

export const RepAreaWords: Record<RepArea, string> = { Code: 'design code', Permits: 'city and fire filing', Inspections: 'site inspections' };

/** The stops each area covers, in the words a player sees on the board. */
const RepStopWords: Record<RepArea, string> = {
  Code: 'architect and engineer stops',
  Permits: 'city and fire filing stops',
  Inspections: 'site inspection stops',
};

/**
 * One plain line saying what a rep is good (or bad) at: "Good at design code: 3 days off each architect and
 * engineer stop." Shown on the hire list and the Team list so no one has to guess the strong suit.
 */
export function repStrengthLine(def: RepDef, rules: RepRules = current): string {
  const days = rules.rules.days_shift ?? 3;
  const area = RepAreaWords[def.area];
  return def.sign === 'good'
    ? `Good at ${area}: ${days} days off each of your ${RepStopWords[def.area]}.`
    : `Weak at ${area}: ${days} extra days at each of your ${RepStopWords[def.area]}, and mistakes.`;
}
