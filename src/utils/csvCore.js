// src/utils/csvCore.js
//
// THE CSV reader. One implementation for the server (server/processGameData.js),
// the game's loader (DataService) and the editor (csvExport) so they can never
// disagree about where a row ends. (Before 2026-10-06 there were three copies with
// two rule sets: two cut rows at EVERY line break, one honoured quotes. A story a
// teacher typed with Enter in it was torn in two by the first two, so a new space
// lost its exit and games got stuck on it.)
//
// Plain JavaScript on purpose: the Node server imports it directly and the browser
// bundle imports it too. `csvCore.d.ts` carries the types.
//
// Rules, RFC-4180-shaped:
//   - a record ends at a line break OUTSIDE quotes; inside quotes a line break (and a
//     comma) belongs to the field;
//   - "" inside quotes is one literal quote;
//   - a CR directly before the record-ending LF is dropped;
//   - text that ends while still inside quotes is malformed: fall back to plain
//     line-by-line splitting so one stray quote cannot swallow the rest of a file.

/**
 * Split CSV text into record strings (quotes kept as written, for parseCsvLine to
 * decode). Blank records are dropped.
 * @param {string} text
 * @returns {string[]}
 */
export function splitCsvRecords(text) {
  const records = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // "" inside quotes is an escaped quote: keep both characters, skip the second,
      // so it does not flip the quote state back off.
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim().length > 0) records.push(current);
      current = '';
    } else if (ch === '\r' && !inQuotes && text[i + 1] === '\n') {
      // CRLF: the CR goes with its LF.
    } else {
      current += ch;
    }
  }
  if (inQuotes) {
    return text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0);
  }
  if (current.trim().length > 0) records.push(current);
  return records;
}

/**
 * Parse one record string into its fields. Quoted fields may hold commas, line
 * breaks and "" (one quote).
 * @param {string} line
 * @param {{ trim?: boolean }} [options] trim each field's surrounding whitespace
 *   (default true: the game's data is read that way; the editor passes false so its
 *   save writes back exactly what it read).
 * @returns {string[]}
 */
export function parseCsvLine(line, options = {}) {
  const trim = options.trim !== false;
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(trim ? current.trim() : current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(trim ? current.trim() : current);
  return out;
}

/**
 * Parse whole CSV text into records of fields.
 * @param {string} text
 * @param {{ trim?: boolean }} [options]
 * @returns {string[][]}
 */
export function parseCsvRecords(text, options = {}) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  return splitCsvRecords(clean).map(r => parseCsvLine(r, options));
}
