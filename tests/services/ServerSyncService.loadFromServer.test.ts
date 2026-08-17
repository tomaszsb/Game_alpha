// tests/services/ServerSyncService.loadFromServer.test.ts
//
// Covers the 3-way loadFromServer() result (2026-08-17) behind the
// "Play on Perplexity" load-failure report: a genuinely expired/invalid
// shared game link and a brand-new auto-created game's "no state saved
// yet" both surface as HTTP 404 from /api/games/:id/state, but the
// response bodies differ (see server.js validateGameToken vs the
// `if (!game.state)` branch). App.tsx needs to tell them apart to show a
// "this link has expired" message only for the former.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerSyncService } from '../../src/services/ServerSyncService';

vi.mock('../../src/utils/networkDetection', () => ({
  getBackendURL: () => 'http://test-backend',
  getGameStateAPIPath: (gameId?: string) => `/api/games/${gameId}/state`,
  getCurrentGameId: () => 'G-TEST-0001',
  getCurrentGameToken: () => 'tok-abc',
}));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body };
}

describe('ServerSyncService.loadFromServer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns "loaded" and applies state on a successful fetch', async () => {
    const state = { gamePhase: 'PLAY', players: [] };
    fetchMock.mockResolvedValueOnce(jsonResponse({ state, stateVersion: 3 }));
    const setCurrentState = vi.fn();
    const service = new ServerSyncService({ getCurrentState: () => state as any, setCurrentState });

    const result = await service.loadFromServer();

    expect(result).toBe('loaded');
    expect(setCurrentState).toHaveBeenCalledWith(state, 3);
  });

  it('returns "not-found" when the server says the game itself does not exist', async () => {
    // validateGameToken's 404 — no stateVersion in the body.
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Game G-TEST-0001 not found' }, 404));
    const service = new ServerSyncService({ getCurrentState: () => ({} as any), setCurrentState: vi.fn() });

    expect(await service.loadFromServer()).toBe('not-found');
  });

  it('returns "unavailable" (not "not-found") when the game exists but has no saved state yet', async () => {
    // The ordinary freshly-auto-created-game case — stateVersion present.
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'No game state available', gameId: 'G-TEST-0001', stateVersion: 0 }, 404));
    const service = new ServerSyncService({ getCurrentState: () => ({} as any), setCurrentState: vi.fn() });

    expect(await service.loadFromServer()).toBe('unavailable');
  });

  it('returns "unavailable" on a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const service = new ServerSyncService({ getCurrentState: () => ({} as any), setCurrentState: vi.fn() });

    expect(await service.loadFromServer()).toBe('unavailable');
  });

  it('returns "unavailable" on a non-404 non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'server error' }, 500));
    const service = new ServerSyncService({ getCurrentState: () => ({} as any), setCurrentState: vi.fn() });

    expect(await service.loadFromServer()).toBe('unavailable');
  });
});
