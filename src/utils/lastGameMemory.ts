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
  /** shortId of the player this browser was in that game ("Resume as <name>"). Verified against the
   *  game's join-info roster before it is ever used - a stale one is simply ignored. */
  playerShortId?: string;
}

function readShortId(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

export function getStoredLastGame(): StoredLastGame | null {
  try {
    const raw = localStorage.getItem(LAST_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLastGame>;
    if (typeof parsed.gameId !== 'string' || !parsed.gameId) return null;
    return {
      gameId: parsed.gameId,
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
      playerShortId: readShortId(parsed.playerShortId),
    };
  } catch {
    return null;
  }
}

/** `playerShortId` = the player this browser is in this game (the ?p= link). Omitted on a PC/TV/spectator
 *  visit: the player already remembered for the SAME game is kept, a different game drops it. */
export function setStoredLastGame(gameId: string, token?: string, playerShortId?: string): void {
  try {
    const kept = playerShortId ?? (getStoredLastGame()?.gameId === gameId ? getStoredLastGame()?.playerShortId : undefined);
    localStorage.setItem(LAST_GAME_KEY, JSON.stringify({ gameId, token, playerShortId: kept }));
  } catch {
    /* private mode / disabled storage — resume prompt just won't offer next time */
  }
}

/** Is a remembered game still one to go back to? A FINISHED game (phase END) is not - a bare-URL
 *  visit used to offer "Join - which one are you?" for the game that had just ended
 *  (fb:b38110f3, fb:ef974f1c). */
export function isResumableGame(info: { gamePhase?: string }): boolean {
  return info.gamePhase !== 'END';
}

export function clearStoredLastGame(): void {
  try {
    localStorage.removeItem(LAST_GAME_KEY);
  } catch {
    /* nothing to clean up if storage isn't available */
  }
}

// One-shot handoff for the game the bare-URL bootstrap found in
// getStoredLastGame() and verified still exists, right before it overwrites
// that same record with a freshly auto-created blank game (App.tsx's mount
// effect remembers whatever gameId is in the URL, blank or not). Without
// this, the real prior game would be clobbered before PlayerSetup ever gets
// a chance to offer it. sessionStorage (not localStorage) because it only
// needs to survive the one hard-reload from auto-create's redirect, not
// linger across tabs or future visits — JoinByCodePanel consumes it once via
// consumeResumeHint() and clears it, so a plain page refresh afterward
// doesn't keep re-prefilling the same code.
const RESUME_HINT_KEY = 'unravelcodes:resume-hint';

export function stashResumeHint(gameId: string, token?: string, playerShortId?: string): void {
  try {
    sessionStorage.setItem(RESUME_HINT_KEY, JSON.stringify({ gameId, token, playerShortId }));
  } catch {
    /* private mode / disabled storage — Join-by-Code just won't be prefilled */
  }
}

export function consumeResumeHint(): StoredLastGame | null {
  try {
    const raw = sessionStorage.getItem(RESUME_HINT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESUME_HINT_KEY);
    const parsed = JSON.parse(raw) as Partial<StoredLastGame>;
    if (typeof parsed.gameId !== 'string' || !parsed.gameId) return null;
    return {
      gameId: parsed.gameId,
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
      playerShortId: readShortId(parsed.playerShortId),
    };
  } catch {
    return null;
  }
}
