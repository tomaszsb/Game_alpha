// src/components/game/PlayerStatusPanel.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { PlayerStatusItem } from './PlayerStatusItem';
import { Player } from '../../types/StateTypes';

interface PlayerStatusPanelProps {
  onOpenNegotiationModal: () => void;
  onOpenRulesModal: () => void;
  onOpenCardDetailsModal: (cardId: string) => void;
  onToggleSpaceExplorer: () => void;
  onToggleMovementPath: () => void;
  isSpaceExplorerVisible: boolean;
  isMovementPathVisible: boolean;
  // Player data (passed from GameLayout)
  players: Player[];
  currentPlayerId: string | null;
  // Per-player notifications
  playerNotifications: { [playerId: string]: string };
  // TurnControlsWithActions props (passed from GameLayout)
  currentPlayer: Player;
  gamePhase: import('../../types/StateTypes').GamePhase;
  isProcessingTurn: boolean;
  isProcessingArrival: boolean;
  hasPlayerMovedThisTurn: boolean;
  hasPlayerRolledDice: boolean;
  hasCompletedManualActions: boolean;
  awaitingChoice: boolean;
  actionCounts: { required: number; completed: number };
  completedActions: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
  feedbackMessage: string;
  buttonFeedback: { [actionType: string]: string };
  onRollDice: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onManualEffect: (effectType: string) => Promise<void>;
  onNegotiate: () => Promise<void>;
  onAutomaticFunding?: () => Promise<void>;
  playerId: string;
  playerName: string;
}

/**
 * PlayerStatusPanel displays the list of all player statuses
 * Now acts as a "dumb" component, receiving all data via props from GameLayout
 */
export function PlayerStatusPanel({
  onOpenNegotiationModal,
  onOpenRulesModal,
  onOpenCardDetailsModal,
  onToggleSpaceExplorer,
  onToggleMovementPath,
  isSpaceExplorerVisible,
  isMovementPathVisible,
  // Player data from GameLayout
  players,
  currentPlayerId,
  playerNotifications,
  // TurnControlsWithActions props from GameLayout
  currentPlayer,
  gamePhase,
  isProcessingTurn,
  isProcessingArrival,
  hasPlayerMovedThisTurn,
  hasPlayerRolledDice,
  hasCompletedManualActions,
  awaitingChoice,
  actionCounts,
  completedActions,
  feedbackMessage,
  buttonFeedback,
  onRollDice,
  onEndTurn,
  onManualEffect,
  onNegotiate,
  onAutomaticFunding,
  playerId,
  playerName
}: PlayerStatusPanelProps): JSX.Element {
  // No service dependencies - all data comes from props

  const containerStyle = {
    background: colors.secondary.bg,
    borderRadius: '8px',
    padding: '8px',
    height: '100%',
    width: '100%',
    maxWidth: '100%',
    overflow: 'auto' as const, // Enable scrolling for stable container
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: `2px solid ${colors.secondary.light}`
  };

  const titleStyle = {
    fontSize: '1.4rem',
    fontWeight: 'bold' as const,
    color: colors.success.text,
    margin: 0
  };

  const playerCountStyle = {
    background: colors.primary.light,
    color: colors.primary.text,
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold' as const
  };

  const emptyStateStyle = {
    textAlign: 'center' as const,
    color: colors.secondary.main,
    fontSize: '1rem',
    padding: '40px 20px'
  };

  return (
    <div style={containerStyle}>

      {/* Player list */}
      {players.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}>
            🎮
          </div>
          <div>
            No players in the game yet.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {players.map((player) => (
            <PlayerStatusItem
              key={`${player.id}-${player.timeSpent || 0}`}
              player={player}
              isCurrentPlayer={player.id === currentPlayerId}
              onOpenNegotiationModal={onOpenNegotiationModal}
              onOpenRulesModal={onOpenRulesModal}
              onOpenCardDetailsModal={onOpenCardDetailsModal}
              onToggleSpaceExplorer={onToggleSpaceExplorer}
              onToggleMovementPath={onToggleMovementPath}
              isSpaceExplorerVisible={isSpaceExplorerVisible}
              isMovementPathVisible={isMovementPathVisible}
              playerNotification={playerNotifications[player.id] || ''}
              // TurnControlsWithActions props (pass-through from GameLayout)
              currentPlayer={currentPlayer}
              gamePhase={gamePhase}
              isProcessingTurn={isProcessingTurn}
              isProcessingArrival={isProcessingArrival}
              hasPlayerMovedThisTurn={hasPlayerMovedThisTurn}
              hasPlayerRolledDice={hasPlayerRolledDice}
              hasCompletedManualActions={hasCompletedManualActions}
              awaitingChoice={awaitingChoice}
              actionCounts={actionCounts}
              completedActions={completedActions}
              feedbackMessage={feedbackMessage}
              buttonFeedback={buttonFeedback}
              onRollDice={onRollDice}
              onEndTurn={onEndTurn}
              onManualEffect={onManualEffect}
              onNegotiate={onNegotiate}
              onAutomaticFunding={onAutomaticFunding}
              playerId={playerId}
              playerName={playerName}
            />
          ))}
        </div>
      )}

    </div>
  );
}