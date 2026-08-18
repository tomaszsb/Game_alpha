// tests/utils/joinGameFlow.test.ts
//
// Pure logic behind PlayerSetup's "Join" flow — extracted from the retired
// JoinByCodePanel component so it's unit-testable without mounting the full
// setup screen. fetchJoinInfo() classifies a join-info response (404 /
// server error / network error / picker / direct); buildJoinGameUrl() is
// the URL-building behind navigateToGame, including the ?p= short-id gate
// (fb:3a5280d8: picking a player on a PC/TV must never set ?p=, which
// GameLayout reads as "show the phone-only stripped panel").

import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchJoinInfo, buildJoinGameUrl } from '../../src/utils/joinGameFlow';

vi.mock('../../src/utils/networkDetection', () => ({
  getBackendURL: () => 'http://test-backend',
}));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body };
}

describe('fetchJoinInfo', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns not-found for a 404 (mistyped or expired code)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJoinInfo('g418')).resolves.toEqual({ status: 'not-found', gameId: 'G418' });
  });

  it('returns server-error for a non-404 non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJoinInfo('G418')).resolves.toEqual({ status: 'server-error', gameId: 'G418', httpStatus: 500 });
  });

  it('returns network-error when fetch itself throws (offline/DNS/CORS)', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJoinInfo('G418')).resolves.toEqual({ status: 'network-error' });
  });

  it('returns picker when the game has named, pickable players', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      token: 'tok-abc123',
      instanceId: 'classroom-1',
      players: [
        { id: 'player_1', shortId: 'P1', name: 'Alex', color: '#f00', connected: false },
        { id: 'player_2', shortId: 'P2', name: 'Sam', color: '#00f', connected: false },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJoinInfo('G418')).resolves.toEqual({
      status: 'picker',
      gameId: 'G418',
      token: 'tok-abc123',
      instanceId: 'classroom-1',
      players: [
        { id: 'player_1', shortId: 'P1', name: 'Alex', color: '#f00', connected: false },
        { id: 'player_2', shortId: 'P2', name: 'Sam', color: '#00f', connected: false },
      ],
    });
  });

  it('filters out players missing a shortId or a real name from the picker', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      token: 'tok-abc',
      players: [
        { id: 'player_1', shortId: 'P1', name: 'Alex' },
        { id: 'player_2', name: 'NoShortId' },
        { id: 'player_3', shortId: 'P3', name: '   ' },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJoinInfo('G418');
    expect(result.status).toBe('picker');
    if (result.status === 'picker') {
      expect(result.players).toEqual([{ id: 'player_1', shortId: 'P1', name: 'Alex' }]);
    }
  });

  it('returns direct when the game has no named players yet (fresh game)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 'tok-abc', instanceId: 'classroom-1', players: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJoinInfo('G418')).resolves.toEqual({
      status: 'direct',
      gameId: 'G418',
      token: 'tok-abc',
      instanceId: 'classroom-1',
    });
  });

  it('uppercases and trims the code before use', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 'tok', players: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchJoinInfo('  g418  ');
    expect(fetchMock).toHaveBeenCalledWith('http://test-backend/api/games/G418/join-info');
  });
});

describe('buildJoinGameUrl', () => {
  const base = { currentUrl: 'http://localhost/', gameId: 'G418', token: 'tok-abc' };

  it('does not set ?p= when picking a player on a desktop-sized screen (fb:3a5280d8)', () => {
    const url = buildJoinGameUrl({ ...base, playerShortId: 'P1', tvMode: false, isPhoneScreen: false });
    expect(url).toContain('g=G418');
    expect(url).not.toContain('p=P1');
  });

  it('does not set ?p= when picking a player on a TV-sized screen, and sets ?mode=tv', () => {
    const url = buildJoinGameUrl({ ...base, playerShortId: 'P2', tvMode: true, isPhoneScreen: false });
    expect(url).not.toContain('p=P2');
    expect(url).toContain('mode=tv');
  });

  it('sets ?p= when picking a player on a phone-sized screen', () => {
    const url = buildJoinGameUrl({ ...base, playerShortId: 'P1', tvMode: false, isPhoneScreen: true });
    expect(url).toContain('p=P1');
  });

  it('never sets ?p= when no playerShortId is given (spectator/"Just watching")', () => {
    const url = buildJoinGameUrl({ ...base, tvMode: false, isPhoneScreen: true });
    expect(url).not.toContain('p=');
  });

  it('omits ?token when the token is empty', () => {
    const url = buildJoinGameUrl({ ...base, token: '', tvMode: false, isPhoneScreen: false });
    expect(url).not.toContain('token=');
  });

  it('sets ?i= for a non-default classroom, omits it for the default one', () => {
    const withClassroom = buildJoinGameUrl({ ...base, instanceId: 'classroom-7', tvMode: false, isPhoneScreen: false });
    expect(withClassroom).toContain('i=classroom-7');

    const defaultClassroom = buildJoinGameUrl({ ...base, instanceId: 'classroom-1', tvMode: false, isPhoneScreen: false });
    expect(defaultClassroom).not.toContain('i=');
  });

  it('clears a stale ?mode=tv from the current URL when switching to PC', () => {
    const url = buildJoinGameUrl({ ...base, currentUrl: 'http://localhost/?mode=tv', tvMode: false, isPhoneScreen: false });
    expect(url).not.toContain('mode=tv');
  });

  it('sets ?spectate=1 for "Just watching"', () => {
    const url = buildJoinGameUrl({ ...base, tvMode: false, isPhoneScreen: false, spectate: true });
    expect(url).toContain('spectate=1');
  });

  it('never sets ?spectate= for a specific player pick or a direct join', () => {
    const url = buildJoinGameUrl({ ...base, playerShortId: 'P1', tvMode: false, isPhoneScreen: true });
    expect(url).not.toContain('spectate=');
  });

  it('clears a stale ?spectate=1 from the current URL when re-navigating without it', () => {
    const url = buildJoinGameUrl({ ...base, currentUrl: 'http://localhost/?spectate=1', tvMode: false, isPhoneScreen: false });
    expect(url).not.toContain('spectate=');
  });
});
