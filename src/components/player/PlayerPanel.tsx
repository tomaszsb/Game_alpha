import React, { useState, useEffect } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { Card } from '../../types/DataTypes';
import { FinancesSection } from './sections/FinancesSection';
import { TimeSection } from './sections/TimeSection';
import { CardsSection } from './sections/CardsSection';
import { CurrentCardSection } from './sections/CurrentCardSection';
import { ProjectScopeSection } from './sections/ProjectScopeSection';
import { StorySection } from './sections/StorySection';
import { NextStepButton } from './NextStepButton';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { Choice } from '../../types/CommonTypes';
import { getBackendURL } from '../../utils/networkDetection';
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
  onTryAgain?: (playerId: string) => Promise<void>;

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
  const [currentCard, setCurrentCard] = useState<Card | null>(null);

  // Movement choice state
  const [movementChoice, setMovementChoice] = useState<Choice | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  // Movement transition state
  const [showMovementTransition, setShowMovementTransition] = useState(false);
  const [movementTransition, setMovementTransition] = useState<{ from: string; to: string } | null>(null);
  const [previousSpace, setPreviousSpace] = useState<string | null>(null);

  // Story state
  const [spaceStory, setSpaceStory] = useState<string>('');

  // Current player tracking for wait screen
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('');

  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      const player = gameState.players.find(p => p.id === playerId);

      // Track current player for wait screen
      setCurrentPlayerId(gameState.currentPlayerId);
      const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
      setCurrentPlayerName(currentPlayer?.name || '');

      if (player) {
        const card = player.currentCard
          ? gameServices.dataService.getCardById(player.currentCard)
          : null;
        setCurrentCard(card || null);

        // Get space story
        const space = gameServices.dataService.getSpaceByName(player.currentSpace);
        if (space && space.content && space.content.length > 0) {
          // Get the appropriate content based on visit type
          const visitContent = space.content.find(c => c.visit_type === player.visitType);
          setSpaceStory(visitContent?.story || '');
        } else {
          setSpaceStory('');
        }

        // Detect space changes and show transition
        if (previousSpace && previousSpace !== player.currentSpace) {
          setMovementTransition({
            from: previousSpace,
            to: player.currentSpace
          });
          setShowMovementTransition(true);

          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            setShowMovementTransition(false);
          }, 5000);
        }

        // Update previous space
        setPreviousSpace(player.currentSpace);
      }
    });

    // Initialize with current state
    const gameState = gameServices.stateService.getGameState();
    const player = gameServices.stateService.getPlayer(playerId);

    // Initialize current player tracking
    setCurrentPlayerId(gameState.currentPlayerId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    setCurrentPlayerName(currentPlayer?.name || '');

    if (player) {
      const card = player.currentCard
        ? gameServices.dataService.getCardById(player.currentCard)
        : null;
      setCurrentCard(card || null);
      setPreviousSpace(player.currentSpace);

      // Initialize space story
      const space = gameServices.dataService.getSpaceByName(player.currentSpace);
      if (space && space.content && space.content.length > 0) {
        const visitContent = space.content.find(c => c.visit_type === player.visitType);
        setSpaceStory(visitContent?.story || '');
      }
    }

    return unsubscribe;
  }, [gameServices.stateService, gameServices.dataService, playerId, previousSpace]);

  const handleChoice = async (choiceId: string) => {
    const choice = gameServices.stateService.getGameState().awaitingChoice;
    if (choice) {
      await gameServices.choiceService.resolveChoice(choice.id, choiceId);
    }
  };


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

  // Handle movement transition dismiss
  const handleDismissTransition = () => {
    setShowMovementTransition(false);
  };

  // Check if this player is currently active
  const isMyTurn = playerId === currentPlayerId;

  return (
    <div className="player-panel">
      {/* Movement Transition Overlay */}
      {showMovementTransition && movementTransition && (
        <div
          onClick={handleDismissTransition}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(33, 150, 243, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'pointer',
            padding: '20px',
            textAlign: 'center'
          }}
        >
          <div style={{
            fontSize: '3rem',
            marginBottom: '20px',
            animation: 'bounce 1s infinite'
          }}>
            🚶
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '10px'
          }}>
            You have moved!
          </div>
          <div style={{
            fontSize: '1.2rem',
            color: 'white',
            maxWidth: '600px'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <strong>From:</strong> {movementTransition.from}
            </div>
            <div>
              <strong>To:</strong> {movementTransition.to}
            </div>
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '30px'
          }}>
            Tap anywhere to continue
          </div>
        </div>
      )}

      {/* Wait Screen - Show when it's not this player's turn */}
      {!isMyTurn && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(156, 39, 176, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            textAlign: 'center',
            borderRadius: '8px'
          }}
        >
          <div style={{
            fontSize: '4rem',
            marginBottom: '20px',
            animation: 'pulse 2s infinite'
          }}>
            ⏳
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '15px'
          }}>
            Please Wait
          </div>
          <div style={{
            fontSize: '1.3rem',
            color: 'white',
            marginBottom: '10px'
          }}>
            It's <strong>{currentPlayerName}'s</strong> turn
          </div>
          <div style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '20px'
          }}>
            You'll be notified when it's your turn
          </div>
        </div>
      )}

      {/* Player Header - Avatar, Name, Location, Connection Status, and Notification */}
      <div className="player-panel__header">
        <div className="player-avatar">{player.avatar}</div>
        <div className="player-info">
          <div className="player-name">{player.name}</div>
          <div className="player-location">📍 {player.currentSpace}</div>
        </div>
        <ConnectionStatus serverUrl={getBackendURL()} />
        {playerNotification && (
          <div className="player-notification-inline">
            <span className="notification-icon">📢</span>
            <span className="notification-text">{playerNotification}</span>
          </div>
        )}
      </div>
      {currentCard && (
        <CurrentCardSection
          card={currentCard}
          onChoice={handleChoice}
        />
      )}

      <StorySection
        story={spaceStory}
        spaceName={player.currentSpace}
      />

      <ProjectScopeSection
        gameServices={gameServices}
        playerId={playerId}
        onRollDice={onRollDice}
        completedActions={completedActions}
      />

      <FinancesSection
        gameServices={gameServices}
        playerId={playerId}
        onRollDice={onRollDice}
        onAutomaticFunding={onAutomaticFunding}
        completedActions={completedActions}
      />

      <TimeSection
        gameServices={gameServices}
        playerId={playerId}
        completedActions={completedActions}
      />

      <CardsSection
        gameServices={gameServices}
        playerId={playerId}
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

      {/* Bottom Row - Try Again Button (NextStepButton handles End Turn) */}
      <div className="player-panel__bottom">
        {onTryAgain && (
          <button
            onClick={() => onTryAgain(playerId)} // Pass playerId to onTryAgain
            className="try-again-button"
            aria-label="Try Again on current space"
          >
            🔄 Try Again
          </button>
        )}
      </div>
      <NextStepButton
        gameServices={gameServices}
        playerId={playerId}
      />
    </div>
  );
};