// townRound - the round town (fb:fefe42f8; Tom 2026-10-29 chose "b", then "the middle can be a nice park with a fountain.
// so a ring is fine"; stage 1a started 10-29). The shared buildings stand in a ring round a park in the middle, and each
// player has a side of their own round the outside. It is the same town list (TOWN.csv) drawn another way: which
// buildings make the ring, which make a player's side, the sizes and the timings all come from `round_*` settings, so a
// different board is a data change. Positions are worked out from the buildings' own sizes so that no two blocks touch
// at any angle the table can stop at.
//
// The table turns: the player whose turn it is sits at the front (nearest the viewer), and the ring brings forward the
// shared building that player stands in. Every building keeps facing the viewer (the same block, at a new place).
// Pure functions here; TownBoard draws and animates them.
//
// Angles are screen angles in degrees, y pointing down: 90 = the front (bottom of the screen), 180 = the left.

import type { TownBuilding, TownLayout, TownTree, GridPoint } from './townLayout';
import type { TownCsvRow } from '../types/DataTypes';

/** Where a building stands before the table turns. */
export interface RoundPlace {
  angle: number;
  radius: number;
  /** In the middle ring (turns with the ring), not on a player's side (turns with the table). */
  ring: boolean;
}

/** A building that stands on another one (the trailer on its site): it keeps the same offset, in tiles. */
export interface RoundRide {
  on: string;
  dc: number;
  dr: number;
}

/** A player's side before the table turns: its centre angle and the arc its lots cover. */
export interface RoundSide {
  seat: number;
  angle: number;
  /** Half the arc the side's lots cover (degrees), lots included. */
  half: number;
}

export interface RoundTree {
  id: string;
  angle: number;
  radius: number;
  species: string;
  /** Stands in the park (shared ground) rather than on the outer ring. */
  park: boolean;
}

export interface RoundTown {
  /** The middle of the town, in grid tiles. */
  cc: number;
  cr: number;
  /** Base ids of the ring's buildings, in order round the ring (the first starts at the front). */
  ring: string[];
  ringRadius: number;
  roadRadius: number;
  sideRadius: number;
  parkRadius: number;
  islandRadius: number;
  fountain: number;
  clockRadius: number;
  clockScale: number;
  /** How much bigger building signs are drawn than on the striped town (the whole round town is in view at once). */
  signScale: number;
  /** How long one turn of the table takes (0 = no motion). */
  turnMs: number;
  /** Building id (copies included) -> where it stands before turning. */
  places: Map<string, RoundPlace>;
  rides: Map<string, RoundRide>;
  sides: RoundSide[];
  trees: RoundTree[];
  /** Base ids painted in their player's colour (`round_player_color`). */
  playerColor: Set<string>;
}

/** The table's turn and the ring's (the ring's angle is its own, not added to the table's). */
export interface RoundPose {
  table: number;
  ring: number;
}

const num = (s: string | undefined, fallback: number): number => {
  const n = parseFloat(s ?? '');
  return Number.isFinite(n) ? n : fallback;
};
const words = (s: string | undefined): string[] => (s ?? '').split(/[\s,]+/).map(w => w.trim()).filter(Boolean);
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
/** Half the diagonal of a block: the most it reaches from its centre at any angle. */
const reach = (b: Pick<TownBuilding, 'width' | 'depth'>) => Math.hypot(b.width, b.depth) / 2;
/** Centre-to-centre distance at which two blocks never touch, whatever the angle between them. */
const apart = (a: Pick<TownBuilding, 'width' | 'depth'>, b: Pick<TownBuilding, 'width' | 'depth'>, gap: number) =>
  ((Math.max(a.width, a.depth) + Math.max(b.width, b.depth)) / 2) * Math.SQRT2 + gap;

/** An angle turned to the short way round: between -180 (included) and 180 (excluded). */
export function shortTurn(d: number): number {
  const m = (((d + 180) % 360) + 360) % 360 - 180;
  return Object.is(m, -0) ? 0 : m;
}

/**
 * Whether a NEW game gets the round town: the town data says so for every game (`round_town` = on, a classroom's
 * choice), or the host started this one game from a link that asks for it (`?town=round`). Off by default. The answer
 * is stored on the game when it starts, so every screen of that game agrees.
 */
export function newGameTownShape(rows: Pick<TownCsvRow, 'kind' | 'id' | 'value'>[], search: string): 'round' | undefined {
  const asked = new URLSearchParams(search).get('town');
  if (asked === 'round') return 'round';
  if (asked === 'stripes') return undefined;
  const setting = rows.find(r => r.kind === 'setting' && r.id === 'round_town');
  return (setting?.value ?? '').trim().toLowerCase() === 'on' ? 'round' : undefined;
}

/** The screen angle of a seat's side before the table turns: the first player at the front, the others round the table. */
export function seatAngle(seat: number, seats: number): number {
  return 90 + (seat * 360) / Math.max(1, seats);
}

/** A grid point at a screen angle and a distance from the middle of town. */
export function roundPoint(rt: Pick<RoundTown, 'cc' | 'cr'>, angle: number, radius: number): GridPoint {
  // isoPoint draws grid (col, row) turned 45 degrees, so a screen angle is a grid angle 45 degrees less.
  return { col: rt.cc + radius * Math.cos(rad(angle - 45)), row: rt.cr + radius * Math.sin(rad(angle - 45)) };
}

/** The screen angle of a grid point seen from the middle of town. */
export function roundAngle(rt: Pick<RoundTown, 'cc' | 'cr'>, p: GridPoint): number {
  return deg(Math.atan2(p.row - rt.cr, p.col - rt.cc)) + 45;
}

/**
 * Make a layout round (the `round_*` settings). Every building keeps its size, rooms and seat; only where it stands
 * changes. Returns null (the town stays striped) when the data names no ring.
 */
export function makeRoundTown(layout: TownLayout): RoundTown | null {
  const s = layout.settings;
  const byId = new Map(layout.buildings.map(b => [b.id, b]));
  const ring = words(s.round_ring).filter(id => byId.has(id) && byId.get(id)!.seat === undefined);
  if (ring.length === 0) return null;
  const sideIds = words(s.round_side).filter(id => byId.has(id));
  const gap = num(s.round_gap, 0.8);
  const seats = Math.max(1, layout.seats);

  // The things that ride on another building, with their offset in the town list (so the trailer stays on its site).
  const rides = new Map<string, RoundRide>();
  const centreOf = (b: TownBuilding) => ({ col: b.col + b.width / 2, row: b.row + b.depth / 2 });
  for (const pair of words(s.round_with)) {
    const [rider, on] = pair.split(':');
    const a = byId.get(rider), b = byId.get(on);
    if (!a || !b) continue;
    const ca = centreOf(a), cb = centreOf(b);
    rides.set(rider, { on, dc: ca.col - cb.col, dr: ca.row - cb.row });
  }

  // The ring: equal steps, wide enough that the two biggest neighbours never touch.
  const ringB = ring.map(id => byId.get(id)!);
  const step = 360 / ring.length;
  const widest = ringB.reduce((m, b, i) => Math.max(m, apart(b, ringB[(i + 1) % ringB.length], gap)), 0);
  const ringRadius = Math.max(num(s.round_ring_radius, 7.6), ring.length > 1 ? widest / (2 * Math.sin(Math.PI / ring.length)) : 0);
  const ringReach = Math.max(...ringB.map(reach));

  // A player's side: its lots left to right as seen from the front, each pair far enough apart at any angle.
  const sideB = sideIds.map(id => byId.get(id)!);
  const gapsTiles = sideB.slice(1).map((b, i) => apart(sideB[i], b, gap));
  const sideReach = sideB.length ? Math.max(...sideB.map(reach)) : 0;
  const ends = sideB.length ? (reach(sideB[0]) + reach(sideB[sideB.length - 1])) : 0;
  const sideArcTiles = gapsTiles.reduce((a, b) => a + b, 0) + ends + 2 * gap;
  const sideRadius = Math.max(
    num(s.round_side_radius, 17.5),
    ringRadius + ringReach + sideReach + 3,
    (seats * sideArcTiles) / (2 * Math.PI),
  );
  const offsets: number[] = [];
  let at = 0;
  for (let i = 0; i < sideB.length; i++) {
    if (i > 0) at += deg(gapsTiles[i - 1] / sideRadius);
    offsets.push(at);
  }
  const spanDeg = offsets.length ? offsets[offsets.length - 1] : 0;
  const half = spanDeg / 2 + deg((sideReach + gap) / sideRadius);

  const ringOuter = ringRadius + ringReach, sideInner = sideRadius - sideReach;
  const roadWanted = num(s.round_road_radius, (ringOuter + sideInner) / 2);
  const roadRadius = ringOuter + 0.8 <= sideInner - 0.8 ? Math.min(Math.max(roadWanted, ringOuter + 0.8), sideInner - 0.8) : (ringOuter + sideInner) / 2;
  const parkRadius = Math.max(1, Math.min(num(s.round_park_radius, 4.4), ringRadius - ringReach - 0.3));
  const islandRadius = Math.max(num(s.round_island_radius, 21), sideRadius + sideReach + 1.2);
  const fountain = Math.max(0, Math.min(num(s.round_fountain, 1.3), parkRadius * 0.6));

  const places = new Map<string, RoundPlace>();
  ring.forEach((id, i) => places.set(id, { angle: 90 + i * step, radius: ringRadius, ring: true }));
  const sides: RoundSide[] = [];
  for (let seat = 0; seat < seats; seat++) {
    const centre = seatAngle(seat, seats);
    sides.push({ seat, angle: centre, half });
    sideIds.forEach((id, i) => {
      const copy = seat === 0 ? id : `${id}@${seat}`;
      if (!byId.has(copy)) return;
      // the first lot is the left one at the front, and left is the larger angle there
      places.set(copy, { angle: centre + spanDeg / 2 - offsets[i], radius: sideRadius, ring: false });
    });
  }
  // The same ride for every player's copy (trailer@2 rides on site@2).
  for (const [rider, r] of [...rides]) {
    for (let seat = 1; seat < seats; seat++) {
      if (byId.has(`${rider}@${seat}`) && byId.has(`${r.on}@${seat}`)) rides.set(`${rider}@${seat}`, { ...r, on: `${r.on}@${seat}` });
    }
  }
  // Anything the round settings do not place (a teacher's new square) waits in the park, evenly round the fountain.
  const loose = layout.buildings.filter(b => !places.has(b.id) && !rides.has(b.id));
  loose.forEach((b, i) => places.set(b.id, { angle: 90 + (i * 360) / loose.length + step / 2, radius: Math.max(fountain + reach(b) + 0.3, parkRadius * 0.6), ring: true }));

  const trees: RoundTree[] = [];
  const cc = islandRadius + 2, cr = islandRadius + 2;
  const rt0 = { cc, cr };
  const boxes = layout.buildings.map(b => ({ b, p: places.get(b.id) })).filter(x => x.p && !x.p.ring);
  const clear = (angle: number, radius: number) => boxes.every(({ b, p }) => {
    const q = roundPoint(rt0, p!.angle, p!.radius), t = roundPoint(rt0, angle, radius);
    return Math.abs(q.col - t.col) > b.width / 2 + 0.9 || Math.abs(q.row - t.row) > b.depth / 2 + 0.9;
  });
  const edge = words(s.round_trees);
  if (edge.length >= 2) {
    const radius = islandRadius - num(edge[0], 1.4), count = Math.max(0, Math.round(num(edge[1], 0))), kinds = edge.slice(2).length ? edge.slice(2) : ['oak'];
    for (let i = 0; i < count; i++) {
      const angle = 90 + (i * 360) / count + 180 / count;
      if (clear(angle, radius)) trees.push({ id: `round-tree-${i}`, angle, radius, species: kinds[i % kinds.length], park: false });
    }
  }
  const park = words(s.round_park_trees);
  if (park.length >= 2) {
    const radius = Math.min(num(park[0], 3), parkRadius - 0.6), count = Math.max(0, Math.round(num(park[1], 0))), kinds = park.slice(2).length ? park.slice(2) : ['oak'];
    for (let i = 0; i < count; i++) trees.push({ id: `round-park-tree-${i}`, angle: 90 + (i * 360) / count + 180 / count, radius, species: kinds[i % kinds.length], park: true });
  }

  return {
    cc, cr, ring, ringRadius, roadRadius, sideRadius, parkRadius, islandRadius, fountain,
    clockRadius: islandRadius + num(s.round_clock_out, 1.2),
    clockScale: Math.max(0.5, num(s.round_clock_scale, 2.6)),
    signScale: Math.min(3, Math.max(0.5, num(s.round_sign_scale, 1.6))),
    turnMs: Math.max(0, num(s.round_turn_ms, 1500)),
    places, rides, sides, trees,
    playerColor: new Set(words(s.round_player_color)),
  };
}

/** A building's screen angle once the table (or, for a ring building, the ring) has turned. */
export function posedAngle(place: RoundPlace, pose: RoundPose): number {
  return place.angle + (place.ring ? pose.ring : pose.table);
}

/**
 * The layout as it stands at one pose: every building and tree moved to its place. Its bounds are the island's, the
 * same at every pose, so the board's frame never changes size as the table turns.
 */
export function poseRoundTown(layout: TownLayout & { round: RoundTown }, pose: RoundPose): TownLayout & { round: RoundTown } {
  const rt = layout.round;
  const moved = new Map<string, TownBuilding>();
  const place = (b: TownBuilding): TownBuilding => {
    const done = moved.get(b.id);
    if (done) return done;
    const ride = rt.rides.get(b.id);
    const host = ride ? layout.buildings.find(x => x.id === ride.on) : undefined;
    let c: GridPoint;
    if (ride && host) {
      const h = place(host);
      c = { col: h.col + h.width / 2 + ride.dc, row: h.row + h.depth / 2 + ride.dr };
    } else {
      const p = rt.places.get(b.id);
      c = p ? roundPoint(rt, posedAngle(p, pose), p.radius) : { col: rt.cc, row: rt.cr };
    }
    const out = { ...b, col: c.col - b.width / 2, row: c.row - b.depth / 2 };
    moved.set(b.id, out);
    return out;
  };
  const buildings = layout.buildings.map(place);
  const trees: TownTree[] = rt.trees.map(t => {
    const p = roundPoint(rt, t.angle + pose.table, t.radius);
    return { id: t.id, col: p.col, row: p.row, species: t.species, seat: 0 };
  });
  const r = rt.islandRadius + 1;
  return {
    ...layout, buildings, trees, streets: [],
    bounds: { minCol: rt.cc - r, minRow: rt.cr - r, maxCol: rt.cc + r, maxRow: rt.cr + r },
  };
}

/**
 * The next pose: the table turns the short way to bring the current player's side to the front; the ring brings
 * forward the shared building that player stands in (`ringIndex`, -1 when they are on their own side), else it rides
 * round with the table. With no earlier pose (the board just opened) it is placed straight there.
 */
export function nextPose(prev: RoundPose | null, currentSeat: number, ringIndex: number, rt: Pick<RoundTown, 'ring'>, seats: number): RoundPose {
  const tableTarget = -((Math.max(0, currentSeat) * 360) / Math.max(1, seats));
  const ringTarget = (index: number) => -((index * 360) / Math.max(1, rt.ring.length));
  if (!prev) return { table: tableTarget, ring: ringIndex >= 0 ? ringTarget(ringIndex) : tableTarget };
  const table = prev.table + shortTurn(tableTarget - prev.table);
  const ring = ringIndex >= 0 ? prev.ring + shortTurn(ringTarget(ringIndex) - prev.ring) : prev.ring + (table - prev.table);
  return { table, ring };
}

/** The angle ranges each player owns (before the table turns): halfway to the nearest player still playing on each side. */
export interface RoundWedge {
  seat: number;
  from: number;
  to: number;
}

export function roundWedges(rt: Pick<RoundTown, 'sides'>, gone: boolean[] = []): RoundWedge[] {
  let alive = rt.sides.filter(s => !gone[s.seat]);
  if (alive.length === 0) alive = rt.sides;
  if (alive.length === 1) return [{ seat: alive[0].seat, from: alive[0].angle - 180, to: alive[0].angle + 180 }];
  const sorted = [...alive].sort((a, b) => a.angle - b.angle);
  return sorted.map((s, i) => {
    const prev = sorted[(i - 1 + sorted.length) % sorted.length], next = sorted[(i + 1) % sorted.length];
    const back = ((s.angle - prev.angle + 360) % 360) || 360, fwd = ((next.angle - s.angle + 360) % 360) || 360;
    return { seat: s.seat, from: s.angle - back / 2, to: s.angle + fwd / 2 };
  });
}

/** The seat that owns the ground at an angle (before the table turns). */
export function ownerOfAngle(wedges: RoundWedge[], angle: number): number {
  for (const w of wedges) {
    const a = w.from + ((((angle - w.from) % 360) + 360) % 360);
    if (a >= w.from && a < w.to) return w.seat;
  }
  return wedges[0]?.seat ?? 0;
}

/**
 * The walk from one building to another in a round town: out to the ring road, round it the short way, in at the other
 * door. Grid points on the posed layout, like walkPath. Empty for the same building (a hop).
 */
export function roundWalkPath(layout: TownLayout & { round: RoundTown }, fromId: string, toId: string): GridPoint[] {
  if (fromId === toId) return [];
  const rt = layout.round;
  const a = layout.buildings.find(b => b.id === fromId), b = layout.buildings.find(x => x.id === toId);
  if (!a || !b) return [];
  const ca = { col: a.col + a.width / 2, row: a.row + a.depth / 2 }, cb = { col: b.col + b.width / 2, row: b.row + b.depth / 2 };
  const fromA = roundAngle(rt, ca), toA = fromA + shortTurn(roundAngle(rt, cb) - fromA);
  const pts: GridPoint[] = [ca];
  const steps = Math.max(1, Math.ceil(Math.abs(toA - fromA) / 8));
  for (let i = 0; i <= steps; i++) pts.push(roundPoint(rt, fromA + ((toA - fromA) * i) / steps, rt.roadRadius));
  pts.push(cb);
  return pts;
}
