// src/utils/destinationPreview.ts
// Which destination the local player is pointing at in the player panel, so the
// board can light up that tile while they decide.
//
// fb:feedback-1788494150808-6416f76e (extra) — "as you hover over any of the 3
// buttons on the game board those choices should light up", and
// fb:feedback-1788865772330-71935ebb — "when selecting next move on the player
// panel I did not see anything change on the game board".
//
// The PICKED destination needs no channel: it is `player.moveIntent`, already in
// synced game state, so every screen (including the TV) sees it. The HOVERED one
// is a momentary, this-device-only pointer state; it does not belong in game
// state (it would sync a cursor across devices), so it lives in this tiny store.
// The panel and the board are siblings with no shared parent state, and
// useSyncExternalStore reads it without prop-drilling through GameLayout.

import { useSyncExternalStore } from 'react';

let previewSpaceId: string | null = null;
const listeners = new Set<() => void>();

export function setDestinationPreview(spaceId: string | null): void {
  if (previewSpaceId === spaceId) return;
  previewSpaceId = spaceId;
  listeners.forEach((l) => l());
}

export function getDestinationPreview(): string | null {
  return previewSpaceId;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDestinationPreview(): string | null {
  return useSyncExternalStore(subscribe, getDestinationPreview, getDestinationPreview);
}
