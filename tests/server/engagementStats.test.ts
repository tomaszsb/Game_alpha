// tests/server/engagementStats.test.ts
// Unit tests for the in-game engagement aggregation pure module
// (server/engagementStats.js). Same pattern as visitorStats.test.ts.

import { describe, it, expect } from 'vitest';
import { parseLogLine } from '../../server/visitorStats.js';
import { aggregateEngagementStats, pushBackLogFields, ABANDON_THRESHOLD_MS } from '../../server/engagementStats.js';

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

// TODO.md 2026-08-15/09-01: the maintainer's own testing had no way to be
// excluded from "real player" counts — a prior read of this dataset drew a
// conclusion that later dissolved once that was pointed out (RETRACTED note
// in TODO.md). `byOrigin` makes the maintainer's own home-IP sessions
// distinguishable from everyone else's without discarding either.
describe('aggregateEngagementStats — byOrigin (session attribution)', () => {
  const isHomeIP = (ip: string) => ip === '192.168.1.50';

  it('buckets a game by its OWN GAME_STARTED ip, defaults to all-foreign when isHomeIP is omitted', () => {
    const entries = [
      at(1000, { action: 'GAME_STARTED', gameId: 'G1', ip: '192.168.1.50' }), // home
      at(900, { action: 'GAME_STARTED', gameId: 'G2', ip: '90.128.59.214' }), // foreign
    ];
    const withOrigin = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(withOrigin.byOrigin).toEqual({
      home: { gamesStarted: 1, gamesFinished: 0, gamesAbandoned: 0 },
      foreign: { gamesStarted: 1, gamesFinished: 0, gamesAbandoned: 0 },
    });

    const noOption = aggregateEngagementStats(entries, { now: NOW });
    expect(noOption.byOrigin.home.gamesStarted).toBe(0);
    expect(noOption.byOrigin.foreign.gamesStarted).toBe(2);
  });

  it('a later event from a different ip (e.g. a remote player joining) does not flip the game\'s origin', () => {
    const entries = [
      at(1000, { action: 'GAME_STARTED', gameId: 'G1', ip: '192.168.1.50' }), // maintainer creates it, at home
      at(900, { action: 'PLAYTEST_SPACE_REACHED', gameId: 'G1', playerId: 'p2', spaceId: 'OWNER-SCOPE-INITIATION', ip: '90.128.59.214' }), // a real remote player joins
    ];
    const result = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(result.byOrigin.home.gamesStarted).toBe(1);
    expect(result.byOrigin.foreign.gamesStarted).toBe(0);
  });

  it('tracks gamesFinished and gamesAbandoned per origin, on top of the unchanged totals', () => {
    const entries = [
      at(1000, { action: 'GAME_STARTED', gameId: 'G1', ip: '192.168.1.50' }), // home, finished
      at(500, { action: 'PLAYTEST_GAME_FINISHED', gameId: 'G1' }),
      at(ABANDON_THRESHOLD_MS + 60_000, { action: 'GAME_STARTED', gameId: 'G2', ip: '90.128.59.214' }), // foreign, abandoned
    ];
    const result = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(result.gamesStarted).toBe(2);
    expect(result.gamesFinished).toBe(1);
    expect(result.gamesAbandoned).toBe(1);
    expect(result.byOrigin).toEqual({
      home: { gamesStarted: 1, gamesFinished: 1, gamesAbandoned: 0 },
      foreign: { gamesStarted: 1, gamesFinished: 0, gamesAbandoned: 1 },
    });
  });
});

// v3.2.74 (decided 2026-09-24): count REAL push-backs by space so the question
// "do players know a push-back costs days, and do they look first?" has data
// behind it. A push-back is identified by (game, player, space, visit, turn,
// attempt) — NOT by space alone like space-reach — because a player can
// genuinely push back at the same space twice.
describe('aggregateEngagementStats — pushBacks', () => {
  const isHomeIP = (ip: string) => ip === '192.168.1.50';
  const pb = (over: Record<string, unknown> = {}, msAgo = 1000) =>
    at(msAgo, {
      action: 'PLAYTEST_PUSH_BACK',
      gameId: 'G1',
      playerId: 'p1',
      spaceId: 'ARCH-FEE-REVIEW',
      visitType: 'First',
      daysCharged: 50,
      turn: 4,
      attempt: 1,
      costChecked: true,
      ...over,
    });
  const started = (gameId: string, ip = '90.128.59.214') =>
    at(9000, { action: 'GAME_STARTED', gameId, ip });

  it('returns three empty buckets when nothing was pushed back', () => {
    const result = aggregateEngagementStats([], { now: NOW });
    const empty = { total: 0, bySpace: [] };
    expect(result.pushBacks).toEqual({ home: empty, foreign: empty, unknown: empty });
  });

  it('counts by space + visit + days, most-pushed-back first', () => {
    const entries = [
      started('G1'),
      pb({ attempt: 1 }),
      pb({ attempt: 2 }),
      pb({ spaceId: 'OWNER-SCOPE-INITIATION', daysCharged: 1, turn: 1, attempt: 1 }),
    ];
    const { foreign } = aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks;
    expect(foreign.total).toBe(3);
    expect(foreign.bySpace.map((r: any) => [r.spaceId, r.visitType, r.daysCharged, r.count])).toEqual([
      ['ARCH-FEE-REVIEW', 'First', 50, 2],
      ['OWNER-SCOPE-INITIATION', 'First', 1, 1],
    ]);
  });

  it('counts a genuine second push-back at the same space (different attempt or turn) as another one', () => {
    const entries = [
      started('G1'),
      pb({ turn: 4, attempt: 1 }),
      pb({ turn: 4, attempt: 2 }), // pushed back again the same turn
      pb({ turn: 9, attempt: 1 }), // came back on a later turn
    ];
    expect(aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks.foreign.total).toBe(3);
  });

  it('counts the same push-back once when two screens report it (TV + phone)', () => {
    const entries = [
      started('G1'),
      pb({}, 1000),
      pb({}, 900), // identical identity, second device
    ];
    expect(aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks.foreign.total).toBe(1);
  });

  it('never dedupes an event that cannot say which attempt it was — a raw count beats hiding a real one', () => {
    const entries = [
      started('G1'),
      pb({ turn: undefined, attempt: undefined }, 1000),
      pb({ turn: undefined, attempt: undefined }, 900),
    ];
    expect(aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks.foreign.total).toBe(2);
  });

  it('ignores a push-back missing gameId, playerId or spaceId', () => {
    const entries = [
      started('G1'),
      pb({ gameId: undefined }),
      pb({ playerId: undefined }),
      pb({ spaceId: undefined }),
    ];
    const { pushBacks } = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(pushBacks.foreign.total + pushBacks.home.total + pushBacks.unknown.total).toBe(0);
  });

  it("splits by the game's own origin: home (maintainer + robot) / foreign (everyone else) / unknown (no GAME_STARTED in the log)", () => {
    const entries = [
      started('HOME', '192.168.1.50'),
      started('AWAY'),
      pb({ gameId: 'HOME' }),
      pb({ gameId: 'AWAY' }),
      pb({ gameId: 'AWAY', attempt: 2 }),
      pb({ gameId: 'ORPHAN' }), // its GAME_STARTED line is gone — must NOT be quietly counted as a real player
    ];
    const { pushBacks } = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(pushBacks.home.total).toBe(1);
    expect(pushBacks.foreign.total).toBe(2);
    expect(pushBacks.unknown.total).toBe(1);
  });

  it("attributes a push-back logged BEFORE its game's GAME_STARTED line (out-of-order log)", () => {
    const entries = [
      pb({ gameId: 'G1' }, 9000),
      at(1000, { action: 'GAME_STARTED', gameId: 'G1', ip: '192.168.1.50' }),
    ];
    const { pushBacks } = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(pushBacks.home.total).toBe(1);
    expect(pushBacks.unknown.total).toBe(0);
  });

  it('tallies whether the player had opened the cost box first: yes / no / unknown', () => {
    const entries = [
      started('G1'),
      pb({ attempt: 1, costChecked: true }),
      pb({ attempt: 2, costChecked: true }),
      pb({ attempt: 3, costChecked: false }),
      pb({ attempt: 4, costChecked: null }), // what the server logs when the client did not say
    ];
    const [row] = aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks.foreign.bySpace;
    expect(row.count).toBe(4);
    expect(row.costChecked).toEqual({ yes: 2, no: 1, unknown: 1 });
  });

  it("keeps a space's different day-charges apart (the data changed between games) rather than averaging them", () => {
    const entries = [
      started('G1'),
      pb({ daysCharged: 50 }),
      pb({ daysCharged: 15, attempt: 2 }),
    ];
    const rows = aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks.foreign.bySpace;
    expect(rows.map((r: any) => r.daysCharged).sort((a: number, b: number) => a - b)).toEqual([15, 50]);
  });

  it('records a 0-day push-back as 0, not as "unknown"', () => {
    const entries = [
      started('G1'),
      pb({ spaceId: 'CON-INITIATION', daysCharged: 0 }),
    ];
    const [row] = aggregateEngagementStats(entries, { now: NOW, isHomeIP }).pushBacks.foreign.bySpace;
    expect(row.daysCharged).toBe(0);
  });

  it('leaves every existing total and byOrigin figure exactly as it was', () => {
    const entries = [started('G1'), pb({})];
    const result = aggregateEngagementStats(entries, { now: NOW, isHomeIP });
    expect(result.gamesStarted).toBe(1);
    expect(result.spacesReached).toEqual([]);
    expect(result.panelOpens).toEqual([]);
    expect(result.byOrigin.foreign).toEqual({ gamesStarted: 1, gamesFinished: 0, gamesAbandoned: 0 });
  });
});

describe('pushBackLogFields (what the route adds to a push_back log line)', () => {
  it('passes clean values through', () => {
    expect(
      pushBackLogFields({ visitType: 'First', daysCharged: 50, turn: 4, attempt: 2, costChecked: true }),
    ).toEqual({ visitType: 'First', daysCharged: 50, turn: 4, attempt: 2, costChecked: true });
  });

  it('keeps a 0-day charge and a false costChecked (both are real answers, not "missing")', () => {
    const f = pushBackLogFields({ daysCharged: 0, costChecked: false });
    expect(f.daysCharged).toBe(0);
    expect(f.costChecked).toBe(false);
  });

  it('nulls anything that is the wrong type instead of logging it', () => {
    expect(
      pushBackLogFields({ visitType: 7, daysCharged: '50', turn: NaN, attempt: Infinity, costChecked: 'yes' }),
    ).toEqual({ visitType: null, daysCharged: null, turn: null, attempt: null, costChecked: null });
  });

  it('caps a long string and clamps a runaway number', () => {
    const f = pushBackLogFields({ visitType: 'x'.repeat(500), daysCharged: 1e12, turn: -1e12 });
    expect(f.visitType).toHaveLength(60);
    expect(f.daysCharged).toBe(9999);
    expect(f.turn).toBe(-9999);
  });

  it('survives a missing body', () => {
    expect(pushBackLogFields(undefined)).toEqual({
      visitType: null, daysCharged: null, turn: null, attempt: null, costChecked: null,
    });
  });
});
