// tests/hooks/useGitHubSyncStatus.test.ts
//
// Regression test for the version-badge "⚠ behind" false positive: the hook
// compared a hardcoded 7-char slice of the GitHub sha against __APP_VERSION__
// (git rev-parse --short HEAD), whose length varies with repo size. An 8-char
// build hash could never equal a 7-char slice even on an in-sync build.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGitHubSyncStatus } from '../../src/components/setup/useGitHubSyncStatus';

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe('useGitHubSyncStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports in-sync when the build hash is a shorter prefix of the GitHub sha (the bug case)', async () => {
    vi.stubGlobal('__APP_VERSION__', '63c1822');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ sha: '63c18220d834c4456751aee574bda365be909733' })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubSyncStatus());

    await waitFor(() => expect(result.current.status).toBe('in-sync'));
    expect(result.current.latestCommit).toBe('63c1822');
  });

  it('reports in-sync when the build hash is longer than the GitHub API\'s 7-char sha (the exact bug)', async () => {
    vi.stubGlobal('__APP_VERSION__', '63c18220');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ sha: '63c18220d834c4456751aee574bda365be909733' })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubSyncStatus());

    await waitFor(() => expect(result.current.status).toBe('in-sync'));
  });

  it('reports out-of-sync with commitsBehind when the build is genuinely behind master', async () => {
    vi.stubGlobal('__APP_VERSION__', 'aaaaaaa');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ sha: 'bbbbbbbccccccccccccccccccccccccccccccc' }))
      .mockResolvedValueOnce(jsonResponse({ ahead_by: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubSyncStatus());

    await waitFor(() => expect(result.current.status).toBe('out-of-sync'));
    expect(result.current.commitsBehind).toBe(3);
    expect(result.current.latestCommit).toBe('bbbbbbb');
  });

  it('reports error when the initial GitHub fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('__APP_VERSION__', 'abc1234');

    const { result } = renderHook(() => useGitHubSyncStatus());

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
