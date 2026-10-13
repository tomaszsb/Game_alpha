import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildTownLayout, buildingBox, buildingViews, isoPoint, walkPath, pointAlong, walkTimes, DEFAULT_WALK_TIMES, revealedBuildings, fadedBuildings, buildingOfRoom } from '../../src/utils/townLayout';
import { extractPrefix } from '../../src/constants/characters';
import type { TownCsvRow } from '../../src/types/DataTypes';

const CLEAN = path.join(__dirname, '../../public/data/CLEAN_FILES');

/** Plain CSV reader for these two simple files (no quoted commas in either). */
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
const label = (s: string) => s;

const row = (o: Partial<TownCsvRow>): TownCsvRow => ({
  kind: '', id: '', name: '', building: '', col: '', row: '', width: '', depth: '', height: '', color: '', icon: '', value: '', ...o,
});

describe('town layout (TOWN.csv)', () => {
  it('the stock town puts every square of the stock board in exactly one building', () => {
    const spaces = stockSpaces();
    const layout = buildTownLayout(townRows(), spaces, extractPrefix, label)!;
    expect(layout).not.toBeNull();
    const placed = layout.buildings.flatMap(b => b.rooms);
    expect(placed.sort()).toEqual([...spaces].sort());
    expect(new Set(placed).size).toBe(placed.length);
    expect(layout.buildings.some(b => b.isNewPlace)).toBe(false);
  });

  it("follows Tom's layout: the find-a-consultant rooms and the lender are in Your office, filing is at the Buildings Department", () => {
    const layout = buildTownLayout(townRows(), stockSpaces(), extractPrefix, label)!;
    const at = (s: string) => layout.roomToBuilding.get(s);
    for (const s of ['PM-DECISION-CHECK', 'ARCH-INITIATION', 'ENG-INITIATION', 'LEND-SCOPE-CHECK', 'CHEAT-BYPASS']) expect(at(s)).toBe('office');
    expect(at('REG-DOB-TYPE-SELECT')).toBe('dob');
    expect(at('BANK-FUND-REVIEW')).toBe('bank');
    expect(at('INVESTOR-FUND-REVIEW')).toBe('investor');
    expect(at('CON-INITIATION')).toBe('trailer');
    expect(at('CON-ISSUES')).toBe('trailer');
    expect(at('CON-INSPECT')).toBe('site');
    expect(layout.buildings.find(b => b.id === 'lender')).toBeUndefined();
  });

  it('no town list (or no buildings in it) means no town: the classic board only', () => {
    expect(buildTownLayout([], stockSpaces(), extractPrefix, label)).toBeNull();
    expect(buildTownLayout([row({ kind: 'room', id: 'X', building: 'b' })], ['X'], extractPrefix, label)).toBeNull();
  });

  it("a teacher's added square joins its speaking character's building", () => {
    const rows = [
      row({ kind: 'building', id: 'arch', name: 'Studio', col: '0', row: '0' }),
      row({ kind: 'room', id: 'ARCH-FEE-REVIEW', building: 'arch' }),
    ];
    const layout = buildTownLayout(rows, ['ARCH-FEE-REVIEW', 'ARCH-NEW-SKETCH'], extractPrefix, label)!;
    expect(layout.roomToBuilding.get('ARCH-NEW-SKETCH')).toBe('arch');
    expect(layout.buildings).toHaveLength(1);
  });

  it('a square with no building and no character gets a lot of its own, named after it, under the town', () => {
    const rows = [
      row({ kind: 'building', id: 'a', name: 'A', col: '0', row: '0', width: '4', depth: '4' }),
      row({ kind: 'room', id: 'OWNER-SCOPE-INITIATION', building: 'a' }),
    ];
    const layout = buildTownLayout(rows, ['OWNER-SCOPE-INITIATION', 'PARTY-TIME', 'ZONING-HEARING'], extractPrefix, s => `Label ${s}`)!;
    const extra = layout.buildings.filter(b => b.isNewPlace);
    expect(extra.map(b => b.name)).toEqual(['Label PARTY-TIME', 'Label ZONING-HEARING']);
    expect(extra.every(b => b.row > 4)).toBe(true);
    expect(extra[0].col).not.toBe(extra[1].col);
  });

  it('ignores rooms for squares this board does not have, and a square listed twice stays in the first building', () => {
    const rows = [
      row({ kind: 'building', id: 'a', col: '0', row: '0' }),
      row({ kind: 'building', id: 'b', col: '6', row: '0' }),
      row({ kind: 'room', id: 'GONE', building: 'a' }),
      row({ kind: 'room', id: 'X-1', building: 'a' }),
      row({ kind: 'room', id: 'X-1', building: 'b' }),
    ];
    const layout = buildTownLayout(rows, ['X-1'], extractPrefix, label)!;
    expect(layout.roomToBuilding.has('GONE')).toBe(false);
    expect(layout.roomToBuilding.get('X-1')).toBe('a');
  });

  it('reads streets and settings', () => {
    const layout = buildTownLayout([
      row({ kind: 'building', id: 'a', col: '0', row: '0' }),
      row({ kind: 'street', id: 's1', col: '5' }),
      row({ kind: 'street', id: 's2', row: '11' }),
      row({ kind: 'setting', id: 'walk_ms', value: '1500' }),
    ], [], extractPrefix, label)!;
    expect(layout.streets).toEqual([{ axis: 'col', at: 5 }, { axis: 'row', at: 11 }]);
    expect(layout.settings.walk_ms).toBe('1500');
  });
});

describe('town drawing maths', () => {
  it('projects the grid at 2:1 and lifts by height', () => {
    expect(isoPoint(0, 0, 0, 50)).toEqual({ x: 0, y: 0 });
    expect(isoPoint(1, 0, 0, 50)).toEqual({ x: 50, y: 25 });
    expect(isoPoint(0, 1, 10, 50)).toEqual({ x: -50, y: 15 });
  });

  it("a block's box holds its whole footprint plus its height, and the sign hangs from the roof centre", () => {
    const box = buildingBox({ col: 0, row: 0, width: 4, depth: 2, height: 60 }, 50);
    expect(box.w).toBe((4 + 2) * 50);
    expect(box.h).toBe(((4 + 2) * 50) / 2 + 60);
    expect(box.roofY).toBe(((2 + 1) * 50) / 2 - 60);
    expect(box.roofX).toBe((2 - 1) * 50);
  });
});

describe('what each building shows', () => {
  const layout = buildTownLayout(townRows(), stockSpaces(), extractPrefix, label)!;
  const players = [
    { id: 'p1', name: 'Ann', currentSpace: 'ENG-SCOPE-CHECK' },
    { id: 'p2', name: 'Sam', currentSpace: 'ENG-FEE-REVIEW' },
    { id: 'p3', name: 'Ana', currentSpace: 'BANK-FUND-REVIEW' },
  ];

  it("the current player's building is marked with their room; everyone shows where they stand", () => {
    const v = buildingViews(layout, players, 'p1', []);
    expect(v.get('engineer')).toMatchObject({ isCurrent: true, currentRoom: 'ENG-SCOPE-CHECK' });
    expect(v.get('engineer')!.playersHere.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(v.get('bank')).toMatchObject({ isCurrent: false, currentRoom: null });
    expect(v.get('bank')!.playersHere.map(p => p.id)).toEqual(['p3']);
  });

  it("next moves light their buildings and name the rooms (Check the Structure: back to the office or on to the city)", () => {
    const v = buildingViews(layout, players, 'p1', ['PM-DECISION-CHECK', 'REG-DOB-FEE-REVIEW']);
    expect(v.get('office')!.destinationRooms).toEqual(['PM-DECISION-CHECK']);
    expect(v.get('dob')!.destinationRooms).toEqual(['REG-DOB-FEE-REVIEW']);
    expect(v.get('engineer')!.destinationRooms).toEqual([]);
  });

  it('a room-to-room move inside one building lights that room in the open building', () => {
    const v = buildingViews(layout, [{ id: 'p1', name: 'Ann', currentSpace: 'PM-DECISION-CHECK' }], 'p1', ['LEND-SCOPE-CHECK', 'ARCH-INITIATION', 'CHEAT-BYPASS']);
    expect(v.get('office')).toMatchObject({ isCurrent: true, currentRoom: 'PM-DECISION-CHECK' });
    expect(v.get('office')!.destinationRooms).toEqual(['LEND-SCOPE-CHECK', 'ARCH-INITIATION', 'CHEAT-BYPASS']);
  });
});

describe('the walk (step A2)', () => {
  const layout = buildTownLayout(townRows(), stockSpaces(), extractPrefix, label)!;
  const onStreet = (p: { col: number; row: number }) =>
    layout.streets.some(s => (s.axis === 'col' ? p.col === s.at + 0.5 : p.row === s.at + 0.5));

  it('walk times come from the town list, with safe defaults', () => {
    expect(walkTimes(layout.settings)).toEqual({ walkMs: 1500, fastMs: 400, hopMs: 350 });
    expect(walkTimes({})).toEqual(DEFAULT_WALK_TIMES);
    expect(walkTimes({ walk_ms: 'soon', walk_fast_ms: '-5', hop_ms: '0' })).toEqual({ ...DEFAULT_WALK_TIMES, hopMs: 0 });
  });

  it('a room-to-room move inside one building is a hop, not a walk', () => {
    expect(walkPath(layout, 'office', 'office')).toEqual([]);
  });

  it('a walk leaves from the building, follows only streets, and ends in the other building', () => {
    for (const [a, b] of [['owner', 'office'], ['engineer', 'dob'], ['office', 'bank'], ['trailer', 'office'], ['architect', 'finish'], ['bank', 'investor']]) {
      const pts = walkPath(layout, a, b);
      const A = layout.buildings.find(x => x.id === a)!, B = layout.buildings.find(x => x.id === b)!;
      expect(pts[0]).toEqual({ col: A.col + A.width / 2, row: A.row + A.depth / 2 });
      expect(pts[pts.length - 1]).toEqual({ col: B.col + B.width / 2, row: B.row + B.depth / 2 });
      // every point between the two doors is on a street, and every leg is straight along the grid
      pts.slice(1, -1).forEach(p => expect(onStreet(p)).toBe(true));
      pts.slice(1).forEach((p, i) => expect(p.col === pts[i].col || p.row === pts[i].row).toBe(true));
    }
  });

  it('with no streets the piece walks straight across', () => {
    const bare = { ...layout, streets: [] };
    expect(walkPath(bare, 'owner', 'office')).toHaveLength(2);
  });

  it('points along the route are spaced by length, so the walk keeps a steady pace', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }];
    expect(pointAlong(line, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(line, 0.25)).toEqual({ x: 100, y: 0 });
    expect(pointAlong(line, 0.5)).toEqual({ x: 100, y: 100 });
    expect(pointAlong(line, 1)).toEqual({ x: 100, y: 300 });
    expect(pointAlong([{ x: 5, y: 5 }], 0.7)).toEqual({ x: 5, y: 5 });
  });
});

describe('result bubbles (money, scope, days)', () => {
  it('a change makes one bubble per number that moved, scope first, with the sign and the right tone', async () => {
    const { resultBubbles } = await import('../../src/utils/townLayout');
    expect(resultBubbles({ money: 0, days: 10, scope: 0 }, { money: 500000, days: 15, scope: 680000 })).toEqual([
      { kind: 'scope', text: '+$680K scope', tone: 'info' },
      { kind: 'money', text: '+$500K', tone: 'good' },
      { kind: 'days', text: '+5 days', tone: 'bad' },
    ]);
  });

  it('a fee is red, days given back are green, one day is singular, and nothing moving makes nothing', async () => {
    const { resultBubbles } = await import('../../src/utils/townLayout');
    expect(resultBubbles({ money: 100000, days: 20, scope: 1 }, { money: 46000, days: 19, scope: 1 })).toEqual([
      { kind: 'money', text: '−$54K', tone: 'bad' },
      { kind: 'days', text: '−1 day', tone: 'good' },
    ]);
    expect(resultBubbles({ money: 5, days: 5, scope: 5 }, { money: 5, days: 5, scope: 5 })).toEqual([]);
  });
});

// fb:5b8a060c (Tom, live v3.7.23): accepting the owner's money made two bubbles rise from two buildings.
// One tap leaves a space (+1 day at the owner's) and enters the next (+5 days at the office); the
// board now adds the changes of one tap together and shows one bubble per kind.
describe('one tap, one bubble per kind (fb:5b8a060c)', () => {
  const n = (money: number, days: number, scope = 0) => ({ money, days, scope });

  it('days from the space left and the space entered become a single "+6 days"', async () => {
    const { mergedResultBubbles } = await import('../../src/utils/townLayout');
    expect(mergedResultBubbles([
      { before: n(1000000, 0), after: n(1000000, 1) },
      { before: n(1000000, 1), after: n(1000000, 6) },
    ])).toEqual([{ kind: 'days', text: '+6 days', tone: 'bad' }]);
  });

  it('money and days stay separate kinds, and a change that cancels out makes no bubble', async () => {
    const { mergedResultBubbles } = await import('../../src/utils/townLayout');
    expect(mergedResultBubbles([
      { before: n(0, 0), after: n(500000, 0) },
      { before: n(500000, 0), after: n(500000, 2) },
    ]).map(b => b.kind)).toEqual(['money', 'days']);
    expect(mergedResultBubbles([
      { before: n(100, 0), after: n(0, 0) },
      { before: n(0, 0), after: n(100, 0) },
    ])).toEqual([]);
  });
});

// fb:aec545c4 (Tom, 10-13): the buildings all stand from the start; their NAMES are earned. The trailer stands on its construction site,
// and there are two sites (new building / existing building); a player's own project kind picks theirs.
describe('names are earned, buildings always stand (fb:aec545c4)', () => {
  const layout = buildTownLayout(townRows(), stockSpaces(), extractPrefix, label)!;
  const named = (visited: Array<[string, string?]> = [], offered: string[] = [], scopeKinds: string[] = [], kind?: string) =>
    revealedBuildings(layout, {
      visited: visited.map(([space, k]) => ({ space, kind: k })),
      offered: { spaces: offered, kind },
      scopeKinds,
    });

  it("at the start only the player's office and the owner are named", () => {
    expect([...named([['OWNER-SCOPE-INITIATION']])].sort()).toEqual(['office', 'owner']);
    expect(layout.buildings.length).toBeGreaterThan(2); // the rest still stand, just unnamed
  });

  it("once the scope is of a kind, THAT kind's trailer and site are named and the other pair is not (and fades)", () => {
    expect(named().has('site') || named().has('site_new')).toBe(false);
    const reno = named([], [], ['existing']);
    expect(['site', 'trailer'].every(b => reno.has(b))).toBe(true);
    expect(['site_new', 'trailer_new'].some(b => reno.has(b))).toBe(false);
    const fresh = named([], [], ['new']);
    expect(['site_new', 'trailer_new'].every(b => fresh.has(b))).toBe(true);
    expect(['site', 'trailer'].some(b => fresh.has(b))).toBe(false);
    expect(reno.has('finish')).toBe(false); // the ribbon cutting waits until somebody gets there
    expect([...fadedBuildings(layout, ['existing'])].sort()).toEqual(['site_new', 'trailer_new']);
    expect([...fadedBuildings(layout, ['new'])].sort()).toEqual(['site', 'trailer']);
    expect([...fadedBuildings(layout, ['new', 'existing'])]).toEqual([]);
    expect([...fadedBuildings(layout, [])]).toEqual([]); // no scope yet: both sites stand plain
  });

  it("the build rooms are in the player's own site: the trailer and the inspection", () => {
    expect(buildingOfRoom(layout, 'CON-INITIATION', 'existing')).toBe('trailer');
    expect(buildingOfRoom(layout, 'CON-INITIATION', 'new')).toBe('trailer_new');
    expect(buildingOfRoom(layout, 'CON-ISSUES', 'new')).toBe('trailer_new');
    expect(buildingOfRoom(layout, 'CON-INSPECT', 'new')).toBe('site_new');
    expect(buildingOfRoom(layout, 'CON-INSPECT', undefined)).toBe('site');
    expect(buildingOfRoom(layout, 'BANK-FUND-REVIEW', 'new')).toBe('bank');
    expect(layout.buildings.find(b => b.id === 'site_new')!.altRooms).toContain('CON-INSPECT');
  });

  it('a building is named once a player has been in it or is offered a move into it', () => {
    expect(named([['BANK-FUND-REVIEW']]).has('bank')).toBe(true);
    expect(named([], ['ARCH-FEE-REVIEW']).has('architect')).toBe(true);
    expect(named([['FINISH']]).has('finish')).toBe(true);
    expect(named([['BANK-FUND-REVIEW']]).has('investor')).toBe(false);
    expect(named([['CON-INITIATION', 'new']]).has('trailer_new')).toBe(true);
    expect(named([['CON-INITIATION', 'new']]).has('trailer')).toBe(false);
  });

  it('a town list with no reveal column names a building only once it is reached', () => {
    const bare = buildTownLayout([
      row({ kind: 'building', id: 'a', name: 'A', col: '0', row: '0', width: '2', depth: '2', height: '10' }),
      row({ kind: 'building', id: 'b', name: 'B', col: '4', row: '0', width: '2', depth: '2', height: '10' }),
      row({ kind: 'room', id: 'S1', building: 'a' }),
      row({ kind: 'room', id: 'S2', building: 'b' }),
    ], ['S1', 'S2'], extractPrefix, label)!;
    expect([...revealedBuildings(bare, { visited: [{ space: 'S1' }], offered: { spaces: [] }, scopeKinds: ['new'] })]).toEqual(['a']);
  });

  it('each trailer stands on its own site, not beside it', () => {
    for (const [s, tr] of [['site', 'trailer'], ['site_new', 'trailer_new']]) {
      const site = layout.buildings.find(b => b.id === s)!, trailer = layout.buildings.find(b => b.id === tr)!;
      expect(trailer.col).toBeGreaterThanOrEqual(site.col);
      expect(trailer.col + trailer.width).toBeLessThanOrEqual(site.col + site.width);
      expect(trailer.row).toBeGreaterThanOrEqual(site.row);
      expect(trailer.row + trailer.depth).toBeLessThanOrEqual(site.row + site.depth);
    }
  });
});
