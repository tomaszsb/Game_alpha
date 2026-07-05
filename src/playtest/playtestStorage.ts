// src/playtest/playtestStorage.ts
//
// localStorage helpers for the playtester-acquisition landing page.
// Follows the same try/catch localStorage pattern already used in
// GameLayout.tsx (window may be sandboxed / storage may be disabled).

const VISITED_KEY = 'unravel:playtest-visited';
const SOURCE_KEY = 'unravel:playtest-src';

export function hasVisitedPlaytest(): boolean {
  try {
    return window.localStorage.getItem(VISITED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPlaytestVisited(): void {
  try {
    window.localStorage.setItem(VISITED_KEY, '1');
  } catch {
    /* ignored */
  }
}

export function getStoredCampaignSource(): string | null {
  try {
    return window.localStorage.getItem(SOURCE_KEY);
  } catch {
    return null;
  }
}

export function storeCampaignSource(source: string): void {
  try {
    window.localStorage.setItem(SOURCE_KEY, source);
  } catch {
    /* ignored */
  }
}
