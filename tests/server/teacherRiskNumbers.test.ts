// Tom, 2026-10-18: "Close the gap". A teacher may change the days and money behind
// a risky outcome (DiceRoll Info `Time outcomes` / `Fees Paid`), never the route
// (`Next Step`), the odds layout, or rows whose cells are not plain prices.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { restrictChangesToWording, findBadRiskNumbers, isPriceRow } from '../../server/instanceContentDiff.js';
import { parseCsvWithHeaders } from '../../server/processGameData.js';

const stockSpacesCsv = fs.readFileSync('public/data/SOURCE_FILES/Spaces.csv', 'utf-8');
const stockDiceCsv = fs.readFileSync('public/data/SOURCE_FILES/DiceRoll Info.csv', 'utf-8');
const stockDice = parseCsvWithHeaders(stockDiceCsv);
const spaceRows = (slot: string) => parseCsvWithHeaders(stockSpacesCsv).filter((r: any) => r.space_name === slot);
const diceRows = (slot: string) => stockDice.filter((r: any) => r.space_name === slot).map((r: any) => ({ ...r }));

function submit(slot: string, edit: (rows: any[]) => void) {
  const rows = diceRows(slot); edit(rows);
  return [{ slot, rows: spaceRows(slot), diceRows: rows }];
}
const row = (rows: any[], visit: string, kind: string) => rows.find((r) => r.visit_type === visit && r.die_roll === kind);

describe('teacher risk numbers', () => {
  it('a stop-work order can cost 10 days and $5,000 instead of 30 days and $25,000', () => {
    const changed = submit('CON-STEER', (rows) => {
      Object.assign(row(rows, 'First', 'Time outcomes'), { 5: '10 days', 6: '10' });
      Object.assign(row(rows, 'First', 'Fees Paid'), { 5: '-5000', 6: '-5,000' });
    });
    expect(findBadRiskNumbers({ changed, stockDiceCsv } as any)).toEqual([]);
    const [out] = restrictChangesToWording({ changed, stockSpacesCsv, stockDiceCsv } as any);
    expect(row(out.diceRows, 'First', 'Time outcomes')).toMatchObject({ 1: '0 days', 5: '10 days', 6: '10 days' });
    expect(row(out.diceRows, 'First', 'Fees Paid')).toMatchObject({ 5: '-5000', 6: '-5000' });
    // The route is untouched.
    expect(row(out.diceRows, 'First', 'Next Step')).toEqual(row(diceRows('CON-STEER'), 'First', 'Next Step'));
  });

  it('out-of-range or junk numbers are refused with a plain message', () => {
    const changed = submit('CON-STEER', (rows) => {
      Object.assign(row(rows, 'First', 'Time outcomes'), { 6: '900 days' });
      Object.assign(row(rows, 'First', 'Fees Paid'), { 6: 'a lot' });
    });
    const problems = findBadRiskNumbers({ changed, stockDiceCsv } as any);
    expect(problems.map((p: any) => p.message)).toEqual([
      'CON-STEER: days must be a whole number from 0 to 365 (got "900 days").',
      'CON-STEER: a cost must be a whole number of dollars from 0 to 1,000,000 (got "a lot").',
    ]);
  });

  it('a change to the route (Next Step) is ignored, never saved', () => {
    const changed = submit('CON-STEER', (rows) => { row(rows, 'First', 'Next Step')[1] = 'FINISH'; });
    expect(restrictChangesToWording({ changed, stockSpacesCsv, stockDiceCsv } as any)).toEqual([]);
  });

  it('rows whose cells are places, not prices, stay locked', () => {
    const audit = stockDice.find((r: any) => r.space_name === 'REG-DOB-AUDIT' && r.die_roll === 'Time outcomes');
    expect(isPriceRow(audit)).toBe(false);
    expect(isPriceRow(stockDice.find((r: any) => r.space_name === 'TR8-TEST-LATER' && r.die_roll === 'Fees Paid'))).toBe(true);
  });

  it('a wording-only save still carries the dice unchanged', () => {
    const changed = [{ slot: 'CON-STEER', rows: spaceRows('CON-STEER').map((r: any) => ({ ...r, Title: 'Walk them around' })), diceRows: diceRows('CON-STEER') }];
    const [out] = restrictChangesToWording({ changed, stockSpacesCsv, stockDiceCsv } as any);
    expect(out.diceRows).toEqual(diceRows('CON-STEER'));
  });
});
