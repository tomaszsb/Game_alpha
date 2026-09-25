// src/components/setup/useGitHubSyncStatus.ts
// Pings GitHub for the latest master commit and compares against the build-time
// __APP_VERSION__ short hash. Originally lived in the retired GameLobby
// (deleted in v2.69.0); restored on PlayerSetup so playtesters can tell at a
// glance whether their loaded client matches the latest deploy.
//
// Unauthenticated GitHub API allows ~60 req/hr per IP; we ping once per mount.

import { useEffect, useState } from 'react';
import { debugLog } from '../../utils/debugLog';

export interface GitHubSyncStatus {
  status: 'checking' | 'in-sync' | 'out-of-sync' | 'error';
  latestCommit?: string;
  commitsBehind?: number;
  /** True when every changed file matches the docs-only allowlist below. */
  docsOnly?: boolean;
}

const REPO_API = 'https://api.github.com/repos/tomaszsb/Game_alpha';

// GitHub's compare API caps `files` at 300 entries with no truncation flag —
// a list at or past that cap can't be trusted to be complete, so it falls
// back to the raw commit count instead of being read as "docs only".
const COMPARE_FILES_CAP = 300;

interface CompareFile {
  filename: string;
  previous_filename?: string;
}

// Tom, 2026-09-25: "docs-only should not count" toward the version badge —
// a difference where every changed file is documentation reads as in sync.
// Kept in sync with what the game's own build already leaves out (.dockerignore).
const DOCS_ONLY_PREFIXES = ['docs/', '.claude/', 'tests/'];

function isDocsOnlyPath(path: string): boolean {
  if (DOCS_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (/\.test\.tsx?$/.test(path)) return true;
  if (/^vitest\.config[^/]*\.ts$/.test(path)) return true;
  // Top-level *.md only — a nested doc outside docs/ still counts as code.
  if (/^[^/]+\.md$/.test(path)) return true;
  return false;
}

/** A rename only counts as docs-only when both its old and new paths do. */
export function isDocsOnlyChange(files: CompareFile[]): boolean {
  if (files.length === 0 || files.length >= COMPARE_FILES_CAP) return false;
  return files.every((file) => {
    if (!isDocsOnlyPath(file.filename)) return false;
    if (file.previous_filename && !isDocsOnlyPath(file.previous_filename)) return false;
    return true;
  });
}

export type VersionBadgeTier = 'in-sync' | 'yellow' | 'orange' | 'red';

/**
 * Colour-only reading of sync status for the version badge (Tom, 2026-09-25):
 * up to date is green, 1 commit behind is yellow, 2 is orange, 3+ is red —
 * unless the difference is docs-only, which always reads as up to date.
 */
export function getVersionBadgeTier(status: GitHubSyncStatus): VersionBadgeTier | null {
  if (status.status === 'in-sync') return 'in-sync';
  if (status.status !== 'out-of-sync') return null;
  if (status.docsOnly) return 'in-sync';
  const behind = status.commitsBehind ?? 1;
  if (behind <= 1) return 'yellow';
  if (behind === 2) return 'orange';
  return 'red';
}

/**
 * The exact detail behind the colour, for the badge's hover title — Tom asked
 * to keep this precise even though the colour itself must stay unlabelled.
 */
export function getVersionBadgeDetail(status: GitHubSyncStatus): string {
  if (status.status === 'in-sync') return 'up to date';
  if (status.status !== 'out-of-sync') return '';
  if (status.docsOnly) return 'up to date (only docs changed on master)';
  if (status.commitsBehind === undefined) return 'behind master';
  return `${status.commitsBehind} commit${status.commitsBehind === 1 ? '' : 's'} behind master`;
}

/** Screen-reader label for the colour dot — sighted players aren't meant to notice it. */
export function getVersionBadgeAccessibleLabel(status: GitHubSyncStatus): string | null {
  const tier = getVersionBadgeTier(status);
  if (tier === null) return null;
  if (tier === 'in-sync') return 'Build status: up to date';
  if (tier === 'yellow') return 'Build status: slightly behind the latest';
  if (tier === 'orange') return 'Build status: behind the latest';
  return 'Build status: far behind the latest';
}

export function useGitHubSyncStatus(): GitHubSyncStatus {
  const [syncStatus, setSyncStatus] = useState<GitHubSyncStatus>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`${REPO_API}/commits/master`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });

        if (!response.ok) {
          if (!cancelled) setSyncStatus({ status: 'error' });
          return;
        }

        const data = await response.json();
        const latestCommitFull = String(data.sha || '');
        const latestCommit = latestCommitFull.substring(0, 7);
        const currentCommit = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

        if (!currentCommit || currentCommit === 'unknown') {
          if (!cancelled) setSyncStatus({ status: 'error', latestCommit });
          return;
        }

        // __APP_VERSION__ is `git rev-parse --short HEAD`, whose length varies with
        // repo size (7 chars today, but git widens it once 7 hex digits become
        // ambiguous) — comparing against a hardcoded 7-char slice of the GitHub sha
        // broke as soon as the build hash grew past 7 chars, showing "behind" even
        // when in sync. startsWith is correct regardless of currentCommit's length.
        if (latestCommitFull.startsWith(currentCommit)) {
          if (!cancelled) setSyncStatus({ status: 'in-sync', latestCommit });
          return;
        }

        const compareResponse = await fetch(
          `${REPO_API}/compare/${currentCommit}...master`,
          { headers: { Accept: 'application/vnd.github.v3+json' } }
        );

        if (compareResponse.ok) {
          const compareData = await compareResponse.json();
          const files: CompareFile[] = Array.isArray(compareData.files) ? compareData.files : [];
          if (!cancelled) {
            setSyncStatus({
              status: 'out-of-sync',
              latestCommit,
              commitsBehind: compareData.ahead_by || 0,
              docsOnly: isDocsOnlyChange(files),
            });
          }
        } else if (!cancelled) {
          setSyncStatus({ status: 'out-of-sync', latestCommit });
        }
      } catch (err) {
        debugLog('GitHub sync check failed:', err);
        if (!cancelled) setSyncStatus({ status: 'error' });
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  return syncStatus;
}
