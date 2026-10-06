/**
 * CSV Import/Export Utilities for Space Data Editor
 *
 * Round-trips Spaces.csv / DiceRoll Info.csv / ModalConfig.csv between the
 * SOURCE_FILES on disk and the editor's in-memory rows.
 *
 * Spaces.csv has gained 16+ columns since the editor was first written
 * (Workstream 6 data-flag lifts, smart-edge pos_x/pos_y, funding_source).
 * The editor UI only exposes a subset; unknown columns are captured into
 * SpaceRow._extraColumns and written back verbatim so the editor's Save
 * doesn't silently strip them.
 */

import { SpaceRow, DiceRollRow, ModalConfigRow } from '../types/EditorTypes';
import { parseCsvLine as parseCsvLineCore, splitCsvRecords as splitCsvRecordsCore } from '../../../utils/csvCore.js';

export const SPACES_KNOWN_HEADERS = [
  'space_name', 'phase', 'visit_type', 'Title', 'Event', 'Action', 'Outcome',
  'w_card', 'b_card', 'i_card', 'l_card', 'e_card',
  'Time', 'Fee',
  'space_1', 'space_2', 'space_3', 'space_4', 'space_5',
  'Negotiate', 'requires_dice_roll', 'path', 'rolls',
  'end_turn_label', 'try_again_label',
  'w_card_label', 'b_card_label', 'i_card_label', 'l_card_label', 'e_card_label',
  'shake_on', 'tts_field',
  'w_card_narrative', 'b_card_narrative', 'i_card_narrative', 'l_card_narrative', 'e_card_narrative'
] as const;

const SPACES_KNOWN_SET = new Set<string>(SPACES_KNOWN_HEADERS);

const DICE_KNOWN_HEADERS = ['space_name', 'die_roll', 'visit_type', '1', '2', '3', '4', '5', '6', 'button_label', 'roll_group'] as const;
const DICE_KNOWN_SET = new Set<string>(DICE_KNOWN_HEADERS);
const MODAL_KNOWN_HEADERS = ['space_name', 'visit_type', 'effect_action', 'modal_title', 'modal_description', 'modal_button_label', 'modal_summary', 'dice_value'] as const;
const MODAL_KNOWN_SET = new Set<string>(MODAL_KNOWN_HEADERS);

/** The cells of one parsed row whose header the editor does not know, or undefined when there are none. */
function extraColumns(headers: string[], cols: string[], known: Set<string>): Record<string, string> | undefined {
  const extra: Record<string, string> = {};
  for (let h = 0; h < headers.length; h++) {
    const header = headers[h];
    if (!header || known.has(header)) continue;
    extra[header] = cols[h] ?? '';
  }
  return Object.keys(extra).length > 0 ? extra : undefined;
}

/** Every extra header across all rows, in the order first seen. */
function unionExtraHeaders(rows: Array<{ _extraColumns?: Record<string, string> }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row._extraColumns ?? {})) {
      if (!seen.has(key)) { seen.add(key); out.push(key); }
    }
  }
  return out;
}

function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// One CSV reader for the server, the game's loader and the editor: src/utils/csvCore.js.
// The editor reads fields UNtrimmed so a save writes back exactly what it read.
const splitCSVRecords = splitCsvRecordsCore;
const parseCSVLine = (line: string): string[] => parseCsvLineCore(line, { trim: false });

/**
 * Parse Spaces.csv text into SpaceRow[]. Header-aware: unknown columns are
 * captured into row._extraColumns so they survive the editor's save.
 */
export function parseSpacesCSV(csvText: string): SpaceRow[] {
  const lines = splitCSVRecords(csvText.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

  const get = (cols: string[], name: string): string => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (cols[idx] ?? '') : '';
  };

  const rows: SpaceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const space_name = get(cols, 'space_name');
    if (!space_name) continue; // skip empty/blank rows

    const extra: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      const header = headers[h];
      if (!header) continue;
      if (SPACES_KNOWN_SET.has(header)) continue;
      extra[header] = cols[h] ?? '';
    }

    rows.push({
      space_name,
      phase: get(cols, 'phase'),
      visit_type: (get(cols, 'visit_type') || 'First') as 'First' | 'Subsequent',
      Title: get(cols, 'Title'),
      Event: get(cols, 'Event'),
      Action: get(cols, 'Action'),
      Outcome: get(cols, 'Outcome'),
      w_card: get(cols, 'w_card'),
      b_card: get(cols, 'b_card'),
      i_card: get(cols, 'i_card'),
      l_card: get(cols, 'l_card'),
      e_card: get(cols, 'e_card'),
      Time: get(cols, 'Time'),
      Fee: get(cols, 'Fee'),
      space_1: get(cols, 'space_1'),
      space_2: get(cols, 'space_2'),
      space_3: get(cols, 'space_3'),
      space_4: get(cols, 'space_4'),
      space_5: get(cols, 'space_5'),
      Negotiate: get(cols, 'Negotiate'),
      requires_dice_roll: get(cols, 'requires_dice_roll'),
      path: get(cols, 'path'),
      rolls: get(cols, 'rolls'),
      end_turn_label: get(cols, 'end_turn_label'),
      try_again_label: get(cols, 'try_again_label'),
      w_card_label: get(cols, 'w_card_label'),
      b_card_label: get(cols, 'b_card_label'),
      i_card_label: get(cols, 'i_card_label'),
      l_card_label: get(cols, 'l_card_label'),
      e_card_label: get(cols, 'e_card_label'),
      shake_on: get(cols, 'shake_on'),
      tts_field: get(cols, 'tts_field'),
      w_card_narrative: get(cols, 'w_card_narrative'),
      b_card_narrative: get(cols, 'b_card_narrative'),
      i_card_narrative: get(cols, 'i_card_narrative'),
      l_card_narrative: get(cols, 'l_card_narrative'),
      e_card_narrative: get(cols, 'e_card_narrative'),
      _extraColumns: Object.keys(extra).length > 0 ? extra : undefined
    });
  }
  return rows;
}

/**
 * Export SpaceRow array to Spaces.csv format. The known columns come first
 * in canonical order; unknown columns (captured during parse) follow in the
 * order they first appeared, preserving every data flag the editor doesn't
 * expose.
 */
export function exportSpacesCSV(spaces: SpaceRow[]): string {
  // Collect the union of extra headers across all rows, preserving insertion order.
  const extraHeaders: string[] = [];
  const seenExtra = new Set<string>();
  for (const space of spaces) {
    if (!space._extraColumns) continue;
    for (const key of Object.keys(space._extraColumns)) {
      if (!seenExtra.has(key)) {
        seenExtra.add(key);
        extraHeaders.push(key);
      }
    }
  }

  const headers = [...SPACES_KNOWN_HEADERS, ...extraHeaders];

  const rows = spaces.map(space => {
    const known = [
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
    ];
    const extras = extraHeaders.map(h => escapeCSV(space._extraColumns?.[h] ?? ''));
    return [...known, ...extras].join(',');
  });

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Parse DiceRoll Info.csv text into DiceRollRow[]. Header-aware (BOM-safe).
 */
export function parseDiceRollCSV(csvText: string): DiceRollRow[] {
  const lines = splitCSVRecords(csvText.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const idx = (name: string) => headers.indexOf(name);

  const rows: DiceRollRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const space_name = (cols[idx('space_name')] ?? '').replace(/^\uFEFF/, '');
    if (!space_name) continue;
    rows.push({
      space_name,
      die_roll: cols[idx('die_roll')] ?? '',
      visit_type: ((cols[idx('visit_type')] ?? 'First') as 'First' | 'Subsequent'),
      roll_1: cols[idx('1')] ?? '',
      roll_2: cols[idx('2')] ?? '',
      roll_3: cols[idx('3')] ?? '',
      roll_4: cols[idx('4')] ?? '',
      roll_5: cols[idx('5')] ?? '',
      roll_6: cols[idx('6')] ?? '',
      button_label: cols[idx('button_label')] ?? '',
      roll_group: cols[idx('roll_group')] ?? '',
      _extraColumns: extraColumns(headers, cols, DICE_KNOWN_SET)
    });
  }
  return rows;
}

/**
 * Export DiceRollRow array to DiceRoll Info.csv format
 */
export function exportDiceRollCSV(diceRolls: DiceRollRow[]): string {
  const extraHeaders = unionExtraHeaders(diceRolls);
  const headers = [...DICE_KNOWN_HEADERS, ...extraHeaders];

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
    escapeCSV(roll.roll_group || ''),
    ...extraHeaders.map(h => escapeCSV(roll._extraColumns?.[h] ?? ''))
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Export ModalConfigRow array to ModalConfig.csv format
 */
export function exportModalConfigCSV(modalConfigs: ModalConfigRow[]): string {
  const extraHeaders = unionExtraHeaders(modalConfigs);
  const headers = [...MODAL_KNOWN_HEADERS, ...extraHeaders];

  const rows = modalConfigs.map(row => [
    escapeCSV(row.space_name),
    escapeCSV(row.visit_type),
    escapeCSV(row.effect_action),
    escapeCSV(row.modal_title),
    escapeCSV(row.modal_description),
    escapeCSV(row.modal_button_label),
    escapeCSV(row.modal_summary),
    escapeCSV(row.dice_value || ''),
    ...extraHeaders.map(h => escapeCSV(row._extraColumns?.[h] ?? ''))
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Parse ModalConfig.csv text into ModalConfigRow array
 */
export function parseModalConfigCSV(csvText: string): ModalConfigRow[] {
  const lines = splitCSVRecords(csvText.trim());
  if (lines.length < 2) return [];

  // Header-aware (it was positional, so a column added anywhere but the end shifted
  // every field after it). A missing column reads as blank.
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const col = (cols: string[], name: string): string => {
    const i = headers.indexOf(name);
    return i >= 0 ? (cols[i] ?? '') : '';
  };

  const rows: ModalConfigRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!col(cols, 'space_name')) continue;
    rows.push({
      space_name: col(cols, 'space_name'),
      visit_type: (col(cols, 'visit_type') as 'First' | 'Subsequent') || 'First',
      effect_action: col(cols, 'effect_action'),
      modal_title: col(cols, 'modal_title'),
      modal_description: col(cols, 'modal_description'),
      modal_button_label: col(cols, 'modal_button_label'),
      modal_summary: col(cols, 'modal_summary'),
      dice_value: col(cols, 'dice_value'),
      _extraColumns: extraColumns(headers, cols, MODAL_KNOWN_SET)
    });
  }
  return rows;
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

export function downloadSourceFiles(spaces: SpaceRow[], diceRolls: DiceRollRow[]): void {
  const spacesCSV = exportSpacesCSV(spaces);
  downloadFile(spacesCSV, 'Spaces.csv');
  setTimeout(() => {
    const diceRollCSV = exportDiceRollCSV(diceRolls);
    downloadFile(diceRollCSV, 'DiceRoll Info.csv');
  }, 500);
}
