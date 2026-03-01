// src/components/game/SpaceDot.tsx
//
// Individual dot in the ProgressBarMap. Four visual states:
// - default: 32px circle with abbreviation and tiny player avatars
// - active: Current player's space → renders PlayerPanelWrapper inline
// - validMove: Valid next destination → renders GameSpace tile inline
// - hovered: Mouse hover → renders GameSpace tile temporarily

import React from 'react';
import { motion } from 'framer-motion';
import { Space, Player } from '../../types/DataTypes';
import { GameSpace } from './GameSpace';
import { PlayerPanelWrapper } from '../player/PlayerPanelWrapper';
import { IServiceContainer } from '../../types/ServiceContracts';

/** Abbreviation logic: split on '-', take first char of each part, max 4 chars */
function getAbbreviation(spaceName: string): string {
  // Special cases
  const specials: Record<string, string> = {
    'FINISH': 'FIN',
    'PM-DECISION-CHECK': 'PM',
    'CHEAT-BYPASS': 'CHT',
  };
  if (specials[spaceName]) return specials[spaceName];

  const parts = spaceName.split('-');
  return parts.map(p => p.charAt(0)).join('').slice(0, 4);
}

type DotState = 'default' | 'active' | 'validMove' | 'hovered';

interface SpaceDotProps {
  space: Space;
  playersOnSpace: Player[];
  allPlayers: Player[];
  currentPlayerId: string | null;
  isCurrentPlayerSpace: boolean;
  isValidMove: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  // PlayerPanelWrapper pass-through props (only used when active)
  gameServices?: IServiceContainer;
  onTryAgain?: () => Promise<void>;
  playerNotification?: string;
  onRollDice?: () => Promise<void>;
  onAutomaticFunding?: () => Promise<void>;
  onManualEffectResult?: (result: any) => void;
  completedActions?: { diceRoll: string | undefined; manualActions: Record<string, string> };
  onToggleSpaceExplorer?: () => void;
  onToggleMovementPath?: () => void;
  isSpaceExplorerVisible?: boolean;
  isMovementPathVisible?: boolean;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 25 };

export const SpaceDot: React.FC<SpaceDotProps> = ({
  space,
  playersOnSpace,
  allPlayers,
  currentPlayerId,
  isCurrentPlayerSpace,
  isValidMove,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  gameServices,
  onTryAgain,
  playerNotification,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions,
  onToggleSpaceExplorer,
  onToggleMovementPath,
  isSpaceExplorerVisible,
  isMovementPathVisible,
}) => {
  // Determine dot state
  let dotState: DotState = 'default';
  if (isCurrentPlayerSpace && currentPlayerId) {
    dotState = 'active';
  } else if (isValidMove) {
    dotState = 'validMove';
  } else if (isHovered) {
    dotState = 'hovered';
  }

  const isExpanded = dotState !== 'default';

  // Determine visited state for default dots
  const currentPlayer = allPlayers.find(p => p.id === currentPlayerId);
  const isVisited = currentPlayer?.visitedSpaces?.includes(space.name) ?? false;

  const dotClassName = [
    'pbm-dot',
    dotState === 'default' && (isVisited ? 'pbm-dot--visited' : 'pbm-dot--unvisited'),
    dotState === 'default' && isValidMove && 'pbm-dot--valid-move',
    isCurrentPlayerSpace && dotState === 'active' && 'pbm-dot--current',
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      layout
      transition={springTransition}
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {dotState === 'active' && gameServices && currentPlayerId ? (
        // Active space: show PlayerPanelWrapper
        <div className="pbm-expanded-panel">
          <PlayerPanelWrapper
            gameServices={gameServices}
            playerId={currentPlayerId}
            onTryAgain={onTryAgain}
            playerNotification={playerNotification}
            onRollDice={onRollDice}
            onAutomaticFunding={onAutomaticFunding}
            onManualEffectResult={onManualEffectResult}
            completedActions={completedActions}
            onToggleSpaceExplorer={onToggleSpaceExplorer}
            onToggleMovementPath={onToggleMovementPath}
            isSpaceExplorerVisible={isSpaceExplorerVisible}
            isMovementPathVisible={isMovementPathVisible}
          />
        </div>
      ) : (dotState === 'validMove' || dotState === 'hovered') ? (
        // Valid move or hovered: show GameSpace tile
        <div className="pbm-expanded-tile">
          <GameSpace
            space={space}
            playersOnSpace={playersOnSpace}
            isValidMoveDestination={isValidMove}
            isCurrentPlayerSpace={false}
            showMovementIndicators={isValidMove}
          />
        </div>
      ) : (
        // Default: collapsed dot
        <div className={dotClassName} title={space.name}>
          <span>{getAbbreviation(space.name)}</span>
          {/* Player avatars */}
          {playersOnSpace.length > 0 && (
            <div className="pbm-dot-avatars">
              {playersOnSpace.slice(0, 3).map(player => (
                <div
                  key={player.id}
                  className="pbm-dot-avatar"
                  style={{ background: player.color || '#007bff' }}
                  title={player.name}
                >
                  {player.avatar || player.name.charAt(0)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
