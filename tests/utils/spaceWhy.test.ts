// Review Q6 (Tom, 2026-10-18): "why did that happen" help, cause + odds, max one paragraph,
// in the existing "What's this?" help. Odds are counted from DICE_OUTCOMES, never typed.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildSpaceWhy, describeOutcomeOdds, buildViolationWhy } from '../../src/utils/spaceWhy';

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
  const r = csvRows('DICE_OUTCOMES.csv').find((x) => x[0] === space && x[1] === visit);
  if (!r) return undefined; // a choice visit (e.g. Site Inspection's first, since v3.8.18) has no outcome row
  return { space_name: r[0], visit_type: r[1], roll_1: r[2], roll_2: r[3], roll_3: r[4], roll_4: r[5], roll_5: r[6], roll_6: r[7] } as any;
};

describe('space "why" help', () => {
  it('Site Inspection (return visit): odds counted from the data', () => {
    expect(describeOutcomeOdds(outcome('CON-INSPECT', 'Subsequent'), title)).toBe(
      'How it usually goes here: 5 in 6 times you go to Final Approval; 1 in 6 times you go to Trouble On Site.');
  });

  it('each of the seven spaces has a cause row, and cause + odds stay one short paragraph with no game words', () => {
    // VIOLATION (fb:c1dc207d) is not a space: its help is built by buildViolationWhy, tested below.
    const why = csvRows('ACTION_TOOLTIPS.csv').filter((r) => r[0] === 'why' && r[1] !== 'VIOLATION');
    expect(why.map((r) => r[1]).sort()).toEqual(['CON-INSPECT', 'CON-ISSUES', 'REG-DOB-AUDIT', 'REG-DOB-FINAL-REVIEW', 'REG-DOB-PLAN-EXAM', 'REG-DOB-PROF-CERT', 'REG-FDNY-PLAN-EXAM']);
    for (const r of why) {
      for (const visit of ['First', 'Subsequent']) {
        const text = buildSpaceWhy(r[3], outcome(r[1], visit), title)!;
        expect(text).toContain(r[3]);
        // a choice-list outcome (Fire Dept. Review's early rolls) gets the cause only
        const o = outcome(r[1], visit);
        if (o && !Object.values(o).some((v) => String(v).includes(' or '))) expect(text).toContain('in 6 times');
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

// fb:c1dc207d ("Is it part of the L cards? Or is it because of plan exam?")
describe('violation "why" help', () => {
  const cause = csvRows('ACTION_TOOLTIPS.csv').find((r) => r[0] === 'why' && r[1] === 'VIOLATION')?.[3];
  it('says it is a life event, not the plan exam, and counts the violations from the cards', () => {
    expect(cause).toMatch(/life event, not a result of the plan exam/);
    const lifeEvents = [{ card_mechanic: 'notice_of_violation_flat' }, { card_mechanic: 'notice_of_violation_daily' }, ...Array(49).fill({ card_mechanic: '' })];
    const text = buildViolationWhy(cause, lifeEvents)!;
    expect(text).toContain('2 of the 51 life events that can happen are violations like this one.');
    expect(text).not.toMatch(/(dice|die|roll|card)/i);
    expect(text.length).toBeLessThan(700);
  });
  it('no cause row: nothing shown', () => {
    expect(buildViolationWhy(undefined, [])).toBeNull();
  });
});
