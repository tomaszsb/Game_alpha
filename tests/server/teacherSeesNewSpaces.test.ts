// Tom, 2026-10-18: "don't forget the teacher end that edits the spaces". Every space
// added today (Site Inspection and Trouble On Site forks, the Special Inspector fork)
// must show up in the teacher backroom's catalog, with its wording, days and fee
// editable by the same rules as every other space.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildCatalog, EDITABLE_FIELDS } from '../../server/instanceCatalog.js';
import { findBadWordingNumbers } from '../../server/instanceContentDiff.js';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

const stockSpacesCsv = fs.readFileSync('public/data/SOURCE_FILES/Spaces.csv', 'utf-8');
const diceCsv = fs.readFileSync('public/data/SOURCE_FILES/DiceRoll Info.csv', 'utf-8');
const NEW = ['CON-FIX', 'CON-STEER', 'TR8-TEST-NOW', 'TR8-TEST-LATER', 'SI-HIRE', 'SI-AGENCY-TOP', 'SI-AGENCY-BUDGET', 'SI-SKIP'];

describe('teacher backroom and the 10-18 spaces', () => {
  it('lists every new space with both visits and the editable fields', () => {
    const catalog = buildCatalog({ stockSpacesCsv, diceCsv, config: {} as any });
    for (const name of NEW) {
      const entry = catalog.spaces.find((s: any) => s.name === name);
      expect(entry, name).toBeTruthy();
      expect(Object.keys(entry.stock).sort(), name).toEqual(['First', 'Subsequent']);
      for (const f of EDITABLE_FIELDS) expect(f in entry.stock.First, `${name}.${f}`).toBe(true);
    }
    // The fixed costs a teacher may change live in the Fee column (not the dice table).
    expect(catalog.spaces.find((s: any) => s.name === 'CON-FIX').stock.First.Fee).toBe('$10000');
    expect(catalog.spaces.find((s: any) => s.name === 'TR8-TEST-NOW').stock.First.Fee).toBe('$5000');
  });

  it('a teacher may set a new fee or days in plain numbers, not a rule-changing "%"', () => {
    const changed = [{ slot: 'CON-FIX', rows: [{ visit_type: 'First', Fee: '8000', Time: '3' }] }];
    expect(findBadWordingNumbers({ changed, stockSpacesCsv })).toEqual([]);
    const bad = [{ slot: 'CON-FIX', rows: [{ visit_type: 'First', Fee: '10% of scope' }] }];
    expect(findBadWordingNumbers({ changed: bad, stockSpacesCsv }).length).toBe(1);
  });

  it('the fix fee from the Fee column is really charged', async () => {
    const s: any = await bootstrapHeadlessServices();
    s.stateService.addPlayer('T');
    const id = s.stateService.getAllPlayers()[0].id;
    s.stateService.setCurrentPlayer(id);
    s.stateService.startGame();
    s.stateService.updatePlayer({ id, currentSpace: 'CON-FIX', visitType: 'First', visitedSpaces: ['CON-FIX'], money: 100_000 } as any);
    await s.turnService.startTurn(id);
    expect(s.stateService.getPlayer(id).money).toBe(90_000);
  });
});
