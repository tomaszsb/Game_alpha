import { Player } from '../types/StateTypes';
import { IDataService } from '../types/ServiceContracts';

export interface LifecyclePosition {
  /** Furthest phase the player has reached (or 'UNKNOWN' if none resolved). */
  phase: string;
  /** Index of that phase in dataService.getPhaseOrder(); -1 when unknown. */
  phaseIndex: number;
  /** 0–100 progress along the lifecycle. */
  progress: number;
}

/**
 * The furthest phase a player has reached along the permitting lifecycle.
 *
 * Phase never regresses — we take the MAX phase index across every visited space
 * plus the current one. Extracted verbatim from
 * ProjectProgress.calculatePlayerProgress so the scoreboard ("who" screen) and
 * the observer ProjectProgress panel read the same number and can't drift (the
 * codebase has repeatedly been bitten by parallel re-derivations of a rule).
 */
export function playerLifecyclePosition(player: Player, dataService: IDataService): LifecyclePosition {
  const phases = dataService.getPhaseOrder();
  const allSpaces = [...(player.visitedSpaces || []), player.currentSpace];
  let maxPhaseIndex = -1;
  let maxPhase = 'UNKNOWN';

  for (const spaceName of allSpaces) {
    const spaceConfig = dataService.getGameConfigBySpace(spaceName);
    // Guard `phase` — ProjectProgress assumes it exists; an authored/edge space
    // could omit it, and `.toUpperCase()` on undefined would throw.
    if (spaceConfig && spaceConfig.phase) {
      const phaseIndex = phases.findIndex((phase) => spaceConfig.phase.toUpperCase().includes(phase));
      if (phaseIndex > maxPhaseIndex) {
        maxPhaseIndex = phaseIndex;
        maxPhase = phases[phaseIndex];
      }
    }
  }

  if (maxPhaseIndex === -1) {
    return { phase: 'UNKNOWN', progress: 0, phaseIndex: -1 };
  }
  return {
    phase: maxPhase,
    progress: ((maxPhaseIndex + 1) / phases.length) * 100,
    phaseIndex: maxPhaseIndex,
  };
}
