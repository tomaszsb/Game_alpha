// tests/components/board/saveBoardPosition.test.ts
// Drag-to-save, instance-layer edition (Phase 1): positions POST straight
// to /api/instances/classroom-1/positions with the admin header — no more
// whole-CSV round-trip. The tagged result contract (step + detail) that
// BoardCanvas toasts rely on is pinned here.

import { describe, it, expect, vi } from 'vitest';
import { saveBoardPosition, DEFAULT_INSTANCE_ID } from '../../../src/components/board/saveBoardPosition';

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

describe('saveBoardPosition', () => {
  it('happy path: POSTs the coordinates to the instance endpoint with admin auth', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return makeJsonResponse({ success: true, applied: ['TARGET'], configVersion: 3, resolvedVersion: 3 });
    });

    const result = await saveBoardPosition('TARGET', 250, 350, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => 'http://backend:3001'
    });

    expect(result).toEqual({ success: true, spaceName: 'TARGET', x: 250, y: 350 });
    expect(captured!.url).toBe(`http://backend:3001/api/instances/${DEFAULT_INSTANCE_ID}/positions`);
    expect(captured!.init?.method).toBe('POST');
    expect((captured!.init?.headers as Record<string, string>)['x-admin-password']).toBe('hunter2');
    expect(JSON.parse(captured!.init?.body as string)).toEqual({
      positions: { TARGET: { x: 250, y: 350 } }
    });
  });

  it('returns step=auth without fetching when no admin password is in session', async () => {
    const fetchMock = vi.fn();
    const result = await saveBoardPosition('TARGET', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => null,
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('auth');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards server step+detail when the endpoint reports a failure', async () => {
    const fetchMock = vi.fn(async () =>
      makeJsonResponse({ success: false, error: 'Failed to save positions', step: 'bake', detail: 'EACCES' }, 500)
    );

    const result = await saveBoardPosition('TARGET', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('bake');
    expect(result.detail).toBe('EACCES');
  });

  it('surfaces the HTTP status when the server returns no JSON body', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => { throw new Error('no body'); },
      text: async () => ''
    } as unknown as Response));

    const result = await saveBoardPosition('TARGET', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('post');
    expect(result.detail).toBe('HTTP 503');
  });

  it('returns step=post with the error message on a network failure', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED'); });

    const result = await saveBoardPosition('TARGET', 1, 2, {
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
