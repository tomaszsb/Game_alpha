// src/components/game/ProgressBarMap.tsx
//
// Mini map: compact dot strip of all game spaces, grouped by phase.
// The active space expands inline to show the PlayerPanelWrapper.
// Valid move spaces expand to show GameSpace tiles.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import { SpaceDot } from './SpaceDot';
import { Space, Player } from '../../types/DataTypes';
import { IServiceContainer } from '../../types/ServiceContracts';
import './ProgressBarMap.css';

// Phase display config
const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  'Setup': { bg: '#e3f2fd', text: '#1565c0' },
  'Owner': { bg: '#e8f5e9', text: '#2e7d32' },
  'Design': { bg: '#f3e5f5', text: '#7b1fa2' },
  'Regulatory': { bg: '#fff3e0', text: '#e65100' },
  'Construction': { bg: '#fce4ec', text: '#c62828' },
  'End': { bg: '#e0f2f1', text: '#00695c' },
  'Funding': { bg: '#fff8e1', text: '#f57f17' },
};

// Side quest phases that get indented
const SIDE_QUEST_PHASES = ['Funding'];

interface ProgressBarMapProps {
  gameServices: IServiceContainer;
  currentPlayerId: string | null;
  players: Player[];
  onTryAgain: () => Promise<void>;
  playerNotifications: Record<string, string>;
  onRollDice: () => Promise<void>;
  onAutomaticFunding: () => Promise<void>;
  onManualEffectResult: (result: any) => void;
  completedActions: { diceRoll: string | undefined; manualActions: Record<string, string> };
  onToggleSpaceExplorer: () => void;
  onToggleMovementPath: () => void;
  isSpaceExplorerVisible: boolean;
  isMovementPathVisible: boolean;
}

interface PhaseGroup {
  phase: string;
  spaces: Space[];
  isSideQuest: boolean;
}

export function ProgressBarMap({
  gameServices,
  currentPlayerId,
  players,
  onTryAgain,
  playerNotifications,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions,
  onToggleSpaceExplorer,
  onToggleMovementPath,
  isSpaceExplorerVisible,
  isMovementPathVisible,
}: ProgressBarMapProps): JSX.Element {
  const { dataService, stateService, movementService } = useGameContext();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load spaces on mount (same filter as GameBoard)
  useEffect(() => {
    const allSpaces = dataService.getAllSpaces();
    const gameSpaces = allSpaces.filter(space => {
      const config = dataService.getGameConfigBySpace(space.name);
      return config?.path_type !== 'Tutorial' && config?.path_type !== 'none';
    });
    setSpaces(gameSpaces);
  }, [dataService]);

  // Subscribe to state changes for valid moves
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      if (gameState.gamePhase === 'PLAY' && gameState.currentPlayerId && !gameState.hasPlayerMovedThisTurn && !gameState.isMoving) {
        try {
          const moves = movementService.getValidMoves(gameState.currentPlayerId);
          setValidMoves(moves);
        } catch {
          setValidMoves([]);
        }
      } else {
        setValidMoves([]);
      }
    });

    // Initialize
    const state = stateService.getGameState();
    if (state.gamePhase === 'PLAY' && state.currentPlayerId && !state.hasPlayerMovedThisTurn) {
      try {
        setValidMoves(movementService.getValidMoves(state.currentPlayerId));
      } catch {
        setValidMoves([]);
      }
    }

    return unsubscribe;
  }, [stateService, movementService]);

  // Hover handlers with 200ms debounce
  const handleMouseEnter = useCallback((spaceName: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredSpace(spaceName);
    }, 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredSpace(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Group spaces by phase
  const phaseGroups: PhaseGroup[] = React.useMemo(() => {
    const groups: PhaseGroup[] = [];
    let currentPhase = '';

    for (const space of spaces) {
      const config = dataService.getGameConfigBySpace(space.name);
      const phase = config?.phase || 'Unknown';
      const pathType = config?.path_type || '';
      const isSideQuest = SIDE_QUEST_PHASES.includes(phase) || pathType === 'side_quest';

      if (phase !== currentPhase || isSideQuest !== groups[groups.length - 1]?.isSideQuest) {
        // Check if we already have a group for this phase+sidequest combo
        const existingIdx = groups.findIndex(g => g.phase === phase && g.isSideQuest === isSideQuest);
        if (existingIdx >= 0) {
          groups[existingIdx].spaces.push(space);
        } else {
          groups.push({ phase, spaces: [space], isSideQuest });
          currentPhase = phase;
        }
      } else {
        groups[groups.length - 1].spaces.push(space);
      }
    }
    return groups;
  }, [spaces, dataService]);

  // Helper: get players on a space
  const getPlayersOnSpace = (spaceName: string): Player[] => {
    return players.filter(p => p.currentSpace === spaceName);
  };

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  return (
    <div className="progress-bar-map">
      {phaseGroups.map((group) => {
        const phaseColor = PHASE_COLORS[group.phase] || { bg: '#f5f5f5', text: '#616161' };
        return (
          <div
            key={`${group.phase}-${group.isSideQuest}`}
            className={`pbm-phase-group ${group.isSideQuest ? 'pbm-side-quest' : ''}`}
          >
            <span
              className="pbm-phase-label"
              style={{ background: phaseColor.bg, color: phaseColor.text }}
            >
              {group.phase}
            </span>
            {group.spaces.map((space) => {
              const playersOnSpace = getPlayersOnSpace(space.name);
              const isCurrentPlayerSpace = currentPlayer?.currentSpace === space.name;
              const isValidMove = validMoves.includes(space.name);
              const isHovered = hoveredSpace === space.name && !isCurrentPlayerSpace && !isValidMove;

              return (
                <SpaceDot
                  key={space.name}
                  space={space}
                  playersOnSpace={playersOnSpace}
                  allPlayers={players}
                  currentPlayerId={currentPlayerId}
                  isCurrentPlayerSpace={isCurrentPlayerSpace}
                  isValidMove={isValidMove}
                  isHovered={isHovered}
                  onMouseEnter={() => handleMouseEnter(space.name)}
                  onMouseLeave={handleMouseLeave}
                  gameServices={gameServices}
                  onTryAgain={onTryAgain}
                  playerNotification={currentPlayerId ? playerNotifications[currentPlayerId] : undefined}
                  onRollDice={onRollDice}
                  onAutomaticFunding={onAutomaticFunding}
                  onManualEffectResult={onManualEffectResult}
                  completedActions={completedActions}
                  onToggleSpaceExplorer={onToggleSpaceExplorer}
                  onToggleMovementPath={onToggleMovementPath}
                  isSpaceExplorerVisible={isSpaceExplorerVisible}
                  isMovementPathVisible={isMovementPathVisible}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
