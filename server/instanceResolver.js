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

const STAMP_FILE = 'bake-stamp.json';
const SPACES_CSV = 'Spaces.csv';
const DICE_CSV = 'DiceRoll Info.csv';
const MODAL_CSV = 'ModalConfig.csv';

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
  // active, A is a fixed edge) already passed at bake time. Templates are
  // captured from A's rows for column-completeness, so the authored rows carry
  // exactly the stock schema regardless of how it has drifted.
  for (const ins of Object.values(config.insertions || {})) {
    const templates = out.filter(r => r.space_name === ins.from).map(r => ({ ...r }));
    if (templates.length === 0) continue;
    for (const row of out) {
      if (row.space_name !== ins.from) continue;
      for (let i = 1; i <= 5; i++) {
        if (row[`space_${i}`] === ins.to) row[`space_${i}`] = ins.id;
      }
    }
    for (const tpl of templates) {
      const isFirst = (tpl.visit_type || '') === 'First';
      const authored = { ...tpl };
      authored.space_name = ins.id;
      authored.Title = ins.displayName;
      authored.Event = ins.story || '';
      if ('Action' in authored) authored.Action = '';
      if ('Outcome' in authored) authored.Outcome = '';
      authored.space_1 = ins.to;
      authored.space_2 = ''; authored.space_3 = ''; authored.space_4 = ''; authored.space_5 = '';
      if ('requires_dice_roll' in authored) authored.requires_dice_roll = 'NO';
      if ('Negotiate' in authored) authored.Negotiate = 'NO';
      // Flat effects are First-visit only (a pass-through must not re-charge on revisit).
      if ('Time' in authored) authored.Time = isFirst && ins.time != null ? String(ins.time) : '0';
      if ('Fee' in authored) authored.Fee = isFirst && ins.fee != null ? String(ins.fee) : '0';
      for (const cardCol of ['w_card', 'b_card', 'i_card', 'l_card', 'e_card']) {
        if (cardCol in authored) authored[cardCol] = '';
      }
      if (ins.pos_x != null) authored.pos_x = String(ins.pos_x);
      if (ins.pos_y != null) authored.pos_y = String(ins.pos_y);
      // An authored mid-path space is never structural / a choice anchor.
      for (const flag of ['is_starting_space', 'is_ending_space', 'is_resume_hub', 'is_path_choice_lock_point']) {
        if (flag in authored) authored[flag] = 'No';
      }
      if ('path_choice_memory_key' in authored) authored.path_choice_memory_key = '';
      // displayName rides display_label_override (audit round 4). Harmless if
      // the stock header lacks the column — toCsv writes only header columns.
      authored.display_label_override = ins.displayName;
      out.push(authored);
    }
  }
  return toCsv(out, headers);
}

/**
 * Classroom overlay for DiceRoll Info.csv: rows of switched-off spaces
 * dropped, destination tokens in the roll columns (1-6) detoured. (Teacher
 * copies cover Spaces.csv fields only in Phase 2 — dice tables stay stock.)
 */
export function applyConfigToDiceCsv(diceCsv, config, detours = {}) {
  const { headers, rows } = parseWithHeaderLine(diceCsv);
  const off = inactiveSpaces(config);
  const out = [];
  for (const row of rows) {
    if (off.has(row.space_name)) continue;
    const effective = { ...row };
    for (const col of ['1', '2', '3', '4', '5', '6']) {
      if (effective[col]) effective[col] = rewriteSpaceTokens(effective[col], detours);
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
    const report = validateConfig({ config, stockSpacesCsv, pathChoiceCsv, stockVersion });
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
    const diceCsv = fs.readFileSync(path.join(stockSourceDir, DICE_CSV), 'utf-8');
    const effectiveDiceCsv = applyConfigToDiceCsv(diceCsv, config, detours);
    fs.writeFileSync(path.join(newSourceDir, DICE_CSV), effectiveDiceCsv, 'utf-8');

    // 2. Resolved CLEAN_FILES: stock copies first (covers the manually
    //    curated files processGameData doesn't generate), then regenerate
    //    the derived ones from the effective SOURCE, then scrub the curated
    //    ones — INVARIANT: a resolved board never references a switched-off
    //    space in ANY file.
    copyDirFiles(stockCleanDir, newCleanDir);
    const modalPath = path.join(stockSourceDir, MODAL_CSV);
    const modalCsv = fs.existsSync(modalPath) ? fs.readFileSync(modalPath, 'utf-8') : null;
    processGameData(effectiveSpacesCsv, effectiveDiceCsv, newCleanDir, modalCsv);
    if (off.size > 0) {
      for (const curated of ['DICE_OUTCOMES.csv', 'DICE_ROLL_INFO.csv', 'LOGIC_QUESTIONS.csv', 'ACTION_TOOLTIPS.csv']) {
        const curatedPath = path.join(newCleanDir, curated);
        if (!fs.existsSync(curatedPath)) continue;
        const scrubbed = scrubSpaceReferences(fs.readFileSync(curatedPath, 'utf-8'), off, detours);
        fs.writeFileSync(curatedPath, scrubbed, 'utf-8');
      }
      // PATH_CHOICE_RULES is deliberately NOT rewritten — protection forbids
      // disabling its participants, and validateConfig hard-errors if the
      // rules reference an off space, so reaching here means it is clean.
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
