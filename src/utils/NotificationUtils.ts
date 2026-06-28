// src/utils/NotificationUtils.ts

import { NotificationContent } from '../services/NotificationService';
import { FormatUtils } from './FormatUtils';
import { NOTIF } from '../constants/uiStrings';
import { DiceFeedbackEffect } from './buttonFormatting';
import { getCardTypeName } from './cardTypeNames';

export class NotificationUtils {

  // Dice Roll Notifications
  static createDiceRollNotification(_diceValue: number, effects: DiceFeedbackEffect[], playerName: string): NotificationContent {
    // Voice rule: real-life card-type label ("2 Work Packages" not "2 W").
    // fb:7a99da1a/004dc390.
    const effectSummary = effects.map(effect => {
      switch (effect.type) {
        case 'cards':
          return `${effect.cardCount ?? 1} ${getCardTypeName(effect.cardType || '', effect.cardCount ?? 1)}`;
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

    // Voice rule (no game language): the short badge must not be the raw die
    // number — show a neutral confirmation; outcomes live in medium/detailed.
    return {
      short: '✓',
      medium: NOTIF.diceRollMedium(effectSummary),
      detailed: NOTIF.diceRollDetailed(playerName, effectSummary),
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
          // Voice rule: real-life label, no raw letter codes. fb:7a99da1a/004dc390.
          return `+${effect.cardCount ?? 1} ${getCardTypeName(effect.cardType || '', effect.cardCount ?? 1)}`;
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