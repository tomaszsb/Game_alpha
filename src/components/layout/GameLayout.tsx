// src/components/layout/GameLayout.tsx

import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../../styles/theme';
import { CardModal } from '../modals/CardModal';
import { CardDetailsModal } from '../modals/CardDetailsModal';
import { ChoiceModal } from '../modals/ChoiceModal';
import { DiceResultModal } from '../modals/DiceResultModal';
import { EndGameModal } from '../modals/EndGameModal';
import { NegotiationModal } from '../modals/NegotiationModal';
import { RulesModal } from '../modals/RulesModal';
import { PlayerSetup } from '../setup/PlayerSetup';
import { PlayerPanel } from '../player/PlayerPanel';
import { GameBoard } from '../game/GameBoard';
import { ProjectProgress } from '../game/ProjectProgress';
import { MovementPathVisualization } from '../game/MovementPathVisualization';
import { SpaceExplorerPanel } from '../game/SpaceExplorerPanel';
import { GameLog } from '../game/GameLog';
import { DataEditor } from '../editor/DataEditor';
import { GameDisplaySettings } from '../settings/GameDisplaySettings';
import { useGameContext } from '../../context/GameContext';
import { formatDiceRollFeedback } from '../../utils/buttonFormatting';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { GamePhase, Player } from '../../types/StateTypes';
import { Card } from '../../types/DataTypes';

/**
 * GameLayout component replicates the high-level structure of the legacy FixedApp.js
 * This provides the main grid-based layout for the game application.
 */
export function GameLayout(): JSX.Element {
  const {
    stateService,
    dataService,
    cardService,
    turnService,
    movementService,
    notificationService,
    choiceService,
    effectEngineService,
    loggingService,
    negotiationService,
    playerActionService,
    gameRulesService,
    resourceService
  } = useGameContext();

  // Create service container for new PlayerPanel component
  const gameServices = {
    stateService,
    dataService,
    cardService,
    turnService,
    movementService,
    notificationService,
    choiceService,
    effectEngineService,
    loggingService,
    negotiationService,
    playerActionService,
    gameRulesService,
    resourceService
  };
  const [gamePhase, setGamePhase] = useState<GamePhase>('SETUP');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState<boolean>(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [isCardDetailsModalOpen, setIsCardDetailsModalOpen] = useState<boolean>(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isMovementPathVisible, setIsMovementPathVisible] = useState<boolean>(false);
  const [shouldAutoShowMovementPath, setShouldAutoShowMovementPath] = useState<boolean>(false);
  const [isSpaceExplorerVisible, setIsSpaceExplorerVisible] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isGameLogVisible, setIsGameLogVisible] = useState<boolean>(false);
  const [isDataEditorOpen, setIsDataEditorOpen] = useState<boolean>(false);
  const [isDiceResultModalOpen, setIsDiceResultModalOpen] = useState<boolean>(false);
  const [diceResult, setDiceResult] = useState<any>(null);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState<boolean>(false);
  const [visiblePanels, setVisiblePanels] = useState<Record<string, boolean>>(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem('game-display-settings');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to load display settings:', error);
      return {};
    }
  });

  // State tracking for processing and notifications
  const [isProcessingTurn, setIsProcessingTurn] = useState<boolean>(false);
  const [turnNumber, setTurnNumber] = useState<number>(0);
  const [justUsedTryAgain, setJustUsedTryAgain] = useState<boolean>(false);
  const [gameStateCompletedActions, setGameStateCompletedActions] = useState<{
    diceRoll: string | undefined;
    manualActions: { [key: string]: string };
  }>({ diceRoll: undefined, manualActions: {} });

  // Unified notification system - driven by NotificationService
  const [buttonFeedback, setButtonFeedback] = useState<{ [actionType: string]: string }>({});
  const [playerNotifications, setPlayerNotifications] = useState<{ [playerId: string]: string }>({});

  // Smart layout adaptation - track view mode for mobile players
  // Initialize synchronously from URL to prevent desktop layout flash on mobile
  const [viewPlayerId, setViewPlayerId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const playerIdParam = urlParams.get('playerId');
    if (playerIdParam) {
      console.log(`📱 Mobile view mode enabled for player: ${playerIdParam}`);
    }
    return playerIdParam;
  });

  // Use actual game state completed actions for UI display
  const completedActions = gameStateCompletedActions;

  // Subscribe to NotificationService updates
  useEffect(() => {
    notificationService.setUpdateCallbacks(
      (buttonFeedback) => {
        setButtonFeedback(buttonFeedback);
      },
      (playerNotifications) => {
        setPlayerNotifications(playerNotifications);
      }
    );
  }, [notificationService]);

  // Persist visiblePanels to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('game-display-settings', JSON.stringify(visiblePanels));
    } catch (error) {
      console.error('Failed to save display settings:', error);
    }
  }, [visiblePanels]);

  // Helper function to determine if a player panel should be shown
  const shouldShowPlayerPanel = (playerId: string): boolean => {
    // In mobile view mode, don't show any panels in the main area
    if (viewPlayerId) return false;

    // Check user's display settings first (explicit visibility toggle)
    // visiblePanels[playerId] === false means user explicitly hid it
    // visiblePanels[playerId] === true means user explicitly showed it
    // visiblePanels[playerId] === undefined means use default behavior
    if (visiblePanels[playerId] === false) {
      return false; // User explicitly hid this panel
    }
    if (visiblePanels[playerId] === true) {
      return true; // User explicitly showed this panel
    }

    // Default behavior: hide panels for ANY connected players (mobile or desktop)
    // Only show panels for players who haven't connected to their own view
    const player = players.find(p => p.id === playerId);
    return !player?.deviceType; // Show only if deviceType is undefined (not connected)
  };

  // Check if any player panels should be shown
  const shouldShowAnyPanel = !viewPlayerId && players.length > 0 &&
    players.some(p => shouldShowPlayerPanel(p.id));

  // If no panels should be shown, hide the entire panel column
  const hidePanelColumn = !viewPlayerId && !shouldShowAnyPanel;

  // Add responsive CSS styles to document head
  React.useEffect(() => {
    const styleId = 'game-layout-responsive';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .game-interface-responsive {
          display: grid;
          grid-template-columns: 1280px 1fr;
          column-gap: 8px;
          row-gap: 4px;
          height: 100vh;
          width: 100vw;
          padding: 4px;
          box-sizing: border-box;
          overflow: hidden;
        }

        @media (max-width: 1920px) {
          .game-interface-responsive {
            grid-template-columns: 1120px 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1600px) {
          .game-interface-responsive {
            grid-template-columns: 960px 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1400px) {
          .game-interface-responsive {
            grid-template-columns: 800px 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1200px) {
          .game-interface-responsive {
            grid-template-columns: 640px 1fr;
            column-gap: 4px;
            padding: 2px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Subscribe to game state changes to track phase transitions and notifications
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      const previousPlayerId = currentPlayerId;

      setGamePhase(gameState.gamePhase);
      setPlayers(gameState.players);
      setCurrentPlayerId(gameState.currentPlayerId);
      setActiveModal(gameState.activeModal?.type || null);

      // Track turn changes for notification clearing
      const previousTurn = turnNumber;
      setTurnNumber(gameState.turn);

      // Clear completed actions when current player changes OR turn advances
      const playerChanged = previousPlayerId && previousPlayerId !== gameState.currentPlayerId;
      const turnChanged = previousTurn !== gameState.turn;

      if (playerChanged || turnChanged) {
        notificationService.clearAllNotifications();
        setButtonFeedback({});
        setPlayerNotifications({});
      }

      // Update completed actions from game state
      setGameStateCompletedActions(gameState.completedActions);
    });

    // Initialize with current state
    const currentState = stateService.getGameState();
    setGamePhase(currentState.gamePhase);
    setPlayers(currentState.players);
    setCurrentPlayerId(currentState.currentPlayerId);
    setActiveModal(currentState.activeModal?.type || null);
    setTurnNumber(currentState.turn);
    setGameStateCompletedActions(currentState.completedActions);

    return () => {
      unsubscribe();
      // Clean up all notifications on unmount
      notificationService.clearAllNotifications();
    };
  }, [stateService, currentPlayerId, turnNumber, notificationService]);

  // NOTE: Auto-show movement path logic disabled - using board-based movement indicators instead

  // Handlers for negotiation modal
  const handleOpenNegotiationModal = () => {
    // Close any open side panels when modal opens
    setIsMovementPathVisible(false);
    setIsSpaceExplorerVisible(false);
    setIsNegotiationModalOpen(true);
  };

  const handleCloseNegotiationModal = () => {
    setIsNegotiationModalOpen(false);
  };

  // Handlers for rules modal
  const handleOpenRulesModal = () => {
    // Close any open side panels when modal opens
    setIsMovementPathVisible(false);
    setIsSpaceExplorerVisible(false);
    setIsRulesModalOpen(true);
  };

  const handleCloseRulesModal = () => {
    setIsRulesModalOpen(false);
  };

  // Handlers for card details modal
  const handleOpenCardDetailsModal = (cardId: string) => {
    // Close any open side panels when modal opens
    setIsMovementPathVisible(false);
    setIsSpaceExplorerVisible(false);
    
    // Fetch card data before opening modal
    const card = dataService.getCardById(cardId);
    setSelectedCard(card || null);
    setIsCardDetailsModalOpen(true);
  };

  const handleCloseCardDetailsModal = () => {
    setIsCardDetailsModalOpen(false);
    setSelectedCard(null);
  };

  // Handlers for movement path visualization
  const handleToggleMovementPath = () => {
    const newVisibility = !isMovementPathVisible;
    setIsMovementPathVisible(newVisibility);
    
    // If user manually toggles, stop auto-showing behavior
    if (shouldAutoShowMovementPath) {
      setShouldAutoShowMovementPath(false);
      console.log(`🎯 MANUAL TOGGLE: User manually ${newVisibility ? 'showed' : 'hid'} movement path, disabling auto-show`);
    }
  };

  // Handlers for space explorer panel
  const handleToggleSpaceExplorer = () => {
    setIsSpaceExplorerVisible(!isSpaceExplorerVisible);
  };

  // Handler for game log toggle
  const handleToggleGameLog = () => setIsGameLogVisible(prev => !prev);

  // Handler for display settings
  const handleTogglePanel = (playerId: string) => {
    setVisiblePanels(prev => {
      const currentValue = prev[playerId];
      const isCurrentlyVisible = currentValue !== false; // Default to true if undefined

      // Simple toggle: visible -> hidden, hidden -> visible
      const newPanels = { ...prev };
      newPanels[playerId] = !isCurrentlyVisible;

      return newPanels;
    });
  };

  // Action handlers for TurnControlsWithActions component
  const handleRollDice = async () => {
    if (!currentPlayerId) return;
    setJustUsedTryAgain(false); // Clear Try Again flag when player takes action
    setIsProcessingTurn(true);
    try {
      const result = await turnService.rollDiceWithFeedback(currentPlayerId);
      const currentPlayer = players.find(p => p.id === currentPlayerId);

      if (currentPlayer) {
        // Show dice result modal with detailed feedback
        setDiceResult(result);
        setIsDiceResultModalOpen(true);

        // Also use unified notification system for the banner
        notificationService.notify(
          NotificationUtils.createDiceRollNotification(result.diceValue, result.effects || [], currentPlayer.name),
          {
            playerId: currentPlayerId,
            playerName: currentPlayer.name,
            actionType: 'dice'
          }
        );
      }
    } catch (error) {
      console.error("Error rolling dice:", error);
      const currentPlayer = players.find(p => p.id === currentPlayerId);
      if (currentPlayer) {
        notificationService.notify(
          NotificationUtils.createErrorNotification('dice roll', error instanceof Error ? error.message : 'Unknown error', currentPlayer.name),
          {
            playerId: currentPlayerId,
            playerName: currentPlayer.name,
            actionType: 'dice'
          }
        );
      }
    } finally {
      setIsProcessingTurn(false);
    }
  };

  const handleEndTurn = async () => {
    if (!currentPlayerId) return;
    setIsProcessingTurn(true);
    try {
      const result = await turnService.endTurnWithMovement(false, justUsedTryAgain);
      console.log(`End turn completed for player ${currentPlayerId}:`, result);
      setJustUsedTryAgain(false); // Reset flag after ending turn
    } catch (error) {
      console.error("Error ending turn:", error);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  const handleManualEffect = async (effectType: string) => {
    if (!currentPlayerId) return;
    setJustUsedTryAgain(false); // Clear Try Again flag when player takes action
    setIsProcessingTurn(true);
    try {
      const result = await turnService.triggerManualEffectWithFeedback(currentPlayerId, effectType);

      // Show modal if there are effects to display
      if (result && result.effects && result.effects.length > 0) {
        setDiceResult(result);
        setIsDiceResultModalOpen(true);
        // Notification already sent by TurnService
      }
    } catch (error) {
      console.error("Error triggering manual effect:", error);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  const handleAutomaticFunding = async () => {
    if (!currentPlayerId) return;
    setJustUsedTryAgain(false); // Clear Try Again flag when player takes action
    setIsProcessingTurn(true);
    try {
      const result = await turnService.handleAutomaticFunding(currentPlayerId);
      console.log(`Automatic funding completed for player ${currentPlayerId}:`, result);

      // Show modal with funding details
      if (result && result.effects && result.effects.length > 0) {
        setDiceResult(result);
        setIsDiceResultModalOpen(true);

        // Notification is already sent by TurnService
      }
    } catch (error) {
      console.error("Error handling automatic funding:", error);
    } finally {
      setIsProcessingTurn(false);
    }
  };


  const handleTryAgain = async () => {
    if (!currentPlayerId) return;
    setIsProcessingTurn(true);
    try {
      const result = await turnService.tryAgainOnSpace(currentPlayerId);
      console.log(`Try Again completed for player ${currentPlayerId}:`, result);

      // If Try Again indicates turn should advance, move to next player
      if (result.success && result.shouldAdvanceTurn) {
        setJustUsedTryAgain(true); // Set flag to skip auto-movement
        console.log('🔄 Try Again complete - advancing to next player');
        const nextResult = await turnService.endTurnWithMovement(true, true);
        console.log(`Next player's turn: ${nextResult.nextPlayerId}`);
      }
    } catch (error) {
      console.error("Error trying again on space:", error);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  const handleStartGame = async () => {
    try {
      const gameState = stateService.getGameState();
      if (gameState.players.length === 0) {
        stateService.addPlayer('Test Player');
      }
      stateService.startGame();

      // Place players on starting spaces (no effects processing)
      console.log('🏁 Placing players on starting spaces...');
      try {
        await turnService.placePlayersOnStartingSpaces();
        console.log('✅ Players placed on starting spaces successfully');

        // Start the first turn (this will create snapshots and mark as initialized)
        const currentState = stateService.getGameState();
        if (currentState.currentPlayerId) {
          console.log('🎬 Starting first turn for game initialization...');
          await turnService.startTurn(currentState.currentPlayerId);
        }
      } catch (error) {
        console.error('❌ Error placing players on starting spaces:', error);
      }
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  // Helper function to check if any modal is open
  const isAnyModalOpen = () => {
    return isRulesModalOpen || 
           isNegotiationModalOpen || 
           isCardDetailsModalOpen || 
           activeModal !== null;
  };

  return (
    <div
      className="game-interface-responsive"
      style={{
        gridTemplateRows: gamePhase === 'PLAY' ? 'auto 1fr auto' : '1fr auto',
        // Dynamic columns: 1 column if no panels shown, 2 columns otherwise
        gridTemplateColumns: hidePanelColumn ? '1fr' : undefined
      }}
    >
      {/* Mobile View Mode - Show only player panel */}
      {viewPlayerId && gamePhase === 'PLAY' && (
        <div
          style={{
            gridColumn: '1 / -1',
            gridRow: '1',
            background: colors.background.light,
            border: `3px solid ${colors.primary.main}`,
            borderRadius: '8px',
            overflow: 'visible',
            position: 'relative'
          }}
        >
          {players.find(p => p.id === viewPlayerId) ? (
            <PlayerPanel
              gameServices={gameServices}
              playerId={viewPlayerId}
              onToggleSpaceExplorer={handleToggleSpaceExplorer}
              onToggleMovementPath={handleToggleMovementPath}
              isSpaceExplorerVisible={isSpaceExplorerVisible}
              isMovementPathVisible={isMovementPathVisible}
              onTryAgain={handleTryAgain}
              playerNotification={playerNotifications[viewPlayerId]}
              onRollDice={handleRollDice}
              onAutomaticFunding={handleAutomaticFunding}
              onManualEffectResult={(result) => {
                if (result && result.effects && result.effects.length > 0) {
                  setDiceResult(result);
                  setIsDiceResultModalOpen(true);
                }
              }}
              completedActions={completedActions}
            />
          ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3>Player not found</h3>
            </div>
          )}
        </div>
      )}

      {/* Desktop View Mode - Show progress, player panels (filtered), and board */}
      {!viewPlayerId && (
        <>
          {/* Top Panel - Project Progress (only in PLAY phase) */}
          {gamePhase === 'PLAY' && (
            <div style={{
              gridColumn: '1 / -1',
              gridRow: '1'
            }}>
              <ProjectProgress
                players={players}
                currentPlayerId={currentPlayerId}
                dataService={dataService}
                onToggleGameLog={handleToggleGameLog}
                onOpenRulesModal={handleOpenRulesModal}
              />
            </div>
          )}

          {/* Left Panel - Player Panels (only show if at least one panel is visible) */}
          {!hidePanelColumn && (
            <div
              style={{
                gridColumn: '1',
                gridRow: gamePhase === 'PLAY' ? '2' : '1',
                background: colors.background.light,
                border: `3px solid ${colors.primary.main}`,
                borderRadius: '8px',
                padding: gamePhase === 'PLAY' ? '0' : '15px',
                overflow: 'auto',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {gamePhase === 'PLAY' ? (
                <>
                  {players.filter(p => shouldShowPlayerPanel(p.id)).map(player => (
                    <PlayerPanel
                      key={player.id}
                      gameServices={gameServices}
                      playerId={player.id}
                      onToggleSpaceExplorer={handleToggleSpaceExplorer}
                      onToggleMovementPath={handleToggleMovementPath}
                      isSpaceExplorerVisible={isSpaceExplorerVisible}
                      isMovementPathVisible={isMovementPathVisible}
                      onTryAgain={handleTryAgain}
                      playerNotification={playerNotifications[player.id]}
                      onRollDice={handleRollDice}
                      onAutomaticFunding={handleAutomaticFunding}
                      onManualEffectResult={(result) => {
                        if (result && result.effects && result.effects.length > 0) {
                          setDiceResult(result);
                          setIsDiceResultModalOpen(true);
                        }
                      }}
                      completedActions={completedActions}
                    />
                  ))}
                </>
              ) : (
                <>
                  <h3>👤 Player Panel</h3>
                  <div style={{ color: colors.text.secondary }}>
                    Player information will be displayed here
                  </div>
                </>
              )}
            </div>
          )}

          {/* Center Panel - Game Board */}
          <div
            style={{
              gridColumn: hidePanelColumn ? '1' : '2',
              gridRow: gamePhase === 'PLAY' ? '2' : '1',
              background: colors.white,
              border: `3px solid ${colors.game.boardTitle}`,
              borderRadius: '8px',
              padding: '0',
              overflow: 'hidden',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {gamePhase === 'PLAY' ? (
              <GameBoard />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  padding: '20px'
                }}
              >
                <h2 style={{ color: colors.game.boardTitle }}>🎯 Game Board</h2>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div
                    style={{
                      background: colors.primary.light,
                      border: `3px solid ${colors.primary.main}`,
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '20px'
                    }}
                  >
                    <h3 style={{ margin: '0 0 10px 0', color: colors.primary.text }}>
                      Current Space
                    </h3>
                    <p style={{ margin: '0', color: colors.text.secondary }}>
                      Game board will be displayed here
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom Panel - Additional UI Elements */}
      {isGameLogVisible && (
        <div
          style={{
            gridColumn: '1 / -1',
            gridRow: gamePhase === 'PLAY' ? '3' : '2',
            background: colors.secondary.bg,
            border: `2px solid ${colors.secondary.light}`,
            borderRadius: '8px',
            padding: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.secondary.main,
            minHeight: '80px'
          }}
        >
          <GameLog />
        </div>
      )}


      {/* Conditional rendering based on game phase */}
      {gamePhase === 'SETUP' && (
        <PlayerSetup
          onStartGame={async (players, settings) => {
            console.log('Starting game with players:', players);
            console.log('Game settings:', settings);
            // Actually start the game through StateService
            stateService.startGame();

            // Place players on starting spaces (no effects processing)
            console.log('🏁 Placing players on starting spaces...');
            try {
              await turnService.placePlayersOnStartingSpaces();
              console.log('✅ Players placed on starting spaces successfully');

              // Start the first turn (this will create snapshots and mark as initialized)
              const currentState = stateService.getGameState();
              if (currentState.currentPlayerId) {
                console.log('🎬 Starting first turn for game initialization...');
                await turnService.startTurn(currentState.currentPlayerId);
              }
            } catch (error) {
              console.error('❌ Error placing players on starting spaces:', error);
            }
          }}
        />
      )}
      

      {/* CardModal - always rendered, visibility controlled by state */}
      <CardModal />
      
      {/* ChoiceModal - always rendered, visibility controlled by state */}
      <ChoiceModal />

      {/* DiceResultModal - shows detailed dice roll feedback */}
      <DiceResultModal
        isOpen={isDiceResultModalOpen}
        result={diceResult}
        onClose={() => setIsDiceResultModalOpen(false)}
      />

      {/* EndGameModal - always rendered, visibility controlled by state */}
      <EndGameModal />
      
      {/* NegotiationModal - always rendered, visibility controlled by state */}
      <NegotiationModal 
        isOpen={isNegotiationModalOpen} 
        onClose={handleCloseNegotiationModal} 
      />
      
      {/* RulesModal - always rendered, visibility controlled by state */}
      <RulesModal 
        isOpen={isRulesModalOpen} 
        onClose={handleCloseRulesModal} 
      />
      
      {/* CardDetailsModal - always rendered, visibility controlled by state */}
      <CardDetailsModal 
        isOpen={isCardDetailsModalOpen}
        onClose={handleCloseCardDetailsModal}
        card={selectedCard}
        currentPlayer={players.find(p => p.id === currentPlayerId) || null}
        otherPlayers={players.filter(p => p.id !== currentPlayerId)}
        cardService={cardService}
      />
      
      {isDataEditorOpen && <DataEditor onClose={() => setIsDataEditorOpen(false)} />}

      {/* Display Settings Button (show in desktop view during setup and play) */}
      {!viewPlayerId && (
        <button
          onClick={() => setIsDisplaySettingsOpen(true)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '60px',
            zIndex: 1000,
            background: colors.primary.main,
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
          title="Display Settings"
        >
          👁️
        </button>
      )}

      {/* Data Editor Button */}
      <button
        onClick={() => setIsDataEditorOpen(true)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: colors.secondary.main,
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}
        title="Open Data Editor"
      >
        ⚙️
      </button>

      {/* Display Settings Modal */}
      {isDisplaySettingsOpen && (
        <GameDisplaySettings
          players={players}
          visiblePanels={visiblePanels}
          onTogglePanel={handleTogglePanel}
          onClose={() => setIsDisplaySettingsOpen(false)}
        />
      )}

    </div>
  );
}