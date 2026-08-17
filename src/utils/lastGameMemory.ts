// src/utils/lastGameMemory.ts
//
// Remembers the most recent game this browser visited so a bare-URL visit
// (no ?g= at all — a stripped link, or a bookmark to the root domain) can
// offer "resume your last game?" instead of silently starting a brand-new
// one. Deliberately NOT auto-resume: teachers/testers routinely open the
// bare URL specifically to start a fresh game, so the choice has to stay a
// prompt, not a redirect. See TODO.md "Resume your last game" entry.

const LAST_GAME_KEY = 'unravelcodes:last-game';

interface StoredLastGame {
  gameId: string;
  token?: string;
}

export function getStoredLastGame(): StoredLastGame | null {
  try {
    const raw = localStorage.getItem(LAST_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLastGame>;
    if (typeof parsed.gameId !== 'string' || !parsed.gameId) return null;
    return { gameId: parsed.gameId, token: typeof parsed.token === 'string' ? parsed.token : undefined };
  } catch {
    return null;
  }
}

export function setStoredLastGame(gameId: string, token?: string): void {
  try {
    localStorage.setItem(LAST_GAME_KEY, JSON.stringify({ gameId, token }));
  } catch {
    /* private mode / disabled storage — resume prompt just won't offer next time */
  }
}

export function clearStoredLastGame(): void {
  try {
    localStorage.removeItem(LAST_GAME_KEY);
  } catch {
    /* nothing to clean up if storage isn't available */
  }
}
