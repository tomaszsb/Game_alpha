// Parallel-systems audit (2026-06-04) — Phase 1.2 unit gate.
//
// Pins the canonical log-display filter behavior shared by PlayerLogSection,
// GameLog, and PostGameLogViewer. Future viewer additions should consume this
// helper rather than re-deriving the filter inline.

import { describe, it, expect } from 'vitest';
import { getDisplayableLogEntries } from '../../src/utils/logFiltering';
import { ActionLogEntry } from '../../src/types/StateTypes';

function makeEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    id: 'entry-1',
    timestamp: new Date('2026-06-04T12:00:00Z'),
    type: 'space_entry',
    playerId: 'p1',
    playerName: 'Player 1',
    description: 'desc',
    details: {},
    isCommitted: true,
    explorationSessionId: 'session-1',
    visibility: 'player',
    ...overrides,
  } as ActionLogEntry;
}

describe('getDisplayableLogEntries', () => {
  it('returns committed player-visible entries', () => {
    const entries = [
      makeEntry({ id: 'a' }),
      makeEntry({ id: 'b' }),
    ];
    expect(getDisplayableLogEntries(entries).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('hides uncommitted entries (mid-turn pencil marks)', () => {
    const entries = [
      makeEntry({ id: 'committed', isCommitted: true }),
      makeEntry({ id: 'provisional', isCommitted: false }),
    ];
    expect(getDisplayableLogEntries(entries).map(e => e.id)).toEqual(['committed']);
  });

  it('hides debug / system visibility entries', () => {
    const entries = [
      makeEntry({ id: 'visible', visibility: 'player' }),
      makeEntry({ id: 'debug', visibility: 'debug' }),
      makeEntry({ id: 'system', visibility: 'system' }),
    ];
    expect(getDisplayableLogEntries(entries).map(e => e.id)).toEqual(['visible']);
  });

  it('restricts to a single player when playerId filter is given', () => {
    const entries = [
      makeEntry({ id: 'p1-action', playerId: 'p1' }),
      makeEntry({ id: 'p2-action', playerId: 'p2' }),
      makeEntry({ id: 'p1-other', playerId: 'p1' }),
    ];
    expect(getDisplayableLogEntries(entries, { playerId: 'p1' }).map(e => e.id)).toEqual([
      'p1-action',
      'p1-other',
    ]);
  });

  it('combines all filters (visibility + isCommitted + playerId)', () => {
    const entries = [
      makeEntry({ id: 'keep', playerId: 'p1' }),
      makeEntry({ id: 'wrong-player', playerId: 'p2' }),
      makeEntry({ id: 'uncommitted', playerId: 'p1', isCommitted: false }),
      makeEntry({ id: 'debug-vis', playerId: 'p1', visibility: 'debug' }),
    ];
    expect(getDisplayableLogEntries(entries, { playerId: 'p1' }).map(e => e.id)).toEqual(['keep']);
  });

  it('returns empty array for empty input', () => {
    expect(getDisplayableLogEntries([])).toEqual([]);
  });
});
