// The town clocks: one calendar date per player, worked out from the game's start date and THAT player's own
// days (Player.timeSpent). Nothing here is wording: the start date is stored once in the game's state, and
// every date a clock shows comes from it plus days. Dates are plain 'YYYY-MM-DD' text so they survive saving.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY_MS = 86_400_000;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Today's real date on this machine, as 'YYYY-MM-DD' (what a new game stores as its start date). */
export function todayIso(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const parse = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
};

/**
 * The start date of a game: the stored one; for a game saved before it was stored, the day it was started
 * (gameStartTime, which may have come back from the server as text); failing both, today.
 */
export function clockStartIso(state: { gameStartDate?: string; gameStartTime?: Date | string }, now: Date = new Date()): string {
  if (state.gameStartDate && parse(state.gameStartDate) !== null) return state.gameStartDate.slice(0, 10);
  if (state.gameStartTime) {
    const d = new Date(state.gameStartTime);
    if (!Number.isNaN(d.getTime())) return todayIso(d);
  }
  return todayIso(now);
}

export interface ClockDate { year: string; month: string; day: string }

/** The date `days` days after the start date. Days that are negative or not whole count as whole days from zero. */
export function clockDate(startIso: string, days: number): ClockDate {
  const base = parse(startIso) ?? parse(todayIso())!;
  const d = new Date(base + Math.max(0, Math.floor(Number.isFinite(days) ? days : 0)) * DAY_MS);
  return { year: pad(d.getUTCFullYear(), 4), month: MONTHS[d.getUTCMonth()], day: pad(d.getUTCDate()) };
}

/** One string for change detection and the slim clock, such as "2026 OCT 25". */
export const clockText = (c: ClockDate): string => `${c.year} ${c.month} ${c.day}`;
