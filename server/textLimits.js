// server/textLimits.js
// How long a piece of teacher- or admin-typed text may be.
//
// Before v3.8.6 nothing checked: a 5,000,000-letter story was saved, the save
// froze the whole server for ~8 s, and every later edit to that classroom was
// just as slow (independent review 2026-10-18). The longest real text on the
// shipped board is ~220 characters, so these caps are far above anything a
// teacher writes on purpose.
//
// The client mirrors these numbers in src/components/classroom/textLimits.ts
// (maxLength on the inputs); tests/server/textLimits.test.ts keeps them equal.

import { parseCsvWithHeaders } from './processGameData.js';

export const TEXT_LIMITS = Object.freeze({
  long: 2000,  // a story, an Event/Action/Outcome line
  short: 200,  // a name, a title, a time or fee value
});

// Fields that are a name or a number-ish value, not a paragraph.
const SHORT_FIELDS = new Set([
  'displayName', 'schoolName', 'name', 'title', 'Title', 'time', 'Time', 'fee', 'Fee', 'label',
]);

// Whole files (checked cell by cell with findOverlongCsvCell) and secrets.
const SKIPPED_FIELDS = new Set(['spacesCSV', 'diceRollCSV', 'modalConfigCSV', 'password']);

const FRIENDLY_NAMES = {
  displayName: 'name', schoolName: 'school name', name: 'name', story: 'story', title: 'title', Title: 'title',
  time: 'time', Time: 'time', fee: 'fee', Fee: 'fee',
  Event: 'Event text', Action: 'Action text', Outcome: 'Outcome text', Why: 'Why text',
};

function limitFor(field) {
  return SHORT_FIELDS.has(field) ? TEXT_LIMITS.short : TEXT_LIMITS.long;
}

/**
 * Walk a request body and return the first text that is too long, or null.
 * Every string is checked, at any depth, against the cap for its field name.
 * @param {unknown} value
 * @returns {{ field: string, length: number, limit: number } | null}
 */
export function findOverlongText(value, field = '', depth = 0) {
  if (depth > 8) return null;
  if (typeof value === 'string') {
    const limit = limitFor(field);
    return value.length > limit ? { field, length: value.length, limit } : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findOverlongText(item, field, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (SKIPPED_FIELDS.has(key)) continue;
      const hit = findOverlongText(item, key, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Same check for one whole CSV the editor posts: every cell, capped by its column.
 * @param {string} csvText
 * @returns {{ field: string, length: number, limit: number } | null}
 */
export function findOverlongCsvCell(csvText) {
  if (typeof csvText !== 'string' || csvText === '') return null;
  for (const row of parseCsvWithHeaders(csvText)) {
    for (const [column, cell] of Object.entries(row)) {
      const hit = findOverlongText(String(cell ?? ''), column);
      if (hit) return hit;
    }
  }
  return null;
}

/** The plain-English refusal a teacher sees. */
export function overlongMessage({ field, length, limit }) {
  const what = FRIENDLY_NAMES[field] || (field ? `"${field}"` : 'text');
  return `The ${what} is too long (${length.toLocaleString('en-US')} characters). `
    + `Please keep it under ${limit.toLocaleString('en-US')} characters and save again.`;
}
