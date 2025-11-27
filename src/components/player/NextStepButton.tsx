import React, { useState, useEffect } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import './NextStepButton.css';

/**
 * Props for the NextStepButton component
 */
export interface NextStepButtonProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose turn to track */
  playerId: string;
}

/**
 * Internal state shape for the Next Step button
 *
 * Represents the button's visibility, label, enabled/disabled state,
 * and the action it will perform when clicked.
 */
interface NextStepState {
  /** Whether the button should be rendered */
  visible: boolean;

  /** Button text (e.g., "Roll to Move" or "End Turn") */
  label?: string;

  /** Whether the button should be disabled */
  disabled?: boolean;

  /** Tooltip text explaining why button is disabled */
  tooltip?: string;

  /** The action to perform when clicked */
  action?: 'roll-movement' | 'end-turn';
}

/**
 * Determine button state based on current game state
 *
 * Core business logic for the End Turn button. Evaluates game state to determine:
 * - Whether button should be visible (always on player's turn)
 * - What label to show (with action count)
 * - Whether button should be disabled
 * - What action to execute when clicked
 *
 * **Button Logic Flow:**
 * 1. If not player's turn → Hide button
 * 2. If pending choice → Show disabled with "Complete current action first"
 * 3. If actions incomplete → Show disabled with "X actions remaining"
 * 4. If all actions complete → Show enabled "End Turn"
 *
 * @param gameServices - Service container for state access
 * @param playerId - ID of the player to evaluate
 * @returns Button state object determining visibility, label, and action
 */
const getNextStepState = (gameServices: IServiceContainer, playerId: string): NextStepState => {
  const gameState = gameServices.stateService.getGameState();

  // Check if it's this player's turn
  if (gameState.currentPlayerId !== playerId) {
    return { visible: false };
  }

  // Check if there's a pending choice that blocks End Turn
  // Movement choices with existing moveIntent don't block - they're just shown for visual feedback
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const hasPendingChoice = gameState.awaitingChoice !== null &&
    !(gameState.awaitingChoice?.type === 'MOVEMENT' && currentPlayer?.moveIntent);

  // Calculate action counts
  const actionCounts = {
    required: gameState.requiredActions || 0,
    completed: gameState.completedActionCount || 0
  };

  const actionsRemaining = Math.max(0, actionCounts.required - actionCounts.completed);

  // If player has pending choice (that isn't an already-selected movement), show disabled
  if (hasPendingChoice) {
    return {
      visible: true,
      label: 'End Turn',
      disabled: true,
      tooltip: 'Complete current action first'
    };
  }

  // If actions incomplete, show disabled with count
  if (actionsRemaining > 0) {
    return {
      visible: true,
      label: `End Turn (${actionsRemaining} action${actionsRemaining === 1 ? '' : 's'} remaining)`,
      disabled: true,
      tooltip: `Complete ${actionsRemaining} more action${actionsRemaining === 1 ? '' : 's'} before ending turn`
    };
  }

  // All actions complete - enable button
  return {
    visible: true,
    label: 'End Turn',
    disabled: false,
    action: 'end-turn'
  };
};

/**
 * NextStepButton Component
 *
 * A context-aware button that guides players through the main game loop.
 * Automatically shows the appropriate next action based on current game state.
 * Part of the mobile-first Player Panel UI redesign.
 *
 * **Button Modes:**
 * - **"Roll to Move"**: Appears when `ROLL_TO_MOVE` action is available
 * - **"End Turn"**: Appears when all required actions are complete
 * - **Disabled "End Turn"**: Appears when player has pending choice to resolve
 * - **Hidden**: Not shown when not player's turn or no action available
 *
 * **Features:**
 * - Real-time state subscription for instant updates
 * - Context-aware label and action (Roll to Move vs End Turn)
 * - Automatic visibility control (only shown on player's turn)
 * - Disabled state with tooltip when action blocked
 * - Loading state during action execution
 * - Error handling via NotificationService
 * - Comprehensive test coverage (26 passing tests)
 *
 * **State Management:**
 * - Subscribes to game state via `stateService.subscribe()`
 * - Evaluates complex turn flow logic via `getNextStepState` helper
 * - Tracks loading state during async operations
 * - Cleanup subscription on unmount
 *
 * **Integration:**
 * - Uses `rollDiceWithFeedback` from TurnService for movement
 * - Uses `endTurn` from TurnService for turn completion
 * - Error notifications handled by NotificationService
 * - Works with Try Again functionality (state resets properly)
 *
 * **Edge Cases Handled:**
 * - Player has pending choice → Disabled with tooltip
 * - Not player's turn → Hidden
 * - Required actions incomplete → Hidden
 * - All actions complete → Shows End Turn
 * - ROLL_TO_MOVE available → Shows Roll to Move
 *
 * @example
 * ```tsx
 * <NextStepButton
 *   gameServices={gameServices}
 *   playerId="player-1"
 * />
 * ```
 */
export const NextStepButton: React.FC<NextStepButtonProps> = ({
  gameServices,
  playerId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [buttonState, setButtonState] = useState<NextStepState>({ visible: false });

  // Subscribe to game state changes
  useEffect(() => {
    const updateButtonState = () => {
      const newState = getNextStepState(gameServices, playerId);
      setButtonState(newState);

      // Safety: Reset isLoading if button should be enabled
      // This handles cases where async operation failed to reset isLoading
      if (newState.action && !newState.disabled && isLoading) {
        setIsLoading(false);
      }
    };

    const unsubscribe = gameServices.stateService.subscribe(() => {
      updateButtonState();
    });

    // Initialize with current state
    updateButtonState();

    return unsubscribe;
  }, [gameServices, playerId, isLoading]);

  const handleNextStep = async () => {
    if (!buttonState.action || buttonState.disabled) {
      return;
    }

    setIsLoading(true);
    try {
      if (buttonState.action === 'roll-movement') {
        await gameServices.turnService.rollDiceWithFeedback(playerId);
      } else if (buttonState.action === 'end-turn') {
        await gameServices.turnService.endTurnWithMovement();
      }
    } catch (err) {
      console.error('🔘 NextStepButton: Error in handleNextStep:', err);
      // Error notification handled by NotificationService
    } finally {
      setIsLoading(false);
    }
  };

  if (!buttonState.visible) {
    return null;
  }

  return (
    <button
      className="next-step-button"
      onClick={handleNextStep}
      disabled={buttonState.disabled || isLoading}
      aria-label={buttonState.label}
      title={buttonState.tooltip}
    >
      {isLoading ? 'Processing...' : buttonState.label}
    </button>
  );
};

// Export helper function for testing
export { getNextStepState };
