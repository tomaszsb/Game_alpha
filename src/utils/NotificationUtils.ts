// src/utils/NotificationUtils.ts

import { NotificationContent } from '../services/NotificationService';
import { FormatUtils } from './FormatUtils';
import { NOTIF } from '../constants/uiStrings';
import { DiceFeedbackEffect } from './buttonFormatting';

export class NotificationUtils {

  // Dice Roll Notifications
  static createDiceRollNotification(diceValue: number, effects: DiceFeedbackEffect[], playerName: string): NotificationContent {
    const effectSummary = effects.map(effect => {
      switch (effect.type) {
        case 'cards':
          return `${effect.cardCount} ${effect.cardType}`;
        case 'money': {
          const v = effect.value ?? 0;
          return v > 0 ? `+$${Math.abs(v)}` : `-$${Math.abs(v)}`;
        }
        case 'time': {
          const v = effect.value ?? 0;
          return v > 0 ? `+${v}d` : `-${v}d`;
        }
        default:
          return effect.type;
      }
    }).join(', ');

    return {
      short: `${diceValue}`,
      medium: NOTIF.diceRollMedium(diceValue, effectSummary),
      detailed: NOTIF.diceRollDetailed(playerName, diceValue, effectSummary),
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

  // Card Play Notifications
  static createCardPlayNotification(cardName: string, effects: DiceFeedbackEffect[], playerName: string): NotificationContent {
    const effectSummary = effects.map(effect => {
      switch (effect.type) {
        case 'money': {
          const v = effect.value ?? 0;
          return v > 0
            ? `+${FormatUtils.formatMoney(Math.abs(v))}`
            : `-${FormatUtils.formatMoney(Math.abs(v))}`;
        }
        case 'cards':
          return `+${effect.cardCount} ${effect.cardType}`;
        case 'time': {
          const v = effect.value ?? 0;
          return v > 0 ? `+${v} days` : `-${v} days`;
        }
        default:
          return effect.description || effect.type;
      }
    }).join(', ');

    return {
      short: NOTIF.cardPlayShort,
      medium: NOTIF.cardPlayMedium(cardName, effectSummary),
      detailed: NOTIF.cardPlayDetailed(playerName, cardName, effectSummary),
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