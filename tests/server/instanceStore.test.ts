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
  setEdgeWaypoints,
  clearEdgeWaypoint,
  clearAllEdgeWaypoints,
  setEdgeAnchor,
  clearEdgeAnchor,
  clearAllEdgeAnchors,
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
import { checkAdminPassword } from '../../server/authGuards.js';

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

describe('edge waypoints (G160, made permanent 2026-08-04)', () => {
  it('createInstance seeds an empty edgeWaypoints section; loadInstance round-trips it', () => {
    createInstance(root, { id: 'classroom-1' });
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.edgeWaypoints).toEqual({});
  });

  it('loadInstance defaults edgeWaypoints for configs written before it existed', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    delete (config as any).edgeWaypoints;
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.edgeWaypoints).toEqual({});
  });

  it('loadInstance auto-upgrades a v3.1.90 single-point entry into a one-element array (2026-08-04 bug: caused a live "i.slice is not a function" crash on drag)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    // Simulate a config saved under the one release (v3.1.90) that stored
    // a bare {x,y} object per edge instead of an array.
    (config as any).edgeWaypoints = { 'A__B': { x: 10, y: 20 } };
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.edgeWaypoints).toEqual({ 'A__B': [{ x: 10, y: 20 }] });
  });

  it('loadInstance leaves an already-correct array shape untouched', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    (config as any).edgeWaypoints = { 'A__B': [{ x: 10, y: 20 }, { x: 30, y: 40 }] };
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.edgeWaypoints).toEqual({ 'A__B': [{ x: 10, y: 20 }, { x: 30, y: 40 }] });
  });

  it('setEdgeWaypoints stores an ordered array, overwriting whole on a second call (multi-bend, 2026-08-04)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeWaypoints(config, 'A__B', [{ x: 120, y: -40.5 }]);
    expect(config.edgeWaypoints['A__B']).toEqual([{ x: 120, y: -40.5 }]);
    setEdgeWaypoints(config, 'A__B', [{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    expect(config.edgeWaypoints['A__B']).toEqual([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
  });

  it('rejects a non-array or empty array (use clear instead)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => setEdgeWaypoints(config, 'A__B', [])).toThrow(/non-empty array/);
    expect(() => setEdgeWaypoints(config, 'A__B', undefined as any)).toThrow(/non-empty array/);
  });

  it('rejects non-numeric coordinates at any position in the array', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => setEdgeWaypoints(config, 'A__B', [{ x: 1, y: 2 }, { x: NaN, y: 0 }])).toThrow(/waypoint 1.*finite/);
  });

  it('clearEdgeWaypoint removes just that one edge', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeWaypoints(config, 'A__B', [{ x: 1, y: 2 }]);
    setEdgeWaypoints(config, 'C__D', [{ x: 3, y: 4 }]);
    clearEdgeWaypoint(config, 'A__B');
    expect(config.edgeWaypoints).toEqual({ 'C__D': [{ x: 3, y: 4 }] });
  });

  it('clearEdgeWaypoint on an edge with no waypoint is a harmless no-op', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => clearEdgeWaypoint(config, 'NEVER-SET')).not.toThrow();
    expect(config.edgeWaypoints).toEqual({});
  });

  it('clearAllEdgeWaypoints empties every redirect at once', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeWaypoints(config, 'A__B', [{ x: 1, y: 2 }]);
    setEdgeWaypoints(config, 'C__D', [{ x: 3, y: 4 }]);
    clearAllEdgeWaypoints(config);
    expect(config.edgeWaypoints).toEqual({});
  });
});

describe('edge anchors (box-side snapping, 2026-08-04)', () => {
  it('createInstance seeds an empty edgeAnchors section; loadInstance round-trips it', () => {
    createInstance(root, { id: 'classroom-1' });
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.edgeAnchors).toEqual({});
  });

  it('loadInstance defaults edgeAnchors for configs written before it existed', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    delete (config as any).edgeAnchors;
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.edgeAnchors).toEqual({});
  });

  it('setEdgeAnchor pins one end without disturbing the other', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeAnchor(config, 'A__B', 'source', 'top');
    expect(config.edgeAnchors['A__B']).toEqual({ source: 'top' });
    setEdgeAnchor(config, 'A__B', 'target', 'left');
    expect(config.edgeAnchors['A__B']).toEqual({ source: 'top', target: 'left' });
  });

  it('setEdgeAnchor overwrites a previously-set end', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeAnchor(config, 'A__B', 'source', 'top');
    setEdgeAnchor(config, 'A__B', 'source', 'right');
    expect(config.edgeAnchors['A__B']).toEqual({ source: 'right' });
  });

  it('rejects an invalid end or anchor name', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => setEdgeAnchor(config, 'A__B', 'middle' as any, 'top')).toThrow(/must be "source" or "target"/);
    expect(() => setEdgeAnchor(config, 'A__B', 'source', 'center' as any)).toThrow(/must be one of/);
  });

  it('clearEdgeAnchor removes just one end, keeping the other', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeAnchor(config, 'A__B', 'source', 'top');
    setEdgeAnchor(config, 'A__B', 'target', 'left');
    clearEdgeAnchor(config, 'A__B', 'source');
    expect(config.edgeAnchors['A__B']).toEqual({ target: 'left' });
  });

  it('clearEdgeAnchor drops the whole edge entry once both ends are cleared', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeAnchor(config, 'A__B', 'source', 'top');
    clearEdgeAnchor(config, 'A__B', 'source');
    expect(config.edgeAnchors).toEqual({});
  });

  it('clearEdgeAnchor on an edge with no anchors is a harmless no-op', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => clearEdgeAnchor(config, 'NEVER-SET', 'source')).not.toThrow();
    expect(config.edgeAnchors).toEqual({});
  });

  it('clearAllEdgeAnchors empties every pin at once', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setEdgeAnchor(config, 'A__B', 'source', 'top');
    setEdgeAnchor(config, 'C__D', 'target', 'bottom');
    clearAllEdgeAnchors(config);
    expect(config.edgeAnchors).toEqual({});
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

  it('stores the slot’s dice rows VERBATIM on the card (stage 1b)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const stockDiceRows = [
      { space_name: 'FEE-REVIEW', die_roll: 'Fees Paid', visit_type: 'First',
        '1': '8%', '2': '8%', '3': '10%', '4': '10%', '5': '12%', '6': '12%',
        button_label: '', roll_group: '' },
      { space_name: 'FEE-REVIEW', die_roll: 'Next Step', visit_type: 'First',
        '1': 'A', '2': 'A', '3': 'B', '4': 'B', '5': 'B', '6': 'B',
        button_label: 'Choose', roll_group: '' },
    ];
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, stockDiceRows });
    const copy = config.teacherCopies[copyId];
    expect(copy.diceRows).toHaveLength(2);
    // Every column survives, untouched — no interpretation, no reshaping.
    expect(copy.diceRows[0]).toEqual(stockDiceRows[0]);
    expect(copy.diceRows[1]).toEqual(stockDiceRows[1]);
    // Stored, not aliased: editing the card must not reach back into stock.
    copy.diceRows[0]['1'] = 'CHANGED';
    expect(stockDiceRows[0]['1']).toBe('8%');
  });

  it('a space with no dice rows gets NO diceRows key at all — absent, not []', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    for (const arg of [undefined, [] as unknown[]]) {
      const copyId = createTeacherCopy(config, {
        slotName: 'FEE-REVIEW', stockRows, stockDiceRows: arg as never,
      });
      const copy = config.teacherCopies[copyId];
      expect(copy.diceRows).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(copy, 'diceRows')).toBe(false);
    }
  });

  it('pins space_name on dice rows to the slot, like the Spaces rows', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows,
      stockDiceRows: [{ space_name: 'sneaky_rename', die_roll: 'Next Step', visit_type: 'First' }],
    });
    expect(config.teacherCopies[copyId].diceRows[0].space_name).toBe('FEE-REVIEW');
  });

  it('refuses to copy a card that does not exist in stock', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => createTeacherCopy(config, { slotName: 'GHOST', stockRows: [] })).toThrow(/does not exist/);
  });

  it('stamps a new copy "individual", owned by no one, when the classroom has no owner account (CARD_LIBRARY_DESIGN.md stage 1)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(config.teacherCopies[copyId].owner).toEqual({ tier: 'individual', id: null });
  });

  it('stamps a new copy with the classroom\'s own owner account id, still "individual" (not "official")', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setInstanceOwner(config, 'teacher-aaa');
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(config.teacherCopies[copyId].owner).toEqual({ tier: 'individual', id: 'teacher-aaa' });
  });
});

describe('teacher copy tiers (Card Library stage 1 slice 2)', () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
    { space_name: 'FEE-REVIEW', visit_type: 'Subsequent', Title: 'Fee review', Fee: '50' },
  ];

  it("defaults to 'individual' when no tier is given (every pre-slice-2 caller)", () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(config.teacherCopies[copyId].owner.tier).toBe('individual');
  });

  it('honors an explicit tier (Card Library stage 1 slice 2)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setInstanceOwner(config, 'teacher-aaa');
    const official = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    expect(config.teacherCopies[official].owner).toEqual({ tier: 'official', id: 'teacher-aaa' });
    const group = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'group' });
    expect(config.teacherCopies[group].owner.tier).toBe('group');
    // Explicit 'individual' is identical to omitting it.
    const individual = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'individual' });
    expect(config.teacherCopies[individual].owner).toEqual({ tier: 'individual', id: 'teacher-aaa' });
  });

  it('rejects a tier outside the three the model defines, without touching the config', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const before = JSON.stringify(config);
    expect(() => createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'school' as any }))
      .toThrow(/Invalid tier "school": must be one of official, group, individual/);
    expect(() => createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: '' as any })).toThrow(/Invalid tier/);
    expect(() => createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: null as any })).toThrow(/Invalid tier/);
    // A rejected tier must not leave a half-written copy behind.
    expect(JSON.stringify(config)).toBe(before);
  });
});

describe("the 'official' tier privilege boundary (Card Library stage 1 slice 2)", () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
  ];

  // POST /api/instances/:id/copies authorizes through handleInstanceMutation
  // -> checkInstanceWriteAccess, which passes on THREE different credentials.
  // Two of them (the instance write token, a classroom-owning teacher
  // session) are emphatically not admin, so the route needs its own admin
  // check before it will stamp `official`. These tests pin that the two
  // privileges are genuinely different rather than accidentally equivalent —
  // if checkInstanceWriteAccess ever started reporting via:'admin' for a
  // teacher session, the route's guard would become decorative.
  it('a classroom-owning teacher session has write access but is NOT admin', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    setInstanceOwner(config, 'teacher-aaa');
    // Write access: yes — this is their own classroom.
    expect(checkInstanceWriteAccess(config, { accountId: 'teacher-aaa', adminPasswordHash: ADMIN_HASH }))
      .toEqual({ ok: true, via: 'owner' });
    // Admin: no — the same request carries no admin password.
    expect(checkAdminPassword(undefined, ADMIN_HASH).ok).toBe(false);
  });

  it("a co-teacher and the instance write token are write access, not admin either", () => {
    const config = createInstance(root, { id: 'classroom-1' });
    config.meta.coTeachers = ['teacher-bbb'];
    expect(checkInstanceWriteAccess(config, { accountId: 'teacher-bbb', adminPasswordHash: ADMIN_HASH }))
      .toEqual({ ok: true, via: 'coteacher' });
    expect(checkInstanceWriteAccess(config, { token: config.meta.writeToken, adminPasswordHash: ADMIN_HASH }))
      .toEqual({ ok: true, via: 'token' });
    // Neither credential is the admin password, and the write token is not
    // accepted as one (a teacher must not be able to substitute it).
    expect(checkAdminPassword(config.meta.writeToken, ADMIN_HASH).ok).toBe(false);
  });

  it('only the real admin password satisfies the official-card check', () => {
    expect(checkAdminPassword(ADMIN_PASSWORD, ADMIN_HASH)).toEqual({ ok: true });
    expect(checkAdminPassword('wrong', ADMIN_HASH).ok).toBe(false);
    // Fail-closed: an unconfigured deploy cannot mint official cards either.
    expect(checkAdminPassword(ADMIN_PASSWORD, '')).toMatchObject({ ok: false, status: 503 });
  });

  it('a refused official request leaves the config byte-identical (nothing is written before the check)', () => {
    // The route returns 403 BEFORE handleInstanceMutation runs, and
    // handleInstanceMutation is the only path that loads/mutates/saves/bakes
    // (pinned by serverEndpointAuth.test.ts). This pins the other half: the
    // on-disk config is untouched by anything the refusal path can reach.
    const config = createInstance(root, { id: 'classroom-1' });
    const onDiskBefore = fs.readFileSync(configPath(root, 'classroom-1'), 'utf8');
    const denied = checkAdminPassword('not-the-admin-password', ADMIN_HASH);
    expect(denied.ok).toBe(false);
    // Nothing else happens on that branch — no createTeacherCopy, no save.
    expect(fs.readFileSync(configPath(root, 'classroom-1'), 'utf8')).toBe(onDiskBefore);
    const reloaded = loadInstance(root, 'classroom-1')!;
    expect(reloaded.teacherCopies).toEqual({});
    expect(reloaded.configVersion).toBe(config.configVersion);
  });

  it('an admin-authorized official request produces an official-tier card', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(checkAdminPassword(ADMIN_PASSWORD, ADMIN_HASH).ok).toBe(true);
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    saveInstance(root, config);
    const reloaded = loadInstance(root, 'classroom-1')!;
    expect(reloaded.teacherCopies[copyId].owner.tier).toBe('official');
    expect(reloaded.slots['FEE-REVIEW'].card).toBe(copyId);
  });
});

describe('card-owned dice (Card Library stage 1b)', () => {
  it('loadInstance does NOT backfill diceRows — absent must keep meaning "fall back to stock"', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review' }],
    });
    const copyId = Object.keys(config.teacherCopies)[0];
    saveInstance(root, config);
    const loaded = loadInstance(root, 'classroom-1')!;
    // A card written before stage 1b has no dice of its own, and must not
    // acquire a frozen snapshot of today's stock behind the teacher's back —
    // that would silently cut it off from future stock dice corrections.
    expect(loaded.teacherCopies[copyId].diceRows).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(loaded.teacherCopies[copyId], 'diceRows')).toBe(false);
  });

  it('round-trips diceRows verbatim through save/load', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const diceRow = { space_name: 'FEE-REVIEW', die_roll: 'Next Step', visit_type: 'First',
      '1': 'A', '2': 'A', '3': 'A', '4': 'B', '5': 'B', '6': 'B',
      button_label: 'Pick', roll_group: 'g1' };
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review' }],
      stockDiceRows: [diceRow],
    });
    saveInstance(root, config);
    expect(loadInstance(root, 'classroom-1')!.teacherCopies[copyId].diceRows).toEqual([diceRow]);
  });
});

describe('card ownership (Card Library stage 1, 2026-08-21)', () => {
  it('loadInstance backfills owner on a copy saved before the field existed', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review' }],
    });
    const copyId = Object.keys(config.teacherCopies)[0];
    delete (config.teacherCopies[copyId] as any).owner;
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.teacherCopies[copyId].owner).toEqual({ tier: 'individual', id: null });
  });

  it('backfill uses the classroom\'s current owner account, not null, when one is bound', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review' }],
    });
    const copyId = Object.keys(config.teacherCopies)[0];
    delete (config.teacherCopies[copyId] as any).owner;
    config.meta.owner = 'teacher-bbb';
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.teacherCopies[copyId].owner).toEqual({ tier: 'individual', id: 'teacher-bbb' });
  });

  it('loadInstance leaves an already-present owner untouched', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review' }],
    });
    const copyId = Object.keys(config.teacherCopies)[0];
    (config.teacherCopies[copyId] as any).owner = { tier: 'group', id: 'school-xyz' };
    fs.writeFileSync(configPath(root, 'classroom-1'), JSON.stringify(config, null, 2));
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.teacherCopies[copyId].owner).toEqual({ tier: 'group', id: 'school-xyz' });
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

  it('persists feeBasis=scope and treats anything else as the default (slice 4)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const id = addInsertion(config, { from: 'A', to: 'B', displayName: 'Design fee', feePercent: 5, feeBasis: 'scope' });
    expect(config.insertions[id].feeBasis).toBe('scope');
    // 'loans' (the default) is not stored; switching back clears it.
    updateInsertion(config, id, { feeBasis: 'loans' });
    expect(config.insertions[id].feeBasis).toBeUndefined();
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
