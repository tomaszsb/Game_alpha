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
 * Full config validation: protection tiers, unknown names, detour
 * resolution, teacher-copy integrity + schema drift. Returns a report —
 * the same one the catalog UI displays and the bake enforces.
 *
 * @param {{ config: any, stockSpacesCsv: string, pathChoiceCsv?: string, stockVersion?: string }} args
 * @returns {{ ok: boolean,
 *             errors: Array<{ code: string, space?: string, copyId?: string, message: string, candidates?: string[] }>,
 *             warnings: Array<{ code: string, space?: string, copyId?: string, message: string }>,
 *             detours: Object<string, string>,
 *             suggestions: Object<string, { target: string|null, candidates: string[] }> }}
 */
export function validateConfig({ config, stockSpacesCsv, pathChoiceCsv, stockVersion }) {
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
