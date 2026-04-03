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
