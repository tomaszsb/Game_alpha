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
  bakeInstance,
  ensureFreshBake,
  readBakeStamp,
  isBakeFresh,
  sweepBakeDebris,
  resolvedDir,
} from '../../server/instanceResolver.js';
import { createInstance, saveInstance } from '../../server/instanceStore.js';
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
