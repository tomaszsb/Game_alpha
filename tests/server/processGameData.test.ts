/**
 * processGameData.test.ts
 *
 * Tests for the data pipeline that generates CLEAN_FILES from SOURCE_FILES.
 * Focuses on card effect action parsing to prevent regressions where
 * return/replace/give actions were incorrectly mapped to draw actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processGameData } from '../../server/processGameData.js';

// Minimal Spaces.csv with different card action types
const spacesHeader = 'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls';
const spacesLabelRow = ',end_turn_label,try_again_label,w_card_label,b_card_label,i_card_label,l_card_label,e_card_label';

function makeSpaceRow(name: string, fields: Partial<Record<string, string>>): string {
  const defaults: Record<string, string> = {
    phase: 'DESIGN', visit_type: 'First', Title: 'Test', Event: 'test', Action: 'test', Outcome: '',
    w_card: '', b_card: '', i_card: '', l_card: '', e_card: '',
    Time: '', Fee: '', space_1: 'NEXT-SPACE', space_2: '', space_3: '', space_4: '', space_5: '',
    Negotiate: 'NO', requires_dice_roll: 'No', path: 'Main', rolls: ''
  };
  const row = { ...defaults, ...fields };
  return `${name},${row.phase},${row.visit_type},${row.Title},${row.Event},${row.Action},${row.Outcome},${row.w_card},${row.b_card},${row.i_card},${row.l_card},${row.e_card},${row.Time},${row.Fee},${row.space_1},${row.space_2},${row.space_3},${row.space_4},${row.space_5},${row.Negotiate},${row.requires_dice_roll},${row.path},${row.rolls}`;
}

// Minimal DiceRoll Info CSV (empty)
const diceRollCsv = 'space_name,visit_type,die_roll,1,2,3,4,5,6,button_label\n';

// Temp directory for output
let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join('/tmp', `processGameData-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
});

function readEffects(): string[] {
  return fs.readFileSync(path.join(tmpDir, 'SPACE_EFFECTS.csv'), 'utf-8').trim().split('\n');
}

function findEffect(lines: string[], spaceName: string, actionSubstring: string): string | undefined {
  return lines.find(l => l.includes(spaceName) && l.includes(actionSubstring));
}

describe('processGameData — card action parsing', () => {
  it('should generate return_e for "Return 1" in e_card column', () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-RETURN', { e_card: 'Return 1' })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readEffects();
    const effect = findEffect(lines, 'TEST-RETURN', 'return_e');

    expect(effect).toBeDefined();
    expect(effect).toContain('return_e');
    expect(effect).not.toContain('draw_E');
  });

  it('should generate replace_e for "Replace 1" in e_card column', () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-REPLACE', { e_card: 'Replace 1' })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readEffects();
    const effect = findEffect(lines, 'TEST-REPLACE', 'replace_e');

    expect(effect).toBeDefined();
    expect(effect).toContain('replace_e');
    expect(effect).not.toContain('draw_E');
  });

  it('should generate give_e for "Give 1" in e_card column', () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-GIVEE', { e_card: 'Give 1' })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readEffects();
    const effect = findEffect(lines, 'TEST-GIVEE', 'give_e');

    expect(effect).toBeDefined();
    expect(effect).toContain('give_e');
    expect(effect).not.toContain('draw_E');
  });

  it('should generate draw_E for "Draw 1" or plain text in e_card column', () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-DRAWE', { e_card: 'Draw 1' })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readEffects();
    const effect = findEffect(lines, 'TEST-DRAWE', 'draw_E');

    expect(effect).toBeDefined();
    expect(effect).toContain('draw_E');
  });

  it('should extract numeric count from action text', () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-COUNT', { e_card: 'Return 2' })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readEffects();
    const effect = findEffect(lines, 'TEST-COUNT', 'return_e');

    expect(effect).toBeDefined();
    // The effect_value (4th field after space_name, visit_type, effect_type, effect_action)
    // should be "2", not "Return 2"
    const fields = effect!.split(',');
    expect(fields[4]).toBe('2'); // effect_value column
  });

  it('should still handle L card draw with dice condition', () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-LDICE', { l_card: 'Draw 1 if you roll a 3' })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readEffects();
    const effect = findEffect(lines, 'TEST-LDICE', 'draw_L');

    expect(effect).toBeDefined();
    expect(effect).toContain('draw_L');
    expect(effect).toContain('dice_roll_3');
  });

  it('should verify actual SOURCE_FILES produce correct return/replace actions', () => {
    // Read real SOURCE_FILES to ensure no regressions in production data
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readEffects();

    // ARCH-FEE-REVIEW has "Return 1" in e_card → must be return_e, not draw_E
    const archFeeReturn = findEffect(lines, 'ARCH-FEE-REVIEW', 'return_e');
    expect(archFeeReturn).toBeDefined();

    // ARCH-SCOPE-CHECK has "Replace 1" in e_card → must be replace_e, not draw_E
    const archScopeReplace = findEffect(lines, 'ARCH-SCOPE-CHECK', 'replace_e');
    expect(archScopeReplace).toBeDefined();

    // No return/replace/give should appear as draw_E
    const badEffects = lines.filter(l =>
      l.includes('draw_E') && (l.includes('Return') || l.includes('Replace') || l.includes('Give'))
    );
    expect(badEffects).toHaveLength(0);
  });
});

// Regression catcher for v2.49.0 logic-tree restoration.
// The v2.45-era pipeline silently emitted movement_type='choice' for LOGIC
// spaces, which downgraded REG-FDNY-FEE-REVIEW's 5-question yes/no chain to
// a flat destination picker. These tests lock in the 'logic' emission so the
// same regression can't sneak back through a sync.
describe('processGameData — logic movement', () => {
  function readMovement(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'MOVEMENT.csv'), 'utf-8').trim().split('\n');
  }

  function findMovement(lines: string[], spaceName: string, visitType: string): string | undefined {
    return lines.find(l => l.startsWith(`${spaceName},${visitType},`));
  }

  it("should emit movement_type='logic' when path=LOGIC", () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('TEST-LOGIC', {
        path: 'LOGIC',
        space_1: 'DEST-A',
        space_2: 'DEST-B',
        space_3: 'DEST-C',
      })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readMovement();
    const row = findMovement(lines, 'TEST-LOGIC', 'First');

    expect(row).toBeDefined();
    const fields = row!.split(',');
    expect(fields[2]).toBe('logic');
  });

  it("should NOT emit 'choice' for LOGIC spaces (the pre-v2.49 regression)", () => {
    const csv = [spacesHeader, spacesLabelRow,
      makeSpaceRow('REG-FDNY-FEE-REVIEW', {
        path: 'LOGIC',
        space_1: 'REG-FDNY-PLAN-EXAM',
        space_2: 'PM-DECISION-CHECK',
        space_3: 'REG-DOB-TYPE-SELECT',
      })
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readMovement();
    const row = findMovement(lines, 'REG-FDNY-FEE-REVIEW', 'First');

    expect(row).toBeDefined();
    const fields = row!.split(',');
    expect(fields[2]).not.toBe('choice');
    expect(fields[2]).toBe('logic');
  });

  it('should verify real Spaces.csv emits logic for REG-FDNY-FEE-REVIEW', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readMovement();

    for (const visit of ['First', 'Subsequent']) {
      const row = findMovement(lines, 'REG-FDNY-FEE-REVIEW', visit);
      expect(row, `REG-FDNY-FEE-REVIEW/${visit} must exist in MOVEMENT.csv`).toBeDefined();
      const fields = row!.split(',');
      expect(fields[2], `REG-FDNY-FEE-REVIEW/${visit} must be 'logic'`).toBe('logic');
    }
  });
});

// LOGIC_QUESTIONS.csv is hand-authored (not generated by processGameData).
// These tests guard the file's schema and integrity so hand-edits can't
// silently break the walker at runtime — the walker requires every yes/no
// target to be either a Q-id that exists, a valid space name, or a
// comma-separated list of space names.
describe('LOGIC_QUESTIONS.csv — schema + integrity', () => {
  const logicCsvPath = path.join(process.cwd(), 'public/data/CLEAN_FILES/LOGIC_QUESTIONS.csv');

  function parseRows(): Array<Record<string, string>> {
    const text = fs.readFileSync(logicCsvPath, 'utf-8').trim();
    const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      // Naive split is fine — the file has no quoted commas today.
      const cells = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h.trim()] = (cells[i] || '').trim(); });
      return row;
    });
  }

  it('should have the expected 6-column header', () => {
    const text = fs.readFileSync(logicCsvPath, 'utf-8');
    const header = text.split('\n')[0].trim();
    expect(header).toBe('space_name,visit_type,question_id,question_text,yes_target,no_target');
  });

  it('should have Q1 for every (space_name, visit_type) that has any question', () => {
    const rows = parseRows();
    const groups = new Map<string, Set<string>>();
    for (const r of rows) {
      const key = `${r.space_name}|${r.visit_type}`;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key)!.add(r.question_id);
    }
    for (const [key, ids] of groups) {
      expect(ids.has('Q1'), `${key} must have a Q1 entry-point row`).toBe(true);
    }
  });

  it('should have all Q-id targets resolve to an existing question row', () => {
    const rows = parseRows();
    const byKey = new Map<string, Set<string>>();
    for (const r of rows) {
      const key = `${r.space_name}|${r.visit_type}`;
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key)!.add(r.question_id);
    }
    for (const r of rows) {
      const key = `${r.space_name}|${r.visit_type}`;
      const ids = byKey.get(key)!;
      for (const target of [r.yes_target, r.no_target]) {
        if (/^Q\d+$/i.test(target)) {
          expect(ids.has(target), `${key} ${r.question_id}: target ${target} must exist`).toBe(true);
        }
      }
    }
  });

  it('should cover every logic space emitted by MOVEMENT.csv', () => {
    const movementCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/CLEAN_FILES/MOVEMENT.csv'), 'utf-8'
    );
    const movementLogicKeys = new Set<string>();
    for (const line of movementCsv.trim().split('\n').slice(1)) {
      const [space, visit, type] = line.split(',');
      if (type === 'logic') movementLogicKeys.add(`${space}|${visit}`);
    }

    const rows = parseRows();
    const logicKeys = new Set(rows.map(r => `${r.space_name}|${r.visit_type}`));

    for (const key of movementLogicKeys) {
      expect(logicKeys.has(key), `LOGIC_QUESTIONS.csv must have questions for ${key}`).toBe(true);
    }
  });
});

// ============================================================================
// v2.50.0 — per-action narrative emission (Spaces.csv *_card_narrative cols →
// SPACE_EFFECTS.csv `narrative` column). These are regression fingerprints
// against real CLEAN_FILES; bump them intentionally if authoring changes.
// ============================================================================
describe('processGameData — per-action narratives', () => {
  const cleanEffectsCsv = () =>
    fs.readFileSync(
      path.join(process.cwd(), 'public/data/CLEAN_FILES/SPACE_EFFECTS.csv'),
      'utf-8',
    );

  function findRow(
    csv: string,
    space: string,
    visit: string,
    action: string,
  ): string | undefined {
    return csv
      .trim()
      .split('\n')
      .slice(1)
      .find((l) => {
        const cols = l.split(',');
        return cols[0] === space && cols[1] === visit && cols[3] === action;
      });
  }

  it('emits authored e_card narrative for OWNER-SCOPE-INITIATION/First draw_E', () => {
    const row = findRow(cleanEffectsCsv(), 'OWNER-SCOPE-INITIATION', 'First', 'draw_E');
    expect(row).toBeDefined();
    expect(row!).toContain("The owner hands you a stack of contacts");
  });

  it('emits authored l_card narrative for ARCH-FEE-REVIEW/First draw_L', () => {
    const row = findRow(cleanEffectsCsv(), 'ARCH-FEE-REVIEW', 'First', 'draw_L');
    expect(row).toBeDefined();
    expect(row!).toContain("You've been on this job a while");
  });

  it('emits authored e_card narrative for ARCH-FEE-REVIEW/First return_e', () => {
    const row = findRow(cleanEffectsCsv(), 'ARCH-FEE-REVIEW', 'First', 'return_e');
    expect(row).toBeDefined();
    expect(row!).toContain("One of your expeditors has to go");
  });

  it('emits authored e_card narrative for ARCH-FEE-REVIEW/Subsequent draw_E', () => {
    const row = findRow(cleanEffectsCsv(), 'ARCH-FEE-REVIEW', 'Subsequent', 'draw_E');
    expect(row).toBeDefined();
    expect(row!).toContain('Your architect friend recommends someone new');
  });

  it('leaves narrative empty for actions that have no authored text', () => {
    // Pick any action we know has no narrative authored — e.g. time on
    // OWNER-SCOPE-INITIATION (the Spend 1 day row).
    const row = findRow(cleanEffectsCsv(), 'OWNER-SCOPE-INITIATION', 'First', 'add');
    expect(row).toBeDefined();
    const cols = row!.split(',');
    // Column layout: space,visit,type,action,value,condition,desc,trigger,fee_type,narrative,...
    expect(cols[9]).toBe('');
  });
});
