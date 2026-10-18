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
      const entry: any = catalog.spaces.find((s: any) => s.name === name);
      expect(entry, name).toBeTruthy();
      expect(Object.keys(entry.stock).sort(), name).toEqual(['First', 'Subsequent']);
      for (const f of EDITABLE_FIELDS) expect(f in entry.stock.First, `${name}.${f}`).toBe(true);
    }
    // The fixed costs a teacher may change live in the Fee column (not the dice table).
    expect(catalog.spaces.find((s: any) => s.name === 'CON-FIX')!.stock.First.Fee).toBe('$10000');
    expect(catalog.spaces.find((s: any) => s.name === 'TR8-TEST-NOW')!.stock.First.Fee).toBe('$5000');
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

// Tom, 2026-10-18: "Close the gap". A percent-of-project fee (the inspection
// agencies) can get a new percent; never a different kind of fee.
describe('teacher edits a percent-of-project fee', () => {
  const edit = (slot: string, Fee: string) => findBadWordingNumbers({ changed: [{ slot, rows: [{ visit_type: 'First', Fee }] }], stockSpacesCsv } as any);
  it('a new percent from 0 to 20 is fine', () => {
    expect(edit('SI-AGENCY-TOP', '3% of scope')).toEqual([]);
    expect(edit('SI-AGENCY-BUDGET', '1.5% of scope')).toEqual([]);
    expect(edit('SI-AGENCY-TOP', '0% of scope')).toEqual([]);
  });
  it('too high, a different kind of fee, or junk is refused with a plain message', () => {
    expect(edit('SI-AGENCY-TOP', '30% of scope')[0].message).toMatch(/percent of the project's cost from 0 to 20/);
    expect(edit('SI-AGENCY-TOP', '2%').length).toBe(1);      // a loan percent: a different rule
    expect(edit('SI-AGENCY-TOP', '5000').length).toBe(1);    // dollars: a different rule
    expect(edit('SI-AGENCY-TOP', 'lots').length).toBe(1);
  });
  it('a dollar-fee space still cannot be turned into a percent', () => {
    expect(edit('CON-FIX', '3% of scope').length).toBe(1);
  });
});
