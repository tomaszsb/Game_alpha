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
import { diffSubmittedContent, restrictChangesToWording, TEACHER_EDITABLE_COLUMNS } from '../../server/instanceContentDiff.js';
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

// ---------------------------------------------------------------------------
// Regression: one edit minted a card for every space (reported 2026-08-22)
//
// The maintainer changed a single space and found ~26 cards created. Cause:
// the editor loads the classroom's BAKED board, which carries tile positions
// the Board Layout Editor saved, while the diff compared against shipped
// stock, which has none. Every positioned space therefore read as edited.
// Both halves of the fix are pinned here: positions are not content, and the
// baseline is what the editor actually loaded.
// ---------------------------------------------------------------------------
describe('a save on a classroom whose tiles have been arranged', () => {
  const HEADER = 'space_name,visit_type,Title,Event,pos_x,pos_y';
  const stock = [
    HEADER,
    'ALPHA,First,Alpha,Something happens,0,0',
    'BETA,First,Beta,Something else,0,0',
  ].join('\n');
  // What the bake serves the editor: same words, tiles moved.
  const baked = [
    HEADER,
    'ALPHA,First,Alpha,Something happens,340,120',
    'BETA,First,Beta,Something else,620,480',
  ].join('\n');

  it('mints nothing when the maintainer changed nothing', () => {
    const r = diffSubmittedContent({
      submittedSpacesCsv: baked,
      stockSpacesCsv: stock,
      baselineSpacesCsv: baked,
    });
    expect(r.changed).toEqual([]);
    expect(r.unchanged.sort()).toEqual(['ALPHA', 'BETA']);
  });

  it('still mints nothing even when compared straight against stock, because a moved tile is not a content change', () => {
    const r = diffSubmittedContent({ submittedSpacesCsv: baked, stockSpacesCsv: stock });
    expect(r.changed).toEqual([]);
  });

  it('mints a card for the one space that really changed, and only that one', () => {
    const edited = baked.replace('Something happens', 'Something the maintainer rewrote');
    const r = diffSubmittedContent({
      submittedSpacesCsv: edited,
      stockSpacesCsv: stock,
      baselineSpacesCsv: baked,
    });
    expect(r.changed.map(c => c.slot)).toEqual(['ALPHA']);
    expect(r.unchanged).toEqual(['BETA']);
  });
});

// ===== What a TEACHER is allowed to change (v3.2.41) =====
//
// The maintainer settled the shape on 2026-08-25: no school/group shelf. A
// teacher's save writes their own classroom's card and may only change what a
// space SAYS. These pin the enforcement — the client's SAFE_FIELD_SUBSET is
// presentation, and a client can be edited by whoever is holding it.
//
// The load-bearing property is that every result row is rebuilt FROM THE
// BASELINE. A test that only checked "the destination did not change" would
// pass against a weaker implementation that special-cased a few known columns;
// these check that a column nobody has ever heard of is structural too.

describe('restrictChangesToWording', () => {
  const changedRow = (over: Record<string, string> = {}) => ({
    space_name: 'BETA-MIDDLE',
    phase: 'SETUP',
    visit_type: 'First',
    Title: 'Middle',
    Event: 'Mid.',
    Action: 'Go',
    Outcome: 'Done',
    Time: '2',
    Fee: '50',
    space_1: 'ZETA-END',
    ...over,
  });

  const restrict = (rows: Array<Record<string, string>>) =>
    restrictChangesToWording({
      changed: [{ slot: 'BETA-MIDDLE', rows }],
      baselineSpacesCsv: STOCK_SPACES,
      baselineDiceCsv: STOCK_DICE,
      baselineModalCsv: STOCK_MODAL,
      ...stock,
    });

  it('keeps a wording edit', () => {
    const out = restrict([changedRow({ Event: 'A story in our own words.' })]);
    expect(out).toHaveLength(1);
    expect(out[0].slot).toBe('BETA-MIDDLE');
    expect(out[0].rows[0].Event).toBe('A story in our own words.');
  });

  it('keeps a Time or Fee edit — the cost is part of what a space says', () => {
    const out = restrict([changedRow({ Time: '9', Fee: '999' })]);
    expect(out).toHaveLength(1);
    expect(out[0].rows[0].Time).toBe('9');
    expect(out[0].rows[0].Fee).toBe('999');
  });

  it('throws away a re-routed destination and mints nothing for it', () => {
    // Structure only: after restriction this change asks for nothing.
    const out = restrict([changedRow({ space_1: 'ALPHA-START' })]);
    expect(out).toEqual([]);
  });

  it('keeps the wording but reverts the routing when a payload changes both', () => {
    const out = restrict([changedRow({ Event: 'Rewritten.', space_1: 'ALPHA-START' })]);
    expect(out).toHaveLength(1);
    expect(out[0].rows[0].Event).toBe('Rewritten.');
    expect(out[0].rows[0].space_1).toBe('ZETA-END');
  });

  it('treats a column it has never heard of as structural, not editable', () => {
    // The point of rebuilding from the baseline: a column added to Spaces.csv
    // later is refused by default rather than editable by default.
    const out = restrict([changedRow({ Event: 'Rewritten.', brand_new_column: 'smuggled' })]);
    expect(out).toHaveLength(1);
    expect(out[0].rows[0].brand_new_column).toBeUndefined();
  });

  it('cannot add a visit row the baseline does not have', () => {
    const out = restrict([
      changedRow({ Event: 'Rewritten.' }),
      changedRow({ visit_type: 'Third', Event: 'Invented.' }),
    ]);
    expect(out[0].rows.map(r => r.visit_type)).toEqual(['First', 'Subsequent']);
  });

  it('cannot delete a visit row by omitting it', () => {
    // BETA-MIDDLE has First and Subsequent in the baseline; submit only First.
    const out = restrict([changedRow({ Event: 'Rewritten.' })]);
    expect(out[0].rows.map(r => r.visit_type)).toEqual(['First', 'Subsequent']);
    expect(out[0].rows[1].Event).toBe('Again.');
  });

  it('carries the baseline dice and modal rows rather than dropping them', () => {
    // Dropping is not neutral: a card with no diceRows key falls back to STOCK
    // at bake, so a wording edit would silently revert dice already changed.
    const out = restrict([changedRow({ Event: 'Rewritten.' })]);
    expect(out[0].diceRows).toHaveLength(1);
    expect(out[0].diceRows[0].space_name).toBe('BETA-MIDDLE');
    expect(out[0].modalRows).toEqual([]);
  });

  it('ignores dice rows the teacher submitted — a teacher does not author outcomes', () => {
    const out = restrictChangesToWording({
      changed: [{
        slot: 'BETA-MIDDLE',
        rows: [changedRow({ Event: 'Rewritten.' })],
        diceRows: [{ space_name: 'BETA-MIDDLE', die_roll: 'Next Step', visit_type: 'First', 1: 'ALPHA-START' }],
      }],
      baselineSpacesCsv: STOCK_SPACES,
      baselineDiceCsv: STOCK_DICE,
      baselineModalCsv: STOCK_MODAL,
      ...stock,
    });
    expect(out[0].diceRows[0]['1']).toBe('ZETA-END');
  });

  it('drops a change whose wording already matches the baseline', () => {
    expect(restrict([changedRow()])).toEqual([]);
  });

  it('refuses a slot the baseline has no row for, rather than trusting the payload', () => {
    const out = restrictChangesToWording({
      changed: [{ slot: 'GHOST', rows: [changedRow({ space_name: 'GHOST' })] }],
      baselineSpacesCsv: STOCK_SPACES,
      baselineDiceCsv: STOCK_DICE,
      baselineModalCsv: STOCK_MODAL,
      ...stock,
    });
    expect(out).toEqual([]);
  });

  it('falls back to stock when the classroom has never been baked', () => {
    const out = restrictChangesToWording({
      changed: [{ slot: 'BETA-MIDDLE', rows: [changedRow({ Event: 'Rewritten.' })] }],
      ...stock,
    });
    expect(out).toHaveLength(1);
    expect(out[0].rows[0].Event).toBe('Rewritten.');
    expect(out[0].rows[0].space_1).toBe('ZETA-END');
  });

  it('lists exactly the six editable columns', () => {
    // If this list grows, it is a decision about what a teacher may change —
    // not a refactor. Pinned so it cannot drift quietly.
    expect([...TEACHER_EDITABLE_COLUMNS]).toEqual(
      ['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee']
    );
  });
});
