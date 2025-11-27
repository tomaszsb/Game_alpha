// src/utils/NotificationUtils.ts

import { NotificationContent } from '../services/NotificationService';
import { FormatUtils } from './FormatUtils';

export class NotificationUtils {

  // Dice Roll Notifications
  static createDiceRollNotification(diceValue: number, effects: any[], playerName: string): NotificationContent {
    const effectSummary = effects.map(effect => {
      switch (effect.type) {
        case 'cards':
          return `${effect.cardCount} ${effect.cardType}`;
        case 'money':
          return effect.value > 0 ? `+$${Math.abs(effect.value)}` : `-$${Math.abs(effect.value)}`;
        case 'time':
          return effect.value > 0 ? `+${effect.value}d` : `-${effect.value}d`;
        default:
          return effect.type;
      }
    }).join(', ');

    return {
      short: `${diceValue}`,
      medium: `🎲 Rolled ${diceValue} → ${effectSummary || 'No effects'}`,
      detailed: `${playerName} rolled a ${diceValue}${effectSummary ? ` and gained: ${effectSummary}` : ''}`
    };
  }

  // Manual Action Notifications
  static createManualActionNotification(effectType: string, outcomes: string[], playerName: string): NotificationContent {
    const outcomeText = outcomes.join(', ') || 'Action completed';

    return {
      short: `✓`,
      medium: `⚙️ ${outcomeText}`,
      detailed: `${playerName} completed manual action (${effectType}): ${outcomeText}`
    };
  }

  // Try Again Notifications
  static createTryAgainNotification(success: boolean, timePenalty: number, spaceName: string, playerName: string): NotificationContent {
    if (success) {
      return {
        short: `Try Again`,
        medium: `🔄 Try Again → ${timePenalty}d penalty`,
        detailed: `${playerName} used Try Again on ${spaceName}. Reverted to previous state with ${timePenalty} day penalty`
      };
    } else {
      return {
        short: `Failed`,
        medium: `❌ Try Again failed`,
        detailed: `${playerName} failed to use Try Again on ${spaceName}. No snapshot available`
      };
    }
  }

  // Funding Notifications
  static createFundingNotification(amount: number, spaceName: string, playerName: string): NotificationContent {
    const isOwnerSpace = spaceName === 'OWNER-FUND-INITIATION';
    const sourceText = isOwnerSpace ? 'Owner seed money' : 'Automatic funding';

    return {
      short: `💰`,
      medium: `💰 ${sourceText}`,
      detailed: `${playerName} received ${FormatUtils.formatMoney(amount)} from ${sourceText.toLowerCase()} at ${spaceName}`
    };
  }

  // Card Play Notifications
  static createCardPlayNotification(cardName: string, effects: any[], playerName: string): NotificationContent {
    const effectSummary = effects.map(effect => {
      switch (effect.type) {
        case 'money':
          return effect.value > 0 ? `+${FormatUtils.formatMoney(Math.abs(effect.value))}` : `-${FormatUtils.formatMoney(Math.abs(effect.value))}`;
        case 'cards':
          return `+${effect.cardCount} ${effect.cardType}`;
        case 'time':
          return effect.value > 0 ? `+${effect.value} days` : `-${effect.value} days`;
        default:
          return effect.description || effect.type;
      }
    }).join(', ');

    return {
      short: `✓ Card`,
      medium: `🃏 Played ${cardName}${effectSummary ? ` → ${effectSummary}` : ''}`,
      detailed: `${playerName} played card "${cardName}"${effectSummary ? ` with effects: ${effectSummary}` : ''}`
    };
  }

  // Turn End Notifications
  static createTurnEndNotification(turnNumber: number, playerName: string): NotificationContent {
    return {
      short: `Turn End`,
      medium: `🏁 Turn ${turnNumber} ended`,
      detailed: `${playerName} ended turn ${turnNumber}`
    };
  }

  // Movement Notifications
  static createMovementNotification(fromSpace: string, toSpace: string, playerName: string): NotificationContent {
    return {
      short: `Moved`,
      medium: `🚶 Moved to ${toSpace}`,
      detailed: `${playerName} moved from ${fromSpace} to ${toSpace}`
    };
  }

  // Error Notifications
  static createErrorNotification(action: string, error: string, playerName: string): NotificationContent {
    return {
      short: `Error`,
      medium: `❌ ${action} failed`,
      detailed: `${playerName} encountered error during ${action}: ${error}`
    };
  }

  // Generic Success Notifications
  static createSuccessNotification(action: string, details: string, playerName: string): NotificationContent {
    return {
      short: `✓`,
      medium: `✅ ${action} complete`,
      detailed: `${playerName} successfully completed ${action}${details ? `: ${details}` : ''}`
    };
  }
}