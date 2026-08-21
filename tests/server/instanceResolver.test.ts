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
  applyCopyDiceToOutcomesCsv,
  copyDiceRowsBySpace,
  applyConfigToModalCsv,
  copyModalRowsBySpace,
  applyCopyLogicToQuestionsCsv,
  copyLogicRowsBySpace,
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
  // maxRetries/retryDelay: Windows-only mitigation for a transient
  // ENOTEMPTY/EPERM/EBUSY teardown race seen under full-suite parallel
  // Vitest workers (antivirus/indexer briefly holding a handle on a file
  // that was just written or renamed inside this temp dir). Retries with
  // linear backoff before giving up; no effect on a clean removal.
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
    expect(id).toBe('AUTH-CLASSROOM-1-1');
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
    // Clean build (allowlist): populated columns on the SOURCE row (Action/Outcome
    // here; funding_source/auto_apply_funding against real stock) must NOT leak —
    // the authored space is a blank pass-through, not a copy of A. (The fixture's
    // P2_HEADER has no display_label_override column, so the label round-trip is
    // verified against real stock, not here.)
    expect(first.Action).toBe('');
    expect(first.Outcome).toBe('');
    // Subsequent visit does not re-charge the flat effects.
    const sub = authored.find(r => r.visit_type === 'Subsequent')!;
    expect(sub.Time).toBe('0');
    expect(sub.Fee).toBe('0');

    // It flows through processGameData into the served board — and crucially the
    // SOURCE space's regenerated movement actually routes TO the authored id.
    // (A lowercase id would be dropped by isValidSpaceName, collapsing this row
    // to movement_type 'none' with no destination — the 4a soft-lock. A plain
    // `.toContain(id)` would still pass on the authored space's OWN row, so it
    // must assert the rewired source edge specifically.)
    const movement = parseCsvWithHeaders(readResolved('CLEAN_FILES/MOVEMENT.csv'));
    const betaMove = movement.find(r => r.space_name === 'BETA-MIDDLE' && r.visit_type === 'First');
    expect(betaMove!.movement_type).toBe('fixed');
    expect(betaMove!.destination_1).toBe(id);
    const authMove = movement.find(r => r.space_name === id && r.visit_type === 'First');
    expect(authMove!.movement_type).toBe('fixed');
    expect(authMove!.destination_1).toBe('GAMMA-FORK');
    const gc = parseCsvWithHeaders(readResolved('CLEAN_FILES/GAME_CONFIG.csv')).find(r => r.space_name === id);
    expect(gc).toBeDefined();
    expect(gc!.pos_x).toBe('150');

    expect(JSON.parse(readResolved('validation-report.json')).ok).toBe(true);
  });

  it('auto-places the authored tile at the spliced edge midpoint when no position is given', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    // No pos_x/pos_y — the resolver must auto-place, never inherit A's coords
    // (inheriting put the tile on top of A — the overlap found verifying 4a).
    const id = addInsertion(config, { from: 'BETA-MIDDLE', to: 'GAMMA-FORK', displayName: 'Hearing' });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const gc = parseCsvWithHeaders(readResolved('CLEAN_FILES/GAME_CONFIG.csv')).find(r => r.space_name === id);
    // Midpoint of BETA-MIDDLE (100,0) and GAMMA-FORK (200,0).
    expect(gc!.pos_x).toBe('150');
    expect(gc!.pos_y).toBe('0');
    // Distinct from BETA's own position — not stacked on top of it.
    const beta = parseCsvWithHeaders(readResolved('CLEAN_FILES/GAME_CONFIG.csv')).find(r => r.space_name === 'BETA-MIDDLE');
    expect(`${gc!.pos_x},${gc!.pos_y}`).not.toBe(`${beta!.pos_x},${beta!.pos_y}`);
  });

  it('splices an authored space onto a DICE edge (4b) and rewires the dice outcomes', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    // GAMMA-FORK is a dice source; its rolls route to DELTA-LEFT / EPSILON-RIGHT.
    // Splice the authored space onto the GAMMA→DELTA-LEFT dice edge.
    const id = addInsertion(config, { from: 'GAMMA-FORK', to: 'DELTA-LEFT', displayName: 'Roll Detour' });
    expect(id).toBe('AUTH-CLASSROOM-1-1');
    const stockVersion = computeStockVersion(stockDir);

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    // SOURCE dice table: every roll that went to DELTA-LEFT now routes through
    // the authored id; the "DELTA-LEFT or EPSILON-RIGHT" compound is rewritten;
    // the EPSILON-RIGHT branch is untouched.
    const dice = parseCsvWithHeaders(readResolved('SOURCE_FILES/DiceRoll Info.csv'));
    const gammaDice = dice.find(r => r.space_name === 'GAMMA-FORK')!;
    expect(gammaDice['1']).toBe(id);
    expect(gammaDice['2']).toBe(id);
    expect(gammaDice['3']).toBe(`${id} or EPSILON-RIGHT`);
    expect(gammaDice['4']).toBe('EPSILON-RIGHT');

    // The load-bearing part: the CURATED DICE_OUTCOMES.csv (read directly by the
    // client for dice movement, NOT regenerated by processGameData) is rewritten
    // too — otherwise the splice would be functionally dead.
    const outcomes = parseCsvWithHeaders(readResolved('CLEAN_FILES/DICE_OUTCOMES.csv'));
    const gammaOut = outcomes.find(r => r.space_name === 'GAMMA-FORK')!;
    expect(gammaOut.roll_1).toBe(id);
    expect(gammaOut.roll_3).toBe(`${id} or EPSILON-RIGHT`);
    expect(gammaOut.roll_4).toBe('EPSILON-RIGHT');
    // DELTA-LEFT's own outcome row (it is still an active space) is untouched.
    expect(outcomes.find(r => r.space_name === 'DELTA-LEFT')!.roll_1).toBe('ZETA-END');

    // GAMMA-FORK stays a dice space; the authored space mirrors A's visit rows
    // (GAMMA-FORK has only a First row here) as a fixed pass-through to DELTA-LEFT.
    const rows = parseCsvWithHeaders(readResolved('SOURCE_FILES/Spaces.csv'));
    const authored = rows.filter(r => r.space_name === id);
    expect(authored).toHaveLength(1);
    expect(authored.find(r => r.visit_type === 'First')!.space_1).toBe('DELTA-LEFT');
    expect(String(authored[0].requires_dice_roll).toUpperCase()).toBe('NO');

    const movement = parseCsvWithHeaders(readResolved('CLEAN_FILES/MOVEMENT.csv'));
    expect(movement.find(r => r.space_name === 'GAMMA-FORK' && r.visit_type === 'First')!.movement_type).toBe('dice');
    const authMove = movement.find(r => r.space_name === id && r.visit_type === 'First')!;
    expect(authMove.movement_type).toBe('fixed');
    expect(authMove.destination_1).toBe('DELTA-LEFT');

    expect(JSON.parse(readResolved('validation-report.json')).ok).toBe(true);
  });

  it('refuses to bake a dice-edge insertion whose B is not a real outcome of A', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    // GAMMA-FORK never rolls to ZETA-END — no such dice outcome to splice into.
    addInsertion(config, { from: 'GAMMA-FORK', to: 'ZETA-END', displayName: 'No such roll' });
    const stockVersion = computeStockVersion(stockDir);

    let thrown: any = null;
    try {
      bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.report.errors.some((e: any) => e.code === 'INSERT_EDGE_MISSING')).toBe(true);
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

  it('populates the card-draw columns on the authored space and auto-triggers (slice 2)', () => {
    // Inline stock with the card / narrative / auto-trigger columns the P2
    // fixture omits, so the auto-trigger wiring is observable.
    const header =
      'space_name,phase,visit_type,Title,Event,Time,Fee,space_1,space_2,requires_dice_roll,' +
      'e_card,e_card_narrative,auto_trigger_card_types,is_path_choice_lock_point';
    const csv = [
      header,
      'A-SPACE,SETUP,First,A,Begin,0,0,B-SPACE,,NO,,,,No',
      'B-SPACE,SETUP,First,B,Mid,0,0,,,NO,,,,No',
    ].join('\n') + '\n';
    const config: any = {
      meta: { id: 'classroom-1' }, slots: {}, teacherCopies: {}, detours: {},
      insertions: {
        'AUTH-CLASSROOM-1-1': {
          id: 'AUTH-CLASSROOM-1-1', from: 'A-SPACE', to: 'B-SPACE',
          displayName: 'Bonus', story: 'Free help!', cardDraw: { type: 'E', count: 2 },
        },
      },
    };
    const out = parseCsvWithHeaders(applyConfigToSpacesCsv(csv, config));
    const authored = out.find(r => r.space_name === 'AUTH-CLASSROOM-1-1' && r.visit_type === 'First')!;
    expect(authored.e_card).toBe('Draw 2');
    expect(authored.e_card_narrative).toBe('Free help!');
    expect(authored.auto_trigger_card_types).toBe('E'); // dealt on arrival, no manual gate
  });

  it('bakes a card-draw authored space into a draw effect processGameData picks up (slice 2)', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    addInsertion(config, { from: 'BETA-MIDDLE', to: 'GAMMA-FORK', displayName: 'Expeditor Gift', cardDraw: { type: 'E', count: 2 } });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const effects = parseCsvWithHeaders(readResolved('CLEAN_FILES/SPACE_EFFECTS.csv'));
    const draw = effects.find(r => r.space_name === 'AUTH-CLASSROOM-1-1' && r.effect_action === 'draw_E');
    expect(draw).toBeDefined();
    expect(draw!.effect_value).toBe('2');
    expect(draw!.effect_type).toBe('cards');
  });

  it('bakes a percentage fee into a LOAN_PERCENTAGE fee effect (slice 4)', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    // Percentage fee wins over any flat fee and writes "N%" into Fee.
    addInsertion(config, { from: 'BETA-MIDDLE', to: 'GAMMA-FORK', displayName: 'Financing Fee', fee: '999', feePercent: 3 });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const rows = parseCsvWithHeaders(readResolved('SOURCE_FILES/Spaces.csv'));
    expect(rows.find(r => r.space_name === 'AUTH-CLASSROOM-1-1' && r.visit_type === 'First')!.Fee).toBe('3%');

    const effects = parseCsvWithHeaders(readResolved('CLEAN_FILES/SPACE_EFFECTS.csv'));
    const fee = effects.find(r => r.space_name === 'AUTH-CLASSROOM-1-1' && r.effect_type === 'fee');
    expect(fee).toBeDefined();
    expect(fee!.effect_value).toBe('3%');
    expect(fee!.fee_type).toBe('LOAN_PERCENTAGE');
  });

  it('bakes a scope-basis percentage fee into a SCOPE_PERCENTAGE effect (slice 4)', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    addInsertion(config, { from: 'BETA-MIDDLE', to: 'GAMMA-FORK', displayName: 'Design Fee', feePercent: 5, feeBasis: 'scope' });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const rows = parseCsvWithHeaders(readResolved('SOURCE_FILES/Spaces.csv'));
    expect(rows.find(r => r.space_name === 'AUTH-CLASSROOM-1-1' && r.visit_type === 'First')!.Fee).toBe('5% of scope');

    const effects = parseCsvWithHeaders(readResolved('CLEAN_FILES/SPACE_EFFECTS.csv'));
    const fee = effects.find(r => r.space_name === 'AUTH-CLASSROOM-1-1' && r.effect_type === 'fee');
    expect(fee!.effect_value).toBe('5% of scope');
    expect(fee!.fee_type).toBe('SCOPE_PERCENTAGE');
  });

  it('bakes an authored DICE space: dice flag, DiceRoll Info + DICE_OUTCOMES rows, dice movement (slice 3)', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const outcomes = ['DELTA-LEFT', 'DELTA-LEFT', 'DELTA-LEFT', 'EPSILON-RIGHT', 'EPSILON-RIGHT', 'EPSILON-RIGHT'];
    const id = addInsertion(config, { from: 'BETA-MIDDLE', to: 'GAMMA-FORK', displayName: 'Fork in the Road', diceOutcomes: outcomes });
    const stockVersion = computeStockVersion(stockDir);
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    // BETA-MIDDLE (both visit rows) routes into the authored space.
    const spaces = parseCsvWithHeaders(readResolved('SOURCE_FILES/Spaces.csv'));
    for (const visit of ['First', 'Subsequent']) {
      expect(spaces.find(r => r.space_name === 'BETA-MIDDLE' && r.visit_type === visit)!.space_1).toBe(id);
    }
    // The authored row is a dice space (mirrors BETA's two visit rows).
    const authored = spaces.filter(r => r.space_name === id);
    expect(authored).toHaveLength(2);
    expect(authored.every(r => String(r.requires_dice_roll).toUpperCase() === 'YES')).toBe(true);

    // SOURCE DiceRoll Info row: die_roll='Next Step', the six faces in cols 1-6.
    const dice = parseCsvWithHeaders(readResolved('SOURCE_FILES/DiceRoll Info.csv'));
    const diceRow = dice.find(r => r.space_name === id && r.visit_type === 'First')!;
    expect(diceRow.die_roll).toBe('Next Step');
    expect([1, 2, 3, 4, 5, 6].map(n => diceRow[String(n)])).toEqual(outcomes);

    // Curated DICE_OUTCOMES row (what the client actually reads) per visit.
    const outRows = parseCsvWithHeaders(readResolved('CLEAN_FILES/DICE_OUTCOMES.csv'));
    expect(outRows.filter(r => r.space_name === id)).toHaveLength(2);
    const outFirst = outRows.find(r => r.space_name === id && r.visit_type === 'First')!;
    expect([1, 2, 3, 4, 5, 6].map(n => outFirst[`roll_${n}`])).toEqual(outcomes);

    // processGameData marks the authored space as dice movement.
    const movement = parseCsvWithHeaders(readResolved('CLEAN_FILES/MOVEMENT.csv'));
    expect(movement.find(r => r.space_name === id && r.visit_type === 'First')!.movement_type).toBe('dice');

    expect(JSON.parse(readResolved('validation-report.json')).ok).toBe(true);
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

// ===== Card Library stage 1b: a card owns its slot's dice outcomes =====

const GAMMA_STOCK_DICE = [
  { space_name: 'GAMMA-FORK', die_roll: 'Next Step', visit_type: 'First',
    '1': 'DELTA-LEFT', '2': 'DELTA-LEFT', '3': 'DELTA-LEFT or EPSILON-RIGHT',
    '4': 'EPSILON-RIGHT', '5': 'EPSILON-RIGHT', '6': 'EPSILON-RIGHT',
    button_label: '', roll_group: '' },
];

const GAMMA_STOCK_SPACE_ROWS = [
  { space_name: 'GAMMA-FORK', visit_type: 'First', Title: 'Fork', Event: 'Roll it.' },
];

describe('Stage 1b bake: card-owned dice outcomes', () => {
  it('a card with diceRows replaces stock in BOTH the SOURCE dice table and the curated DICE_OUTCOMES', () => {
    setupPhase2Stock();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);

    const copyId = createTeacherCopy(config, {
      slotName: 'GAMMA-FORK',
      stockRows: GAMMA_STOCK_SPACE_ROWS,
      stockDiceRows: GAMMA_STOCK_DICE,
      stockVersion,
    });
    // The teacher reworks the fork: every face now goes right.
    config.teacherCopies[copyId].diceRows = [
      { ...GAMMA_STOCK_DICE[0], '1': 'EPSILON-RIGHT', '2': 'EPSILON-RIGHT', '3': 'EPSILON-RIGHT' },
    ];

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    // SOURCE dice table: the card's rows, not stock's.
    const dice = readResolved('SOURCE_FILES/DiceRoll Info.csv');
    const diceRows = parseCsvWithHeaders(dice).filter(r => r.space_name === 'GAMMA-FORK');
    expect(diceRows).toHaveLength(1);
    expect(diceRows[0]['1']).toBe('EPSILON-RIGHT');
    expect(dice).not.toContain('DELTA-LEFT or EPSILON-RIGHT');

    // The LOAD-BEARING half: the curated DICE_OUTCOMES the client actually
    // reads for destinations. A bake that only rewrote the SOURCE table above
    // would render right and route wrong.
    const outcomes = parseCsvWithHeaders(readResolved('CLEAN_FILES/DICE_OUTCOMES.csv'));
    const gamma = outcomes.filter(r => r.space_name === 'GAMMA-FORK');
    expect(gamma).toHaveLength(1);
    expect(gamma[0].visit_type).toBe('First');
    expect([1, 2, 3, 4, 5, 6].map(f => gamma[0][`roll_${f}`]))
      .toEqual(Array(6).fill('EPSILON-RIGHT'));
    // Other spaces' curated rows are untouched.
    expect(outcomes.find(r => r.space_name === 'DELTA-LEFT')?.roll_1).toBe('ZETA-END');

    // Slot names stay the only identifiers.
    const base = resolvedDir(instancesRoot, 'classroom-1');
    for (const sub of ['SOURCE_FILES', 'CLEAN_FILES']) {
      for (const file of fs.readdirSync(path.join(base, sub))) {
        expect(fs.readFileSync(path.join(base, sub, file), 'utf-8')).not.toContain(copyId);
      }
    }
  });

  it('a card WITHOUT diceRows changes nothing — dice files byte-identical to a bake with no copy at all', () => {
    setupPhase2Stock();
    const stockVersion = computeStockVersion(stockDir);

    // Baseline: no copies at all.
    const plain = createInstance(instancesRoot, { id: 'classroom-1' });
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config: plain, stockVersion });
    const baselineDice = readResolved('SOURCE_FILES/DiceRoll Info.csv');
    const baselineOutcomes = readResolved('CLEAN_FILES/DICE_OUTCOMES.csv');

    // Same classroom, now playing a copy that owns no dice (every card
    // written before stage 1b). Absent diceRows must mean "fall back to stock".
    const config = createInstance(instancesRoot, { id: 'classroom-2' });
    createTeacherCopy(config, {
      slotName: 'GAMMA-FORK',
      stockRows: GAMMA_STOCK_SPACE_ROWS,
      overrides: { First: { Title: 'Reworded fork' } },
      stockVersion,
    });
    expect(config.teacherCopies['gamma_fork_copy_1'].diceRows).toBeUndefined();
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const withCopy = (rel: string) =>
      fs.readFileSync(path.join(resolvedDir(instancesRoot, 'classroom-2'), rel), 'utf-8');
    expect(withCopy('SOURCE_FILES/DiceRoll Info.csv')).toBe(baselineDice);
    expect(withCopy('CLEAN_FILES/DICE_OUTCOMES.csv')).toBe(baselineOutcomes);
    // The Spaces.csv override still landed — the copy is doing its old job.
    expect(withCopy('SOURCE_FILES/Spaces.csv')).toContain('Reworded fork');
  });

  it('only the card the slot is PLAYING owns dice; an unplayed copy is ignored', () => {
    const config: any = {
      slots: { 'GAMMA-FORK': { used: true, card: 'played' } },
      teacherCopies: {
        played: { slot: 'GAMMA-FORK', rows: {} },
        shelved: { slot: 'GAMMA-FORK', rows: {}, diceRows: [{ ...GAMMA_STOCK_DICE[0], '1': 'NOPE' }] },
      },
      detours: {},
    };
    expect(copyDiceRowsBySpace(config).size).toBe(0);
  });

  it('card-owned dice are still detoured — the card does not escape switch-off', () => {
    const config: any = {
      slots: { 'GAMMA-FORK': { used: true, card: 'c1' }, 'DELTA-LEFT': { used: false } },
      teacherCopies: { c1: { slot: 'GAMMA-FORK', rows: {}, diceRows: GAMMA_STOCK_DICE } },
      detours: {},
    };
    const out = applyConfigToDiceCsv(P2_DICE, config, { 'DELTA-LEFT': 'ZETA-END' });
    expect(out).toContain('ZETA-END');
    expect(out).not.toContain('DELTA-LEFT');
  });

  it('drops a space from DICE_OUTCOMES when the card keeps no Next Step rows', () => {
    const config: any = {
      slots: { 'GAMMA-FORK': { used: true, card: 'c1' } },
      teacherCopies: {
        c1: {
          slot: 'GAMMA-FORK',
          rows: {},
          // Effect roll only — no movement. The space stops routing by dice.
          diceRows: [{ space_name: 'GAMMA-FORK', die_roll: 'W Cards', visit_type: 'First',
            '1': 'Draw 1', '2': 'Draw 1', '3': 'Draw 1', '4': 'Draw 1', '5': 'Draw 1', '6': 'Draw 1' }],
        },
      },
      detours: {},
    };
    const out = parseCsvWithHeaders(applyCopyDiceToOutcomesCsv(P2_DICE_OUTCOMES, config));
    expect(out.find(r => r.space_name === 'GAMMA-FORK')).toBeUndefined();
    expect(out.find(r => r.space_name === 'DELTA-LEFT')).toBeDefined();
  });

  it('is a pure pass-through when no card in the classroom owns dice', () => {
    const config: any = { slots: {}, teacherCopies: {}, detours: {} };
    expect(applyCopyDiceToOutcomesCsv(P2_DICE_OUTCOMES, config)).toBe(P2_DICE_OUTCOMES);
  });
});

// ===== Stage 1b part ii: card-owned modal copy + logic-question wording =====

const P2_MODAL =
  'space_name,visit_type,effect_action,modal_title,modal_description,modal_button_label,modal_summary,dice_value\n' +
  'BETA-MIDDLE,First,draw_B,,,Accept Bank Loan,,\n' +
  'BETA-MIDDLE,Subsequent,draw_B,,,Accept Bank Loan,,\n';

const P2_LOGIC =
  'space_name,visit_type,question_id,question_text,yes_target,no_target,auto_answer_from,yes_reason,no_reason\n' +
  'GAMMA-FORK,First,Q1,Did you pass before?,DELTA-LEFT,EPSILON-RIGHT,approved_before,Yes reason (stock).,No reason (stock).\n';

function setupPhase2StockWithModalLogic() {
  setupPhase2Stock();
  fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'ModalConfig.csv'), P2_MODAL);
  fs.writeFileSync(path.join(stockDir, 'CLEAN_FILES', 'LOGIC_QUESTIONS.csv'), P2_LOGIC);
}

describe('Stage 1b part ii bake: card-owned modal copy', () => {
  it('a card with modalRows overrides stock at bake', () => {
    setupPhase2StockWithModalLogic();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);

    const copyId = createTeacherCopy(config, {
      slotName: 'BETA-MIDDLE',
      stockRows: [{ space_name: 'BETA-MIDDLE', visit_type: 'First', Title: 'Middle' }],
      stockModalRows: parseCsvWithHeaders(P2_MODAL).filter(r => r.space_name === 'BETA-MIDDLE'),
      stockVersion,
    });
    config.teacherCopies[copyId].modalRows = config.teacherCopies[copyId].modalRows.map(
      (row: Record<string, string>) => ({ ...row, modal_button_label: 'Take the Loan' })
    );

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const modal = parseCsvWithHeaders(readResolved('SOURCE_FILES/ModalConfig.csv'));
    const beta = modal.filter(r => r.space_name === 'BETA-MIDDLE');
    expect(beta).toHaveLength(2);
    expect(beta.every(r => r.modal_button_label === 'Take the Loan')).toBe(true);

    // Slot names stay the only identifiers.
    expect(readResolved('SOURCE_FILES/ModalConfig.csv')).not.toContain(copyId);
  });

  it('a card WITHOUT modalRows or logicRows changes nothing — byte-identical to a bake with no copy at all', () => {
    setupPhase2StockWithModalLogic();
    const stockVersion = computeStockVersion(stockDir);

    const plain = createInstance(instancesRoot, { id: 'classroom-1' });
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config: plain, stockVersion });
    const baselineModal = readResolved('SOURCE_FILES/ModalConfig.csv');
    const baselineLogic = readResolved('CLEAN_FILES/LOGIC_QUESTIONS.csv');

    const config = createInstance(instancesRoot, { id: 'classroom-2' });
    createTeacherCopy(config, {
      slotName: 'GAMMA-FORK',
      stockRows: [{ space_name: 'GAMMA-FORK', visit_type: 'First', Title: 'Fork' }],
      overrides: { First: { Title: 'Reworded fork' } },
      stockVersion,
    });
    expect(config.teacherCopies['gamma_fork_copy_1'].modalRows).toBeUndefined();
    expect(config.teacherCopies['gamma_fork_copy_1'].logicRows).toBeUndefined();
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const withCopy = (rel: string) =>
      fs.readFileSync(path.join(resolvedDir(instancesRoot, 'classroom-2'), rel), 'utf-8');
    expect(withCopy('SOURCE_FILES/ModalConfig.csv')).toBe(baselineModal);
    expect(withCopy('CLEAN_FILES/LOGIC_QUESTIONS.csv')).toBe(baselineLogic);
    // The Spaces.csv override still landed — the copy is doing its old job.
    expect(withCopy('SOURCE_FILES/Spaces.csv')).toContain('Reworded fork');
  });

  it('applyConfigToModalCsv is a pure pass-through when no card in the classroom owns modal copy', () => {
    const config: any = { slots: {}, teacherCopies: {}, detours: {} };
    expect(applyConfigToModalCsv(P2_MODAL, config)).toBe(P2_MODAL);
  });

  it('applyConfigToModalCsv: only the card the slot is PLAYING owns modal copy; an unplayed copy is ignored', () => {
    const config: any = {
      slots: { 'BETA-MIDDLE': { used: true, card: 'played' } },
      teacherCopies: {
        played: { slot: 'BETA-MIDDLE', rows: {} },
        shelved: { slot: 'BETA-MIDDLE', rows: {}, modalRows: [{ space_name: 'BETA-MIDDLE', visit_type: 'First', modal_button_label: 'NOPE' }] },
      },
    };
    expect(copyModalRowsBySpace(config).size).toBe(0);
    expect(applyConfigToModalCsv(P2_MODAL, config)).toBe(P2_MODAL);
  });
});

describe('Stage 1b part ii bake: card-owned logic-question wording (routing stays fixed)', () => {
  it('a card with logicRows changes wording but provably leaves yes_target/no_target at stock values', () => {
    setupPhase2StockWithModalLogic();
    const config = createInstance(instancesRoot, { id: 'classroom-1' });
    const stockVersion = computeStockVersion(stockDir);

    const stockLogicRows = parseCsvWithHeaders(P2_LOGIC).filter(r => r.space_name === 'GAMMA-FORK');
    const copyId = createTeacherCopy(config, {
      slotName: 'GAMMA-FORK',
      stockRows: [{ space_name: 'GAMMA-FORK', visit_type: 'First', Title: 'Fork' }],
      stockLogicRows,
      stockVersion,
    });
    // The teacher rewords the question and both reasons for their classroom.
    config.teacherCopies[copyId].logicRows = [
      { visit_type: 'First', question_id: 'Q1', question_text: 'Did you pass FDNY before, teacher edit?',
        yes_reason: 'Yes reason (teacher).', no_reason: 'No reason (teacher).' },
    ];

    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion });

    const questions = parseCsvWithHeaders(readResolved('CLEAN_FILES/LOGIC_QUESTIONS.csv'));
    const q1 = questions.find(r => r.space_name === 'GAMMA-FORK' && r.question_id === 'Q1');
    expect(q1).toBeDefined();
    // Wording changed.
    expect(q1!.question_text).toBe('Did you pass FDNY before, teacher edit?');
    expect(q1!.yes_reason).toBe('Yes reason (teacher).');
    expect(q1!.no_reason).toBe('No reason (teacher).');
    // Routing did NOT — a card cannot express a routing change, structurally.
    expect(q1!.yes_target).toBe('DELTA-LEFT');
    expect(q1!.no_target).toBe('EPSILON-RIGHT');
    expect(q1!.auto_answer_from).toBe('approved_before');

    // Slot names stay the only identifiers.
    expect(readResolved('CLEAN_FILES/LOGIC_QUESTIONS.csv')).not.toContain(copyId);
  });

  it('a card logicRows entry with no matching stock row is ignored — no row invented', () => {
    const config: any = {
      slots: { 'GAMMA-FORK': { used: true, card: 'c1' } },
      teacherCopies: {
        c1: {
          slot: 'GAMMA-FORK',
          rows: {},
          logicRows: [
            // Matches the real stock Q1.
            { visit_type: 'First', question_id: 'Q1', question_text: 'Reworded.', yes_reason: 'Y', no_reason: 'N' },
            // No such stock question — must be silently ignored, not appended.
            { visit_type: 'First', question_id: 'Q99', question_text: 'Invented question', yes_reason: 'Y', no_reason: 'N' },
          ],
        },
      },
    };
    const out = parseCsvWithHeaders(applyCopyLogicToQuestionsCsv(P2_LOGIC, config));
    expect(out).toHaveLength(1); // still just the one stock row — nothing invented
    expect(out[0].question_text).toBe('Reworded.');
    expect(out.find(r => r.question_id === 'Q99')).toBeUndefined();
  });

  it('applyCopyLogicToQuestionsCsv is a pure pass-through when no card in the classroom owns logic wording', () => {
    const config: any = { slots: {}, teacherCopies: {} };
    expect(applyCopyLogicToQuestionsCsv(P2_LOGIC, config)).toBe(P2_LOGIC);
  });

  it('applyCopyLogicToQuestionsCsv: only the card the slot is PLAYING owns logic wording; an unplayed copy is ignored', () => {
    const config: any = {
      slots: { 'GAMMA-FORK': { used: true, card: 'played' } },
      teacherCopies: {
        played: { slot: 'GAMMA-FORK', rows: {} },
        shelved: {
          slot: 'GAMMA-FORK', rows: {},
          logicRows: [{ visit_type: 'First', question_id: 'Q1', question_text: 'NOPE', yes_reason: '', no_reason: '' }],
        },
      },
    };
    expect(copyLogicRowsBySpace(config).size).toBe(0);
    expect(applyCopyLogicToQuestionsCsv(P2_LOGIC, config)).toBe(P2_LOGIC);
  });
});
