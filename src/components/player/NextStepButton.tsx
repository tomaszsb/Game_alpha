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
function getNextStepState(gameServices: IServiceContainer, playerId: string): NextStepState {
  const turnService = gameServices.turnService;
  const stateService = gameServices.stateService; // Add stateService
  const gameRulesService = gameServices.gameRulesService; // Add gameRulesService
  const currentPlayer = stateService.getPlayer(playerId);

  if (!currentPlayer || !gameRulesService.isPlayerTurn(playerId)) {
    return { visible: false };
  }

  // If there's a pending choice, disable the button
  if (stateService.getGameState().awaitingChoice) {
    return {
      visible: true,
      label: 'End Turn',
      disabled: true,
      tooltip: 'Complete current action first'
    };
  }

  // NextStepButton only handles "End Turn" - roll actions are handled by section buttons
  // (ProjectScopeSection, FinancesSection, TimeSection, CardsSection each have their own roll buttons)
  if (turnService.canEndTurn(playerId)) {
    return {
      visible: true,
      label: 'End Turn',
      disabled: false,
      action: 'end-turn'
    };
  }

  // If player cannot end turn yet, hide the button (actions must be completed first)
  return { visible: false };
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
    const unsubscribe = gameServices.stateService.subscribe(() => {
      setStepState(getNextStepState(gameServices, playerId));
    });

    // Initialize state
    setStepState(getNextStepState(gameServices, playerId));

    return unsubscribe;
  }, [gameServices, playerId]);


  const handleNextStep = async () => {
    setIsLoading(true);
    try {
      if (stepState.action === 'end-turn') {
        await gameServices.turnService.endTurn();
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