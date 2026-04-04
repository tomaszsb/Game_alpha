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
import { PlayerPanelWrapper } from '../player/PlayerPanelWrapper';
import { ProjectProgress } from '../game/ProjectProgress';
import { SpaceExplorerPanel } from '../game/SpaceExplorerPanel';
import { GameLog } from '../game/GameLog';
import { BoardV3 } from '../board/BoardV3';
import { GameDisplaySettings } from '../settings/GameDisplaySettings';
import { useGameContext } from '../../context/GameContext';
import { formatDiceRollFeedback } from '../../utils/buttonFormatting';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { GamePhase, Player, DiceResultEffect } from '../../types/StateTypes';
import { Card } from '../../types/DataTypes';
import { AutoActionEvent } from '../../services/StateService';
import { haptics } from '../../utils/haptics';
import { pushNotifications } from '../../utils/pushNotifications';
import { PullToRefresh } from '../common/PullToRefresh';
import { useDictionaryPanel } from '../../dictionary/context/DictionaryContext';
import { PlayerDebug } from '../debug/PlayerDebug';

interface GameLayoutProps {
  viewPlayerId?: string;
  initialPreview?: { action: string; id: string } | null;
  onPreviewConsumed?: () => void;
}

/**
 * GameLayout component replicates the high-level structure of the legacy FixedApp.js
 * This provides the main grid-based layout for the game application.
 */
export function GameLayout({ viewPlayerId, initialPreview, onPreviewConsumed }: GameLayoutProps = {}): JSX.Element {
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

  // Create service container for ActionCenterPanel
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
  // Dictionary panel control
  const { isOpen: isDictionaryOpen, openPanel: openDictionary, closePanel: closeDictionary } = useDictionaryPanel();

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
  const [previewSpaceId, setPreviewSpaceId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isGameLogVisible, setIsGameLogVisible] = useState<boolean>(false);
  const [isDiceResultModalOpen, setIsDiceResultModalOpen] = useState<boolean>(false);
  const [diceResult, setDiceResult] = useState<any>(null);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState<boolean>(false);
  const [isProgressCollapsed, setIsProgressCollapsed] = useState<boolean>(false);
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

  // Push notification permission state
  const [notificationPermission, setNotificationPermission] = useState<string>(() =>
    pushNotifications.getPermission()
  );
  const hasRequestedNotificationsRef = useRef(false);

  // Request notification permission when game starts (only once)
  useEffect(() => {
    if (gamePhase === 'PLAY' && !hasRequestedNotificationsRef.current) {
      hasRequestedNotificationsRef.current = true;
      // Request permission after a short delay so it doesn't disrupt the game start experience
      const timer = setTimeout(async () => {
        const permission = await pushNotifications.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gamePhase]);

  // Handle initial preview request
  useEffect(() => {
    if (!initialPreview) return;


    if (initialPreview.action === 'preview_card') {
      const card = dataService.getCardById(initialPreview.id);
      if (card) {
        setSelectedCard(card);
        setIsCardDetailsModalOpen(true);
      } else {
        notificationService.notify(
          NotificationUtils.createErrorNotification('Preview', `Card "${initialPreview.id}" not found`, 'System'),
          { playerId: 'system', playerName: 'System', actionType: 'preview_error' }
        );
      }
    } else if (initialPreview.action === 'preview_space') {
      const spaceExists = dataService.getAllSpaces().some(s => s.name === initialPreview.id);
      if (spaceExists) {
        setPreviewSpaceId(initialPreview.id);
        setIsSpaceExplorerVisible(true);
      } else {
        notificationService.notify(
          NotificationUtils.createErrorNotification('Preview', `Space "${initialPreview.id}" not found`, 'System'),
          { playerId: 'system', playerName: 'System', actionType: 'preview_error' }
        );
      }
    }

    onPreviewConsumed?.();
  }, [initialPreview, dataService, notificationService, onPreviewConsumed]);

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
  // Use prop if provided, otherwise check URL params
  const [viewPlayerIdFromState, setViewPlayerId] = useState<string | null>(() => {
    if (viewPlayerId) {
      return viewPlayerId;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const playerIdParam = urlParams.get('playerId');
    if (playerIdParam) {
    }
    return playerIdParam;
  });

  // Use prop if provided, otherwise use state
  const effectiveViewPlayerId = viewPlayerId || viewPlayerIdFromState;

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

  // Subscribe to auto-action events — show modals for life events
  useEffect(() => {
    const unsubscribe = stateService.subscribeToAutoActions((event: AutoActionEvent) => {
      if (event.type === 'life_event' && event.cardId) {
        const card = dataService.getCardById(event.cardId);
        const effects: DiceResultEffect[] = [{
          type: 'card_draw',
          description: `🎲 Life Event: ${event.cardName || 'Unknown'}`,
          cardType: 'L',
          cardIds: [event.cardId]
        }];
        if (card?.description) {
          effects.push({
            type: 'info',
            description: card.description
          });
        }
        setDiceResult({
          effects,
          summary: event.message,
          spaceName: event.spaceName
        });
        setIsDiceResultModalOpen(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [stateService, dataService]);

  // Persist visiblePanels to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('game-display-settings', JSON.stringify(visiblePanels));
    } catch (error) {
      console.error('Failed to save display settings:', error);
    }
  }, [visiblePanels]);

  // Back-button modal interception
  const historyPushedRef = useRef(false);
  const anyModalOpen = isRulesModalOpen || isNegotiationModalOpen || isCardDetailsModalOpen ||
    isDiceResultModalOpen || isSpaceExplorerVisible || isGameLogVisible || isDictionaryOpen;

  useEffect(() => {
    if (anyModalOpen && !historyPushedRef.current) {
      window.history.pushState({ modalOpen: true }, '');
      historyPushedRef.current = true;
    }
    if (!anyModalOpen) {
      historyPushedRef.current = false;
    }
  }, [anyModalOpen]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Close the topmost modal in priority order
      if (isDiceResultModalOpen) {
        setIsDiceResultModalOpen(false);
      } else if (isCardDetailsModalOpen) {
        setIsCardDetailsModalOpen(false);
        setSelectedCard(null);
      } else if (isNegotiationModalOpen) {
        setIsNegotiationModalOpen(false);
      } else if (isRulesModalOpen) {
        setIsRulesModalOpen(false);
      } else if (isDictionaryOpen) {
        closeDictionary();
      } else if (isSpaceExplorerVisible) {
        setIsSpaceExplorerVisible(false);
      } else if (isGameLogVisible) {
        setIsGameLogVisible(false);
      } else {
        // No modal was open, let the browser handle it normally
        return;
      }
      // Reset ref so next open pushes a fresh entry
      historyPushedRef.current = false;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDiceResultModalOpen, isCardDetailsModalOpen, isNegotiationModalOpen, isRulesModalOpen, isDictionaryOpen, isSpaceExplorerVisible, isGameLogVisible, closeDictionary]);

  // Helper function to determine if a player panel should be shown
  const shouldShowPlayerPanel = (playerId: string): boolean => {
    // In mobile view mode, don't show any panels in the main area
    if (effectiveViewPlayerId) return false;

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
  const shouldShowAnyPanel = !effectiveViewPlayerId && players.length > 0 &&
    players.some(p => shouldShowPlayerPanel(p.id));

  // If no panels should be shown, hide the entire panel column
  // This includes PLAY phase when all players are connected on their own devices
  const hidePanelColumn = !effectiveViewPlayerId && !shouldShowAnyPanel;

  // Add responsive CSS styles to document head
  React.useEffect(() => {
    const styleId = 'game-layout-responsive';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .game-interface-responsive {
          display: grid;
          grid-template-columns: minmax(340px, 480px) 1fr;
          grid-template-rows: auto 1fr;
          column-gap: 8px;
          row-gap: 4px;
          height: 100vh;
          width: 100vw;
          padding: 4px;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* Player panels container - scrollable flex layout, hidden scrollbar */
        .game-player-panels {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 0;
          flex: 1 1 0;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .game-player-panels::-webkit-scrollbar {
          display: none;
        }

        /* Individual player panel - content flows naturally, parent scrolls */
        .game-player-panel-item {
          flex: 0 0 auto;
          min-height: 120px;
        }

        @media (max-width: 1920px) {
          .game-interface-responsive {
            grid-template-columns: minmax(320px, 440px) 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1600px) {
          .game-interface-responsive {
            grid-template-columns: minmax(280px, 380px) 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1400px) {
          .game-interface-responsive {
            grid-template-columns: minmax(260px, 350px) 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1200px) {
          .game-interface-responsive {
            grid-template-columns: minmax(220px, 300px) 1fr;
            column-gap: 4px;
            padding: 2px;
          }
        }

        @media (max-width: 768px) {
          .game-interface-responsive {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto 1fr auto !important;
            column-gap: 0;
            padding: 0;
            height: 100dvh;
            min-height: -webkit-fill-available;
          }
          .game-interface-responsive > * {
            grid-column: 1 !important;
          }
        }

        @media (max-width: 480px) {
          .game-interface-responsive {
            padding: 0;
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

  // Handlers for rules modal (toggle behavior)
  const handleToggleRulesModal = () => {
    if (isRulesModalOpen) {
      setIsRulesModalOpen(false);
    } else {
      // Close any open side panels when modal opens
      setIsMovementPathVisible(false);
      setIsSpaceExplorerVisible(false);
      setIsRulesModalOpen(true);
    }
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
    }
  };

  // Handlers for space explorer panel
  const handleToggleSpaceExplorer = () => {
    setIsSpaceExplorerVisible(!isSpaceExplorerVisible);
  };

  // Handler for pull-to-refresh (mobile view)
  const handlePullToRefresh = async () => {
    await stateService.loadStateFromServer();
  };

  // Handler for game log toggle
  const handleToggleGameLog = () => setIsGameLogVisible(prev => !prev);

  // Handler for glossary toggle
  const handleToggleGlossary = () => {
    if (isDictionaryOpen) {
      closeDictionary();
    } else {
      openDictionary();
    }
  };

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

  // Handler to clear a player's device connection status (allows re-scanning QR code)
  const handleClearDeviceType = (playerId: string) => {
    stateService.updatePlayer({ id: playerId, deviceType: undefined });
  };

  // Action handlers for ActionCenterPanel
  const handleRollDice = async () => {
    if (!currentPlayerId) return;
    setJustUsedTryAgain(false); // Clear Try Again flag when player takes action
    setIsProcessingTurn(true);

    // Haptic feedback for dice roll
    haptics.diceRoll();

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
      haptics.error(); // Error haptic feedback
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

      // If Try Again indicates turn should advance, move to next player
      if (result.success && result.shouldAdvanceTurn) {
        setJustUsedTryAgain(true); // Set flag to skip auto-movement
        const nextResult = await turnService.endTurnWithMovement(true, true);
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
      try {
        await turnService.placePlayersOnStartingSpaces();

        // Start the first turn (this will create snapshots and mark as initialized)
        const currentState = stateService.getGameState();
        if (currentState.currentPlayerId) {
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
        gridTemplateRows: gamePhase === 'PLAY'
          ? (isGameLogVisible ? 'auto 1fr auto auto' : 'auto 1fr auto')
          : '1fr auto',
        // Dynamic columns: 1 column if no panels shown, 2 columns otherwise
        gridTemplateColumns: hidePanelColumn ? '1fr' : undefined
      }}
    >
      {/* Mobile View Mode - Show only player panel */}
      {effectiveViewPlayerId && gamePhase === 'PLAY' && (
        <div
          style={{
            gridColumn: '1 / -1',
            gridRow: '1',
            background: colors.background.light,
            border: `3px solid ${colors.primary.main}`,
            borderRadius: '8px',
            overflowY: 'hidden',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}
        >
          <PullToRefresh onRefresh={handlePullToRefresh}>
            {players.find(p => p.id === effectiveViewPlayerId) ? (
              <PlayerPanelWrapper
                gameServices={gameServices}
                playerId={effectiveViewPlayerId}
                onToggleSpaceExplorer={handleToggleSpaceExplorer}
                onToggleMovementPath={handleToggleMovementPath}
                isSpaceExplorerVisible={isSpaceExplorerVisible}
                isMovementPathVisible={isMovementPathVisible}
                onTryAgain={handleTryAgain}
                playerNotification={playerNotifications[effectiveViewPlayerId]}
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
          </PullToRefresh>
        </div>
      )}

      {/* Desktop View Mode - Show progress, player panels (filtered), and board */}
      {!effectiveViewPlayerId && (
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
                gameRulesService={gameRulesService}
                onToggleGameLog={handleToggleGameLog}
                onOpenRulesModal={handleToggleRulesModal}
                onOpenDisplaySettings={() => setIsDisplaySettingsOpen(true)}
                collapsed={isProgressCollapsed}
                onToggleCollapsed={() => setIsProgressCollapsed(prev => !prev)}
                isRulesOpen={isRulesModalOpen}
                isGameLogOpen={isGameLogVisible}
                isDisplaySettingsOpen={isDisplaySettingsOpen}
                onToggleGlossary={handleToggleGlossary}
                isGlossaryOpen={isDictionaryOpen}
              />
            </div>
          )}

          {/* Left Panel - Player Panels (only show during PLAY if at least one panel is visible) */}
          {gamePhase === 'PLAY' && !hidePanelColumn && (
            <div
              style={{
                gridColumn: '1',
                gridRow: '2',
                background: colors.background.light,
                border: `3px solid ${colors.primary.main}`,
                borderRadius: '8px',
                padding: '4px',
                overflow: 'hidden',
                position: 'relative',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div className="game-player-panels">
                {(() => {
                  // Show panels only for players not connected on their own device
                  const visiblePlayers = players.filter(p => shouldShowPlayerPanel(p.id));
                  const hasMultipleLocal = visiblePlayers.length > 1;
                  return visiblePlayers.map(player => {
                    const isCurrentPlayer = player.id === currentPlayerId;
                    // When multiple local panels, collapse non-current players to a mini bar
                    if (hasMultipleLocal && !isCurrentPlayer) {
                      return (
                        <div key={player.id} className="game-player-panel-item" style={{
                          flex: '0 0 auto',
                          minHeight: 'auto',
                          padding: '6px 10px',
                          background: '#f5f5f5',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.8rem',
                          color: '#757575',
                        }}>
                          <span style={{ fontSize: '1.2rem' }}>{player.avatar}</span>
                          <span style={{ fontWeight: 'bold', color: '#343a40' }}>{player.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>📍 {player.currentSpace}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={player.id} className="game-player-panel-item">
                        <PlayerPanelWrapper
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
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* BoardV3 - data-driven snake map with SVG arrows during PLAY phase */}
          {gamePhase === 'PLAY' && (
            <div style={{ gridColumn: hidePanelColumn ? '1 / -1' : '2', gridRow: '2', overflow: 'hidden' }}>
              <BoardV3
                currentPlayerId={currentPlayerId}
                players={players}
              />
            </div>
          )}
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
          viewPlayerId={effectiveViewPlayerId || undefined}
          onStartGame={async (players, settings) => {

            // Build game mode settings if Same Starting Point is enabled
            const gameModeSettings = settings.sameStartingPoint ? {
              gameMode: 'SAME_START' as const,
              startingMode: settings.startingMode,
              startingHand: settings.preSelectedHand
            } : undefined;

            // Actually start the game through StateService
            stateService.startGame(gameModeSettings);

            // Place players on starting spaces (no effects processing)
            try {
              await turnService.placePlayersOnStartingSpaces();

              // Start the first turn (this will create snapshots and mark as initialized)
              const currentState = stateService.getGameState();
              if (currentState.currentPlayerId) {
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
      
      {/* Space Explorer Panel */}
      {isSpaceExplorerVisible && (
        <SpaceExplorerPanel
          isVisible={isSpaceExplorerVisible}
          onToggle={handleToggleSpaceExplorer}
          initialSelectedSpace={previewSpaceId}
        />
      )}

      {/* Display Settings Modal */}
      {isDisplaySettingsOpen && (
        <GameDisplaySettings
          players={players}
          visiblePanels={visiblePanels}
          onTogglePanel={handleTogglePanel}
          onClose={() => setIsDisplaySettingsOpen(false)}
          onClearDeviceType={handleClearDeviceType}
        />
      )}

      {/* Beta notice footer - only show if not in mobile view */}
      {!effectiveViewPlayerId && (
        <div style={{
          gridColumn: '1 / -1',
          gridRow: isGameLogVisible ? '4' : '3',
          backgroundColor: colors.primary.light,
          padding: '0.25rem 0.5rem',
          fontSize: '0.7rem',
          color: colors.text.secondary,
          textAlign: 'center',
          borderTop: `1px solid ${colors.primary.main}`,
          flexShrink: 0,
        }}>
          <strong>Beta</strong> - <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
        </div>
      )}

      <PlayerDebug />
    </div>
  );
}
