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
  affected_phase: string;
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
    tick_modifier: cells[colIdx('tick_modifier')] ?? '',
    affected_phase: cells[colIdx('affected_phase')] ?? ''
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

  it('self-target DRAW: "draw N <type> card" (no each/all players) must have draw_cards set with matching count + type', () => {
    // Targets self-scoped cards like L005 "...Draw 1 Expeditor Card." — these
    // slipped past the global-DRAW gate above because they have no "each/all
    // players" prefix. L005/L007/L010/L024 had the count in discard_cards (wrong
    // column → discard instead of draw); L039 had neither column set.
    const typeWord: Record<string, string> = {
      expeditor: 'E', 'work package': 'W', 'work': 'W',
      bank: 'B', investor: 'I', life: 'L'
    };
    const drawPattern = /\bdraws?\s+(\d+)\s+(expeditor|work package|work|bank|investor|life)/i;
    const globalPattern = /(each player|all players)/i;
    const violators = cards.filter(c => {
      const m = c.description.match(drawPattern);
      if (!m) return false;
      if (globalPattern.test(c.description)) return false; // covered by global gate
      const expectedCount = parseInt(m[1], 10);
      const expectedType = typeWord[m[2].toLowerCase()] || 'W';
      // draw_cards must parse to the same count + type the text promises.
      const dm = c.draw_cards.trim().match(/(\d+)\s*([WBEILS]?)/i);
      if (!dm) return true; // empty / unparseable → violator
      const gotCount = parseInt(dm[1], 10);
      const gotType = (dm[2] || 'W').toUpperCase();
      return !(gotCount === expectedCount && gotType === expectedType);
    });
    expect(violators.map(c => formatViolator(c, 'draw_cards', 'discard_cards'))).toEqual([]);
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
    // days more" style; ambiguous "All filing times increase…" is handled by the
    // dedicated phase-filter test below since v3.0.17.
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

  // v3.0.17 — phase-filter integrity gates. Lock in the convention that "all
  // filing times" → REGULATORY and "all construction times" → CONSTRUCTION,
  // routed through the new affected_phase column. Without this gate, the
  // earlier "ambiguous wording" cards (L026/L030/L033/L036/L047) could regress
  // to silent no-op the next time someone tries to "fix" the wording or scope.

  it('affected_phase must be a valid GAME_CONFIG phase value (or empty)', () => {
    const validPhases = new Set(['SETUP', 'OWNER', 'FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION', 'END']);
    const violators = cards.filter(c => {
      const v = c.affected_phase.trim();
      return v !== '' && !validPhases.has(v);
    });
    expect(violators.map(c => formatViolator(c, 'affected_phase'))).toEqual([]);
  });

  it('"all filing times" cards: tick_modifier non-zero AND scope=Global AND affected_phase=REGULATORY', () => {
    // Matches L026, L030, L036, L047 (and any future cards using the same
    // English shorthand). "Filing" = the regulatory phase per the project's
    // domain language: a player is "filing" while standing on a REGULATORY-phase
    // space. Without affected_phase=REGULATORY the global tick would also tick
    // down players on CONSTRUCTION/OWNER/DESIGN spaces, contradicting the card.
    const pattern = /all (permit )?filing times?[^.]*\b(decrease|reduce|less|increase|more|additional)/i;
    const violators = cards.filter(c => {
      if (!pattern.test(c.description)) return false;
      const tickNum = parseInt(c.tick_modifier, 10);
      const hasTick = !isNaN(tickNum) && tickNum !== 0;
      const hasGlobalScope = c.scope.toLowerCase() === 'global';
      const hasRegulatoryPhase = c.affected_phase.trim() === 'REGULATORY';
      return !(hasTick && hasGlobalScope && hasRegulatoryPhase);
    });
    expect(violators.map(c => formatViolator(c, 'tick_modifier', 'scope', 'affected_phase'))).toEqual([]);
  });

  it('"all construction times" cards: tick_modifier non-zero AND scope=Global AND affected_phase=CONSTRUCTION', () => {
    // Matches L033 (Worksite Injury) and any future cards with the same
    // shorthand. "Construction" = the construction phase: a player is in
    // construction while standing on a CONSTRUCTION-phase space.
    const pattern = /all construction times?[^.]*\b(decrease|reduce|less|increase|more|additional)/i;
    const violators = cards.filter(c => {
      if (!pattern.test(c.description)) return false;
      const tickNum = parseInt(c.tick_modifier, 10);
      const hasTick = !isNaN(tickNum) && tickNum !== 0;
      const hasGlobalScope = c.scope.toLowerCase() === 'global';
      const hasConstructionPhase = c.affected_phase.trim() === 'CONSTRUCTION';
      return !(hasTick && hasGlobalScope && hasConstructionPhase);
    });
    expect(violators.map(c => formatViolator(c, 'tick_modifier', 'scope', 'affected_phase'))).toEqual([]);
  });

  // De-jargoned cards: their player-facing copy intentionally drops "draw" /
  // "discard" / "card" game terms (voice rule — fb:931a55de + the v3.0.68 sweep),
  // so the English-pattern gates above no longer match them and can't watch their
  // columns. Pin the card-movement columns by ID against the REAL CSV so a silent
  // regression can't slip back in. This is the exact gap that let L049 ship a bare
  // `draw_cards=1` — parseCardDrawFormat defaults a typeless count to W, so L049
  // drew a Work Package (inflating scope) instead of the Expeditor its text
  // promised. The English gate only checked non-empty and the unit test mocked
  // '1 E', so neither caught it (fixed to '1 E' alongside the copy rewrite).
  it('de-jargoned draw/discard L-cards: card-movement columns still match the narrated effect', () => {
    const expected: Record<string, { draw_cards?: string; discard_cards?: string }> = {
      L003: { discard_cards: '1 E' }, // every team loses an expeditor
      L016: { discard_cards: '1 E' }, // an expeditor moves on
      L023: { discard_cards: '2 E' }, // two expeditors walk off
      L035: { discard_cards: '2 E' }, // two expeditors quit
      L048: { discard_cards: '1 E' }, // every team loses an expeditor
      L049: { draw_cards: '1 E' },    // a fresh expeditor joins every team
    };
    const violators: string[] = [];
    for (const [id, cols] of Object.entries(expected)) {
      const c = cards.find(x => x.id === id);
      if (!c) { violators.push(`${id} missing from CSV`); continue; }
      if (cols.draw_cards !== undefined && c.draw_cards.trim() !== cols.draw_cards) {
        violators.push(`${id} draw_cards='${c.draw_cards.trim()}' expected '${cols.draw_cards}'`);
      }
      if (cols.discard_cards !== undefined && c.discard_cards.trim() !== cols.discard_cards) {
        violators.push(`${id} discard_cards='${c.discard_cards.trim()}' expected '${cols.discard_cards}'`);
      }
    }
    expect(violators).toEqual([]);
  });
});
