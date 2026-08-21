// server/instanceCatalog.js
// Teacher instance layer, Phase 2 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// Composes the catalog the Classroom Setup screen browses: the FULL stock
// deck (including switched-off spaces — the resolved board deliberately
// omits those, so the UI cannot read them from /data), each card's state
// in this classroom (in play / off+detour / custom copy), and its
// protection tier so the UI can disable forbidden switches with reasons.
//
// Pure module; server.js wires it into GET /api/instances/:id/catalog. The
// response's `copies` field (server.js: `copies: config.teacherCopies`) is a
// raw pass-through of the classroom's teacher copies, not composed here — so
// each copy's `owner` (CARD_LIBRARY_DESIGN.md stage 1: card ownership tier,
// written by instanceStore.createTeacherCopy / backfilled by loadInstance)
// already rides along automatically. Nothing in this file renders it; the
// client type lives in classroomApi.ts's TeacherCopy interface.

import { parseCsvWithHeaders } from './processGameData.js';
import { computeProtection } from './spaceProtection.js';
import { inactiveSpaces, buildDiceDests } from './instanceValidation.js';

// The safe field subset the catalog editor exposes (spec: UI starts with
// title, narrative text, and fees; the data model stores full copies
// underneath, so widening this later is a UI change only).
export const EDITABLE_FIELDS = ['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee'];

/**
 * @param {{ stockSpacesCsv: string, pathChoiceCsv?: string, diceCsv?: string,
 *   config: import('./instanceStore.js').InstanceConfig, stockVersion?: string }} args
 * @returns {{ stockVersion: string|undefined, editableFields: string[],
 *   spaces: Array<{ name: string, phase: string, title: string, used: boolean,
 *     protection: { tier: string, reason: string }|null, copyId: string|null,
 *     detour: string|null, stock: Object<string, Object<string, string>> }> }}
 */
export function buildCatalog({ stockSpacesCsv, pathChoiceCsv, diceCsv, config, stockVersion }) {
  const protection = computeProtection({ stockSpacesCsv, pathChoiceCsv });
  const off = inactiveSpaces(config);
  const slots = config.slots || {};
  const copies = config.teacherCopies || {};
  const detours = config.detours || {};

  const byName = new Map();
  for (const row of parseCsvWithHeaders(stockSpacesCsv)) {
    const name = (row.space_name || '').trim();
    if (!name) continue;
    if (!byName.has(name)) {
      byName.set(name, { name, phase: (row.phase || '').trim(), stock: {}, dice: false, lock: false, destCells: [] });
    }
    const entry = byName.get(name);
    const fields = {};
    for (const field of EDITABLE_FIELDS) fields[field] = row[field] ?? '';
    entry.stock[row.visit_type || ''] = fields;
    if (String(row.is_path_choice_lock_point || '').trim().toLowerCase() === 'yes') entry.lock = true;
    for (let i = 1; i <= 5; i++) {
      if (row[`space_${i}`]) entry.destCells.push(row[`space_${i}`]);
    }
  }

  // Insertion edges the UI offers in its "pick an edge to splice" dropdown.
  // Fixed/choice edges (4a) come from the `space_N` cells; dice edges (4b)
  // come from the dice table. Lock-point sources are never offered — splicing
  // their remembered destination breaks the choice memory. The server
  // re-validates every save regardless.
  const known = new Set(byName.keys());
  const diceDests = buildDiceDests(diceCsv, known);
  // A space routes by dice only if the dice table has a Next Step (movement)
  // row for it — same key the engine + validateInsertions use. A
  // requires_dice_roll=Yes space whose only roll is an effect (W Cards / Time /
  // Fees) still moves along its fixed space_N edge, so it must enumerate those.
  for (const entry of byName.values()) entry.dice = diceDests.has(entry.name);
  const edges = [];
  const seen = new Set();
  for (const entry of byName.values()) {
    if (entry.lock) continue;
    const dests = new Set();
    if (entry.dice) {
      for (const token of diceDests.get(entry.name) || []) dests.add(token);
    } else {
      for (const cell of entry.destCells) {
        for (const token of String(cell).match(/[A-Z][A-Z0-9-]{2,}/g) || []) {
          if (known.has(token)) dests.add(token);
        }
      }
    }
    for (const token of dests) {
      if (token === entry.name) continue;
      const key = `${entry.name} ${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: entry.name, to: token, dice: entry.dice });
    }
  }

  const spaces = [...byName.values()].map(entry => {
    const slot = slots[entry.name] || {};
    return {
      name: entry.name,
      phase: entry.phase,
      title: entry.stock['First']?.Title || Object.values(entry.stock)[0]?.Title || entry.name,
      used: !off.has(entry.name),
      protection: protection.get(entry.name) || null,
      copyId: slot.card && copies[slot.card] ? slot.card : null,
      detour: detours[entry.name] || null,
      stock: entry.stock,
    };
  });

  return {
    stockVersion,
    editableFields: EDITABLE_FIELDS,
    spaces,
    edges,
    insertions: config.insertions || {},
  };
}
