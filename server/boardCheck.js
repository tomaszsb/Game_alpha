// server/boardCheck.js
// "Can players still get from start to finish?" — a check of the BUILT board (the
// CLEAN files a classroom is about to be served), not of the teacher's settings.
// Pure: takes the CSV text, returns a report. Used by the classroom bake (so a
// save that would produce an unwinnable board is refused) and by tests.
//
// Added 2026-10-06 (Manager brief Job 2a, editor review R1/R2/R5). The settings
// validator (instanceValidation.validateConfig) only looks at the config; it said OK
// to a board whose new space had no exit and to one whose FINISH was switched off.
//
// Edges come from every source the engine moves along: MOVEMENT destinations, the
// six DICE_OUTCOMES faces ("A or B" cells count as both), and LOGIC_QUESTIONS
// targets that are space names. The generous union means "reachable" here is a
// necessary condition, not a promise — the ghost bot is the real play test.

import { parseCsvWithHeaders } from './processGameData.js';

const SPACE_TOKEN = /[A-Z][A-Z0-9-]{2,}/g;
const isYes = v => String(v || '').trim().toLowerCase() === 'yes';
const tokens = text => String(text || '').match(SPACE_TOKEN) || [];

/**
 * @param {{ gameConfigCsv: string, movementCsv: string, diceOutcomesCsv?: string, logicQuestionsCsv?: string }} args
 * @returns {{ ok: boolean,
 *             errors: Array<{ code: string, space?: string, message: string }>,
 *             warnings: Array<{ code: string, space?: string, message: string }> }}
 */
export function checkBoard({ gameConfigCsv, movementCsv, diceOutcomesCsv = '', logicQuestionsCsv = '' }) {
  const errors = [];
  const warnings = [];
  const configRows = parseCsvWithHeaders(gameConfigCsv);
  const spaces = new Set(configRows.map(r => (r.space_name || '').trim()).filter(Boolean));
  const starts = configRows.filter(r => isYes(r.is_starting_space)).map(r => r.space_name.trim());
  const endings = new Set(configRows.filter(r => isYes(r.is_ending_space)).map(r => r.space_name.trim()));

  if (starts.length === 0) {
    errors.push({ code: 'NO_START_SPACE', message: 'The board has no starting space, so no game can begin.' });
  }
  if (endings.size === 0) {
    errors.push({ code: 'NO_ENDING_SPACE', message: 'The board has no ending space, so no game can be won.' });
  }

  /** @type {Map<string, Set<string>>} */
  const edges = new Map();
  const addEdge = (from, to) => {
    if (!from || !to) return;
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(to);
  };
  const unknown = new Map(); // "from -> to" -> true, so each broken arrow is reported once

  for (const row of parseCsvWithHeaders(movementCsv)) {
    const from = (row.space_name || '').trim();
    for (let i = 1; i <= 5; i++) for (const t of tokens(row[`destination_${i}`])) addEdge(from, t);
  }
  const diceFaces = new Map(); // "space:visit" -> faces filled
  for (const row of parseCsvWithHeaders(diceOutcomesCsv)) {
    const from = (row.space_name || '').trim();
    let filled = 0;
    for (let d = 1; d <= 6; d++) {
      const cell = row[`roll_${d}`];
      if (String(cell || '').trim()) filled++;
      for (const t of tokens(cell)) addEdge(from, t);
    }
    diceFaces.set(`${from}:${row.visit_type}`, filled);
  }
  for (const row of parseCsvWithHeaders(logicQuestionsCsv)) {
    const from = (row.space_name || '').trim();
    for (const cell of [row.yes_target, row.no_target]) {
      // Q2 / Q5 point at other questions; only full space names are board edges.
      const t = String(cell || '').trim();
      if (spaces.has(t) || (/^[A-Z][A-Z0-9]*-[A-Z0-9-]{3,}$/.test(t))) addEdge(from, t);
    }
  }

  for (const [from, to] of edges) {
    for (const t of to) {
      if (!spaces.has(t)) unknown.set(`${from} -> ${t}`, { from, t });
    }
  }
  for (const { from, t } of unknown.values()) {
    errors.push({ code: 'UNKNOWN_DESTINATION', space: from, message: `"${from}" leads to "${t}", which is not on the board.` });
  }

  for (const [key, filled] of diceFaces) {
    if (filled < 6) {
      const space = key.split(':')[0];
      errors.push({ code: 'DICE_INCOMPLETE', space, message: `"${space}" has a roll with only ${filled} of 6 outcomes filled in.` });
    }
  }

  // Reachability from every start.
  const seen = new Set(starts);
  const queue = [...starts];
  while (queue.length) {
    const cur = queue.shift();
    for (const t of edges.get(cur) || []) {
      if (spaces.has(t) && !seen.has(t)) { seen.add(t); queue.push(t); }
    }
  }

  // A dead end only matters where a player can actually arrive. (An off-board
  // space such as the quick-play guide has no exit AND no way in; that is by
  // design, so it is only mentioned below as unreachable.)
  for (const space of seen) {
    if (endings.has(space)) continue;
    const out = [...(edges.get(space) || [])].filter(t => spaces.has(t));
    if (out.length === 0) {
      errors.push({ code: 'NO_EXIT', space, message: `"${space}" has no way out — a player who lands there is stuck.` });
    }
  }

  if (starts.length > 0 && endings.size > 0 && ![...endings].some(e => seen.has(e))) {
    errors.push({ code: 'ENDING_UNREACHABLE', message: 'No path leads from the start to the ending space, so no game can be won.' });
  }
  if (starts.length > 0) {
    for (const space of spaces) {
      if (!seen.has(space)) {
        warnings.push({ code: 'UNREACHABLE_SPACE', space, message: `"${space}" cannot be reached from the start.` });
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * A save is refused only if it makes the board WORSE (2026-10-06, Manager request):
 * a classroom whose board is already broken must still be able to take the save
 * that fixes it. Problems are matched by code + space + message.
 * @param {{ errors: Array<{ code: string, space?: string, message: string }> }} before the board as saved now (or null if it could not be checked)
 * @param {{ errors: Array<{ code: string, space?: string, message: string }> }} after the board this save would produce
 * @returns {{ newErrors: Array<object>, remainingErrors: Array<object> }}
 */
export function compareBoardReports(before, after) {
  const key = e => `${e.code}|${e.space || ''}|${e.message}`;
  const had = new Set((before ? before.errors : []).map(key));
  const newErrors = [];
  const remainingErrors = [];
  for (const e of after.errors) (had.has(key(e)) ? remainingErrors : newErrors).push(e);
  return { newErrors, remainingErrors };
}
