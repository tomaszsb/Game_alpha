// "Opened walls" (Tom 2026-10-20): on the cheap inspector branches one outcome in six sends the
// player back to the engineer for a redesign. The top agency never does (that is what paying buys).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const clean = (f: string) => fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES', f), 'utf8').split(/\r?\n/);
const row = (file: string, space: string, visit: string) => clean(file).find(l => l.startsWith(`${space},${visit},`) && !l.includes(',time,') && !l.includes(',money,'));

describe('opened walls send the player back to the engineer', () => {
  for (const space of ['SI-AGENCY-BUDGET', 'SI-SKIP']) {
    for (const visit of ['First', 'Subsequent']) {
      it(`${space} ${visit}: one outcome in six goes to ENG-INITIATION, the rest to Trouble On Site`, () => {
        const cells = row('DICE_OUTCOMES.csv', space, visit)!.split(',').slice(2);
        expect(cells).toHaveLength(6);
        expect(cells.filter(c => c === 'ENG-INITIATION')).toHaveLength(1);
        expect(cells.filter(c => c === 'CON-ISSUES')).toHaveLength(5);
      });
    }
  }
  it('the top agency has no dice and never sends you back', () => {
    const lines = clean('MOVEMENT.csv').filter(l => l.startsWith('SI-AGENCY-TOP,'));
    expect(lines.every(l => l.includes('fixed') && l.includes('CON-ISSUES') && !l.includes('ENG-INITIATION'))).toBe(true);
  });
  it('the dice table the game reads agrees with the routing table', () => {
    for (const space of ['SI-AGENCY-BUDGET', 'SI-SKIP']) {
      const next = clean('DICE_EFFECTS.csv').filter(l => l.startsWith(`${space},`) && l.includes(',Next Step,'));
      expect(next).toHaveLength(2);
      for (const l of next) expect(l.split(',').slice(4, 10).filter(c => c === 'ENG-INITIATION')).toHaveLength(1);
    }
  });
});
