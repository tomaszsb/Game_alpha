#!/usr/bin/env node
/**
 * One-time script: Merge two-row CSV format into single-row format
 * and add real-world card button labels.
 *
 * Current format:  SPACE_DATA (23 cols) + label_row (,end_turn,try_again)
 * New format:      SPACE_DATA + end_turn_label + try_again_label + 5 card labels (30 cols)
 */

import fs from 'fs';
import path from 'path';

const spacesPath = path.resolve('public/data/SOURCE_FILES/Spaces.csv');
const diceRollPath = path.resolve('public/data/SOURCE_FILES/DiceRoll Info.csv');

// ========== Card label mapping ==========
// Maps e_card text → label
function getECardLabel(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.match(/^Draw\s+3/i)) return 'Hire 3 Expeditors';
  if (v.match(/^Draw\s+2/i)) return 'Hire 2 Expeditors';
  if (v.match(/^Draw\s+1$/i)) return 'Hire Expeditor';
  if (v.match(/^Replace\s+1/i)) return 'Replace Expeditor';
  if (v.match(/^Return\s+1/i)) return 'Return Expeditor';
  if (v.match(/person to your right/i)) return 'Reassign Expeditor to player on right';
  if (v.match(/person to your left/i)) return 'Reassign Expeditor to player on left';
  // L-card conditions in e_card column shouldn't happen, but just in case
  if (v.match(/if you roll/i)) return '';
  // Educational text (START-QUICK-PLAY-GUIDE) - keep as custom label
  if (v.length > 30) return ''; // Long educational text, let fallback handle it
  return '';
}

function getBCardLabel(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.match(/^Draw\s+1/i)) return 'Get Bank Loan';
  if (v.match(/^Draw\s+2/i)) return 'Get 2 Bank Loans';
  if (v.length > 30) return ''; // Educational text
  return '';
}

function getICardLabel(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.match(/^Draw\s+1/i)) return 'Get Investment';
  if (v.match(/^Draw\s+2/i)) return 'Get 2 Investments';
  if (v.length > 30) return ''; // Educational text
  return '';
}

function getWCardLabel(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.length > 30) return ''; // Educational text
  return '';
}

// Simple CSV line parser that handles quoted fields
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function escapeCSV(value) {
  if (!value && value !== 0) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ========== Process Spaces.csv ==========
const spacesText = fs.readFileSync(spacesPath, 'utf-8').replace(/\r\n/g, '\n');
const lines = spacesText.trim().split('\n');

// New header with all 30 columns
const newHeader = [
  'space_name', 'phase', 'visit_type', 'Title', 'Event', 'Action', 'Outcome',
  'w_card', 'b_card', 'i_card', 'l_card', 'e_card',
  'Time', 'Fee',
  'space_1', 'space_2', 'space_3', 'space_4', 'space_5',
  'Negotiate', 'requires_dice_roll', 'path', 'rolls',
  'end_turn_label', 'try_again_label',
  'w_card_label', 'b_card_label', 'i_card_label', 'l_card_label', 'e_card_label'
];

const outputRows = [newHeader.join(',')];

// Skip header rows (line 0 = main header, line 1 = label header starting with comma)
let i = 1; // Start after header
// Check if line 1 is the second header row
if (lines[1] && parseCsvLine(lines[1])[0] === '') {
  i = 2; // Skip both header rows
}

while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }

  const values = parseCsvLine(line);
  const spaceName = (values[0] || '').trim();

  // Skip empty space_name rows (shouldn't happen after header, but just in case)
  if (!spaceName) { i++; continue; }

  // This is a data row. Check if next row is a label row (starts with comma)
  let endTurnLabel = values[23] || '';  // May already be inline (FINISH Subsequent)
  let tryAgainLabel = values[24] || '';
  let wCardLabel = values[25] || '';
  let bCardLabel = values[26] || '';
  let iCardLabel = values[27] || '';
  let lCardLabel = values[28] || '';
  let eCardLabel = values[29] || '';

  // Check if next line is a label row
  if (i + 1 < lines.length) {
    const nextValues = parseCsvLine(lines[i + 1]);
    if ((nextValues[0] || '').trim() === '') {
      // It's a label row - extract values
      if (!endTurnLabel && nextValues[1]) endTurnLabel = nextValues[1];
      if (!tryAgainLabel && nextValues[2]) tryAgainLabel = nextValues[2];
      if (!wCardLabel && nextValues[3]) wCardLabel = nextValues[3];
      if (!bCardLabel && nextValues[4]) bCardLabel = nextValues[4];
      if (!iCardLabel && nextValues[5]) iCardLabel = nextValues[5];
      if (!lCardLabel && nextValues[6]) lCardLabel = nextValues[6];
      if (!eCardLabel && nextValues[7]) eCardLabel = nextValues[7];
      i++; // Skip the label row
    }
  }

  // Auto-generate card labels if not already set
  if (!eCardLabel) eCardLabel = getECardLabel(values[11]); // e_card at index 11
  if (!bCardLabel) bCardLabel = getBCardLabel(values[8]);   // b_card at index 8
  if (!iCardLabel) iCardLabel = getICardLabel(values[9]);   // i_card at index 9
  if (!wCardLabel) wCardLabel = getWCardLabel(values[7]);   // w_card at index 7
  // l_card labels left empty (auto-trigger, no buttons shown)

  // Build the 30-column row
  const row = [];
  for (let c = 0; c < 23; c++) {
    row.push(escapeCSV(values[c] || ''));
  }
  row.push(escapeCSV(endTurnLabel));
  row.push(escapeCSV(tryAgainLabel));
  row.push(escapeCSV(wCardLabel));
  row.push(escapeCSV(bCardLabel));
  row.push(escapeCSV(iCardLabel));
  row.push(escapeCSV(lCardLabel));
  row.push(escapeCSV(eCardLabel));

  outputRows.push(row.join(','));
  i++;
}

const newSpacesCSV = outputRows.join('\n') + '\n';
fs.writeFileSync(spacesPath, newSpacesCSV);
console.log(`✅ Spaces.csv: ${outputRows.length - 1} space rows (single-row format with 30 columns)`);

// ========== Process DiceRoll Info.csv ==========
const diceText = fs.readFileSync(diceRollPath, 'utf-8').replace(/\r\n/g, '\n');
const diceLines = diceText.trim().split('\n');

// Die roll type → button label mapping
const diceButtonLabels = {
  'W Cards': 'Determine Work Packages',
  'I Cards': 'Determine Investment Terms',
  'E cards': 'Determine Expeditor Outcome',
  'Fees Paid': 'Determine Fee Amount',
  'Fee Paid': 'Determine Fee Amount',
  'Time outcomes': 'Determine Time Impact',
  'Quality': 'Assess Quality',
  'Multiplier': 'Determine Cost Multiplier',
  'Next Step': 'Determine Next Step',
};

const diceOutput = [diceLines[0]]; // Keep header as-is
for (let d = 1; d < diceLines.length; d++) {
  const line = diceLines[d];
  if (!line.trim()) continue;
  const vals = parseCsvLine(line);
  const dieRoll = (vals[1] || '').trim();
  const existingLabel = (vals[9] || '').trim();

  // Set button_label if not already set
  if (!existingLabel && diceButtonLabels[dieRoll]) {
    vals[9] = diceButtonLabels[dieRoll];
  }

  // Rebuild row
  diceOutput.push(vals.map(v => escapeCSV(v)).join(','));
}

const newDiceCSV = diceOutput.join('\n') + '\n';
fs.writeFileSync(diceRollPath, newDiceCSV);
console.log(`✅ DiceRoll Info.csv: ${diceOutput.length - 1} rows with button labels`);
