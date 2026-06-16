// tests/server/instanceResolver.test.ts
// Teacher instance layer Phase 1 — baking. Pins the spec invariants:
// deterministic stock versioning, positions overlaid into baked output,
// atomic directory swap (no .new/.stale debris), version-stamped output,
// on-demand rebake only when stale, slot names as the only identifiers.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  computeStockVersion,
  applyPositionsToSpacesCsv,
  applyConfigToSpacesCsv,
  applyConfigToDiceCsv,
  scrubSpaceReferences,
  bakeInstance,
  ensureFreshBake,
  readBakeStamp,
  isBakeFresh,
  sweepBakeDebris,
  resolvedDir,
} from '../../server/instanceResolver.js';
import { createInstance, saveInstance, createTeacherCopy, setSlotUsed, addInsertion } from '../../server/instanceStore.js';
import { parseCsvWithHeaders } from '../../server/processGameData.js';

let tmp: string;
let stockDir: string;
let instancesRoot: string;

// Minimal but real stock: enough columns for processGameData to produce
// MOVEMENT/GAME_CONFIG/SPACE_CONTENT, plus a manually-curated CLEAN file
// that the bake must carry over untouched.
const SPACES_CSV = [
  'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,pos_x,pos_y',
  'START-SPACE,SETUP,First,Start,You begin.,Do a thing,Done,,,,,,1,0,NEXT-SPACE,,,,,NO,NO,Main,100,200',
  'START-SPACE,SETUP,Subsequent,Start,Back again.,Do a thing,Done,,,,,,1,0,NEXT-SPACE,,,,,NO,NO,Main,100,200',
  'NEXT-SPACE,SETUP,First,Next,You arrive.,Do more,Done,,,,,,1,0,,,,,,NO,NO,Main,300,400',
  'NEXT-SPACE,SETUP,Subsequent,Next,Arrived again.,Do more,Done,,,,,,1,0,,,,,,NO,NO,Main,300,400',
].join('\n') + '\n';

const DICE_CSV = 'space_name,visit_type,die_roll,1,2,3,4,5,6\n';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-'));
  stockDir = path.join(tmp, 'stock');
  instancesRoot = path.join(tmp, 'instances');
  fs.mkdirSync(path.join(stockDir, 'SOURCE_FILES'), { recursive: true });
  fs.mkdirSync(path.join(stockDir, 'CLEAN_FILES'), { recursive: true });
  fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'Spaces.csv'), SPACES_CSV);
  fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'DiceRoll Info.csv'), DICE_CSV);
  // A curated CLEAN file processGameData does NOT generate — must survive.
  fs.writeFileSync(path.join(stockDir, 'CLEAN_FILES', 'GLOSSARY.csv'), 'term,definition\nDOB,Department of Buildings\n');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('computeStockVersion', () => {
  it('is deterministic and changes when any stock file changes', () => {
    const v1 = computeStockVersion(stockDir);
    expect(computeStockVersion(stockDir)).toBe(v1);
    fs.appendFileSync(path.join(stockDir, 'CLEAN_FILES', 'GLOSSARY.csv'), 'FDNY,Fire Department\n');
    expect(computeStockVersion(stockDir)).not.toBe(v1);
  });
});

describe('applyPositionsToSpacesCsv', () => {
  it('overlays slot positions onto every visit row of the space', () => {
    const out = applyPositionsToSpacesCsv(SPACES_CSV, {
      'NEXT-SPACE': { used: true, pos_x: '999', pos_y: '-7' },
    });
    const rows = parseCsvWithHeaders(out).filter(r => r.space_name === 'NEXT-SPACE');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.pos_x).toBe('999');
      expect(row.pos_y).toBe('-7');
    }
    // Untouched space keeps stock coordinates.
    const start = parseCsvWithHeaders(out).find(r => r.space_name === 'START-SPACE');
    expect(start!.pos_x).toBe('100');
  });

  it('ignores slot names that do not exist in stock', () => {
    const out = applyPositionsToSpacesCsv(SPACES_CSV, { 'GHOST-SPACE': { pos_x: '1', pos_y: '1' } });
    expect(parseCsvWithHeaders(out)).toHaveLength(4);
  });
});

describe('bakeInstance', () => {
  it('produces a complete stamped resolved set with positions applied', () => {
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    config.slots['NEXT-SPACE'] = { used: true, pos_x: '555', pos_y: '666' };
    const stockVersion = computeStockVersion(stockDir);

    const stamp = bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    expect(stamp).toMatchObject({ instanceId: 'classroom-1', configVersion: 1, stockVersion });
    const dir = resolvedDir(instancesRoot, 'classroom-1');
    // Resolved SOURCE has the overlay...
    const baked = fs.readFileSync(path.join(dir, 'SOURCE_FILES', 'Spaces.csv'), 'utf-8');
    const next = parseCsvWithHeaders(baked).find(r => r.space_name === 'NEXT-SPACE');
    expect(next!.pos_x).toBe('555');
    // ...generated CLEAN files exist and carry the position into GAME_CONFIG...
    const gameConfig = fs.readFileSync(path.join(dir, 'CLEAN_FILES', 'GAME_CONFIG.csv'), 'utf-8');
    const gcNext = parseCsvWithHeaders(gameConfig).find(r => r.space_name === 'NEXT-SPACE');
    expect(gcNext!.pos_x).toBe('555');
    // ...curated CLEAN files are carried over untouched...
    expect(fs.readFileSync(path.join(dir, 'CLEAN_FILES', 'GLOSSARY.csv'), 'utf-8')).toContain('Department of Buildings');
    // ...and slot names stay the only identifiers (no copy ids anywhere).
    expect(baked).not.toContain('copy');
  });

  it('swaps atomically: no .new/.stale debris and old output fully replaced', () => {
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });
    // Second bake replaces the first.
    config.slots['START-SPACE'] = { used: true, pos_x: '1', pos_y: '2' };
    saveInstance(instancesRoot, config);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const entries = fs.readdirSync(path.join(instancesRoot, 'classroom-1'));
    expect(entries.sort()).toEqual(['config.json', 'resolved']);
    expect(readBakeStamp(instancesRoot, 'classroom-1')!.configVersion).toBe(2);
  });

  it('cleans up and leaves the old resolved set intact when baking fails', () => {
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    // Corrupt the stock so the next bake throws mid-way.
    fs.rmSync(path.join(stockDir, 'SOURCE_FILES', 'DiceRoll Info.csv'));
    expect(() => bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion }))
      .toThrow();

    // Old resolved output still complete and stamped; no debris.
    expect(readBakeStamp(instancesRoot, 'classroom-1')).not.toBeNull();
    const entries = fs.readdirSync(path.join(instancesRoot, 'classroom-1'));
    expect(entries.sort()).toEqual(['config.json', 'resolved']);
  });
});

describe('ensureFreshBake', () => {
  it('bakes when stale, skips when fresh, rebakes on config change', () => {
    const config = createInstance(instancesRoot, { id: 'classroom-1' });

    const first = ensureFreshBake({ stockDataDir: stockDir, instancesRoot, config });
    expect(first.rebaked).toBe(true);

    const second = ensureFreshBake({ stockDataDir: stockDir, instancesRoot, config });
    expect(second.rebaked).toBe(false);

    saveInstance(instancesRoot, config); // bumps configVersion
    const third = ensureFreshBake({ stockDataDir: stockDir, instancesRoot, config });
    expect(third.rebaked).toBe(true);
    expect(third.stamp.configVersion).toBe(config.configVersion);
  });

  it('rebakes when the stock deck changes (the data-deploy gap, dead)', () => {
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    ensureFreshBake({ stockDataDir: stockDir, instancesRoot, config });

    // A "deploy": stock content changes.
    fs.writeFileSync(
      path.join(stockDir, 'SOURCE_FILES', 'Spaces.csv'),
      SPACES_CSV.replace('You begin.', 'You begin anew.')
    );
    const result = ensureFreshBake({ stockDataDir: stockDir, instancesRoot, config });
    expect(result.rebaked).toBe(true);
    const baked = fs.readFileSync(
      path.join(resolvedDir(instancesRoot, 'classroom-1'), 'SOURCE_FILES', 'Spaces.csv'),
      'utf-8'
    );
    expect(baked).toContain('You begin anew.');
  });
});

// ===== Phase 2: copies, switch-off, detours =====

const P2_HEADER =
  'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,' +
  'space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,pos_x,pos_y,' +
  'is_starting_space,is_ending_space,is_resume_hub,path_choice_memory_key,is_path_choice_lock_point';

const P2_SPACES = [
  P2_HEADER,
  'ALPHA-START,SETUP,First,Start,Begin.,Go,Done,,,,,,1,0,BETA-MIDDLE,,,,,NO,NO,Main,0,0,Yes,No,No,,No',
  'BETA-MIDDLE,SETUP,First,Middle,Mid.,Go,Done,,,,,,1,0,GAMMA-FORK,,,,,NO,NO,Main,100,0,No,No,No,,No',
  'BETA-MIDDLE,SETUP,Subsequent,Middle,Again.,Go,Done,,,,,,1,0,GAMMA-FORK,,,,,NO,NO,Main,100,0,No,No,No,,No',
  'GAMMA-FORK,SETUP,First,Fork,Roll it.,Go,Done,,,,,,1,0,DELTA-LEFT,EPSILON-RIGHT,,,,NO,YES,Main,200,0,No,No,No,,No',
  'DELTA-LEFT,SETUP,First,Left,Left.,Go,Done,,,,,,1,0,ZETA-END,,,,,NO,NO,Main,300,0,No,No,No,,No',
  'EPSILON-RIGHT,SETUP,First,Right,Right.,Go,Done,,,,,,1,0,ZETA-END,,,,,NO,NO,Main,300,100,No,No,No,,No',
  'ZETA-END,SETUP,First,End,Fin.,Go,Done,,,,,,1,0,,,,,,NO,NO,Main,400,0,No,Yes,No,,No',
].join('\n') + '\n';

const P2_DICE =
  'space_name,die_roll,visit_type,1,2,3,4,5,6\n' +
  'GAMMA-FORK,Next Step,First,DELTA-LEFT,DELTA-LEFT,DELTA-LEFT or EPSILON-RIGHT,EPSILON-RIGHT,EPSILON-RIGHT,EPSILON-RIGHT\n';

const P2_DICE_OUTCOMES =
  'space_name,visit_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6\n' +
  'GAMMA-FORK,First,DELTA-LEFT,DELTA-LEFT,DELTA-LEFT or EPSILON-RIGHT,EPSILON-RIGHT,EPSILON-RIGHT,EPSILON-RIGHT\n' +
  'DELTA-LEFT,First,ZETA-END,ZETA-END,ZETA-END,ZETA-END,ZETA-END,ZETA-END\n';

function setupPhase2Stock() {
  fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'Spaces.csv'), P2_SPACES);
  fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'DiceRoll Info.csv'), P2_DICE);
  fs.writeFileSync(path.join(stockDir, 'CLEAN_FILES', 'DICE_OUTCOMES.csv'), P2_DICE_OUTCOMES);
}

function readResolved(rel: string) {
  return fs.readFileSync(path.join(resolvedDir(instancesRoot, 'classroom-1'), rel), 'utf-8');
}

describe('Phase 2 bake: switch-off + detours', () => {
  it('removes the off space from every resolved file and detours all references', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    setSlotUsed(config, 'DELTA-LEFT', false); // pass-through → ZETA-END
    const stockVersion = computeStockVersion(stockDir);

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    // INVARIANT: no resolved file references the off space — any file.
    const base = resolvedDir(instancesRoot, 'classroom-1');
    for (const sub of ['SOURCE_FILES', 'CLEAN_FILES']) {
      for (const file of fs.readdirSync(path.join(base, sub))) {
        const text = fs.readFileSync(path.join(base, sub, file), 'utf-8');
        expect(text, `${sub}/${file} still references DELTA-LEFT`).not.toContain('DELTA-LEFT');
      }
    }

    // Detoured: GAMMA's destination cells now point at ZETA-END, and the
    // "DELTA-LEFT or EPSILON-RIGHT" compound was rewritten (not collapsed —
    // targets differ).
    const dice = readResolved('SOURCE_FILES/DiceRoll Info.csv');
    expect(dice).toContain('ZETA-END or EPSILON-RIGHT');
    const outcomes = readResolved('CLEAN_FILES/DICE_OUTCOMES.csv');
    expect(outcomes).toContain('ZETA-END or EPSILON-RIGHT');
    // DELTA-LEFT's own outcome row is gone entirely.
    expect(outcomes.split('\n').filter(l => l.trim()).length).toBe(2); // header + GAMMA

    // The board no longer carries the tile.
    expect(readResolved('CLEAN_FILES/GAME_CONFIG.csv')).not.toContain('DELTA-LEFT');

    // The validation report ships with the bake.
    const report = JSON.parse(readResolved('validation-report.json'));
    expect(report.ok).toBe(true);
    expect(report.detours).toEqual({ 'DELTA-LEFT': 'ZETA-END' });
  });

  it('collapses "A or B" when both branches detour to the same target', () => {
    const out = applyConfigToDiceCsv(
      'space_name,die_roll,visit_type,1,2,3,4,5,6\n' +
      'GAMMA-FORK,Next Step,First,DELTA-LEFT or ZETA-END,,,,,\n',
      { slots: { 'DELTA-LEFT': { used: false } }, teacherCopies: {}, detours: {} },
      { 'DELTA-LEFT': 'ZETA-END' }
    );
    expect(out).toContain(',ZETA-END,');
    expect(out).not.toContain('or');
  });

  it('refuses to bake a config that fails validation (protected space off)', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    setSlotUsed(config, 'ALPHA-START', false); // structural — forbidden
    const stockVersion = computeStockVersion(stockDir);

    let thrown: any = null;
    try {
      bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.report?.errors?.[0]).toMatchObject({ code: 'PROTECTED_SPACE', space: 'ALPHA-START' });
    // Nothing half-baked left behind.
    expect(fs.existsSync(resolvedDir(instancesRoot, 'classroom-1'))).toBe(false);
  });
});

describe('Phase 2 bake: teacher copies', () => {
  it('substitutes the copy content under the slot name — copy ids never leak', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);
    const stockRows = [
      { space_name: 'BETA-MIDDLE', visit_type: 'First', Title: 'Middle', Event: 'Mid.' },
      { space_name: 'BETA-MIDDLE', visit_type: 'Subsequent', Title: 'Middle', Event: 'Again.' },
    ];
    const copyId = createTeacherCopy(config, {
      slotName: 'BETA-MIDDLE',
      stockRows,
      overrides: { First: { Title: 'My custom middle', Event: 'Teacher words.' } },
      stockVersion,
    });
    expect(copyId).toBe('beta_middle_copy_1');

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const spaces = readResolved('SOURCE_FILES/Spaces.csv');
    expect(spaces).toContain('My custom middle');
    expect(spaces).toContain('Teacher words.');
    // Subsequent row untouched by the override.
    expect(spaces).toContain('Again.');
    // Slot name is the identifier everywhere; the copy id appears nowhere.
    const base = resolvedDir(instancesRoot, 'classroom-1');
    for (const sub of ['SOURCE_FILES', 'CLEAN_FILES']) {
      for (const file of fs.readdirSync(path.join(base, sub))) {
        expect(fs.readFileSync(path.join(base, sub, file), 'utf-8')).not.toContain('beta_middle_copy_1');
      }
    }
    expect(readResolved('CLEAN_FILES/SPACE_CONTENT.csv')).toContain('BETA-MIDDLE');
  });

  it('aligns structure automatically: columns the copy predates come from current stock', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);
    // A copy made before the Action column existed (sparse rows).
    config.teacherCopies['beta_middle_copy_1'] = {
      slot: 'BETA-MIDDLE',
      createdAt: 'x', updatedAt: 'x', copiedFromStockVersion: 'old',
      rows: { First: { space_name: 'BETA-MIDDLE', visit_type: 'First', Title: 'Old-school copy' } },
    };
    config.slots['BETA-MIDDLE'] = { used: true, card: 'beta_middle_copy_1' };

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const spaces = readResolved('SOURCE_FILES/Spaces.csv');
    const betaFirst = spaces.split('\n').find(l => l.startsWith('BETA-MIDDLE,SETUP,First'));
    expect(betaFirst).toBeDefined();
    expect(betaFirst).toContain('Old-school copy'); // teacher's meaning kept
    expect(betaFirst).toContain('GAMMA-FORK');       // structure from stock
    // And the report carries both hints.
    const report = JSON.parse(readResolved('validation-report.json'));
    expect(report.warnings.some((w: any) => w.code === 'COPY_SCHEMA_DRIFT')).toBe(true);
    expect(report.warnings.some((w: any) => w.code === 'COPY_STOCK_UPDATED')).toBe(true);
  });
});

// ===== Phase 4a: teacher-authored insertions =====

describe('Phase 4a bake: teacher-authored insertions', () => {
  it('splices an authored space onto a fixed edge and rewires movement', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const id = addInsertion(config, {
      from: 'BETA-MIDDLE',
      to: 'GAMMA-FORK',
      displayName: 'Community Board Review',
      story: 'The community weighs in.',
      time: '3',
      fee: '5000',
      pos_x: '150',
      pos_y: '50',
    });
    expect(id).toBe('auth-classroom-1-1');
    const stockVersion = computeStockVersion(stockDir);

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const rows = parseCsvWithHeaders(readResolved('SOURCE_FILES/Spaces.csv'));
    // BETA-MIDDLE now routes through the authored space, not straight to GAMMA-FORK.
    for (const visit of ['First', 'Subsequent']) {
      const beta = rows.find(r => r.space_name === 'BETA-MIDDLE' && r.visit_type === visit);
      expect(beta!.space_1).toBe(id);
    }
    // The authored space exists, mirrors BETA's visit rows, and flows on to GAMMA-FORK.
    const authored = rows.filter(r => r.space_name === id);
    expect(authored).toHaveLength(2);
    const first = authored.find(r => r.visit_type === 'First')!;
    expect(first.space_1).toBe('GAMMA-FORK');
    expect(first.space_2).toBe('');
    expect(first.Title).toBe('Community Board Review');
    expect(first.Event).toBe('The community weighs in.');
    expect(first.Time).toBe('3');
    expect(first.Fee).toBe('5000');
    expect(String(first.requires_dice_roll).toUpperCase()).toBe('NO');
    // Subsequent visit does not re-charge the flat effects.
    const sub = authored.find(r => r.visit_type === 'Subsequent')!;
    expect(sub.Time).toBe('0');
    expect(sub.Fee).toBe('0');

    // It flows through processGameData into the served board.
    expect(readResolved('CLEAN_FILES/MOVEMENT.csv')).toContain(id);
    const gc = parseCsvWithHeaders(readResolved('CLEAN_FILES/GAME_CONFIG.csv')).find(r => r.space_name === id);
    expect(gc).toBeDefined();
    expect(gc!.pos_x).toBe('150');

    expect(JSON.parse(readResolved('validation-report.json')).ok).toBe(true);
  });

  it('refuses to bake an insertion on a dice edge (4b, not 4a)', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    addInsertion(config, { from: 'GAMMA-FORK', to: 'DELTA-LEFT', displayName: 'Too soon' });
    const stockVersion = computeStockVersion(stockDir);

    let thrown: any = null;
    try {
      bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.report.errors.some((e: any) => e.code === 'INSERT_ON_DICE_EDGE')).toBe(true);
    expect(fs.existsSync(resolvedDir(instancesRoot, 'classroom-1'))).toBe(false);
  });

  it('rejects an insertion whose A→B edge does not exist', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    addInsertion(config, { from: 'BETA-MIDDLE', to: 'ZETA-END', displayName: 'No such edge' });
    const stockVersion = computeStockVersion(stockDir);

    let thrown: any = null;
    try {
      bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.report.errors.some((e: any) => e.code === 'INSERT_EDGE_MISSING')).toBe(true);
  });

  it('rejects an insertion whose endpoint is switched off', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    setSlotUsed(config, 'BETA-MIDDLE', false);
    addInsertion(config, { from: 'BETA-MIDDLE', to: 'GAMMA-FORK', displayName: 'Orphaned' });
    const stockVersion = computeStockVersion(stockDir);

    let thrown: any = null;
    try {
      bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.report.errors.some((e: any) => e.code === 'INSERT_ENDPOINT_OFF')).toBe(true);
  });
});

describe('scrubSpaceReferences', () => {
  it('drops keyed rows and rewrites references in every column', () => {
    const out = scrubSpaceReferences(
      'space_name,visit_type,note\n' +
      'OFF-SPACE,First,whatever\n' +
      'KEPT-SPACE,First,go to OFF-SPACE next\n',
      new Set(['OFF-SPACE']),
      { 'OFF-SPACE': 'TARGET-SPACE' }
    );
    expect(out).not.toContain('OFF-SPACE');
    expect(out).toContain('go to TARGET-SPACE next');
    expect(out).toContain('KEPT-SPACE');
  });
});

describe('isBakeFresh / sweepBakeDebris', () => {
  it('treats missing or mismatched stamps as stale', () => {
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    expect(isBakeFresh(null, config, 'v')).toBe(false);
    expect(isBakeFresh({ configVersion: 1, stockVersion: 'other' }, config, 'v')).toBe(false);
    expect(isBakeFresh({ configVersion: 2, stockVersion: 'v' }, config, 'v')).toBe(false);
    expect(isBakeFresh({ configVersion: 1, stockVersion: 'v' }, config, 'v')).toBe(true);
  });

  it('removes crashed-bake debris directories', () => {
    createInstance(instancesRoot, { id: 'classroom-1' });
    const dir = path.join(instancesRoot, 'classroom-1');
    fs.mkdirSync(path.join(dir, 'resolved.new-123-456'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'resolved.stale-123-456'), { recursive: true });
    sweepBakeDebris(instancesRoot, 'classroom-1');
    expect(fs.readdirSync(dir)).toEqual(['config.json']);
  });
});
