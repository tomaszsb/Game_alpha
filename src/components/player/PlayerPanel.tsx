import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
import { AutoActionEvent } from '../../services/StateService';
import { getBackendURL } from '../../utils/networkDetection';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import './PlayerPanel.css';

// Spring animation config for desktop panels
const desktopPanelSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25
};

// Variants for active/inactive panel states
const panelVariants = {
  inactive: {
    scale: 1,
    transition: desktopPanelSpring
  },
  active: {
    scale: 1.02,
    transition: desktopPanelSpring
  }
};

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
  // NPC portrait hook
  const { getPortraitForSpace } = useNpcPortrait();

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
  const [previousCurrentPlayerId, setPreviousCurrentPlayerId] = useState<string | null>(null);

  // Desktop animation state - pulse on turn change
  const [shouldPulse, setShouldPulse] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  // Dice movement state - for spaces that require dice roll to determine destination
  const [hasPlayerRolledDice, setHasPlayerRolledDice] = useState(false);
  const [isDiceMovementSpace, setIsDiceMovementSpace] = useState(false);
  const [isRollingDice, setIsRollingDice] = useState(false);

  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      const player = gameState.players.find(p => p.id === playerId);

      // Track current player for wait screen
      const newCurrentPlayerId = gameState.currentPlayerId;
      const currentPlayer = gameState.players.find(p => p.id === newCurrentPlayerId);
      setCurrentPlayerName(currentPlayer?.name || '');

      // Detect turn transition TO this player (multi-player scenario)
      const turnJustStartedForThisPlayer =
        previousCurrentPlayerId !== null &&
        previousCurrentPlayerId !== playerId &&
        newCurrentPlayerId === playerId;

      // Trigger desktop pulse animation when turn changes to this player
      if (turnJustStartedForThisPlayer && isDesktop && !prefersReducedMotion) {
        setShouldPulse(true);
        // Clear pulse after animation completes (600ms matches CSS animation)
        setTimeout(() => setShouldPulse(false), 600);
      }

      // Also detect same-player movement (single-player or turn continuation)
      const isCurrentPlayer = newCurrentPlayerId === playerId;
      const spaceChanged = previousSpace !== null && previousSpace !== player?.currentSpace;

      // Update current player ID tracking
      setPreviousCurrentPlayerId(currentPlayerId);
      setCurrentPlayerId(newCurrentPlayerId);

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
          console.log('📖 Story Debug:', {
            spaceName: player.currentSpace,
            visitType: player.visitType,
            contentLength: space.content.length,
            visitContent,
            story: visitContent?.story,
            action_description: visitContent?.action_description
          });
          // Combine story and action_description for full context
          const storyText = visitContent?.story || '';
          const actionText = visitContent?.action_description || '';
          const fullStory = [storyText, actionText].filter(Boolean).join(' ');
          setSpaceStory(fullStory);
        } else {
          console.log('📖 Story Debug: No space or content', {
            spaceName: player.currentSpace,
            hasSpace: !!space,
            hasContent: space?.content?.length
          });
          setSpaceStory('');
        }

        // Check if this is a dice-movement space (roll determines destination)
        const movement = gameServices.dataService.getMovement(player.currentSpace, player.visitType);
        const isDiceSpace = movement?.movement_type === 'dice';
        setIsDiceMovementSpace(isDiceSpace);
        setHasPlayerRolledDice(gameState.hasPlayerRolledDice);

        // Debug logging for dice movement spaces
        const diceDebugSpaces = ['CHEAT-BYPASS', 'REG-DOB-PLAN-EXAM', 'REG-DOB-PROF-CERT'];
        if (diceDebugSpaces.includes(player.currentSpace)) {
          console.log('🎲 DICE MOVEMENT DEBUG (PlayerPanel):', {
            space: player.currentSpace,
            isDiceSpace,
            hasPlayerRolledDice: gameState.hasPlayerRolledDice,
            movementType: movement?.movement_type,
            isMyTurn: newCurrentPlayerId === playerId
          });
        }

        // NOTE: Movement transition is now primarily handled via auto-action events
        // (see the subscribeToAutoActions useEffect below). This state-based fallback
        // is kept for multi-player turn transitions where the event may not fire.
        // Only trigger if overlay is not already showing to avoid duplicates.
        const shouldShowTransition =
          !showMovementTransition && // Don't trigger if already showing
          (turnJustStartedForThisPlayer || (isCurrentPlayer && spaceChanged)) &&
          previousSpace &&
          previousSpace !== player.currentSpace;

        if (shouldShowTransition) {
          console.log('🚶 Movement transition (fallback) triggered:', {
            from: previousSpace,
            to: player.currentSpace,
            turnJustStarted: turnJustStartedForThisPlayer,
            samePlayerMove: isCurrentPlayer && spaceChanged
          });

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
    const initialCurrentPlayerId = gameState.currentPlayerId;
    setCurrentPlayerId(initialCurrentPlayerId);
    setPreviousCurrentPlayerId(initialCurrentPlayerId); // Initialize to current so first turn doesn't trigger transition
    const currentPlayer = gameState.players.find(p => p.id === initialCurrentPlayerId);
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
        console.log('📖 Story Init Debug:', {
          spaceName: player.currentSpace,
          visitType: player.visitType,
          contentLength: space.content.length,
          visitContent,
          story: visitContent?.story,
          action_description: visitContent?.action_description
        });
        // Combine story and action_description for full context
        const storyText = visitContent?.story || '';
        const actionText = visitContent?.action_description || '';
        const fullStory = [storyText, actionText].filter(Boolean).join(' ');
        setSpaceStory(fullStory);
      }

      // Initialize dice movement state
      const movement = gameServices.dataService.getMovement(player.currentSpace, player.visitType);
      setIsDiceMovementSpace(movement?.movement_type === 'dice');
      setHasPlayerRolledDice(gameState.hasPlayerRolledDice);
    }

    return unsubscribe;
  }, [gameServices.stateService, gameServices.dataService, playerId, previousSpace, currentPlayerId, previousCurrentPlayerId]);

  // Subscribe to movement events to show overlay BEFORE the move happens
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribeToAutoActions((event: AutoActionEvent) => {
      // Only handle movement events for this player
      if (event.type === 'movement' && event.playerId === playerId) {
        console.log('🚶 Pre-movement event received:', {
          from: event.fromSpace,
          to: event.toSpace,
          playerId: event.playerId,
          playerColor: event.playerColor
        });

        // Show the movement transition overlay immediately (before state changes)
        setMovementTransition({
          from: event.fromSpace || event.spaceName,
          to: event.toSpace || ''
        });
        setShowMovementTransition(true);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setShowMovementTransition(false);
        }, 5000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [gameServices.stateService, playerId]);

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

    // Set the move intent so End Turn knows where to move
    // DON'T resolve the choice immediately - that clears awaitingChoice and hides buttons
    // The choice will be resolved when End Turn is pressed
    gameServices.stateService.setPlayerMoveIntent(playerId, destinationId);
  };

  // Get player data for header
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  // Get space title for display (shows full name alongside acronym)
  const spaceContent = gameServices.dataService.getSpaceContent(player.currentSpace, player.visitType);
  const spaceTitle = spaceContent?.title || '';

  // Handle movement transition dismiss
  const handleDismissTransition = () => {
    setShowMovementTransition(false);
  };

  // Check if this player is currently active
  const isMyTurn = playerId === currentPlayerId;

  // Debug logging for wait banner
  console.log('🎯 PlayerPanel wait banner debug:', {
    playerId,
    currentPlayerId,
    isMyTurn,
    currentPlayerName,
    shouldShowBanner: !isMyTurn
  });

  // Build class names for desktop animations
  const panelClasses = [
    'player-panel',
    isDesktop && isMyTurn ? 'player-panel--active' : '',
    isDesktop && shouldPulse ? 'player-panel--pulse' : ''
  ].filter(Boolean).join(' ');

  // Use motion.div on desktop for spring animations, regular div on mobile
  const PanelWrapper = isDesktop && !prefersReducedMotion ? motion.div : 'div';
  const motionProps = isDesktop && !prefersReducedMotion ? {
    variants: panelVariants,
    animate: isMyTurn ? 'active' : 'inactive',
    initial: 'inactive'
  } : {};

  return (
    <PanelWrapper className={panelClasses} {...motionProps}>
      {/* Movement Transition Overlay - Only shows on this player's panel at start of their turn */}
      {showMovementTransition && movementTransition && (
        <div
          onClick={handleDismissTransition}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: player.color ? `${player.color}ee` : 'rgba(33, 150, 243, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'pointer',
            padding: '20px',
            textAlign: 'center',
            borderRadius: '8px'
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

      {/* Turn indicator banner - Show when it's not this player's turn */}
      {!isMyTurn && (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'rgba(156, 39, 176, 0.9)',
            color: 'white',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '1rem',
            borderRadius: '8px',
            marginBottom: '8px',
            border: '2px solid #ab47bc'
          }}
        >
          ⏳ It's {currentPlayerName}'s turn - Please wait
        </div>
      )}

      {/* Player Header - Avatar, Name, Location, Connection Status, and Notification */}
      <div className="player-panel__header">
        <div className="player-avatar">{player.avatar}</div>
        <div className="player-info">
          <div className="player-name">{player.name}</div>
          <div className="player-location" title={spaceTitle}>
            📍 {player.currentSpace}
            {spaceTitle && <span className="player-location__title"> - {spaceTitle}</span>}
          </div>
        </div>
        <ConnectionStatus serverUrl={getBackendURL()} />
        {playerNotification && (
          <div className="player-notification-inline">
            <span className="notification-icon">📢</span>
            <span className="notification-text">{playerNotification}</span>
          </div>
        )}
      </div>

      {/* Mobile Quick Stats Bar - Shows key stats at a glance (Dec 29, 2025) */}
      <div className="player-panel__quick-stats">
        <div className="quick-stat quick-stat--money">
          <span className="quick-stat__icon">💰</span>
          <span className="quick-stat__value">${(player.money || 0).toLocaleString()}</span>
          <span className="quick-stat__label">Money</span>
        </div>
        <div className="quick-stat quick-stat--time">
          <span className="quick-stat__icon">⏱️</span>
          <span className="quick-stat__value">{player.timeSpent || 0}w</span>
          <span className="quick-stat__label">Time</span>
        </div>
        <div className="quick-stat quick-stat--cards">
          <span className="quick-stat__icon">🃏</span>
          <span className="quick-stat__value">{player.hand?.length || 0}</span>
          <span className="quick-stat__label">Cards</span>
        </div>
        <div className="quick-stat quick-stat--scope">
          <span className="quick-stat__icon">📐</span>
          <span className="quick-stat__value">{player.projectScope || 0}</span>
          <span className="quick-stat__label">Scope</span>
        </div>
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
        portraitSrc={getPortraitForSpace(player.currentSpace)}
      />

      <ProjectScopeSection
        gameServices={gameServices}
        playerId={playerId}
        onRollDice={onRollDice}
        completedActions={completedActions}
        isMyTurn={isMyTurn}
      />

      <FinancesSection
        gameServices={gameServices}
        playerId={playerId}
        onRollDice={onRollDice}
        onAutomaticFunding={onAutomaticFunding}
        completedActions={completedActions}
        isMyTurn={isMyTurn}
      />

      <TimeSection
        gameServices={gameServices}
        playerId={playerId}
        completedActions={completedActions}
        isMyTurn={isMyTurn}
      />

      <CardsSection
        gameServices={gameServices}
        playerId={playerId}
        onRollDice={onRollDice}
        onManualEffectResult={onManualEffectResult}
        completedActions={completedActions}
        isMyTurn={isMyTurn}
      />

      {/* Roll Dice for Movement Button - for non-REG dice-movement spaces
          REG spaces auto-roll because the clerk/examiner makes the decision, not the player
          All other dice-movement spaces (CHEAT, ARCH Subsequent, etc.) require manual roll */}
      {isDiceMovementSpace && isMyTurn && !hasPlayerRolledDice && onRollDice &&
       !player.currentSpace.startsWith('REG-') && (
        <div style={{
          padding: '12px',
          backgroundColor: player.currentSpace.startsWith('CHEAT') ? '#fff3e0' : '#e3f2fd',
          border: `3px solid ${player.currentSpace.startsWith('CHEAT') ? '#ff9800' : '#2196f3'}`,
          borderRadius: '8px',
          margin: '8px 0',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: player.currentSpace.startsWith('CHEAT') ? '#e65100' : '#1565c0',
            marginBottom: '8px'
          }}>
            {player.currentSpace.startsWith('CHEAT')
              ? '🎲 Roll the dice to see if you can cheat the system!'
              : '🎲 Roll the dice to determine your next destination'}
          </div>
          <button
            onClick={async () => {
              setIsRollingDice(true);
              try {
                await onRollDice();
              } finally {
                setIsRollingDice(false);
              }
            }}
            disabled={isRollingDice}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: isRollingDice ? '#bdbdbd' : (player.currentSpace.startsWith('CHEAT') ? '#ff9800' : '#2196f3'),
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isRollingDice ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
            }}
          >
            {isRollingDice ? '🎲 Rolling...' : '🎲 Roll Dice for Movement'}
          </button>
        </div>
      )}

      {/* Show dice roll result when rolled on non-REG dice-movement space */}
      {isDiceMovementSpace && hasPlayerRolledDice && completedActions.diceRoll &&
       !player.currentSpace.startsWith('REG-') && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#e8f5e9',
          border: '2px solid #4caf50',
          borderRadius: '6px',
          margin: '4px 0',
          textAlign: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#2e7d32'
        }}>
          🎲 {completedActions.diceRoll}
        </div>
      )}

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

      {/* Bottom Row - Next Step Button and Try Again Button */}
      {/* Uses sticky positioning on mobile for always-visible action button (Dec 29, 2025) */}
      <div className="player-panel__bottom player-panel__bottom--sticky">
        <NextStepButton
          gameServices={gameServices}
          playerId={playerId}
        />
        {isMyTurn && onTryAgain && (
          <button
            onClick={() => onTryAgain(playerId)} // Pass playerId to onTryAgain
            className="try-again-button"
            aria-label={spaceContent?.can_negotiate ? 'Negotiate on current space' : 'Try Again on current space'}
            title={spaceContent?.can_negotiate
              ? 'Negotiate for a better outcome. Resets your turn on this space so you can roll again and try for different results.'
              : 'Restore to snapshot saved when you arrived at this space. Use this if you want to undo actions and try different choices.'}
          >
            {spaceContent?.can_negotiate ? '🔄 Negotiate' : '🔄 Try Again'}
          </button>
        )}
      </div>
    </PanelWrapper>
  );
};