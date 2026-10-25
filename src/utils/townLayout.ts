// townLayout - the town board's layout, read from TOWN.csv (Tom, 2026-10-11: "A let's see it", then
// "Go now"; design in docs/core/TOWN_BOARD_REVIEW.md, first-build plan). A LOOK ONLY: every square
// stays a square with the same roads and rules; the town just draws each square as a room inside a
// building. Pure functions here (no React) so the layout rules are unit-tested; TownBoard draws them.

import type { TownCsvRow } from '../types/DataTypes';
import { FormatUtils } from './FormatUtils';
import { ordinal } from './liveTrophies';
import type { TrophyId } from './trophyRules';

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
  /**
   * Which player's own building this is (0 = the first player), or undefined for a place everybody shares. A town list
   * marks the buildings each player gets their own of with `perplayer` rows; the town is then drawn with one copy
   * per player in the game (fb:aec545c4: "in multiplayer there should be multiple owner buildings and offices and sites").
   */
  seat?: number;
  /** Space ids inside, in TOWN.csv order. */
  rooms: string[];
  /** Rooms that are in this building only for a player of one project kind (`variant` rows); also in another building's `rooms`. */
  altRooms: string[];
  /** True for a lot made up for a square the town list does not place (a teacher's new square). */
  isNewPlace?: boolean;
  /**
   * When its name shows (TOWN.csv `value` on the building row): 'shown' = from the start, 'scope' = once a
   * player has a scope, 'scope_new' / 'scope_existing' = once a player's scope is of that kind (see projectKind.ts),
   * anything else = once a player has been there or is offered a move there (fb:aec545c4).
   */
  reveal: 'shown' | 'scope' | 'scope_new' | 'scope_existing' | 'visit';
}

export interface TownStreet {
  axis: 'col' | 'row';
  at: number;
  /** A copy made for another player's band of the town. */
  copy?: boolean;
}

/**
 * A tree on open grass (TOWN.csv `tree` rows). A row with no `value` stands in the first player's band only. A row with
 * `rest` is placed in the second player's band and copied down for every player after that: the first band and the later
 * ones have different open grass (the bank row only stands in the first), so each gets trees where it really has room.
 */
export interface TownTree {
  id: string;
  col: number;
  row: number;
  /** Which kind of picture (a folder of looks); TOWN.csv `icon`. */
  species: string;
  /** Whose band it was placed in (its home player). */
  seat: number;
}

export interface TownLayout {
  /** How many players the town was drawn for (1 = the plain town). */
  seats: number;
  buildings: TownBuilding[];
  streets: TownStreet[];
  trees: TownTree[];
  /** Space id -> building id, for every placed space. */
  roomToBuilding: Map<string, string>;
  /** Space id -> (project kind -> building id): where a room is for a player of that kind (TOWN.csv `variant` rows). */
  roomVariants: Map<string, Map<string, string>>;
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
  /** One copy of each `perplayer` building per player: how many players the town is drawn for. */
  seats = 1,
): TownLayout | null {
  const buildings: TownBuilding[] = [];
  const byId = new Map<string, TownBuilding>();
  const streets: TownStreet[] = [];
  const settings: Record<string, string> = {};
  const perPlayer = new Set<string>();
  const trees: TownTree[] = [];

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
        altRooms: [],
        reveal: (['shown', 'scope', 'scope_new', 'scope_existing'] as const).find(v => v === r.value) ?? 'visit',
      };
      buildings.push(b);
      byId.set(b.id, b);
    } else if (r.kind === 'street') {
      if (r.col !== '') streets.push({ axis: 'col', at: num(r.col) });
      else if (r.row !== '') streets.push({ axis: 'row', at: num(r.row) });
    } else if (r.kind === 'tree') {
      trees.push({ id: r.id, col: num(r.col), row: num(r.row), species: r.icon || 'oak', seat: r.value === 'rest' ? 1 : 0 });
    } else if (r.kind === 'setting') {
      settings[r.id] = r.value;
    } else if (r.kind === 'perplayer') {
      perPlayer.add(r.id);
    }
  }
  if (buildings.length === 0) return null;
  // second-band trees only exist when there is a second band
  for (let i = trees.length - 1; i >= 0; i--) if (trees[i].seat >= Math.max(1, Math.floor(seats))) trees.splice(i, 1);

  const onBoard = new Set(spaceNames);
  const roomToBuilding = new Map<string, string>();
  for (const r of rows) {
    if (r.kind !== 'room' || !onBoard.has(r.id) || roomToBuilding.has(r.id)) continue;
    const b = byId.get(r.building);
    if (!b) continue;
    b.rooms.push(r.id);
    roomToBuilding.set(r.id, b.id);
  }

  // A room that is in a different building for a player of a given project kind (the two construction sites).
  const roomVariants = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (r.kind !== 'variant' || !onBoard.has(r.id) || !r.value) continue;
    const b = byId.get(r.building);
    if (!b || !roomToBuilding.has(r.id)) continue;
    if (!roomVariants.has(r.id)) roomVariants.set(r.id, new Map());
    if (roomVariants.get(r.id)!.has(r.value)) continue;
    roomVariants.get(r.id)!.set(r.value, b.id);
    b.altRooms.push(r.id);
  }

  // One copy of each per-player building for every player after the first, in a band of town further down (the
  // copies carry the same rooms for display; where a room's walkers stand is decided by buildingOfRoom).
  const seatCount = Math.max(1, Math.floor(seats));
  const bandRows = num(settings.seat_drow ?? '', 16.4);
  const bandCols = num(settings.seat_dcol ?? '', 0);
  for (const b of [...buildings]) {
    if (perPlayer.has(b.id)) b.seat = 0;
  }
  for (let s = 1; s < seatCount; s++) {
    for (const base of [...buildings]) {
      if (base.seat !== 0 || base.id.includes('@')) continue;
      const copy: TownBuilding = {
        ...base, id: `${base.id}@${s}`, seat: s,
        col: base.col + s * bandCols, row: base.row + s * bandRows,
        rooms: [...base.rooms], altRooms: [...base.altRooms],
      };
      buildings.push(copy);
      byId.set(copy.id, copy);
    }
    if (s >= 2) {
      for (const t of trees.filter(x => x.seat === 1 && !x.id.includes('@'))) {
        trees.push({ ...t, id: `${t.id}@${s}`, seat: s, col: t.col + (s - 1) * bandCols, row: t.row + (s - 1) * bandRows });
      }
    }
    for (const st of [...streets]) {
      if (st.axis === 'row' && !st.copy) streets.push({ axis: 'row', at: st.at + s * bandRows, copy: true });
    }
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
      altRooms: [],
      isNewPlace: true,
      reveal: 'visit',
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
  return { seats: seatCount, buildings, streets, trees, roomToBuilding, roomVariants, bounds, settings };
}

/** Who is asking where a room is: their project kind (new / existing) and which player's seat they hold. */
export interface Who {
  kind?: string;
  seat?: number;
}

/**
 * The building a room is in for this player: their project kind picks the construction site (`variant` rows), and if
 * that building is one each player has their own of, it is the copy in THEIR seat's band of the town.
 */
export function buildingOfRoom(layout: TownLayout, space: string, who?: Who): string | undefined {
  const base = (who?.kind ? layout.roomVariants.get(space)?.get(who.kind) : undefined) ?? layout.roomToBuilding.get(space);
  if (!base || !who?.seat || who.seat < 1) return base;
  const copy = `${base}@${who.seat}`;
  return layout.buildings.some(b => b.id === copy) ? copy : base;
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
  // A big flat lot (the building site) hangs its sign from the back edge, so a building standing on it
  // (the trailer) can have its own sign in the middle without the two landing on each other.
  const roofRow = b.height === 0 && b.depth > 4 ? b.row + 0.4 : b.row + b.depth / 2;
  const roof = isoPoint(b.col + b.width / 2, roofRow, b.height, tile);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, roofX: roof.x, roofY: roof.y };
}

export interface TownPlayerMark {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  currentSpace: string;
  /** new building or existing one (projectKind.ts), once the player has a scope. */
  projectKind?: string;
  /** Which seat the player holds (0 = first), for the buildings each player has their own of. */
  seat?: number;
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
  /** The current player's kind and seat, so the next moves land in THEIR construction site and rooms. */
  currentWho?: Who,
): Map<string, BuildingView> {
  const views = new Map<string, BuildingView>();
  for (const b of layout.buildings) {
    views.set(b.id, { isCurrent: false, currentRoom: null, destinationRooms: [], playersHere: [] });
  }
  for (const p of players) {
    const bid = buildingOfRoom(layout, p.currentSpace, { kind: p.projectKind, seat: p.seat });
    const v = bid ? views.get(bid) : undefined;
    if (!v) continue;
    v.playersHere.push(p);
    if (p.id === currentPlayerId) {
      v.isCurrent = true;
      v.currentRoom = p.currentSpace;
    }
  }
  for (const m of validMoves) {
    const bid = buildingOfRoom(layout, m, currentWho);
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
  kind: 'scope' | 'money' | 'days' | 'trophy';
  /** For a trophy bubble: which race moved (its picture comes from TROPHIES.csv). */
  trophy?: TrophyId;
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

/** The races in the order a student reads them (the clipboard's Time, Scope, Money). */
const TROPHY_ORDER: readonly TrophyId[] = ['time', 'quality', 'money'];

/**
 * The trophy markers after a Commit or Negotiate: for each race the player was placed in both before and after and
 * whose place changed, a green plus (moved up) or red minus (moved down) with the new place ("+ 2nd"). A race that is
 * not on (alone, everyone level) or a place that did not change says nothing. At most two, so the bubble fits a phone.
 */
export function trophyBubbles(before: Record<TrophyId, number | null>, after: Record<TrophyId, number | null>): ResultBubble[] {
  const out: ResultBubble[] = [];
  for (const id of TROPHY_ORDER) {
    const was = before[id];
    const now = after[id];
    if (was === null || now === null || was === undefined || now === undefined || was === now) continue;
    const up = now < was;
    out.push({ kind: 'trophy', trophy: id, text: `${up ? '+' : '−'} ${ordinal(now)}`, tone: up ? 'good' : 'bad' });
  }
  return out.slice(0, 2);
}

/**
 * The bubbles for several changes that belong together (one tap leaves a space and enters the next):
 * the changes are added up first, so the player sees ONE bubble per kind, not one per change (fb:5b8a060c).
 */
export function mergedResultBubbles(changes: Array<{ before: PlayerNumbers; after: PlayerNumbers }>): ResultBubble[] {
  const sum = (k: keyof PlayerNumbers) => changes.reduce((s, c) => s + (c.after[k] - c.before[k]), 0);
  return resultBubbles({ money: 0, days: 0, scope: 0 }, { money: sum('money'), days: sum('days'), scope: sum('scope') });
}

/**
 * Which buildings have earned their name (fb:aec545c4: "the building names do not have to show up right
 * away"). The buildings are always drawn; only the name and the room list are held back. A building is named when
 * its data says 'shown', when its data says 'scope' and some player has a scope (or 'scope_new' / 'scope_existing'
 * and some player's scope is of that kind), or when any player has been in it or is offered a move into it.
 */
export function revealedBuildings(
  layout: TownLayout,
  state: {
    /** Rooms players have been in, each with that player's kind and seat. */
    visited: Iterable<{ space: string } & Who>;
    /** Rooms the current player can move to next, and their kind and seat. */
    offered: { spaces: Iterable<string> } & Who;
    /** The project kind and seat of each player who has a scope. */
    scopeKinds: Iterable<{ kind: string; seat?: number }>;
  },
): Set<string> {
  const reached = new Set<string>();
  for (const v of state.visited) { const b = buildingOfRoom(layout, v.space, v); if (b) reached.add(b); }
  for (const s of state.offered.spaces) { const b = buildingOfRoom(layout, s, state.offered); if (b) reached.add(b); }
  const scoped = [...state.scopeKinds];
  const out = new Set<string>();
  for (const b of layout.buildings) {
    // A building that belongs to one player only counts that player's scope; a shared one counts anybody's.
    const mine = scoped.filter(k => b.seat === undefined || (k.seat ?? 0) === b.seat);
    const byScope = b.reveal === 'scope' ? mine.length > 0
      : b.reveal === 'scope_new' ? mine.some(k => k.kind === 'new')
      : b.reveal === 'scope_existing' ? mine.some(k => k.kind === 'existing')
      : false;
    if (b.reveal === 'shown' || reached.has(b.id) || byScope) out.add(b.id);
  }
  return out;
}

/**
 * Buildings that are built for one project kind and are not the kind of anyone's scope: the other construction
 * site. They stay standing but fade, so the player's own site stands out (Tom: "the other site stays unlabelled or fades").
 */
export function fadedBuildings(layout: TownLayout, scopeKinds: Iterable<{ kind: string; seat?: number }>): Set<string> {
  const scoped = [...scopeKinds];
  const out = new Set<string>();
  for (const b of layout.buildings) {
    // Each player's own pair fades only once THAT player has a scope; a shared site waits for anybody's.
    const mine = scoped.filter(k => b.seat === undefined || (k.seat ?? 0) === b.seat);
    if (mine.length === 0) continue;
    if ((b.reveal === 'scope_new' && !mine.some(k => k.kind === 'new')) || (b.reveal === 'scope_existing' && !mine.some(k => k.kind === 'existing'))) out.add(b.id);
  }
  return out;
}
