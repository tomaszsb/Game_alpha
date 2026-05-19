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

const SPACES_KNOWN_HEADERS = [
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

function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a single CSV line, handling quoted fields with commas and escaped quotes.
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

/**
 * Parse Spaces.csv text into SpaceRow[]. Header-aware: unknown columns are
 * captured into row._extraColumns so they survive the editor's save.
 */
export function parseSpacesCSV(csvText: string): SpaceRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^﻿/, '').trim());

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
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^﻿/, '').trim());
  const idx = (name: string) => headers.indexOf(name);

  const rows: DiceRollRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const space_name = (cols[idx('space_name')] ?? '').replace(/^﻿/, '');
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
      roll_group: cols[idx('roll_group')] ?? ''
    });
  }
  return rows;
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
 * Export ModalConfigRow array to ModalConfig.csv format
 */
export function exportModalConfigCSV(modalConfigs: ModalConfigRow[]): string {
  const headers = ['space_name', 'visit_type', 'effect_action', 'modal_title', 'modal_description', 'modal_button_label', 'modal_summary', 'dice_value'];

  const rows = modalConfigs.map(row => [
    escapeCSV(row.space_name),
    escapeCSV(row.visit_type),
    escapeCSV(row.effect_action),
    escapeCSV(row.modal_title),
    escapeCSV(row.modal_description),
    escapeCSV(row.modal_button_label),
    escapeCSV(row.modal_summary),
    escapeCSV(row.dice_value || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

/**
 * Parse ModalConfig.csv text into ModalConfigRow array
 */
export function parseModalConfigCSV(csvText: string): ModalConfigRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const rows: ModalConfigRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols[0]) continue;
    rows.push({
      space_name: cols[0] || '',
      visit_type: (cols[1] as 'First' | 'Subsequent') || 'First',
      effect_action: cols[2] || '',
      modal_title: cols[3] || '',
      modal_description: cols[4] || '',
      modal_button_label: cols[5] || '',
      modal_summary: cols[6] || '',
      dice_value: cols[7] || ''
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
