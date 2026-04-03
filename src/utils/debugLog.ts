/**
 * Debug logging utility — gates console output behind a debug flag.
 *
 * In production, console.log/warn/debug are suppressed to reduce noise.
 * Enable via: URL param `?debug=true` or `localStorage.setItem('debug', 'true')`.
 * console.error is NEVER suppressed.
 */

const isDebugMode = (): boolean => {
  try {
    if (typeof window !== 'undefined') {
      const urlDebug = new URLSearchParams(window.location.search).get('debug');
      if (urlDebug === 'true') return true;
      return localStorage.getItem('debug') === 'true';
    }
  } catch {
    // SSR or restricted context
  }
  return false;
};

// Cache the result at module load (check once)
let _debugCached: boolean | null = null;
function debugEnabled(): boolean {
  if (_debugCached === null) _debugCached = isDebugMode();
  return _debugCached;
}

/** Reset cache (for testing or after URL change) */
export function resetDebugCache(): void {
  _debugCached = null;
}

/** Debug-gated console.log */
export function debugLog(...args: unknown[]): void {
  if (debugEnabled()) console.log(...args);
}

/** Debug-gated console.warn */
export function debugWarn(...args: unknown[]): void {
  if (debugEnabled()) console.warn(...args);
}

/** Debug-gated console.debug */
export function debugDebug(...args: unknown[]): void {
  if (debugEnabled()) console.debug(...args);
}
