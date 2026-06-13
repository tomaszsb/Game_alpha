// server/instanceCatalog.js
// Teacher instance layer, Phase 2 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// Composes the catalog the Classroom Setup screen browses: the FULL stock
// deck (including switched-off spaces — the resolved board deliberately
// omits those, so the UI cannot read them from /data), each card's state
// in this classroom (in play / off+detour / custom copy), and its
// protection tier so the UI can disable forbidden switches with reasons.
//
// Pure module; server.js wires it into GET /api/instances/:id/catalog.

import { parseCsvWithHeaders } from './processGameData.js';
import { computeProtection } from './spaceProtection.js';
import { inactiveSpaces } from './instanceValidation.js';

// The safe field subset the catalog editor exposes (spec: UI starts with
// title, narrative text, and fees; the data model stores full copies
// underneath, so widening this later is a UI change only).
export const EDITABLE_FIELDS = ['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee'];

/**
 * @param {{ stockSpacesCsv: string, pathChoiceCsv?: string,
 *   config: import('./instanceStore.js').InstanceConfig, stockVersion?: string }} args
 * @returns {{ stockVersion: string|undefined, editableFields: string[],
 *   spaces: Array<{ name: string, phase: string, title: string, used: boolean,
 *     protection: { tier: string, reason: string }|null, copyId: string|null,
 *     detour: string|null, stock: Object<string, Object<string, string>> }> }}
 */
export function buildCatalog({ stockSpacesCsv, pathChoiceCsv, config, stockVersion }) {
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
      byName.set(name, { name, phase: (row.phase || '').trim(), stock: {} });
    }
    const entry = byName.get(name);
    const fields = {};
    for (const field of EDITABLE_FIELDS) fields[field] = row[field] ?? '';
    entry.stock[row.visit_type || ''] = fields;
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

  return { stockVersion, editableFields: EDITABLE_FIELDS, spaces };
}
