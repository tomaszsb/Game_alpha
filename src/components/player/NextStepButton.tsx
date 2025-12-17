import React, { useState } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';

/**
 * Props for the NextStepButton component.
 */
interface NextStepButtonProps {
  /** Game services container providing access to all game services. */
  gameServices: IServiceContainer;
  /** The ID of the player for whom the button is displayed. */
  playerId: string;
}

interface NextStepState {
  visible: boolean;
  label?: string;
  disabled?: boolean;
  action?: 'end-turn';
  tooltip?: string;
}

// Helper to format action type for display
function formatActionType(actionType: string): string {
  const formatMap: { [key: string]: string } = {
    'dice': 'Roll Dice',
    'cards_manual': 'Draw Card',
    'money_manual': 'Get Funding',
    'time_manual': 'Time Action',
    'movement': 'Select Destination'
  };
  return formatMap[actionType] || actionType.replace('_manual', '').replace('_', ' ');
}

// Build tooltip showing remaining actions
function buildRemainingActionsTooltip(
  gameState: {
    requiredActions: number;
    completedActionCount: number;
    availableActionTypes?: string[];
    hasPlayerRolledDice?: boolean;
    completedActions: { manualActions: { [key: string]: string } };
  }
): string {
  const remaining = gameState.requiredActions - gameState.completedActionCount;

  if (remaining <= 0) {
    return 'Ready to end turn';
  }

  const availableTypes = gameState.availableActionTypes || [];

  // Determine which actions are still pending
  const pendingActions: string[] = [];

  for (const actionType of availableTypes) {
    if (actionType === 'dice' && !gameState.hasPlayerRolledDice) {
      pendingActions.push(formatActionType('dice'));
    } else if (actionType.endsWith('_manual')) {
      // Check if this manual action type has been completed
      const baseType = actionType.replace('_manual', '');
      const isCompleted = Object.keys(gameState.completedActions.manualActions).some(
        key => key === baseType || key.startsWith(baseType + ':')
      );
      if (!isCompleted) {
        pendingActions.push(formatActionType(actionType));
      }
    }
  }

  // Format tooltip with count and action types
  if (pendingActions.length === 0) {
    return `Complete ${remaining} action${remaining > 1 ? 's' : ''} to end turn`;
  }

  // Show count and list of pending actions
  const uniqueActions = [...new Set(pendingActions)]; // Remove duplicates
  if (remaining === 1) {
    return `Complete: ${uniqueActions.join(', ')}`;
  }
  return `Complete ${remaining} action${remaining > 1 ? 's' : ''}: ${uniqueActions.join(', ')}`;
}

// Function to determine the state of the Next Step Button
// LOGIC:
// - VISIBLE: Always show on your turn (so player knows it exists)
// - DISABLED: If actions not complete OR blocking choice pending
// - ENABLED: Only when all required actions are complete
function getNextStepState(gameServices: IServiceContainer, playerId: string): NextStepState {
  const stateService = gameServices.stateService;
  const gameRulesService = gameServices.gameRulesService;
  const currentPlayer = stateService.getPlayer(playerId);

  // Not your turn? Button is hidden
  if (!currentPlayer || !gameRulesService.isPlayerTurn(playerId)) {
    return { visible: false };
  }

  const gameState = stateService.getGameState();
  const awaitingChoice = gameState.awaitingChoice;
  const actionsComplete = gameState.requiredActions <= gameState.completedActionCount;

  // Debug logging
  console.log('🔵 [NextStepButton] getNextStepState:', {
    playerId,
    awaitingChoice: awaitingChoice?.type || null,
    moveIntent: currentPlayer.moveIntent,
    requiredActions: gameState.requiredActions,
    completedActions: gameState.completedActionCount,
    availableActionTypes: gameState.availableActionTypes,
    actionsComplete
  });

  // Check 1: Is there a blocking choice?
  if (awaitingChoice) {
    // MOVEMENT choices with a selected destination don't block
    if (awaitingChoice.type === 'MOVEMENT' && currentPlayer.moveIntent) {
      // Fall through to action completion check
    } else {
      // Other pending choices block - show disabled with tooltip
      console.log('🟡 [NextStepButton] Pending choice - DISABLED');
      const choiceTypeMap: { [key: string]: string } = {
        'MOVEMENT': 'Select a destination',
        'CARD_REPLACEMENT': 'Complete card replacement',
        'CARD_SELECTION': 'Select a card',
        'DICE_OUTCOME': 'Roll the dice first'
      };
      const choiceHint = choiceTypeMap[awaitingChoice.type] || 'Complete current action';
      return {
        visible: true,
        label: 'End Turn',
        disabled: true,
        tooltip: choiceHint
      };
    }
  }

  // Check 2: Are all required actions complete?
  if (!actionsComplete) {
    console.log('🟡 [NextStepButton] Actions not complete - DISABLED');
    const tooltip = buildRemainingActionsTooltip(gameState);
    return {
      visible: true,
      label: 'End Turn',
      disabled: true,
      tooltip
    };
  }

  // All checks passed - button is enabled
  console.log('🟢 [NextStepButton] All actions complete - ENABLED');
  return {
    visible: true,
    label: 'End Turn',
    disabled: false,
    action: 'end-turn' as const,
    tooltip: 'All actions complete - click to end your turn'
  };
}

/**
 * NextStepButton Component
 *
 * A persistent, context-aware button that guides the player through the primary game loop actions.
 * Its label, visibility, and enabled state dynamically change based on the current game state
 * and the actions available to the player (e.g., "Roll to Move", "End Turn").
 *
 * @param {NextStepButtonProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered NextStepButton component, or null if not visible.
 */
export function NextStepButton({ gameServices, playerId }: NextStepButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [stepState, setStepState] = useState<NextStepState>({ visible: false });

  // Subscribe to game state changes to update button state
  React.useEffect(() => {
    const updateState = () => {
      const newState = getNextStepState(gameServices, playerId);
      console.log('🟣 [NextStepButton] Setting stepState:', newState);
      setStepState(newState);
    };

    const unsubscribe = gameServices.stateService.subscribe(updateState);

    // Initialize state
    updateState();

    return unsubscribe;
  }, [gameServices, playerId]);

  // Log render decision
  console.log(`🟠 [NextStepButton] RENDER for ${playerId} - stepState.visible:`, stepState.visible, 'stepState:', stepState);


  const handleNextStep = async () => {
    setIsLoading(true);
    try {
      if (stepState.action === 'end-turn') {
        await gameServices.turnService.endTurnWithMovement();
      }
    } catch (err) {
      console.error('Next step error:', err);
      // Error notification handled by NotificationService (if implemented)
      // For now, log to console
    } finally {
      setIsLoading(false);
    }
  };

  if (!stepState.visible) return null;

  return (
    <button
      className="next-step-button"
      onClick={handleNextStep}
      disabled={stepState.disabled || isLoading}
      aria-label={stepState.label}
      title={stepState.tooltip}
    >
      {isLoading ? 'Processing...' : stepState.label}
    </button>
  );
}