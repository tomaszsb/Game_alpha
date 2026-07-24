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
}

const REPO_API = 'https://api.github.com/repos/tomaszsb/Game_alpha';

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
          if (!cancelled) {
            setSyncStatus({
              status: 'out-of-sync',
              latestCommit,
              commitsBehind: compareData.ahead_by || 0,
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
