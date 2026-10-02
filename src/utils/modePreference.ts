// src/utils/modePreference.ts
//
// Remembers the player's last EXPLICIT PC/TV/Remote choice so a Fire TV Stick
// user (whose Silk UA gets misdetected as a phone/PC when "Request Desktop
// Site" is on — see PhoneScreenWarning.tsx) doesn't have to re-toggle to TV
// mode on every reload. Only an explicit tap of the mode toggle writes here;
// the isSmartTV() auto-detect fallback and the ?mode= URL param never do.

export type PlayMode = 'pc' | 'tv' | 'remote';

const PREFERRED_MODE_KEY = 'unravelcodes:preferred-mode';

// Whether this device remembers what it IS (PC / TV / phone) between visits - "Remember what
// this screen is" in the settings drawer. ON by default (the Fire TV fix above needs it).
// "Remote" is never remembered: it describes one GAME's players (everyone in a different
// place), not a screen, and a remembered "Remote" once turned a TV host into a board +
// controller screen on every device with nothing saying why (Tom, 2026-10-02).
const REMEMBER_MODE_KEY = 'unravelcodes:remember-mode';

export function getRememberMode(): boolean {
  try {
    return localStorage.getItem(REMEMBER_MODE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Turning it off also forgets what was remembered, so the next visit starts clean. */
export function setRememberMode(remember: boolean): void {
  try {
    if (remember) {
      localStorage.removeItem(REMEMBER_MODE_KEY);
    } else {
      localStorage.setItem(REMEMBER_MODE_KEY, 'off');
      localStorage.removeItem(PREFERRED_MODE_KEY);
    }
  } catch {
    /* storage unavailable — nothing to remember either way */
  }
}

export function getStoredPreferredMode(): PlayMode | null {
  if (!getRememberMode()) return null;
  try {
    const value = localStorage.getItem(PREFERRED_MODE_KEY);
    // A 'remote' left over from an older build is ignored, not honoured.
    return value === 'pc' || value === 'tv' ? value : null;
  } catch {
    return null;
  }
}

export function setStoredPreferredMode(mode: PlayMode): void {
  if (!getRememberMode()) return;
  if (mode === 'remote') {
    // Never remembered - and picking it replaces any older PC/TV memory, so a later
    // visit doesn't spring back to a mode from before.
    try { localStorage.removeItem(PREFERRED_MODE_KEY); } catch { /* nothing to clear */ }
    return;
  }
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
 *   2. The last mode explicitly chosen via the mode toggle.
 *   3. isSmartTV() UA auto-detect — never lands on 'remote': a device that
 *      auto-detects as a TV or a plain browser has no way to signal "I'm in
 *      a different location than the others," so that stays an explicit
 *      choice only, same as it's always been for PC vs TV.
 */
export function resolveInitialMode(
  urlMode: string | null,
  storedMode: PlayMode | null,
  isSmartTVFn: () => boolean,
  isPhoneScreenFn: () => boolean = () => false,
): PlayMode {
  if (urlMode === 'tv') return 'tv';
  if (urlMode === 'pc') return 'pc';
  if (urlMode === 'remote') return 'remote';
  // A phone is never the shared TV: a remembered 'tv' must not carry over.
  if (storedMode && !(storedMode === 'tv' && isPhoneScreenFn())) return storedMode;
  return isSmartTVFn() ? 'tv' : 'pc';
}
