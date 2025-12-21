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

// Helper to format effect action for user-friendly display
function formatEffectAction(effectType: string, effectAction?: string): string {
  // Card draw actions - show specific card type
  if (effectType === 'cards' && effectAction) {
    const cardTypeMap: { [key: string]: string } = {
      'draw_b': 'Draw B Card (Bank Funding)',
      'draw_i': 'Draw I Card (Investor Deal)',
      'draw_w': 'Draw W Card (Work Package)',
      'draw_l': 'Draw L Card (Life Event)',
      'draw_e': 'Draw E Card (Event)',
      'draw_n': 'Draw N Card (Negotiation)'
    };
    return cardTypeMap[effectAction] || `Draw ${effectAction.replace('draw_', '').toUpperCase()} Card`;
  }

  // Other effect types
  const typeMap: { [key: string]: string } = {
    'dice': 'Roll Dice',
    'cards': 'Draw Card',
    'money': 'Get Funding',
    'time': 'Time Action',
    'movement': 'Select Destination'
  };
  return typeMap[effectType] || effectType.replace('_', ' ');
}

// Build tooltip showing remaining actions with specific details
function buildRemainingActionsTooltip(
  gameServices: IServiceContainer,
  playerId: string,
  gameState: {
    requiredActions: number;
    completedActionCount: number;
    completedActions: { diceRoll?: string; manualActions: { [key: string]: string } };
  }
): string {
  const remaining = gameState.requiredActions - gameState.completedActionCount;

  if (remaining <= 0) {
    return 'Ready to end turn';
  }

  // Get player and space effects for more specific tooltip
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) {
    return `Complete ${remaining} action${remaining > 1 ? 's' : ''} to end turn`;
  }

  // Get space effects and filter for manual actions
  const spaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const manualEffects = spaceEffects.filter(effect => effect.trigger_type === 'manual');

  // Find pending actions (not yet completed)
  const pendingActions: string[] = [];

  for (const effect of manualEffects) {
    // Create the effect key as used in completedActions
    const effectKey = effect.effect_action
      ? `${effect.effect_type}:${effect.effect_action}`
      : effect.effect_type;

    // Check if this effect has been completed - support case-insensitive matching
    const completedKeys = Object.keys(gameState.completedActions.manualActions);
    const isCompleted = completedKeys.some(
      key => key === effectKey ||
             key === effect.effect_type ||
             key.startsWith(effect.effect_type + ':') ||
             key.toLowerCase() === effectKey.toLowerCase() ||
             key.toLowerCase().startsWith(effect.effect_type.toLowerCase() + ':')
    );

    if (!isCompleted) {
      // Use effect description if available, otherwise format the action
      const actionLabel = effect.description || formatEffectAction(effect.effect_type, effect.effect_action);
      pendingActions.push(actionLabel);
    }
  }

  // If no specific actions found, show generic message
  if (pendingActions.length === 0) {
    return `Complete ${remaining} action${remaining > 1 ? 's' : ''} to end turn`;
  }

  // Show count and list of pending actions
  if (remaining === 1 || pendingActions.length === 1) {
    return `Complete: ${pendingActions.join(', ')}`;
  }
  return `Complete ${remaining} actions: ${pendingActions.join(', ')}`;
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
      // Build tooltip showing choice AND other pending actions
      console.log('🟡 [NextStepButton] Pending choice - DISABLED');
      const choiceTypeMap: { [key: string]: string } = {
        'MOVEMENT': 'Select a destination',
        'CARD_REPLACEMENT': 'Complete card replacement',
        'CARD_GIVE': 'Select card to give opponent',
        'CARD_SELECTION': 'Select a card',
        'DICE_OUTCOME': 'Roll the dice first'
      };
      const choiceHint = choiceTypeMap[awaitingChoice.type] || 'Complete current action';

      // Get other pending actions besides the choice
      const otherActionsTooltip = buildRemainingActionsTooltip(gameServices, playerId, gameState);

      // Combine choice hint with other actions if there are more
      let tooltip = choiceHint;
      if (otherActionsTooltip && !otherActionsTooltip.includes('Ready to end turn') &&
          !otherActionsTooltip.includes('0 action')) {
        // Add other pending actions to the tooltip
        tooltip = `${choiceHint}; Also: ${otherActionsTooltip}`;
      }

      return {
        visible: true,
        label: 'End Turn',
        disabled: true,
        tooltip
      };
    }
  }

  // Check 2: Are all required actions complete?
  if (!actionsComplete) {
    console.log('🟡 [NextStepButton] Actions not complete - DISABLED');
    const tooltip = buildRemainingActionsTooltip(gameServices, playerId, gameState);
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
    console.log('🔴 [NextStepButton] handleNextStep CLICKED - stepState.action:', stepState.action);
    setIsLoading(true);

    // Create a timeout promise to prevent indefinite "Processing..." state
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('End turn timed out after 15 seconds'));
      }, 15000);
    });

    try {
      if (stepState.action === 'end-turn') {
        console.log('🔴 [NextStepButton] Calling turnService.endTurnWithMovement()...');
        // Race between the actual operation and a timeout
        await Promise.race([
          gameServices.turnService.endTurnWithMovement(),
          timeoutPromise
        ]);
        console.log('🔴 [NextStepButton] endTurnWithMovement() completed successfully');
      } else {
        console.log('🔴 [NextStepButton] stepState.action is NOT end-turn, skipping');
      }
    } catch (err) {
      console.error('Next step error:', err);
      // Show error notification if available
      if (gameServices.notificationService) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const player = gameServices.stateService.getPlayer(playerId);
        gameServices.notificationService.notify(
          {
            short: 'Error',
            medium: `⚠️ ${errorMessage}`,
            detailed: `End turn failed: ${errorMessage}. Try refreshing the page if the issue persists.`
          },
          {
            playerId: playerId,
            playerName: player?.name || 'Unknown',
            actionType: 'error',
            notificationDuration: 5000
          }
        );
      }
    } finally {
      console.log('🔴 [NextStepButton] handleNextStep FINALLY - setting loading false');
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