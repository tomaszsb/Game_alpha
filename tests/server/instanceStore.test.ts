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
  configPath,
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
