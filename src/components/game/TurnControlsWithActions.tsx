// src/components/game/TurnControlsWithActions.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
// Modal imports removed - using persistent GameLog instead
import { Player } from '../../types/DataTypes';
import { GamePhase, ActionLogEntry } from '../../types/StateTypes';
import { Choice } from '../../types/CommonTypes';
import { formatActionDescription } from '../../utils/actionLogFormatting';
import { formatManualEffectButton, formatDiceRollButton, getManualEffectButtonStyle, formatDiceRollFeedback } from '../../utils/buttonFormatting';
import { NotificationUtils } from '../../utils/NotificationUtils';

interface TurnControlsWithActionsProps {
  // Game state data - currentPlayer is guaranteed to exist by higher-level architecture
  currentPlayer: Player;
  gamePhase: GamePhase;
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
  
  // Action handlers
  onRollDice: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onManualEffect: (effectType: string) => Promise<void>;
  onNegotiate: () => Promise<void>;
  onAutomaticFunding?: () => Promise<void>;
  
  // Legacy props (can be removed in future cleanup)
  onOpenNegotiationModal: () => void;
  playerId: string;
  playerName: string;
}

/**
 * Merged Turn Controls and Action Log - buttons are replaced by action entries when completed
 * Enhanced with smooth transitions and improved responsiveness.
 */
export function TurnControlsWithActions({
  // Game state data
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
  // Action handlers
  onRollDice,
  onEndTurn,
  onManualEffect,
  onNegotiate,
  onAutomaticFunding,
  // Legacy props
  onOpenNegotiationModal,
  playerId,
  playerName
}: TurnControlsWithActionsProps): JSX.Element {
  const { dataService, stateService, choiceService, notificationService } = useGameContext();

  // Track transition states for smooth animations
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Add custom scrollbar styles and smooth animations
  useEffect(() => {
    const styleId = 'turn-controls-scrollbar-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Custom scrollbar for turn controls */
        .turn-controls-scrollable::-webkit-scrollbar {
          width: 8px;
        }
        .turn-controls-scrollable::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .turn-controls-scrollable::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .turn-controls-scrollable::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        /* Firefox scrollbar */
        .turn-controls-scrollable {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
        }

        /* Smooth animation keyframes */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Movement choice state
  const [currentChoice, setCurrentChoice] = useState<Choice | null>(null);
  const [movementChoice, setMovementChoice] = useState<Choice | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  // Subscribe to state changes for movement choices
  useEffect(() => {
    console.log('🔥 TurnControlsWithActions: Setting up movement choice subscription');
    const unsubscribe = stateService.subscribe((gameState) => {
      // This console log can stay, it's useful for debugging
      console.log('🔥 TurnControlsWithActions: Received state update', {
        awaitingChoice: gameState.awaitingChoice?.type || null,
        currentPlayer: gameState.currentPlayerId
      });

      // REFINED GUARD: Only block this specific state update during a move
      if (!gameState.isMoving) {
        setCurrentChoice(gameState.awaitingChoice);
      }

      // Cache movement choice and movement state to prevent UI flicker
      setIsMoving(gameState.isMoving);

      if (gameState.awaitingChoice?.type === 'MOVEMENT') {
        setMovementChoice(gameState.awaitingChoice);
        console.log('🔥 TurnControlsWithActions: Movement choice detected!', {
          choice: gameState.awaitingChoice,
          options: gameState.awaitingChoice.options
        });
      } else if (!gameState.isMoving && !gameState.awaitingChoice) {
        setMovementChoice(null);
      }
    });

    // Initialize with current state
    const gameState = stateService.getGameState();
    setCurrentChoice(gameState.awaitingChoice);

    return unsubscribe;
  }, [stateService]);

  // Handle movement choice selection (just selects destination, doesn't move yet)
  const handleMovementChoice = (destinationId: string) => {
    // Toggle selection (clicking same destination deselects it)
    const newSelection = selectedDestination === destinationId ? null : destinationId;
    setSelectedDestination(newSelection);

    console.log(`🎯 TurnControlsWithActions: Selected destination: ${newSelection || 'none'}`);
  };

  // Handle End Turn with movement confirmation
  const handleEndTurnWithMovement = async () => {
    // If a destination is selected, confirm the movement first
    if (selectedDestination && movementChoice) {
      // Find the option label for the selected destination
      const selectedOption = movementChoice.options.find(option => option.id === selectedDestination);
      const optionLabel = selectedOption?.label || selectedDestination;

      // Send notification for the movement choice
      if (notificationService) {
        notificationService.notify(
          {
            short: `→ ${optionLabel}`,
            medium: `🚶 Moving to ${optionLabel}`,
            detailed: `${currentPlayer.name} chose to move to ${optionLabel}`
          },
          {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            actionType: `move_${selectedDestination}`
          }
        );
      }

      // Resolve the choice with the choice service
      if (choiceService) {
        choiceService.resolveChoice(movementChoice.id, selectedDestination);
      }

      // Set the player's move intent so endTurnWithMovement knows where to move
      if (stateService) {
        stateService.setPlayerMoveIntent(currentPlayer.id, selectedDestination);
      }

      console.log(`✅ TurnControlsWithActions: Confirmed movement to: ${selectedDestination}`);

      // Clear the selection
      setSelectedDestination(null);
    }

    // Proceed with end turn
    await onEndTurn();
  };





  // Helper function to evaluate effect conditions
  const evaluateEffectCondition = (condition: string | undefined): boolean => {
    if (!condition || condition === 'always') return true;

    const conditionLower = condition.toLowerCase();
    
    // Project scope conditions
    const projectScope = currentPlayer.projectScope || 0;
    if (conditionLower === 'scope_le_4m') {
      return projectScope <= 4000000;
    }
    if (conditionLower === 'scope_gt_4m') {
      return projectScope > 4000000;
    }
    
    // Add other conditions as needed
    // For now, default to true for unknown conditions
    return true;
  };

  // Check for available manual effects with condition evaluation
  // Filter out 'turn' effects since they duplicate the regular End Turn button
  const allSpaceEffects = dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
  const manualEffects = allSpaceEffects
    .filter(effect => effect.trigger_type === 'manual')
    .filter(effect => effect.effect_type !== 'turn') // Exclude turn effects to avoid duplicate end turn buttons
    .filter(effect => evaluateEffectCondition(effect.condition));

  // Manual effects are properly detected and handled

  // Check if negotiation is available on current space
  const canNegotiate = dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType)?.can_negotiate === true;

  // Calculate space time cost that will be spent when rolling dice/taking actions
  const getSpaceTimeCost = (): number => {
    const spaceEffects = dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
    return spaceEffects
      .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add' && evaluateEffectCondition(effect.condition))
      .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);
  };

  const spaceTimeCost = getSpaceTimeCost();

  // All players can take actions when it's their turn - currentPlayer is guaranteed to exist
  const isCurrentPlayersTurn = true;

  // Check if the current space requires manual dice roll
  const currentSpaceData = dataService.getSpaceByName(currentPlayer.currentSpace);
  const requiresManualDiceRoll = currentSpaceData?.config?.requires_dice_roll ?? true; // Default to true if not specified

  const canRollDice = gamePhase === 'PLAY' && isCurrentPlayersTurn &&
                     !isProcessingTurn && !isProcessingArrival && !hasPlayerRolledDice && !hasPlayerMovedThisTurn &&
                     // Allow dice rolling during movement choices - they're independent actions
                     !(awaitingChoice && movementChoice?.type !== 'MOVEMENT') &&
                     currentPlayer.currentSpace !== 'OWNER-FUND-INITIATION' && // Hide dice roll for funding space
                     requiresManualDiceRoll; // Hide dice roll for automatic dice roll spaces
  const canEndTurn = gamePhase === 'PLAY' && isCurrentPlayersTurn &&
                    !isProcessingTurn && !isProcessingArrival && hasPlayerRolledDice && actionCounts.completed >= actionCounts.required &&
                    (!movementChoice || selectedDestination !== null); // Allow end turn if destination is selected


  // Get contextual dice roll button text using centralized utility
  const getDiceRollButtonText = (): string => {
    const diceEffects = dataService.getDiceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
    const spaceEffects = dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
    const diceOutcome = dataService.getDiceOutcome(currentPlayer.currentSpace, currentPlayer.visitType);

    return formatDiceRollButton(
      currentPlayer.currentSpace,
      currentPlayer.visitType,
      diceEffects,
      spaceEffects,
      diceOutcome
    );
  };

  // Format action description now handled by shared utility

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px', backgroundColor: colors.white, borderRadius: '6px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors.text.primary }}>
          🎮 Turn Controls & Actions
        </div>
      </div>


      {/* Feedback Message Display */}
      {feedbackMessage && (
        <div style={{ padding: '6px 12px', backgroundColor: colors.info.light, border: `2px solid ${colors.info.main}`, borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', color: colors.info.dark, textAlign: 'center' }}>
          💡 {feedbackMessage}
        </div>
      )}

      {/* Movement Choice Buttons - Enhanced with smooth transitions */}
      {movementChoice && (
        <div style={{
          padding: '8px',
          backgroundColor: colors.primary.bg,
          border: `2px solid ${colors.primary.main}`,
          borderRadius: '8px',
          transition: 'all 0.3s ease-in-out',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: colors.primary.main,
            textAlign: 'center',
            marginBottom: '6px',
            transition: 'color 0.2s ease'
          }}>
            🚶 Choose Your Destination
          </div>
          {movementChoice.options.map((option, index) => {
            const feedbackKey = `move_${option.id}`;
            const feedback = buttonFeedback[feedbackKey];

            // If feedback exists, show completion message instead of button
            if (feedback) {
              return (
                <div
                  key={index}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    margin: '2px 0',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    backgroundColor: colors.success.light,
                    color: colors.success.text,
                    border: `1px solid ${colors.success.main}`,
                    borderRadius: '6px',
                    textAlign: 'center',
                    transition: 'all 0.3s ease-in-out',
                    animation: 'slideIn 0.3s ease-out'
                  }}
                >
                  ✅ {feedback}
                </div>
              );
            }

            // Show button with selection state
            const isSelected = selectedDestination === option.id;

            return (
              <button
                key={index}
                onClick={() => handleMovementChoice(option.id)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  margin: '2px 0',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: isSelected ? colors.success.main : colors.primary.main,
                  color: colors.white,
                  border: isSelected ? `3px solid ${colors.white}` : 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxSizing: 'border-box',
                  boxShadow: isSelected ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = colors.primary.dark;
                  }
                  e.currentTarget.style.transform = isSelected ? 'scale(1.02) translateY(-2px)' : 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = colors.primary.main;
                  }
                  e.currentTarget.style.transform = isSelected ? 'scale(1.02)' : 'scale(1)';
                  e.currentTarget.style.boxShadow = isSelected ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              >
                🎯 {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Combined Controls and Actions */}
      <div
        className="turn-controls-scrollable"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '6px',
          backgroundColor: colors.secondary.bg,
          borderRadius: '6px',
          border: `1px solid ${colors.secondary.border}`,
          maxHeight: '400px',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >

        {/* Roll Dice - show button if can roll, otherwise show completed action */}
        {canRollDice ? (
          <button
            onClick={onRollDice}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: colors.white,
              backgroundColor: colors.success.main,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px'
            }}
          >
            <span>🎲</span>
            <span>{getDiceRollButtonText()}</span>
          </button>
        ) : hasPlayerRolledDice && completedActions.diceRoll && !completedActions.manualActions.dice_roll_chance ? (
          // Show local completion message with immediate feedback (only if no manual dice action)
          <div style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: colors.secondary.light, borderRadius: '4px', color: colors.secondary.main }}>
            ✅ {completedActions.diceRoll}
          </div>
        ) : hasPlayerRolledDice && !completedActions.manualActions.funding && !completedActions.manualActions.dice_roll_chance ? (
          // Fallback if no local message available and no manual dice action
          <div style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: colors.secondary.light, borderRadius: '4px', color: colors.secondary.main }}>
            ✅ Dice rolled - check game log
          </div>
        ) : null}

        {/* Automatic Funding for OWNER-FUND-INITIATION space */}
        {currentPlayer.currentSpace === 'OWNER-FUND-INITIATION' && isCurrentPlayersTurn && !hasPlayerRolledDice && !isProcessingTurn && (
          <button
            onClick={() => onAutomaticFunding && onAutomaticFunding()}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: colors.white,
              backgroundColor: colors.info.main,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px'
            }}
          >
            <span>💰</span>
            <span>Get Funding</span>
          </button>
        )}

        {/* Manual Effect Buttons - show if available, replace with actions when completed */}
        {isCurrentPlayersTurn && manualEffects.map((effect, index) => {
          // Use centralized button formatting
          const { text: buttonText, icon: buttonIcon } = formatManualEffectButton(effect);

          // Check if THIS specific effect type has been completed (not global flag)
          const isThisEffectCompleted = completedActions.manualActions[effect.effect_type] !== undefined;
          // Manual actions should be available alongside movement choices - they're independent
          // Only disable if already completed or if currently processing a manual action
          const isButtonDisabled = isThisEffectCompleted;

          // Check if effect should be displayed based on state
          
          if (!isButtonDisabled) {
            // Show active button
            return (
              <button
                key={index}
                onClick={() => onManualEffect(effect.effect_type)}
                style={getManualEffectButtonStyle(isButtonDisabled, colors)}
              >
                <span>{buttonIcon}</span>
                <span>{buttonText}</span>
              </button>
            );
          } else if (isThisEffectCompleted) {
            // Button is disabled because effect is completed - show completion message
            const completionMessage = completedActions.manualActions[effect.effect_type];
            if (completionMessage) {
              return (
                <div key={`completed-${index}`} style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: colors.secondary.light, borderRadius: '4px', color: colors.secondary.main }}>
                  ✅ {completionMessage.replace('Manual Action: ', '')}
                </div>
              );
            } else {
              // Fallback for completed effects without specific message
              return (
                <div key={`completed-${index}`} style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: colors.secondary.light, borderRadius: '4px', color: colors.secondary.main }}>
                  ✅ Manual action completed - check game log
                </div>
              );
            }
          } else {
            // Button is disabled because turn is processing - don't show anything
            // This handles cases like movement choices being active
            return null;
          }
          return null;
        })}

        {/* Automatic Funding Results - show funding completion message */}
        {isCurrentPlayersTurn && completedActions.manualActions.funding && (
          <div style={{
            padding: '4px 8px',
            fontSize: '10px',
            backgroundColor: colors.success.light,
            borderRadius: '4px',
            color: colors.success.text,
            fontWeight: 'bold'
          }}>
            ✅ {completedActions.manualActions.funding}
          </div>
        )}

        {/* Space and Time Effects are now shown in the GameLog component */}

        {/* Try Again Button - show if re-roll is available on current space */}
        {isCurrentPlayersTurn && canNegotiate && (
          <button
            onClick={onNegotiate}
            disabled={isProcessingTurn || isProcessingArrival}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: !isProcessingTurn ? colors.white : colors.secondary.main,
              backgroundColor: !isProcessingTurn ? colors.warning.main : colors.secondary.light,
              border: 'none',
              borderRadius: '4px',
              cursor: !isProcessingTurn ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
              transform: isProcessingTurn ? 'scale(0.95)' : 'scale(1)',
              opacity: isProcessingTurn ? 0.7 : 1,
            }}
          >
            <span>🔄</span>
            <span>Try Again</span>
          </button>
        )}

        {/* End Turn - always show for current player, but disable when actions incomplete */}
        {isCurrentPlayersTurn && (
          <button
            onClick={canEndTurn ? handleEndTurnWithMovement : undefined}
            disabled={!canEndTurn}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: canEndTurn ? colors.white : colors.secondary.main,
              backgroundColor: canEndTurn ? colors.success.main : colors.secondary.light,
              border: 'none',
              borderRadius: '4px',
              cursor: canEndTurn ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              opacity: canEndTurn ? 1 : 0.7
            }}
          >
            <span>⏹️</span>
            <span>End Turn ({actionCounts.completed}/{actionCounts.required})</span>
          </button>
        )}
      </div>

      {/* Modals removed - using persistent GameLog instead */}
    </div>
  );
}