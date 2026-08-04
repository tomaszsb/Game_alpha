// tests/utils/saveEdgeAnchor.test.ts
// Box-side anchor snapping (2026-08-04): same tagged step+detail result
// contract as saveEdgeWaypoint.ts, against /api/instances/<id>/edge-anchors.

import { describe, it, expect, vi } from 'vitest';
import { fetchEdgeAnchors, saveEdgeAnchor, clearEdgeAnchor, clearAllEdgeAnchors } from '../../src/utils/saveEdgeAnchor';
import { DEFAULT_INSTANCE_ID } from '../../src/components/board/saveBoardPosition';

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

describe('fetchEdgeAnchors', () => {
  it('returns the parsed map on success, no auth required', async () => {
    let captured: { url: string } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      captured = { url: String(input) };
      return makeJsonResponse({ success: true, edgeAnchors: { 'A__B': { source: 'top', target: 'left' } } });
    });

    const result = await fetchEdgeAnchors({ fetch: fetchMock as unknown as typeof fetch, getBackendURL: () => 'http://backend:3001' });

    expect(result).toEqual({ 'A__B': { source: 'top', target: 'left' } });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-anchors`);
  });

  it('returns {} on a failed request rather than throwing', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    const result = await fetchEdgeAnchors({ fetch: fetchMock as unknown as typeof fetch, getBackendURL: () => '' });
    expect(result).toEqual({});
  });
});

describe('saveEdgeAnchor', () => {
  it('happy path: POSTs edgeId/end/anchor with admin auth', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true, edgeId: 'A__B' });
    });

    const result = await saveEdgeAnchor('A__B', 'source', 'top', {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-anchors`);
    expect(captured!.init?.method).toBe('POST');
    expect((captured!.init?.headers as Record<string, string>)['x-admin-password']).toBe('hunter2');
    expect(JSON.parse(captured!.init?.body as string)).toEqual({ edgeId: 'A__B', end: 'source', anchor: 'top' });
  });

  it('returns step=auth without fetching when neither admin password nor teacher session exists', async () => {
    const fetchMock = vi.fn();
    const result = await saveEdgeAnchor('A__B', 'source', 'top', {
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

  it('forwards server step+detail when the endpoint reports a failure', async () => {
    const fetchMock = vi.fn(async () =>
      makeJsonResponse({ success: false, error: 'Failed to save edge anchor', step: 'bake', detail: 'EACCES' }, 500)
    );

    const result = await saveEdgeAnchor('A__B', 'target', 'left', {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('bake');
    expect(result.detail).toBe('EACCES');
  });
});

describe('clearEdgeAnchor', () => {
  it('DELETEs the specific edge id + end, URL-encoded', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true });
    });

    const result = await clearEdgeAnchor('A__B', 'target', {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-anchors/A__B/target`);
    expect(captured!.init?.method).toBe('DELETE');
  });
});

describe('clearAllEdgeAnchors', () => {
  it('DELETEs the collection endpoint (no edge id)', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true });
    });

    const result = await clearAllEdgeAnchors({
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/edge-anchors`);
    expect(captured!.init?.method).toBe('DELETE');
  });
});
