// sceneSetting - the "Scene: Full / Calm / Off" switch for the town's weather (time-on-board design 2.10): Full moves rain,
// snow and clouds in the current player's band, Calm shows the same weather standing still, Off draws none. A per-device
// setting, remembered on this device only, like Sound. The menu offers it only when the board has a town.

import { useSyncExternalStore } from 'react';
import { useTownAvailable } from './boardStyle';
import { NEXT_SCENE, type SceneLevel } from './townWeather';

const KEY = 'uc-scene';
const listeners = new Set<() => void>();

export function getScene(): SceneLevel {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'calm' || v === 'off' ? v : 'full';
  } catch {
    return 'full';
  }
}

export function setScene(level: SceneLevel): void {
  try {
    localStorage.setItem(KEY, level);
  } catch { /* private window: the choice lasts until reload */ }
  listeners.forEach(l => l());
}

/** Re-renders whoever reads it when the scene setting changes. */
export function useScene(): SceneLevel {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, getScene, () => 'full' as SceneLevel);
}

/** The menu's Scene item, or undefined when this board has no town. One tap goes Full, Calm, Off, Full. */
export function useSceneMenu(): { level: SceneLevel; toggle: () => void } | undefined {
  const level = useScene();
  const townAvailable = useTownAvailable();
  if (!townAvailable) return undefined;
  return { level, toggle: () => setScene(NEXT_SCENE[level]) };
}
