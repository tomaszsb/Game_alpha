// src/utils/ErrorNotifications.ts

/**
 * ErrorNotifications Utility
 *
 * Provides standardized, user-friendly error messages for common game operations.
 * Each error type returns three levels of detail:
 * - short: Brief emoji + text (for toasts)
 * - medium: One-line explanation (for inline errors)
 * - detailed: Full explanation with context (for error modals)
 */

export interface ErrorMessage {
  short: string;
  medium: string;
  detailed: string;
}

export const ErrorNotifications = {
  /**
   * Insufficient funds error
   */
  insufficientFunds: (required: number, available: number): ErrorMessage => ({
    short: '❌ Not enough money',
    medium: `Need $${required.toLocaleString()}, have $${available.toLocaleString()}`,
    detailed: `Cannot complete action. Required: $${required.toLocaleString()}, Available: $${available.toLocaleString()}. Consider drawing funding cards or taking a loan.`
  }),

  /**
   * Insufficient time error
   */
  insufficientTime: (required: number, available: number): ErrorMessage => ({
    short: '❌ Not enough time',
    medium: `Need ${required} days, have ${available} days`,
    detailed: `Cannot complete action. Required: ${required} days, Available: ${available} days. You may need to manage your schedule more efficiently.`
  }),

  /**
   * Invalid movement error
   */
  invalidMove: (destination: string, reason?: string): ErrorMessage => ({
    short: '❌ Invalid move',
    medium: `Cannot move to ${destination}`,
    detailed: `Movement to ${destination} is not available from your current space${reason ? `: ${reason}` : ''}. Check available destinations.`
  }),

  /**
   * Card play failed
   */
  cardPlayFailed: (cardName: string, reason: string): ErrorMessage => ({
    short: '❌ Cannot play card',
    medium: `${cardName} cannot be played`,
    detailed: `Cannot play ${cardName}: ${reason}. Check card requirements and restrictions.`
  }),

  /**
   * Card draw failed
   */
  cardDrawFailed: (cardType: string, reason?: string): ErrorMessage => ({
    short: '❌ Card draw failed',
    medium: `Cannot draw ${cardType} card`,
    detailed: `Unable to draw ${cardType} card${reason ? `: ${reason}` : ''}. Check if the deck has cards available.`
  }),

  /**
   * Card discard failed
   */
  cardDiscardFailed: (cardName: string, reason?: string): ErrorMessage => ({
    short: '❌ Discard failed',
    medium: `Cannot discard ${cardName}`,
    detailed: `Unable to discard ${cardName}${reason ? `: ${reason}` : ''}. Verify you own this card.`
  }),

  /**
   * Turn action failed
   */
  turnActionFailed: (action: string, reason?: string): ErrorMessage => ({
    short: '❌ Action failed',
    medium: `Cannot ${action}`,
    detailed: `Unable to complete ${action}${reason ? `: ${reason}` : ''}. Please check requirements and try again.`
  }),

  /**
   * Invalid turn error
   */
  notYourTurn: (currentPlayer: string): ErrorMessage => ({
    short: '❌ Not your turn',
    medium: `It's ${currentPlayer}'s turn`,
    detailed: `Cannot perform action. It is currently ${currentPlayer}'s turn. Please wait for your turn.`
  }),

  /**
   * Dice roll failed
   */
  diceRollFailed: (reason?: string): ErrorMessage => ({
    short: '❌ Roll failed',
    medium: 'Cannot roll dice',
    detailed: `Unable to roll dice${reason ? `: ${reason}` : ''}. Check if you've already rolled this turn.`
  }),

  /**
   * Effect processing error
   */
  effectProcessingFailed: (effectType: string, reason?: string): ErrorMessage => ({
    short: '❌ Effect failed',
    medium: `${effectType} effect failed`,
    detailed: `Failed to process ${effectType} effect${reason ? `: ${reason}` : ''}. This may be a bug - please report it.`
  }),

  /**
   * Choice selection error
   */
  choiceSelectionFailed: (reason?: string): ErrorMessage => ({
    short: '❌ Choice failed',
    medium: 'Cannot make choice',
    detailed: `Unable to process your choice${reason ? `: ${reason}` : ''}. Please try selecting again.`
  }),

  /**
   * Movement service error
   */
  movementFailed: (reason?: string): ErrorMessage => ({
    short: '❌ Movement failed',
    medium: 'Cannot move player',
    detailed: `Unable to complete movement${reason ? `: ${reason}` : ''}. Check available destinations and requirements.`
  }),

  /**
   * Resource operation error
   */
  resourceOperationFailed: (operation: string, resource: string, reason?: string): ErrorMessage => ({
    short: `❌ ${operation} failed`,
    medium: `Cannot ${operation} ${resource}`,
    detailed: `Failed to ${operation} ${resource}${reason ? `: ${reason}` : ''}. Verify resource availability.`
  }),

  /**
   * Negotiation error
   */
  negotiationFailed: (action: string, reason?: string): ErrorMessage => ({
    short: '❌ Negotiation failed',
    medium: `Cannot ${action}`,
    detailed: `Unable to ${action} negotiation${reason ? `: ${reason}` : ''}. Check negotiation status.`
  }),

  /**
   * Try Again not available
   */
  tryAgainNotAvailable: (reason?: string): ErrorMessage => ({
    short: '❌ Try Again unavailable',
    medium: 'Cannot use Try Again',
    detailed: `Try Again feature is not available${reason ? `: ${reason}` : ''}. You may have already used it on this space or there's no saved state.`
  }),

  /**
   * Data loading error
   */
  dataLoadFailed: (dataType: string): ErrorMessage => ({
    short: '❌ Load failed',
    medium: `Cannot load ${dataType}`,
    detailed: `Failed to load ${dataType} data. Please refresh the page. If the problem persists, check your connection.`
  }),

  /**
   * Generic action error
   */
  genericError: (action: string, error?: Error): ErrorMessage => ({
    short: '❌ Error',
    medium: `${action} failed`,
    detailed: `An error occurred while ${action}${error ? `: ${error.message}` : ''}. Please try again.`
  }),

  /**
   * Network error
   */
  networkError: (): ErrorMessage => ({
    short: '❌ Network error',
    medium: 'Connection lost',
    detailed: 'Unable to connect to the server. Please check your internet connection and try again.'
  }),

  /**
   * State validation error
   */
  invalidState: (reason: string): ErrorMessage => ({
    short: '❌ Invalid state',
    medium: 'Game state error',
    detailed: `The game is in an invalid state: ${reason}. This may require refreshing the page.`
  })
};

/**
 * Helper function to get error level based on context
 */
export function getErrorLevel(context: 'toast' | 'inline' | 'modal'): keyof ErrorMessage {
  switch (context) {
    case 'toast':
      return 'short';
    case 'inline':
      return 'medium';
    case 'modal':
      return 'detailed';
    default:
      return 'medium';
  }
}

/**
 * Helper function to format error for display
 */
export function formatError(
  errorMessage: ErrorMessage,
  context: 'toast' | 'inline' | 'modal' = 'inline'
): string {
  return errorMessage[getErrorLevel(context)];
}
