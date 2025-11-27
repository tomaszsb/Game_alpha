import React, { useState, useEffect } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { FinancesSection } from './sections/FinancesSection';
import { TimeSection } from './sections/TimeSection';
import { CardsSection } from './sections/CardsSection';
import { CurrentCardSection } from './sections/CurrentCardSection';
import { ProjectScopeSection } from './sections/ProjectScopeSection';
import { NextStepButton } from './NextStepButton';
import { Choice } from '../../types/CommonTypes';
import './PlayerPanel.css';

/**
 * Props for the PlayerPanel component
 */
export interface PlayerPanelProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose panel to display */
  playerId: string;

  /** Callback to toggle Space Explorer panel */
  onToggleSpaceExplorer?: () => void;

  /** Callback to toggle Movement Path visualization */
  onToggleMovementPath?: () => void;

  /** Whether Space Explorer is currently visible */
  isSpaceExplorerVisible?: boolean;

  /** Whether Movement Path is currently visible */
  isMovementPathVisible?: boolean;

  /** Callback to handle Try Again action */
  onTryAgain?: () => Promise<void>;

  /** Player notification message */
  playerNotification?: string;

  /** Callback to handle dice roll action */
  onRollDice?: () => Promise<void>;

  /** Callback to handle automatic funding at OWNER-FUND-INITIATION space */
  onAutomaticFunding?: () => Promise<void>;

  /** Callback to handle manual effect results (to show modal) */
  onManualEffectResult?: (result: import('../../types/StateTypes').TurnEffectResult) => void;

  /** Completed actions tracking */
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
}

/**
 * PlayerPanel Component
 *
 * Main container for the mobile-first Player Panel UI redesign.
 * Displays all player information sections and the Next Step button.
 *
 * **Contains:**
 * - CurrentCardSection: Space content and player choices (default expanded on desktop)
 * - FinancesSection: Money tracking and Roll for Money action
 * - TimeSection: Time tracking and Roll for Time action
 * - CardsSection: Card portfolio and Roll for Cards actions
 * - NextStepButton: Context-aware main game loop button
 *
 * **Features:**
 * - Mobile-first collapsible sections for space efficiency
 * - Independent expand/collapse state for each section
 * - Action indicators (=4) when actions available
 * - Responsive layout (sections default expanded on desktop)
 * - Real-time updates via service subscriptions
 *
 * **Architecture:**
 * - Each section manages its own state subscriptions
 * - Parent manages expand/collapse state for sections
 * - NextStepButton tracks game state independently
 *
 * @example
 * ```tsx
 * <PlayerPanel
 *   gameServices={gameServices}
 *   playerId="player-1"
 * />
 * ```
 */
export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  gameServices,
  playerId,
  onToggleSpaceExplorer,
  onToggleMovementPath,
  isSpaceExplorerVisible = false,
  isMovementPathVisible = false,
  onTryAgain,
  playerNotification,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions = { manualActions: {} }
}) => {
  // Section expand/collapse state
  const [isCurrentCardExpanded, setIsCurrentCardExpanded] = useState(true);
  const [isProjectScopeExpanded, setIsProjectScopeExpanded] = useState(false);
  const [isFinancesExpanded, setIsFinancesExpanded] = useState(false);
  const [isTimeExpanded, setIsTimeExpanded] = useState(false);
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);

  // Movement choice state
  const [movementChoice, setMovementChoice] = useState<Choice | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  // Subscribe to game state for movement choices
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      // Only track movement choices for this player
      if (gameState.currentPlayerId === playerId && gameState.awaitingChoice?.type === 'MOVEMENT') {
        setMovementChoice(gameState.awaitingChoice);

        // Check if player already has moveIntent set (from previous selection)
        const player = gameState.players.find(p => p.id === playerId);
        if (player?.moveIntent) {
          setSelectedDestination(player.moveIntent);
        } else {
          setSelectedDestination(null);
        }
      } else if (gameState.currentPlayerId === playerId && !gameState.awaitingChoice) {
        setMovementChoice(null);
        setSelectedDestination(null);
      }
    });

    // Initialize with current state
    const gameState = gameServices.stateService.getGameState();
    if (gameState.currentPlayerId === playerId && gameState.awaitingChoice?.type === 'MOVEMENT') {
      setMovementChoice(gameState.awaitingChoice);
      const player = gameState.players.find(p => p.id === playerId);
      if (player?.moveIntent) {
        setSelectedDestination(player.moveIntent);
      }
    }

    return unsubscribe;
  }, [gameServices.stateService, playerId]);

  // Handle movement choice selection
  const handleMovementChoice = (destinationId: string) => {
    // Allow changing selection until End Turn is pressed
    if (selectedDestination === destinationId) {
      console.log(`🎯 PlayerPanel: Same destination clicked: ${destinationId}, no change needed`);
      return;
    }

    console.log(`🎯 PlayerPanel: ${selectedDestination ? 'Changing' : 'Selecting'} destination: ${destinationId}`);
    setSelectedDestination(destinationId);

    // Resolve the choice immediately (can be changed until End Turn is pressed)
    if (movementChoice) {
      gameServices.choiceService.resolveChoice(movementChoice.id, destinationId);
    }
  };

  // Get player data for header
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  return (
    <div className="player-panel">
      {/* Player Header - Avatar, Name, Location, and Notification */}
      <div className="player-panel__header">
        <div className="player-avatar">{player.avatar}</div>
        <div className="player-info">
          <div className="player-name">{player.name}</div>
          <div className="player-location">📍 {player.currentSpace}</div>
        </div>
        {playerNotification && (
          <div className="player-notification-inline">
            <span className="notification-icon">📢</span>
            <span className="notification-text">{playerNotification}</span>
          </div>
        )}
      </div>
      <CurrentCardSection
        gameServices={gameServices}
        playerId={playerId}
        isExpanded={isCurrentCardExpanded}
        onToggle={() => setIsCurrentCardExpanded(!isCurrentCardExpanded)}
      />

      <ProjectScopeSection
        gameServices={gameServices}
        playerId={playerId}
        isExpanded={isProjectScopeExpanded}
        onToggle={() => setIsProjectScopeExpanded(!isProjectScopeExpanded)}
        onRollDice={onRollDice}
        completedActions={completedActions}
      />

      <FinancesSection
        gameServices={gameServices}
        playerId={playerId}
        isExpanded={isFinancesExpanded}
        onToggle={() => setIsFinancesExpanded(!isFinancesExpanded)}
        onRollDice={onRollDice}
        onAutomaticFunding={onAutomaticFunding}
        completedActions={completedActions}
      />

      <TimeSection
        gameServices={gameServices}
        playerId={playerId}
        isExpanded={isTimeExpanded}
        onToggle={() => setIsTimeExpanded(!isTimeExpanded)}
        completedActions={completedActions}
      />

      <CardsSection
        gameServices={gameServices}
        playerId={playerId}
        isExpanded={isCardsExpanded}
        onToggle={() => setIsCardsExpanded(!isCardsExpanded)}
        onRollDice={onRollDice}
        onManualEffectResult={onManualEffectResult}
        completedActions={completedActions}
      />

      {/* Movement Choice Buttons */}
      {movementChoice && (
        <div style={{
          padding: '6px',
          backgroundColor: '#e3f2fd',
          border: '2px solid #2196f3',
          borderRadius: '6px',
          margin: '4px 0'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#1976d2',
            textAlign: 'center',
            marginBottom: '4px'
          }}>
            🚶 Choose Your Destination
          </div>
          {movementChoice.options.map((option, index) => {
            const isSelected = selectedDestination === option.id;

            return (
              <button
                key={index}
                onClick={() => handleMovementChoice(option.id)}
                disabled={false}
                style={{
                  padding: '4px 8px',
                  margin: '2px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  backgroundColor: isSelected ? '#4caf50' : '#2196f3',
                  color: 'white',
                  border: isSelected ? '2px solid #2e7d32' : 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: 1,
                  boxSizing: 'border-box',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                }}
              >
                {isSelected ? '✅ ' : '🎯 '}{option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Row - Try Again (left) and End Turn (right) */}
      <div className="player-panel__bottom">
        {onTryAgain && (
          <button
            onClick={onTryAgain}
            className="try-again-button"
            aria-label="Try Again on current space"
          >
            🔄 Try Again
          </button>
        )}
        <NextStepButton
          gameServices={gameServices}
          playerId={playerId}
        />
      </div>
    </div>
  );
};
