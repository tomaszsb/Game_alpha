/**
 * CSV Export Utilities for Space Data Editor
 *
 * Exports edited space data back to SOURCE_FILES format
 * (Spaces.csv and DiceRoll Info.csv)
 */

import { SpaceRow, DiceRollRow, ModalConfigRow } from '../types/EditorTypes';

/**
 * Escape a CSV value - handle commas and quotes
 */
function escapeCSV(value: string): string {
  if (!value) return '';

  // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export SpaceRow array to Spaces.csv format
 */
export function exportSpacesCSV(spaces: SpaceRow[]): string {
  const headers = [
    'space_name', 'phase', 'visit_type', 'Title', 'Event', 'Action', 'Outcome',
    'w_card', 'b_card', 'i_card', 'l_card', 'e_card',
    'Time', 'Fee',
    'space_1', 'space_2', 'space_3', 'space_4', 'space_5',
    'Negotiate', 'requires_dice_roll', 'path', 'rolls',
    'end_turn_label', 'try_again_label',
    'w_card_label', 'b_card_label', 'i_card_label', 'l_card_label', 'e_card_label',
    'shake_on', 'tts_field',
    'w_card_narrative', 'b_card_narrative', 'i_card_narrative', 'l_card_narrative', 'e_card_narrative'
  ];

  const rows = spaces.map(space => [
    escapeCSV(space.space_name),
    escapeCSV(space.phase),
    escapeCSV(space.visit_type),
    escapeCSV(space.Title),
    escapeCSV(space.Event),
    escapeCSV(space.Action),
    escapeCSV(space.Outcome),
    escapeCSV(space.w_card),
    escapeCSV(space.b_card),
    escapeCSV(space.i_card),
    escapeCSV(space.l_card),
    escapeCSV(space.e_card),
    escapeCSV(space.Time),
    escapeCSV(space.Fee),
    escapeCSV(space.space_1),
    escapeCSV(space.space_2),
    escapeCSV(space.space_3),
    escapeCSV(space.space_4),
    escapeCSV(space.space_5),
    escapeCSV(space.Negotiate),
    escapeCSV(space.requires_dice_roll),
    escapeCSV(space.path),
    escapeCSV(space.rolls),
    escapeCSV(space.end_turn_label),
    escapeCSV(space.try_again_label),
    escapeCSV(space.w_card_label),
    escapeCSV(space.b_card_label),
    escapeCSV(space.i_card_label),
    escapeCSV(space.l_card_label),
    escapeCSV(space.e_card_label),
    escapeCSV(space.shake_on || ''),
    escapeCSV(space.tts_field || ''),
    escapeCSV(space.w_card_narrative || ''),
    escapeCSV(space.b_card_narrative || ''),
    escapeCSV(space.i_card_narrative || ''),
    escapeCSV(space.l_card_narrative || ''),
    escapeCSV(space.e_card_narrative || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Export DiceRollRow array to DiceRoll Info.csv format
 */
export function exportDiceRollCSV(diceRolls: DiceRollRow[]): string {
  const headers = ['space_name', 'die_roll', 'visit_type', '1', '2', '3', '4', '5', '6', 'button_label', 'roll_group'];

  const rows = diceRolls.map(roll => [
    escapeCSV(roll.space_name),
    escapeCSV(roll.die_roll),
    escapeCSV(roll.visit_type),
    escapeCSV(roll.roll_1),
    escapeCSV(roll.roll_2),
    escapeCSV(roll.roll_3),
    escapeCSV(roll.roll_4),
    escapeCSV(roll.roll_5),
    escapeCSV(roll.roll_6),
    escapeCSV(roll.button_label),
    escapeCSV(roll.roll_group || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Trigger a file download in the browser
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download both Spaces.csv and DiceRoll Info.csv as a zip
 * (For simplicity, we'll download them separately)
 */
/**
 * Export ModalConfigRow array to ModalConfig.csv format
 */
export function exportModalConfigCSV(modalConfigs: ModalConfigRow[]): string {
  const headers = ['space_name', 'visit_type', 'effect_action', 'modal_title', 'modal_description', 'modal_button_label', 'modal_summary'];

  const rows = modalConfigs.map(row => [
    escapeCSV(row.space_name),
    escapeCSV(row.visit_type),
    escapeCSV(row.effect_action),
    escapeCSV(row.modal_title),
    escapeCSV(row.modal_description),
    escapeCSV(row.modal_button_label),
    escapeCSV(row.modal_summary)
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Parse ModalConfig.csv text into ModalConfigRow array
 */
export function parseModalConfigCSV(csvText: string): ModalConfigRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  const rows: ModalConfigRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols[0]) continue; // skip empty rows
    rows.push({
      space_name: cols[0] || '',
      visit_type: (cols[1] as 'First' | 'Subsequent') || 'First',
      effect_action: cols[2] || '',
      modal_title: cols[3] || '',
      modal_description: cols[4] || '',
      modal_button_label: cols[5] || '',
      modal_summary: cols[6] || ''
    });
  }
  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function downloadSourceFiles(spaces: SpaceRow[], diceRolls: DiceRollRow[]): void {
  // Download Spaces.csv
  const spacesCSV = exportSpacesCSV(spaces);
  downloadFile(spacesCSV, 'Spaces.csv');

  // Download DiceRoll Info.csv after a short delay
  setTimeout(() => {
    const diceRollCSV = exportDiceRollCSV(diceRolls);
    downloadFile(diceRollCSV, 'DiceRoll Info.csv');
  }, 500);
}
