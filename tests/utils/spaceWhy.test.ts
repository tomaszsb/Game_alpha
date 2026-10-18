// Review Q6 (Tom, 2026-10-18): "why did that happen" help, cause + odds, max one paragraph,
// in the existing "What's this?" help. Odds are counted from DICE_OUTCOMES, never typed.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildSpaceWhy, describeOutcomeOdds } from '../../src/utils/spaceWhy';

const titles: Record<string, string> = {
  'REG-DOB-FINAL-REVIEW': 'Final Approval', 'CON-ISSUES': 'Trouble On Site', 'CON-INSPECT': 'Site Inspection',
  'REG-FDNY-FEE-REVIEW': 'Fire Dept. Intake', 'REG-DOB-FEE-REVIEW': 'City Filing Fee',
  'ENG-INITIATION': 'Find an Engineer', 'ARCH-INITIATION': 'Find an Architect', 'REG-DOB-PLAN-EXAM': 'City Checks Plans',
};
const title = (s: string) => titles[s] ?? s;

function csvRows(file: string): string[][] {
  // Minimal quoted-CSV reader for the test (cells with commas are quoted).
  return fs.readFileSync(`public/data/CLEAN_FILES/${file}`, 'utf-8').split(/\r?\n/).filter(Boolean).map((line) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out;
  });
}
const outcome = (space: string, visit: string) => {
  const r = csvRows('DICE_OUTCOMES.csv').find((x) => x[0] === space && x[1] === visit)!;
  return { space_name: r[0], visit_type: r[1], roll_1: r[2], roll_2: r[3], roll_3: r[4], roll_4: r[5], roll_5: r[6], roll_6: r[7] } as any;
};

describe('space "why" help', () => {
  it('Site Inspection (first visit): odds counted from the data', () => {
    expect(describeOutcomeOdds(outcome('CON-INSPECT', 'First'), title)).toBe(
      'How it usually goes here: 3 in 6 times you go to Final Approval; 1 in 6 times you go to Trouble On Site; 1 in 6 times you go to Fire Dept. Intake; 1 in 6 times you go to City Filing Fee.');
  });

  it('each of the three spaces has a cause row, and cause + odds stay one short paragraph with no game words', () => {
    const why = csvRows('ACTION_TOOLTIPS.csv').filter((r) => r[0] === 'why');
    expect(why.map((r) => r[1]).sort()).toEqual(['CON-INSPECT', 'CON-ISSUES', 'REG-DOB-AUDIT']);
    for (const r of why) {
      for (const visit of ['First', 'Subsequent']) {
        const text = buildSpaceWhy(r[3], outcome(r[1], visit), title)!;
        expect(text).toContain(r[3]);
        expect(text).toContain('in 6 times');
        expect(text).not.toMatch(/\b(dice|die|roll|card)\b/i);
        expect(text).not.toContain('\n');
        expect(text.length).toBeLessThan(700);
      }
    }
  });

  it('no cause row: nothing added; a choice-list outcome: cause only', () => {
    expect(buildSpaceWhy(undefined, outcome('CON-INSPECT', 'First'), title)).toBeNull();
    expect(buildSpaceWhy('Because.', { roll_1: 'A or B', roll_2: 'A', roll_3: 'A', roll_4: 'A', roll_5: 'A', roll_6: 'A' } as any, title)).toBe('Because.');
  });
});
