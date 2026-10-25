// The filing rep's run round the circle (BETA_PLAN_V3.md, N3 item 4). Pure: no services, no state.
// The circle (which spaces, in what order) and the "send-backs before the offer" number live in REPS.csv
// (kind `circle`, rule `loops_before_offer`) and are read through repRules.ts.
//
// A send-back is a move from a circle space to the SAME or an EARLIER circle space (the plan exam sending the
// student back to the architect, or telling them to come back to the exam). The office and the "pick your path"
// hubs are not on the circle: the student chose those, so they never count.

import { getRepRules, getRepDef, type RepRules } from './repRules';
import type { HeldRep } from '../types/DataTypes';

export function circleRank(space: string | undefined, rules: RepRules = getRepRules()): number | undefined {
  if (!space) return undefined;
  return rules.circle.find(c => c.space === space)?.rank;
}

export const isOnCircle = (space: string | undefined, rules: RepRules = getRepRules()) => circleRank(space, rules) !== undefined;

/** The first stop on the circle (where a send-back lands) and the last (the plan exam). */
export function circleEnds(rules: RepRules = getRepRules()): { first?: string; last?: string } {
  const c = rules.circle;
  return { first: c[0]?.space, last: c[c.length - 1]?.space };
}

/** True when a good rep rolls this stop's dice twice (REPS.csv circle row text `twice`). */
export const circleTwice = (space: string | undefined, rules: RepRules = getRepRules()) =>
  !!rules.circle.find(c => c.space === space)?.twice;

/** Sent back: from a circle space to the same or an earlier circle space. */
export function isSendBack(from: string | undefined, to: string | undefined, rules: RepRules = getRepRules()): boolean {
  const a = circleRank(from, rules);
  const b = circleRank(to, rules);
  return a !== undefined && b !== undefined && b <= a;
}

/** Passed: leaving the plan exam for somewhere off the circle. */
export function isPass(from: string | undefined, to: string | undefined, rules: RepRules = getRepRules()): boolean {
  const { last } = circleEnds(rules);
  return !!last && from === last && !!to && !isOnCircle(to, rules);
}

/** The send-back counter after one move: +1 for a send-back, back to 0 for a pass, otherwise unchanged. */
export function nextSendBackCount(count: number, from: string | undefined, to: string | undefined, rules: RepRules = getRepRules()): number {
  if (isSendBack(from, to, rules)) return count + 1;
  if (isPass(from, to, rules)) return 0;
  return count;
}

export const loopsBeforeOffer = (rules: RepRules = getRepRules()) => rules.rules.loops_before_offer ?? 2;

/** True when the offer should be put to the student: sent back enough times in a row, standing at the first stop. */
export function shouldOffer(count: number, space: string | undefined, visitType: string | undefined, rules: RepRules = getRepRules()): boolean {
  const { first } = circleEnds(rules);
  return !!first && space === first && visitType === 'Subsequent' && count >= loopsBeforeOffer(rules);
}

/** The rep that goes: a good one if any is held, otherwise the first held. Null when none is held. */
export function pickFilingRep(held: HeldRep[] | undefined): { rep: HeldRep; good: boolean } | null {
  if (!held || held.length === 0) return null;
  const withDef = held.map(h => ({ h, def: getRepDef(h.id) }));
  const good = withDef.find(x => x.def?.sign === 'good');
  if (good) return { rep: good.h, good: true };
  return { rep: held[0], good: false };
}

// ---------- the better roll ----------

/** What a roll would cost. Lower is better, compared in this order. */
export interface RollScore { days: number; feePct: number; items: number }

/** True when `b` is strictly better than `a`: fewer days, then lower fee, then fewer work items. A tie keeps `a`. */
export function isBetter(b: RollScore, a: RollScore): boolean {
  if (b.days !== a.days) return b.days < a.days;
  if (b.feePct !== a.feePct) return b.feePct < a.feePct;
  return b.items < a.items;
}

/** Index of the best score; a tie keeps the first. */
export function bestIndex(scores: RollScore[]): number {
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (isBetter(scores[i], scores[best])) best = i;
  return best;
}

/** "1%" -> 1, "0%" -> 0, anything unreadable -> 0. */
export function parseFeePct(cell: string | undefined): number {
  const n = parseFloat(String(cell ?? '').replace('%', ''));
  return isNaN(n) ? 0 : n;
}

/** The work-item change a scope die cell stands for: "Remove 1" -1, "Draw 1" +1, "Replace 1" / "No change" 0. */
export function itemsOfScopeCell(cell: string | undefined): number {
  const t = String(cell ?? '').trim().toLowerCase();
  if (t.startsWith('remove')) return -1;
  if (t.startsWith('draw') || t.startsWith('add')) return 1;
  return 0;
}

// ---------- the report ----------

export interface RunLine { label: string; text: string }

const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const days = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(Math.round(n))} day${Math.abs(Math.round(n)) === 1 ? '' : 's'}`;

/** One space's words: what the rolls were, what it cost, what changed. */
export function describeStep(step: { rolls?: number[]; kept?: number; skipped?: string; dMoney: number; dDays: number; dItems: number }): string {
  const parts: string[] = [];
  if (step.rolls && step.rolls.length > 1 && step.kept !== undefined) {
    parts.push(`rolled ${step.rolls.slice(0, -1).join(', ')} and ${step.rolls[step.rolls.length - 1]}, kept the ${step.kept}`);
  }
  if (step.skipped) parts.push(step.skipped);
  if (step.dMoney < 0) parts.push(`cost ${money(step.dMoney)}`);
  else if (step.dMoney > 0) parts.push(`${money(step.dMoney)} back`);
  if (step.dDays !== 0) parts.push(days(step.dDays));
  if (step.dItems < 0) parts.push(step.dItems === -1 ? 'one work item removed' : `${-step.dItems} work items removed`);
  else if (step.dItems > 0) parts.push(step.dItems === 1 ? 'one work item added' : `${step.dItems} work items added`);
  else if (parts.length === 0) parts.push('nothing new');
  return parts.join(', ');
}

export function describeTotal(dMoney: number, dDays: number): string {
  const parts = [days(dDays)];
  parts.push(dMoney < 0 ? `-${money(dMoney)}` : dMoney > 0 ? `+${money(dMoney)}` : 'no money change');
  return parts.join(', ');
}
