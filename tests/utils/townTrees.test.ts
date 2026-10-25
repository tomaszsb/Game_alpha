import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildTownLayout } from '../../src/utils/townLayout';
import { extractPrefix } from '../../src/constants/characters';
import { townBands } from '../../src/utils/townAreas';
import { MAX_TREE_SCALE, treePicture, treeScale } from '../../src/utils/townTrees';
import { TREE_LOOKS, configureSeasons, seasonLook } from '../../src/utils/townSeasons';
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

describe('trees on the stock town', () => {
  const MARGIN = 0.3;
  for (const seats of [1, 2, 3, 4]) {
    it(`${seats} player(s): each band has its trees, none on a street, a building, a cut or the water`, () => {
      const layout = layoutFor(seats);
      expect(layout.trees.filter(t => t.seat === 0).length).toBeGreaterThanOrEqual(10);
      const laterCount = layout.trees.filter(t => t.seat === 1).length;
      expect(laterCount).toBe(seats > 1 ? 6 : 0);
      for (let s = 2; s < seats; s++) expect(layout.trees.filter(t => t.seat === s).length).toBe(laterCount);
      expect(new Set(layout.trees.map(t => t.id)).size).toBe(layout.trees.length);
      const cuts = townBands(layout).slice(0, -1).map(b => b.bottom);
      for (const t of layout.trees) {
        for (const b of layout.buildings) {
          const inside = t.col > b.col - MARGIN && t.col < b.col + b.width + MARGIN && t.row > b.row - MARGIN && t.row < b.row + b.depth + MARGIN;
          expect(inside, `${t.id} stands on ${b.id}`).toBe(false);
        }
        for (const st of layout.streets) {
          expect(Math.abs((st.axis === 'col' ? t.col : t.row) - st.at), `${t.id} on a street`).toBeGreaterThan(MARGIN + 0.2);
        }
        for (const c of cuts) expect(Math.abs(t.row - c), `${t.id} on a cut line`).toBeGreaterThan(MARGIN);
        expect(t.col).toBeGreaterThan(layout.bounds.minCol);
        expect(t.col).toBeLessThan(layout.bounds.maxCol);
        const own = townBands(layout)[t.seat];
        expect(t.row).toBeGreaterThan(own.top);
        expect(t.row).toBeLessThan(own.bottom);
      }
    });
  }

  it('every tree has pictures for every look', () => {
    const layout = layoutFor(1);
    for (const t of layout.trees) for (const look of TREE_LOOKS) {
      expect(fs.existsSync(path.join(__dirname, '../../public', treePicture(t, look))), `${t.species} ${look}`).toBe(true);
    }
  });
});

describe('tree size', () => {
  it('starts as drawn, grows with days, never shrinks and stops at the cap', () => {
    expect(treeScale(0)).toBe(1);
    expect(treeScale(365)).toBeCloseTo(1.1, 5);
    let last = 0;
    for (let d = 0; d <= 5000; d += 50) { const s = treeScale(d); expect(s).toBeGreaterThanOrEqual(last); last = s; }
    expect(treeScale(100000)).toBe(MAX_TREE_SCALE);
    expect(treeScale(-5)).toBe(1);
    expect(treeScale(NaN)).toBe(1);
  });
});

describe('tree looks by month', () => {
  it('winter is snowy or bare, spring blossoms, summer is green, October is autumn', () => {
    configureSeasons([]);
    const by = (m: number) => seasonLook(m, 'light').tree;
    expect([by(1), by(2), by(12)]).toEqual(['snowy', 'snowy', 'snowy']);
    expect(by(4)).toBe('blossom');
    expect([5, 6, 7, 8, 9].map(by)).toEqual(Array(5).fill('summer'));
    expect(by(10)).toBe('autumn');
    expect(['bare']).toContain(by(11));
    for (let m = 1; m <= 12; m++) expect(TREE_LOOKS).toContain(by(m));
  });
});
