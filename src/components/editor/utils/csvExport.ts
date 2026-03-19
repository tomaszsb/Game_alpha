/**
 * CSV Export Utilities for Space Data Editor
 *
 * Exports edited space data back to SOURCE_FILES format
 * (Spaces.csv and DiceRoll Info.csv)
 */

import { SpaceRow, DiceRollRow } from '../types/EditorTypes';

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
    'w_card_label', 'b_card_label', 'i_card_label', 'l_card_label', 'e_card_label'
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
    escapeCSV(space.e_card_label)
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Export DiceRollRow array to DiceRoll Info.csv format
 */
export function exportDiceRollCSV(diceRolls: DiceRollRow[]): string {
  const headers = ['space_name', 'die_roll', 'visit_type', '1', '2', '3', '4', '5', '6', 'button_label'];

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
    escapeCSV(roll.button_label)
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
