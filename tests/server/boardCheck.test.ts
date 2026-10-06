// tests/server/boardCheck.test.ts
// "Can players still get from start to finish?" on the BUILT board
// (server/boardCheck.js), and the trial bake the save routes run before saving.
// Editor review 2026-10-05, R1/R2/R5: the settings validator passed a new space
// with no exit and a board whose FINISH was switched off.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkBoard } from '../../server/boardCheck.js';
import { bakeInstance, computeStockVersion } from '../../server/instanceResolver.js';
import { createInstance, addInsertion } from '../../server/instanceStore.js';

const GC = 'space_name,is_starting_space,is_ending_space\n';
const MV = 'space_name,visit_type,movement_type,destination_1,destination_2,destination_3,destination_4,destination_5\n';

function board(spaces: string[][], moves: string[]) {
  return {
    gameConfigCsv: GC + spaces.map(s => s.join(',')).join('\n') + '\n',
    movementCsv: MV + moves.join('\n') + '\n',
  };
}

describe('checkBoard', () => {
  const good = board(
    [['A-START', 'Yes', 'No'], ['B-MIDDLE', 'No', 'No'], ['Z-FINISH', 'No', 'Yes']],
    ['A-START,First,fixed,B-MIDDLE,,,,', 'B-MIDDLE,First,fixed,Z-FINISH,,,,'],
  );

  it('passes a board that runs from start to finish', () => {
    expect(checkBoard(good)).toMatchObject({ ok: true, errors: [] });
  });

  it('refuses a board with no ending space (FINISH switched off)', () => {
    const r = checkBoard(board(
      [['A-START', 'Yes', 'No'], ['B-MIDDLE', 'No', 'No']],
      ['A-START,First,fixed,B-MIDDLE,,,,', 'B-MIDDLE,First,fixed,A-START,,,,'],
    ));
    expect(r.ok).toBe(false);
    expect(r.errors.map((e: any) => e.code)).toContain('NO_ENDING_SPACE');
  });

  it('refuses a reachable space with no exit (the line-break dead end)', () => {
    const r = checkBoard(board(
      [['A-START', 'Yes', 'No'], ['AUTH-NEW-1', 'No', 'No'], ['B-MIDDLE', 'No', 'No'], ['Z-FINISH', 'No', 'Yes']],
      ['A-START,First,fixed,AUTH-NEW-1,,,,', 'AUTH-NEW-1,First,none,,,,,', 'B-MIDDLE,First,fixed,Z-FINISH,,,,'],
    ));
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual(expect.objectContaining({ code: 'NO_EXIT', space: 'AUTH-NEW-1' }));
    expect(r.errors.map((e: any) => e.code)).toContain('ENDING_UNREACHABLE');
  });

  it('refuses an arrow that leads off the board', () => {
    const r = checkBoard(board(
      [['A-START', 'Yes', 'No'], ['Z-FINISH', 'No', 'Yes']],
      ['A-START,First,choice,Z-FINISH,GONE-SPACE,,,'],
    ));
    expect(r.errors).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_DESTINATION', space: 'A-START' }));
  });

  it('refuses a dice space with fewer than six outcomes', () => {
    const r = checkBoard({
      ...good,
      diceOutcomesCsv: 'space_name,visit_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6\nB-MIDDLE,First,Z-FINISH,Z-FINISH,Z-FINISH,,,\n',
    });
    expect(r.errors).toContainEqual(expect.objectContaining({ code: 'DICE_INCOMPLETE', space: 'B-MIDDLE' }));
  });

  it('counts dice faces ("A or B" is both) and logic targets as ways out', () => {
    const r = checkBoard({
      ...board(
        [['A-START', 'Yes', 'No'], ['B-DICE', 'No', 'No'], ['C-LOGIC', 'No', 'No'], ['Z-FINISH', 'No', 'Yes']],
        ['A-START,First,fixed,B-DICE,,,,', 'B-DICE,First,dice,,,,,', 'C-LOGIC,First,logic,,,,,'],
      ),
      diceOutcomesCsv: 'space_name,visit_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6\nB-DICE,First,C-LOGIC or Z-FINISH,C-LOGIC,C-LOGIC,C-LOGIC,C-LOGIC,C-LOGIC\n',
      logicQuestionsCsv: 'space_name,visit_type,question_id,question_text,yes_target,no_target\nC-LOGIC,First,Q1,Ready?,Z-FINISH,Q2\n',
    });
    expect(r.ok).toBe(true);
  });

  it('only warns about an off-board space nobody can reach (the quick-play guide)', () => {
    const r = checkBoard(board(
      [['A-START', 'Yes', 'No'], ['GUIDE-OFFBOARD', 'No', 'No'], ['Z-FINISH', 'No', 'Yes']],
      ['A-START,First,fixed,Z-FINISH,,,,', 'GUIDE-OFFBOARD,First,none,,,,,'],
    ));
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.objectContaining({ code: 'UNREACHABLE_SPACE', space: 'GUIDE-OFFBOARD' }));
  });

  it('passes the real stock board', () => {
    const r = (f: string) => fs.readFileSync(path.join(process.cwd(), 'public/data/CLEAN_FILES', f), 'utf-8');
    const report = checkBoard({
      gameConfigCsv: r('GAME_CONFIG.csv'),
      movementCsv: r('MOVEMENT.csv'),
      diceOutcomesCsv: r('DICE_OUTCOMES.csv'),
      logicQuestionsCsv: r('LOGIC_QUESTIONS.csv'),
    });
    expect(report.errors).toEqual([]);
  });
});

describe('trial bake (what the save routes run before saving)', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trialbake-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const stockDataDir = path.join(process.cwd(), 'public/data');

  it('checks the real board an edit would produce, and leaves nothing behind', () => {
    const config = createInstance(tmp, { id: 'classroom-1' });
    addInsertion(config, {
      from: 'ARCH-INITIATION', to: 'ENG-INITIATION', displayName: 'Two Line Story',
      story: `First line.\nSecond line.`, time: '2',
    });
    const out: any = bakeInstance({ stockDataDir, instancesRoot: tmp, config, stockVersion: computeStockVersion(stockDataDir), trial: true });
    // The insertion on that edge may or may not be valid against stock; what matters
    // here is that the trial reports on the BUILT board and never swaps anything in.
    expect(out.trial).toBe(true);
    expect(out.boardReport.errors.filter((e: any) => e.code === 'NO_EXIT')).toEqual([]);
    expect(fs.existsSync(path.join(tmp, 'classroom-1', 'resolved'))).toBe(false);
    const debris = fs.readdirSync(path.join(tmp, 'classroom-1')).filter(n => n.startsWith('resolved'));
    expect(debris).toEqual([]);
  });
});

import { compareBoardReports } from '../../server/boardCheck.js';

describe('compareBoardReports (a save is refused only if it makes the board worse)', () => {
  const e = (code: string, space: string) => ({ code, space, message: `${space} ${code}` });

  it('a save that fixes some problems and adds none is allowed, and the rest are named', () => {
    const before = { errors: [e('NO_EXIT', 'A-ONE'), e('NO_EXIT', 'B-TWO')] };
    const after = { errors: [e('NO_EXIT', 'B-TWO')] };
    const r = compareBoardReports(before, after);
    expect(r.newErrors).toEqual([]);
    expect(r.remainingErrors).toEqual([e('NO_EXIT', 'B-TWO')]);
  });

  it('a save that adds a problem is refused even if the board was already broken', () => {
    const before = { errors: [e('NO_EXIT', 'B-TWO')] };
    const after = { errors: [e('NO_EXIT', 'B-TWO'), e('UNKNOWN_DESTINATION', 'C-THREE')] };
    const r = compareBoardReports(before, after);
    expect(r.newErrors).toEqual([e('UNKNOWN_DESTINATION', 'C-THREE')]);
  });

  it('when the old board could not be checked, every problem counts as new (strict)', () => {
    const after = { errors: [e('NO_EXIT', 'B-TWO')] };
    expect(compareBoardReports(null, after).newErrors).toHaveLength(1);
  });
});
