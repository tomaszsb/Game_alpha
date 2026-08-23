// server/instanceContentDiff.js
// Card Library stage 1, final slice (docs/core/CARD_LIBRARY_DESIGN.md
// "Build order" → stage 1, "stop losing work").
//
// The Space Data Editor posts three WHOLE CSVs (Spaces, DiceRoll Info,
// ModalConfig) — the same payload it has always posted. This module answers
// the one question that turns that payload into cards: which spaces did the
// maintainer actually CHANGE? Everything a save then does — auth, upsert,
// validate, bake — is the route's job.
//
// The diff lives server-side ON PURPOSE. The editor's data model is left
// alone (a whole-file post is what it knows how to produce), so the client
// change is a URL, and every rule about what counts as an edit sits in a pure
// module a unit test can reach.
//
// Pure: no fs, no config, no clock, no side effects.

import { parseCsvWithHeaders } from './processGameData.js';

/**
 * Group a CSV's rows by space_name, in file order.
 *
 * Rows with no space_name are dropped. Stock's Spaces.csv genuinely contains
 * 53 of them (a row's button labels sitting on their own physical line), and
 * the editor's own parser drops them too — so they can never be part of a
 * space's content on either side of the comparison, and including them would
 * make every space look changed.
 * @param {string|null|undefined} csv
 * @returns {Map<string, Array<Object<string, string>>>}
 */
function rowsBySpace(csv) {
  const bySpace = new Map();
  if (!csv) return bySpace;
  for (const row of parseCsvWithHeaders(csv)) {
    const name = (row.space_name || '').trim();
    if (!name) continue;
    const list = bySpace.get(name);
    if (list) list.push(row);
    else bySpace.set(name, [row]);
  }
  return bySpace;
}

/**
 * Do two parsed rows mean the same thing?
 *
 * Compared FIELD BY FIELD over the union of both rows' columns, never as
 * text. The submitted CSV and the stock CSV say the same thing in different
 * bytes as a matter of course: the editor writes its own canonical column
 * order, re-quotes fields by its own rule, and drops stock's byte-order mark.
 * A text comparison would report all 27 spaces changed on a save that touched
 * nothing.
 *
 * A missing column and an empty one are the same (`''`); a column the editor
 * doesn't know about rides through `_extraColumns` and lands back in the
 * payload, so its absence would be a real difference worth catching.
 */
/**
 * Columns the Space Data Editor does not own, and must never mint a card over.
 *
 * `pos_x`/`pos_y` are the BOARD LAYOUT editor's — dragged tiles are saved
 * through `/api/instances/:id/positions`, and the bake overlays them onto
 * every positioned space. The content editor loads that baked board, so a
 * classroom whose tiles have been arranged (i.e. any real one) submitted
 * every space back with positions stock has never seen. Every space then read
 * as edited: one save on one space minted a card for all 26 (reported live,
 * 2026-08-22). Moving a tile is not changing what a space says.
 */
const NOT_CONTENT = new Set(['pos_x', 'pos_y']);

function rowsEqual(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) {
    if (NOT_CONTENT.has(key)) continue;
    if (String((a || {})[key] ?? '') !== String((b || {})[key] ?? '')) return false;
  }
  return true;
}

/** Row-for-row, in order. A reordered list counts as changed — the editor
 *  preserves file order, so a reorder is something the maintainer did. */
function rowListsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!rowsEqual(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Compare a Space Data Editor save against the shipped stock, per space.
 *
 * A space counts as CHANGED when any of the three files disagrees with stock
 * about it — its Spaces rows, its dice rows, or its modal rows. All three,
 * not just Spaces.csv: the editor edits dice rows inline (InlineDiceRollEditor)
 * and a dice-only edit is exactly the kind of change that used to evaporate on
 * restart, so ignoring it here would leave half the bug alive.
 *
 * @param {{ submittedSpacesCsv: string, submittedDiceCsv?: string|null,
 *   submittedModalCsv?: string|null, stockSpacesCsv: string,
 *   stockDiceCsv?: string|null, stockModalCsv?: string|null }} args
 * @returns {{
 *   changed: Array<{ slot: string, rows: Array<Object<string, string>>,
 *     diceRows: Array<Object<string, string>>, modalRows: Array<Object<string, string>> }>,
 *   unchanged: string[],
 *   unknown: string[],
 * }} `changed` in submitted-file order; `unknown` names spaces the payload
 *   carries that stock has never heard of (see below).
 */
export function diffSubmittedContent({
  submittedSpacesCsv,
  submittedDiceCsv,
  submittedModalCsv,
  stockSpacesCsv,
  stockDiceCsv,
  stockModalCsv,
  baselineSpacesCsv,
  baselineDiceCsv,
  baselineModalCsv,
}) {
  const submittedSpaces = rowsBySpace(submittedSpacesCsv);
  const submittedDice = rowsBySpace(submittedDiceCsv);
  const submittedModal = rowsBySpace(submittedModalCsv);
  const stockSpaces = rowsBySpace(stockSpacesCsv);
  // The BASELINE is what the editor actually loaded — the classroom's baked
  // board — not the shipped stock. "Changed" has to mean "the maintainer
  // changed it", and the bake legitimately differs from stock for reasons
  // that are nobody's edit: tile positions, a card already in play, a
  // switched-off space, a detour. Comparing to stock counted all of those as
  // edits. Stock is still needed separately, to answer whether a submitted
  // space is a slot that exists at all.
  const baseSpaces = baselineSpacesCsv ? rowsBySpace(baselineSpacesCsv) : stockSpaces;
  const baseDice = baselineSpacesCsv ? rowsBySpace(baselineDiceCsv) : rowsBySpace(stockDiceCsv);
  const baseModal = baselineSpacesCsv ? rowsBySpace(baselineModalCsv) : rowsBySpace(stockModalCsv);

  const changed = [];
  const unchanged = [];
  const unknown = [];

  for (const [slot, rows] of submittedSpaces) {
    // A card fills a SLOT, and slots are stock's space names. A space the
    // editor invented has no slot to fill, so it is reported back rather than
    // minted — authoring a brand-new space is what insertions are for
    // (Phase 4a), and a card pointing at a name stock doesn't have would fail
    // validation as COPY_UNKNOWN_SLOT anyway.
    if (!stockSpaces.has(slot)) {
      unknown.push(slot);
      continue;
    }
    const diceRows = submittedDice.get(slot) || [];
    const modalRows = submittedModal.get(slot) || [];
    const same = rowListsEqual(rows, baseSpaces.get(slot))
      && rowListsEqual(diceRows, baseDice.get(slot) || [])
      && rowListsEqual(modalRows, baseModal.get(slot) || []);
    if (same) unchanged.push(slot);
    else changed.push({ slot, rows, diceRows, modalRows });
  }

  // A space stock has that the payload does not is NOT treated as a deletion.
  // Removing a space from the board is switching its slot off (Classroom
  // Setup, with the detour flow that keeps the board connected) — not
  // something a content save may do silently.
  return { changed, unchanged, unknown };
}
