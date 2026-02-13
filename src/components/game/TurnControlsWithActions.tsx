// src/components/game/TurnControlsWithActions.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
// Modal imports removed - using persistent GameLog instead
import { Player } from '../../types/DataTypes';
import { GamePhase, ActionLogEntry } from '../../types/StateTypes';
import { Choice } from '../../types/CommonTypes';
import { formatActionDescription } from '../../utils/actionLogFormatting';
import { formatManualEffectButton, formatDiceRollButton, getManualEffectButtonStyle, formatDiceRollFeedback, getManualEffectTooltip, getDiceRollTooltip, getMovementChoiceTooltip, getEndTurnTooltip } from '../../utils/buttonFormatting';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { Tooltip } from '../common/Tooltip';

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
  const { dataService, stateService, choiceService, notificationService, movementService, turnService } = useGameContext();

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
    const unsubscribe = stateService.subscribe((gameState) => {
      // This console log can stay, it's useful for debugging

      // REFINED GUARD: Only block this specific state update during a move
      if (!gameState.isMoving) {
        setCurrentChoice(gameState.awaitingChoice);
      }

      // Cache movement choice and movement state to prevent UI flicker
      setIsMoving(gameState.isMoving);

      if (gameState.awaitingChoice?.type === 'MOVEMENT') {
        setMovementChoice(gameState.awaitingChoice);
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
  const currentSpaceContent = dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
  const canNegotiate = currentSpaceContent?.can_negotiate === true;

  // Context-sensitive End Turn label for negotiable spaces
  const getEndTurnLabel = (): string => {
    if (!canNegotiate || !currentSpaceContent?.title) return 'End Turn';
    const title = currentSpaceContent.title.toLowerCase();
    if (title.includes('owner')) return 'Agree with Owner';
    if (title.includes('fee')) return 'Accept Fee';
    if (title.includes('scope')) return 'Accept Scope';
    if (title.includes('fund')) return 'Accept Funding';
    if (title.includes('exam') || title.includes('audit') || title.includes('review')) return 'Accept Result';
    if (title.includes('contractor') || title.includes('change order')) return 'Accept Terms';
    return 'Accept & End Turn';
  };
  const endTurnLabel = getEndTurnLabel();

  // Calculate space time cost that will be spent when rolling dice/taking actions
  const getSpaceTimeCost = (): number => {
    const spaceEffects = dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
    return spaceEffects
      .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add' && evaluateEffectCondition(effect.condition))
      .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);
  };

  const spaceTimeCost = getSpaceTimeCost();

  // Helper to get single destination when no movement choice exists
  // This handles fixed-destination spaces where E card effects cleared the awaitingChoice
  const getSingleDestination = (): { destination: string; label: string } | null => {
    // Only check if no movement choice and player hasn't moved
    if (movementChoice || hasPlayerMovedThisTurn) return null;

    try {
      // Get valid moves from movement service
      const validMoves = movementService.getValidMoves(currentPlayer.id);

      // Only return if exactly 1 destination (fixed movement)
      if (validMoves.length === 1) {
        const dest = validMoves[0];
        const spaceContent = dataService.getSpaceContent(dest, 'First');
        const label = spaceContent?.title || dest;
        return { destination: dest, label };
      }
    } catch (error) {
      console.error('Error getting single destination:', error);
    }
    return null;
  };

  const singleDestination = getSingleDestination();

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

  // Debug logging for dice roll button visibility - expanded for problematic spaces
  const debugSpaces = ['PM-DECISION-CHECK', 'CHEAT-BYPASS', 'REG-DOB-PLAN-EXAM', 'REG-DOB-PROF-CERT', 'CON-ISSUES'];
  if (debugSpaces.includes(currentPlayer.currentSpace) && isCurrentPlayersTurn) {
    // Also log manual effects for debugging
  }
  // Allow end turn if: dice rolled OR space doesn't require dice roll
  const diceRequirementMet = hasPlayerRolledDice || !requiresManualDiceRoll;

  // Use moveIntent from player state (set by PlayerPanel) instead of local selectedDestination
  // This syncs the destination selection across components
  const hasDestinationSelected = selectedDestination !== null || currentPlayer.moveIntent !== undefined;

  const canEndTurn = gamePhase === 'PLAY' && isCurrentPlayersTurn &&
                    !isProcessingTurn && !isProcessingArrival && diceRequirementMet && actionCounts.completed >= actionCounts.required &&
                    (!movementChoice || hasDestinationSelected); // Allow end turn if destination is selected

  // Comprehensive End Turn button state logging
  if (isCurrentPlayersTurn) {
  }

  // Get reason why End Turn button is disabled
  const getEndTurnDisabledReason = (): string => {
    if (canEndTurn) return "Click to end your turn";
    if (gamePhase !== 'PLAY') return `Game phase: ${gamePhase} - Cannot end turn yet`;
    if (!isCurrentPlayersTurn) return "Wait for your turn";
    if (isProcessingTurn) return "Turn is processing - please wait";
    if (isProcessingArrival) return "Arrival is processing - please wait";
    if (!diceRequirementMet) return "You must roll the dice first";
    if (actionCounts.completed < actionCounts.required) {
      const remaining = actionCounts.required - actionCounts.completed;
      return `Complete ${remaining} more action(s) before ending turn (${actionCounts.completed}/${actionCounts.required})`;
    }
    if (movementChoice && !hasDestinationSelected) {
      return "Select a destination to move before ending turn";
    }
    return "Cannot end turn - check requirements";
  };

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
            padding: '8px',
            backgroundColor: colors.info.light,
            borderRadius: '6px',
            border: `2px solid ${colors.info.main}`,
            marginBottom: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: colors.info.main,
              textAlign: 'center',
              marginBottom: '4px'
            }}>
              📍 Select ONE Destination to Continue
            </div>
            <div style={{
              fontSize: '9px',
              color: colors.text.secondary,
              textAlign: 'center'
            }}>
              Choose your next space - you can only select one path
            </div>
          </div>
          {movementChoice.options.map((option, index) => {
            const feedbackKey = `move_${option.id}`;
            const feedback = buttonFeedback[feedbackKey];

            // Calculate time cost for destination space (First visit by default since we're moving there)
            const getDestinationTimeCost = (spaceName: string): number => {
              // Check if player has visited this space before
              const visitType = currentPlayer.visitedSpaces?.includes(spaceName) ? 'Subsequent' : 'First';
              const destEffects = dataService.getSpaceEffects(spaceName, visitType as 'First' | 'Subsequent');
              return destEffects
                .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add')
                .reduce((total, effect) => total + (parseInt(String(effect.effect_value)) || 0), 0);
            };
            const destTimeCost = getDestinationTimeCost(String(option.id));

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
            // Get tooltip for this destination
            const destinationTooltip = getMovementChoiceTooltip(option.id);

            return (
              <Tooltip key={index} content={destinationTooltip.tooltip} context={destinationTooltip.context} position="right">
                <button
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
                  {destTimeCost > 0 && (
                    <span style={{ marginLeft: '8px', opacity: 0.9, fontSize: '10px' }}>
                      ⏱️ {destTimeCost}d
                    </span>
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Single Destination Fallback - shows when E card effect cleared movementChoice but there's only 1 destination */}
      {singleDestination && !movementChoice && !hasPlayerMovedThisTurn && (
        <div style={{
          padding: '8px',
          backgroundColor: colors.primary.bg,
          border: `2px solid ${colors.primary.main}`,
          borderRadius: '8px',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div style={{
            padding: '8px',
            backgroundColor: colors.info.light,
            borderRadius: '6px',
            border: `2px solid ${colors.info.main}`,
            marginBottom: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: colors.info.main,
              textAlign: 'center'
            }}>
              📍 Ready to Continue
            </div>
          </div>
          <button
            onClick={() => {
              // Set the destination and trigger movement via End Turn
              setSelectedDestination(singleDestination.destination);

              // Create a synthetic movement choice for the End Turn handler
              const syntheticChoice: Choice = {
                id: `single-dest-${Date.now()}`,
                type: 'MOVEMENT',
                prompt: 'Continue to next space',
                options: [{ id: singleDestination.destination, label: singleDestination.label }],
                playerId: currentPlayer.id
              };
              setMovementChoice(syntheticChoice);

              // Notify about the move
              if (notificationService) {
                notificationService.notify(
                  {
                    short: `→ ${singleDestination.label}`,
                    medium: `🚶 Moving to ${singleDestination.label}`,
                    detailed: `${currentPlayer.name} is moving to ${singleDestination.label}`
                  },
                  {
                    playerId: currentPlayer.id,
                    playerName: currentPlayer.name,
                    actionType: `move_${singleDestination.destination}`
                  }
                );
              }

              // Set move intent and trigger end turn
              stateService.setPlayerMoveIntent(currentPlayer.id, singleDestination.destination);
              onEndTurn();
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: colors.success.main,
              color: colors.white,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.success.dark || '#16a34a';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.success.main;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }}
          >
            ➡️ Continue to {singleDestination.label}
          </button>
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
          (() => {
            const diceEffects = dataService.getDiceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
            const spaceEffects = dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
            const diceTooltip = getDiceRollTooltip(diceEffects, spaceEffects);
            return (
              <Tooltip content={diceTooltip.tooltip} context={diceTooltip.context} position="top">
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
              </Tooltip>
            );
          })()
        ) : hasPlayerRolledDice && completedActions.diceRoll ? (
          // Show local completion message with immediate feedback
          <div style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: colors.secondary.light, borderRadius: '4px', color: colors.secondary.main }}>
            ✅ {completedActions.diceRoll}
          </div>
        ) : hasPlayerRolledDice && !completedActions.manualActions.funding ? (
          // Fallback if no local message available
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
        {isCurrentPlayersTurn && manualEffects.length > 0 && !manualEffects.every(e => {
          // Check by compound key or effect_action for accurate completion detection
          const compoundKey = `${e.effect_type}:${e.effect_action}`;
          return completedActions.manualActions[compoundKey] !== undefined ||
                 completedActions.manualActions[e.effect_action] !== undefined;
        }) && (
          <div style={{
            padding: '8px',
            backgroundColor: colors.warning.light,
            borderRadius: '6px',
            border: `2px solid ${colors.warning.main}`,
            marginBottom: '4px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: colors.warning.main,
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⚠️ Manual Actions Required
            </div>
            <div style={{
              fontSize: '9px',
              color: colors.text.secondary,
              marginBottom: '6px'
            }}>
              Complete these actions before ending turn
            </div>
          </div>
        )}
        {isCurrentPlayersTurn && manualEffects.map((effect, index) => {
          // Use centralized button formatting
          const { text: buttonText, icon: buttonIcon } = formatManualEffectButton(effect);

          // Check if THIS specific effect has been completed using compound key or effect_action
          // This allows multiple effects with the same effect_type (e.g., two "cards" effects at BANK-FUND-REVIEW)
          const compoundKey = `${effect.effect_type}:${effect.effect_action}`;
          const isThisEffectCompleted =
            completedActions.manualActions[compoundKey] !== undefined ||
            completedActions.manualActions[effect.effect_action] !== undefined;
          // Manual actions should be available alongside movement choices - they're independent
          // Only disable if already completed or if currently processing a manual action
          const isButtonDisabled = isThisEffectCompleted;

          // Check if effect should be displayed based on state
          
          if (!isButtonDisabled) {
            // Get tooltip for this effect
            const effectTooltip = getManualEffectTooltip(effect);
            // Show active button with standard styling (matching other action buttons)
            return (
              <Tooltip key={index} content={effectTooltip.tooltip} context={effectTooltip.context} position="top">
                <button
                  onClick={() => onManualEffect(effect.effect_type)}
                  style={getManualEffectButtonStyle(isButtonDisabled, colors)}
                >
                  <span>{buttonIcon}</span>
                  <span>{buttonText}</span>
                </button>
              </Tooltip>
            );
          } else if (isThisEffectCompleted) {
            // Button is disabled because effect is completed - show completion message
            // Use compound key or effect_action for accurate lookup
            const completionMessage = completedActions.manualActions[compoundKey] ||
                                     completedActions.manualActions[effect.effect_action];
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
        {/* Try Again Button has been moved to PlayerPanel next to End Turn button */}

        {/* End Turn - always show for current player, but disable when actions incomplete */}
        {isCurrentPlayersTurn && (
          (() => {
            const endTurnTooltip = getEndTurnTooltip(canEndTurn, getEndTurnDisabledReason());
            return (
              <Tooltip content={endTurnTooltip.tooltip} context={endTurnTooltip.context} position="top">
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
                  <span>{endTurnLabel} ({actionCounts.completed}/{actionCounts.required})</span>
                </button>
              </Tooltip>
            );
          })()
        )}
      </div>

      {/* Modals removed - using persistent GameLog instead */}
    </div>
  );
}
