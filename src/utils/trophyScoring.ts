// trophyScoring — the three-trophy win rule as pure arithmetic (no state, no services).
//
// Each player is measured against THEIR OWN plan, and lower is better:
//   time    = days used  ÷ days planned
//   money   = money spent ÷ money planned
//   quality = problem points ÷ number of reviews
// Each race has one trophy (ties share it). The winner holds at least
// `trophiesToWin` of them. If nobody does, the lowest SUM of the three
// percentages wins. Players who are out (broke, or over the design-fee limit)
// hold no trophy and cannot win; players who never finished are not ranked.

import { TROPHY_IDS, TrophyId, TrophyRules } from './trophyRules';

export interface MeasureInput {
  playerId: string;
  name: string;
  /** Reached the ending space. */
  finished: boolean;
  /** Broke or over the design-fee limit. */
  out: boolean;
  /** Order they reached the ending space (earlier wins a dead heat); lower = earlier. */
  finishOrder: number;
  daysUsed: number;
  daysPlanned: number;
  moneySpent: number;
  moneyPlanned: number;
  problemPoints: number;
  reviews: number;
}

export interface TrophyRow {
  playerId: string;
  name: string;
  status: 'finished' | 'out' | 'unfinished';
  /** Percent of own plan, 1 decimal. Lower is better. */
  time: number;
  money: number;
  quality: number;
  /** time + money + quality. */
  sum: number;
  /** Trophies held, as trophy ids. Always empty for a player who is out or unfinished. */
  trophies: TrophyId[];
  /** The raw numbers behind the percentages, so a screen can show "212 of 330 days". */
  daysUsed: number;
  daysPlanned: number;
  moneySpent: number;
  moneyPlanned: number;
  problemPoints: number;
  reviews: number;
}

export interface TrophyStandings {
  /** null when nobody finished (everyone is out). */
  winnerId: string | null;
  /** 'trophies' = held enough trophies; 'sum' = the tiebreak by lowest total. */
  decidedBy: 'trophies' | 'sum' | 'none';
  rows: TrophyRow[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** a ÷ b as a percent; a plan of zero (nothing to measure against) reads 0. */
export function percentOfPlan(used: number, planned: number): number {
  if (!(planned > 0)) return 0;
  return round1((Math.max(0, used) / planned) * 100);
}

export function computeRow(i: MeasureInput): TrophyRow {
  const time = percentOfPlan(i.daysUsed, i.daysPlanned);
  const money = percentOfPlan(i.moneySpent, i.moneyPlanned);
  const quality = i.reviews > 0 ? round1((i.problemPoints / i.reviews) * 100) : 0;
  return {
    playerId: i.playerId,
    name: i.name,
    status: i.out ? 'out' : i.finished ? 'finished' : 'unfinished',
    time,
    money,
    quality,
    sum: round1(time + money + quality),
    trophies: [],
    daysUsed: i.daysUsed,
    daysPlanned: i.daysPlanned,
    moneySpent: i.moneySpent,
    moneyPlanned: i.moneyPlanned,
    problemPoints: i.problemPoints,
    reviews: i.reviews,
  };
}

export function rankTrophies(inputs: MeasureInput[], rules: Pick<TrophyRules, 'trophiesToWin'>): TrophyStandings {
  const rows = inputs.map(computeRow);
  const order = new Map(inputs.map(i => [i.playerId, i.finishOrder]));
  const eligible = rows.filter(r => r.status === 'finished');

  for (const id of TROPHY_IDS) {
    if (eligible.length === 0) break;
    const best = Math.min(...eligible.map(r => r[id]));
    for (const r of eligible) if (r[id] === best) r.trophies.push(id);
  }

  if (eligible.length === 0) return { winnerId: null, decidedBy: 'none', rows };

  const byDeadHeat = (a: TrophyRow, b: TrophyRow) =>
    a.sum - b.sum || (order.get(a.playerId) ?? 0) - (order.get(b.playerId) ?? 0);

  const enough = eligible.filter(r => r.trophies.length >= rules.trophiesToWin);
  if (enough.length === 1) return { winnerId: enough[0].playerId, decidedBy: 'trophies', rows };

  const pool = enough.length > 1 ? enough : eligible;
  const winner = [...pool].sort(byDeadHeat)[0];
  return { winnerId: winner.playerId, decidedBy: 'sum', rows };
}
