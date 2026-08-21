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

// SECURITY (HIGH, 2026-07-21 audit): every instance id that reaches a
// filesystem path must pass through here first. createInstance already
// enforced this at creation time, but loadInstance/deleteInstance/resolvedDir
// built paths straight from the id with no check — an id like "../../foo"
// walked the resulting path.join() outside instancesRoot entirely, so any
// route that forwarded req.params.id (most of /api/instances/:id) could read
// or (via deleteInstance's recursive rmSync) destroy arbitrary directories.
// Centralizing the check in instanceDir (and routing configPath through it)
// closes every caller at once instead of relying on each route to remember.
const INSTANCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function assertValidInstanceId(id) {
  if (typeof id !== 'string' || !INSTANCE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid instance id: "${id}" (lowercase letters, digits, hyphens)`);
  }
}

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
 * @property {Object<string, Array<{ x: number, y: number }>>} edgeWaypoints
 * @property {Object<string, { source?: string, target?: string }>} edgeAnchors
 */

export function instanceDir(instancesRoot, id) {
  assertValidInstanceId(id);
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
  return path.join(instanceDir(instancesRoot, id), CONFIG_FILE);
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
    // edgeWaypoints[edgeId] = [{ x, y }, ...] — an ordered list of manual
    // bend points for a board connector whose auto-routed path detours
    // somewhere confusing, or whose stretch should visually bundle with
    // another edge's (G160, multi-bend 2026-08-04). edgeId is
    // `${source}__${target}`. Pure display data (not read by the game
    // engine), so it's exposed as-is via a plain GET rather than baked
    // into the resolved CSVs like slots/insertions are.
    edgeWaypoints: {},
    // edgeAnchors[edgeId] = { source?, target? } — pins one or both ends
    // of a connector to a fixed side-middle point on its node (top/right/
    // bottom/left) instead of the automatic floating attach point
    // (2026-08-04). A separate field from edgeWaypoints (not reshaping an
    // already-deployed field again) — same "pure display data" treatment.
    edgeAnchors: {},
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
  // edgeWaypoints (G160) is newer still — same default-if-missing treatment.
  if (parsed.edgeWaypoints === undefined) {
    parsed.edgeWaypoints = {};
  } else if (!parsed.edgeWaypoints || typeof parsed.edgeWaypoints !== 'object') {
    throw new Error(`Instance "${id}": invalid edgeWaypoints`);
  } else {
    // Multi-bend (2026-08-04) changed each entry from a single {x,y} point
    // to an array of points. A config saved under v3.1.90 (the one release
    // that shipped with the single-point shape) still has the old form on
    // disk — auto-upgrade it in place here so every reader downstream can
    // assume "always an array" without every call site re-checking. The
    // next save naturally persists the upgraded shape.
    for (const key of Object.keys(parsed.edgeWaypoints)) {
      const value = parsed.edgeWaypoints[key];
      if (value && !Array.isArray(value) && typeof value === 'object') {
        parsed.edgeWaypoints[key] = [value];
      }
    }
  }
  // edgeAnchors (box-side anchor snapping) is newer still.
  if (parsed.edgeAnchors === undefined) {
    parsed.edgeAnchors = {};
  } else if (!parsed.edgeAnchors || typeof parsed.edgeAnchors !== 'object') {
    throw new Error(`Instance "${id}": invalid edgeAnchors`);
  }
  // owner on each teacher copy (Card Library stage 1, 2026-08-21) is newer
  // than every copy already on disk — backfill it here so every downstream
  // reader can assume it is always present, same upgrade-in-place treatment
  // as edgeWaypoints' single-point-to-array fixup above. A copy predating
  // this change was, by construction, this classroom's own override (the
  // tier the field would have recorded had it existed), so the backfill
  // mirrors createTeacherCopy's own owner shape rather than leaving it
  // absent. The next save naturally persists the backfilled value.
  for (const copy of Object.values(parsed.teacherCopies)) {
    if (copy && typeof copy === 'object' && !copy.owner) {
      copy.owner = { tier: 'individual', id: parsed.meta?.owner || null };
    }
  }
  // DELIBERATELY NOT BACKFILLED: `diceRows` / `modalRows` / `logicRows`
  // (Card Library stage 1b, parts i and ii).
  //
  // `owner` above is backfilled because a card without one has no defensible
  // meaning — every card has an owner, the field just didn't exist yet.
  // These three fields are the opposite: ABSENT is a meaning, and it is the
  // meaning that keeps this whole slice inert. The bake reads absent as
  // "this card does not own its slot's dice/modal copy/logic wording — use
  // stock's", which is exactly what every card written before stage 1b was
  // playing. Backfilling from current stock would freeze today's content onto
  // old cards, so a later stock correction (a dice fix, a reworded modal
  // button, a clarified logic question) would silently stop reaching them —
  // the opposite of the drift rule (system corrections keep flowing until the
  // teacher edits that thing themselves). Absent must keep meaning "fall back
  // to stock" forever. Do not add a backfill for any of the three.
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

/**
 * Set (or overwrite) one edge's manual waypoint redirect (G160). edgeId is
 * `${source}__${target}`, matching the client's edge id format — not
 * validated against real connections here (mirrors setSlotPositions:
 * unknown/stale ids are harmless, they just never render since the client
 * only looks up waypoints for edges it actually draws).
 *
 * points is the edge's COMPLETE ordered list of bend points (multi-bend,
 * 2026-08-04) — the client always sends the full array after a drag, never
 * a partial patch, so there's no index drift between client and server.
 * An empty array is rejected (the client should DELETE instead — an edge
 * either has real redirect points or no entry at all, never an empty one).
 * @param {InstanceConfig} config
 * @param {string} edgeId
 * @param {Array<{ x: number|string, y: number|string }>} points
 */
export function setEdgeWaypoints(config, edgeId, points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error(`Invalid waypoints for "${edgeId}": a non-empty array is required (use clear to remove)`);
  }
  const normalized = points.map((p, i) => {
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid waypoint ${i} for "${edgeId}": x/y must be finite numbers`);
    }
    return { x, y };
  });
  config.edgeWaypoints[edgeId] = normalized;
}

/** Clear one edge's waypoint redirect, back to normal auto-routing. */
export function clearEdgeWaypoint(config, edgeId) {
  delete config.edgeWaypoints[edgeId];
}

/** Clear every edge waypoint redirect in this classroom. */
export function clearAllEdgeWaypoints(config) {
  config.edgeWaypoints = {};
}

const VALID_BOX_ANCHORS = ['top', 'right', 'bottom', 'left'];

/**
 * Pin one end of a connector to a fixed side-middle point on its node
 * (box-side anchor snapping, 2026-08-04) instead of the automatic
 * floating attach point. `end` is which end of the edge; `anchor` is
 * which of the node's 4 sides.
 * @param {InstanceConfig} config
 * @param {string} edgeId
 * @param {'source'|'target'} end
 * @param {string} anchor
 */
export function setEdgeAnchor(config, edgeId, end, anchor) {
  if (end !== 'source' && end !== 'target') {
    throw new Error(`Invalid end "${end}": must be "source" or "target"`);
  }
  if (!VALID_BOX_ANCHORS.includes(anchor)) {
    throw new Error(`Invalid anchor "${anchor}": must be one of ${VALID_BOX_ANCHORS.join(', ')}`);
  }
  config.edgeAnchors[edgeId] = { ...config.edgeAnchors[edgeId], [end]: anchor };
}

/** Clear one end's anchor pin, back to the automatic floating attach point. Drops the edge's entry entirely once both ends are cleared. */
export function clearEdgeAnchor(config, edgeId, end) {
  if (end !== 'source' && end !== 'target') {
    throw new Error(`Invalid end "${end}": must be "source" or "target"`);
  }
  if (!config.edgeAnchors[edgeId]) return;
  delete config.edgeAnchors[edgeId][end];
  if (Object.keys(config.edgeAnchors[edgeId]).length === 0) {
    delete config.edgeAnchors[edgeId];
  }
}

/** Clear every edge anchor pin in this classroom. */
export function clearAllEdgeAnchors(config) {
  config.edgeAnchors = {};
}

// ===== Phase 2: switch-off + teacher copies =====

/**
 * Card ownership tiers (CARD_LIBRARY_DESIGN.md "the model"): `official`
 * (curated, ships with the game), `group` (shared across one organization),
 * `individual` (one person's own). Stored STRUCTURALLY — never the skin's
 * display word ("School"/"Teacher", "Club"/"Master") — so a reskin renames
 * decks through the UI_STRINGS vocabulary swap instead of a data migration.
 * Canonical here because this module writes the field; instanceValidation
 * imports it rather than keeping a second copy that can drift.
 */
export const VALID_OWNER_TIERS = new Set(['official', 'group', 'individual']);

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
 *   stockDiceRows?: Array<Object<string, string>>,
 *   stockModalRows?: Array<Object<string, string>>,
 *   stockLogicRows?: Array<Object<string, string>>,
 *   overrides?: Object<string, Object<string, string>>, stockVersion?: string,
 *   tier?: 'official'|'group'|'individual' }} args
 *   overrides is keyed by visit_type ("First"/"Subsequent").
 *   stockDiceRows is the slot's rows from DiceRoll Info.csv, already parsed
 *   and filtered by the caller (mirrors stockRows, and keeps this module free
 *   of a CSV parser). Stored VERBATIM on the card — see below.
 *   stockModalRows is the slot's rows from ModalConfig.csv, same parsed/
 *   filtered-by-caller shape as stockDiceRows. Stored VERBATIM — ModalConfig
 *   carries no routing (CARD_LIBRARY_DESIGN.md "What a card owns"), so a
 *   straight copy is safe.
 *   stockLogicRows is the slot's rows from LOGIC_QUESTIONS.csv, same shape
 *   again. Only WORDING is retained — see the storage block below; this is
 *   never a verbatim copy like the other two.
 *   tier is the new card's ownership tier, defaulting to 'individual' (a
 *   classroom's own override — what every caller before Card Library stage 1
 *   meant). The maintainer's own content edits are written 'official': he is
 *   the curator, so those are exactly the cards that migrate into the shared
 *   library when it is later extracted. Minting an 'official' card is an
 *   ADMIN act — the caller enforces that, this function only records it.
 * @returns {string} the new copy id
 */
export function createTeacherCopy(config, {
  slotName, stockRows, stockDiceRows, stockModalRows, stockLogicRows,
  overrides = {}, stockVersion, tier = 'individual',
}) {
  if (!VALID_OWNER_TIERS.has(tier)) {
    throw new Error(`Invalid tier "${tier}": must be one of ${[...VALID_OWNER_TIERS].join(', ')}`);
  }
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
    // Card ownership tier (CARD_LIBRARY_DESIGN.md stage 1). Defaults to
    // 'individual' — this classroom's own override — which is what a teacher
    // copy has always been; 'official' is the curated deck everyone gets and
    // only an admin-authenticated caller may ask for it. `id` keeps its
    // meaning either way: whoever owns the classroom right now, nullable
    // when no account is bound yet (an official card has no owner account).
    owner: { tier, id: config.meta?.owner || null },
    rows,
  };
  // A card also owns its slot's dice outcomes (CARD_LIBRARY_DESIGN.md stage
  // 1b, "Dice outcomes"): the space's DiceRoll Info rows, VERBATIM — every
  // column (die_roll, visit_type, 1-6, button_label, roll_group), no
  // interpretation, the same way rows above stores its Spaces.csv rows.
  //
  // ABSENT, never []. A space that never rolls gets no diceRows key at all,
  // and absent is what the bake reads as "fall back to stock" — so an empty
  // array would be a THIRD state meaning "this card has no dice", which is a
  // real difference (it would blank the space's dice at bake) and must not be
  // written by accident here.
  if (Array.isArray(stockDiceRows) && stockDiceRows.length > 0) {
    config.teacherCopies[copyId].diceRows = stockDiceRows.map(diceRow => ({
      ...diceRow,
      space_name: slotName, // slot names are the only space identifiers
    }));
  }
  // A card also owns its slot's modal copy (CARD_LIBRARY_DESIGN.md stage 1b
  // part ii): the space's ModalConfig rows, VERBATIM — same treatment as
  // diceRows above. ModalConfig carries no routing (see "What a card owns"),
  // so a straight verbatim copy is safe.
  //
  // ABSENT, never []. Same rationale as diceRows: a space with no modal rows
  // gets no modalRows key at all, and absent is what the bake reads as "fall
  // back to stock".
  if (Array.isArray(stockModalRows) && stockModalRows.length > 0) {
    config.teacherCopies[copyId].modalRows = stockModalRows.map(modalRow => ({
      ...modalRow,
      space_name: slotName, // slot names are the only space identifiers
    }));
  }
  // A card owns its slot's logic-question WORDING (CARD_LIBRARY_DESIGN.md
  // stage 1b part ii, "Logic questions: wording, not routing") — never the
  // routing. Only the two key fields needed to match a stock row at bake time
  // (visit_type, question_id) plus the three wording fields are stored.
  // question_id/yes_target/no_target/auto_answer_from are NOT copied here —
  // deliberately, not just by convention: a card built from this shape
  // literally cannot express a routing change, so no validation rule is ever
  // needed to forbid one. (No space_name either, unlike diceRows/modalRows —
  // matching at bake time is by slot + (visit_type, question_id), which is
  // all a wording-only override needs.)
  //
  // ABSENT, never []. Same rationale as diceRows/modalRows.
  if (Array.isArray(stockLogicRows) && stockLogicRows.length > 0) {
    config.teacherCopies[copyId].logicRows = stockLogicRows.map(logicRow => ({
      visit_type: logicRow.visit_type || '',
      question_id: logicRow.question_id || '',
      question_text: logicRow.question_text || '',
      yes_reason: logicRow.yes_reason || '',
      no_reason: logicRow.no_reason || '',
    }));
  }
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
 * The card a slot is PLAYING, when it belongs to the given tier.
 *
 * Single-pointer lookup, the same one the bake uses — a slot holds one card
 * id and there is no fallback chain (CARD_LIBRARY_DESIGN.md, "The finding
 * that makes tiers cheap"). This is what makes the content editor's save an
 * UPSERT: saving twice must update the card the slot already plays, never
 * stack a second one behind it.
 *
 * Deliberately NOT a search of the whole deck for a matching slot+tier. Once
 * stage 2 makes editing branch, a slot will have several cards to its name and
 * only one of them is in play; "the official card for this slot" would then be
 * ambiguous, but "the card this slot plays, if it is official" never is.
 * @param {InstanceConfig} config
 * @param {string} slotName
 * @param {'official'|'group'|'individual'} [tier] omit to accept any tier
 * @returns {string|null} the copy id, or null
 */
export function findCardForSlot(config, slotName, tier) {
  const copyId = (config.slots || {})[slotName]?.card;
  if (!copyId) return null;
  const copy = (config.teacherCopies || {})[copyId];
  if (!copy) return null;
  if (tier && copy.owner?.tier !== tier) return null;
  return copyId;
}

/**
 * Replace a card's content wholesale (Card Library stage 1, the content
 * editor's save path). Its identity — id, slot, owner, createdAt, the slot
 * pointer — is untouched; only what the card SAYS changes.
 *
 * Not `updateTeacherCopy`: that merges a few fields onto existing rows, which
 * is right for the Classroom Setup field editor and wrong here. The content
 * editor sends the whole space back, so a field the maintainer CLEARED must
 * end up cleared, and a visit row he removed must be gone — a merge would
 * quietly keep both.
 *
 * @param {InstanceConfig} config
 * @param {string} copyId
 * @param {{ rows: Array<Object<string, string>>,
 *   diceRows?: Array<Object<string, string>>,
 *   modalRows?: Array<Object<string, string>>, stockVersion?: string }} content
 *   Row ARRAYS as parsed from the submitted CSVs (createTeacherCopy's shape),
 *   not the by-visit_type map they are stored as.
 */
export function replaceCardContent(config, copyId, { rows, diceRows, modalRows, stockVersion }) {
  const copy = (config.teacherCopies || {})[copyId];
  if (!copy) throw new Error(`No such copy: "${copyId}"`);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No rows given for "${copyId}" — a card must hold at least one row`);
  }
  const next = {};
  for (const row of rows) {
    next[row.visit_type || ''] = {
      ...row,
      space_name: copy.slot, // slot names are the only space identifiers
    };
  }
  copy.rows = next;
  // diceRows / modalRows follow createTeacherCopy's ABSENT-never-[] rule: no
  // rows means delete the key, because absent is what the bake reads as "this
  // card does not own its slot's dice/modal copy — use stock's".
  //
  // KNOWN LIMIT, recorded rather than papered over: that makes "the
  // maintainer deleted every dice row for this space" indistinguishable from
  // "this card never owned its dice", so the space keeps stock's dice. A card
  // has no way to say "no dice at all" today — the resolver's
  // copyDiceRowsBySpace skips empty arrays exactly like missing ones. Giving
  // it one is a change to stage 1b's storage rule, not something to smuggle in
  // here.
  if (Array.isArray(diceRows) && diceRows.length > 0) {
    copy.diceRows = diceRows.map(diceRow => ({ ...diceRow, space_name: copy.slot }));
  } else {
    delete copy.diceRows;
  }
  if (Array.isArray(modalRows) && modalRows.length > 0) {
    copy.modalRows = modalRows.map(modalRow => ({ ...modalRow, space_name: copy.slot }));
  } else {
    delete copy.modalRows;
  }
  // `logicRows` is deliberately NOT touched. The content editor has no
  // logic-question fields, so a save says nothing about them; blanking them
  // would drop wording a card already owns, and writing them would freeze
  // today's stock questions onto the card and cut it off from later
  // corrections (the same reason loadInstance refuses to backfill them).
  if (stockVersion) {
    // This edit was made against the stock the maintainer was just looking at,
    // so the card is current as of that version — clearing the stale
    // COPY_STOCK_UPDATED "the original changed, worth a review" flag is the
    // honest outcome, not a lost warning.
    copy.copiedFromStockVersion = stockVersion;
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
 * @property {number} [feePercent] optional First-visit fee as a percentage (slice 4); wins over flat fee
 * @property {'loans'|'scope'} [feeBasis] what the percentage is charged on — the player's loans (default) or project scope
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
 *   time?: string, fee?: string, feePercent?: string|number, feeBasis?: 'loans'|'scope',
 *   pos_x?: string|number, pos_y?: string|number,
 *   cardDraw?: { type: string, count: string|number }|null,
 *   diceOutcomes?: string[]|null }} spec
 * @returns {string} the new authored space id
 */
export function addInsertion(config, { from, to, displayName, story, time, fee, feePercent, feeBasis, pos_x, pos_y, cardDraw, diceOutcomes }) {
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
    ...(feeBasis === 'scope' ? { feeBasis: 'scope' } : {}),
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
  // feeBasis: only 'scope' is stored; anything else (incl. 'loans'/null) is the default.
  if (patch.feeBasis !== undefined) {
    next.feeBasis = patch.feeBasis === 'scope' ? 'scope' : undefined;
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
