// src/hooks/useSyncedGameState.ts
// Subscribes a component to StateService's full game state via
// useSyncExternalStore, replacing the useState+useEffect(subscribe) pattern
// that `react-hooks/set-state-in-effect` flags across ~7 components (each
// synchronously seeded local state before the subscription's callback took
// over — see eslint.config.js's note on this rule and CHANGELOG for the
// migration). useSyncExternalStore is React's own recommended tool for
// exactly this "read from a store I don't own" case — it also avoids
// "tearing" (different components seeing different snapshots mid-render)
// that a manual subscribe+setState can produce under concurrent rendering.
//
// StateService.getGameState() deep-copies on every call (players + hand),
// so it does NOT return a referentially-stable snapshot between reads —
// calling it twice with no state change yields two different object
// references. useSyncExternalStore requires getSnapshot() to return the
// *same* reference until something actually changes, or React logs
// "The result of getSnapshot should be cached" and can loop. Rather than
// change StateService's public getGameState() contract (other callers may
// rely on the defensive copy), this hook caches the snapshot itself and
// only invalidates it when the store's own subscribe callback fires —
// i.e. once per real change, matching how the existing subscribe pattern
// already behaved.

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { IStateService } from '../types/ServiceContracts';
import { GameState } from '../types/StateTypes';

export function useSyncedGameState(stateService: IStateService): GameState {
  const cachedRef = useRef<GameState | null>(null);

  const subscribe = useCallback((onStoreChange: () => void) => {
    return stateService.subscribe(() => {
      cachedRef.current = null;
      onStoreChange();
    });
  }, [stateService]);

  const getSnapshot = useCallback((): GameState => {
    if (cachedRef.current === null) {
      cachedRef.current = stateService.getGameState();
    }
    return cachedRef.current;
  }, [stateService]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
