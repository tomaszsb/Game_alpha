// server/instanceResolver.js
// Teacher instance layer, Phase 1 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// "Baking": stock data + one classroom's config → a resolved, ready-to-serve
// data set under <instancesRoot>/<id>/resolved/ (SOURCE_FILES + CLEAN_FILES,
// same shape the client already reads). Gameplay never composes at runtime.
//
// Spec invariants implemented here:
// - Atomic resolved-output replacement: bake into a fresh directory, rename
//   it into place as a unit. Never regenerate resolved files in place.
// - Version stamps: bake-stamp.json carries {configVersion, stockVersion};
//   game creation requires configVersion == resolvedVersion.
// - Slot names are the only space identifiers in baked files (copy ids are
//   catalog metadata — Phase 2 substitution honors this too).
// - Fault isolation: bakeInstance throws on failure; callers catch so one
//   corrupt classroom can never block server boot or other classrooms.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processGameData, parseCsvLine, parseCsvWithHeaders, toCsv } from './processGameData.js';
import { validateConfig, inactiveSpaces } from './instanceValidation.js';
import { assertValidInstanceId } from './instanceStore.js';

const STAMP_FILE = 'bake-stamp.json';
const SPACES_CSV = 'Spaces.csv';
const DICE_CSV = 'DiceRoll Info.csv';
const MODAL_CSV = 'ModalConfig.csv';
const LOGIC_CSV = 'LOGIC_QUESTIONS.csv';

/**
 * Deterministic identity of the stock deck: hash of every file under
 * SOURCE_FILES + CLEAN_FILES (names + contents, sorted). Deliberately NOT
 * VITE_GIT_COMMIT — that env var is build-time only and reads "dev" in the
 * container at runtime, so it cannot distinguish deploys.
 */
export function computeStockVersion(stockDataDir) {
  const hash = crypto.createHash('sha256');
  for (const sub of ['SOURCE_FILES', 'CLEAN_FILES']) {
    const dir = path.join(stockDataDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const filePath = path.join(dir, name);
      if (!fs.statSync(filePath).isFile()) continue;
      hash.update(`${sub}/${name}\n`);
      hash.update(fs.readFileSync(filePath));
      hash.update('\n');
    }
  }
  return hash.digest('hex');
}

/**
 * Overlay classroom tile positions onto the stock Spaces.csv. Positions are
 * per-space (both visit rows get the same coordinates). Unknown slot names
 * are ignored — validation happens at the endpoint, not in the bake.
 * @param {string} spacesCsv
 * @param {Object<string, import('./instanceStore.js').SlotConfig>} slots
 * @returns {string}
 */
export function applyPositionsToSpacesCsv(spacesCsv, slots) {
  const headerLine = spacesCsv.replace(/^\uFEFF/, '').split('\n')[0].replace(/\r$/, '');
  const headers = parseCsvLine(headerLine);
  const rows = parseCsvWithHeaders(spacesCsv);
  for (const row of rows) {
    const slot = slots[row.space_name];
    if (slot && slot.pos_x != null && slot.pos_y != null) {
      row.pos_x = String(slot.pos_x);
      row.pos_y = String(slot.pos_y);
    }
  }
  return toCsv(rows, headers);
}

// Replace switched-off space names with their detour targets, wherever they
// appear — plain destination cells, logic-condition text, "A or B" dice
// values. Token-level so it speaks the same dialect processGameData uses
// to extract names. Collapses "X or X" left behind when both branches of a
// compound destination detour to the same place.
function rewriteSpaceTokens(text, detours) {
  let out = String(text ?? '').replace(/[A-Z][A-Z0-9-]{2,}/g, t => detours[t] || t);
  out = out.replace(/\b([A-Z][A-Z0-9-]{2,})( or \1)+\b/g, '$1');
  return out;
}

function parseWithHeaderLine(csvText) {
  const headerLine = csvText.replace(/^\uFEFF/, '').split('\n')[0].replace(/\r$/, '');
  return { headers: parseCsvLine(headerLine), rows: parseCsvWithHeaders(csvText) };
}

/**
 * Full classroom overlay for Spaces.csv (Phase 2 supersedes the
 * positions-only Phase 1 overlay): teacher-copy substitution, switched-off
 * rows dropped, detour rewriting in destination cells, tile positions.
 * Order matters — copies first (their destinations get rewritten too),
 * then drop, then rewrite, then positions.
 * @param {string} spacesCsv
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @param {Object<string, string>} detours resolved off-space → active target
 * @returns {string}
 */
export function applyConfigToSpacesCsv(spacesCsv, config, detours = {}) {
  const { headers, rows } = parseWithHeaderLine(spacesCsv);
  const off = inactiveSpaces(config);
  const slots = config.slots || {};
  const copies = config.teacherCopies || {};

  const out = [];
  for (const row of rows) {
    const name = row.space_name;
    if (off.has(name)) continue;

    let effective = row;
    const slot = slots[name];
    const copy = slot?.card ? copies[slot.card] : null;
    if (copy) {
      // Full-copy substitution. Spread = the copy's stored fields win;
      // columns the copy predates fall through from the current stock row
      // (spec: structure aligns automatically, meaning never does). The
      // slot name is forced — copy ids never leak into resolved files.
      const copyRow = copy.rows?.[row.visit_type || ''] || {};
      effective = { ...row, ...copyRow, space_name: name };
    }

    effective = { ...effective };
    for (let i = 1; i <= 5; i++) {
      const cell = effective[`space_${i}`];
      if (cell) effective[`space_${i}`] = rewriteSpaceTokens(cell, detours);
    }
    if (slot && slot.pos_x != null && slot.pos_y != null) {
      effective.pos_x = String(slot.pos_x);
      effective.pos_y = String(slot.pos_y);
    }
    out.push(effective);
  }

  // Phase 4a: splice teacher-authored spaces onto their edges. For each
  // insertion on edge A→B: rewrite A's destination cell (B → authored id) so
  // players route through the new space, then append the authored space's own
  // rows with a single fixed edge to B. Validation (edge exists, endpoints
  // active, A is a fixed edge) already passed at bake time.
  //
  // The authored row is built CLEAN (allowlist): start from A's row only for
  // column-completeness (so every header column exists regardless of schema
  // drift), then blank EVERYTHING and re-set just the narrow set a narrative
  // pass-through needs. The earlier clone-and-blank-a-denylist approach leaked
  // A's *behavioral* columns (funding_source, auto_apply_funding,
  // auto_trigger_card_types, fee_calculation_method, …) and A's *position* into
  // the authored space — so a story beat spliced after a funding space secretly
  // behaved like that funding space and rendered stacked on top of its tile
  // (both found verifying 4a). Blanking is safe: processGameData defaults the
  // behavioral columns (e.g. fee_calculation_method → 'flat'), and Time/Fee are
  // read straight off their own columns.
  for (const ins of Object.values(config.insertions || {})) {
    const templates = out.filter(r => r.space_name === ins.from).map(r => ({ ...r }));
    if (templates.length === 0) continue;
    for (const row of out) {
      if (row.space_name !== ins.from) continue;
      for (let i = 1; i <= 5; i++) {
        if (row[`space_${i}`] === ins.to) row[`space_${i}`] = ins.id;
      }
    }
    // Auto-place at the spliced edge's midpoint (design: "auto-place adjacent to
    // the spliced edge's midpoint, then let the teacher drag it"). An explicit
    // teacher position wins. Never inherit A's coords (that caused the overlap).
    const placement = computeInsertionPosition(ins, templates[0], out);
    for (const tpl of templates) {
      const isFirst = (tpl.visit_type || '') === 'First';
      const authored = {};
      for (const k of Object.keys(tpl)) authored[k] = '';        // blank every column
      authored.space_name = ins.id;
      authored.visit_type = tpl.visit_type;
      authored.phase = tpl.phase || '';                          // keep A's phase band
      authored.path = tpl.path && tpl.path !== 'LOGIC' ? tpl.path : 'Main'; // plain fixed lane
      authored.Title = ins.displayName;
      authored.Event = ins.story || '';
      authored.display_label_override = ins.displayName;         // the human label (audit round 4)
      authored.Negotiate = 'NO';
      // Slice 3: a dice space rolls to teacher-set outcomes (its DiceRoll Info /
      // DICE_OUTCOMES rows are injected at bake — see bakeInstance). Movement for
      // a dice space comes from the dice table, not space_N, but the distinct
      // outcomes are listed in space_1..5 so the board can draw the edges. A
      // plain pass-through keeps its single fixed onward edge to `to`.
      const diceOutcomes = Array.isArray(ins.diceOutcomes) && ins.diceOutcomes.length ? ins.diceOutcomes : null;
      if (diceOutcomes) {
        authored.requires_dice_roll = 'YES';
        [...new Set(diceOutcomes)].slice(0, 5).forEach((dest, i) => { authored[`space_${i + 1}`] = dest; });
      } else {
        authored.requires_dice_roll = 'NO';
        authored.space_1 = ins.to;                               // single fixed onward edge
      }
      // Flat effects are First-visit only (a pass-through must not re-charge on revisit).
      authored.Time = isFirst && ins.time != null ? String(ins.time) : '0';
      // Fee (slice 4): a percentage wins over a flat amount. "N%" → the engine
      // charges that % of the player's loans (LOAN_PERCENTAGE); "N% of scope" →
      // that % of the player's project size (SCOPE_PERCENTAGE). A flat number
      // stays FIXED. processGameData tags the fee_type from this string.
      // First-visit only, like Time.
      authored.Fee = isFirst
        ? (ins.feePercent != null && Number(ins.feePercent) > 0
            ? `${Number(ins.feePercent)}%${ins.feeBasis === 'scope' ? ' of scope' : ''}`
            : (ins.fee != null ? String(ins.fee) : '0'))
        : '0';
      // Card draw (slice 2): deal cards on arrival. First-visit only (a
      // pass-through must not re-deal on revisit) and AUTO-triggered so the
      // turn never hangs on a manual draw the player might skip. L cards are
      // auto by nature; W/B/I/E need their letter in auto_trigger_card_types.
      // processGameData turns "Draw N" in the <type>_card column into the
      // cards/draw_<T> SPACE_EFFECTS row the engine deals from.
      if (isFirst && ins.cardDraw && ins.cardDraw.type && Number(ins.cardDraw.count) > 0) {
        const type = String(ins.cardDraw.type).toUpperCase();
        const col = `${type.toLowerCase()}_card`;
        if (col in authored) {
          authored[col] = `Draw ${Number(ins.cardDraw.count)}`;
          if (`${col}_narrative` in authored) authored[`${col}_narrative`] = ins.story || '';
          if (type !== 'L' && 'auto_trigger_card_types' in authored) authored.auto_trigger_card_types = type;
        }
      }
      // A mid-path space is never structural / a choice anchor.
      for (const flag of ['is_starting_space', 'is_ending_space', 'is_resume_hub', 'is_path_choice_lock_point']) {
        if (flag in authored) authored[flag] = 'No';
      }
      authored.pos_x = String(placement.x);
      authored.pos_y = String(placement.y);
      out.push(authored);
    }
  }
  return toCsv(out, headers);
}

/**
 * Where to drop an authored tile. Explicit teacher coords win; otherwise the
 * midpoint of the spliced A→B edge (so the new tile sits between its neighbors
 * instead of on top of A). Falls back to a small offset from A when either
 * endpoint lacks coords.
 * @param {{ pos_x?: string|number, pos_y?: string|number, to: string }} ins
 * @param {Record<string,string>} fromRow  A's row (carries A's pos)
 * @param {Array<Record<string,string>>} rows  all rows (to look up B's pos)
 * @returns {{ x: number, y: number }}
 */
function computeInsertionPosition(ins, fromRow, rows) {
  if (ins.pos_x != null && ins.pos_x !== '' && ins.pos_y != null && ins.pos_y !== '') {
    return { x: Number(ins.pos_x), y: Number(ins.pos_y) };
  }
  const toRow = rows.find(r => r.space_name === ins.to);
  const fx = Number(fromRow?.pos_x), fy = Number(fromRow?.pos_y);
  const tx = Number(toRow?.pos_x), ty = Number(toRow?.pos_y);
  if ([fx, fy, tx, ty].every(Number.isFinite)) {
    return { x: Math.round((fx + tx) / 2), y: Math.round((fy + ty) / 2) };
  }
  if (Number.isFinite(fx) && Number.isFinite(fy)) return { x: fx + 60, y: fy + 60 };
  return { x: 0, y: 0 };
}

/**
 * Cards that own their slot's dice outcomes (CARD_LIBRARY_DESIGN.md stage 1b).
 * Only the card a slot is actually PLAYING counts — same single-pointer lookup
 * applyConfigToSpacesCsv uses, no fallback chain — and only when that card
 * carries a `diceRows` array. A card without one (every card written before
 * stage 1b) is absent from the map, which is what makes stock pass through
 * untouched.
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {Map<string, Array<Object<string, string>>>} space name → dice rows
 */
export function copyDiceRowsBySpace(config) {
  const byName = new Map();
  const slots = config.slots || {};
  const copies = config.teacherCopies || {};
  for (const [name, slot] of Object.entries(slots)) {
    const copy = slot?.card ? copies[slot.card] : null;
    if (!copy || !Array.isArray(copy.diceRows) || copy.diceRows.length === 0) continue;
    // Slot name is forced, exactly as in applyConfigToSpacesCsv: copy ids
    // never leak into resolved files.
    byName.set(name, copy.diceRows.map(row => ({ ...row, space_name: name })));
  }
  return byName;
}

/**
 * Classroom overlay for DiceRoll Info.csv: teacher-copy dice substitution,
 * rows of switched-off spaces dropped, destination tokens in the roll columns
 * (1-6) detoured.
 *
 * Card-owned dice (stage 1b) are a THIRD case in this function, substituted
 * FIRST so the card's own destinations get detoured and spliced like any
 * other row — same ordering rationale as applyConfigToSpacesCsv's copies-then-
 * rewrite. A card without diceRows leaves its space's stock rows untouched.
 *
 * Phase 4b fork-splice: a dice source's destinations live here, not in
 * Spaces.csv `space_N`, so an insertion on a dice edge A→B must rewrite the
 * roll columns (every roll that went to B now routes through the authored
 * id, which then takes its own fixed edge to B — that authored row is
 * appended in applyConfigToSpacesCsv). The detour rewrite runs first; `to`
 * is always an active space (validation rejects off endpoints) so it is
 * never itself detoured, and the two passes don't collide.
 * @param {Object<string, import('./instanceStore.js').InsertionConfig>} insertions
 */
export function applyConfigToDiceCsv(diceCsv, config, detours = {}, insertions = {}) {
  const { headers, rows } = parseWithHeaderLine(diceCsv);
  const off = inactiveSpaces(config);
  const insByFrom = new Map();
  for (const ins of Object.values(insertions || {})) {
    if (!ins || !ins.from) continue;
    if (!insByFrom.has(ins.from)) insByFrom.set(ins.from, []);
    insByFrom.get(ins.from).push(ins);
  }
  // Card-owned dice: the card's rows REPLACE stock's rows for that space,
  // emitted in place of the first stock row so file ordering stays stable.
  const cardDice = copyDiceRowsBySpace(config);
  const substituted = new Set();

  const rewriteRow = (row) => {
    const effective = { ...row };
    for (const col of ['1', '2', '3', '4', '5', '6']) {
      if (effective[col]) effective[col] = rewriteSpaceTokens(effective[col], detours);
    }
    for (const ins of insByFrom.get(row.space_name) || []) {
      for (const col of ['1', '2', '3', '4', '5', '6']) {
        if (effective[col]) effective[col] = rewriteSpaceTokens(effective[col], { [ins.to]: ins.id });
      }
    }
    return effective;
  };

  const out = [];
  for (const row of rows) {
    if (off.has(row.space_name)) continue;
    const owned = cardDice.get(row.space_name);
    if (owned) {
      if (substituted.has(row.space_name)) continue; // stock rows already replaced
      substituted.add(row.space_name);
      for (const cardRow of owned) out.push(rewriteRow(cardRow));
      continue;
    }
    out.push(rewriteRow(row));
  }
  // A card may own dice for a space stock has no dice rows for at all (stock
  // gained the space after the card, or the card was authored dice-first).
  // Those rows have no stock row to stand in for, so they land at the end.
  for (const [name, owned] of cardDice) {
    if (substituted.has(name) || off.has(name)) continue;
    for (const cardRow of owned) out.push(rewriteRow(cardRow));
  }
  return toCsv(out, headers);
}

/**
 * Slice 3 (authored dice space): derive the dice rows the authored space needs.
 * Reads the already-built effective Spaces.csv for the authored rows (one per
 * visit type, mirroring `from`) and pairs each with the teacher's six outcomes.
 * @param {string} effectiveSpacesCsv
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {Array<{ id: string, visit_type: string, outcomes: string[] }>}
 */
export function collectAuthoredDiceRows(effectiveSpacesCsv, config) {
  const insById = config.insertions || {};
  const out = [];
  for (const row of parseCsvWithHeaders(effectiveSpacesCsv)) {
    const ins = insById[row.space_name];
    if (ins && Array.isArray(ins.diceOutcomes) && ins.diceOutcomes.length
        && String(row.requires_dice_roll || '').toUpperCase() === 'YES') {
      out.push({ id: row.space_name, visit_type: row.visit_type || '', outcomes: ins.diceOutcomes });
    }
  }
  return out;
}

/**
 * Append authored dice rows to the SOURCE DiceRoll Info.csv. die_roll='Next
 * Step' is exactly what loadDiceData/processMovement recognize as dice
 * MOVEMENT, so the baked MOVEMENT.csv marks the authored space movement_type=
 * 'dice' (its destinations come from the dice table, not space_N).
 */
export function appendAuthoredDiceRows(diceCsv, authoredRows) {
  if (!authoredRows.length) return diceCsv;
  const { headers, rows } = parseWithHeaderLine(diceCsv);
  for (const a of authoredRows) {
    const row = {};
    for (const h of headers) row[h] = '';
    row.space_name = a.id;
    row.die_roll = 'Next Step';
    row.visit_type = a.visit_type;
    for (let f = 1; f <= 6; f++) row[String(f)] = a.outcomes[f - 1] || '';
    rows.push(row);
  }
  return toCsv(rows, headers);
}

/**
 * Append authored dice outcomes to the curated DICE_OUTCOMES.csv — the file the
 * client reads directly for every dice destination (processGameData does NOT
 * generate it). Without this the authored dice space would roll into the void.
 */
export function appendAuthoredDiceOutcomes(outcomesCsv, authoredRows) {
  if (!authoredRows.length) return outcomesCsv;
  const { headers, rows } = parseWithHeaderLine(outcomesCsv);
  for (const a of authoredRows) {
    const row = {};
    for (const h of headers) row[h] = '';
    row.space_name = a.id;
    row.visit_type = a.visit_type;
    for (let f = 1; f <= 6; f++) row[`roll_${f}`] = a.outcomes[f - 1] || '';
    rows.push(row);
  }
  return toCsv(rows, headers);
}

/**
 * Rewrite the curated DICE_OUTCOMES.csv for every space whose card owns its
 * dice (CARD_LIBRARY_DESIGN.md stage 1b).
 *
 * THIS IS THE LOAD-BEARING HALF. processGameData does NOT regenerate
 * DICE_OUTCOMES.csv, and the client reads it directly for every dice
 * destination (dice spaces have empty MOVEMENT.csv destinations). A bake that
 * rewrote only the SOURCE dice table would yield a board that renders right
 * and routes WRONG — the space is functionally dead. Same trap the Phase 4b
 * authored-space work hit; see CLAUDE.md's "Authored-space bakes" entry.
 *
 * The card's rows are the authority for its space: its existing outcome rows
 * are replaced wholesale by rows derived from the card's `die_roll = 'Next
 * Step'` dice rows (the only rows that are MOVEMENT — exactly what
 * buildDiceDests and processGameData key on). A card whose dice are all effect
 * rolls therefore correctly leaves the space with no outcome rows at all.
 * Spaces with no card-owned dice are untouched.
 * @param {string} outcomesCsv
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {string}
 */
export function applyCopyDiceToOutcomesCsv(outcomesCsv, config) {
  const cardDice = copyDiceRowsBySpace(config);
  if (cardDice.size === 0) return outcomesCsv;
  const { headers, rows } = parseWithHeaderLine(outcomesCsv);

  const buildOutcomeRows = (name, diceRows) => diceRows
    .filter(r => (r.die_roll || '').trim() === 'Next Step')
    .map(r => {
      const built = {};
      for (const h of headers) built[h] = '';
      built.space_name = name;
      built.visit_type = r.visit_type || '';
      for (let f = 1; f <= 6; f++) built[`roll_${f}`] = r[String(f)] || '';
      return built;
    });

  const out = [];
  const replaced = new Set();
  for (const row of rows) {
    const owned = cardDice.get(row.space_name);
    if (!owned) { out.push(row); continue; }
    if (replaced.has(row.space_name)) continue; // stock rows already replaced
    replaced.add(row.space_name);
    out.push(...buildOutcomeRows(row.space_name, owned));
  }
  // A card can add dice movement to a space the curated file has no row for.
  for (const [name, owned] of cardDice) {
    if (replaced.has(name)) continue;
    out.push(...buildOutcomeRows(name, owned));
  }
  return toCsv(out, headers);
}

/**
 * Cards that own their slot's modal copy (CARD_LIBRARY_DESIGN.md stage 1b
 * part ii). Same single-pointer lookup as copyDiceRowsBySpace: only the card
 * a slot is actually PLAYING counts, and only when it carries a `modalRows`
 * array. Absent (every card written before this slice) means "no modal copy
 * of its own — fall back to stock".
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {Map<string, Array<Object<string, string>>>} space name → modal rows
 */
export function copyModalRowsBySpace(config) {
  const byName = new Map();
  const slots = config.slots || {};
  const copies = config.teacherCopies || {};
  for (const [name, slot] of Object.entries(slots)) {
    const copy = slot?.card ? copies[slot.card] : null;
    if (!copy || !Array.isArray(copy.modalRows) || copy.modalRows.length === 0) continue;
    // Slot name is forced, exactly as copyDiceRowsBySpace does: copy ids
    // never leak into resolved files.
    byName.set(name, copy.modalRows.map(row => ({ ...row, space_name: name })));
  }
  return byName;
}

/**
 * Classroom overlay for ModalConfig.csv: card-owned modal copy replaces
 * stock's rows for that space, whole-row, exactly analogous to
 * applyConfigToDiceCsv's card case. Safe as a straight replacement because
 * ModalConfig carries no routing (CARD_LIBRARY_DESIGN.md "What a card
 * owns") — unlike the LOGIC_QUESTIONS merge below, there is no per-field
 * split to make. A card without `modalRows` (every card written before this
 * slice) leaves its space's stock rows untouched.
 * @param {string} modalCsv
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {string}
 */
export function applyConfigToModalCsv(modalCsv, config) {
  const cardModal = copyModalRowsBySpace(config);
  if (cardModal.size === 0) return modalCsv;
  const { headers, rows } = parseWithHeaderLine(modalCsv);

  const out = [];
  const substituted = new Set();
  for (const row of rows) {
    const owned = cardModal.get(row.space_name);
    if (owned) {
      if (substituted.has(row.space_name)) continue; // stock rows already replaced
      substituted.add(row.space_name);
      out.push(...owned);
      continue;
    }
    out.push(row);
  }
  // A card may own modal copy for a space stock has no ModalConfig rows for
  // at all (stock gained the space after the card, or the card was authored
  // with a modal stock never had). Those rows land at the end.
  for (const [name, owned] of cardModal) {
    if (substituted.has(name)) continue;
    out.push(...owned);
  }
  return toCsv(out, headers);
}

/**
 * Cards that own their slot's logic-question WORDING (CARD_LIBRARY_DESIGN.md
 * stage 1b part ii, "Logic questions: wording, not routing"). Same
 * single-pointer lookup as copyDiceRowsBySpace/copyModalRowsBySpace: only the
 * card a slot is actually PLAYING counts, and only when it carries a
 * `logicRows` array.
 *
 * Unlike diceRows/modalRows, entries here carry no space_name — matching at
 * bake time is by slot (this map's own key) plus (visit_type, question_id),
 * which is all a wording-only override needs. createTeacherCopy never stores
 * anything else on a logicRows entry (no yes_target/no_target/
 * auto_answer_from), so there is nothing here that could express a routing
 * change even by accident.
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {Map<string, Array<{visit_type: string, question_id: string, question_text: string, yes_reason: string, no_reason: string}>>}
 */
export function copyLogicRowsBySpace(config) {
  const byName = new Map();
  const slots = config.slots || {};
  const copies = config.teacherCopies || {};
  for (const [name, slot] of Object.entries(slots)) {
    const copy = slot?.card ? copies[slot.card] : null;
    if (!copy || !Array.isArray(copy.logicRows) || copy.logicRows.length === 0) continue;
    byName.set(name, copy.logicRows);
  }
  return byName;
}

/**
 * Classroom overlay for LOGIC_QUESTIONS.csv: a per-FIELD overlay, not a row
 * replacement — the opposite shape from applyConfigToDiceCsv/
 * applyConfigToModalCsv's whole-row substitution. For each stock row, if the
 * played card has a logicRows entry matching on (visit_type, question_id),
 * ONLY question_text/yes_reason/no_reason are replaced; every other column —
 * crucially yes_target/no_target/auto_answer_from — keeps its stock value,
 * because the card never stored anything else to begin with (see
 * copyLogicRowsBySpace). A card entry matching no stock row is ignored: stock's
 * structure governs which questions exist, a card cannot invent one. A pure
 * pass-through when no card in this classroom owns logic wording.
 * @param {string} questionsCsv
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @returns {string}
 */
export function applyCopyLogicToQuestionsCsv(questionsCsv, config) {
  const cardLogic = copyLogicRowsBySpace(config);
  if (cardLogic.size === 0) return questionsCsv;
  const { headers, rows } = parseWithHeaderLine(questionsCsv);

  const out = rows.map(row => {
    const owned = cardLogic.get(row.space_name);
    if (!owned) return row;
    const match = owned.find(r =>
      (r.visit_type || '') === (row.visit_type || '') && r.question_id === row.question_id
    );
    if (!match) return row;
    return { ...row, question_text: match.question_text, yes_reason: match.yes_reason, no_reason: match.no_reason };
  });
  return toCsv(out, headers);
}

/**
 * Apply teacher-authored insertions to a curated CLEAN file that processGameData
 * does NOT regenerate (DICE_OUTCOMES.csv above all — the client reads it directly
 * for every dice destination). Unlike a detour (a global token swap), an insertion
 * rewrite is SCOPED to the `from` space's own rows: only there does B → authored
 * id, so the player rolling at A now lands on the authored space, which takes its
 * own fixed edge onward to B. Without this pass a dice splice is functionally dead
 * — the authored tile renders but the curated outcomes still route A straight to B.
 * @param {string} csvText
 * @param {Object<string, import('./instanceStore.js').InsertionConfig>} insertions
 * @returns {string}
 */
export function applyInsertionsToCuratedCsv(csvText, insertions = {}) {
  const insByFrom = new Map();
  for (const ins of Object.values(insertions || {})) {
    if (!ins || !ins.from || !ins.to || !ins.id) continue;
    if (!insByFrom.has(ins.from)) insByFrom.set(ins.from, []);
    insByFrom.get(ins.from).push(ins);
  }
  if (insByFrom.size === 0) return csvText;
  const { headers, rows } = parseWithHeaderLine(csvText);
  const out = [];
  for (const row of rows) {
    const effective = { ...row };
    for (const ins of insByFrom.get(row.space_name) || []) {
      for (const key of headers) {
        if (key === 'space_name' || key === 'visit_type') continue;
        if (effective[key]) effective[key] = rewriteSpaceTokens(effective[key], { [ins.to]: ins.id });
      }
    }
    out.push(effective);
  }
  return toCsv(out, headers);
}

/**
 * Curated CLEAN files (not regenerated by processGameData) must honor the
 * same invariant: a resolved board never references a switched-off space
 * in ANY file. Drops rows keyed to off spaces, rewrites tokens everywhere.
 */
export function scrubSpaceReferences(csvText, off, detours) {
  const { headers, rows } = parseWithHeaderLine(csvText);
  const out = [];
  for (const row of rows) {
    if (row.space_name && off.has(row.space_name)) continue;
    const effective = { ...row };
    for (const key of headers) {
      if (effective[key]) effective[key] = rewriteSpaceTokens(effective[key], detours);
    }
    out.push(effective);
  }
  return toCsv(out, headers);
}

function copyDirFiles(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  if (!fs.existsSync(srcDir)) return;
  for (const name of fs.readdirSync(srcDir)) {
    const srcFile = path.join(srcDir, name);
    if (!fs.statSync(srcFile).isFile()) continue;
    fs.copyFileSync(srcFile, path.join(dstDir, name));
  }
}

export function resolvedDir(instancesRoot, id) {
  assertValidInstanceId(id);
  return path.join(instancesRoot, id, 'resolved');
}

/**
 * @typedef {Object} BakeStamp
 * @property {string} [instanceId]
 * @property {number} [configVersion]
 * @property {string} [stockVersion]
 * @property {string} [bakedAt]
 */

/**
 * Read the current bake stamp, or null (missing/unparseable = stale).
 * @returns {BakeStamp|null}
 */
export function readBakeStamp(instancesRoot, id) {
  try {
    const stampPath = path.join(resolvedDir(instancesRoot, id), STAMP_FILE);
    if (!fs.existsSync(stampPath)) return null;
    return JSON.parse(fs.readFileSync(stampPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * @param {BakeStamp|null} stamp
 * @param {import('./instanceStore.js').InstanceConfig} config
 * @param {string} stockVersion
 */
export function isBakeFresh(stamp, config, stockVersion) {
  return Boolean(
    stamp &&
    stamp.configVersion === config.configVersion &&
    stamp.stockVersion === stockVersion
  );
}

/**
 * Remove leftover .new-* / .stale-* directories from a crashed bake. Safe to
 * run any time; the active resolved/ dir is never touched.
 */
export function sweepBakeDebris(instancesRoot, id) {
  const dir = path.join(instancesRoot, id);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (/^resolved\.(new|stale)-/.test(name)) {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    }
  }
}

/**
 * Bake one classroom: write a complete resolved set into resolved.new-*,
 * then swap it into place. Throws on any failure — the active resolved/
 * dir is only replaced after the new one is fully written.
 * @param {{ stockDataDir: string, instancesRoot: string,
 *   config: import('./instanceStore.js').InstanceConfig, stockVersion: string }} args
 * @returns {BakeStamp}
 */
export function bakeInstance({ stockDataDir, instancesRoot, config, stockVersion }) {
  const id = config.meta.id;
  sweepBakeDebris(instancesRoot, id);

  const stockSourceDir = path.join(stockDataDir, 'SOURCE_FILES');
  const stockCleanDir = path.join(stockDataDir, 'CLEAN_FILES');
  const spacesPath = path.join(stockSourceDir, SPACES_CSV);
  if (!fs.existsSync(spacesPath)) {
    throw new Error(`Stock ${SPACES_CSV} not found at ${spacesPath}`);
  }

  const finalDir = resolvedDir(instancesRoot, id);
  const newDir = `${finalDir}.new-${process.pid}-${Date.now()}`;
  const newSourceDir = path.join(newDir, 'SOURCE_FILES');
  const newCleanDir = path.join(newDir, 'CLEAN_FILES');

  try {
    // 0. Validate — a config with errors never bakes (spec: save-time
    //    rejection with explanation, never silent auto-fixes). The report
    //    also carries the resolved detours the overlay needs.
    const stockSpacesCsv = fs.readFileSync(spacesPath, 'utf-8');
    const pathChoicePath = path.join(stockCleanDir, 'PATH_CHOICE_RULES.csv');
    const pathChoiceCsv = fs.existsSync(pathChoicePath) ? fs.readFileSync(pathChoicePath, 'utf-8') : null;
    // Dice table is read up front: validation needs it to verify 4b dice-edge
    // insertions, and the overlay below rewrites its roll columns.
    const diceCsv = fs.readFileSync(path.join(stockSourceDir, DICE_CSV), 'utf-8');
    const report = validateConfig({ config, stockSpacesCsv, pathChoiceCsv, diceCsv, stockVersion });
    if (!report.ok) {
      const err = new Error(`Config validation failed: ${report.errors.map(e => e.message).join('; ')}`);
      err.report = report;
      throw err;
    }
    const off = inactiveSpaces(config);
    const detours = report.detours;

    // 1. Resolved SOURCE_FILES = stock with the full classroom overlay
    //    (copies substituted, off spaces dropped, destinations detoured,
    //    positions applied).
    copyDirFiles(stockSourceDir, newSourceDir);
    const effectiveSpacesCsv = applyConfigToSpacesCsv(stockSpacesCsv, config, detours);
    fs.writeFileSync(path.join(newSourceDir, SPACES_CSV), effectiveSpacesCsv, 'utf-8');
    // Slice 3: an authored dice space needs its own DiceRoll Info row so
    // loadDiceData/processMovement see it as dice movement, plus a curated
    // DICE_OUTCOMES row (added below) the client reads for the destinations.
    const authoredDiceRows = collectAuthoredDiceRows(effectiveSpacesCsv, config);
    let effectiveDiceCsv = applyConfigToDiceCsv(diceCsv, config, detours, config.insertions || {});
    effectiveDiceCsv = appendAuthoredDiceRows(effectiveDiceCsv, authoredDiceRows);
    fs.writeFileSync(path.join(newSourceDir, DICE_CSV), effectiveDiceCsv, 'utf-8');

    // 2. Resolved CLEAN_FILES: stock copies first (covers the manually
    //    curated files processGameData doesn't generate), then regenerate
    //    the derived ones from the effective SOURCE, then scrub the curated
    //    ones — INVARIANT: a resolved board never references a switched-off
    //    space in ANY file.
    copyDirFiles(stockCleanDir, newCleanDir);
    const modalPath = path.join(stockSourceDir, MODAL_CSV);
    const stockModalCsv = fs.existsSync(modalPath) ? fs.readFileSync(modalPath, 'utf-8') : null;
    // Stage 1b part ii: a card that owns its slot's modal copy must replace
    // stock's ModalConfig rows before the CSV reaches processGameData (which
    // only ever consumes it as a lookup — see loadModalConfig — never
    // regenerates it). Mirrors the Spaces/dice overlays above: written into
    // the resolved SOURCE_FILES copy too, not just handed to processGameData,
    // so the resolved output is consistent either way you inspect it. No-op
    // (same reference back out) when no card in this classroom owns modal
    // copy, which is every card written before this slice.
    const effectiveModalCsv = stockModalCsv != null ? applyConfigToModalCsv(stockModalCsv, config) : null;
    if (effectiveModalCsv != null) {
      fs.writeFileSync(path.join(newSourceDir, MODAL_CSV), effectiveModalCsv, 'utf-8');
    }
    processGameData(effectiveSpacesCsv, effectiveDiceCsv, newCleanDir, effectiveModalCsv);
    // Stage 1b: a card that owns its slot's dice must rewrite the curated
    // DICE_OUTCOMES.csv too, not only the SOURCE table above — processGameData
    // does not generate it and the client reads it directly for destinations.
    // Runs BEFORE the detour/insertion pass below so the card's own
    // destinations get scrubbed and spliced like any other row. No-op when no
    // card in this classroom owns dice, which is every card written before
    // stage 1b (absent diceRows = fall back to stock).
    {
      const outcomesPath = path.join(newCleanDir, 'DICE_OUTCOMES.csv');
      if (fs.existsSync(outcomesPath)) {
        const stockOutcomes = fs.readFileSync(outcomesPath, 'utf-8');
        const rewritten = applyCopyDiceToOutcomesCsv(stockOutcomes, config);
        if (rewritten !== stockOutcomes) fs.writeFileSync(outcomesPath, rewritten, 'utf-8');
      }
    }
    // Stage 1b part ii: a card that owns its slot's logic-question WORDING
    // must rewrite the curated LOGIC_QUESTIONS.csv too — also curated (not
    // generated by processGameData), also only copied through otherwise.
    // Runs alongside the DICE_OUTCOMES overlay above, before the detour/
    // insertion scrub pass below. Unlike dice, ordering relative to that scrub
    // is not load-bearing here: the overlay only ever touches question_text/
    // yes_reason/no_reason, never the yes_target/no_target destination
    // columns the scrub rewrites — kept alongside purely for consistency with
    // the dice case. No-op when no card in this classroom owns logic wording.
    {
      const questionsPath = path.join(newCleanDir, LOGIC_CSV);
      if (fs.existsSync(questionsPath)) {
        const stockQuestions = fs.readFileSync(questionsPath, 'utf-8');
        const rewritten = applyCopyLogicToQuestionsCsv(stockQuestions, config);
        if (rewritten !== stockQuestions) fs.writeFileSync(questionsPath, rewritten, 'utf-8');
      }
    }
    // Curated CLEAN files (NOT regenerated above) need two scoped rewrites:
    // detours for switched-off spaces, and insertions for spliced dice edges.
    // DICE_OUTCOMES.csv is the load-bearing one — the client reads it directly
    // for every dice destination, so a dice splice that doesn't touch it is
    // functionally dead. Both passes are skipped when neither applies.
    const insertions = config.insertions || {};
    const hasInsertions = Object.keys(insertions).length > 0;
    if (off.size > 0 || hasInsertions) {
      for (const curated of ['DICE_OUTCOMES.csv', 'DICE_ROLL_INFO.csv', LOGIC_CSV, 'ACTION_TOOLTIPS.csv']) {
        const curatedPath = path.join(newCleanDir, curated);
        if (!fs.existsSync(curatedPath)) continue;
        let text = fs.readFileSync(curatedPath, 'utf-8');
        if (off.size > 0) text = scrubSpaceReferences(text, off, detours);
        if (hasInsertions) text = applyInsertionsToCuratedCsv(text, insertions);
        fs.writeFileSync(curatedPath, text, 'utf-8');
      }
      // PATH_CHOICE_RULES is deliberately NOT rewritten — protection forbids
      // disabling its participants, and validateConfig hard-errors if the
      // rules reference an off space, so reaching here means it is clean.
    }
    // Slice 3: add the authored dice spaces' outcome rows to the curated
    // DICE_OUTCOMES.csv (done after the rewrite pass — these rows are new, not
    // rewritten). Their outcomes are validated active, so no scrub is needed.
    if (authoredDiceRows.length) {
      const outcomesPath = path.join(newCleanDir, 'DICE_OUTCOMES.csv');
      if (fs.existsSync(outcomesPath)) {
        const appended = appendAuthoredDiceOutcomes(fs.readFileSync(outcomesPath, 'utf-8'), authoredDiceRows);
        fs.writeFileSync(outcomesPath, appended, 'utf-8');
      }
    }

    // 3. Validation report (the catalog UI's data source), stamp, swap.
    //    The stamp is written last inside newDir, so a resolved/ dir with
    //    a stamp is by construction complete.
    fs.writeFileSync(path.join(newDir, 'validation-report.json'), JSON.stringify(report, null, 2), 'utf-8');
    const stamp = {
      instanceId: id,
      configVersion: config.configVersion,
      stockVersion,
      bakedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(newDir, STAMP_FILE), JSON.stringify(stamp, null, 2), 'utf-8');

    let staleDir = null;
    if (fs.existsSync(finalDir)) {
      staleDir = `${finalDir}.stale-${process.pid}-${Date.now()}`;
      fs.renameSync(finalDir, staleDir);
    }
    fs.renameSync(newDir, finalDir);
    if (staleDir) fs.rmSync(staleDir, { recursive: true, force: true });

    return stamp;
  } catch (err) {
    fs.rmSync(newDir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Bake only if stale (config changed or stock deck changed). This is the
 * on-demand entry point: boot, config save, and game creation all call it.
 * @param {{ stockDataDir: string, instancesRoot: string,
 *   config: import('./instanceStore.js').InstanceConfig }} args
 * @returns {{ stamp: BakeStamp, rebaked: boolean }}
 */
export function ensureFreshBake({ stockDataDir, instancesRoot, config }) {
  const stockVersion = computeStockVersion(stockDataDir);
  const stamp = readBakeStamp(instancesRoot, config.meta.id);
  if (isBakeFresh(stamp, config, stockVersion)) {
    return { stamp, rebaked: false };
  }
  const newStamp = bakeInstance({ stockDataDir, instancesRoot, config, stockVersion });
  return { stamp: newStamp, rebaked: true };
}
