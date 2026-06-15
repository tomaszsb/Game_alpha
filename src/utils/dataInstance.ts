// src/utils/dataInstance.ts
// Teacher instance layer, Phase 3c — which classroom's board the client loads.
//
// A game belongs to a classroom (Phase 3b). The classroom id rides in the
// URL as `?i=<id>` (set by the join/create flow from the server's
// join-info/create response). The board-data loaders read it here and prefix
// their fetches with the per-instance path the server serves at
// `/data/i/<id>/…`. The default classroom (classroom-1) and any game without
// an `i` param fall back to plain `/data` — so every existing game, and the
// public default, is byte-for-byte unchanged.
//
// Stateless on purpose: deriving from the URL on each call avoids any
// "set the base path before DataService loads" ordering bug across the
// join → full-page-reload boundary.

const DEFAULT_INSTANCE_ID = 'classroom-1';

/**
 * Resolve the data base path from a URL query string. Exposed (rather than
 * only the window-reading wrapper) so it's unit-testable without mocking
 * window.location (which jsdom makes painful — see CODE notes).
 */
export function instanceDataBasePath(search: string): string {
  try {
    const id = new URLSearchParams(search || '').get('i');
    // Same strict id shape the server validates — blocks path traversal and
    // ignores a stray/default value.
    if (id && id !== DEFAULT_INSTANCE_ID && /^[a-z0-9][a-z0-9-]*$/.test(id)) {
      return `/data/i/${id}`;
    }
  } catch {
    // Malformed query string — fall through to the default board.
  }
  return '/data';
}

/** The base path for board-data fetches, derived from the current URL. */
export function getDataBasePath(): string {
  return instanceDataBasePath(typeof window !== 'undefined' ? window.location.search : '');
}

/**
 * The non-default classroom id from a URL query string, or null when the
 * game is on the public default board. Used to decide whether to show a
 * "which classroom am I in" badge (fb:75bec2bc).
 */
export function instanceIdFromSearch(search: string): string | null {
  try {
    const id = new URLSearchParams(search || '').get('i');
    if (id && id !== DEFAULT_INSTANCE_ID && /^[a-z0-9][a-z0-9-]*$/.test(id)) {
      return id;
    }
  } catch {
    // Malformed query string — treat as the default board.
  }
  return null;
}

/** The current non-default classroom id from the browser URL, or null. */
export function getInstanceId(): string | null {
  return instanceIdFromSearch(typeof window !== 'undefined' ? window.location.search : '');
}
