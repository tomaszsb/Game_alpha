// crashReport - when a player lands on the "Something went wrong" screen, the server hears about it (2026-10-31, the
// classroom touch board that crashed with no way to see why). Through the usual tracking call (PLAYTEST_CRASH_SCREEN,
// readable with GET /api/logs): the error's message and stack, the version, the browser's name and the game's code.
// No player names and nothing from the link but the code; the server cleans the text again before it writes it.
// A crash that repeats on every reload reports a few times, not for ever.

import { trackPlaytestEvent } from '../playtest/playtestAnalytics';

declare const __APP_SEMVER__: string | undefined;

const SENT_KEY = 'uc_crash_reports_sent';
const MAX_PER_SESSION = 3;
const seenThisPage = new Set<string>();

/** Takes out anything in a text that looks like a link's secret: `token=...` and the like. */
export function scrubSecrets(text: string): string {
  return text.replace(/\b(token|key|password|secret|auth)=[^&\s"')]+/gi, '$1=[removed]');
}

function sentThisSession(): number {
  try {
    return Number(sessionStorage.getItem(SENT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function noteSent(count: number): void {
  try {
    sessionStorage.setItem(SENT_KEY, String(count));
  } catch {
    /* a browser that blocks storage still has the per-page limit */
  }
}

export function reportCrash(error: Error | null | undefined): void {
  try {
    const message = scrubSecrets(String(error?.message ?? error ?? 'unknown')).slice(0, 300);
    const sent = sentThisSession();
    if (seenThisPage.has(message) || sent >= MAX_PER_SESSION) return;
    seenThisPage.add(message);
    noteSent(sent + 1);
    trackPlaytestEvent('crash_screen', {
      gameId: new URLSearchParams(window.location.search).get('g') ?? undefined,
      message,
      stack: scrubSecrets(String(error?.stack ?? '')).slice(0, 1500),
      version: typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : 'unknown',
      browser: (navigator.userAgent || '').replace(/[^A-Za-z0-9 ;:/._()-]/g, '').slice(0, 160),
    });
  } catch {
    /* the crash screen must show whatever happens here */
  }
}
