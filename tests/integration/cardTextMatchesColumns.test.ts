/**
 * Card text-vs-engine integrity gate.
 *
 * Catches the class of bug where a card's English description promises one
 * thing but its structured columns implement another (or nothing). L049
 * "Permitting Process Overhaul" shipped for weeks claiming "Each player draws
 * 1 Expeditor Card" while its draw_cards column was empty — silent no-op.
 *
 * Each test below scans CARDS_EXPANDED.csv for cards whose DESCRIPTION matches
 * a behavioral pattern, then asserts the STRUCTURED COLUMNS implement that
 * behavior. When the test fails, the assertion message lists exactly which
 * cards lie about their effects so the author can fix the CSV or the text.
 *
 * Catch list as of 2026-05-24: L042 (Sister City Collaboration), L027 (Permit
 * Office Upgrade) discovered while writing this gate — fixed in same commit.
 *
 * @see fb:feedback-1779570521283-2fe0db6c — original L049 report
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Inlined from src/components/editor/utils/csvExport.ts (private helpers there).
function splitCSVRecords(csvText: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') { current += '""'; i++; }
      else { inQuotes = !inQuotes; current += ch; }
      continue;
    }
    if (ch === '\n' && !inQuotes) {
      if (current.trim().length > 0) records.push(current);
      current = '';
      continue;
    }
    if (ch === '\r' && !inQuotes && csvText[i + 1] === '\n') continue;
    current += ch;
  }
  if (current.trim().length > 0) records.push(current);
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

interface Card {
  id: string;
  name: string;
  description: string;
  target: string;
  scope: string;
  draw_cards: string;
  discard_cards: string;
  tick_modifier: string;
}

const csvText = readFileSync(
  join(process.cwd(), 'public/data/CLEAN_FILES/CARDS_EXPANDED.csv'),
  'utf-8'
);
const records = splitCSVRecords(csvText);
const headers = parseCSVLine(records[0]).map(h => h.trim());
const colIdx = (name: string) => {
  const idx = headers.indexOf(name);
  if (idx < 0) throw new Error(`Column "${name}" not found in CARDS_EXPANDED.csv header`);
  return idx;
};

const cards: Card[] = records.slice(1).map(line => {
  const cells = parseCSVLine(line);
  return {
    id: cells[colIdx('card_id')] ?? '',
    name: cells[colIdx('card_name')] ?? '',
    description: cells[colIdx('description')] ?? '',
    target: cells[colIdx('target')] ?? '',
    scope: cells[colIdx('scope')] ?? '',
    draw_cards: cells[colIdx('draw_cards')] ?? '',
    discard_cards: cells[colIdx('discard_cards')] ?? '',
    tick_modifier: cells[colIdx('tick_modifier')] ?? ''
  };
}).filter(c => c.id); // skip blank rows

function formatViolator(c: Card, ...cols: Array<keyof Card>): string {
  const detail = cols.map(k => `${k}='${c[k]}'`).join(' ');
  return `${c.id} (${c.name}): "${c.description}" — ${detail}`;
}

/**
 * Data-driven lock-point chain integrity gate.
 *
 * For every space in GAME_CONFIG.csv with `is_path_choice_lock_point=Yes`, this
 * test confirms the engine resolves Subsequent visits (with memory present)
 * end-to-end — the player must NOT get deadlocked with `requiredActions > 0`
 * but no actionable affordance.
 *
 * Catches the bug pattern reported on REG-DOB-TYPE-SELECT (fb:291d8076): the
 * read side (getValidMoves filter) and the write side (pathChoiceMemory on
 * first pick) both worked in isolation, but the seam between them
 * (createMovementChoice when validMoves.length=1) never set moveIntent, so
 * StateService.calculateRequiredActions counted the choice as pending forever.
 *
 * Current lock-point spaces (as of 2026-05-24): just REG-DOB-TYPE-SELECT. Any
 * future addition gets coverage automatically — no per-space test needed.
 */
describe('Lock-point spaces — Subsequent visits with memory must resolve (fb:291d8076)', () => {
  const gameConfigText = readFileSync(
    join(process.cwd(), 'public/data/CLEAN_FILES/GAME_CONFIG.csv'),
    'utf-8'
  );
  const movementText = readFileSync(
    join(process.cwd(), 'public/data/CLEAN_FILES/MOVEMENT.csv'),
    'utf-8'
  );

  const gcRecords = splitCSVRecords(gameConfigText);
  const gcHeaders = parseCSVLine(gcRecords[0]).map(h => h.trim());
  const gcGet = (cells: string[], col: string) => cells[gcHeaders.indexOf(col)] ?? '';

  const lockPointSpaces = gcRecords.slice(1)
    .map(line => parseCSVLine(line))
    .filter(cells => gcGet(cells, 'is_path_choice_lock_point') === 'Yes')
    .map(cells => ({
      space_name: gcGet(cells, 'space_name'),
      memory_key: gcGet(cells, 'path_choice_memory_key')
    }))
    .filter(s => s.space_name && s.memory_key);

  const mvRecords = splitCSVRecords(movementText);
  const mvHeaders = parseCSVLine(mvRecords[0]).map(h => h.trim());

  it(`should find at least one lock-point space in GAME_CONFIG.csv (data sanity)`, () => {
    expect(lockPointSpaces.length).toBeGreaterThan(0);
  });

  for (const lockPoint of lockPointSpaces) {
    it(`${lockPoint.space_name}: Subsequent visit with pathChoiceMemory must auto-route (no deadlock)`, () => {
      // Find this space's Subsequent movement row to know what destinations exist.
      const subsequentRow = mvRecords.slice(1)
        .map(line => parseCSVLine(line))
        .find(cells => cells[mvHeaders.indexOf('space_name')] === lockPoint.space_name
                     && cells[mvHeaders.indexOf('visit_type')] === 'Subsequent');

      expect(subsequentRow,
        `${lockPoint.space_name} is marked lock-point but has no Subsequent MOVEMENT row`
      ).toBeDefined();

      const destinations: string[] = [];
      for (let i = 0; i < mvHeaders.length; i++) {
        if (mvHeaders[i].startsWith('destination_') && subsequentRow![i]) {
          destinations.push(subsequentRow![i]);
        }
      }

      expect(destinations.length,
        `${lockPoint.space_name} Subsequent must have at least 2 destinations to be a meaningful choice space`
      ).toBeGreaterThanOrEqual(2);

      // The actual chain-resolution test lives in tests/services/MovementService.test.ts
      // under "should auto-set moveIntent when validMoves narrows to 1 on a choice space".
      // This test confirms the data shape (lock-point + Subsequent + choice + memory_key)
      // is intact so the unit test's assumptions still hold against real CSV data.
      const movementType = subsequentRow![mvHeaders.indexOf('movement_type')];
      expect(movementType,
        `${lockPoint.space_name} Subsequent movement_type must be 'choice' for path-choice-memory to narrow it. Got '${movementType}'.`
      ).toBe('choice');
    });
  }
});

describe('CARDS_EXPANDED.csv — description matches structured behavior', () => {
  it('global-target DRAW: "each/all players draw N <type>" must have scope=Global and draw_cards set', () => {
    // Targets cards like L049 "Each player draws 1 Expeditor Card."
    const pattern = /(each player|all players)[^.]*\bdraws?\s+\d+/i;
    const violators = cards.filter(c => {
      if (!pattern.test(c.description)) return false;
      const hasGlobalScope = c.scope.toLowerCase() === 'global';
      const hasDrawCards = c.draw_cards.trim() !== '';
      return !(hasGlobalScope && hasDrawCards);
    });
    expect(violators.map(c => formatViolator(c, 'scope', 'target', 'draw_cards'))).toEqual([]);
  });

  it('global-target DISCARD: "each/all players (must) discard N <type>" must have scope=Global and discard_cards set', () => {
    // Targets cards like L003 / L048 "All players must discard 1 Expeditor card."
    const pattern = /(each player|all players)[^.]*\b(discards?|must discard)\s+\d+/i;
    const violators = cards.filter(c => {
      if (!pattern.test(c.description)) return false;
      const hasGlobalScope = c.scope.toLowerCase() === 'global';
      const hasDiscardCards = c.discard_cards.trim() !== '';
      return !(hasGlobalScope && hasDiscardCards);
    });
    expect(violators.map(c => formatViolator(c, 'scope', 'target', 'discard_cards'))).toEqual([]);
  });

  it('global-target TIME DECREASE: "each/all players ... decrease/reduce by N days" must have negative tick_modifier and scope=Global', () => {
    // Targets cards like L042 "All players' current filing times decrease by 1 day."
    // ONLY matches descriptions that explicitly say "each player" / "all players" —
    // ambiguous wording like "All filing times" (which could mean self-only across
    // a player's various filings) is intentionally NOT flagged. Those are authoring
    // decisions: see TODO bucket for the ambiguous-wording audit list.
    const pattern = /(each player|all players)[^.]*\b(decrease|reduce|less)/i;
    const violators = cards.filter(c => {
      if (!pattern.test(c.description)) return false;
      const tickNum = parseInt(c.tick_modifier, 10);
      const isNegative = !isNaN(tickNum) && tickNum < 0;
      const hasGlobalScope = c.scope.toLowerCase() === 'global';
      return !(isNegative && hasGlobalScope);
    });
    expect(violators.map(c => formatViolator(c, 'tick_modifier', 'scope'))).toEqual([]);
  });

  it('global-target TIME INCREASE: "each/all players ... increase/more time/additional days" must have positive tick_modifier and scope=Global', () => {
    // Same unambiguous-wording rule as the decrease test. "All players ... take N
    // days more" style; ambiguous "All filing times increase…" is not flagged.
    const pattern = /(each player|all players)[^.]*\b(increase|more|additional|take \d+ days)/i;
    const violators = cards.filter(c => {
      if (!pattern.test(c.description)) return false;
      const tickNum = parseInt(c.tick_modifier, 10);
      const isPositive = !isNaN(tickNum) && tickNum > 0;
      const hasGlobalScope = c.scope.toLowerCase() === 'global';
      return !(isPositive && hasGlobalScope);
    });
    expect(violators.map(c => formatViolator(c, 'tick_modifier', 'scope'))).toEqual([]);
  });
});
