// server/instanceStore.js
// Teacher instance layer, Phase 1 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// Per-classroom config storage: which cards are used, tile positions,
// teacher copies (Phase 2), detours (Phase 2). One classroom = one JSON
// config file, replaced atomically as a unit (spec INVARIANT: temp file →
// fsync → rename; a partial write must never be observable).
//
// Pure helpers — server.js wires them into endpoints. Like authGuards.js,
// extracted so they can be unit-tested (server.js auto-listens on import).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { timingSafeEqualStr, checkAdminPassword } from './authGuards.js';

const CONFIG_FILE = 'config.json';

export const DEFAULT_INSTANCE_ID = 'classroom-1';

/**
 * @typedef {Object} SlotConfig
 * @property {boolean} [used]
 * @property {string} [pos_x]
 * @property {string} [pos_y]
 * @property {string} [card]
 */

/**
 * @typedef {Object} InstanceConfig
 * @property {{ id: string, displayName: string, createdAt: string,
 *   updatedAt: string, writeToken: string, owner: string|null,
 *   coTeachers: string[], classCode: string|null, visibility: string }} meta
 * @property {number} configVersion
 * @property {Object<string, SlotConfig>} slots
 * @property {Object<string, any>} teacherCopies
 * @property {Object<string, string>} detours
 * @property {Object<string, InsertionConfig>} insertions
 */

export function instanceDir(instancesRoot, id) {
  return path.join(instancesRoot, id);
}

/** List all classroom ids that have a config file. Sorted, [] if none. */
export function listInstanceIds(instancesRoot) {
  if (!fs.existsSync(instancesRoot)) return [];
  return fs.readdirSync(instancesRoot)
    .filter(name => fs.existsSync(configPath(instancesRoot, name)))
    .sort();
}

export function configPath(instancesRoot, id) {
  return path.join(instancesRoot, id, CONFIG_FILE);
}

// Spec INVARIANT "atomicity end to end" req 1: the config is one file,
// replaced whole. Readers see the old config or the new one, never a mix.
function atomicWriteJson(filePath, obj) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(obj, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
}

/**
 * Create a new classroom. Throws if it already exists (migration relies on
 * this for idempotency). meta reserves the Phase 3 ownership fields now so
 * multi-teacher never forces a schema rework (spec, third-review adoption).
 * @param {string} instancesRoot
 * @param {{ id: string, displayName?: string }} opts
 * @returns {InstanceConfig}
 */
export function createInstance(instancesRoot, { id, displayName }) {
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`Invalid instance id: "${id}" (lowercase letters, digits, hyphens)`);
  }
  const file = configPath(instancesRoot, id);
  if (fs.existsSync(file)) {
    throw new Error(`Instance "${id}" already exists`);
  }
  const now = new Date().toISOString();
  const config = {
    meta: {
      id,
      displayName: displayName || id,
      createdAt: now,
      updatedAt: now,
      // Write token: "watching open, touching keyed" (v3.0.72 access model).
      // Same pattern as per-game tokens; Phase 3 attaches ownership to it.
      writeToken: crypto.randomBytes(32).toString('hex'),
      // Reserved for Phase 3 — intentionally unused in Phases 1-2.
      owner: null,
      coTeachers: [],
      classCode: null,
      visibility: 'private',
    },
    configVersion: 1,
    // slots[space_name] = { used, pos_x, pos_y, card } — card defaults to
    // the stock card; Phase 2 lets it point at a teacherCopies id.
    slots: {},
    // teacherCopies[copy_id] = full card rows + provenance (Phase 2).
    teacherCopies: {},
    // detours[space_name] = destination for switched-off spaces (Phase 2).
    detours: {},
    // insertions[authoredId] = a teacher-authored space spliced into an edge
    // (Phase 4a). Edge-keyed (audit round 3): { from, to } names the A→B edge
    // the new space sits on. Sectioned as its own top-level key (audit round 4)
    // so a future config-directory split is mechanical.
    insertions: {},
  };
  fs.mkdirSync(instanceDir(instancesRoot, id), { recursive: true });
  atomicWriteJson(file, config);
  return config;
}

/**
 * Delete a classroom: remove its entire on-disk directory (config.json AND
 * the baked resolved/ output both live under <instancesRoot>/<id>/, so one
 * recursive remove takes the whole classroom). Refuses the default
 * classroom — the public board must always exist. Throws if it doesn't
 * exist so a stale id surfaces instead of silently "succeeding".
 * @param {string} instancesRoot
 * @param {string} id
 */
export function deleteInstance(instancesRoot, id) {
  if (id === DEFAULT_INSTANCE_ID) {
    throw new Error(`The default classroom ("${DEFAULT_INSTANCE_ID}") cannot be deleted`);
  }
  if (!fs.existsSync(configPath(instancesRoot, id))) {
    throw new Error(`No such instance: "${id}"`);
  }
  fs.rmSync(instanceDir(instancesRoot, id), { recursive: true, force: true });
}

/**
 * Load a classroom config, or null if it doesn't exist. Throws on a config
 * that exists but doesn't parse/validate — callers (boot, bake) decide how
 * to fault-isolate; silently returning null would mask corruption.
 * @param {string} instancesRoot
 * @param {string} id
 * @returns {InstanceConfig|null}
 */
export function loadInstance(instancesRoot, id) {
  const file = configPath(instancesRoot, id);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!parsed || typeof parsed !== 'object') throw new Error(`Instance "${id}": config is not an object`);
  if (parsed.meta?.id !== id) throw new Error(`Instance "${id}": config meta.id is "${parsed.meta?.id}"`);
  if (!Number.isInteger(parsed.configVersion) || parsed.configVersion < 1) {
    throw new Error(`Instance "${id}": invalid configVersion`);
  }
  for (const key of ['slots', 'teacherCopies', 'detours']) {
    if (!parsed[key] || typeof parsed[key] !== 'object') throw new Error(`Instance "${id}": missing ${key}`);
  }
  // insertions (Phase 4a) is newer than the original schema — default it so
  // configs written before Phase 4 still load. A present value must be valid.
  if (parsed.insertions === undefined) {
    parsed.insertions = {};
  } else if (!parsed.insertions || typeof parsed.insertions !== 'object') {
    throw new Error(`Instance "${id}": invalid insertions`);
  }
  return parsed;
}

/**
 * Persist a modified config: bumps configVersion + updatedAt, writes
 * atomically. The bump is what invalidates the baked output — game creation
 * is gated on configVersion == resolvedVersion (spec).
 * @param {string} instancesRoot
 * @param {InstanceConfig} config
 * @returns {InstanceConfig}
 */
export function saveInstance(instancesRoot, config) {
  config.configVersion += 1;
  config.meta.updatedAt = new Date().toISOString();
  atomicWriteJson(configPath(instancesRoot, config.meta.id), config);
  return config;
}

/**
 * Instance-mutating requests need (in order): the instance's write token,
 * a logged-in teacher who OWNS this classroom (Phase 3 — session resolved to
 * an accountId by the caller), or the admin password (mirrors
 * requireGameTokenOrAdmin). Fail-closed: nothing valid and no admin hash
 * configured → 401/503, never a pass.
 *
 * The session is "just a key to" the per-instance write token (spec): the
 * caller resolves the session token to an accountId via accountStore and
 * passes it here as `accountId`; ownership is `meta.owner` or `meta.coTeachers`.
 * instanceStore stays free of any session dependency.
 * @param {InstanceConfig} config
 * @param {{ token?: string|string[], adminPassword?: string|string[], adminPasswordHash?: string, accountId?: string }} creds
 * @returns {{ ok: true, via: string } | { ok: false, status?: number, error?: string }}
 */
export function checkInstanceWriteAccess(config, { token, adminPassword, adminPasswordHash, accountId }) {
  if (token && timingSafeEqualStr(token, config.meta.writeToken)) {
    return { ok: true, via: 'token' };
  }
  if (accountId) {
    const owner = config.meta?.owner;
    if (owner && timingSafeEqualStr(accountId, owner)) return { ok: true, via: 'owner' };
    const coTeachers = config.meta?.coTeachers;
    if (Array.isArray(coTeachers) && coTeachers.includes(accountId)) return { ok: true, via: 'coteacher' };
  }
  if (adminPassword) {
    const admin = checkAdminPassword(adminPassword, adminPasswordHash);
    if (admin.ok) return { ok: true, via: 'admin' };
    return admin;
  }
  return { ok: false, status: 401, error: 'Instance write token, classroom ownership, or admin password required' };
}

/**
 * True if `accountId` owns or co-teaches this classroom. Comparison is
 * timing-safe on the owner field; co-teacher membership is a plain check
 * (the list is not a secret — it's authorization config, and the accountId
 * came from an already-verified session).
 * @param {InstanceConfig} config
 * @param {string} accountId
 * @returns {boolean}
 */
export function instanceOwnedBy(config, accountId) {
  if (!accountId) return false;
  const owner = config.meta?.owner;
  if (owner && timingSafeEqualStr(accountId, owner)) return true;
  const coTeachers = config.meta?.coTeachers;
  return Array.isArray(coTeachers) && coTeachers.includes(accountId);
}

/**
 * Bind (or clear) a classroom's owner account. Mutates the in-memory config;
 * the caller saves. Clearing with null returns the classroom to admin-only.
 * @param {InstanceConfig} config
 * @param {string|null} accountId
 */
export function setInstanceOwner(config, accountId) {
  config.meta.owner = accountId || null;
}

/**
 * Strip an account from every classroom's ownership: clear it as owner
 * (back to admin-only) and drop it from any coTeachers list. Used when an
 * account is deleted so no classroom points at a ghost owner. Saves each
 * changed config (bumping its version, same as setInstanceOwner). Returns
 * the ids of the classrooms that were touched.
 * @param {string} instancesRoot
 * @param {string} accountId
 * @returns {string[]}
 */
export function removeAccountFromAllInstances(instancesRoot, accountId) {
  const affected = [];
  if (!accountId) return affected;
  for (const id of listInstanceIds(instancesRoot)) {
    let config;
    try {
      config = loadInstance(instancesRoot, id);
    } catch {
      continue; // skip a corrupt classroom rather than failing the sweep
    }
    if (!config) continue;
    let changed = false;
    if (config.meta.owner && timingSafeEqualStr(accountId, config.meta.owner)) {
      config.meta.owner = null;
      changed = true;
    }
    if (Array.isArray(config.meta.coTeachers) && config.meta.coTeachers.includes(accountId)) {
      config.meta.coTeachers = config.meta.coTeachers.filter((x) => x !== accountId);
      changed = true;
    }
    if (changed) {
      saveInstance(instancesRoot, config);
      affected.push(id);
    }
  }
  return affected;
}

/**
 * Apply tile positions to slots. positions = { [space_name]: {x, y} }.
 * Coordinates are stored as strings to match the CSV plumbing everywhere
 * else. Returns the list of space names applied (caller validates names
 * against stock and saves).
 * @param {InstanceConfig} config
 * @param {Object<string, { x: number|string, y: number|string }>} positions
 * @returns {string[]}
 */
export function setSlotPositions(config, positions) {
  const applied = [];
  for (const [spaceName, pos] of Object.entries(positions)) {
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid position for "${spaceName}": x/y must be finite numbers`);
    }
    config.slots[spaceName] = {
      used: true,
      ...config.slots[spaceName],
      pos_x: String(x),
      pos_y: String(y),
    };
    applied.push(spaceName);
  }
  return applied;
}

// ===== Phase 2: switch-off + teacher copies =====

/**
 * Switch a slot on or off. `detour` (only meaningful when switching off)
 * is the teacher's chosen destination from the hybrid confirm flow; omit
 * it to rely on the computed pass-through. Switching back on clears any
 * stored detour. Validation happens in instanceValidation, not here.
 * @param {InstanceConfig} config
 * @param {string} spaceName
 * @param {boolean} used
 * @param {string} [detour]
 */
export function setSlotUsed(config, spaceName, used, detour) {
  config.slots[spaceName] = { ...(config.slots[spaceName] ?? {}), used: Boolean(used) };
  if (used) {
    delete config.detours[spaceName];
  } else if (detour !== undefined) {
    if (detour) config.detours[spaceName] = String(detour).trim();
    else delete config.detours[spaceName];
  }
}

/**
 * Create a teacher copy of a slot's card: a COMPLETE copy of the current
 * stock rows with the teacher's overrides applied (spec: full copies, not
 * field-level inheritance), under a stable id distinct from the slot name
 * (`fee_review_copy_1`). The slot is switched to play the copy; the stock
 * original stays untouched in the library.
 * @param {InstanceConfig} config
 * @param {{ slotName: string, stockRows: Array<Object<string, string>>,
 *   overrides?: Object<string, Object<string, string>>, stockVersion?: string }} args
 *   overrides is keyed by visit_type ("First"/"Subsequent").
 * @returns {string} the new copy id
 */
export function createTeacherCopy(config, { slotName, stockRows, overrides = {}, stockVersion }) {
  if (!stockRows || stockRows.length === 0) {
    throw new Error(`No stock rows for "${slotName}" — cannot copy a card that does not exist`);
  }
  const base = slotName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  let n = 1;
  while (config.teacherCopies[`${base}_copy_${n}`]) n += 1;
  const copyId = `${base}_copy_${n}`;

  const now = new Date().toISOString();
  const rows = {};
  for (const stockRow of stockRows) {
    const visitType = stockRow.visit_type || '';
    rows[visitType] = {
      ...stockRow,
      ...(overrides[visitType] || {}),
      space_name: slotName, // slot names are the only space identifiers
    };
  }
  config.teacherCopies[copyId] = {
    slot: slotName,
    createdAt: now,
    updatedAt: now,
    copiedFromStockVersion: stockVersion || null,
    rows,
  };
  config.slots[slotName] = { used: true, ...config.slots[slotName], card: copyId };
  return copyId;
}

/**
 * Update a copy's fields (keyed by visit_type). Only the teacher changes a
 * copy's meaning — never the bake (spec: structure aligns automatically,
 * meaning never does).
 * @param {InstanceConfig} config
 * @param {string} copyId
 * @param {Object<string, Object<string, string>>} overrides
 */
export function updateTeacherCopy(config, copyId, overrides) {
  const copy = config.teacherCopies[copyId];
  if (!copy) throw new Error(`No such copy: "${copyId}"`);
  for (const [visitType, fields] of Object.entries(overrides || {})) {
    if (!copy.rows[visitType]) {
      throw new Error(`Copy "${copyId}" has no "${visitType}" row`);
    }
    copy.rows[visitType] = { ...copy.rows[visitType], ...fields, space_name: copy.slot };
  }
  copy.updatedAt = new Date().toISOString();
}

/**
 * Delete a copy. If the slot is playing it, the slot reverts to the stock
 * card (the original was never gone — that is the whole point).
 * @param {InstanceConfig} config
 * @param {string} copyId
 */
export function deleteTeacherCopy(config, copyId) {
  const copy = config.teacherCopies[copyId];
  if (!copy) throw new Error(`No such copy: "${copyId}"`);
  delete config.teacherCopies[copyId];
  const slot = config.slots[copy.slot];
  if (slot && slot.card === copyId) delete slot.card;
}

// ===== Phase 4a: teacher-authored spaces (card insertion) =====

/**
 * @typedef {Object} InsertionConfig
 * @property {string} id          authored space id — the slot name in baked files
 * @property {string} displayName human-readable label (rides display_label_override)
 * @property {string} from        edge source space name
 * @property {string} to          edge target space name (the A→B edge being spliced)
 * @property {string} [story]     narrative shown on the authored space
 * @property {string} [time]      optional flat First-visit time cost (string, CSV-shaped)
 * @property {string} [fee]       optional flat First-visit fee (string, CSV-shaped)
 * @property {number} [feePercent] optional First-visit fee as a % of the player's loans (slice 4); wins over flat fee
 * @property {string} [pos_x]
 * @property {string} [pos_y]
 * @property {{ type: string, count: number }} [cardDraw] cards dealt on arrival (slice 2)
 * @property {string[]} [diceOutcomes] six destinations, one per die face — makes it a dice space (slice 3)
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Add a teacher-authored narrative space onto the A→B edge (Phase 4a).
 * Generates a stable internal id in the slot namespace (`AUTH-<INSTANCEID>-<n>`,
 * audit round 3) distinct from copy ids and never emitted by stock. The id is
 * UPPERCASE on purpose: every space-name parser in the pipeline keys off the
 * uppercase token rule (processGameData's `isValidSpaceName` /^[A-Z]…/, the
 * catalog/resolver `[A-Z][A-Z0-9-]{2,}` token regexes). A lowercase id is
 * silently dropped as an invalid destination — the source space's movement
 * collapses to `none` and the authored space is orphaned (the soft-lock found
 * verifying 4a). An UPPERCASE id is recognized everywhere by construction; the
 * stock-name-collision guard (INSERT_ID_COLLISION) still backstops it. The
 * displayName is the human label (audit round 4 — internalId + displayName,
 * both baked). Topology validation (edge exists, endpoints active, from is a
 * fixed edge, no double-occupied edge) lives in instanceValidation, not here —
 * the save endpoint rejects an invalid insertion the same way it rejects a
 * bad detour.
 * The optional `cardDraw` makes the authored space deal cards on arrival
 * (Phase 4b slice 2): { type: 'W'|'B'|'I'|'L'|'E', count }. The optional
 * `diceOutcomes` (Phase 4b slice 3) makes it a dice space — exactly 6 entries,
 * one destination per die face. Both shapes are validated in instanceValidation
 * (rejected at save like a bad edge), not here.
 * @param {InstanceConfig} config
 * @param {{ from: string, to: string, displayName: string, story?: string,
 *   time?: string, fee?: string, feePercent?: string|number, pos_x?: string|number, pos_y?: string|number,
 *   cardDraw?: { type: string, count: string|number }|null,
 *   diceOutcomes?: string[]|null }} spec
 * @returns {string} the new authored space id
 */
export function addInsertion(config, { from, to, displayName, story, time, fee, feePercent, pos_x, pos_y, cardDraw, diceOutcomes }) {
  if (!from || !to) throw new Error('Insertion requires both `from` and `to` (the A→B edge)');
  if (!displayName || !String(displayName).trim()) throw new Error('Insertion requires a displayName');
  if (!config.insertions) config.insertions = {};

  // UPPERCASE so the id passes every space-name parser (see the doc comment).
  // The instance-id echo is uppercased too — the whole token must be uppercase
  // to satisfy isValidSpaceName's /^[A-Z][A-Z0-9-]+$/.
  const prefix = `AUTH-${String(config.meta.id).toUpperCase()}`;
  let n = 1;
  while (config.insertions[`${prefix}-${n}`]) n += 1;
  const id = `${prefix}-${n}`;

  const now = new Date().toISOString();
  config.insertions[id] = {
    id,
    displayName: String(displayName).trim(),
    from: String(from).trim(),
    to: String(to).trim(),
    story: story != null ? String(story) : '',
    ...(time != null && time !== '' ? { time: String(time) } : {}),
    ...(fee != null && fee !== '' ? { fee: String(fee) } : {}),
    ...(feePercent != null && feePercent !== '' ? { feePercent: Number(feePercent) } : {}),
    ...(pos_x != null ? { pos_x: String(pos_x) } : {}),
    ...(pos_y != null ? { pos_y: String(pos_y) } : {}),
    ...(cardDraw ? { cardDraw: normalizeCardDraw(cardDraw) } : {}),
    ...(diceOutcomes ? { diceOutcomes: normalizeDiceOutcomes(diceOutcomes) } : {}),
    createdAt: now,
    updatedAt: now,
  };
  return id;
}

/** Normalize a card-draw spec to { type: upper, count: number } (validation rejects bad ones). */
function normalizeCardDraw(cardDraw) {
  return {
    type: String(cardDraw.type || '').trim().toUpperCase(),
    count: Number(cardDraw.count),
  };
}

/** Normalize dice outcomes to a trimmed string[] (validation rejects bad ones). */
function normalizeDiceOutcomes(diceOutcomes) {
  return (Array.isArray(diceOutcomes) ? diceOutcomes : []).map(d => String(d ?? '').trim());
}

/**
 * Edit an authored space's content/label/effects (never its id). Changing the
 * edge (`from`/`to`) is allowed — it re-splices the space — and re-validated
 * at save like any topology edit.
 * Scalar fields and the structured ones (cardDraw/diceOutcomes) all accept null
 * to clear them.
 * @param {InstanceConfig} config
 * @param {string} id
 * @param {Record<string, string|number|string[]|{type:string,count:number}|null>} patch
 */
export function updateInsertion(config, id, patch) {
  const ins = config.insertions?.[id];
  if (!ins) throw new Error(`No such insertion: "${id}"`);
  const next = { ...ins };
  for (const key of ['displayName', 'from', 'to', 'story', 'time', 'fee', 'pos_x', 'pos_y']) {
    if (patch[key] !== undefined) next[key] = patch[key] === null ? undefined : String(patch[key]);
  }
  // feePercent is numeric (or null/'' to clear — revert to flat fee).
  if (patch.feePercent !== undefined) {
    next.feePercent = (patch.feePercent === null || patch.feePercent === '') ? undefined : Number(patch.feePercent);
  }
  // cardDraw / diceOutcomes are structured (or null to clear), not scalars.
  if (patch.cardDraw !== undefined) {
    next.cardDraw = patch.cardDraw ? normalizeCardDraw(patch.cardDraw) : undefined;
  }
  if (patch.diceOutcomes !== undefined) {
    next.diceOutcomes = patch.diceOutcomes ? normalizeDiceOutcomes(patch.diceOutcomes) : undefined;
  }
  next.id = ins.id;            // id is immutable (it's the movement key)
  next.createdAt = ins.createdAt;
  next.updatedAt = new Date().toISOString();
  config.insertions[id] = next;
}

/**
 * Remove an authored space. The bake then re-stitches the edge it sat on back
 * to its original A→B (the rewrite is recomputed from scratch each bake, so
 * removal needs no inverse — just drop the record).
 * @param {InstanceConfig} config
 * @param {string} id
 */
export function removeInsertion(config, id) {
  if (!config.insertions?.[id]) throw new Error(`No such insertion: "${id}"`);
  delete config.insertions[id];
}
