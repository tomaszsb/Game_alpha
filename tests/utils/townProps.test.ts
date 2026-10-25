import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildTownLayout } from '../../src/utils/townLayout';
import { extractPrefix } from '../../src/constants/characters';
import { areaSegments } from '../../src/utils/townAreas';
import { configureSeasons, seasonLook } from '../../src/utils/townSeasons';
import { freeSpots, makeFreeTest, propBudget, MAX_PROPS_BOARD_FULL, MAX_PROPS_BOARD_LIGHT } from '../../src/utils/townProps';
import { buildTownProps } from '../../src/components/board/TownProps';
import type { TownCsvRow } from '../../src/types/DataTypes';

const CLEAN = path.join(__dirname, '../../public/data/CLEAN_FILES');
function readCsv(file: string): Record<string, string>[] {
  const [head, ...lines] = fs.readFileSync(path.join(CLEAN, file), 'utf-8').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map(l => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()])); });
}
const layoutFor = (seats: number) => buildTownLayout(
  readCsv('TOWN.csv') as unknown as TownCsvRow[],
  readCsv('GAME_CONFIG.csv').map(r => r.space_name).filter(s => s !== 'START-QUICK-PLAY-GUIDE'),
  extractPrefix, s => s, seats,
)!;

configureSeasons([]);
// a day number that lands in each month, starting 2026-10-25 (30 days a step is close enough to walk the year)
const startMonth = 10;
const daysIntoMonth = (m: number) => ((m - startMonth + 12) % 12) * 30 + 5;
const run = (seats: number, month: number, o: { level?: 'full' | 'calm' | 'off'; light?: boolean; gone?: boolean[] } = {}) => {
  const layout = layoutFor(seats);
  const spots = freeSpots(layout);
  const free = makeFreeTest(layout);
  const segments = areaSegments(layout, o.gone ?? []);
  const looks = Array.from({ length: seats }, () => seasonLook(month, 'light'));
  const days = Array.from({ length: seats }, () => daysIntoMonth(month));
  const props = buildTownProps({ layout, spots, free, segments, looks, days, seed: '2026-10-25', level: o.level ?? 'full', light: o.light ?? false, tile: 50, originX: 0, originY: 0 });
  return { layout, props, free };
};

describe('free grass for props', () => {
  for (const seats of [1, 2, 3, 4]) {
    it(`${seats} player(s): there is open grass in every band, none of it on a street, building, tree or cut`, () => {
      const layout = layoutFor(seats);
      const spots = freeSpots(layout);
      expect(spots.length).toBeGreaterThan(40);
      const free = makeFreeTest(layout);
      for (const s of spots) expect(free(s.col, s.row)).toBe(true);
      expect(free(5, 5)).toBe(false);          // a street crossing
      expect(free(2, 2)).toBe(false);          // inside the owner's house
    });
  }
});

describe('props through the year', () => {
  for (const seats of [1, 2, 4]) {
    it(`${seats} player(s): every month, nothing stands on a street, a building, a tree or a cut, and it is the same twice`, () => {
      for (let m = 1; m <= 12; m++) {
        const a = run(seats, m);
        expect(run(seats, m).props).toEqual(a.props);
        for (const p of a.props) expect(a.free(p.col, p.row), `${p.id} month ${m}`).toBe(true);
        expect(new Set(a.props.map(p => p.id)).size).toBe(a.props.length);
      }
    });
  }

  it('no flowers in the cold months; drifts only in the cold months; leaves only from autumn into March', () => {
    for (let m = 1; m <= 12; m++) {
      const kinds = new Set(run(2, m).props.map(p => p.kind));
      if ([12, 1, 2, 3].includes(m)) expect(kinds.has('flower'), `flowers in month ${m}`).toBe(false);
      if (![12, 1, 2].includes(m)) expect(kinds.has('drift'), `drift in month ${m}`).toBe(false);
      if ([12, 1, 2].includes(m)) expect(kinds.has('drift')).toBe(true);
      if ([4, 5, 6, 7, 8].includes(m)) expect(kinds.has('leaf') || kinds.has('pile'), `leaves in month ${m}`).toBe(false);
      if ([10, 11].includes(m)) expect(kinds.has('leaf') || kinds.has('pile'), `leaves in month ${m}`).toBe(true);
      if ([12, 1, 2].includes(m)) expect(kinds.has('leaf') || kinds.has('pile'), 'snow covers the leaves').toBe(false);
    }
    expect(run(2, 3).props.some(p => p.kind === 'leaf' || p.kind === 'pile')).toBe(true);
  });

  it('props move on over the weeks', () => {
    const layout = layoutFor(2);
    const base = { layout, spots: freeSpots(layout), free: makeFreeTest(layout), segments: areaSegments(layout), looks: [seasonLook(6, 'light'), seasonLook(6, 'light')], seed: 's', level: 'full' as const, light: false, tile: 50, originX: 0, originY: 0 };
    const a = buildTownProps({ ...base, days: [10, 10] });
    const b = buildTownProps({ ...base, days: [200, 200] });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(buildTownProps({ ...base, days: [10, 10] })).toEqual(a);
  });

  it('stays inside the budget: 40 on the board at full detail, 12 on a TV, and none when Off', () => {
    for (let m = 1; m <= 12; m++) {
      for (const seats of [1, 2, 3, 4]) {
        expect(run(seats, m).props.length).toBeLessThanOrEqual(MAX_PROPS_BOARD_FULL);
        expect(run(seats, m, { light: true }).props.length).toBeLessThanOrEqual(Math.max(MAX_PROPS_BOARD_LIGHT, 2 * seats));
        expect(run(seats, m, { level: 'off' }).props).toEqual([]);
      }
    }
    expect(propBudget(4, false)).toBe(10);
    expect(propBudget(1, true)).toBe(12);
  });

  it('after a takeover the finished player\'s ground is dressed like the neighbour\'s month, and still nothing is on a street', () => {
    const layout = layoutFor(3);
    const spots = freeSpots(layout);
    const free = makeFreeTest(layout);
    const segments = areaSegments(layout, [false, true, false]);
    const looks = [seasonLook(6, 'light'), seasonLook(1, 'light'), seasonLook(11, 'light')];
    const props = buildTownProps({ layout, spots, free, segments, looks, days: [10, 20, 30], seed: 's', level: 'full', light: false, tile: 50, originX: 0, originY: 0 });
    expect(props.every(p => free(p.col, p.row))).toBe(true);
    // seat 1 has left: nothing is made under its own id
    expect(props.some(p => p.id.startsWith('s|1|'))).toBe(false);
  });
});

describe('the prop pictures', () => {
  it('every picture the props can use exists', () => {
    const names = ['flower_1', 'flower_2', 'flower_3', 'grass_fresh', 'grass_dying', 'leaves_1', 'leaves_2', 'pile_1', 'pile_2', 'drift_1', 'drift_2', 'drift_3'];
    for (const n of names) expect(fs.existsSync(path.join(__dirname, '../../public/images/props', `${n}.png`)), n).toBe(true);
  });
});
