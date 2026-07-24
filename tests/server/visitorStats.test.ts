// tests/server/visitorStats.test.ts
// Unit tests for the admin stats aggregation pure module (server/visitorStats.js).
// Feeds a fixed set of parsed log entries and asserts the resulting counts/buckets,
// same pattern as authGuards.test.ts / homeIP.test.ts.

import { describe, it, expect } from 'vitest';
import { parseLogLine, aggregateVisitorStats, ipPrefix } from '../../server/visitorStats.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-24T12:00:00.000Z');

function entry(overrides: Record<string, unknown>) {
  return parseLogLine(JSON.stringify({
    timestamp: new Date(NOW).toISOString(),
    ip: '90.128.59.214',
    device: 'Android',
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/150.0.0.0 Mobile Safari/537.36',
    action: 'CREATE_GAME',
    ...overrides,
  }));
}

function at(hoursAgo: number, overrides: Record<string, unknown> = {}) {
  return entry({ timestamp: new Date(NOW - hoursAgo * 60 * 60 * 1000).toISOString(), ...overrides });
}

describe('parseLogLine', () => {
  it('parses a valid JSON line and adds _ts', () => {
    const e = parseLogLine('{"timestamp":"2026-07-24T12:00:00.000Z","ip":"1.2.3.4","action":"CREATE_GAME"}');
    expect(e).toMatchObject({ ip: '1.2.3.4', action: 'CREATE_GAME' });
    expect(typeof e!._ts).toBe('number');
  });

  it('returns null for malformed JSON, non-objects, and bad timestamps', () => {
    expect(parseLogLine('not json')).toBeNull();
    expect(parseLogLine('42')).toBeNull();
    expect(parseLogLine('{"timestamp":"garbage"}')).toBeNull();
    expect(parseLogLine('')).toBeNull();
  });
});

describe('ipPrefix', () => {
  it('redacts the last octet of an IPv4 address', () => {
    expect(ipPrefix('90.128.59.214')).toBe('90.128.59.xxx');
  });

  it('truncates IPv6 to a /64-ish prefix', () => {
    expect(ipPrefix('2600:4041:abcd:1234::1')).toBe('2600:4041:abcd:1234::xxxx');
  });

  it('passes through non-IP strings unchanged', () => {
    expect(ipPrefix('unknown')).toBe('unknown');
    expect(ipPrefix(undefined as unknown as string)).toBe('unknown');
  });
});

describe('aggregateVisitorStats', () => {
  it('excludes LIST_GAMES admin-noise entries from every real-traffic aggregate', () => {
    const entries = [
      at(1, { action: 'LIST_GAMES' }),
      at(1, { action: 'LIST_GAMES' }),
      at(1, { action: 'CREATE_GAME', gameId: 'G-AAAA-BBBB' }),
    ].filter(Boolean);

    const result = aggregateVisitorStats(entries, { now: NOW, window: '24h' });
    expect(result.totals.inWindow).toBe(1);
    expect(result.totals.adminNoiseExcluded).toBe(2);
    expect(result.kpis.visitsToday).toBe(1);
  });

  it('counts KPI windows correctly (today / 7d / 30d) and unique visitors', () => {
    const entries = [
      at(1, { ip: '1.1.1.1', action: 'CREATE_GAME' }),
      at(1, { ip: '1.1.1.1', action: 'PLAYER_JOINED' }), // same IP, still 2 events
      at(48, { ip: '2.2.2.2', action: 'CREATE_GAME' }), // 2 days ago -> in 7d/30d, not today
      at(20 * 24, { ip: '3.3.3.3', action: 'CREATE_GAME' }), // 20 days ago -> in 30d only
      at(40 * 24, { ip: '4.4.4.4', action: 'CREATE_GAME' }), // 40 days ago -> outside all windows
    ].filter(Boolean);

    const result = aggregateVisitorStats(entries, { now: NOW, window: 'all' });
    expect(result.kpis.visitsToday).toBe(2);
    expect(result.kpis.visits7d).toBe(3);
    expect(result.kpis.visits30d).toBe(4);
    expect(result.kpis.uniqueVisitors7d).toBe(2);
    expect(result.kpis.gamesCreated7d).toBe(2);
    expect(result.kpis.playersSeen7d).toBe(1);
  });

  it('flags a scanner user-agent as a bot and excludes it from the pool by default', () => {
    const entries = [
      at(1, { ip: '5.5.5.5', userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', action: 'CREATE_GAME' }),
      at(1, { ip: '6.6.6.6', action: 'CREATE_GAME' }),
    ].filter(Boolean);

    const excluded = aggregateVisitorStats(entries, { now: NOW, window: '24h' });
    expect(excluded.totals.inWindow).toBe(1);
    expect(excluded.totals.botCount).toBe(1);

    const included = aggregateVisitorStats(entries, { now: NOW, window: '24h', includeBots: true });
    expect(included.totals.inWindow).toBe(2);
  });

  it('flags rapid-fire same-IP bursts as a bot', () => {
    const burstEntries = Array.from({ length: 12 }, (_, i) =>
      parseLogLine(JSON.stringify({
        timestamp: new Date(NOW - 1000 + i * 200).toISOString(), // 12 hits inside 2.4s
        ip: '9.9.9.9',
        device: 'Windows',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        action: 'JOIN_INFO',
        gameId: 'G-ENUM-0001',
      }))
    );
    const normal = at(1, { ip: '10.10.10.10', action: 'JOIN_INFO' });

    const result = aggregateVisitorStats([...burstEntries, normal].filter(Boolean), { now: NOW, window: '24h' });
    expect(result.totals.botCount).toBe(12);
    expect(result.totals.inWindow).toBe(1);
  });

  it('flags campaignSource enumeration (many distinct ?src= values from one IP) as a bot', () => {
    const enumEntries = Array.from({ length: 9 }, (_, i) =>
      parseLogLine(JSON.stringify({
        timestamp: new Date(NOW - i * 10000).toISOString(), // spread over 90s
        ip: '11.11.11.11',
        device: 'Windows',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        action: 'PLAYTEST_LANDING_VIEW',
        campaignSource: `src${i}`,
      }))
    );

    const result = aggregateVisitorStats(enumEntries.filter(Boolean), { now: NOW, window: '24h' });
    expect(result.totals.botCount).toBe(9);
  });

  it('buckets traffic hourly for the 24h window and daily otherwise, with a gamesCreated overlay', () => {
    const entries = [
      at(1, { action: 'CREATE_GAME' }),
      at(1, { action: 'PLAYER_JOINED' }),
      at(2, { action: 'CREATE_GAME' }),
    ].filter(Boolean);

    const hourly = aggregateVisitorStats(entries, { now: NOW, window: '24h' });
    expect(hourly.traffic.length).toBeGreaterThanOrEqual(2);
    const totalVisits = hourly.traffic.reduce((sum, b) => sum + b.visits, 0);
    const totalGames = hourly.traffic.reduce((sum, b) => sum + b.gamesCreated, 0);
    expect(totalVisits).toBe(3);
    expect(totalGames).toBe(2);
  });

  it('breaks down sources into tagged campaign counts plus an untagged bucket', () => {
    const entries = [
      at(1, { action: 'PLAYTEST_LANDING_VIEW', campaignSource: 'reddit' }),
      at(1, { action: 'PLAYTEST_LANDING_VIEW', campaignSource: 'reddit' }),
      at(1, { action: 'PLAYTEST_LANDING_VIEW', campaignSource: 'whatsapp' }),
      at(1, { action: 'CREATE_GAME' }), // no campaignSource -> untagged
    ].filter(Boolean);

    const result = aggregateVisitorStats(entries, { now: NOW, window: '24h' });
    expect(result.sources.tagged).toEqual([
      { source: 'reddit', count: 2 },
      { source: 'whatsapp', count: 1 },
    ]);
    expect(result.sources.untagged).toBe(1);
  });

  it('splits devices by OS, browser, and form factor from the logged fields', () => {
    const entries = [
      at(1, { device: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1' }),
      at(1, { device: 'Windows', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }),
      at(1, { device: 'Android', userAgent: 'Mozilla/5.0 (Linux; Android 14; Smart TV Pro Build/UTT2.250416.001; wv) Chrome/150.0.7871.46 Mobile Safari/537.36' }),
    ].filter(Boolean);

    const result = aggregateVisitorStats(entries, { now: NOW, window: '24h' });
    expect(result.devices.byOS.map((d) => d.name).sort()).toEqual(['Android', 'Windows', 'iPhone'].sort());
    expect(result.devices.byFormFactor.find((f) => f.name === 'tv')?.count).toBe(1);
    expect(result.devices.byFormFactor.find((f) => f.name === 'mobile')?.count).toBe(1);
  });

  it('splits home vs foreign traffic using the provided isHomeIP predicate', () => {
    const entries = [
      at(1, { ip: '192.168.1.5' }),
      at(1, { ip: '8.8.8.8' }),
      at(1, { ip: '8.8.8.8' }),
    ].filter(Boolean);

    const result = aggregateVisitorStats(entries, {
      now: NOW,
      window: '24h',
      isHomeIP: (ip: string) => ip.startsWith('192.168.'),
    });
    expect(result.homeVsForeign).toEqual({ home: 1, foreign: 2 });
  });

  it('redacts IPs to a /24-ish prefix by default and returns full IPs only when full=true', () => {
    const entries = [at(1, { ip: '90.128.59.214' })].filter(Boolean);

    const redacted = aggregateVisitorStats(entries, { now: NOW, window: '24h' });
    expect(redacted.recent[0].ip).toBe('90.128.59.xxx');

    const fullIps = aggregateVisitorStats(entries, { now: NOW, window: '24h', full: true });
    expect(fullIps.recent[0].ip).toBe('90.128.59.214');
  });

  it('applies action/source/search filters to the windowed pool', () => {
    const entries = [
      at(1, { action: 'CREATE_GAME', gameId: 'G-FIND-ME', ip: '1.1.1.1' }),
      at(1, { action: 'DELETE_GAME', gameId: 'G-OTHER', ip: '2.2.2.2' }),
      at(1, { action: 'PLAYTEST_LANDING_VIEW', campaignSource: 'reddit' }),
    ].filter(Boolean);

    const byAction = aggregateVisitorStats(entries, { now: NOW, window: '24h', filters: { action: 'CREATE_GAME' } });
    expect(byAction.totals.inWindow).toBe(1);

    const bySource = aggregateVisitorStats(entries, { now: NOW, window: '24h', filters: { source: 'reddit' } });
    expect(bySource.totals.inWindow).toBe(1);

    const bySearch = aggregateVisitorStats(entries, { now: NOW, window: '24h', filters: { search: 'find-me' } });
    expect(bySearch.totals.inWindow).toBe(1);
  });

  it('returns an empty-but-valid shape for an empty log', () => {
    const result = aggregateVisitorStats([], { now: NOW, window: '7d' });
    expect(result.totals.inWindow).toBe(0);
    expect(result.kpis.visitsToday).toBe(0);
    expect(result.traffic).toEqual([]);
    expect(result.recent).toEqual([]);
    expect(result.geography.available).toBe(false);
  });
});
