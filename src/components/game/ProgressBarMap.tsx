// src/components/game/ProgressBarMap.tsx
//
// Mini map: compact node strip of all game spaces, grouped by phase.
// Phase labels sit above the node row. Nodes are connected by lines.
// The active space expands inline to show the PlayerPanelWrapper.
// Valid move spaces expand to show GameSpace tiles.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameContext } from '../../context/GameContext';
import { SpaceDot } from './SpaceDot';
import { Space, Player } from '../../types/DataTypes';
import { IServiceContainer } from '../../types/ServiceContracts';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import './ProgressBarMap.css';

// Phase display config — colors match CHARACTER_MAP / NPC colors
const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  'SETUP':        { bg: '#e3f2fd', text: '#1565c0' },
  'OWNER':        { bg: '#e3f2fd', text: '#1976d2' },
  'FUNDING':      { bg: '#fff8e1', text: '#f57f17' },
  'DESIGN':       { bg: '#f3e5f5', text: '#7b1fa2' },
  'REGULATORY':   { bg: '#ffebee', text: '#c62828' },
  'CONSTRUCTION': { bg: '#e8f5e9', text: '#2e7d32' },
  'END':          { bg: '#e0f2f1', text: '#00695c' },
};

// Phases that are side quests (indented with branch indicator)
const SIDE_QUEST_PHASES = new Set(['FUNDING']);

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

  // Group spaces by phase (using config.phase which is uppercase: SETUP, OWNER, etc.)
  const phaseGroups: PhaseGroup[] = useMemo(() => {
    const groups: PhaseGroup[] = [];
    let lastPhase = '';
    let lastIsSideQuest = false;

    for (const space of spaces) {
      const config = dataService.getGameConfigBySpace(space.name);
      const phase = config?.phase || 'UNKNOWN';
      const isSideQuest = SIDE_QUEST_PHASES.has(phase);

      if (phase !== lastPhase || isSideQuest !== lastIsSideQuest) {
        groups.push({ phase, spaces: [space], isSideQuest });
        lastPhase = phase;
        lastIsSideQuest = isSideQuest;
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

  // Check if a space has been visited by current player (for connector coloring)
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isVisited = (spaceName: string) =>
    currentPlayer?.visitedSpaces?.includes(spaceName) ?? false;

  return (
    <div className="progress-bar-map">
      {phaseGroups.map((group) => {
        const phaseColor = PHASE_COLORS[group.phase] || { bg: '#f5f5f5', text: '#616161' };
        const groupClass = `pbm-phase-group${group.isSideQuest ? ' pbm-phase-group--side-quest' : ''}`;

        return (
          <div key={`${group.phase}-${group.isSideQuest}`} className={groupClass}>
            {/* Phase label above the nodes */}
            <span
              className="pbm-phase-label"
              style={{ background: phaseColor.bg, color: phaseColor.text }}
            >
              {group.phase}
            </span>

            {/* Node row with connecting lines */}
            <div className="pbm-node-row">
              {group.spaces.map((space, idx) => {
                const playersOnSpace = getPlayersOnSpace(space.name);
                const isCurrentPlayerSpace = currentPlayer?.currentSpace === space.name;
                const isValidMove = validMoves.includes(space.name);
                const isHoveredSpace = hoveredSpace === space.name && !isCurrentPlayerSpace && !isValidMove;

                return (
                  <React.Fragment key={space.name}>
                    {/* Connecting line before each node (except the first) */}
                    {idx > 0 && (
                      <div
                        className={`pbm-connector${isVisited(space.name) ? ' pbm-connector--visited' : ''}`}
                      />
                    )}
                    <SpaceDot
                      space={space}
                      playersOnSpace={playersOnSpace}
                      allPlayers={players}
                      currentPlayerId={currentPlayerId}
                      isCurrentPlayerSpace={isCurrentPlayerSpace}
                      isValidMove={isValidMove}
                      isHovered={isHoveredSpace}
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
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
