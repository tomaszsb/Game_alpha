#!/usr/bin/env node
// scripts/seed-board-positions.mjs
//
// Workstream 3 / Phase A — Living Map seed positions.
//
// Adds pos_x and pos_y columns to public/data/SOURCE_FILES/Spaces.csv if
// missing, and seeds defaults phase-by-phase. Each phase becomes a
// vertical column; spaces within a phase stack down the column. This
// matches the rough layout BoardV3 was already rendering, so flipping
// to a coordinate-driven board (Phase B) starts at visual parity.
//
// Once positions are seeded, future authoring is purely manual — the
// Data Editor (or hand-edits) update pos_x/pos_y, the pipeline
// propagates to CLEAN_FILES, and BoardCanvas (Phase B) renders from
// those numbers. There's no need to ever re-run this script.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SPACES = join(ROOT, 'public/data/SOURCE_FILES/Spaces.csv');

// Phase column layout. Order matches gameplay flow left-to-right.
// Each phase column is 200px wide, tiles inside ~150px, leaves 50px gap.
const PHASE_X = {
  SETUP: 20,
  OWNER: 220,
  FUNDING: 420,
  DESIGN: 620,
  REGULATORY: 820,
  CONSTRUCTION: 1020,
  END: 1220,
};
const ROW_HEIGHT = 110; // 80 tile + 30 gap
const ROW_START_Y = 20;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (inQ) {
      if (ch === '"' && line[k + 1] === '"') { cur += '"'; k++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"' && cur === '') { inQ = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function escCsv(v) {
  const s = String(v ?? '');
  if (s === '') return '';
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const text = readFileSync(SPACES, 'utf-8');
const lines = text.replace(/\r\n/g, '\n').split('\n');
let header = parseCsvLine(lines[0]);

// Add pos_x / pos_y columns if missing
let posXIdx = header.indexOf('pos_x');
let posYIdx = header.indexOf('pos_y');
const headerChanged = posXIdx === -1 || posYIdx === -1;
if (posXIdx === -1) { header.push('pos_x'); posXIdx = header.length - 1; }
if (posYIdx === -1) { header.push('pos_y'); posYIdx = header.length - 1; }
const phaseIdx = header.indexOf('phase');
const spaceIdx = header.indexOf('space_name');
const visitIdx = header.indexOf('visit_type');
if (phaseIdx === -1 || spaceIdx === -1 || visitIdx === -1) {
  console.error('Spaces.csv missing required columns (phase / space_name / visit_type)');
  process.exit(1);
}

// Pass 1: collect distinct space_name → phase. We assign one position per
// space (not per visit) — First and Subsequent rows share coords.
const spaceToPhase = new Map();
const dataRows = [];
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === '') continue;
  const cells = parseCsvLine(lines[i]);
  // Pad for new columns
  while (cells.length < header.length) cells.push('');
  dataRows.push(cells);
  const space = cells[spaceIdx];
  const phase = cells[phaseIdx];
  if (space && !spaceToPhase.has(space)) spaceToPhase.set(space, phase);
}

// Pass 2: assign coords by phase column. Order within a phase is
// alphabetical for now — educators will rearrange manually anyway.
const positions = new Map(); // space → {x, y}
const phaseOrder = ['SETUP', 'OWNER', 'FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION', 'END'];
for (const phase of phaseOrder) {
  const x = PHASE_X[phase];
  if (x === undefined) continue;
  const spacesInPhase = [...spaceToPhase.entries()]
    .filter(([_, p]) => p === phase)
    .map(([s]) => s)
    .sort();
  spacesInPhase.forEach((space, idx) => {
    positions.set(space, { x, y: ROW_START_Y + idx * ROW_HEIGHT });
  });
}

// Catch any phase that wasn't in the layout map (shouldn't happen, but
// log and place at far right so it's visibly off).
for (const [space, phase] of spaceToPhase) {
  if (!positions.has(space)) {
    console.warn(`[WARN] No layout column for phase "${phase}" (space ${space}); placing at x=1500`);
    positions.set(space, { x: 1500, y: 20 });
  }
}

// Pass 3: write positions back, only filling cells that are empty so we
// don't clobber any hand-edits a future re-run might encounter.
let updated = 0;
let skipped = 0;
for (const cells of dataRows) {
  const pos = positions.get(cells[spaceIdx]);
  if (!pos) continue;
  const currentX = (cells[posXIdx] || '').trim();
  const currentY = (cells[posYIdx] || '').trim();
  if (currentX === '' && currentY === '') {
    cells[posXIdx] = String(pos.x);
    cells[posYIdx] = String(pos.y);
    updated++;
  } else {
    skipped++;
  }
}

// Reassemble file
const out = [header.map(escCsv).join(',')];
for (const cells of dataRows) {
  out.push(cells.map(escCsv).join(','));
}
writeFileSync(SPACES, out.join('\n'), 'utf-8');

console.log(`seed-board-positions: header${headerChanged ? ' updated (added pos_x, pos_y)' : ' unchanged'}`);
console.log(`  ${updated} rows seeded, ${skipped} rows already had positions (left alone)`);
console.log(`  ${positions.size} unique spaces positioned across ${phaseOrder.length} phases`);
