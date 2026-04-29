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
// Workstream 6 Phase 6.3 — Cosmetic mappings lifted to data flags
// SPECIAL_NAMES (display label overrides) and reviewLoopMessages (re-review
// explanations) lived as hardcoded records in boardLayout.ts and
// DiceRollProcessor.ts. Migrated to display_label_override + review_loop_message
// columns so educators can set per-space cosmetic copy without code changes.
describe('processGameData — engine-data separation: cosmetic overrides', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it('real Spaces.csv migrates the 5 SPECIAL_NAMES + 4 review-loop messages into data', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    // Helper: CSV-aware split (some fields contain commas like the review-loop messages).
    function fieldAt(row: string, idx: number): string {
      let inQ = false, i = 0, start = 0, col = 0;
      for (; i < row.length; i++) {
        if (row[i] === '"') inQ = !inQ;
        else if (row[i] === ',' && !inQ) {
          if (col === idx) return row.slice(start, i).replace(/^"|"$/g, '');
          col++;
          start = i + 1;
        }
      }
      if (col === idx) return row.slice(start).replace(/^"|"$/g, '');
      return '';
    }

    // Column order: …,17:display_label_override,18:review_loop_message
    const finish = dataRows.find(r => r.startsWith('FINISH,'));
    const pmCheck = dataRows.find(r => r.startsWith('PM-DECISION-CHECK,'));
    expect(fieldAt(finish!, 17)).toBe('Finish');
    expect(fieldAt(pmCheck!, 17)).toBe('PM Check');

    const dobPlanExam = dataRows.find(r => r.startsWith('REG-DOB-PLAN-EXAM,'));
    expect(fieldAt(dobPlanExam!, 18)).toContain('examiner found minor issues');

    // Sanity: roughly the right counts of each.
    const labelCount = dataRows.filter(r => fieldAt(r, 17).length > 0).length;
    const msgCount = dataRows.filter(r => fieldAt(r, 18).length > 0).length;
    expect(labelCount).toBeGreaterThan(0);
    expect(msgCount).toBeGreaterThan(0);
  });

  it('parametric: a custom space with override + message propagates', () => {
    const headerWithFlags = `${spacesHeader},display_label_override,review_loop_message`;
    const csv = [
      headerWithFlags,
      `${makeSpaceRow('CUSTOM-CHECKPOINT', { phase: 'OWNER' })},Checkpoint,"Try again, you must improve."`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const customRow = lines.slice(1).find(r => r.startsWith('CUSTOM-CHECKPOINT,'))!;

    expect(customRow).toMatch(/,Checkpoint,/);
    expect(customRow).toMatch(/,"Try again, you must improve\."/);
  });
});

// Workstream 6 #4 — Engine-data separation: path-choice memory + exclusions
// REG-DOB-TYPE-SELECT (lock point) and REG-FDNY-PLAN-EXAM (cross-space exclusion)
// were both hardcoded by space ID + literal destination values in MovementService.
// Lifted to two new Spaces.csv columns (path_choice_memory_key,
// is_path_choice_lock_point) plus a new PATH_CHOICE_RULES.csv source file.
// Educators can configure new lock points and new cross-space exclusions
// entirely via data.
describe('processGameData — engine-data separation: path-choice memory flags', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it('real Spaces.csv flags REG-DOB-TYPE-SELECT as a lock point with key=dob_path', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    // Column order: …,15:path_choice_memory_key,16:is_path_choice_lock_point
    const dobRow = dataRows.find(r => r.startsWith('REG-DOB-TYPE-SELECT,'));
    expect(dobRow).toBeDefined();
    const fields = dobRow!.split(',');
    expect(fields[15]).toBe('dob_path');
    expect(fields[16]).toBe('Yes');

    // Sanity: only REG-DOB-TYPE-SELECT is a lock point on current data.
    const lockPoints = dataRows.filter(r => r.split(',')[16] === 'Yes');
    expect(lockPoints).toHaveLength(1);
  });

  it('parametric: a custom lock-point space with a custom memory key propagates', () => {
    const headerWithFlags = `${spacesHeader},path_choice_memory_key,is_path_choice_lock_point`;
    const csv = [
      headerWithFlags,
      `${makeSpaceRow('CUSTOM-LOCK-POINT', { phase: 'OWNER' })},strategy_choice,Yes`,
      `${makeSpaceRow('OTHER-SPACE', { phase: 'DESIGN' })},,No`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const customFields = dataRows.find(r => r.startsWith('CUSTOM-LOCK-POINT,'))!.split(',');
    const otherFields = dataRows.find(r => r.startsWith('OTHER-SPACE,'))!.split(',');
    expect(customFields[15]).toBe('strategy_choice');
    expect(customFields[16]).toBe('Yes');
    expect(otherFields[15]).toBe('');
    expect(otherFields[16]).toBe('No');
  });

  it('rows without the columns default to empty key + No lock point', () => {
    const csv = [
      spacesHeader,
      makeSpaceRow('LEGACY-SPACE', {}),
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const fields = lines.slice(1)[0].split(',');
    expect(fields[15]).toBe('');
    expect(fields[16]).toBe('No');
  });
});

// Workstream 6 #3 — Engine-data separation: setup-phase auto-handling
// OWNER-FUND-INITIATION had three coupled hardcodes: auto-apply funding on
// arrival, auto-trigger B/I card draws, and skip direct money effects from
// those drawn cards (since handleAutomaticFunding handles the money). Lifted
// to two new Spaces.csv columns: auto_apply_funding (Yes/No) and
// auto_trigger_card_types (comma-separated card letters). Educators can now
// configure other spaces with the same auto-funding mechanic.
describe('processGameData — engine-data separation: auto-handling flags', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }
  function readEffectsForSpace(spaceName: string): string[] {
    return fs.readFileSync(path.join(tmpDir, 'SPACE_EFFECTS.csv'), 'utf-8').trim().split('\n')
      .filter(l => l.startsWith(spaceName + ','));
  }

  it('real Spaces.csv flags OWNER-FUND-INITIATION with auto_apply_funding=Yes and auto_trigger_card_types=B,I', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    // Column order: …,13:auto_apply_funding,14:auto_trigger_card_types
    // The card-types column is quoted in CSV output because of the embedded comma
    // ("B,I"), so use a regex match rather than naive split-by-comma.
    const ownerFundRow = dataRows.find(r => r.startsWith('OWNER-FUND-INITIATION,'));
    expect(ownerFundRow).toBeDefined();
    // Match the auto_apply_funding=Yes + auto_trigger_card_types="B,I" pair —
    // not anchored at line end because subsequent Workstream-6 scenarios may
    // append more columns after these.
    expect(ownerFundRow).toMatch(/,Yes,"B,I"(?:,|$)/);

    // Sanity: only OWNER-FUND-INITIATION is flagged on current data.
    // Match `,Yes,` for the auto_apply_funding column. (Naive split would fail
    // on rows whose card-types field has commas; regex on the column-prefix
    // pattern is robust.)
    const autoRows = dataRows.filter(r => /,Yes,(?:"|[A-Z,]*$)/.test(r.replace(/.*requires_dice_roll.*/, '')) === false ? false : true);
    // Simpler: just count how many rows have auto_apply_funding=Yes by parsing
    // the row through a CSV-aware split.
    const yesCount = dataRows.filter(r => {
      // CSV-aware split: find the substring between the 13th and 14th unquoted comma.
      let inQ = false, idx = 0, start = 0;
      for (let i = 0; i < r.length; i++) {
        if (r[i] === '"') inQ = !inQ;
        else if (r[i] === ',' && !inQ) {
          if (idx === 13) return r.slice(start, i) === 'Yes';
          idx++;
          start = i + 1;
        }
      }
      return false;
    }).length;
    expect(yesCount).toBe(1);
  });

  it('parametric: a custom space with auto_apply_funding + auto_trigger_card_types propagates', () => {
    const headerWithFlags = `${spacesHeader},auto_apply_funding,auto_trigger_card_types`;
    const csv = [
      headerWithFlags,
      `${makeSpaceRow('CUSTOM-FUND-HUB', { phase: 'SETUP' })},Yes,"B,I,W"`,
      `${makeSpaceRow('OTHER-SPACE', { phase: 'DESIGN' })},No,`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const customFields = dataRows.find(r => r.startsWith('CUSTOM-FUND-HUB,'))!.split(',');
    expect(customFields[13]).toBe('Yes');
    // CSV may re-quote the multi-comma field
    expect(dataRows.find(r => r.startsWith('CUSTOM-FUND-HUB,'))).toMatch(/"B,I,W"/);

    const otherFields = dataRows.find(r => r.startsWith('OTHER-SPACE,'))!.split(',');
    expect(otherFields[13]).toBe('No');
    expect(otherFields[14]).toBe('');
  });

  it('rows without the columns default to No + empty card-types list', () => {
    const csv = [
      spacesHeader,
      makeSpaceRow('LEGACY-SPACE', {}),
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const fields = lines.slice(1)[0].split(',');
    expect(fields[13]).toBe('No');
    expect(fields[14]).toBe('');
  });

  it('auto_trigger_card_types makes B/I card draws auto-trigger in SPACE_EFFECTS', () => {
    // Build a row with a B card draw + auto_trigger_card_types=B. The pipeline
    // should mark that effect's trigger_type as 'auto'. Without the flag, default
    // is 'manual' for non-L cards.
    const headerWithFlags = `${spacesHeader},auto_apply_funding,auto_trigger_card_types`;
    const csv = [
      headerWithFlags,
      `${makeSpaceRow('AUTO-TRIGGER-TEST', { phase: 'SETUP', b_card: 'Draw 1' })},Yes,B`,
      `${makeSpaceRow('MANUAL-TRIGGER-TEST', { phase: 'SETUP', b_card: 'Draw 1' })},No,`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const autoEffects = readEffectsForSpace('AUTO-TRIGGER-TEST');
    const manualEffects = readEffectsForSpace('MANUAL-TRIGGER-TEST');

    // The B-card effect on the auto-flagged space should be 'auto'.
    const autoB = autoEffects.find(l => l.includes('draw_B'));
    expect(autoB).toBeDefined();
    expect(autoB).toContain(',auto,');

    // The B-card effect on the unflagged space should be 'manual'.
    const manualB = manualEffects.find(l => l.includes('draw_B'));
    expect(manualB).toBeDefined();
    expect(manualB).toContain(',manual,');
  });
});

// Workstream 6 #7 — Engine-data separation: design fee mechanic
// SpaceEffectService and FinancesSection both substring-matched 'ARCH' / 'ENG'
// to detect "this is a design-fee space, charge % of scope and label it
// Architect/Engineer." Lifted to fee_calculation_method + fee_label columns
// so educators can configure other spaces with the same mechanic.
describe('processGameData — engine-data separation: design fee flags', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it('real Spaces.csv flags ARCH-FEE-REVIEW / ENG-FEE-REVIEW with percentage_of_scope + correct labels', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    // Column order: …,11:fee_calculation_method,12:fee_label
    const archRow = dataRows.find(r => r.startsWith('ARCH-FEE-REVIEW,'));
    const engRow = dataRows.find(r => r.startsWith('ENG-FEE-REVIEW,'));
    expect(archRow).toBeDefined();
    expect(engRow).toBeDefined();

    const archFields = archRow!.split(',');
    const engFields = engRow!.split(',');
    expect(archFields[11]).toBe('percentage_of_scope');
    expect(archFields[12]).toBe('Architect');
    expect(engFields[11]).toBe('percentage_of_scope');
    expect(engFields[12]).toBe('Engineer');

    // Sanity: only those two spaces use percentage_of_scope on current data.
    const pctRows = dataRows.filter(r => r.split(',')[11] === 'percentage_of_scope');
    expect(pctRows).toHaveLength(2);
  });

  it('parametric: a custom space with percentage_of_scope + custom label propagates', () => {
    const headerWithFlags = `${spacesHeader},fee_calculation_method,fee_label`;
    const csv = [
      headerWithFlags,
      `${makeSpaceRow('CUSTOM-CONSULT-FEE', { phase: 'DESIGN' })},percentage_of_scope,Consultant`,
      `${makeSpaceRow('FLAT-FEE-SPACE', { phase: 'DESIGN' })},flat,`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const customFields = dataRows.find(r => r.startsWith('CUSTOM-CONSULT-FEE,'))!.split(',');
    const flatFields = dataRows.find(r => r.startsWith('FLAT-FEE-SPACE,'))!.split(',');
    expect(customFields[11]).toBe('percentage_of_scope');
    expect(customFields[12]).toBe('Consultant');
    expect(flatFields[11]).toBe('flat');
    expect(flatFields[12]).toBe('');
  });

  it('rows without the columns default to flat + empty label', () => {
    const csv = [
      spacesHeader, // header WITHOUT fee_calculation_method or fee_label
      makeSpaceRow('LEGACY-FEE-SPACE', {}),
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const fields = dataRows[0].split(',');
    expect(fields[11]).toBe('flat');
    expect(fields[12]).toBe('');
  });

  it('unrecognized fee_calculation_method values fall back to flat', () => {
    const headerWithFlags = `${spacesHeader},fee_calculation_method,fee_label`;
    const csv = [
      headerWithFlags,
      `${makeSpaceRow('TYPO-SPACE', { phase: 'DESIGN' })},precentage_of_scope,Architect`, // misspelled
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const fields = dataRows[0].split(',');
    expect(fields[11]).toBe('flat'); // unrecognized → safe default
    expect(fields[12]).toBe('Architect'); // label still passes through
  });
});

// Workstream 6 #2 — Engine-data separation: scope-zero guard via min_w_cards_to_leave
// TurnService previously hardcoded the W-card check to OWNER-SCOPE-INITIATION.
// Lifted to a numeric `min_w_cards_to_leave` Spaces.csv column so educators
// can gate other spaces with the same mechanic (e.g. require 2 W cards on a
// custom "scope review" space).
describe('processGameData — engine-data separation: min_w_cards_to_leave', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it('real Spaces.csv flags OWNER-SCOPE-INITIATION with min_w_cards_to_leave=1', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    // Column order: 0:space_name … 8:is_resume_hub 9:is_point_of_no_return 10:min_w_cards_to_leave
    const ownerScopeRow = dataRows.find(r => r.startsWith('OWNER-SCOPE-INITIATION,'));
    expect(ownerScopeRow).toBeDefined();
    expect(ownerScopeRow!.split(',')[10]).toBe('1');

    // Sanity: no other space has min_w_cards_to_leave > 0 on current data
    const gatedRows = dataRows.filter(r => parseInt(r.split(',')[10], 10) > 0);
    expect(gatedRows).toHaveLength(1);
    expect(gatedRows[0]).toMatch(/^OWNER-SCOPE-INITIATION,/);
  });

  it('parametric: a custom space with min_w_cards_to_leave=2 propagates to output', () => {
    const headerWithFlag = `${spacesHeader},min_w_cards_to_leave`;
    const csv = [
      headerWithFlag,
      `${makeSpaceRow('CUSTOM-SCOPE-CHECK', { phase: 'OWNER' })},2`,
      `${makeSpaceRow('OTHER-SPACE', { phase: 'DESIGN' })},0`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    expect(dataRows.find(r => r.startsWith('CUSTOM-SCOPE-CHECK,'))!.split(',')[10]).toBe('2');
    expect(dataRows.find(r => r.startsWith('OTHER-SPACE,'))!.split(',')[10]).toBe('0');
  });

  it('rows without min_w_cards_to_leave default to 0', () => {
    const csv = [
      spacesHeader, // header WITHOUT min_w_cards_to_leave
      makeSpaceRow('LEGACY-A', {}),
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    expect(dataRows[0].split(',')[10]).toBe('0');
  });

  it('non-numeric or negative values default to 0', () => {
    const headerWithFlag = `${spacesHeader},min_w_cards_to_leave`;
    const csv = [
      headerWithFlag,
      `${makeSpaceRow('BAD-VAL-A', { phase: 'OWNER' })},garbage`,
      `${makeSpaceRow('BAD-VAL-B', { phase: 'OWNER' })},-3`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    expect(dataRows.find(r => r.startsWith('BAD-VAL-A,'))!.split(',')[10]).toBe('0');
    expect(dataRows.find(r => r.startsWith('BAD-VAL-B,'))!.split(',')[10]).toBe('0');
  });
});

// Workstream 6 #5+#6 — Engine-data separation: resume-mechanic flags
// PM-DECISION-CHECK as "the resume hub" and CHEAT-BYPASS as "the point of no
// return" were both hardcoded by space ID in MovementService. Lifted to
// `is_resume_hub` and `is_point_of_no_return` Spaces.csv columns so educators
// can mark different spaces with the same mechanics.
describe('processGameData — engine-data separation: resume-mechanic flags', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it('real Spaces.csv flags PM-DECISION-CHECK as is_resume_hub and CHEAT-BYPASS as is_point_of_no_return', () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    // GAME_CONFIG column order:
    // 0:space_name 1:phase 2:path_type 3:is_starting_space 4:is_ending_space
    // 5:min_players 6:max_players 7:requires_dice_roll 8:is_resume_hub 9:is_point_of_no_return
    const pmRow = dataRows.find(r => r.startsWith('PM-DECISION-CHECK,'));
    const cheatRow = dataRows.find(r => r.startsWith('CHEAT-BYPASS,'));

    expect(pmRow).toBeDefined();
    expect(cheatRow).toBeDefined();

    const pmFields = pmRow!.split(',');
    const cheatFields = cheatRow!.split(',');

    expect(pmFields[8]).toBe('Yes');  // PM-DECISION-CHECK is the resume hub
    expect(pmFields[9]).toBe('No');   // PM-DECISION-CHECK is NOT a point of no return

    expect(cheatFields[8]).toBe('No');   // CHEAT-BYPASS is NOT a resume hub
    expect(cheatFields[9]).toBe('Yes');  // CHEAT-BYPASS IS the point of no return
  });

  it('parametric: a custom space marked is_resume_hub=Yes resolves to Yes in output', () => {
    const headerWithFlag = `${spacesHeader},is_resume_hub`;
    const csv = [
      headerWithFlag,
      `${makeSpaceRow('CUSTOM-CHECKPOINT', { phase: 'OWNER' })},Yes`,
      `${makeSpaceRow('OTHER-SPACE', { phase: 'DESIGN' })},No`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const customRow = dataRows.find(r => r.startsWith('CUSTOM-CHECKPOINT,'));
    const otherRow = dataRows.find(r => r.startsWith('OTHER-SPACE,'));
    expect(customRow!.split(',')[8]).toBe('Yes');
    expect(otherRow!.split(',')[8]).toBe('No');
  });

  it('parametric: a custom space marked is_point_of_no_return=Yes resolves to Yes in output', () => {
    const headerWithFlag = `${spacesHeader},is_point_of_no_return`;
    const csv = [
      headerWithFlag,
      `${makeSpaceRow('CUSTOM-FORK', { phase: 'OWNER' })},Yes`,
      `${makeSpaceRow('OTHER-SPACE', { phase: 'DESIGN' })},No`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const customRow = dataRows.find(r => r.startsWith('CUSTOM-FORK,'));
    const otherRow = dataRows.find(r => r.startsWith('OTHER-SPACE,'));
    expect(customRow!.split(',')[9]).toBe('Yes');
    expect(otherRow!.split(',')[9]).toBe('No');
  });

  it('rows without the new columns default both flags to No', () => {
    const csv = [
      spacesHeader, // header WITHOUT is_resume_hub or is_point_of_no_return
      makeSpaceRow('LEGACY-A', {}),
      makeSpaceRow('LEGACY-B', {}),
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    expect(dataRows).toHaveLength(2);
    for (const row of dataRows) {
      const f = row.split(',');
      expect(f[8]).toBe('No');
      expect(f[9]).toBe('No');
    }
  });
});

// Workstream 6 #1 — Engine-data separation: starting space lifted to data flag
// Previously processGameData hardcoded `STARTING_SPACE = 'OWNER-SCOPE-INITIATION'`
// and computed `is_starting_space` from that constant. Now reads `is_starting_space`
// column from Spaces.csv source, so educators can mark a different starting space
// without touching code.
describe('processGameData — engine-data separation: is_starting_space sourced from Spaces.csv', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it('real Spaces.csv produces exactly one is_starting_space=Yes row', () => {
    // Data integrity: the real source data must continue to mark exactly one
    // starting space. Zero would break game start; >1 would cause non-determinism.
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1); // skip header

    // Column order: space_name,phase,path_type,is_starting_space,is_ending_space,...
    const startingRows = dataRows.filter(row => row.split(',')[3] === 'Yes');
    expect(startingRows).toHaveLength(1);
    // Sanity: the one starting space is OWNER-SCOPE-INITIATION on current data.
    // (If/when an educator changes this in source, update this assertion.)
    expect(startingRows[0]).toMatch(/^OWNER-SCOPE-INITIATION,/);
  });

  it('parametric: a custom space marked is_starting_space=Yes resolves to Yes in output', () => {
    // Construct a CSV with the new column, mark a non-OWNER space as starting.
    // Proves the lift is actually data-driven, not still hardcoded.
    const headerWithFlag = `${spacesHeader},is_starting_space`;
    const csv = [
      headerWithFlag,
      `${makeSpaceRow('CUSTOM-EDU-START', { phase: 'SETUP' })},Yes`,
      `${makeSpaceRow('OTHER-SPACE', { phase: 'DESIGN' })},No`,
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    const customRow = dataRows.find(r => r.startsWith('CUSTOM-EDU-START,'));
    const otherRow = dataRows.find(r => r.startsWith('OTHER-SPACE,'));

    expect(customRow).toBeDefined();
    expect(otherRow).toBeDefined();
    expect(customRow!.split(',')[3]).toBe('Yes');
    expect(otherRow!.split(',')[3]).toBe('No');
  });

  it('rows without is_starting_space column default to No', () => {
    // Backward-compatibility: source CSVs without the new column (or rows with empty
    // value) must produce is_starting_space=No, never Yes by accident.
    const csv = [
      spacesHeader, // header WITHOUT is_starting_space column
      makeSpaceRow('LEGACY-SPACE-A', {}),
      makeSpaceRow('LEGACY-SPACE-B', {}),
    ].join('\n');

    processGameData(csv, diceRollCsv, tmpDir);
    const lines = readGameConfig();
    const dataRows = lines.slice(1);

    expect(dataRows).toHaveLength(2);
    for (const row of dataRows) {
      expect(row.split(',')[3]).toBe('No');
    }
  });
});

// Workstream 6 #8 — Engine-data separation: regulatory-phase coupling
// TurnService.startTurn() previously checked `currentSpace.startsWith('REG-')` to
// decide whether to auto-roll dice on arrival. That check was lifted to
// `phase === 'REGULATORY'` so educator-added regulatory spaces (any prefix) get
// the same behavior. This describe block locks in the equivalence on real data:
// every space starting with `REG-` in source must resolve to phase=REGULATORY in
// GAME_CONFIG output. If this ever drifts, the lift would silently change behavior.
describe('processGameData — engine-data separation: REGULATORY phase equivalence', () => {
  function readGameConfig(): string[] {
    return fs.readFileSync(path.join(tmpDir, 'GAME_CONFIG.csv'), 'utf-8').trim().split('\n');
  }

  it("every REG-prefixed space resolves to phase='REGULATORY' in GAME_CONFIG", () => {
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();

    // Skip header
    const dataRows = lines.slice(1);
    const regRows = dataRows.filter(l => l.startsWith('REG-'));

    expect(regRows.length).toBeGreaterThan(0); // sanity: there ARE REG- spaces

    // Column order: space_name,phase,path_type,is_starting_space,is_ending_space,...
    const violators = regRows.filter(row => {
      const phase = row.split(',')[1];
      return phase !== 'REGULATORY';
    });

    expect(violators).toHaveLength(0);
  });

  it("phase='REGULATORY' spaces match the legacy REG- prefix on current data", () => {
    // Reverse direction: confirms the lift didn't accidentally widen the set.
    // (If a non-REG-prefixed space gets phase=REGULATORY in the future, the
    // engine will start auto-rolling there too — which is the lift's intent for
    // educator-added spaces. This test would then need an explicit allowlist
    // update, signaling the intentional widening.)
    const realSpacesCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8'
    );
    const realDiceCsv = fs.readFileSync(
      path.join(process.cwd(), 'public/data/SOURCE_FILES/DiceRoll Info.csv'), 'utf-8'
    );

    processGameData(realSpacesCsv, realDiceCsv, tmpDir);
    const lines = readGameConfig();

    const dataRows = lines.slice(1);
    const regulatoryRows = dataRows.filter(l => {
      const phase = l.split(',')[1];
      return phase === 'REGULATORY';
    });

    const nonRegPrefixed = regulatoryRows.filter(l => !l.startsWith('REG-'));

    expect(nonRegPrefixed).toHaveLength(0);
  });
});

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
