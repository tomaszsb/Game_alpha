// soundSetting - the "Sound: On / Off" switch for the town's result chimes (Tom, 2026-10-12: "bubbles
// also need sound effect so it raises awareness that something happened"). A per-device setting,
// remembered on this device only, like the Fast switch (gameSpeed.ts) and the Board switch
// (boardStyle.ts). It starts On; the chimes' volume comes from the data (TOWN.csv `bubble_sound_volume`,
// 0 = silent). The menu offers it only when the board has a town, since only the town makes these sounds.

import { useSyncExternalStore } from 'react';
import { useTownAvailable } from './boardStyle';

const KEY = 'uc-sound';
const listeners = new Set<() => void>();

export function getSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch { /* private window: the choice lasts until reload */ }
  listeners.forEach(l => l());
}

/** The menu's Sound item, or undefined when this board has no town. */
export function useSoundMenu(): { on: boolean; toggle: () => void } | undefined {
  const on = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    getSoundOn,
    () => true,
  );
  const townAvailable = useTownAvailable();
  if (!townAvailable) return undefined;
  return { on, toggle: () => setSoundOn(!on) };
}
