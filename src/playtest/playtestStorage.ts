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

/**
 * The URL reminders should point back to, carrying the campaign source so a
 * return visit via calendar/email/text/push still attributes to the QR/link
 * that originally brought the visitor here. Use this as the functional
 * destination (an <a href>, an ICS URL: field) — never as text a human reads,
 * since the tracking param makes it look cluttered. For display text, use
 * getCleanChallengeUrl() instead.
 */
export function getChallengeUrl(): string {
  const src = getStoredCampaignSource();
  return `https://game.unravelcodes.com/challenge${src ? `?src=${encodeURIComponent(src)}` : ''}`;
}

/**
 * The memorable, human-readable URL — no tracking parameter. Use this
 * anywhere the URL is shown as literal text (email/SMS body copy, calendar
 * description).
 */
export function getCleanChallengeUrl(): string {
  return 'https://game.unravelcodes.com/challenge';
}
