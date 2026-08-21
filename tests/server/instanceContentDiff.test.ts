// tests/server/instanceContentDiff.test.ts
// Card Library stage 1, final slice — the server-side diff that turns a Space
// Data Editor save (three whole CSVs) into "which spaces actually changed".
//
// The last block is the one that matters most: it runs the REAL shipped CSVs
// through the REAL editor exporter and asserts the diff finds nothing. If that
// ever goes red, a no-op save mints a card for every space on the board.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { diffSubmittedContent } from '../../server/instanceContentDiff.js';
import {
  parseSpacesCSV,
  exportSpacesCSV,
  parseDiceRollCSV,
  exportDiceRollCSV,
  parseModalConfigCSV,
  exportModalConfigCSV,
} from '../../src/components/editor/utils/csvExport';

const SPACES_HEADER = 'space_name,phase,visit_type,Title,Event,Action,Outcome,Time,Fee,space_1';
const STOCK_SPACES = [
  SPACES_HEADER,
  'ALPHA-START,SETUP,First,Start,Begin.,Go,Done,1,0,BETA-MIDDLE',
  'BETA-MIDDLE,SETUP,First,Middle,Mid.,Go,Done,2,50,ZETA-END',
  'BETA-MIDDLE,SETUP,Subsequent,Middle,Again.,Go,Done,1,25,ZETA-END',
  'ZETA-END,CONSTRUCTION,First,End,Fin.,Go,Done,0,0,',
].join('\n') + '\n';

const DICE_HEADER = 'space_name,die_roll,visit_type,1,2,3,4,5,6,button_label,roll_group';
const STOCK_DICE = [
  DICE_HEADER,
  'BETA-MIDDLE,Next Step,First,ZETA-END,ZETA-END,ZETA-END,ALPHA-START,ALPHA-START,ALPHA-START,,',
].join('\n') + '\n';

const MODAL_HEADER = 'space_name,visit_type,effect_action,modal_title,modal_description,modal_button_label,modal_summary';
const STOCK_MODAL = [
  MODAL_HEADER,
  'ZETA-END,First,finish,All done,You made it.,Close,Finished',
].join('\n') + '\n';

const stock = {
  stockSpacesCsv: STOCK_SPACES,
  stockDiceCsv: STOCK_DICE,
  stockModalCsv: STOCK_MODAL,
};

/** Submit stock back unchanged except for the edits applied by `edit`. */
function submit(overrides: Partial<{ spaces: string; dice: string; modal: string }> = {}) {
  return diffSubmittedContent({
    submittedSpacesCsv: overrides.spaces ?? STOCK_SPACES,
    submittedDiceCsv: overrides.dice ?? STOCK_DICE,
    submittedModalCsv: overrides.modal ?? STOCK_MODAL,
    ...stock,
  });
}

describe('diffSubmittedContent', () => {
  it('reports nothing changed when the payload matches stock', () => {
    const diff = submit();
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual(['ALPHA-START', 'BETA-MIDDLE', 'ZETA-END']);
    expect(diff.unknown).toEqual([]);
  });

  it('reports only the space whose Spaces row was edited', () => {
    const spaces = STOCK_SPACES.replace('Middle,Mid.,Go,Done,2,50', 'Middle,A new story.,Go,Done,2,50');
    const diff = submit({ spaces });
    expect(diff.changed.map(c => c.slot)).toEqual(['BETA-MIDDLE']);
    expect(diff.unchanged).toEqual(['ALPHA-START', 'ZETA-END']);
    // The changed space carries its rows, dice and modal rows for the card.
    const beta = diff.changed[0];
    expect(beta.rows.map(r => r.visit_type)).toEqual(['First', 'Subsequent']);
    expect(beta.rows[0].Event).toBe('A new story.');
    expect(beta.diceRows).toHaveLength(1);
    expect(beta.modalRows).toEqual([]);
  });

  it('catches a DICE-only edit — a space whose Spaces rows are untouched', () => {
    // Half the bug would still be alive if only Spaces.csv were compared: the
    // editor edits dice rows inline, and a dice edit evaporated on restart
    // exactly like a text one.
    const dice = STOCK_DICE.replace('ZETA-END,ZETA-END,ZETA-END,ALPHA-START', 'ZETA-END,ZETA-END,ALPHA-START,ALPHA-START');
    const diff = submit({ dice });
    expect(diff.changed.map(c => c.slot)).toEqual(['BETA-MIDDLE']);
    expect(diff.changed[0].diceRows[0]['3']).toBe('ALPHA-START');
  });

  it('catches a MODAL-only edit', () => {
    const modal = STOCK_MODAL.replace('Close,Finished', 'Wrap up,Finished');
    const diff = submit({ modal });
    expect(diff.changed.map(c => c.slot)).toEqual(['ZETA-END']);
    expect(diff.changed[0].modalRows[0].modal_button_label).toBe('Wrap up');
  });

  it('is not fooled by re-quoting, column reordering or a byte-order mark', () => {
    // The editor writes its own canonical column order and quoting rules, so a
    // text comparison would call every space changed on a save that touched
    // nothing. The comparison is field-by-field for exactly this reason.
    const reordered = [
      'visit_type,space_name,phase,Title,Event,Action,Outcome,Time,Fee,space_1',
      'First,ALPHA-START,SETUP,"Start",Begin.,Go,Done,1,0,BETA-MIDDLE',
      'First,BETA-MIDDLE,SETUP,Middle,"Mid.",Go,Done,2,50,ZETA-END',
      'Subsequent,BETA-MIDDLE,SETUP,Middle,Again.,Go,Done,1,25,ZETA-END',
      'First,ZETA-END,CONSTRUCTION,End,Fin.,Go,Done,0,0,',
    ].join('\n') + '\n';
    expect(submit({ spaces: '﻿' + reordered }).changed).toEqual([]);
  });

  it('treats a missing column and an empty one as the same value', () => {
    // A column dropped from the payload is not an edit — an emptied field is
    // what an edit looks like, and both arrive as ''.
    const withoutSpace1 = [
      'space_name,phase,visit_type,Title,Event,Action,Outcome,Time,Fee,space_1',
      'ZETA-END,CONSTRUCTION,First,End,Fin.,Go,Done,0,0,',
    ].join('\n') + '\n';
    const stockZeta = [
      'space_name,phase,visit_type,Title,Event,Action,Outcome,Time,Fee',
      'ZETA-END,CONSTRUCTION,First,End,Fin.,Go,Done,0,0',
    ].join('\n') + '\n';
    const diff = diffSubmittedContent({
      submittedSpacesCsv: withoutSpace1,
      stockSpacesCsv: stockZeta,
    });
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual(['ZETA-END']);
  });

  it('reports a space stock has never heard of as unknown rather than minting a card', () => {
    // A card fills a SLOT and slots are stock's names. Authoring a brand-new
    // space is what insertions are for.
    const spaces = STOCK_SPACES + 'BRAND-NEW,SETUP,First,New,New.,Go,Done,0,0,\n';
    const diff = submit({ spaces });
    expect(diff.unknown).toEqual(['BRAND-NEW']);
    expect(diff.changed).toEqual([]);
  });

  it('does not treat a space missing from the payload as a change of any kind', () => {
    // Removing a space from the board is switching its slot off (with the
    // detour flow), never a silent side effect of a content save.
    const spaces = STOCK_SPACES.split('\n').filter(l => !l.startsWith('ZETA-END')).join('\n') + '\n';
    const diff = submit({ spaces });
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual(['ALPHA-START', 'BETA-MIDDLE']);
    expect(diff.unknown).toEqual([]);
  });

  it('ignores rows with no space_name on either side', () => {
    // Stock's own Spaces.csv contains 53 of these (button labels sitting on
    // their own physical line) and the editor's parser drops them, so they can
    // never be part of a space's content on either side.
    const spaces = STOCK_SPACES + ',End Turn,Try Again,,,,,,,\n';
    expect(submit({ spaces }).changed).toEqual([]);
  });

  it('handles an absent dice/modal payload without calling every space changed', () => {
    const diff = diffSubmittedContent({
      submittedSpacesCsv: STOCK_SPACES,
      submittedDiceCsv: null,
      submittedModalCsv: null,
      stockSpacesCsv: STOCK_SPACES,
      stockDiceCsv: null,
      stockModalCsv: null,
    });
    expect(diff.changed).toEqual([]);
  });
});

// ===== The real thing: shipped data through the real editor round-trip =====

describe('a Space Data Editor save that changed nothing mints nothing (real data)', () => {
  const sourceDir = path.resolve(__dirname, '../../server/data/game-data/SOURCE_FILES');
  const read = (name: string) =>
    fs.existsSync(path.join(sourceDir, name)) ? fs.readFileSync(path.join(sourceDir, name), 'utf-8') : null;

  it('round-trips every shipped space through parse → export → diff with zero changes', () => {
    const stockSpacesCsv = read('Spaces.csv');
    const stockDiceCsv = read('DiceRoll Info.csv');
    const stockModalCsv = read('ModalConfig.csv');
    // Guard against a vacuous pass if the data dir ever moves.
    expect(stockSpacesCsv, 'shipped Spaces.csv not found').toBeTruthy();
    expect(stockDiceCsv, 'shipped DiceRoll Info.csv not found').toBeTruthy();

    // Exactly what the editor does: load, parse into its own row shape, and
    // export back out when the admin hits Save without touching anything.
    const submittedSpacesCsv = exportSpacesCSV(parseSpacesCSV(stockSpacesCsv!));
    const submittedDiceCsv = exportDiceRollCSV(parseDiceRollCSV(stockDiceCsv!));
    const submittedModalCsv = stockModalCsv
      ? exportModalConfigCSV(parseModalConfigCSV(stockModalCsv))
      : null;

    const diff = diffSubmittedContent({
      submittedSpacesCsv,
      submittedDiceCsv,
      submittedModalCsv,
      stockSpacesCsv: stockSpacesCsv!,
      stockDiceCsv,
      stockModalCsv,
    });

    expect(diff.changed.map(c => c.slot)).toEqual([]);
    expect(diff.unknown).toEqual([]);
    expect(diff.unchanged.length).toBeGreaterThan(20); // the whole real deck
  });

  it('finds exactly one space when one shipped space is edited', () => {
    const stockSpacesCsv = read('Spaces.csv')!;
    const rows = parseSpacesCSV(stockSpacesCsv);
    const target = rows[0].space_name;
    rows[0] = { ...rows[0], Title: 'Edited by the maintainer' };

    const diff = diffSubmittedContent({
      submittedSpacesCsv: exportSpacesCSV(rows),
      submittedDiceCsv: exportDiceRollCSV(parseDiceRollCSV(read('DiceRoll Info.csv')!)),
      stockSpacesCsv,
      stockDiceCsv: read('DiceRoll Info.csv'),
    });

    expect(diff.changed.map(c => c.slot)).toEqual([target]);
    expect(diff.changed[0].rows.some(r => r.Title === 'Edited by the maintainer')).toBe(true);
  });
});
