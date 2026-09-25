// tests/hooks/useGitHubSyncStatus.test.ts
//
// Regression test for the version-badge "⚠ behind" false positive: the hook
// compared a hardcoded 7-char slice of the GitHub sha against __APP_VERSION__
// (git rev-parse --short HEAD), whose length varies with repo size. An 8-char
// build hash could never equal a 7-char slice even on an in-sync build.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useGitHubSyncStatus,
  isDocsOnlyChange,
  getVersionBadgeTier,
  getVersionBadgeDetail,
  getVersionBadgeAccessibleLabel,
} from '../../src/components/setup/useGitHubSyncStatus';

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

  it('reports docsOnly=true when every changed file is documentation (Tom, 2026-09-25: "docs-only should not count")', async () => {
    vi.stubGlobal('__APP_VERSION__', 'aaaaaaa');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ sha: 'bbbbbbbccccccccccccccccccccccccccccccc' }))
      .mockResolvedValueOnce(jsonResponse({
        ahead_by: 4,
        files: [
          { filename: 'docs/core/CLAUDE.md' },
          { filename: 'TODO.md' },
          { filename: 'tests/hooks/useGitHubSyncStatus.test.ts' },
        ],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubSyncStatus());

    await waitFor(() => expect(result.current.status).toBe('out-of-sync'));
    expect(result.current.docsOnly).toBe(true);
  });

  it('reports docsOnly=false when at least one changed file is not documentation', async () => {
    vi.stubGlobal('__APP_VERSION__', 'aaaaaaa');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ sha: 'bbbbbbbccccccccccccccccccccccccccccccc' }))
      .mockResolvedValueOnce(jsonResponse({
        ahead_by: 1,
        files: [
          { filename: 'docs/core/CLAUDE.md' },
          { filename: 'src/components/setup/PlayerSetup.tsx' },
        ],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubSyncStatus());

    await waitFor(() => expect(result.current.status).toBe('out-of-sync'));
    expect(result.current.docsOnly).toBe(false);
  });
});

describe('isDocsOnlyChange', () => {
  it('treats docs/, .claude/, tests/, *.test.ts(x), vitest.config*.ts and top-level *.md as docs', () => {
    expect(isDocsOnlyChange([
      { filename: 'docs/core/CLAUDE.md' },
      { filename: '.claude/NEXT_SESSION.md' },
      { filename: 'tests/hooks/foo.test.ts' },
      { filename: 'src/utils/foo.test.tsx' },
      { filename: 'vitest.config.ts' },
      { filename: 'vitest.config.integration.ts' },
      { filename: 'README.md' },
      { filename: 'CHANGELOG.md' },
    ])).toBe(true);
  });

  it('treats Mockups/ as NOT docs (Tom: "Mockups/ would still count as a change")', () => {
    expect(isDocsOnlyChange([{ filename: 'Mockups/story-mockup.html' }])).toBe(false);
  });

  it('treats a nested *.md outside docs/ as NOT docs (only top-level *.md counts)', () => {
    expect(isDocsOnlyChange([{ filename: 'src/components/README.md' }])).toBe(false);
  });

  it('treats a rename as docs-only only when both old and new paths are docs', () => {
    expect(isDocsOnlyChange([
      { filename: 'docs/core/NEW_NAME.md', previous_filename: 'docs/core/OLD_NAME.md' },
    ])).toBe(true);
    expect(isDocsOnlyChange([
      { filename: 'docs/core/NEW_NAME.md', previous_filename: 'src/utils/OLD_NAME.ts' },
    ])).toBe(false);
  });

  it('falls back to false (not docs-only) for an empty or 300-capped (truncated) file list', () => {
    expect(isDocsOnlyChange([])).toBe(false);
    const capped = Array.from({ length: 300 }, (_, i) => ({ filename: `docs/file-${i}.md` }));
    expect(isDocsOnlyChange(capped)).toBe(false);
  });
});

describe('getVersionBadgeTier', () => {
  it('is in-sync when status is in-sync', () => {
    expect(getVersionBadgeTier({ status: 'in-sync' })).toBe('in-sync');
  });

  it('is in-sync when out-of-sync but docsOnly', () => {
    expect(getVersionBadgeTier({ status: 'out-of-sync', commitsBehind: 5, docsOnly: true })).toBe('in-sync');
  });

  it('is yellow at 1 commit behind, orange at 2, red at 3+', () => {
    expect(getVersionBadgeTier({ status: 'out-of-sync', commitsBehind: 1 })).toBe('yellow');
    expect(getVersionBadgeTier({ status: 'out-of-sync', commitsBehind: 2 })).toBe('orange');
    expect(getVersionBadgeTier({ status: 'out-of-sync', commitsBehind: 3 })).toBe('red');
    expect(getVersionBadgeTier({ status: 'out-of-sync', commitsBehind: 12 })).toBe('red');
  });

  it('is null while checking or on error (no colour shown)', () => {
    expect(getVersionBadgeTier({ status: 'checking' })).toBeNull();
    expect(getVersionBadgeTier({ status: 'error' })).toBeNull();
  });
});

describe('getVersionBadgeDetail and getVersionBadgeAccessibleLabel', () => {
  it('never say "behind" as a bare visible number claim beyond the hover detail, and stay precise there', () => {
    expect(getVersionBadgeDetail({ status: 'out-of-sync', commitsBehind: 2 })).toBe('2 commits behind master');
    expect(getVersionBadgeDetail({ status: 'out-of-sync', commitsBehind: 1 })).toBe('1 commit behind master');
    expect(getVersionBadgeDetail({ status: 'out-of-sync', commitsBehind: 5, docsOnly: true }))
      .toBe('up to date (only docs changed on master)');
    expect(getVersionBadgeDetail({ status: 'in-sync' })).toBe('up to date');
  });

  it('gives an accessible label per tier without exposing a number', () => {
    expect(getVersionBadgeAccessibleLabel({ status: 'in-sync' })).toBe('Build status: up to date');
    expect(getVersionBadgeAccessibleLabel({ status: 'out-of-sync', commitsBehind: 1 }))
      .not.toMatch(/\d/);
    expect(getVersionBadgeAccessibleLabel({ status: 'checking' })).toBeNull();
  });
});
