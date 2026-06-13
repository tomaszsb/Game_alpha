// server/migrateInstance.js
// Teacher instance layer, Phase 1 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// One-time migration of the pre-instance live working copy into
// "classroom-1". Rule (proven by hand on 2026-06-09, now codified):
//
//   - tile positions (pos_x/pos_y) found in the live copy become the
//     classroom's slot config — the teacher's arrangement is preserved;
//   - EVERY OTHER live-vs-stock difference is stale content. It is reported
//     (so the maintainer can verify nothing intentional gets dropped) but
//     NOT migrated — stock is the home of content (spec decision 3).
//
// Positions are read from BOTH the SOURCE Spaces.csv AND the CLEAN
// GAME_CONFIG.csv, unioned, with CLEAN winning on conflict. This is the
// 2026-06-13 fix: the legacy board editor persisted tile positions to CLEAN
// GAME_CONFIG.csv, NOT to SOURCE Spaces.csv, so a SOURCE-only read captured
// zero positions and the stock refresh silently overwrote the custom layout.
//
// Idempotent: if classroom-1 already exists, apply is a no-op. The dry-run
// CLI (npm run migrate:check) prints the plan without writing anything.

import fs from 'fs';
import path from 'path';
import { parseCsvWithHeaders } from './processGameData.js';
import { createInstance, loadInstance, saveInstance, setSlotPositions } from './instanceStore.js';

const POSITION_FIELDS = new Set(['pos_x', 'pos_y']);

function rowsByKey(csvText) {
  const map = new Map();
  for (const row of parseCsvWithHeaders(csvText)) {
    if (!row.space_name) continue;
    map.set(`${row.space_name}|${row.visit_type || ''}`, row);
  }
  return map;
}

// CLEAN GAME_CONFIG.csv has one row per space (no visit_type), each carrying
// pos_x/pos_y. Returns space_name -> { x, y } with trimmed string values.
function positionsByConfigSpace(csvText) {
  const map = new Map();
  for (const row of parseCsvWithHeaders(csvText)) {
    if (!row.space_name) continue;
    map.set(row.space_name, {
      x: (row.pos_x ?? '').trim(),
      y: (row.pos_y ?? '').trim(),
    });
  }
  return map;
}

/**
 * @typedef {Object} MigrationPlan
 * @property {Object<string, { x?: string, y?: string }>} positions
 * @property {Array<{ space_name: string, visit_type: string, field: string, live: string, stock: string }>} contentDrift
 * @property {string[]} liveOnlySpaces
 * @property {string[]} stockOnlySpaces
 */

/**
 * Diff the live working copy against stock to build the migration plan.
 * Content drift comes from SOURCE Spaces.csv. Tile positions come from BOTH
 * SOURCE Spaces.csv and (when provided) CLEAN GAME_CONFIG.csv — the latter is
 * where the legacy board editor actually persisted them, so it wins on conflict.
 * @param {{
 *   liveSpacesCsv: string,
 *   stockSpacesCsv: string,
 *   liveGameConfigCsv?: string,
 *   stockGameConfigCsv?: string,
 * }} args
 * @returns {MigrationPlan}
 */
export function computeMigrationPlan({ liveSpacesCsv, stockSpacesCsv, liveGameConfigCsv, stockGameConfigCsv }) {
  const live = rowsByKey(liveSpacesCsv);
  const stock = rowsByKey(stockSpacesCsv);

  const positions = {};
  const contentDrift = [];
  const liveOnlySpaces = new Set();
  const stockOnlySpaces = new Set();

  for (const [key, liveRow] of live) {
    const stockRow = stock.get(key);
    if (!stockRow) {
      liveOnlySpaces.add(liveRow.space_name);
      continue;
    }
    const fields = new Set([...Object.keys(liveRow), ...Object.keys(stockRow)]);
    for (const field of fields) {
      const liveVal = (liveRow[field] ?? '').trim();
      const stockVal = (stockRow[field] ?? '').trim();
      if (liveVal === stockVal) continue;
      if (POSITION_FIELDS.has(field)) {
        // Positions are per-space (visit rows share them); last row wins,
        // matching how the board editor writes them.
        const existing = positions[liveRow.space_name] ?? {};
        positions[liveRow.space_name] = {
          ...existing,
          [field === 'pos_x' ? 'x' : 'y']: liveVal,
        };
      } else {
        contentDrift.push({
          space_name: liveRow.space_name,
          visit_type: liveRow.visit_type || '',
          field,
          live: liveVal,
          stock: stockVal,
        });
      }
    }
  }

  for (const [, stockRow] of stock) {
    if (![...live.keys()].some(k => k.startsWith(`${stockRow.space_name}|`))) {
      stockOnlySpaces.add(stockRow.space_name);
    }
  }

  // A space might differ in only one of pos_x/pos_y; fill the missing axis
  // from the live row so the slot always carries a complete coordinate.
  for (const [spaceName, pos] of Object.entries(positions)) {
    if (pos.x === undefined || pos.y === undefined) {
      for (const [key, liveRow] of live) {
        if (key.startsWith(`${spaceName}|`)) {
          pos.x = pos.x ?? (liveRow.pos_x ?? '').trim();
          pos.y = pos.y ?? (liveRow.pos_y ?? '').trim();
          break;
        }
      }
    }
  }

  // Overlay positions from CLEAN GAME_CONFIG.csv — where the legacy board
  // editor actually wrote them. A space whose CLEAN coordinate differs from
  // stock is a moved tile; CLEAN wins, taking the full live coordinate (an
  // empty CLEAN axis falls back to stock so the slot stays complete).
  if (liveGameConfigCsv && stockGameConfigCsv) {
    const liveCfg = positionsByConfigSpace(liveGameConfigCsv);
    const stockCfg = positionsByConfigSpace(stockGameConfigCsv);
    for (const [spaceName, lp] of liveCfg) {
      const sp = stockCfg.get(spaceName) ?? { x: '', y: '' };
      const xMoved = lp.x !== '' && lp.x !== sp.x;
      const yMoved = lp.y !== '' && lp.y !== sp.y;
      if (xMoved || yMoved) {
        positions[spaceName] = {
          x: lp.x !== '' ? lp.x : sp.x,
          y: lp.y !== '' ? lp.y : sp.y,
        };
      }
    }
  }

  return {
    positions,
    contentDrift,
    liveOnlySpaces: [...liveOnlySpaces].sort(),
    stockOnlySpaces: [...stockOnlySpaces].sort(),
  };
}

/** Human-readable plan for the dry-run CLI and boot logs. */
export function formatMigrationPlan(plan) {
  const lines = [];
  const posNames = Object.keys(plan.positions).sort();
  lines.push(`Tile positions to migrate into classroom config: ${posNames.length}`);
  for (const name of posNames) {
    const p = plan.positions[name];
    lines.push(`  ${name} -> (${p.x}, ${p.y})`);
  }
  lines.push(`Content drift (stale live content, replaced by stock — NOT migrated): ${plan.contentDrift.length}`);
  for (const d of plan.contentDrift) {
    lines.push(`  ${d.space_name}/${d.visit_type} ${d.field}: live="${truncate(d.live)}" stock="${truncate(d.stock)}"`);
  }
  if (plan.liveOnlySpaces.length) {
    lines.push(`Spaces only in live copy (will disappear — stock has no such slot): ${plan.liveOnlySpaces.join(', ')}`);
  }
  if (plan.stockOnlySpaces.length) {
    lines.push(`Spaces only in stock (new content arriving): ${plan.stockOnlySpaces.join(', ')}`);
  }
  return lines.join('\n');
}

function truncate(s, max = 60) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Create classroom-1 from a plan. Idempotent: an existing instance is left
 * untouched (re-running a deploy can never double-migrate).
 * @param {{ instancesRoot: string, plan: MigrationPlan, id: string, displayName?: string }} args
 */
export function applyMigrationPlan({ instancesRoot, plan, id, displayName }) {
  const existing = loadInstance(instancesRoot, id);
  if (existing) {
    return { skipped: true, reason: `instance "${id}" already exists`, config: existing };
  }
  const config = createInstance(instancesRoot, { id, displayName });
  if (Object.keys(plan.positions).length > 0) {
    setSlotPositions(config, plan.positions);
    saveInstance(instancesRoot, config);
  }
  return { skipped: false, config };
}

/**
 * Locate live + stock data files for the current environment. Live = the
 * writable working copy (production volume); stock = dist (production
 * build) falling back to public/ (dev checkout). Positions are read from CLEAN
 * GAME_CONFIG.csv as well as SOURCE Spaces.csv (see computeMigrationPlan).
 */
export function defaultMigrationPaths({ dataDir, distPath, cwd = process.cwd() }) {
  const liveSpaces = path.join(dataDir, 'game-data', 'SOURCE_FILES', 'Spaces.csv');
  const distSpaces = path.join(distPath, 'data', 'SOURCE_FILES', 'Spaces.csv');
  const publicSpaces = path.join(cwd, 'public', 'data', 'SOURCE_FILES', 'Spaces.csv');
  const liveGameConfig = path.join(dataDir, 'game-data', 'CLEAN_FILES', 'GAME_CONFIG.csv');
  const distGameConfig = path.join(distPath, 'data', 'CLEAN_FILES', 'GAME_CONFIG.csv');
  const publicGameConfig = path.join(cwd, 'public', 'data', 'CLEAN_FILES', 'GAME_CONFIG.csv');
  return {
    liveSpacesPath: liveSpaces,
    stockSpacesPath: fs.existsSync(distSpaces) ? distSpaces : publicSpaces,
    liveGameConfigPath: liveGameConfig,
    stockGameConfigPath: fs.existsSync(distGameConfig) ? distGameConfig : publicGameConfig,
  };
}
