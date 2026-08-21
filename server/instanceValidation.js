// server/instanceValidation.js
// Teacher instance layer, Phase 2 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// Validates a classroom config against the current stock and resolves
// detours for switched-off spaces. This is the data source for the hybrid
// confirm flow: the UI shows the computed pass-through ("Fee review will
// now lead to Audit") pre-filled, lets the teacher override, and a save
// with errors is rejected — never silently auto-fixed.
//
// Pure module: no filesystem, no server state. The resolver calls
// validateConfig at bake time (errors abort the bake); the board endpoint
// calls it in dry-run mode for the preview.

import { parseCsvWithHeaders } from './processGameData.js';
import { computeProtection } from './spaceProtection.js';

// Same token shape processGameData's isValidSpaceName accepts — destination
// cells can be free text (logic conditions, "A or B") with embedded names.
const SPACE_TOKEN = /[A-Z][A-Z0-9-]{2,}/g;

/** Extract known space names referenced anywhere in a cell's text. */
export function extractSpaceTokens(text, knownSpaces) {
  const out = [];
  for (const token of String(text || '').match(SPACE_TOKEN) || []) {
    if (knownSpaces.has(token)) out.push(token);
  }
  return out;
}

/**
 * Map each dice-MOVEMENT source space name → the Set of destinations reachable
 * from its roll columns (1-6). Compound cells ("A or B") and free text
 * contribute every known token. Phase 4b uses this to verify a dice A→B edge
 * exists — and the map's keys identify which spaces actually route by dice.
 *
 * Only `die_roll === 'Next Step'` rows are movement: that is exactly what the
 * engine routes on (processGameData.js skips every other die_roll). Spaces with
 * a `requires_dice_roll=Yes` *effect* roll (W Cards / Time outcomes / Fees Paid)
 * still move along their fixed `space_N` edge, so they must NOT appear here —
 * otherwise validation/catalog would look for their onward edge in an empty
 * dice table instead of `space_N` (the parallel-systems drift this guards).
 * @returns {Map<string, Set<string>>}
 */
export function buildDiceDests(diceCsv, knownSpaces) {
  const map = new Map();
  if (!diceCsv) return map;
  for (const row of parseCsvWithHeaders(diceCsv)) {
    if ((row.die_roll || '').trim() !== 'Next Step') continue;
    const name = (row.space_name || '').trim();
    if (!name) continue;
    let set = map.get(name);
    if (!set) { set = new Set(); map.set(name, set); }
    for (const col of ['1', '2', '3', '4', '5', '6']) {
      for (const token of extractSpaceTokens(row[col], knownSpaces)) set.add(token);
    }
  }
  return map;
}

/** @returns {Set<string>} space names with slots marked used:false */
export function inactiveSpaces(config) {
  const off = new Set();
  for (const [name, slot] of Object.entries(config.slots || {})) {
    if (slot && slot.used === false) off.add(name);
  }
  return off;
}

function buildSpaceIndex(stockSpacesCsv) {
  const rows = parseCsvWithHeaders(stockSpacesCsv);
  const names = new Set();
  const rowsByName = new Map();
  for (const row of rows) {
    const name = (row.space_name || '').trim();
    if (!name) continue;
    names.add(name);
    if (!rowsByName.has(name)) rowsByName.set(name, []);
    rowsByName.get(name).push(row);
  }
  return { rows, names, rowsByName, headers: Object.keys(rows[0] || {}) };
}

/**
 * The pass-through suggestion: follow a space's own outgoing movement.
 * Returns the single unambiguous next space, or null with candidates when
 * the teacher must choose (dice/choice spaces have no single "next").
 */
function directDestinations(name, rowsByName, knownSpaces) {
  const out = new Set();
  for (const row of rowsByName.get(name) || []) {
    for (let i = 1; i <= 5; i++) {
      for (const token of extractSpaceTokens(row[`space_${i}`], knownSpaces)) {
        if (token !== name) out.add(token);
      }
    }
  }
  return [...out];
}

/**
 * Resolve every switched-off space to its final active destination.
 * Explicit detours (config.detours) win; otherwise the pass-through is
 * computed. Chains resolve transitively; cycles and ambiguity are errors.
 *
 * @returns {{ detours: Object<string, string>,
 *             suggestions: Object<string, { target: string|null, candidates: string[] }>,
 *             errors: Array<{ code: string, space: string, message: string, candidates?: string[] }> }}
 */
export function resolveDetours({ config, stockSpacesCsv }) {
  const { names, rowsByName } = buildSpaceIndex(stockSpacesCsv);
  const off = inactiveSpaces(config);
  const explicit = config.detours || {};
  const detours = {};
  const suggestions = {};
  const errors = [];

  // One hop: explicit detour, or unambiguous pass-through.
  function nextHop(name) {
    const chosen = (explicit[name] || '').trim();
    if (chosen) {
      if (!names.has(chosen)) {
        errors.push({ code: 'DETOUR_TARGET_UNKNOWN', space: name, message: `Detour target "${chosen}" is not a space on the board` });
        return null;
      }
      return chosen;
    }
    const candidates = directDestinations(name, rowsByName, names);
    suggestions[name] = { target: candidates.length === 1 ? candidates[0] : null, candidates };
    if (candidates.length === 1) return candidates[0];
    errors.push({
      code: 'DETOUR_AMBIGUOUS',
      space: name,
      message: candidates.length === 0
        ? `"${name}" has no single onward path (dice or end space) — pick where players should go instead`
        : `"${name}" leads to several places — pick where players should go instead`,
      candidates,
    });
    return null;
  }

  for (const name of off) {
    const visited = new Set([name]);
    let current = name;
    let target = null;
    while (true) {
      const hop = nextHop(current);
      if (!hop) break;
      if (visited.has(hop)) {
        errors.push({ code: 'DETOUR_CYCLE', space: name, message: `Detour loop: ${[...visited, hop].join(' → ')} — adjust a detour target` });
        break;
      }
      if (!off.has(hop)) {
        target = hop;
        break;
      }
      visited.add(hop);
      current = hop;
    }
    if (target) detours[name] = target;
  }

  return { detours, suggestions, errors };
}

/**
 * Validate teacher-authored insertions (Phase 4a + 4b fork-splice). Each
 * authored space sits on a single A→B edge. Errors (never auto-fixed, same
 * contract as detours):
 *  - endpoint unknown / switched off
 *  - the A→B edge does not actually exist (insertion would be meaningless) —
 *    checked against the dice table when `from` is a dice source (4b)
 *  - `from` is a path-choice lock point (rewriting its remembered destination
 *    would break the choice memory — never spliceable)
 *  - authored id collides with a stock space name
 *  - two insertions claim the same edge (chain ordering is a later feature)
 *  - from === to
 * @param {{ config: any, names: Set<string>, rowsByName: Map<string, Array>,
 *   off: Set<string>, diceDests?: Map<string, Set<string>> }} args
 * @returns {Array<{ code: string, insertionId: string, message: string }>}
 */
export function validateInsertions({ config, names, rowsByName, off, diceDests = new Map() }) {
  const errors = [];
  const insertions = config.insertions || {};
  const seenEdges = new Map(); // "from→to" → first insertionId on it

  for (const [id, ins] of Object.entries(insertions)) {
    const where = (msg) => errors.push({ code: msg.code, insertionId: id, message: msg.message });
    if (!ins || !ins.from || !ins.to) {
      where({ code: 'INSERT_INCOMPLETE', message: `Insertion "${id}" is missing its from/to edge` });
      continue;
    }
    const { from, to } = ins;

    if (names.has(id)) {
      where({ code: 'INSERT_ID_COLLISION', message: `Authored id "${id}" collides with a stock space name` });
    }
    if (from === to) {
      where({ code: 'INSERT_SELF_EDGE', message: `Insertion "${id}" has from === to ("${from}")` });
      continue;
    }
    if (!names.has(from)) {
      where({ code: 'INSERT_ENDPOINT_UNKNOWN', message: `Insertion "${id}": "${from}" is not a space on the board` });
    } else if (off.has(from)) {
      where({ code: 'INSERT_ENDPOINT_OFF', message: `Insertion "${id}": "${from}" is switched off — re-enable it or move the insertion` });
    }
    if (!names.has(to)) {
      where({ code: 'INSERT_ENDPOINT_UNKNOWN', message: `Insertion "${id}": "${to}" is not a space on the board` });
    } else if (off.has(to)) {
      where({ code: 'INSERT_ENDPOINT_OFF', message: `Insertion "${id}": "${to}" is switched off — re-enable it or move the insertion` });
    }

    // The A→B edge must exist on `from` (else "insert between A and B" is
    // meaningless). A path-choice lock point is never spliceable — it
    // remembers which destination the player chose, and rewriting that
    // destination to the authored id would break the memory. A dice-MOVEMENT
    // source (4b) keeps its edges in the dice table, so check there; otherwise
    // the fixed/choice `space_N` cells (4a). "Dice source" is keyed off the
    // dice table's Next Step rows (diceDests), NOT requires_dice_roll — a space
    // with only an *effect* roll (W Cards / Fees) still moves by its fixed edge.
    if (names.has(from) && names.has(to)) {
      const fromRows = rowsByName.get(from) || [];
      const isLockPoint = fromRows.some(r => String(r.is_path_choice_lock_point || '').trim().toLowerCase() === 'yes');
      const isDice = diceDests.has(from);
      if (isLockPoint) {
        where({ code: 'INSERT_ON_LOCK_POINT', message: `Insertion "${id}": "${from}" remembers which path the player picked — splicing a space here would break that choice. Pick a different edge.` });
      } else if (isDice) {
        const dests = diceDests.get(from) || new Set();
        if (!dests.has(to)) {
          where({ code: 'INSERT_EDGE_MISSING', message: `Insertion "${id}": there is no "${from}" → "${to}" dice outcome to splice into` });
        }
      } else {
        const dests = new Set(directDestinations(from, rowsByName, names));
        if (!dests.has(to)) {
          where({ code: 'INSERT_EDGE_MISSING', message: `Insertion "${id}": there is no "${from}" → "${to}" edge to splice into` });
        }
      }
    }

    const edgeKey = `${from} ${to}`;
    if (seenEdges.has(edgeKey)) {
      where({ code: 'INSERT_EDGE_OCCUPIED', message: `Insertions "${seenEdges.get(edgeKey)}" and "${id}" both target the "${from}" → "${to}" edge — only one per edge in Phase 4a` });
    } else {
      seenEdges.set(edgeKey, id);
    }

    // Card draw (slice 2): optional, but if present the type must be a real
    // deck and the count a small positive integer.
    if (ins.cardDraw != null) {
      const type = String(ins.cardDraw.type || '').trim().toUpperCase();
      const count = Number(ins.cardDraw.count);
      if (!CARD_DECKS.has(type) || !Number.isInteger(count) || count < 1 || count > MAX_CARD_DRAW) {
        where({ code: 'INSERT_BAD_CARD_DRAW', message: `Insertion "${id}": card draw must be 1–${MAX_CARD_DRAW} of W, B, I, L or E` });
      }
    }

    // Dice outcomes (slice 3): optional, but if present must assign all six die
    // faces to a space that's on the board, switched on, and not the authored
    // space itself (a self-loop would trap the player).
    if (ins.diceOutcomes != null) {
      const faces = ins.diceOutcomes;
      if (!Array.isArray(faces) || faces.length !== DIE_FACES) {
        where({ code: 'INSERT_BAD_DICE_OUTCOMES', message: `Insertion "${id}": a dice space must set all ${DIE_FACES} die faces` });
      } else {
        for (const dest of faces) {
          const d = String(dest || '').trim();
          if (!d || !names.has(d) || off.has(d) || d === id) {
            where({ code: 'INSERT_BAD_DICE_OUTCOMES', message: `Insertion "${id}": every die face must point to a space that is on the board and switched on (not the new space itself)` });
            break;
          }
        }
      }
    }

    // Percentage fee (slice 4): optional, but if present must be a positive
    // percentage no greater than 100 (charged against the player's loans).
    if (ins.feePercent != null && ins.feePercent !== '') {
      const pct = Number(ins.feePercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        where({ code: 'INSERT_BAD_FEE_PERCENT', message: `Insertion "${id}": a percentage fee must be more than 0 and at most 100` });
      }
    }
  }
  return errors;
}

/** Card decks an authored space may deal from, and a sane upper bound. */
const CARD_DECKS = new Set(['W', 'B', 'I', 'L', 'E']);
const MAX_CARD_DRAW = 9;
/** A die has six faces — an authored dice space must assign all of them. */
const DIE_FACES = 6;
/** Card ownership tiers (CARD_LIBRARY_DESIGN.md "the model") — stored
 *  structurally, never the skin's display word. */
const VALID_OWNER_TIERS = new Set(['official', 'group', 'individual']);

/**
 * Full config validation: protection tiers, unknown names, detour
 * resolution, teacher-copy integrity + schema drift. Returns a report —
 * the same one the catalog UI displays and the bake enforces.
 *
 * @param {{ config: any, stockSpacesCsv: string, pathChoiceCsv?: string, diceCsv?: string, stockVersion?: string }} args
 * @returns {{ ok: boolean,
 *             errors: Array<{ code: string, space?: string, copyId?: string, message: string, candidates?: string[] }>,
 *             warnings: Array<{ code: string, space?: string, copyId?: string, message: string }>,
 *             detours: Object<string, string>,
 *             suggestions: Object<string, { target: string|null, candidates: string[] }> }}
 */
export function validateConfig({ config, stockSpacesCsv, pathChoiceCsv, diceCsv, stockVersion }) {
  const errors = [];
  const warnings = [];
  const { names, rowsByName, headers } = buildSpaceIndex(stockSpacesCsv);
  const protection = computeProtection({ stockSpacesCsv, pathChoiceCsv });

  // Slots must point at real spaces; switched-off ones must be allowed off.
  for (const [name, slot] of Object.entries(config.slots || {})) {
    if (!names.has(name)) {
      warnings.push({ code: 'SLOT_UNKNOWN_SPACE', space: name, message: `Slot "${name}" does not exist in current stock (ignored by the bake)` });
      continue;
    }
    if (slot && slot.used === false) {
      const guard = protection.get(name);
      if (guard) {
        errors.push({
          code: 'PROTECTED_SPACE',
          space: name,
          message: `"${name}" cannot be switched off: ${guard.reason} (${guard.tier})`,
        });
      }
    }
  }

  // Teacher copies: must belong to a real slot, slot.card must match, and
  // structure is compared against the current stock schema (spec: structure
  // aligns automatically at bake; meaning never does — drift is a warning
  // plus a flag, never an auto-merge).
  const headerSet = new Set(headers);
  for (const [copyId, copy] of Object.entries(config.teacherCopies || {})) {
    if (!copy || !copy.slot || !names.has(copy.slot)) {
      errors.push({ code: 'COPY_UNKNOWN_SLOT', copyId, message: `Copy "${copyId}" refers to unknown space "${copy?.slot}"` });
      continue;
    }
    const slot = (config.slots || {})[copy.slot];
    if (!slot || slot.card !== copyId) {
      warnings.push({ code: 'COPY_UNPLAYED', copyId, space: copy.slot, message: `Copy "${copyId}" exists but is not in play (slot uses a different card)` });
    }
    const stockFields = headerSet;
    const copyFields = new Set(Object.keys(Object.values(copy.rows || {})[0] || {}));
    const missing = [...stockFields].filter(f => !copyFields.has(f));
    const obsolete = [...copyFields].filter(f => !stockFields.has(f));
    if (missing.length || obsolete.length) {
      warnings.push({
        code: 'COPY_SCHEMA_DRIFT',
        copyId,
        space: copy.slot,
        message: `Copy "${copyId}" structure differs from current stock`
          + (missing.length ? ` (missing: ${missing.join(', ')} — filled from stock at bake)` : '')
          + (obsolete.length ? ` (obsolete: ${obsolete.join(', ')} — dropped at bake)` : ''),
      });
    }
    if (stockVersion && copy.copiedFromStockVersion && copy.copiedFromStockVersion !== stockVersion) {
      warnings.push({
        code: 'COPY_STOCK_UPDATED',
        copyId,
        space: copy.slot,
        message: `The stock card for "${copy.slot}" has been updated since this copy was made — worth a review`,
      });
    }
    // Copies of switched-off or missing rows still bake fine; but a copy
    // must never rename its space (slot names are the only identifiers).
    for (const row of Object.values(copy.rows || {})) {
      if (row.space_name && row.space_name !== copy.slot) {
        errors.push({ code: 'COPY_RENAMES_SLOT', copyId, space: copy.slot, message: `Copy "${copyId}" must keep space_name "${copy.slot}"` });
        break;
      }
    }

    // Card ownership tier (CARD_LIBRARY_DESIGN.md stage 1). A missing owner
    // is fine — loadInstance backfills it — but a PRESENT owner that is not
    // an object, or names a tier outside the three the model defines, is
    // malformed data and must be rejected rather than silently baked.
    if (copy.owner !== undefined) {
      const tier = copy.owner && typeof copy.owner === 'object' ? copy.owner.tier : undefined;
      if (!copy.owner || typeof copy.owner !== 'object' || !VALID_OWNER_TIERS.has(tier)) {
        errors.push({ code: 'COPY_BAD_OWNER', copyId, space: copy.slot, message: `Copy "${copyId}" has a malformed owner (tier must be one of ${[...VALID_OWNER_TIERS].join(', ')})` });
      }
    }
  }

  // Slots pointing at cards that don't exist.
  for (const [name, slot] of Object.entries(config.slots || {})) {
    if (slot && slot.card && !(config.teacherCopies || {})[slot.card]) {
      errors.push({ code: 'SLOT_UNKNOWN_CARD', space: name, message: `Slot "${name}" plays card "${slot.card}" which does not exist` });
    }
  }

  // Detours for everything switched off.
  const resolution = resolveDetours({ config, stockSpacesCsv });
  errors.push(...resolution.errors);

  // Teacher-authored insertions (Phase 4a fixed/choice edges + 4b dice edges).
  errors.push(...validateInsertions({
    config, names, rowsByName,
    off: inactiveSpaces(config),
    diceDests: buildDiceDests(diceCsv, names),
  }));

  // PATH_CHOICE_RULES must never reference a switched-off space. Protection
  // already forbids disabling participants, so hitting this means the rules
  // and protection drifted apart — surface loudly rather than bake garbage.
  const off = inactiveSpaces(config);
  if (pathChoiceCsv && off.size) {
    for (const row of parseCsvWithHeaders(pathChoiceCsv)) {
      for (const field of ['affected_space', 'chosen_value', 'excluded_destination']) {
        const ref = (row[field] || '').trim();
        if (off.has(ref)) {
          errors.push({ code: 'PATH_CHOICE_REFERENCES_OFF_SPACE', space: ref, message: `Path-choice rules reference switched-off space "${ref}"` });
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    detours: resolution.detours,
    suggestions: resolution.suggestions,
  };
}
