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

// 2026-08-25 — the maintainer's rule for the TV history feed: every history
// surface shows the SAME feed and differs only by which filters are applied.
// These pin the user-facing filters that rule requires.
describe('getDisplayableLogEntries — user-facing filters', () => {
  it('filterPlayerId narrows to one player, and "all" does not narrow', () => {
    const entries = [
      makeEntry({ id: 'a', playerId: 'p1' }),
      makeEntry({ id: 'b', playerId: 'p2' }),
    ];
    expect(getDisplayableLogEntries(entries, { filterPlayerId: 'p2' }).map(e => e.id)).toEqual(['b']);
    expect(getDisplayableLogEntries(entries, { filterPlayerId: 'all' }).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('filterType narrows to one kind of event, and "all" does not narrow', () => {
    const entries = [
      makeEntry({ id: 'move', type: 'player_movement' }),
      makeEntry({ id: 'money', type: 'resource_change' }),
    ];
    expect(getDisplayableLogEntries(entries, { filterType: 'resource_change' }).map(e => e.id)).toEqual(['money']);
    expect(getDisplayableLogEntries(entries, { filterType: 'all' }).map(e => e.id)).toEqual(['move', 'money']);
  });

  it('search matches description, player name and details', () => {
    const entries = [
      makeEntry({ id: 'desc', description: 'Paid the filing fee' }),
      makeEntry({ id: 'name', description: 'nothing', playerName: 'Zelda' }),
      makeEntry({ id: 'details', description: 'nothing', details: { cardId: 'W042' } }),
      makeEntry({ id: 'miss', description: 'nothing', playerName: 'Bob' }),
    ];
    expect(getDisplayableLogEntries(entries, { search: 'filing' }).map(e => e.id)).toEqual(['desc']);
    expect(getDisplayableLogEntries(entries, { search: 'zeld' }).map(e => e.id)).toEqual(['name']);
    expect(getDisplayableLogEntries(entries, { search: 'w042' }).map(e => e.id)).toEqual(['details']);
  });

  it('keepTurnDividers keeps turn_start through the user-facing filters (feed structure)', () => {
    const entries = [
      makeEntry({ id: 'divider', type: 'turn_start', playerId: 'p2' }),
      makeEntry({ id: 'mine', playerId: 'p1' }),
    ];
    expect(
      getDisplayableLogEntries(entries, { filterPlayerId: 'p1', keepTurnDividers: true }).map(e => e.id),
    ).toEqual(['divider', 'mine']);
  });

  it('drops turn_start with the filters by default, so exports carry events only', () => {
    const entries = [
      makeEntry({ id: 'divider', type: 'turn_start', playerId: 'p2' }),
      makeEntry({ id: 'mine', playerId: 'p1' }),
    ];
    expect(getDisplayableLogEntries(entries, { filterPlayerId: 'p1' }).map(e => e.id)).toEqual(['mine']);
  });

  it('the hard playerId scope still wins over a wider "who" chip', () => {
    const entries = [
      makeEntry({ id: 'mine', playerId: 'p1' }),
      makeEntry({ id: 'theirs', playerId: 'p2' }),
    ];
    expect(
      getDisplayableLogEntries(entries, { playerId: 'p1', filterPlayerId: 'all' }).map(e => e.id),
    ).toEqual(['mine']);
  });
});
