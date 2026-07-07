// src/hooks/useNpcPortrait.ts
// React hook that resolves NPC portrait image paths from game state.

import { useState, useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import {
  getNpcImagePath,
  getNpcCharacterInfo,
  NpcAppearances,
} from '../constants/characters';

/**
 * Hook that reads npcAppearances from game state and provides
 * a helper to get the portrait path for a given space name.
 */
export function useNpcPortrait() {
  const { stateService } = useGameContext();
  const [appearances, setAppearances] = useState<NpcAppearances | undefined>(
    stateService.getGameState().npcAppearances
  );

  useEffect(() => {
    const unsub = stateService.subscribe((gs) => {
      setAppearances(gs.npcAppearances);
    });
    return unsub;
  }, [stateService]);

  /**
   * Returns the portrait image path for the primary NPC of a space,
   * or null if appearances aren't set or the space has no NPC mapping.
   */
  function getPortraitForSpace(spaceName: string): string | null {
    if (!appearances) return null;
    // PM-voiced spaces (fb:7065e8df) resolve to undefined — no portrait when
    // the narration is the PM's own first-person thought, not an NPC's.
    const info = getNpcCharacterInfo(spaceName);
    if (!info || info.imageRoles.length === 0) return null;
    const role = info.imageRoles[0]; // primary role
    const appearance = appearances[role];
    if (!appearance) return null;
    return getNpcImagePath(role, appearance);
  }

  return { getPortraitForSpace, appearances };
}
