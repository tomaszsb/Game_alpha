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
    // 1. Resolved SOURCE_FILES = stock with the classroom overlay applied.
    copyDirFiles(stockSourceDir, newSourceDir);
    const stockSpacesCsv = fs.readFileSync(spacesPath, 'utf-8');
    const effectiveSpacesCsv = applyPositionsToSpacesCsv(stockSpacesCsv, config.slots);
    fs.writeFileSync(path.join(newSourceDir, SPACES_CSV), effectiveSpacesCsv, 'utf-8');

    // 2. Resolved CLEAN_FILES: stock copies first (covers the manually
    //    curated files processGameData doesn't generate), then regenerate
    //    the derived ones from the effective SOURCE.
    copyDirFiles(stockCleanDir, newCleanDir);
    const diceCsv = fs.readFileSync(path.join(stockSourceDir, DICE_CSV), 'utf-8');
    const modalPath = path.join(stockSourceDir, MODAL_CSV);
    const modalCsv = fs.existsSync(modalPath) ? fs.readFileSync(modalPath, 'utf-8') : null;
    processGameData(effectiveSpacesCsv, diceCsv, newCleanDir, modalCsv);

    // 3. Stamp, then swap. The stamp is written last inside newDir, so a
    //    resolved/ dir with a stamp is by construction complete.
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
