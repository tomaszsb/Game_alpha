// liveTrophies — the three races WHILE the game is still on (Job 5, first slice).
//
// The final count (trophyScoring.rankTrophies) only ranks players who finished. During play everyone
// is somewhere on their own timeline, so the board shows each player's numbers so far and a PLACE in
// each race, but the place is only "solid" once it can no longer be changed by someone who is still
// behind: players take turns at different points in time (a player on day 80 and a player on day 200
// are not at the same moment), so a place settles when every other player has either finished or
// passed this player's day count (Tom, 2026-10-07: "your placement will solidify when all players
// passed your timeline").
//
// Pure: takes the same MeasureInput rows the final count uses.

import { TROPHY_IDS, TrophyId } from './trophyRules';
import { computeRow, MeasureInput, TrophyRow } from './trophyScoring';

export interface RaceStanding {
  /** Percent of own plan so far, 1 decimal. Lower is better. */
  value: number;
  /** 1 = leading. Ties share the better place. null when the player is out. */
  place: number | null;
  /** How many players are in this race (everyone not out). */
  of: number;
  /** Points of percent behind the leader (0 for the leader). null when out. */
  behind: number | null;
  /**
   * True only when someone is actually ahead: at least two players are in this race and their numbers
   * are not all the same. A solo player, or everyone level (the start of the game; nobody has had a
   * review yet), is not a race, and the board must not hand out "1st" (fb:67a9c44b, fb:f6aebc05).
   */
  contested: boolean;
}

export interface LiveRow {
  playerId: string;
  name: string;
  status: 'playing' | 'finished' | 'out';
  /** The raw numbers behind the percentages, so a screen can show "212 of 330 days". */
  row: TrophyRow;
  races: Record<TrophyId, RaceStanding>;
  /** True when no player still behind this one's day count could change its places. */
  solid: boolean;
}

export interface LiveBoard {
  rows: LiveRow[];
  /** At least one place is still provisional (so the board says so). */
  anyProvisional: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function buildLiveBoard(inputs: MeasureInput[]): LiveBoard {
  const rows = inputs.map(i => ({ input: i, row: computeRow(i) }));
  const inRace = rows.filter(r => !r.input.out);

  const races = new Map<string, Record<TrophyId, RaceStanding>>();
  for (const r of rows) {
    races.set(r.input.playerId, {
      time: { value: r.row.time, place: null, of: inRace.length, behind: null, contested: false },
      money: { value: r.row.money, place: null, of: inRace.length, behind: null, contested: false },
      quality: { value: r.row.quality, place: null, of: inRace.length, behind: null, contested: false },
    });
  }
  for (const id of TROPHY_IDS) {
    if (inRace.length === 0) continue;
    const best = Math.min(...inRace.map(r => r.row[id]));
    const contested = inRace.length >= 2 && inRace.some(r => r.row[id] !== best);
    for (const r of inRace) {
      const mine = r.row[id];
      const place = 1 + inRace.filter(o => o.row[id] < mine).length;
      races.get(r.input.playerId)![id] = { value: mine, place, of: inRace.length, behind: round1(mine - best), contested };
    }
  }

  const out: LiveRow[] = rows.map(({ input, row }) => {
    const others = inRace.filter(o => o.input.playerId !== input.playerId);
    const solid = !input.out && others.every(o => o.input.finished || o.input.daysUsed >= input.daysUsed);
    return {
      playerId: input.playerId,
      name: input.name,
      status: input.out ? 'out' : input.finished ? 'finished' : 'playing',
      row,
      races: races.get(input.playerId)!,
      solid,
    };
  });
  return { rows: out, anyProvisional: out.some(r => r.status !== 'out' && !r.solid) };
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
