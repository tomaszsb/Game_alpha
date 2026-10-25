import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildTownLayout } from '../../src/utils/townLayout';
import { extractPrefix } from '../../src/constants/characters';
import { areaSegments, hasLeftBoard, ownerOfRow, townBands } from '../../src/utils/townAreas';
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

describe('town bands (stock town)', () => {
  for (const seats of [1, 2, 3, 4]) {
    it(`${seats} player(s): one band each, joined end to end, no building on a cut`, () => {
      const layout = layoutFor(seats);
      const bands = townBands(layout);
      expect(bands.length).toBe(seats);
      for (let i = 1; i < seats; i++) expect(bands[i].top).toBe(bands[i - 1].bottom);
      for (let i = 0; i < seats - 1; i++) {
        const cut = bands[i].bottom;
        for (const b of layout.buildings) {
          expect(cut > b.row && cut < b.row + b.depth, `${b.id} straddles the cut at row ${cut}`).toBe(false);
        }
      }
    });
  }

  it("a player's own buildings sit inside their band", () => {
    const layout = layoutFor(3);
    const bands = townBands(layout);
    for (const b of layout.buildings) {
      if (b.seat === undefined) continue;
      expect(b.row).toBeGreaterThanOrEqual(bands[b.seat].top);
      expect(b.row + b.depth).toBeLessThanOrEqual(bands[b.seat].bottom);
    }
  });
});

describe('who owns which ground', () => {
  const layout3 = layoutFor(3);
  const layout4 = layoutFor(4);

  it('with everyone playing, each owns their band; one player owns it all', () => {
    const seg = areaSegments(layout3);
    expect(seg.map(s => s.seat)).toEqual([0, 1, 2]);
    const bands = townBands(layout3);
    expect(seg[0].to).toBe(bands[0].bottom);
    expect(ownerOfRow(seg, bands[1].top + 1)).toBe(1);
    const one = areaSegments(layoutFor(1));
    expect(one).toEqual([{ seat: 0, from: -1000, to: 1000 }]);
  });

  it('a finished player in the middle gives half to the one above and half to the one below', () => {
    const bands = townBands(layout3);
    const seg = areaSegments(layout3, [false, true, false]);
    expect(seg.map(s => s.seat)).toEqual([0, 2]);
    const mid = (bands[1].top + bands[1].bottom) / 2;
    expect(ownerOfRow(seg, mid - 1)).toBe(0);
    expect(ownerOfRow(seg, mid + 1)).toBe(2);
  });

  it('a finished player at an edge gives all of it to the one neighbour', () => {
    const top = areaSegments(layout3, [true, false, false]);
    expect(top.map(s => s.seat)).toEqual([1, 2]);
    expect(ownerOfRow(top, -50)).toBe(1);
    const bottom = areaSegments(layout3, [false, false, true]);
    expect(bottom.map(s => s.seat)).toEqual([0, 1]);
    expect(ownerOfRow(bottom, 500)).toBe(1);
  });

  it('is worked out from who has left, so the order does not matter; the last one standing has it all', () => {
    const mid = areaSegments(layout4, [false, true, true, false]);
    expect(mid.map(s => s.seat)).toEqual([0, 3]);
    const last = areaSegments(layout4, [true, true, false, true]);
    expect(last).toEqual([{ seat: 2, from: -1000, to: 1000 }]);
  });

  it('nobody left playing is treated as nobody having left', () => {
    expect(areaSegments(layout3, [true, true, true])).toEqual(areaSegments(layout3));
  });

  it('segments cover every row with no gap', () => {
    const seg = areaSegments(layout4, [false, true, false, true]);
    expect(seg[0].from).toBe(-1000);
    expect(seg[seg.length - 1].to).toBe(1000);
    for (let i = 1; i < seg.length; i++) expect(seg[i].from).toBe(seg[i - 1].to);
  });
});

describe('hasLeftBoard', () => {
  it('is true once a player has finished or gone out', () => {
    expect(hasLeftBoard({})).toBe(false);
    expect(hasLeftBoard({ finishedAtTurn: 0 })).toBe(true);
    expect(hasLeftBoard({ finishedAtTurn: 40 })).toBe(true);
    expect(hasLeftBoard({ outReason: 'bankruptcy' })).toBe(true);
  });
});
