// tests/server/engagementStats.test.ts
// Unit tests for the in-game engagement aggregation pure module
// (server/engagementStats.js). Same pattern as visitorStats.test.ts.

import { describe, it, expect } from 'vitest';
import { parseLogLine } from '../../server/visitorStats.js';
import { aggregateEngagementStats, ABANDON_THRESHOLD_MS } from '../../server/engagementStats.js';

const NOW = Date.parse('2026-08-02T12:00:00.000Z');

function entry(overrides: Record<string, unknown>) {
  return parseLogLine(JSON.stringify({
    timestamp: new Date(NOW).toISOString(),
    ip: '90.128.59.214',
    device: 'Android',
    action: 'GAME_STARTED',
    ...overrides,
  }));
}

function at(msAgo: number, overrides: Record<string, unknown> = {}) {
  return entry({ timestamp: new Date(NOW - msAgo).toISOString(), ...overrides });
}

describe('aggregateEngagementStats', () => {
  it('counts a unique game once per (gameId, playerId, spaceId) even with duplicate reports', () => {
    // Same real moment reported by two devices (e.g. TV + a phone).
    const entries = [
      at(1000, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p1', spaceId: 'OWNER-SCOPE-INITIATION' }),
      at(900, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p1', spaceId: 'OWNER-SCOPE-INITIATION' }),
      at(800, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p2', spaceId: 'OWNER-SCOPE-INITIATION' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.spacesReached).toEqual([{ spaceId: 'OWNER-SCOPE-INITIATION', count: 2 }]);
  });

  it('does not conflate the same space reached in a different game or by a different player', () => {
    const entries = [
      at(1000, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p1', spaceId: 'CON-INITIATION' }),
      at(900, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G2', playerId: 'p1', spaceId: 'CON-INITIATION' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.spacesReached).toEqual([{ spaceId: 'CON-INITIATION', count: 2 }]);
  });

  it('ignores space_reached entries missing gameId/playerId/spaceId', () => {
    const entries = [
      at(1000, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p1' }), // no spaceId
      at(900, { action: 'PLAYTEST_SPACE_REACHED', spaceId: 'CON-INITIATION' }), // no gameId/playerId
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.spacesReached).toEqual([]);
  });

  it('sorts spacesReached and panelOpens by count descending', () => {
    const entries = [
      at(1000, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p1', spaceId: 'A' }),
      at(900, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p2', spaceId: 'A' }),
      at(800, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p3', spaceId: 'B' }),
      at(700, { action: 'PLAYTEST_PANEL_OPENED', panel: 'rules' }),
      at(600, { action: 'PLAYTEST_PANEL_OPENED', panel: 'rules' }),
      at(500, { action: 'PLAYTEST_PANEL_OPENED', panel: 'glossary' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.spacesReached).toEqual([{ spaceId: 'A', count: 2 }, { spaceId: 'B', count: 1 }]);
    expect(result.panelOpens).toEqual([{ panel: 'rules', count: 2 }, { panel: 'glossary', count: 1 }]);
  });

  it('counts panel opens as raw events, not deduped (repeat opens are the signal)', () => {
    const entries = [
      at(1000, { action: 'PLAYTEST_PANEL_OPENED', panel: 'log' }),
      at(900, { action: 'PLAYTEST_PANEL_OPENED', panel: 'log' }),
      at(800, { action: 'PLAYTEST_PANEL_OPENED', panel: 'log' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.panelOpens).toEqual([{ panel: 'log', count: 3 }]);
  });

  it('counts gamesStarted from GAME_STARTED entries, deduped by gameId', () => {
    const entries = [
      at(1000, { action: 'GAME_STARTED', gameId: 'G1' }),
      at(900, { action: 'GAME_STARTED', gameId: 'G1' }), // shouldn't double-count a re-sync
      at(800, { action: 'GAME_STARTED', gameId: 'G2' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.gamesStarted).toBe(2);
  });

  it('counts gamesFinished from PLAYTEST_GAME_FINISHED, deduped by gameId', () => {
    const entries = [
      at(1000, { action: 'GAME_STARTED', gameId: 'G1' }),
      at(500, { action: 'PLAYTEST_GAME_FINISHED', gameId: 'G1' }),
      at(400, { action: 'PLAYTEST_GAME_FINISHED', gameId: 'G1' }), // TV + phone both reported it
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.gamesFinished).toBe(1);
  });

  it('infers a game as abandoned once it started long ago and never finished', () => {
    const entries = [
      at(ABANDON_THRESHOLD_MS + 60_000, { action: 'GAME_STARTED', gameId: 'G1' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.gamesAbandoned).toBe(1);
  });

  it('does NOT count a still-in-progress recent game as abandoned', () => {
    const entries = [
      at(10 * 60 * 1000, { action: 'GAME_STARTED', gameId: 'G1' }), // started 10 min ago
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.gamesAbandoned).toBe(0);
  });

  it('does NOT count a finished game as abandoned even if it ran past the threshold', () => {
    const entries = [
      at(ABANDON_THRESHOLD_MS + 60_000, { action: 'GAME_STARTED', gameId: 'G1' }),
      at(1000, { action: 'PLAYTEST_GAME_FINISHED', gameId: 'G1' }),
    ];
    const result = aggregateEngagementStats(entries, { now: NOW });
    expect(result.gamesAbandoned).toBe(0);
  });

  it('returns empty aggregates for an empty input', () => {
    const result = aggregateEngagementStats([], { now: NOW });
    expect(result).toMatchObject({
      gamesStarted: 0,
      gamesFinished: 0,
      gamesAbandoned: 0,
      spacesReached: [],
      panelOpens: [],
    });
  });
});
