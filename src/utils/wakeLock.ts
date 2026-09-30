// ===================================================================
// Keep the TV screen awake while a game is on it (fb:e766b9c2, 2026-09-27).
//
// The report: "I made changes on my phone and moved several steps so I was
// working actively but the TV went to sleep. The TV should not go to sleep if
// the game is progressing." The TV screen only ever DISPLAYS — every action is
// taken on a phone — so from the TV's own point of view nobody touches it for
// the whole game, and it dims and sleeps like any idle screen. A code search
// found no wake-lock mechanism anywhere in the codebase.
//
// The Screen Wake Lock API is the standard answer: the page asks the browser
// to keep the display on. Two things about it shape this file:
//   - The browser RELEASES the lock by itself whenever the page is hidden
//     (tab switched, screen off, app backgrounded), so it must be asked for
//     again when the page becomes visible.
//   - Asking can fail (unsupported, battery saver, permissions policy). That is
//     never worth breaking the screen over: it is a best-effort nicety, so a
//     failure is swallowed and, at worst, the TV sleeps exactly as it did before.
//
// Not covered: a TV whose browser lacks the API, or a TV OS-level screensaver
// the browser cannot hold off. Neither can be tested from here; the on-screen
// behaviour is for the real TV to confirm.
//
// Kept as a plain function over injected `nav` / `doc` so it is unit-testable
// without a browser; useScreenWakeLock (hooks/) is the thin React wrapper.
// ===================================================================

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

interface NavigatorWithWakeLock {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

interface DocumentLike {
  visibilityState?: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface WakeLockKeeper {
  /** Ask for the lock and keep re-asking whenever the page becomes visible again. */
  start(): void;
  /** Let go of the lock and stop re-asking. Safe to call more than once. */
  stop(): void;
}

/** Does this browser offer the Screen Wake Lock API at all? */
export function isWakeLockSupported(nav: NavigatorWithWakeLock | undefined = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithWakeLock)): boolean {
  return !!nav?.wakeLock && typeof nav.wakeLock.request === 'function';
}

export function createWakeLockKeeper(
  nav: NavigatorWithWakeLock | undefined = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithWakeLock),
  doc: DocumentLike | undefined = typeof document === 'undefined' ? undefined : (document as unknown as DocumentLike),
): WakeLockKeeper {
  let sentinel: WakeLockSentinelLike | null = null;
  let running = false;
  let requesting = false;

  const acquire = async (): Promise<void> => {
    if (!running || requesting || sentinel || !isWakeLockSupported(nav)) return;
    if (doc?.visibilityState && doc.visibilityState !== 'visible') return; // the API refuses a hidden page
    requesting = true;
    try {
      const lock = await nav!.wakeLock!.request('screen');
      if (!running) {
        // stop() was called while the request was in flight — don't keep a lock nobody wants.
        await lock.release().catch(() => undefined);
        return;
      }
      sentinel = lock;
      // The browser drops the lock on its own (page hidden, battery saver). Forget it so the
      // next visibilitychange can take a fresh one.
      lock.addEventListener?.('release', () => { if (sentinel === lock) sentinel = null; });
    } catch {
      /* unsupported, refused or battery saver — best effort only */
    } finally {
      requesting = false;
    }
  };

  const onVisibility = () => { void acquire(); };

  return {
    start() {
      if (running) return;
      running = true;
      doc?.addEventListener('visibilitychange', onVisibility);
      void acquire();
    },
    stop() {
      if (!running) return;
      running = false;
      doc?.removeEventListener('visibilitychange', onVisibility);
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => undefined);
    },
  };
}
