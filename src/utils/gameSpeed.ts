// gameSpeed - the "Fast" switch (Manager brief Job 5, Tom 2026-10-07: "faster animations and pop-ups for
// everyone"). A per-device setting, remembered on this device only: it shortens the waits and movements
// the player SEES (pauses around a move, the camera gliding to a space, how long a pop-up note stays up,
// small CSS fades). It never changes game rules or what other devices see.

import { useSyncExternalStore } from 'react';

export type GameSpeed = 'normal' | 'fast';

const KEY = 'uc-game-speed';
/** Fast waits and glides take this share of the normal time. */
export const FAST_FACTOR = 0.5;

const listeners = new Set<() => void>();

export function getGameSpeed(): GameSpeed {
  try {
    return localStorage.getItem(KEY) === 'fast' ? 'fast' : 'normal';
  } catch {
    return 'normal';
  }
}

function applyToPage(speed: GameSpeed): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.gameSpeed = speed;
  if (!document.getElementById('uc-game-speed-style')) {
    const style = document.createElement('style');
    style.id = 'uc-game-speed-style';
    // Small fades and slides only (hover, panel open). Looping attention pulses keep their own pace.
    style.textContent = 'html[data-game-speed="fast"] * { transition-duration: 90ms !important; }';
    document.head.appendChild(style);
  }
}

export function setGameSpeed(speed: GameSpeed): void {
  try {
    localStorage.setItem(KEY, speed);
  } catch { /* private window: the choice lasts until reload */ }
  applyToPage(speed);
  listeners.forEach(l => l());
}

/** Call once at start-up so a remembered "fast" is in force before the first move. */
export function initGameSpeed(): void {
  applyToPage(getGameSpeed());
}

/** A wait or glide in ms, shortened when this device is on Fast. Safe to call anywhere (no browser = unchanged). */
export function scaleMs(ms: number): number {
  return getGameSpeed() === 'fast' ? Math.max(0, Math.round(ms * FAST_FACTOR)) : ms;
}

export function useGameSpeed(): [GameSpeed, (s: GameSpeed) => void] {
  const speed = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    getGameSpeed,
    () => 'normal' as GameSpeed,
  );
  return [speed, setGameSpeed];
}
