#!/usr/bin/env node
// scripts/set-narrative.mjs
//
// Set per-action narrative cells in public/data/SOURCE_FILES/Spaces.csv.
// These narratives drive the v2.50.0 in-page accordion (StoryAccordion.tsx)
// — the one shown when a player lands on a space, with one row per authored
// effect.
//
// Voice rule (per docs/core/AUTHORED_COPY_REVIEW.md): ambient/narrator-from-
// above, 2nd person addressing PM. Game terms ("dice", "card", etc.) are
// allowed here — this surface is NOT bound by the no-game-terms rule that
// applies to Title/Event/Action/Outcome/modal copy.
//
// USAGE
//
//   1. Author your narratives in a JSON file. Each entry:
//      {
//        "space_name": "PM-DECISION-CHECK",
//        "visit_type": "First",        // or "Subsequent"
//        "column": "e_card_narrative", // w/b/i/l/e_card_narrative
//        "narrative": "Your text here."
//      }
//
//   2. Apply:
//      $ node scripts/set-narrative.mjs path/to/your-narratives.json
//
//   3. Regenerate CLEAN_FILES so the runtime picks up the new content:
//      $ node scripts/regen-clean-files.mjs
//
// Alternatively, edit Spaces.csv directly via the live Data Editor at
// https://game.unravelcodes.com/admin — it writes through the same
// pipeline (saves trigger processGameData on the server).
//
// PROGRESS TRACKING
//
// As of v2.60.0 (May 2026), 5 of ~75 card-effect rows have authored
// narratives (samples from v2.50.0): OWNER-SCOPE-INITIATION/First/E,
// ARCH-FEE-REVIEW/First/L+E, ARCH-FEE-REVIEW/Subsequent/L+E. The remaining
// ~70 are still empty — when no narrative is authored on any effect of
// a space, StoryAccordion renders null and ActionCenterPanel falls back
// to the legacy flat Action/Outcome blocks. Rollout can be incremental
// with zero gameplay risk.
//
// Priority order from the TODO triage: high-traffic REG/PM/ARCH/ENG first,
// then CON, then setup spaces (OWNER/LEND/BANK/INVESTOR/CHEAT).

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SPACES = join(ROOT, 'public/data/SOURCE_FILES/Spaces.csv');

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

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/set-narrative.mjs <input.json>');
  process.exit(1);
}
const updates = JSON.parse(readFileSync(inputPath, 'utf-8'));

const text = readFileSync(SPACES, 'utf-8');
const lines = text.replace(/\r\n/g, '\n').split('\n');
const header = parseCsvLine(lines[0]);
const colIdx = Object.fromEntries(header.map((c, k) => [c, k]));

let updated = 0;
const out = [lines[0]];
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === '') continue;
  const cells = parseCsvLine(lines[i]);
  const space = cells[colIdx.space_name];
  const visit = cells[colIdx.visit_type];
  let modified = false;
  for (const u of updates) {
    if (u.space_name === space && u.visit_type === visit) {
      const idx = colIdx[u.column];
      if (idx === undefined) {
        console.error(`Unknown column: ${u.column}`);
        process.exit(1);
      }
      cells[idx] = u.narrative;
      modified = true;
      updated++;
    }
  }
  out.push(modified ? cells.map(escCsv).join(',') : lines[i]);
}

writeFileSync(SPACES, out.join('\n'), 'utf-8');
console.log(`set ${updated} narrative cells`);
