// boardStyle - the "Board: Classic / Town" switch (Tom, 2026-10-11, town board first build). The HOST
// picks the starting board on the setup screen (Town = "street view", the default; 2026-10-12) and it
// rides on the game's state to every screen. A screen's own Menu switch is remembered on that device
// FOR THAT GAME and wins over the host's pick; a new game starts from the host's pick again. An older
// game with no pick starts on Classic. It never changes rules or other screens.
import { getCurrentGameId } from './networkDetection';

import { useSyncExternalStore } from 'react';

/** 'round' = the round town (townRound.ts), Tom 10-30: "there is already a switch to go from classic to town why not just add roundtown?" */
export type BoardStyle = 'classic' | 'town' | 'round';

const KEY = 'uc-board-style';
const storageKey = (): string => `${KEY}:${getCurrentGameId() ?? ''}`;

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

// The board the host picked for this game (from the game state); undefined = none picked.
let gameBoardStyle: BoardStyle | undefined;

export function setGameBoardStyle(style: BoardStyle | undefined): void {
  if (gameBoardStyle === style) return;
  gameBoardStyle = style;
  listeners.forEach(l => l());
}

export function getBoardStyle(): BoardStyle {
  try {
    const own = localStorage.getItem(storageKey());
    if (own === 'town' || own === 'classic' || own === 'round') return own;
  } catch { /* fall through to the host's pick */ }
  return gameBoardStyle ?? 'classic';
}

export function setBoardStyle(style: BoardStyle): void {
  try {
    localStorage.setItem(storageKey(), style);
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

/** Whether this board has a town at all, as a hook (the setup screen offers the choice only then). */
export function useTownAvailable(): boolean {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    isTownAvailable,
    () => false,
  );
}

/** The next board in the menu's round: Town, Round town, Classic, Town again. */
export const NEXT_BOARD: Record<BoardStyle, BoardStyle> = { town: 'round', round: 'classic', classic: 'town' };

/** The menu's Town / Round town / Classic item, or undefined when this board has no town. */
export function useBoardStyleMenu(): { town: boolean; round: boolean; toggle: () => void } | undefined {
  const [style, setStyle] = useBoardStyle();
  const available = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    isTownAvailable,
    () => false,
  );
  if (!available) return undefined;
  return { town: style === 'town', round: style === 'round', toggle: () => setStyle(NEXT_BOARD[style]) };
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
