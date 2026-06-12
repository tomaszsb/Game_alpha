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
 */

export function instanceDir(instancesRoot, id) {
  return path.join(instancesRoot, id);
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
  };
  fs.mkdirSync(instanceDir(instancesRoot, id), { recursive: true });
  atomicWriteJson(file, config);
  return config;
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
 * Instance-mutating requests need the instance's write token or the admin
 * password (mirrors requireGameTokenOrAdmin). Fail-closed: no token and no
 * admin hash configured → 401/503, never a pass.
 * @param {InstanceConfig} config
 * @param {{ token?: string|string[], adminPassword?: string|string[], adminPasswordHash?: string }} creds
 * @returns {{ ok: true, via: string } | { ok: false, status?: number, error?: string }}
 */
export function checkInstanceWriteAccess(config, { token, adminPassword, adminPasswordHash }) {
  if (token && timingSafeEqualStr(token, config.meta.writeToken)) {
    return { ok: true, via: 'token' };
  }
  if (adminPassword) {
    const admin = checkAdminPassword(adminPassword, adminPasswordHash);
    if (admin.ok) return { ok: true, via: 'admin' };
    return admin;
  }
  return { ok: false, status: 401, error: 'Instance write token or admin password required' };
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
