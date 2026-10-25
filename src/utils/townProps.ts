// The town's small scenery (TIME_ON_BOARD_DESIGN.md 2.8): flowers, grass tufts, fallen leaves and leaf piles, snow drifts.
// Each band shows the scenery of its owner's month. Every prop has a "slot" and a lifetime of a few weeks; where it stands
// and when it moves on is worked out from the owner's day number and a fixed seed (no random numbers), so every screen draws
// the same things on the same day. Props only stand on free grass: never on a street, a building, a tree or a cut line.
// A look only, no rule.

import type { TownLayout, TownTree } from './townLayout';
import { townBands } from './townAreas';
import type { SeasonLook } from './townSeasons';
import { hash01 } from './townWeather';

export type PropKind = 'flower' | 'grass' | 'leaf' | 'pile' | 'drift';

export interface TownProp {
  id: string;
  kind: PropKind;
  /** Picture name in /images/props/ (no folder, no extension). */
  pic: string;
  col: number;
  row: number;
}

export interface Spot { col: number; row: number }

/** Clear space kept round a building, a street line, a tree and a cut line (in tiles). */
const BUILDING_MARGIN = 0.5;
const STREET_MARGIN = 0.7;
const TREE_MARGIN = 0.5;
const CUT_MARGIN = 0.5;
const EDGE_MARGIN = 0.4;
const GRID = 0.5;

export type FreeTest = (col: number, row: number) => boolean;

/** Whether a point of the town is open grass a prop may stand on. */
export function makeFreeTest(layout: Pick<TownLayout, 'buildings' | 'streets' | 'trees' | 'bounds' | 'seats' | 'settings'>): FreeTest {
  const { minCol, maxCol, minRow, maxRow } = layout.bounds;
  const cuts = layout.seats > 1 ? townBands(layout).slice(0, -1).map(b => b.bottom) : [];
  return (col, row) => {
    if (col < minCol + EDGE_MARGIN || col > maxCol - EDGE_MARGIN || row < minRow + EDGE_MARGIN || row > maxRow - EDGE_MARGIN) return false;
    for (const b of layout.buildings) {
      if (col > b.col - BUILDING_MARGIN && col < b.col + b.width + BUILDING_MARGIN && row > b.row - BUILDING_MARGIN && row < b.row + b.depth + BUILDING_MARGIN) return false;
    }
    for (const s of layout.streets) if (Math.abs((s.axis === 'col' ? col : row) - s.at) < STREET_MARGIN) return false;
    for (const t of layout.trees) if (Math.abs(t.col - col) < TREE_MARGIN && Math.abs(t.row - row) < TREE_MARGIN) return false;
    for (const c of cuts) if (Math.abs(row - c) < CUT_MARGIN) return false;
    return true;
  };
}

/** Every free grass spot of the town, on a half-tile grid. */
export function freeSpots(layout: Pick<TownLayout, 'buildings' | 'streets' | 'trees' | 'bounds' | 'seats' | 'settings'>): Spot[] {
  const free = makeFreeTest(layout);
  const out: Spot[] = [];
  for (let r = layout.bounds.minRow; r <= layout.bounds.maxRow; r += GRID) {
    for (let c = layout.bounds.minCol; c <= layout.bounds.maxCol; c += GRID) {
      const col = Math.round(c * 100) / 100, row = Math.round(r * 100) / 100;
      if (free(col, row)) out.push({ col, row });
    }
  }
  return out;
}

export const FLOWER_PICS = ['flower_1', 'flower_2', 'flower_3'];
export const DRIFT_PICS = ['drift_1', 'drift_2', 'drift_3'];
/** Most props in a band: PC detail (board-wide cap 40) and a TV or remote strip (board-wide cap 12). */
export const MAX_PROPS_BOARD_FULL = 40;
export const MAX_PROPS_BOARD_LIGHT = 12;
const GRASS_TUFTS = 5;
const LEAF_CAP_FULL = 8;
const LEAF_CAP_LIGHT = 3;

/** How many props one band may show, from how many bands share the board. */
export function propBudget(bands: number, light: boolean): number {
  const total = light ? MAX_PROPS_BOARD_LIGHT : MAX_PROPS_BOARD_FULL;
  return Math.max(2, Math.floor(total / Math.max(1, bands)));
}

/** Which "epoch" a slot is in on a day: it moves on every `life` days, each slot on its own beat. */
function epochOf(seed: string, slot: string, days: number, minLife: number, spread: number): number {
  const life = minLife + Math.floor(hash01(`${seed}|${slot}|life`) * (spread + 1));
  const off = Math.floor(hash01(`${seed}|${slot}|off`) * life);
  return Math.floor((Math.max(0, days) + off) / life);
}

export interface BandPropsInput {
  /** Free spots inside this band (rows owned by the band's owner). */
  spots: Spot[];
  free: FreeTest;
  /** The trees standing in this band. */
  trees: Array<Pick<TownTree, 'col' | 'row'>>;
  /** The owner's own day number and look. */
  days: number;
  look: SeasonLook;
  seed: string;
  seat: number;
  budget: number;
  light: boolean;
}

/** The props one band shows on its owner's day. Pure: the same input gives the same list. */
export function bandProps(o: BandPropsInput): TownProp[] {
  const { spots, look, seed, seat } = o;
  const base = `${seed}|${seat}`;
  const out: TownProp[] = [];
  if (spots.length === 0) return out;
  const pick = (key: string): Spot => spots[Math.min(spots.length - 1, Math.floor(hash01(key) * spots.length))];
  const snowy = look.props.snowCover > 0;

  // Fallen leaves and piles: under trees that have lost their leaves, from autumn on; a few left in March once the snow is gone.
  const leafy = (look.tree === 'autumn' || look.tree === 'bare') && !snowy && look.props.leaves > 0 && o.trees.length > 0;
  if (leafy) {
    const n = Math.round((look.props.leaves / 100) * (o.light ? LEAF_CAP_LIGHT : LEAF_CAP_FULL));
    for (let i = 0; i < n; i++) {
      const isPile = i % 3 === 2;
      const slot = `${base}|leaf${i}`;
      const ep = epochOf(seed, slot, o.days, isPile ? 15 : 20, isPile ? 15 : 20);
      for (let attempt = 0; attempt < 4; attempt++) {
        const k = `${slot}|${ep}|${attempt}`;
        const t = o.trees[Math.min(o.trees.length - 1, Math.floor(hash01(`${k}|t`) * o.trees.length))];
        const radius = isPile ? 1.0 : 0.6 + hash01(`${k}|r`) * 1.4;
        const ang = hash01(`${k}|a`) * Math.PI * 2;
        const col = Math.round((t.col + Math.cos(ang) * radius) * 100) / 100;
        const row = Math.round((t.row + Math.sin(ang) * radius) * 100) / 100;
        if (!o.free(col, row)) continue;
        const pic = `${isPile ? 'pile' : 'leaves'}_${1 + Math.floor(hash01(`${k}|p`) * 2)}`;
        out.push({ id: `${base}|leaf${i}`, kind: isPile ? 'pile' : 'leaf', pic, col, row });
        break;
      }
    }
  }

  // Snow drifts in the cold months: half against a tree's base, the rest on open grass.
  for (let i = 0; i < look.props.snowCover; i++) {
    const slot = `${base}|drift${i}`;
    const ep = epochOf(seed, slot, o.days, 15, 15);
    const k = `${slot}|${ep}`;
    let col: number, row: number;
    if (i % 2 === 0 && o.trees.length > 0) {
      const t = o.trees[Math.min(o.trees.length - 1, Math.floor(hash01(`${k}|t`) * o.trees.length))];
      const ang = hash01(`${k}|a`) * Math.PI * 2;
      col = Math.round((t.col + Math.cos(ang) * 0.9) * 100) / 100;
      row = Math.round((t.row + Math.sin(ang) * 0.9) * 100) / 100;
      if (!o.free(col, row)) { const s = pick(k); col = s.col; row = s.row; }
    } else {
      const s = pick(k); col = s.col; row = s.row;
    }
    out.push({ id: `${base}|drift${i}`, kind: 'drift', pic: DRIFT_PICS[Math.floor(hash01(`${k}|p`) * DRIFT_PICS.length)], col, row });
  }

  // Flowers: none in the cold months (the table says 0); each one moves to a new spot every few weeks, some skip a round.
  for (let i = 0; i < look.props.flowers; i++) {
    const slot = `${base}|flower${i}`;
    const ep = epochOf(seed, slot, o.days, 20, 20);
    const k = `${slot}|${ep}`;
    if (hash01(`${k}|skip`) < 0.12) continue;
    const s = pick(k);
    out.push({ id: slot, kind: 'flower', pic: FLOWER_PICS[Math.floor(hash01(`${k}|p`) * FLOWER_PICS.length)], col: s.col, row: s.row });
  }

  // Grass tufts: fresh or dying by the month's share; none under snow.
  if (!snowy) {
    for (let i = 0; i < GRASS_TUFTS; i++) {
      const slot = `${base}|grass${i}`;
      const ep = epochOf(seed, slot, o.days, 25, 20);
      const k = `${slot}|${ep}`;
      const s = pick(k);
      out.push({ id: slot, kind: 'grass', pic: hash01(`${k}|f`) * 100 < look.props.grassFresh ? 'grass_fresh' : 'grass_dying', col: s.col, row: s.row });
    }
  }

  return out.slice(0, Math.max(0, o.budget));
}
