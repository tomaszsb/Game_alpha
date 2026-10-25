// The town's areas (TIME_ON_BOARD_DESIGN.md 2.1 and 2.8): the town is stacked bands, one per player, cut along the bare
// grass strip between two bands. Every piece of ground belongs to one player's area; when a player finishes or goes out
// their ground goes to the nearest player still playing. Ownership is a pure function of the layout and WHO HAS LEFT, so
// every screen agrees with no timers and no messages. Rows are town grid rows (the same numbers TOWN.csv uses).

import type { TownLayout } from './townLayout';

export interface TownBand {
  seat: number;
  /** First and last row of this player's own buildings (null when the layout has none to measure). */
  top: number;
  bottom: number;
}

const FAR = 1_000;

function num(s: string | undefined, fallback: number): number {
  const n = parseFloat(s ?? '');
  return Number.isFinite(n) ? n : fallback;
}

/**
 * One band per seat: its top and bottom row. The first band starts at the island's top edge and the last ends at its
 * bottom edge; each cut runs through the middle of the bare strip between the lowest wall of one band and the highest
 * wall of the next. A layout without per-seat buildings falls back to the band height in TOWN.csv (`seat_drow`).
 */
export function townBands(layout: Pick<TownLayout, 'seats' | 'bounds' | 'buildings' | 'settings'>): TownBand[] {
  const { minRow, maxRow } = layout.bounds;
  const seats = Math.max(1, layout.seats);
  const bandRows = num(layout.settings?.seat_drow, 16.4);
  const wallTop = (k: number): number | null => {
    const rows = (layout.buildings ?? []).filter(b => (b.seat === k) || (k === 0 && b.seat === undefined)).map(b => b.row);
    return rows.length ? Math.min(...rows) : null;
  };
  const wallBottom = (k: number): number | null => {
    const rows = (layout.buildings ?? []).filter(b => (b.seat === k) || (k === 0 && b.seat === undefined)).map(b => b.row + b.depth);
    return rows.length ? Math.max(...rows) : null;
  };
  const cuts: number[] = [];
  for (let k = 0; k < seats - 1; k++) {
    const above = wallBottom(k);
    const below = wallTop(k + 1);
    cuts.push(above !== null && below !== null ? (above + below) / 2 : minRow - 0.5 + (k + 1) * bandRows);
  }
  const out: TownBand[] = [];
  for (let k = 0; k < seats; k++) {
    out.push({ seat: k, top: k === 0 ? minRow - 1 : cuts[k - 1], bottom: k === seats - 1 ? maxRow + 1 : cuts[k] });
  }
  return out;
}

export interface AreaSegment {
  seat: number;
  /** Rows from `from` up to `to`. The first segment starts at -FAR and the last ends at +FAR (water out to the frame). */
  from: number;
  to: number;
}

/**
 * Who owns which rows. `gone[seat]` is true once that player has finished or gone out. The ground of a player who has
 * left goes to the nearest player still playing: the middle of their band is the halfway line, so a player between two
 * others gives half to each, and one at an edge gives it all to their one neighbour. Nobody still playing (everyone has
 * left) is treated as nobody having left: the end screen takes over there. One player: the whole board is theirs.
 */
export function areaSegments(layout: Pick<TownLayout, 'seats' | 'bounds' | 'buildings' | 'settings'>, gone: boolean[] = []): AreaSegment[] {
  const bands = townBands(layout);
  let alive = bands.map(b => b.seat).filter(s => !gone[s]);
  if (alive.length === 0) alive = bands.map(b => b.seat);
  const segs: AreaSegment[] = [];
  let from = -FAR;
  for (let i = 0; i < alive.length; i++) {
    const a = alive[i];
    let to = FAR;
    if (i < alive.length - 1) {
      const b = alive[i + 1];
      // the ground between a's bottom edge and b's top edge belongs to players who have left: split it down the middle
      to = b === a + 1 ? bands[a].bottom : (bands[a].bottom + bands[b].top) / 2;
    }
    segs.push({ seat: a, from, to });
    from = to;
  }
  return segs;
}

/** The seat that owns a row. */
export function ownerOfRow(segments: AreaSegment[], row: number): number {
  const s = segments.find(x => row >= x.from && row < x.to) ?? segments[segments.length - 1];
  return s.seat;
}

/** Whether a player has left the board: reached the finish or gone out (the same two things the game's own end check reads). */
export function hasLeftBoard(p: { finishedAtTurn?: number; outReason?: string }): boolean {
  return p.finishedAtTurn !== undefined && p.finishedAtTurn !== null || !!p.outReason;
}
