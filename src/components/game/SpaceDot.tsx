// src/components/game/SpaceDot.tsx
//
// Individual node in the ProgressBarMap. Four visual states:
// - default: Rectangular node with full space name and tiny player avatars
// - active: Current player's space → renders PlayerPanelWrapper inline
// - validMove: Valid next destination → renders GameSpace tile inline
// - hovered: Mouse hover → renders GameSpace tile temporarily

import React from 'react';
import { motion } from 'framer-motion';
import { Space, Player } from '../../types/DataTypes';
import { GameSpace } from './GameSpace';
import { PlayerPanelWrapper } from '../player/PlayerPanelWrapper';
import { IServiceContainer } from '../../types/ServiceContracts';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';

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

  // Determine visited state for default nodes
  const currentPlayer = allPlayers.find(p => p.id === currentPlayerId);
  const isVisited = currentPlayer?.visitedSpaces?.includes(space.name) ?? false;

  // Get NPC color for left accent
  const npcPrefix = extractPrefix(space.name);
  const npcInfo = CHARACTER_MAP[npcPrefix] || null;

  const nodeClassName = [
    'pbm-node',
    dotState === 'default' && (isVisited ? 'pbm-node--visited' : 'pbm-node--unvisited'),
    dotState === 'default' && isValidMove && 'pbm-node--valid-move',
    isCurrentPlayerSpace && dotState === 'active' && 'pbm-node--current',
  ].filter(Boolean).join(' ');

  // Inline style for NPC color accent
  const nodeStyle: React.CSSProperties = {};
  if (npcInfo && dotState === 'default') {
    nodeStyle.borderLeftWidth = '3px';
    nodeStyle.borderLeftColor = npcInfo.color;
  }

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
        // Default: rectangular node with full space name
        <div className={nodeClassName} style={nodeStyle} title={space.name}>
          <span>{space.name}</span>
          {/* Player avatars */}
          {playersOnSpace.length > 0 && (
            <div className="pbm-node-avatars">
              {playersOnSpace.slice(0, 3).map(player => (
                <div
                  key={player.id}
                  className="pbm-node-avatar"
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
