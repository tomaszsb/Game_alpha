// boardStyle - the "Board: Classic / Town" switch (Tom, 2026-10-11, town board first build). A
// per-device setting, remembered on this device only, like the Fast switch (gameSpeed.ts). It starts
// on Classic: nobody sees the town until they choose it. It never changes rules or other screens.

import { useSyncExternalStore } from 'react';

export type BoardStyle = 'classic' | 'town';

const KEY = 'uc-board-style';

const listeners = new Set<() => void>();

// Whether this board has a town at all (TOWN.csv has buildings). Set by DataService when the data
// loads; the menu offers the Town / Classic switch only when there is a town to switch to.
let townAvailable = false;

export function setTownAvailable(available: boolean): void {
  if (townAvailable === available) return;
  townAvailable = available;
  listeners.forEach(l => l());
}

export function isTownAvailable(): boolean {
  return townAvailable;
}

export function getBoardStyle(): BoardStyle {
  try {
    return localStorage.getItem(KEY) === 'town' ? 'town' : 'classic';
  } catch {
    return 'classic';
  }
}

export function setBoardStyle(style: BoardStyle): void {
  try {
    localStorage.setItem(KEY, style);
  } catch { /* private window: the choice lasts until reload */ }
  listeners.forEach(l => l());
}

export function useBoardStyle(): [BoardStyle, (s: BoardStyle) => void] {
  const style = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    getBoardStyle,
    () => 'classic' as BoardStyle,
  );
  return [style, setBoardStyle];
}

/** The menu's Town / Classic item, or undefined when this board has no town. */
export function useBoardStyleMenu(): { town: boolean; toggle: () => void } | undefined {
  const [style, setStyle] = useBoardStyle();
  const available = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    isTownAvailable,
    () => false,
  );
  if (!available) return undefined;
  return { town: style === 'town', toggle: () => setStyle(style === 'town' ? 'classic' : 'town') };
}

// Whether a town walk is playing on this screen right now (TownBoard sets it). Pop-ups that arrive
// with a move wait for it, so a news item or a result does not open on top of the walk (seen on the
// PC, 2026-10-11). Only a screen showing the town ever walks, so the classic board never waits.
let townWalking = false;
const walkListeners = new Set<() => void>();

export function setTownWalking(active: boolean): void {
  if (townWalking === active) return;
  townWalking = active;
  walkListeners.forEach(l => l());
}

export function isTownWalking(): boolean {
  return townWalking;
}

export function useTownWalking(): boolean {
  return useSyncExternalStore(
    cb => { walkListeners.add(cb); return () => { walkListeners.delete(cb); }; },
    isTownWalking,
    () => false,
  );
}
