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
      return {
        visible: true,
        label: 'End Turn',
        disabled: true,
        tooltip: 'Complete current action first'
      };
    }
  }

  // Check 2: Are all required actions complete?
  if (!actionsComplete) {
    console.log('🟡 [NextStepButton] Actions not complete - DISABLED');
    return {
      visible: true,
      label: 'End Turn',
      disabled: true,
      tooltip: `Complete required actions (${gameState.completedActionCount}/${gameState.requiredActions})`
    };
  }

  // All checks passed - button is enabled
  console.log('🟢 [NextStepButton] All actions complete - ENABLED');
  return {
    visible: true,
    label: 'End Turn',
    disabled: false,
    action: 'end-turn' as const
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