import { useEffect } from 'react';
import { createWakeLockKeeper } from '../utils/wakeLock';

/** Keeps the screen awake while `active` is true. See utils/wakeLock.ts for why
 *  the TV needs this and what it deliberately does not try to cover. */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const keeper = createWakeLockKeeper();
    keeper.start();
    return () => keeper.stop();
  }, [active]);
}
