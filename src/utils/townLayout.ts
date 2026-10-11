// townLayout - the town board's layout, read from TOWN.csv (Tom, 2026-10-11: "A let's see it", then
// "Go now"; design in docs/core/TOWN_BOARD_REVIEW.md, first-build plan). A LOOK ONLY: every square
// stays a square with the same roads and rules; the town just draws each square as a room inside a
// building. Pure functions here (no React) so the layout rules are unit-tested; TownBoard draws them.

import type { TownCsvRow } from '../types/DataTypes';

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
