#!/usr/bin/env node
// scripts/merge-voice-rewrite.mjs
// One-shot script to merge AUTHORED_COPY_REVIEW.md → Spaces.csv (pass 1).
// Pass 1 = text fields only (Title, Event, Action, Outcome, end_turn_label,
// try_again_label, Negotiate). 2 Subsequent rows deleted. ModalConfig.csv
// is left for a follow-up pass once effect_action mappings are mapped.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DOC = join(ROOT, 'docs/core/AUTHORED_COPY_REVIEW.md');
const SPACES = join(ROOT, 'public/data/SOURCE_FILES/Spaces.csv');

// Fields we apply in pass 1 (column names exactly as in Spaces.csv header)
const TEXT_FIELDS = new Set([
  'Title', 'Event', 'Action', 'Outcome', 'end_turn_label', 'try_again_label',
]);

// 2 explicit deletions per the doc preamble
const DELETIONS = new Set([
  'OWNER-SCOPE-INITIATION|Subsequent',
  'OWNER-FUND-INITIATION|Subsequent',
]);

// ---------- doc parser ----------

function stripCellMarkdown(s) {
  // Strip italic markers used for dialogue quotes — *"..."* becomes "..."
  // Also strip bold markers — **...** becomes ...
  // Keep the inner content (smart quotes, em-dashes) verbatim.
  let v = s.trim();
  // Trim wrapping italic/bold pairs (recursively)
  while (true) {
    const before = v;
    v = v.replace(/^\*\*([\s\S]+)\*\*$/, '$1').trim();
    v = v.replace(/^\*([\s\S]+)\*$/, '$1').trim();
    if (v === before) break;
  }
  return v;
}

function parseDoc(text) {
  // Map of `${space}|${visit}` → { fields: {Title:..., Event:...}, negotiate: 'YES'|'NO' }
  const changes = new Map();
  // Track flagged "(empty)" / "(keep)" / "(not rendered)" sentinels
  // (empty) → real empty string
  // (keep) → don't change
  // (not rendered) → don't change
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^## ([A-Z][A-Z0-9-]*)\s*\/\s*(First|Subsequent)\b(.*)/);
    if (!m) { i++; continue; }
    const space = m[1];
    const visit = m[2];
    const rest = m[3];
    const key = `${space}|${visit}`;
    // Skip DELETE ROW sections — they're handled via DELETIONS set
    if (/DELETE ROW/i.test(rest)) { i++; continue; }
    // Detect Negotiate value from header
    let negotiate = null;
    const negMatch = rest.match(/Negotiate:\s*\*?\*?(YES|NO)\*?\*?/i);
    if (negMatch) negotiate = negMatch[1].toUpperCase();
    // Find the next "### Field-level replacements" table
    let j = i + 1;
    while (j < lines.length && !/^### Field-level replacements/.test(lines[j])) {
      if (/^## /.test(lines[j])) break; // hit next section without finding table
      j++;
    }
    if (j >= lines.length || !/^### Field-level replacements/.test(lines[j])) {
      i++;
      continue;
    }
    // Now scan table rows until blank line or next ###/##
    j++;
    while (j < lines.length && !/^(### |## )/.test(lines[j])) {
      const row = lines[j];
      if (row.startsWith('|') && !/^\|\s*Field\s*\|/.test(row) && !/^\|\s*-+/.test(row)) {
        // Split by | (markdown table). Watch for escaped pipes — assume none in the doc.
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length >= 3) {
          const [field, _current, proposed] = cells;
          if (TEXT_FIELDS.has(field)) {
            const stripped = stripCellMarkdown(proposed);
            // Sentinel handling
            if (/^\(empty\)$/i.test(stripped)) {
              setField(changes, key, field, '');
            } else if (/^\(keep/i.test(stripped) || /^\(not rendered/i.test(stripped)) {
              // skip — leave existing value
            } else {
              setField(changes, key, field, stripped);
            }
          }
        }
      }
      j++;
    }
    if (negotiate) setNegotiate(changes, key, negotiate);
    i = j;
  }
  return changes;
}

function setField(changes, key, field, value) {
  if (!changes.has(key)) changes.set(key, { fields: {}, negotiate: null });
  changes.get(key).fields[field] = value;
}

function setNegotiate(changes, key, neg) {
  if (!changes.has(key)) changes.set(key, { fields: {}, negotiate: null });
  changes.get(key).negotiate = neg;
}

// ---------- CSV utils ----------

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

// ---------- main ----------

const docText = readFileSync(DOC, 'utf-8');
const csvText = readFileSync(SPACES, 'utf-8');
const changes = parseDoc(docText);

const lines = csvText.replace(/\r\n/g, '\n').split('\n');
const header = parseCsvLine(lines[0]);
const colIdx = Object.fromEntries(header.map((c, k) => [c, k]));

const requiredCols = [...TEXT_FIELDS, 'Negotiate', 'space_name', 'visit_type'];
for (const col of requiredCols) {
  if (!(col in colIdx)) {
    console.error(`Missing required column in Spaces.csv: ${col}`);
    process.exit(1);
  }
}

const out = [lines[0]];
let updated = 0;
let deleted = 0;
let skipped = 0;
let unknownKeys = 0;

for (let i = 1; i < lines.length; i++) {
  const raw = lines[i];
  if (raw.trim() === '') continue;
  const cells = parseCsvLine(raw);
  const key = `${cells[colIdx.space_name]}|${cells[colIdx.visit_type]}`;
  if (DELETIONS.has(key)) {
    deleted++;
    continue;
  }
  const change = changes.get(key);
  if (!change) {
    skipped++;
    out.push(raw);
    continue;
  }
  let modified = false;
  for (const [field, value] of Object.entries(change.fields)) {
    if (cells[colIdx[field]] !== value) {
      cells[colIdx[field]] = value;
      modified = true;
    }
  }
  if (change.negotiate) {
    const negCol = colIdx['Negotiate'];
    const desired = change.negotiate === 'YES' ? 'YES' : 'No';
    // Check current value — note: existing CSV uses "YES"/"No"/"NO" inconsistently
    if ((cells[negCol] || '').toUpperCase() !== desired.toUpperCase()) {
      cells[negCol] = desired;
      modified = true;
    }
  }
  if (modified) updated++;
  out.push(cells.map(escCsv).join(','));
}

// Detect doc-side keys that have no matching CSV row
const csvKeys = new Set();
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === '') continue;
  const cells = parseCsvLine(lines[i]);
  csvKeys.add(`${cells[colIdx.space_name]}|${cells[colIdx.visit_type]}`);
}
for (const docKey of changes.keys()) {
  if (!csvKeys.has(docKey)) {
    console.warn(`[WARN] Doc has changes for ${docKey} but no row exists in Spaces.csv`);
    unknownKeys++;
  }
}

writeFileSync(SPACES, out.join('\n') + (csvText.endsWith('\n') ? '' : ''), 'utf-8');

console.log(`merged: ${updated} rows updated, ${deleted} rows deleted, ${skipped} rows untouched, ${unknownKeys} doc keys with no CSV row`);
console.log(`changes parsed from doc: ${changes.size} (space|visit) entries`);
