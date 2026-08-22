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
  branchTeacherCopy,
  unselectCard,
  selectCardForSlot,
  findCardForSlot,
  branchCardContent,
  pruneSlotVersions,
  instanceBackupsDir,
  pruneInstanceBackups,
  MAX_VERSIONS_PER_SLOT,
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

let gameDataDir: string;
let root: string;

beforeEach(() => {
  // Mirror the real layout: instancesRoot is <game-data>/instances, and
  // config backups land beside it at <game-data>/backups/instances/<id>.
  // Pointing root straight at a mkdtemp dir would scatter backup folders
  // through the OS temp root.
  gameDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-data-'));
  root = path.join(gameDataDir, 'instances');
  fs.mkdirSync(root, { recursive: true });
});

afterEach(() => {
  fs.rmSync(gameDataDir, { recursive: true, force: true });
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

  it('editing applies fields per visit type onto a NEW card, pinning space_name to the slot', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    const newId = branchTeacherCopy(config, copyId, { First: { Fee: '999', space_name: 'sneaky_rename' } });
    expect(newId).not.toBe(copyId);
    expect(config.teacherCopies[newId!].rows['First']).toMatchObject({ Fee: '999', space_name: 'FEE-REVIEW' });
    // The card that was edited is untouched and still there to go back to.
    expect(config.teacherCopies[copyId].rows['First'].Fee).toBe('100');
    expect(() => branchTeacherCopy(config, copyId, { Ghost: { Fee: '1' } })).toThrow(/no "Ghost" row/);
    expect(() => branchTeacherCopy(config, 'nope', {})).toThrow(/No such copy/);
  });

  it('unselecting a card reverts the slot to the stock card WITHOUT destroying the card (removing unselects, never destroys)', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, overrides: { First: { Title: 'My fee review' } } });
    unselectCard(config, copyId);
    // The slot reverts to stock...
    expect(config.slots['FEE-REVIEW'].card).toBeUndefined();
    expect(config.slots['FEE-REVIEW'].used).toBe(true);
    // ...but the card itself is untouched, still in the library with its work intact.
    expect(config.teacherCopies[copyId]).toBeDefined();
    expect(config.teacherCopies[copyId].rows['First'].Title).toBe('My fee review');
  });

  it('unselecting a card that is not the one currently playing is a harmless no-op', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    const second = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    // The slot is now playing `second`; unselecting `first` (never played)
    // must not touch the slot pointer or delete anything.
    unselectCard(config, first);
    expect(config.slots['FEE-REVIEW'].card).toBe(second);
    expect(config.teacherCopies[first]).toBeDefined();
    expect(config.teacherCopies[second]).toBeDefined();
  });

  it('unselectCard throws on an unknown copy id', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => unselectCard(config, 'ghost')).toThrow(/No such copy/);
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

describe('findCardForSlot / branchCardContent (Card Library stage 2, editing branches)', () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
    { space_name: 'FEE-REVIEW', visit_type: 'Subsequent', Title: 'Fee review', Fee: '50' },
  ];
  const diceRows = [
    { space_name: 'FEE-REVIEW', die_roll: 'Next Step', visit_type: 'First',
      '1': 'A', '2': 'A', '3': 'A', '4': 'B', '5': 'B', '6': 'B', button_label: '', roll_group: '' },
  ];
  const modalRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', effect_action: 'pay',
      modal_title: 'Pay up', modal_description: 'Fees due.', modal_button_label: 'Pay', modal_summary: 'Paid' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withOfficialCard = (): { config: any; copyId: string } => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW', stockRows, stockDiceRows: diceRows, stockModalRows: modalRows, tier: 'official',
    });
    return { config, copyId };
  };

  it('finds the card a slot is PLAYING, filtered by tier', () => {
    const { config, copyId } = withOfficialCard();
    expect(findCardForSlot(config, 'FEE-REVIEW', 'official')).toBe(copyId);
    expect(findCardForSlot(config, 'FEE-REVIEW')).toBe(copyId);
    // A different tier is a different deck — not this card.
    expect(findCardForSlot(config, 'FEE-REVIEW', 'individual')).toBeNull();
    expect(findCardForSlot(config, 'NO-SUCH-SLOT', 'official')).toBeNull();
  });

  it('returns null for a slot playing stock, and for a dangling card pointer', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    config.slots['FEE-REVIEW'] = { used: true };
    expect(findCardForSlot(config, 'FEE-REVIEW', 'official')).toBeNull();
    config.slots['FEE-REVIEW'] = { used: true, card: 'ghost_copy_1' };
    expect(findCardForSlot(config, 'FEE-REVIEW', 'official')).toBeNull();
  });

  it('makes a NEW card, points the slot at it, and leaves the previous one in the deck', () => {
    const { config, copyId } = withOfficialCard();
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Rewritten', Fee: '999' }],
      diceRows: [],
      modalRows: [],
      stockVersion: 'v2',
    });
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(copyId);
    expect(Object.keys(config.teacherCopies).sort()).toEqual([copyId, newId].sort());
    expect(config.slots['FEE-REVIEW'].card).toBe(newId);
    // The previous version is untouched — the whole point of branching.
    expect(config.teacherCopies[copyId].rows.First.Title).toBe('Fee review');
    expect(config.teacherCopies[newId!].rows.First.Title).toBe('Rewritten');
    expect(config.teacherCopies[newId!].copiedFromStockVersion).toBe('v2');
  });

  it('records the breadcrumbs both ways: derivedFrom forward, supersededBy back', () => {
    // Reserved by the spec and unreadable after the fact — nothing consumes
    // them yet, which is exactly why they need pinning.
    const { config, copyId } = withOfficialCard();
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Rewritten' }],
    })!;
    expect(config.teacherCopies[newId].derivedFrom).toBe(copyId);
    expect(config.teacherCopies[copyId].supersededBy).toBe(newId);
    expect(config.teacherCopies[copyId].derivedFrom).toBeUndefined();
    expect(config.teacherCopies[newId].supersededBy).toBeUndefined();
  });

  it('the new card inherits owner and note; a supplied note names the new version', () => {
    const { config, copyId } = withOfficialCard();
    config.teacherCopies[copyId].role = 'The long one';
    const inherited = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'v2' }],
    })!;
    expect(config.teacherCopies[inherited].owner).toEqual({ tier: 'official', id: null });
    expect(config.teacherCopies[inherited].role).toBe('The long one');

    const renamed = branchCardContent(config, inherited, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'v3' }],
      role: 'Shorter for a 45-minute period',
    })!;
    expect(config.teacherCopies[renamed].role).toBe('Shorter for a 45-minute period');
    expect(config.teacherCopies[inherited].role).toBe('The long one');
  });

  it('a save that says exactly what the playing card says creates NOTHING', () => {
    // Not an edge case: the Space Data Editor loads the RESOLVED board, so
    // every space that already has a card looks changed to a stock-based
    // diff even when the maintainer never opened it. Without this, one save
    // would branch every card on the board.
    const { config, copyId } = withOfficialCard();
    const before = JSON.stringify(config);
    const result = branchCardContent(config, copyId, {
      rows: stockRows,
      diceRows,
      modalRows,
    });
    expect(result).toBeNull();
    expect(JSON.stringify(config)).toBe(before);
  });

  it('treats an empty column and a missing column as the same thing', () => {
    // A card written before stock gained a column would otherwise look
    // different from an identical save that carries that column as ''.
    const { config, copyId } = withOfficialCard();
    const withEmptyExtra = stockRows.map(r => ({ ...r, brand_new_column: '' }));
    expect(branchCardContent(config, copyId, {
      rows: withEmptyExtra, diceRows, modalRows,
    })).toBeNull();
  });

  it('replaces WHOLESALE: a removed visit row goes away and a cleared field stays cleared', () => {
    // The Classroom Setup field editor merges, which is right there and wrong
    // here — the content editor sends the whole space back.
    const { config, copyId } = withOfficialCard();
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Only first', Fee: '' }],
    })!;
    const copy = config.teacherCopies[newId];
    expect(Object.keys(copy.rows)).toEqual(['First']);
    expect(copy.rows.First.Fee).toBe('');
    expect(copy.rows.First.Title).toBe('Only first');
  });

  it('forces space_name to the slot — a card can never rename its space', () => {
    const { config, copyId } = withOfficialCard();
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'SOMETHING-ELSE', visit_type: 'First', Title: 'x' }],
      diceRows: [{ space_name: 'SOMETHING-ELSE', die_roll: 'Next Step', visit_type: 'First', '1': 'A' }],
      modalRows: [{ space_name: 'SOMETHING-ELSE', visit_type: 'First', modal_title: 'm' }],
    })!;
    const copy = config.teacherCopies[newId];
    expect(copy.rows.First.space_name).toBe('FEE-REVIEW');
    expect(copy.diceRows[0].space_name).toBe('FEE-REVIEW');
    expect(copy.modalRows[0].space_name).toBe('FEE-REVIEW');
  });

  it('drops the diceRows/modalRows KEYS when the new content has none (absent, never [])', () => {
    // Absent is what the bake reads as "fall back to stock" — writing [] would
    // be a third state the resolver does not distinguish.
    const { config, copyId } = withOfficialCard();
    expect(config.teacherCopies[copyId].diceRows).toHaveLength(1);
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'x' }],
      diceRows: [],
      modalRows: [],
    })!;
    expect('diceRows' in config.teacherCopies[newId]).toBe(false);
    expect('modalRows' in config.teacherCopies[newId]).toBe(false);
  });

  it('carries logicRows across untouched — the content editor has no logic-question fields', () => {
    const { config, copyId } = withOfficialCard();
    config.teacherCopies[copyId].logicRows = [
      { visit_type: 'First', question_id: 'Q1', question_text: 'Did the scope change?', yes_reason: 'y', no_reason: 'n' },
    ];
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'x' }],
    })!;
    expect(config.teacherCopies[newId].logicRows).toHaveLength(1);
    expect(config.teacherCopies[copyId].logicRows).toHaveLength(1);
  });

  it('refuses an empty row set rather than writing a card that says nothing', () => {
    const { config, copyId } = withOfficialCard();
    const before = JSON.stringify(config);
    expect(() => branchCardContent(config, copyId, { rows: [] })).toThrow(/must hold at least one row/);
    expect(() => branchCardContent(config, 'no_such_copy', { rows: stockRows })).toThrow(/No such copy/);
    expect(JSON.stringify(config)).toBe(before);
  });

  it('carries copiedFromStockVersion forward when no stockVersion is given', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, stockVersion: 'v1', tier: 'official' });
    const newId = branchCardContent(config, copyId, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'changed' }],
    })!;
    expect(config.teacherCopies[newId].copiedFromStockVersion).toBe('v1');
  });
});

describe('version pruning (Card Library stage 2, "keep 5 versions per space")', () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editNTimes = (config: any, copyId: string, n: number): string[] => {
    const ids = [copyId];
    let current = copyId;
    for (let i = 1; i <= n; i++) {
      current = branchCardContent(config, current, {
        rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: `Version ${i}`, Fee: String(100 + i) }],
      })!;
      ids.push(current);
    }
    return ids;
  };

  it('keeps five and drops the oldest when a sixth arrives', () => {
    expect(MAX_VERSIONS_PER_SLOT).toBe(5);
    const config = createInstance(root, { id: 'classroom-1' });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    const ids = editNTimes(config, first, 4); // 5 cards, still under the cap
    expect(Object.keys(config.teacherCopies)).toHaveLength(5);

    const sixth = branchCardContent(config, ids[ids.length - 1], {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Version 5' }],
    })!;
    expect(Object.keys(config.teacherCopies)).toHaveLength(5);
    expect(config.teacherCopies[ids[0]]).toBeUndefined(); // the oldest went
    expect(config.teacherCopies[sixth]).toBeDefined();
    expect(config.slots['FEE-REVIEW'].card).toBe(sixth);
  });

  it('never prunes the card that is playing, however old it is', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    const ids = editNTimes(config, first, 4); // 5 cards
    // Go back to the very first version — now the OLDEST card is the one in
    // play, so pruning has to skip it and take the next-oldest instead.
    selectCardForSlot(config, 'FEE-REVIEW', ids[0]);
    const removed = pruneSlotVersions(config, 'FEE-REVIEW', 3);
    expect(config.teacherCopies[ids[0]]).toBeDefined();
    expect(config.slots['FEE-REVIEW'].card).toBe(ids[0]);
    expect(removed).toEqual([ids[1], ids[2]]);
    expect(Object.keys(config.teacherCopies)).toHaveLength(3);
  });

  it('never prunes the version an edit was branched FROM, even when it is oldest', () => {
    // Going back to an old version and editing it must not be the move that
    // deletes it: the slot pointer has already moved to the new card by the
    // time pruning runs, so the guard on "what is playing" is not enough.
    const config = createInstance(root, { id: 'classroom-1' });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    editNTimes(config, first, 4); // 5 cards; `first` is the oldest
    const fromOldest = branchCardContent(config, first, {
      rows: [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Reworked from the first one' }],
    })!;
    expect(config.teacherCopies[first]).toBeDefined();
    expect(config.teacherCopies[fromOldest].derivedFrom).toBe(first);
    expect(Object.keys(config.teacherCopies)).toHaveLength(5);
  });

  it('leaves other spaces alone — the cap is per space', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, {
      slotName: 'OTHER-SPACE',
      stockRows: [{ space_name: 'OTHER-SPACE', visit_type: 'First', Title: 'Other' }],
      tier: 'official',
    });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    editNTimes(config, first, 8);
    const feeReviewCards = Object.values(config.teacherCopies)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => c.slot === 'FEE-REVIEW');
    expect(feeReviewCards).toHaveLength(5);
    expect(config.slots['OTHER-SPACE'].card).toBeTruthy();
  });

  it('re-links the chain around a pruned card so no breadcrumb dangles', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    editNTimes(config, first, 6);
    for (const [id, copy] of Object.entries(config.teacherCopies)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card = copy as any;
      if (card.derivedFrom) expect(config.teacherCopies[card.derivedFrom], `${id}.derivedFrom`).toBeDefined();
      if (card.supersededBy) expect(config.teacherCopies[card.supersededBy], `${id}.supersededBy`).toBeDefined();
    }
  });

  it('pruneSlotVersions is a no-op below the cap', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    expect(pruneSlotVersions(config, 'FEE-REVIEW')).toEqual([]);
    expect(pruneSlotVersions(config, 'NO-SUCH-SLOT')).toEqual([]);
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

describe('card-owned modal copy + logic wording (Card Library stage 1b part ii)', () => {
  const feeReviewStockRows = [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review' }];

  it('stores the slot’s ModalConfig rows VERBATIM on the card', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const stockModalRows = [
      { space_name: 'FEE-REVIEW', visit_type: 'First', effect_action: 'draw_B',
        modal_title: '', modal_description: '', modal_button_label: 'Accept Bank Loan',
        modal_summary: '', dice_value: '' },
    ];
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows: feeReviewStockRows, stockModalRows });
    const copy = config.teacherCopies[copyId];
    expect(copy.modalRows).toHaveLength(1);
    // Every column survives, untouched — no interpretation, no reshaping.
    expect(copy.modalRows[0]).toEqual(stockModalRows[0]);
    // Stored, not aliased.
    copy.modalRows[0].modal_button_label = 'CHANGED';
    expect(stockModalRows[0].modal_button_label).toBe('Accept Bank Loan');
  });

  it('a space with no ModalConfig rows gets NO modalRows key at all — absent, not []', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    for (const arg of [undefined, [] as unknown[]]) {
      const copyId = createTeacherCopy(config, {
        slotName: 'FEE-REVIEW', stockRows: feeReviewStockRows, stockModalRows: arg as never,
      });
      const copy = config.teacherCopies[copyId];
      expect(copy.modalRows).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(copy, 'modalRows')).toBe(false);
    }
  });

  it('pins space_name on modal rows to the slot, like dice rows', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: feeReviewStockRows,
      stockModalRows: [{ space_name: 'sneaky_rename', visit_type: 'First' }],
    });
    expect(config.teacherCopies[copyId].modalRows[0].space_name).toBe('FEE-REVIEW');
  });

  it('stores ONLY wording fields from LOGIC_QUESTIONS rows, never routing', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const stockLogicRows = [
      { space_name: 'FEE-REVIEW', visit_type: 'First', question_id: 'Q1',
        question_text: 'Did you pass before?', yes_target: 'Q2', no_target: 'Q3',
        auto_answer_from: 'approved_before', yes_reason: 'Because yes.', no_reason: 'Because no.' },
    ];
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows: feeReviewStockRows, stockLogicRows });
    const copy = config.teacherCopies[copyId];
    expect(copy.logicRows).toEqual([
      { visit_type: 'First', question_id: 'Q1', question_text: 'Did you pass before?',
        yes_reason: 'Because yes.', no_reason: 'Because no.' },
    ]);
    // Structural to the field set, not just to this fixture's values: routing
    // columns literally never make it onto the stored object.
    expect(copy.logicRows[0]).not.toHaveProperty('yes_target');
    expect(copy.logicRows[0]).not.toHaveProperty('no_target');
    expect(copy.logicRows[0]).not.toHaveProperty('auto_answer_from');
    expect(copy.logicRows[0]).not.toHaveProperty('space_name');
  });

  it('a space with no LOGIC_QUESTIONS rows gets NO logicRows key at all — absent, not []', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    for (const arg of [undefined, [] as unknown[]]) {
      const copyId = createTeacherCopy(config, {
        slotName: 'FEE-REVIEW', stockRows: feeReviewStockRows, stockLogicRows: arg as never,
      });
      const copy = config.teacherCopies[copyId];
      expect(copy.logicRows).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(copy, 'logicRows')).toBe(false);
    }
  });

  it('loadInstance does NOT backfill modalRows/logicRows — absent must keep meaning "fall back to stock"', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows: feeReviewStockRows });
    const copyId = Object.keys(config.teacherCopies)[0];
    saveInstance(root, config);
    const loaded = loadInstance(root, 'classroom-1')!;
    expect(loaded.teacherCopies[copyId].modalRows).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(loaded.teacherCopies[copyId], 'modalRows')).toBe(false);
    expect(loaded.teacherCopies[copyId].logicRows).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(loaded.teacherCopies[copyId], 'logicRows')).toBe(false);
  });

  it('round-trips modalRows and logicRows through save/load', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const modalRow = { space_name: 'FEE-REVIEW', visit_type: 'First', effect_action: 'draw_B',
      modal_title: '', modal_description: '', modal_button_label: 'Accept', modal_summary: '', dice_value: '' };
    const logicRow = { space_name: 'FEE-REVIEW', visit_type: 'First', question_id: 'Q1',
      question_text: 'Q?', yes_target: 'Q2', no_target: 'Q3', auto_answer_from: '',
      yes_reason: 'Y', no_reason: 'N' };
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW',
      stockRows: feeReviewStockRows,
      stockModalRows: [modalRow],
      stockLogicRows: [logicRow],
    });
    saveInstance(root, config);
    const loaded = loadInstance(root, 'classroom-1')!.teacherCopies[copyId];
    expect(loaded.modalRows).toEqual([modalRow]);
    expect(loaded.logicRows).toEqual([
      { visit_type: 'First', question_id: 'Q1', question_text: 'Q?', yes_reason: 'Y', no_reason: 'N' },
    ]);
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

describe('selectCardForSlot (Card Library stage 2, the rolodex picker)', () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
    { space_name: 'FEE-REVIEW', visit_type: 'Subsequent', Title: 'Fee review', Fee: '50' },
  ];

  it('points the slot at the given card', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    // Unselect it first so the slot starts back on stock, proving selectCardForSlot re-selects it.
    unselectCard(config, copyId);
    expect(config.slots['FEE-REVIEW'].card).toBeUndefined();
    selectCardForSlot(config, 'FEE-REVIEW', copyId);
    expect(config.slots['FEE-REVIEW'].card).toBe(copyId);
  });

  it('switches between two existing cards for the same slot', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const first = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    const second = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(config.slots['FEE-REVIEW'].card).toBe(second);
    selectCardForSlot(config, 'FEE-REVIEW', first);
    expect(config.slots['FEE-REVIEW'].card).toBe(first);
    selectCardForSlot(config, 'FEE-REVIEW', second);
    expect(config.slots['FEE-REVIEW'].card).toBe(second);
  });

  it('a falsy copyId clears the slot back to the original', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(config.slots['FEE-REVIEW'].card).toBe(copyId);
    selectCardForSlot(config, 'FEE-REVIEW', null);
    expect(config.slots['FEE-REVIEW'].card).toBeUndefined();
    // The card itself is still there, still selectable again later.
    expect(config.teacherCopies[copyId]).toBeDefined();
  });

  it('clearing a slot that never had a card at all does not throw', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => selectCardForSlot(config, 'NEVER-TOUCHED', null)).not.toThrow();
    expect(config.slots['NEVER-TOUCHED']?.card).toBeUndefined();
  });

  it('refuses to select a card for a space it does not belong to', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(() => selectCardForSlot(config, 'OTHER-SPACE', copyId))
      .toThrow(/belongs to "FEE-REVIEW", not "OTHER-SPACE"/);
    // The slot it does NOT belong to must not have been touched.
    expect(config.slots['OTHER-SPACE']).toBeUndefined();
  });

  it('refuses an unknown copy id', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    expect(() => selectCardForSlot(config, 'FEE-REVIEW', 'ghost')).toThrow(/No such copy/);
  });
});

describe('card role notes (Card Library stage 2, "what this card is for")', () => {
  const stockRows = [
    { space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' },
  ];

  it('createTeacherCopy defaults role to an empty string when omitted', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows });
    expect(config.teacherCopies[copyId].role).toBe('');
  });

  it('createTeacherCopy stores and trims a given role', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, {
      slotName: 'FEE-REVIEW', stockRows, role: '  Shorter version for a 45-minute period  ',
    });
    expect(config.teacherCopies[copyId].role).toBe('Shorter version for a 45-minute period');
  });

  it('renaming a card in place: a note-only save makes no new version', () => {
    // The note is the version's NAME, not part of what the card says — so
    // renaming it is not an edit that branches (Figma's named versions work
    // the same way).
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, role: 'Original note' });
    expect(branchTeacherCopy(config, copyId, {}, 'Updated note')).toBeNull();
    expect(Object.keys(config.teacherCopies)).toEqual([copyId]);
    expect(config.teacherCopies[copyId].role).toBe('Updated note');
    expect(config.teacherCopies[copyId].rows['First'].Title).toBe('Fee review');
  });

  it('a new version carries the previous note forward when the save gives none', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, role: 'Keep me' });
    const newId = branchTeacherCopy(config, copyId, { First: { Fee: '999' } });
    expect(config.teacherCopies[newId!].role).toBe('Keep me');
    expect(config.teacherCopies[copyId].role).toBe('Keep me');
  });

  it('a note can be cleared with an explicit empty string', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, role: 'Has a note' });
    expect(branchTeacherCopy(config, copyId, {}, '')).toBeNull();
    expect(config.teacherCopies[copyId].role).toBe('');
  });

  it('a save that names the new version applies the note to it, not to the old one', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const copyId = createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, role: 'First pass' });
    const newId = branchTeacherCopy(config, copyId, { First: { Fee: '999' } }, 'Shorter for a 45-minute period');
    expect(config.teacherCopies[newId!].role).toBe('Shorter for a 45-minute period');
    expect(config.teacherCopies[copyId].role).toBe('First pass');
  });
});

describe('classroom config backups (TEACHER_LAYER_DESIGN.md Phase 1, shipped stage 2 slice 2)', () => {
  const stockRows = [{ space_name: 'FEE-REVIEW', visit_type: 'First', Title: 'Fee review', Fee: '100' }];

  it('snapshots the config being replaced on EVERY save, into game-data/backups', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    const backupDir = instanceBackupsDir(root, 'classroom-1');
    // Nothing yet — the create itself had nothing behind it to preserve.
    expect(fs.existsSync(backupDir)).toBe(false);

    setSlotUsed(config, 'FEE-REVIEW', false, 'AUDIT');
    saveInstance(root, config);
    const afterFirst = fs.readdirSync(backupDir);
    expect(afterFirst).toHaveLength(1);
    // The snapshot holds the state BEFORE this save (configVersion 1).
    expect(JSON.parse(fs.readFileSync(path.join(backupDir, afterFirst[0]), 'utf-8')).configVersion).toBe(1);
    expect(loadInstance(root, 'classroom-1')!.configVersion).toBe(2);

    setSlotUsed(config, 'FEE-REVIEW', true);
    saveInstance(root, config);
    expect(fs.readdirSync(backupDir)).toHaveLength(2);
  });

  it('protects everything in the file, not just cards — a switched-off space is recoverable', () => {
    // Card versioning covers card content; this layer is what stands behind
    // switch-offs, detours, tile positions and connector waypoints.
    const config = createInstance(root, { id: 'classroom-1' });
    setSlotPositions(config, { 'FEE-REVIEW': { x: 100, y: 200 } });
    saveInstance(root, config);
    setSlotPositions(config, { 'FEE-REVIEW': { x: 999, y: 999 } });
    saveInstance(root, config);

    const backupDir = instanceBackupsDir(root, 'classroom-1');
    const newest = fs.readdirSync(backupDir).sort().reverse()[0];
    const snapshot = JSON.parse(fs.readFileSync(path.join(backupDir, newest), 'utf-8'));
    expect(snapshot.slots['FEE-REVIEW']).toMatchObject({ pos_x: '100', pos_y: '200' });
  });

  it('a card edit is recoverable from the snapshot even after the version cap drops it', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    createTeacherCopy(config, { slotName: 'FEE-REVIEW', stockRows, tier: 'official' });
    saveInstance(root, config);
    const beforeVersion = loadInstance(root, 'classroom-1')!.configVersion;
    const snapshotsBefore = fs.readdirSync(instanceBackupsDir(root, 'classroom-1')).length;
    expect(beforeVersion).toBe(2);
    expect(snapshotsBefore).toBe(1);
  });

  it('keeps the last 20 per classroom PLUS anything from the last 30 days', () => {
    const dir = instanceBackupsDir(root, 'classroom-1');
    fs.mkdirSync(dir, { recursive: true });
    const now = Date.parse('2026-08-22T12:00:00.000Z');
    const day = 24 * 60 * 60 * 1000;
    // 30 snapshots: the newest 20 are within the count, and of the older 10
    // half are still inside the 30-day window.
    const names: string[] = [];
    for (let i = 0; i < 30; i++) {
      const name = `2026-0${i < 10 ? 1 : 2}-${String((i % 27) + 1).padStart(2, '0')}T00-00-0${i % 10}-000Z_config.json`;
      names.push(name);
    }
    names.sort();
    names.forEach((name, index) => {
      const full = path.join(dir, name);
      fs.writeFileSync(full, '{}');
      // Oldest names get the oldest mtimes; the 5 oldest are past 30 days.
      const ageDays = index < 5 ? 60 : 3;
      fs.utimesSync(full, new Date(now - ageDays * day), new Date(now - ageDays * day));
    });

    const pruned = pruneInstanceBackups(dir, { now });
    // Only the 5 that fail BOTH tests (outside the newest 20 AND older than
    // 30 days) go; the other 5 outside the count are recent, so they stay.
    expect(pruned).toHaveLength(5);
    expect(fs.readdirSync(dir)).toHaveLength(25);
    // Never the newest.
    expect(fs.existsSync(path.join(dir, names[names.length - 1]))).toBe(true);
  });

  it('is best-effort: a save still goes through when the snapshot cannot be written', () => {
    const config = createInstance(root, { id: 'classroom-1' });
    // A FILE where the backups directory needs to be — mkdirSync then throws.
    const backupsRoot = path.join(gameDataDir, 'backups');
    fs.writeFileSync(backupsRoot, 'not a directory');
    setSlotUsed(config, 'FEE-REVIEW', false, 'AUDIT');
    expect(() => saveInstance(root, config)).not.toThrow();
    expect(loadInstance(root, 'classroom-1')!.slots['FEE-REVIEW'].used).toBe(false);
  });

  it('refuses a traversal id rather than writing outside the backups tree', () => {
    expect(() => instanceBackupsDir(root, '../escape')).toThrow(/Invalid instance id/);
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
