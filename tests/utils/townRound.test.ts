import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildTownLayout, buildingOfRoom } from '../../src/utils/townLayout';
import {
  newGameTownShape, poseRoundTown, nextPose, shortTurn, roundAngle, roundWedges, ownerOfAngle, roundWalkPath, seatAngle, posedAngle, roundLooks,
  type RoundTown,
} from '../../src/utils/townRound';
import { extractPrefix } from '../../src/constants/characters';
import type { TownCsvRow } from '../../src/types/DataTypes';
import type { TownLayout } from '../../src/utils/townLayout';

const CLEAN = path.join(__dirname, '../../public/data/CLEAN_FILES');

function readCsv(file: string): Record<string, string>[] {
  const [head, ...lines] = fs.readFileSync(path.join(CLEAN, file), 'utf-8').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map(l => {
    const v = l.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()]));
  });
}

const townRows = () => readCsv('TOWN.csv') as unknown as TownCsvRow[];
const stockSpaces = () => readCsv('GAME_CONFIG.csv').map(r => r.space_name).filter(s => s !== 'START-QUICK-PLAY-GUIDE');
type Round = TownLayout & { round: RoundTown };
const round = (seats: number) => buildTownLayout(townRows(), stockSpaces(), extractPrefix, s => s, seats, 'round') as Round;
const centre = (b: { col: number; row: number; width: number; depth: number }) => ({ col: b.col + b.width / 2, row: b.row + b.depth / 2 });
const near = (a: number, b: number) => Math.abs(shortTurn(a - b)) < 1e-6;

/** Two blocks overlap when their grid boxes cross (a building riding on another, the trailer on its site, is allowed). */
function overlaps(layout: Round): string[] {
  const out: string[] = [];
  const bs = layout.buildings;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j];
    if (layout.round.rides.get(a.id)?.on === b.id || layout.round.rides.get(b.id)?.on === a.id) continue;
    if (a.col < b.col + b.width && b.col < a.col + a.width && a.row < b.row + b.depth && b.row < a.row + a.depth) out.push(`${a.id} x ${b.id}`);
  }
  return out;
}

describe('round town switch (TOWN.csv round_town, off by default)', () => {
  it('the stock town data has the switch, and it is off', () => {
    const s = townRows().find(r => r.kind === 'setting' && r.id === 'round_town');
    expect(s?.value).toBe('off');
    expect(newGameTownShape(townRows(), '')).toBeUndefined();
  });

  it('one game asks for it from its link; the data can turn it on for every game; the link can also turn it off', () => {
    expect(newGameTownShape(townRows(), '?town=round')).toBe('round');
    const on = townRows().map(r => (r.id === 'round_town' ? { ...r, value: 'on' } : r));
    expect(newGameTownShape(on, '')).toBe('round');
    expect(newGameTownShape(on, '?town=stripes')).toBeUndefined();
  });

  it('without the round shape the striped town is drawn exactly as before', () => {
    const plain = buildTownLayout(townRows(), stockSpaces(), extractPrefix, s => s, 3)!;
    expect(plain.round).toBeUndefined();
    expect(plain.buildings.find(b => b.id === 'owner')).toMatchObject({ col: 0.4, row: 0.4 });
    expect(plain.buildings.find(b => b.id === 'owner@1')).toMatchObject({ col: 0.4, row: 0.4 + 16.4 });
  });
});

describe('round town layout', () => {
  it('the data names the ring: the 7 shared buildings, evenly round the middle, the first at the front', () => {
    const t = round(1);
    expect(t.round.ring).toEqual(['finish', 'engineer', 'architect', 'dob', 'firehouse', 'investor', 'bank']);
    const angles = t.round.ring.map(id => roundAngle(t.round, centre(t.buildings.find(b => b.id === id)!)));
    angles.forEach((a, i) => expect(near(a, 90 + (i * 360) / 7)).toBe(true));
    for (const id of t.round.ring) {
      const c = centre(t.buildings.find(b => b.id === id)!);
      expect(Math.hypot(c.col - t.round.cc, c.row - t.round.cr)).toBeCloseTo(t.round.ringRadius, 6);
    }
    expect(t.round.parkRadius).toBeLessThan(t.round.ringRadius);
    expect(t.round.fountain).toBeGreaterThan(0);
  });

  it.each([1, 2, 3, 4])('%i player(s): each has their own side, the shared buildings stay one each, and nothing overlaps', (n) => {
    const t = round(n);
    for (let s = 0; s < n; s++) {
      const id = (base: string) => (s === 0 ? base : `${base}@${s}`);
      for (const base of ['site', 'owner', 'office', 'site_new']) {
        const b = t.buildings.find(x => x.id === id(base))!;
        expect(b.seat).toBe(s);
        expect(Math.abs(shortTurn(roundAngle(t.round, centre(b)) - seatAngle(s, n)))).toBeLessThan(t.round.sides[s].half);
      }
      // the trailer stands on its own site
      const site = t.buildings.find(x => x.id === id('site'))!, trailer = t.buildings.find(x => x.id === id('trailer'))!;
      expect(trailer.col).toBeGreaterThanOrEqual(site.col);
      expect(trailer.col + trailer.width).toBeLessThanOrEqual(site.col + site.width + 0.01);
    }
    expect(t.buildings.filter(b => b.id.startsWith('dob'))).toHaveLength(1);
    // every pose the table can stop at, with the ring brought round to each shared building
    for (let cur = 0; cur < n; cur++) for (let r = -1; r < 7; r++) {
      expect(overlaps(poseRoundTown(t, nextPose(null, cur, r, t.round, n)))).toEqual([]);
    }
  });

  it('rooms still map to the same buildings (the town is only drawn another way)', () => {
    const t = round(2);
    expect(buildingOfRoom(t, 'REG-DOB-PLAN-EXAM', { seat: 1 })).toBe('dob');
    expect(buildingOfRoom(t, 'OWNER-SCOPE-INITIATION', { seat: 1 })).toBe('owner@1');
  });
});

describe('the turning table', () => {
  it("turns the current player's side to the front, the short way", () => {
    const t = round(4);
    const p0 = nextPose(null, 0, -1, t.round, 4);
    const p1 = nextPose(p0, 1, -1, t.round, 4);
    expect(p1.table - p0.table).toBe(-90);
    const owner1 = t.round.places.get('owner@1')!;
    // seat 1's side now sits at the front, give or take its own lot's place on the side
    expect(Math.abs(shortTurn(posedAngle({ ...owner1, angle: seatAngle(1, 4) }, p1) - 90))).toBeLessThan(1e-9);
    // back to seat 0 after seat 3: one more quarter, not three back
    const p3 = nextPose(nextPose(p1, 2, -1, t.round, 4), 3, -1, t.round, 4);
    expect(nextPose(p3, 0, -1, t.round, 4).table - p3.table).toBe(-90);
  });

  it('brings the shared building the current player stands in to the front, the short way; otherwise the ring rides with the table', () => {
    const t = round(2);
    const dob = t.round.ring.indexOf('dob');
    const at = nextPose(null, 0, dob, t.round, 2);
    expect(near(posedAngle(t.round.places.get('dob')!, at), 90)).toBe(true);
    const bank = t.round.ring.indexOf('bank');
    const moved = nextPose(at, 0, bank, t.round, 2);
    expect(Math.abs(moved.ring - at.ring)).toBeLessThanOrEqual(180);
    expect(near(posedAngle(t.round.places.get('bank')!, moved), 90)).toBe(true);
    const home = nextPose(moved, 1, -1, t.round, 2);
    expect(home.ring - moved.ring).toBe(home.table - moved.table);
  });

  it('shortTurn picks the short way round', () => {
    expect(shortTurn(270)).toBe(-90);
    expect(shortTurn(-270)).toBe(90);
    expect(shortTurn(180)).toBe(-180);
    expect(shortTurn(0)).toBe(0);
  });

  it('a player who has left gives their ground to the nearest players still playing', () => {
    const t = round(3);
    const all = roundWedges(t.round);
    expect(ownerOfAngle(all, seatAngle(1, 3))).toBe(1);
    const w = roundWedges(t.round, [false, true, false]);
    expect(w.map(x => x.seat).sort()).toEqual([0, 2]);
    expect(ownerOfAngle(w, seatAngle(1, 3) - 30)).toBe(0);
    expect(ownerOfAngle(w, seatAngle(1, 3) + 30)).toBe(2);
  });

  it('a walk goes out to the ring road and round it', () => {
    const t = round(2);
    const path = roundWalkPath(t, 'owner', 'dob');
    expect(path.length).toBeGreaterThan(3);
    for (const p of path.slice(1, -1)) expect(Math.hypot(p.col - t.round.cc, p.row - t.round.cr)).toBeCloseTo(t.round.roadRadius, 6);
    expect(roundWalkPath(t, 'dob', 'dob')).toEqual([]);
  });
});

describe('the round town looks (stage 1b): which drawing each building gets is data', () => {
  it('the stock data gives every building a look from the set of drawings, and the striped town has none', async () => {
    const { LOOKS } = await import('../../src/components/board/townLooks');
    const t = round(2);
    const bases = [...new Set(t.buildings.map(b => b.id.split('@')[0]))];
    for (const id of bases) {
      const look = t.round.looks.get(id);
      expect(look, id).toBeTruthy();
      expect(LOOKS[look!], `${id}: ${look}`).toBeTruthy();
    }
    expect(t.round.looks.get('bank')).toBe('bank');
    expect(t.round.looks.get('investor')).toBe('tower');
    const plain = buildTownLayout(townRows(), stockSpaces(), extractPrefix, s => s, 2)!;
    expect(plain.round).toBeUndefined();
  });

  it('the setting is read as id:look pairs; a building it does not name, or a look that does not exist, is a plain block', async () => {
    const { lookFor, LOOKS } = await import('../../src/components/board/townLooks');
    expect([...roundLooks('owner:house bank:bank broken :x y:').entries()]).toEqual([['owner', 'house'], ['bank', 'bank']]);
    expect(lookFor('no-such-look')).toBe(LOOKS.box);
    expect(lookFor(undefined)).toBe(LOOKS.box);
    const rows = townRows().map(r => (r.id === 'round_looks' ? { ...r, value: 'bank:tower' } : r));
    const t = buildTownLayout(rows, stockSpaces(), extractPrefix, s => s, 1, 'round') as Round;
    expect(t.round.looks.get('bank')).toBe('tower');
    expect(t.round.looks.get('owner')).toBeUndefined();
  });

  it('every look draws inside its own footprint height and puts its sign on a wall it has', async () => {
    const { LOOKS } = await import('../../src/components/board/townLooks');
    const foot = { c0: 0, r0: 0, c1: 4.2, r1: 4.2, h: 80, color: '#90caf9' };
    for (const [name, look] of Object.entries(LOOKS)) {
      expect(look.top(foot), name).toBeGreaterThan(0);
      const s = look.sign(foot);
      expect(s.c, name).toBeGreaterThanOrEqual(foot.c0);
      expect(s.c, name).toBeLessThanOrEqual(foot.c1);
      expect(s.z, name).toBeLessThanOrEqual(look.top(foot));
      if (s.side) expect([foot.c0, foot.c1], name).toContain(s.c); else expect(s.r, name).toBeGreaterThan(foot.r0);
    }
  });
});
