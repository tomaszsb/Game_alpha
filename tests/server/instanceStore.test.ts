// tests/server/instanceStore.test.ts
// Teacher instance layer Phase 1 — per-classroom config storage.
// Pins the spec invariants: atomic single-file config, version bump on
// save, write-token-or-admin access, Phase 3 ownership fields reserved.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  createInstance,
  loadInstance,
  saveInstance,
  checkInstanceWriteAccess,
  setSlotPositions,
  setSlotUsed,
  createTeacherCopy,
  updateTeacherCopy,
  deleteTeacherCopy,
  addInsertion,
  updateInsertion,
  removeInsertion,
  deleteInstance,
  setInstanceOwner,
  removeAccountFromAllInstances,
  listInstanceIds,
  configPath,
  instanceDir,
  DEFAULT_INSTANCE_ID,
} from '../../server/instanceStore.js';

const ADMIN_PASSWORD = 'hunter2';
const ADMIN_HASH = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'instances-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('createInstance', () => {
  it('creates a v1 config with a write token and reserved Phase 3 fields', () => {
    const config = createInstance(root, { id: 'classroom-1', displayName: 'Classroom 1' });
    expect(config.configVersion).toBe(1);
    expect(config.meta.id).toBe('classroom-1');
    expect(config.meta.writeToken).toMatch(/^[0-9a-f]{64}$/);
    // Reserved now so multi-teacher never needs a schema rework (spec).
    expect(config.meta).toMatchObject({ owner: null, coTeachers: [], visibility: 'private' });
    expect(config.slots).toEqual({});
    expect(config.teacherCopies).toEqual({});
    expect(config.detours).toEqual({});
  });

  it('refuses to overwrite an existing instance (migration idempotency)', () => {
    createInstance(root, { id: 'classroom-1' });
    expect(() => createInstance(root, { id: 'classroom-1' })).toThrow(/already exists/);
  });

  it('rejects ids that are not lowercase-kebab', () => {
    expect(() => createInstance(root, { id: '../escape' })).toThrow(/Invalid instance id/);
    expect(() => createInstance(root, { id: 'Classroom 1' })).toThrow(/Invalid instance id/);
  });
});

describe('loadInstance / saveInstance', () => {
  it('round-trips and bumps configVersion on every save', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    saveInstance(root, config);
    saveInstance(root, config);
    const loaded = loadInstance(root, 'classroom-1');
    expect(loaded!.configVersion).toBe(3);
  });

  it('returns null for a missing instance', () => {
    expect(loadInstance(root, 'nope')).toBeNull();
  });

  it('throws (not null) on a corrupt config so callers can fault-isolate', () => {
    createInstance(root, { id: 'classroom-1' });
    fs.writeFileSync(configPath(root, 'classroom-1'), '{ definitely not valid json');
    expect(() => loadInstance(root, 'classroom-1')).toThrow();
  });

  it('leaves no temp files behind after a save (atomic write)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    saveInstance(root, config);
    const files = fs.readdirSync(path.join(root, 'classroom-1'));
    expect(files).toEqual(['config.json']);
  });
});

describe('checkInstanceWriteAccess', () => {
  it('accepts the instance write token', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const result = checkInstanceWriteAccess(config, {
      token: config.meta.writeToken,
      adminPasswordHash: ADMIN_HASH,
    });
    expect(result).toEqual({ ok: true, via: 'token' });
  });

  it('accepts the admin password', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const result = checkInstanceWriteAccess(config, {
      adminPassword: ADMIN_PASSWORD,
      adminPasswordHash: ADMIN_HASH,
    });
    expect(result).toEqual({ ok: true, via: 'admin' });
  });

  it('rejects a wrong token, wrong password, and no credentials at all', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(checkInstanceWriteAccess(config, { token: 'f'.repeat(64), adminPasswordHash: ADMIN_HASH }))
      .toMatchObject({ ok: false, status: 401 });
    expect(checkInstanceWriteAccess(config, { adminPassword: 'wrong', adminPasswordHash: ADMIN_HASH }))
      .toMatchObject({ ok: false });
    expect(checkInstanceWriteAccess(config, { adminPasswordHash: ADMIN_HASH }))
      .toMatchObject({ ok: false, status: 401 });
  });

  it('fails closed when no admin hash is configured', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const result = checkInstanceWriteAccess(config, { adminPassword: ADMIN_PASSWORD, adminPasswordHash: '' });
    expect(result.ok).toBe(false);
  });
});

describe('setSlotPositions', () => {
  it('stores coordinates as strings and defaults used:true', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setSlotPositions(config, { 'OWNER-SCOPE-INITIATION': { x: 120, y: -40.5 } });
    expect(config.slots['OWNER-SCOPE-INITIATION']).toEqual({
      used: true,
      pos_x: '120',
      pos_y: '-40.5',
    });
  });

  it('preserves existing slot fields when repositioning', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    config.slots['OWNER-SCOPE-INITIATION'] = { used: false, pos_x: '0', pos_y: '0' };
    setSlotPositions(config, { 'OWNER-SCOPE-INITIATION': { x: 5, y: 6 } });
    expect(config.slots['OWNER-SCOPE-INITIATION']).toEqual({
      used: false,
      pos_x: '5',
      pos_y: '6',
    });
  });

  it('rejects non-numeric coordinates', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => setSlotPositions(config, { X: { x: NaN, y: 0 } })).toThrow(/finite/);
  });
});

describe('DEFAULT_INSTANCE_ID', () => {
  it('is classroom-1 (the Phase 1 migration target)', () => {
    expect(DEFAULT_INSTANCE_ID).toBe('classroom-1');
  });
});

// ===== Phase 2 helpers =====

describe('setSlotUsed', () => {
  it('switches a slot off with a chosen detour, and back on (clearing it)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setSlotUsed(config, 'BETA-MIDDLE', false, 'ZETA-END');
    expect(config.slots['BETA-MIDDLE'].used).toBe(false);
    expect(config.detours['BETA-MIDDLE']).toBe('ZETA-END');

    setSlotUsed(config, 'BETA-MIDDLE', true);
    expect(config.slots['BETA-MIDDLE'].used).toBe(true);
    expect(config.detours['BETA-MIDDLE']).toBeUndefined();
  });

  it('switching off without a detour leaves it to the computed pass-through', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setSlotUsed(config, 'BETA-MIDDLE', false);
    expect(config.slots['BETA-MIDDLE'].used).toBe(false);
    expect(config.detours['BETA-MIDDLE']).toBeUndefined();
  });

  it('preserves positions on the slot when toggling', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setSlotPositions(config, { 'BETA-MIDDLE': { x: 9, y: 8 } });
    setSlotUsed(config, 'BETA-MIDDLE', false);
    expect(config.slots['BETA-MIDDLE']).toMatchObject({ used: false, pos_x: '9', pos_y: '8' });
  });
});

describe('teacher copies', () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
    { space_name: 'FEE-REVIEW', visit_type: 'Subsequent', Title: 'Fee review', Fee: '50' },
  ];

  it('creates a complete copy under a stable id and plays it in the slot', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows,
      overrides: { First: { Title: 'My fee review' } },
      stockVersion: 'v123',
    });
    expect(copyId).toBe('fee_review_copy_1');
    const copy = config.teacherCopies[copyId];
    expect(copy.slot).toBe('FEE-REVIEW');
    expect(copy.copiedFromStockVersion).toBe('v123');
    // FULL copy: override applied, untouched fields carried over, both rows.
    expect(copy.rows['First']).toMatchObject({ Title: 'My fee review', Fee: '100', space_name: 'FEE-REVIEW' });
    expect(copy.rows['Subsequent']).toMatchObject({ Title: 'Fee review', Fee: '50' });
    expect(config.slots['FEE-REVIEW']).toMatchObject({ used: true, card: copyId });
  });

  it('numbers subsequent copies of the same slot (fee_review_copy_2)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    const second = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(second).toBe('fee_review_copy_2');
    // The slot plays the latest copy; the first still exists.
    expect(config.slots['FEE-REVIEW'].card).toBe('fee_review_copy_2');
    expect(config.teacherCopies['fee_review_copy_1']).toBeDefined();
  });

  it('updates fields per visit type and pins space_name to the slot', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    updateTeacherCopy(config, copyId, { First: { Fee: '999', space_name: 'sneaky_rename' } });
    expect(config.teacherCopies[copyId].rows['First']).toMatchObject({ Fee: '999', space_name: 'FEE-REVIEW' });
    expect(() => updateTeacherCopy(config, copyId, { Ghost: { Fee: '1' } })).toThrow(/no "Ghost" row/);
    expect(() => updateTeacherCopy(config, 'nope', {})).toThrow(/No such copy/);
  });

  it('deleting a copy reverts the slot to the stock card', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    deleteTeacherCopy(config, copyId);
    expect(config.teacherCopies[copyId]).toBeUndefined();
    expect(config.slots['FEE-REVIEW'].card).toBeUndefined();
    expect(config.slots['FEE-REVIEW'].used).toBe(true);
  });

  it('refuses to copy a card that does not exist in stock', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => createTeacherCopy(config, { slotName: 'GHOST', stockRows: [] })).toThrow(/does not exist/);
  });
});

describe('deleteInstance (Phase 3 polish)', () => {
  it('removes the whole classroom directory (config + baked resolved/)', () => {
    createInstance(root, { id: 'classroom-2' });
    // Simulate a baked output dir living alongside the config.
    fs.mkdirSync(path.join(instanceDir(root, 'classroom-2'), 'resolved'), { recursive: true });
    deleteInstance(root, 'classroom-2');
    expect(fs.existsSync(instanceDir(root, 'classroom-2'))).toBe(false);
    expect(loadInstance(root, 'classroom-2')).toBeNull();
  });

  it('refuses to delete the default classroom', () => {
    createInstance(root, { id: DEFAULT_INSTANCE_ID });
    expect(() => deleteInstance(root, DEFAULT_INSTANCE_ID)).toThrow(/cannot be deleted/);
    expect(loadInstance(root, DEFAULT_INSTANCE_ID)).not.toBeNull();
  });

  it('throws on a non-existent classroom', () => {
    expect(() => deleteInstance(root, 'ghost')).toThrow(/No such instance/);
  });
});

describe('removeAccountFromAllInstances (Phase 3 polish)', () => {
  it('clears the deleted account as owner and drops it from coTeachers, returning affected ids', () => {
    const a = createInstance(root, { id: 'classroom-2' });
    setInstanceOwner(a, 'teacher-aaa');
    saveInstance(root, a);
    const b = createInstance(root, { id: 'classroom-3' });
    b.meta.coTeachers = ['teacher-aaa', 'teacher-bbb'];
    saveInstance(root, b);
    const untouched = createInstance(root, { id: 'classroom-4' });
    setInstanceOwner(untouched, 'teacher-bbb');
    saveInstance(root, untouched);

    const affected = removeAccountFromAllInstances(root, 'teacher-aaa');
    expect(affected.sort()).toEqual(['classroom-2', 'classroom-3']);
    expect(loadInstance(root, 'classroom-2')!.meta.owner).toBeNull();
    expect(loadInstance(root, 'classroom-3')!.meta.coTeachers).toEqual(['teacher-bbb']);
    // A classroom owned by a different teacher is left alone.
    expect(loadInstance(root, 'classroom-4')!.meta.owner).toBe('teacher-bbb');
  });

  it('is a no-op (returns []) when the account owns nothing', () => {
    createInstance(root, { id: 'classroom-2' });
    expect(removeAccountFromAllInstances(root, 'teacher-nobody')).toEqual([]);
    expect(removeAccountFromAllInstances(root, '')).toEqual([]);
  });
});

describe('insertions (Phase 4a)', () => {
  it('createInstance seeds an empty insertions section; loadInstance round-trips it', () => {
    createInstance(root, { id: 'classroom-1' });
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.insertions).toEqual({});
  });

  it('loadInstance defaults insertions for configs written before Phase 4', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    // Simulate a pre-Phase-4 config on disk (no insertions key).
    delete (config as any).insertions;
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.insertions).toEqual({});
  });

  it('addInsertion mints a stable AUTH-<INSTANCEID>-<n> id and stores the edge', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, {
      from: 'A-SPACE',
      to: 'B-SPACE',
      displayName: 'Community Review',
      story: 'A beat.',
      time: '2',
    });
    // UPPERCASE so every space-name parser recognizes it (see addInsertion).
    expect(id).toBe('AUTH-CLASSROOM-1-1');
    expect(/^[A-Z][A-Z0-9-]+$/.test(id)).toBe(true);
    expect(config.insertions[id]).toMatchObject({
      id,
      from: 'A-SPACE',
      to: 'B-SPACE',
      displayName: 'Community Review',
      story: 'A beat.',
      time: '2',
    });
    // Second insertion gets the next counter.
    expect(addInsertion(config, { from: 'B-SPACE', to: 'C-SPACE', displayName: 'Another' })).toBe('AUTH-CLASSROOM-1-2');
  });

  it('addInsertion rejects a missing edge or blank displayName', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => addInsertion(config, { from: 'A', to: '', displayName: 'X' } as any)).toThrow();
    expect(() => addInsertion(config, { from: 'A', to: 'B', displayName: '  ' })).toThrow();
  });

  it('updateInsertion edits content but never the id or createdAt', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, { from: 'A', to: 'B', displayName: 'Old' });
    const createdAt = config.insertions[id].createdAt;
    updateInsertion(config, id, { displayName: 'New', story: 'Edited', to: 'C' });
    expect(config.insertions[id].id).toBe(id);
    expect(config.insertions[id].createdAt).toBe(createdAt);
    expect(config.insertions[id].displayName).toBe('New');
    expect(config.insertions[id].story).toBe('Edited');
    expect(config.insertions[id].to).toBe('C');
  });

  it('removeInsertion drops the record (the bake re-stitches the edge)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, { from: 'A', to: 'B', displayName: 'Gone soon' });
    removeInsertion(config, id);
    expect(config.insertions[id]).toBeUndefined();
    expect(() => removeInsertion(config, id)).toThrow();
  });

  it('persists a normalized card draw, and updateInsertion can clear it (slice 2)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, { from: 'A', to: 'B', displayName: 'Bonus', cardDraw: { type: 'e', count: '2' } });
    // Normalized: type upper-cased, count coerced to a number.
    expect(config.insertions[id].cardDraw).toEqual({ type: 'E', count: 2 });
    updateInsertion(config, id, { cardDraw: null });
    expect(config.insertions[id].cardDraw).toBeUndefined();
  });

  it('persists trimmed dice outcomes, and updateInsertion can clear them (slice 3)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, {
      from: 'A', to: 'B', displayName: 'Roll',
      diceOutcomes: [' C ', 'D', 'C', 'D', 'C', 'D'],
    });
    expect(config.insertions[id].diceOutcomes).toEqual(['C', 'D', 'C', 'D', 'C', 'D']);
    updateInsertion(config, id, { diceOutcomes: null });
    expect(config.insertions[id].diceOutcomes).toBeUndefined();
  });

  it('persists a numeric fee percent, and updateInsertion can clear it (slice 4)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, { from: 'A', to: 'B', displayName: 'Financing fee', feePercent: '2.5' });
    expect(config.insertions[id].feePercent).toBe(2.5);
    updateInsertion(config, id, { feePercent: null });
    expect(config.insertions[id].feePercent).toBeUndefined();
  });
});

describe('listInstanceIds (Phase 3)', () => {
  it('returns [] when no classrooms exist', () => {
    expect(listInstanceIds(root)).toEqual([]);
    expect(listInstanceIds(path.join(root, 'nope'))).toEqual([]);
  });

  it('lists only directories that have a config, sorted', () => {
    createInstance(root, { id: 'classroom-2' });
    createInstance(root, { id: 'classroom-1' });
    // A stray directory with no config.json must not be listed.
    fs.mkdirSync(path.join(root, 'not-a-classroom'), { recursive: true });
    expect(listInstanceIds(root)).toEqual(['classroom-1', 'classroom-2']);
  });
});
