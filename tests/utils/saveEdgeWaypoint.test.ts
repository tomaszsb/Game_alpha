// tests/utils/saveEdgeWaypoint.test.ts
// Edge-waypoint redirects (G160), made permanent 2026-08-04: same shape as
// saveBoardPosition.ts's contract (tagged step+detail result), now against
// /api/instances/<id>/edge-waypoints instead of /positions.

import { describe, it, expect, vi } from 'vitest';
import { fetchEdgeWaypoints, saveEdgeWaypoints, clearEdgeWaypoint, clearAllEdgeWaypoints } from '../../src/utils/saveEdgeWaypoint';
import { DEFAULT_INSTANCE_ID } from '../../src/components/board/saveBoardPosition';

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

describe('fetchEdgeWaypoints', () => {
  it('returns the parsed map on success (each edge is an ordered array of points, multi-bend 2026-08-04), no auth required', async () => {
    let captured: { url: string } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      captured = { url: String(input) };
      return makeJsonResponse({ success: true, edgeWaypoints: { 'A__B': [{ x: 1, y: 2 }, { x: 3, y: 4 }] } });
    });

    const result = await fetchEdgeWaypoints({ fetch: fetchMock as unknown as typeof fetch, getBackendURL: () => 'http://backend:3001' });

    expect(result).toEqual({ 'A__B': [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-waypoints`);
  });

  it('returns {} on a failed request rather than throwing', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    const result = await fetchEdgeWaypoints({ fetch: fetchMock as unknown as typeof fetch, getBackendURL: () => '' });
    expect(result).toEqual({});
  });

  it('returns {} on a non-ok response rather than throwing', async () => {
    const fetchMock = vi.fn(async () => makeJsonResponse({ success: false, error: 'No such instance' }, 404));
    const result = await fetchEdgeWaypoints({ fetch: fetchMock as unknown as typeof fetch, getBackendURL: () => '' });
    expect(result).toEqual({});
  });
});

describe('saveEdgeWaypoints', () => {
  it('happy path: POSTs edgeId + the full ordered points array to the instance endpoint with admin auth', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true, edgeId: 'A__B', configVersion: 2, resolvedVersion: 2 });
    });

    const result = await saveEdgeWaypoints('A__B', [{ x: 120, y: -40.5 }, { x: 200, y: 10 }], {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-waypoints`);
    expect(captured!.init?.method).toBe('POST');
    expect((captured!.init?.headers as Record<string, string>)['x-admin-password']).toBe('hunter2');
    expect(JSON.parse(captured!.init?.body as string)).toEqual({
      edgeId: 'A__B',
      points: [{ x: 120, y: -40.5 }, { x: 200, y: 10 }]
    });
  });

  it('returns step=auth without fetching when neither admin password nor teacher session exists', async () => {
    const fetchMock = vi.fn();
    const result = await saveEdgeWaypoints('A__B', [{ x: 1, y: 2 }], {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => null,
      getTeacherSession: () => null,
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('auth');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authorizes via teacher session when no admin password is present', async () => {
    let captured: { init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { init };
      return makeJsonResponse({ success: true });
    });

    const result = await saveEdgeWaypoints('A__B', [{ x: 1, y: 2 }], {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => null,
      getTeacherSession: () => 'sess-token',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(true);
    expect((captured!.init?.headers as Record<string, string>)['x-teacher-session']).toBe('sess-token');
  });

  it('forwards server step+detail when the endpoint reports a failure', async () => {
    const fetchMock = vi.fn(async () =>
      makeJsonResponse({ success: false, error: 'Failed to save edge waypoint', step: 'bake', detail: 'EACCES' }, 500)
    );

    const result = await saveEdgeWaypoints('A__B', [{ x: 1, y: 2 }], {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('bake');
    expect(result.detail).toBe('EACCES');
  });

  it('returns step=post with the error message on a network failure', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED'); });

    const result = await saveEdgeWaypoints('A__B', [{ x: 1, y: 2 }], {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('post');
    expect(result.detail).toBe('ECONNREFUSED');
  });
});

describe('clearEdgeWaypoint', () => {
  it('DELETEs the specific edge id, URL-encoded', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true });
    });

    const result = await clearEdgeWaypoint('A__B', {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-waypoints/A__B`);
    expect(captured!.init?.method).toBe('DELETE');
  });

  it('returns step=auth without fetching when not signed in', async () => {
    const fetchMock = vi.fn();
    const result = await clearEdgeWaypoint('A__B', {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => null,
      getTeacherSession: () => null,
      getBackendURL: () => ''
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('auth');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('clearAllEdgeWaypoints', () => {
  it('DELETEs the collection endpoint (no edge id)', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true });
    });

    const result = await clearAllEdgeWaypoints({
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-waypoints`);
    expect(captured!.init?.method).toBe('DELETE');
  });
});
