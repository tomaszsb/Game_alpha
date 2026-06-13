// tests/server/migrateInstance.test.ts
// Teacher instance layer Phase 1 — the classroom-1 migration. Pins the
// 2026-06-09 rule: positions migrate into config, everything else is stale
// content (reported, NOT migrated), and apply is idempotent.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  computeMigrationPlan,
  formatMigrationPlan,
  applyMigrationPlan,
} from '../../server/migrateInstance.js';
import { loadInstance } from '../../server/instanceStore.js';

const HEADER = 'space_name,phase,visit_type,Title,Event,pos_x,pos_y';

function csv(...rows: string[]) {
  return [HEADER, ...rows].join('\n') + '\n';
}

const STOCK = csv(
  'ALPHA-ONE,SETUP,First,Alpha,Stock event text,100,200',
  'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,100,200',
  'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
);

// CLEAN GAME_CONFIG.csv: one row per space (no visit_type), carries pos_x/pos_y.
const CONFIG_HEADER = 'space_name,phase,pos_x,pos_y';
function configCsv(...rows: string[]) {
  return [CONFIG_HEADER, ...rows].join('\n') + '\n';
}
const STOCK_CONFIG = configCsv(
  'ALPHA-ONE,SETUP,100,200',
  'BETA-TWO,SETUP,300,400',
);

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('computeMigrationPlan', () => {
  it('captures moved tiles as positions, not drift', () => {
    const live = csv(
      'ALPHA-ONE,SETUP,First,Alpha,Stock event text,-50,75',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,-50,75',
      'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
    );
    const plan = computeMigrationPlan({ liveSpacesCsv: live, stockSpacesCsv: STOCK });
    expect(plan.positions).toEqual({ 'ALPHA-ONE': { x: '-50', y: '75' } });
    expect(plan.contentDrift).toEqual([]);
  });

  it('reports stale content as drift and does NOT treat it as a customization', () => {
    const live = csv(
      'ALPHA-ONE,SETUP,First,Alpha,OLD stale wording,100,200',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,100,200',
      'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
    );
    const plan = computeMigrationPlan({ liveSpacesCsv: live, stockSpacesCsv: STOCK });
    expect(plan.positions).toEqual({});
    expect(plan.contentDrift).toEqual([
      {
        space_name: 'ALPHA-ONE',
        visit_type: 'First',
        field: 'Event',
        live: 'OLD stale wording',
        stock: 'Stock event text',
      },
    ]);
  });

  it('fills the missing axis when only one coordinate moved', () => {
    const live = csv(
      'ALPHA-ONE,SETUP,First,Alpha,Stock event text,100,999',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,100,999',
      'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
    );
    const plan = computeMigrationPlan({ liveSpacesCsv: live, stockSpacesCsv: STOCK });
    expect(plan.positions['ALPHA-ONE']).toEqual({ x: '100', y: '999' });
  });

  it('captures positions from CLEAN GAME_CONFIG even when SOURCE has stock positions', () => {
    // The 2026-06-13 fix: the legacy editor wrote positions to CLEAN
    // GAME_CONFIG.csv, not SOURCE Spaces.csv. SOURCE here still has stock
    // coords, so a SOURCE-only read would capture nothing.
    const liveConfig = configCsv(
      'ALPHA-ONE,SETUP,-50,75',
      'BETA-TWO,SETUP,300,400',
    );
    const plan = computeMigrationPlan({
      liveSpacesCsv: STOCK,
      stockSpacesCsv: STOCK,
      liveGameConfigCsv: liveConfig,
      stockGameConfigCsv: STOCK_CONFIG,
    });
    expect(plan.positions).toEqual({ 'ALPHA-ONE': { x: '-50', y: '75' } });
    expect(plan.contentDrift).toEqual([]);
  });

  it('lets CLEAN GAME_CONFIG positions win over SOURCE on conflict', () => {
    const liveSpaces = csv(
      'ALPHA-ONE,SETUP,First,Alpha,Stock event text,11,22',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,11,22',
      'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
    );
    const liveConfig = configCsv(
      'ALPHA-ONE,SETUP,-50,75',
      'BETA-TWO,SETUP,300,400',
    );
    const plan = computeMigrationPlan({
      liveSpacesCsv: liveSpaces,
      stockSpacesCsv: STOCK,
      liveGameConfigCsv: liveConfig,
      stockGameConfigCsv: STOCK_CONFIG,
    });
    expect(plan.positions).toEqual({ 'ALPHA-ONE': { x: '-50', y: '75' } });
  });

  it('reports live-only and stock-only spaces', () => {
    const live = csv(
      'ALPHA-ONE,SETUP,First,Alpha,Stock event text,100,200',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,100,200',
      'GAMMA-OLD,SETUP,First,Gamma,Removed long ago,1,1',
    );
    const plan = computeMigrationPlan({ liveSpacesCsv: live, stockSpacesCsv: STOCK });
    expect(plan.liveOnlySpaces).toEqual(['GAMMA-OLD']);
    expect(plan.stockOnlySpaces).toEqual(['BETA-TWO']);
  });
});

describe('formatMigrationPlan', () => {
  it('summarizes positions and drift for the dry-run CLI', () => {
    const live = csv(
      'ALPHA-ONE,SETUP,First,Alpha,OLD wording,-50,75',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,-50,75',
      'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
    );
    const text = formatMigrationPlan(computeMigrationPlan({ liveSpacesCsv: live, stockSpacesCsv: STOCK }));
    expect(text).toContain('Tile positions to migrate into classroom config: 1');
    expect(text).toContain('ALPHA-ONE -> (-50, 75)');
    expect(text).toContain('NOT migrated): 1');
  });
});

describe('applyMigrationPlan', () => {
  it('creates classroom-1 with the migrated positions', () => {
    const live = csv(
      'ALPHA-ONE,SETUP,First,Alpha,Stock event text,-50,75',
      'ALPHA-ONE,SETUP,Subsequent,Alpha,Stock again,-50,75',
      'BETA-TWO,SETUP,First,Beta,Beta event,300,400',
    );
    const plan = computeMigrationPlan({ liveSpacesCsv: live, stockSpacesCsv: STOCK });
    const result = applyMigrationPlan({ instancesRoot: root, plan, id: 'classroom-1', displayName: 'Classroom 1' });

    expect(result.skipped).toBe(false);
    const config = loadInstance(root, 'classroom-1');
    expect(config!.slots['ALPHA-ONE']).toMatchObject({ pos_x: '-50', pos_y: '75' });
  });

  it('is idempotent: a second apply never touches the existing instance', () => {
    const plan = computeMigrationPlan({ liveSpacesCsv: STOCK, stockSpacesCsv: STOCK });
    applyMigrationPlan({ instancesRoot: root, plan, id: 'classroom-1', displayName: 'Classroom 1' });
    const before = JSON.stringify(loadInstance(root, 'classroom-1'));

    const second = applyMigrationPlan({
      instancesRoot: root,
      plan: { ...plan, positions: { 'ALPHA-ONE': { x: '1', y: '1' } } },
      id: 'classroom-1',
      displayName: 'Classroom 1',
    });
    expect(second.skipped).toBe(true);
    expect(JSON.stringify(loadInstance(root, 'classroom-1'))).toBe(before);
  });
});
