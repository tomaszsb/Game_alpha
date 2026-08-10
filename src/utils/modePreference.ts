// src/utils/modePreference.ts
//
// Remembers the player's last EXPLICIT PC/TV choice so a Fire TV Stick user
// (whose Silk UA gets misdetected as a phone/PC when "Request Desktop Site"
// is on — see PhoneScreenWarning.tsx) doesn't have to re-toggle to TV mode
// on every reload. Only an explicit tap of the PC/TV toggle writes here; the
// isSmartTV() auto-detect fallback and the ?mode= URL param never do.

export type PlayMode = 'pc' | 'tv';

const PREFERRED_MODE_KEY = 'unravelcodes:preferred-mode';

export function getStoredPreferredMode(): PlayMode | null {
  try {
    const value = localStorage.getItem(PREFERRED_MODE_KEY);
    return value === 'pc' || value === 'tv' ? value : null;
  } catch {
    return null;
  }
}

export function setStoredPreferredMode(mode: PlayMode): void {
  try {
    localStorage.setItem(PREFERRED_MODE_KEY, mode);
  } catch {
    /* private mode / disabled storage — the toggle still works in-session */
  }
}

/**
 * Initial-mode precedence for the setup screen (v3.0.25, localStorage tier
 * added for the Fire TV Silk-UA-spoof report):
 *   1. ?mode= in the URL (one-shot override — preserves a TV-mode reload
 *      or join link; deliberately never persisted).
 *   2. The last mode explicitly chosen via the PC/TV toggle.
 *   3. isSmartTV() UA auto-detect.
 */
export function resolveInitialMode(
  urlMode: string | null,
  storedMode: PlayMode | null,
  isSmartTVFn: () => boolean,
): PlayMode {
  if (urlMode === 'tv') return 'tv';
  if (urlMode === 'pc') return 'pc';
  if (storedMode) return storedMode;
  return isSmartTVFn() ? 'tv' : 'pc';
}
