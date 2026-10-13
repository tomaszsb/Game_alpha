// townLayout - the town board's layout, read from TOWN.csv (Tom, 2026-10-11: "A let's see it", then
// "Go now"; design in docs/core/TOWN_BOARD_REVIEW.md, first-build plan). A LOOK ONLY: every square
// stays a square with the same roads and rules; the town just draws each square as a room inside a
// building. Pure functions here (no React) so the layout rules are unit-tested; TownBoard draws them.

import type { TownCsvRow } from '../types/DataTypes';
import { FormatUtils } from './FormatUtils';

export interface TownBuilding {
  id: string;
  name: string;
  /** Town grid position and size, in tiles. */
  col: number;
  row: number;
  width: number;
  depth: number;
  /** Block height in px; 0 = a flat lot (the building site, the ribbon cutting). */
  height: number;
  color: string;
  /** A portrait role (owner, architect, ...) or an emoji. */
  icon: string;
  /** Space ids inside, in TOWN.csv order. */
  rooms: string[];
  /** True for a lot made up for a square the town list does not place (a teacher's new square). */
  isNewPlace?: boolean;
}

export interface TownStreet {
  axis: 'col' | 'row';
  at: number;
}

export interface TownLayout {
  buildings: TownBuilding[];
  streets: TownStreet[];
  /** Space id -> building id, for every placed space. */
  roomToBuilding: Map<string, string>;
  /** Grid bounds of everything placed (for the ground). */
  bounds: { minCol: number; minRow: number; maxCol: number; maxRow: number };
  settings: Record<string, string>;
}

const num = (s: string, fallback = 0): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

/** Size of a made-up lot for a square the town list does not place. */
const NEW_PLACE = { width: 3.8, depth: 2.8, height: 30, color: '#e0e0e0', icon: '📍', step: 6 };

/**
 * Build the town from TOWN.csv rows and the board's spaces. Returns null when there is no town
 * (no building rows), so the caller offers the classic board only.
 *
 * - A space listed in a `room` row goes in that building (the first listing wins).
 * - A space the list does not name goes in the building that already holds a space with the same
 *   speaking character (`prefixOf`), else in a lot of its own on a new row under the town.
 * - Room rows for spaces this board does not have are ignored (a teacher removed the square).
 */
export function buildTownLayout(
  rows: TownCsvRow[],
  spaceNames: string[],
  prefixOf: (spaceName: string) => string,
  labelOf: (spaceName: string) => string,
): TownLayout | null {
  const buildings: TownBuilding[] = [];
  const byId = new Map<string, TownBuilding>();
  const streets: TownStreet[] = [];
  const settings: Record<string, string> = {};

  for (const r of rows) {
    if (r.kind === 'building' && !byId.has(r.id)) {
      const b: TownBuilding = {
        id: r.id,
        name: r.name || r.id,
        col: num(r.col),
        row: num(r.row),
        width: Math.max(0.5, num(r.width, 4)),
        depth: Math.max(0.5, num(r.depth, 4)),
        height: Math.max(0, num(r.height, 60)),
        color: r.color || '#cfd8dc',
        icon: r.icon,
        rooms: [],
      };
      buildings.push(b);
      byId.set(b.id, b);
    } else if (r.kind === 'street') {
      if (r.col !== '') streets.push({ axis: 'col', at: num(r.col) });
      else if (r.row !== '') streets.push({ axis: 'row', at: num(r.row) });
    } else if (r.kind === 'setting') {
      settings[r.id] = r.value;
    }
  }
  if (buildings.length === 0) return null;

  const onBoard = new Set(spaceNames);
  const roomToBuilding = new Map<string, string>();
  for (const r of rows) {
    if (r.kind !== 'room' || !onBoard.has(r.id) || roomToBuilding.has(r.id)) continue;
    const b = byId.get(r.building);
    if (!b) continue;
    b.rooms.push(r.id);
    roomToBuilding.set(r.id, b.id);
  }

  const placedBottom = Math.max(...buildings.map(b => b.row + b.depth));
  let newPlaces = 0;
  for (const space of spaceNames) {
    if (roomToBuilding.has(space)) continue;
    const prefix = prefixOf(space);
    const sibling = [...roomToBuilding.entries()].find(([s]) => prefixOf(s) === prefix);
    if (sibling) {
      const b = byId.get(sibling[1])!;
      b.rooms.push(space);
      roomToBuilding.set(space, b.id);
      continue;
    }
    const b: TownBuilding = {
      id: `new-place-${space}`,
      name: labelOf(space),
      col: 0.6 + newPlaces * NEW_PLACE.step,
      row: Math.ceil(placedBottom) + 1.6,
      width: NEW_PLACE.width,
      depth: NEW_PLACE.depth,
      height: NEW_PLACE.height,
      color: NEW_PLACE.color,
      icon: NEW_PLACE.icon,
      rooms: [space],
      isNewPlace: true,
    };
    newPlaces++;
    buildings.push(b);
    byId.set(b.id, b);
    roomToBuilding.set(space, b.id);
  }

  const bounds = {
    minCol: Math.min(...buildings.map(b => b.col)),
    minRow: Math.min(...buildings.map(b => b.row)),
    maxCol: Math.max(...buildings.map(b => b.col + b.width)),
    maxRow: Math.max(...buildings.map(b => b.row + b.depth)),
  };
  return { buildings, streets, roomToBuilding, bounds, settings };
}

/** Isometric (2:1) projection of a town grid point to board pixels. `tile` = px per grid tile. */
export function isoPoint(col: number, row: number, z: number, tile: number): { x: number; y: number } {
  return { x: (col - row) * tile, y: ((col + row) * tile) / 2 - z };
}

/** Screen box of a building's block (including its height), plus the point its sign hangs from. */
export function buildingBox(b: Pick<TownBuilding, 'col' | 'row' | 'width' | 'depth' | 'height'>, tile: number) {
  const corners = [
    isoPoint(b.col, b.row, 0, tile),
    isoPoint(b.col + b.width, b.row, 0, tile),
    isoPoint(b.col + b.width, b.row + b.depth, 0, tile),
    isoPoint(b.col, b.row + b.depth, 0, tile),
  ];
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys) - b.height;
  const roof = isoPoint(b.col + b.width / 2, b.row + b.depth / 2, b.height, tile);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, roofX: roof.x, roofY: roof.y };
}

export interface TownPlayerMark {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  currentSpace: string;
}

export interface BuildingView {
  /** The current player is in this building. */
  isCurrent: boolean;
  /** The room the current player is in, when isCurrent. */
  currentRoom: string | null;
  /** Rooms here the current player can move to next. */
  destinationRooms: string[];
  /** Players in this building, in the order given. */
  playersHere: TownPlayerMark[];
}

/** What each building shows this moment: who is in it, and which of its rooms are next moves. */
export function buildingViews(
  layout: TownLayout,
  players: TownPlayerMark[],
  currentPlayerId: string | null | undefined,
  validMoves: string[],
): Map<string, BuildingView> {
  const views = new Map<string, BuildingView>();
  for (const b of layout.buildings) {
    views.set(b.id, { isCurrent: false, currentRoom: null, destinationRooms: [], playersHere: [] });
  }
  for (const p of players) {
    const bid = layout.roomToBuilding.get(p.currentSpace);
    const v = bid ? views.get(bid) : undefined;
    if (!v) continue;
    v.playersHere.push(p);
    if (p.id === currentPlayerId) {
      v.isCurrent = true;
      v.currentRoom = p.currentSpace;
    }
  }
  for (const m of validMoves) {
    const bid = layout.roomToBuilding.get(m);
    const v = bid ? views.get(bid) : undefined;
    if (v && !v.destinationRooms.includes(m)) v.destinationRooms.push(m);
  }
  return views;
}

// -------------------------------------------------------------------------------------------------
// The walk (step A2): after a move the piece walks along the streets to the next building. A look
// only; it never costs game days. Times are data (TOWN.csv `setting` rows), tuned by play.
// -------------------------------------------------------------------------------------------------

export interface WalkTimes {
  /** A walk between two buildings on Normal speed. */
  walkMs: number;
  /** The same walk on Fast: a quick hop. */
  fastMs: number;
  /** A move from one room to another inside the same building. */
  hopMs: number;
}

export const DEFAULT_WALK_TIMES: WalkTimes = { walkMs: 1500, fastMs: 400, hopMs: 350 };

/** How long a result bubble floats (setting `bubble_ms`); Fast halves it like every other wait. */
export const DEFAULT_BUBBLE_MS = 1800;

/** Chime volume for result bubbles (setting `bubble_sound_volume`, 0..1, 0 = silent); bad or missing = default. */
export const DEFAULT_BUBBLE_VOLUME = 0.2;
export function bubbleVolume(settings: Record<string, string>): number {
  const n = parseFloat(settings.bubble_sound_volume ?? '');
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1) : DEFAULT_BUBBLE_VOLUME;
}

/** Walk times from the town's settings (`walk_ms`, `walk_fast_ms`, `hop_ms`); bad or missing = defaults. */
export function walkTimes(settings: Record<string, string>): WalkTimes {
  const ms = (key: string, fallback: number) => {
    const n = parseFloat(settings[key] ?? '');
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    walkMs: ms('walk_ms', DEFAULT_WALK_TIMES.walkMs),
    fastMs: ms('walk_fast_ms', DEFAULT_WALK_TIMES.fastMs),
    hopMs: ms('hop_ms', DEFAULT_WALK_TIMES.hopMs),
  };
}

export interface GridPoint {
  col: number;
  row: number;
}

const centre = (b: TownBuilding): GridPoint => ({ col: b.col + b.width / 2, row: b.row + b.depth / 2 });

/** The street a building's door opens onto (the nearest one), and the door point on it. */
function doorOf(b: TownBuilding, streets: TownStreet[]): { street: TownStreet; door: GridPoint } | null {
  let best: { street: TownStreet; door: GridPoint; d: number } | null = null;
  for (const s of streets) {
    const lane = s.at + 0.5;
    const [lo, hi] = s.axis === 'col' ? [b.col, b.col + b.width] : [b.row, b.row + b.depth];
    const d = lane < lo ? lo - lane : lane > hi ? lane - hi : 0;
    if (!best || d < best.d) {
      const c = centre(b);
      best = { street: s, door: s.axis === 'col' ? { col: lane, row: c.row } : { col: c.col, row: lane }, d };
    }
  }
  return best ? { street: best.street, door: best.door } : null;
}

/**
 * The route from one building to another along the streets: out of the door, along the street,
 * round at most two corners, in at the other door. Empty when both are the same building (a room-
 * to-room move: a hop, not a walk). A straight line when the town has no streets.
 */
export function walkPath(layout: TownLayout, fromId: string, toId: string): GridPoint[] {
  if (fromId === toId) return [];
  const a = layout.buildings.find(b => b.id === fromId);
  const b = layout.buildings.find(x => x.id === toId);
  if (!a || !b) return [];
  const da = doorOf(a, layout.streets);
  const db = doorOf(b, layout.streets);
  const pts: GridPoint[] = [centre(a)];
  if (da && db) {
    pts.push(da.door);
    const sa = da.street, sb = db.street;
    const laneA = sa.at + 0.5, laneB = sb.at + 0.5;
    if (sa.axis === sb.axis && sa.at === sb.at) {
      // Same street: straight along it.
    } else if (sa.axis !== sb.axis) {
      pts.push(sa.axis === 'col' ? { col: laneA, row: laneB } : { col: laneB, row: laneA });
    } else {
      // Two parallel streets: cross on the street of the other kind that makes the shortest trip.
      const cross = layout.streets.filter(s => s.axis !== sa.axis);
      const along = (p: GridPoint) => (sa.axis === 'col' ? p.row : p.col);
      const pick = cross.reduce<TownStreet | null>((best, s) => {
        const cost = (x: TownStreet) => Math.abs(along(da.door) - (x.at + 0.5)) + Math.abs(along(db.door) - (x.at + 0.5));
        return !best || cost(s) < cost(best) ? s : best;
      }, null);
      if (pick) {
        const lane = pick.at + 0.5;
        pts.push(sa.axis === 'col' ? { col: laneA, row: lane } : { col: lane, row: laneA });
        pts.push(sa.axis === 'col' ? { col: laneB, row: lane } : { col: lane, row: laneB });
      }
    }
    pts.push(db.door);
  }
  pts.push(centre(b));
  return pts.filter((p, i) => i === 0 || p.col !== pts[i - 1].col || p.row !== pts[i - 1].row);
}

/** The point a share `t` (0..1) of the way along a polyline, by length. */
export function pointAlong(points: Array<{ x: number; y: number }>, t: number): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];
  const seg = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = seg.reduce((s, l) => s + l, 0);
  if (total === 0) return points[0];
  let left = t * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]) {
      const f = seg[i] === 0 ? 0 : left / seg[i];
      return { x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f };
    }
    left -= seg[i];
  }
  return points[points.length - 1];
}

// -------------------------------------------------------------------------------------------------
// Result bubbles (Tom, 2026-10-12: "when transaction is completed in the building it would be nice to
// see the results float up in a bubble from the building"). Money, scope and days: the three things
// the trophies measure. The numbers are the player's own, before and after; no words are typed in.
// -------------------------------------------------------------------------------------------------

export interface PlayerNumbers {
  money: number;
  days: number;
  scope: number;
}

export interface ResultBubble {
  kind: 'scope' | 'money' | 'days';
  text: string;
  /** good = green (money in, days back), bad = red (money out, days used), info = scope changed. */
  tone: 'good' | 'bad' | 'info';
}

const money = (n: number) => FormatUtils.formatMoney(Math.abs(n), { compact: true });

/** The bubbles one change of a player's numbers makes, in reading order (scope, money, days). */
export function resultBubbles(before: PlayerNumbers, after: PlayerNumbers): ResultBubble[] {
  const out: ResultBubble[] = [];
  const dScope = Math.round(after.scope - before.scope);
  const dMoney = Math.round(after.money - before.money);
  const dDays = Math.round(after.days - before.days);
  if (dScope !== 0) out.push({ kind: 'scope', text: `${dScope > 0 ? '+' : '−'}${money(dScope)} scope`, tone: 'info' });
  if (dMoney !== 0) out.push({ kind: 'money', text: `${dMoney > 0 ? '+' : '−'}${money(dMoney)}`, tone: dMoney > 0 ? 'good' : 'bad' });
  if (dDays !== 0) {
    const n = Math.abs(dDays);
    out.push({ kind: 'days', text: `${dDays > 0 ? '+' : '−'}${n} day${n === 1 ? '' : 's'}`, tone: dDays > 0 ? 'bad' : 'good' });
  }
  return out;
}

/**
 * The bubbles for several changes that belong together (one tap leaves a space and enters the next):
 * the changes are added up first, so the player sees ONE bubble per kind, not one per change (fb:5b8a060c).
 */
export function mergedResultBubbles(changes: Array<{ before: PlayerNumbers; after: PlayerNumbers }>): ResultBubble[] {
  const sum = (k: keyof PlayerNumbers) => changes.reduce((s, c) => s + (c.after[k] - c.before[k]), 0);
  return resultBubbles({ money: 0, days: 0, scope: 0 }, { money: sum('money'), days: sum('days'), scope: sum('scope') });
}
