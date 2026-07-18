// src/services/ToastWriter.ts
// Domain-event stage 3 (docs/design/domain-events.md). Subscribes to the
// typed GameEvent bus and fires the toast half of each collapsed
// dual-channel moment via the existing notificationService.notify() —
// toasts dispatch immediately regardless of turn-transaction state (unlike
// LogWriter, which lets loggingService's session buffering handle Try Again).
import { IStateService, INotificationService } from '../types/ServiceContracts';
import { GameEvent } from '../types/GameEvents';

export class ToastWriter {
  constructor(
    private stateService: IStateService,
    private notificationService: INotificationService,
  ) {
    this.stateService.subscribeToGameEvents(this.handleEvent);
  }

  private handleEvent = (event: GameEvent): void => {
    switch (event.type) {
      case 'turn_committed':
        this.notificationService.notify(
          {
            short: 'Turn Ended',
            medium: `🏁 Turn ${event.turn} ended`,
            detailed: `${event.playerName} ended Turn ${event.turn} at ${event.spaceName}`,
          },
          { playerId: event.playerId, playerName: event.playerName, actionType: 'endTurn', notificationDuration: 3000 }
        );
        break;

      case 'turn_discarded': {
        const dayWord = event.timePenalty !== 1 ? 'days' : 'day';
        this.notificationService.notify(
          {
            short: 'Try Again Used',
            medium: `🔄 Try Again: ${event.timePenalty} day penalty`,
            detailed: `${event.playerName} used Try Again: ${event.timePenalty} ${dayWord} penalty applied.`,
          },
          { playerId: event.playerId, playerName: event.playerName, actionType: 'tryAgain', notificationDuration: 3000 }
        );
        break;
      }

      case 'routed_back_to_review': {
        let detailed: string;
        if (event.kind === 'gate_bounce') {
          detailed = `${event.playerName}: ${event.reason}`;
        } else if (event.kind === 'chosen_destination') {
          detailed = `${event.playerName} chose ${event.toSpaceTitle}. ${event.reason}`;
        } else {
          detailed = `${event.playerName} is being directed to ${event.toSpaceTitle}. ${event.reason}`;
        }
        this.notificationService.notify(
          {
            short: `→ ${event.toSpaceTitle}`,
            medium: `📋 ${event.reason}`,
            detailed,
          },
          {
            playerId: event.playerId,
            playerName: event.playerName,
            actionType: event.kind === 'gate_bounce' ? 'final_review_gate_bounce' : 'review_loop_explanation',
          }
        );
        break;
      }

      case 'manual_action_completed':
        this.notificationService.notify(
          {
            short: 'Action Complete',
            medium: `✅ ${event.summary}`,
            detailed: `${event.playerName} completed manual action: ${event.summary}`,
          },
          { playerId: event.playerId, playerName: event.playerName, actionType: 'manualEffect', notificationDuration: 3000 }
        );
        break;

      case 'seed_money':
        // Only ManualActionProcessor's owner-arrival emission carries
        // turnEffectResult — the OWNER_SEED_MONEY card-effect emission
        // (EffectEngineService) doesn't, and has never had a toast. Guard
        // preserves that; without it this would add an unrequested toast.
        if (event.turnEffectResult) {
          const amount = (event.moneyAmount ?? 0).toLocaleString();
          this.notificationService.notify(
            {
              short: 'Seed Money',
              medium: `💰 Owner invested $${amount}`,
              detailed: `${event.playerName} invested personal seed money: $${amount}`,
            },
            { playerId: event.playerId, playerName: event.playerName, actionType: 'automaticFunding', notificationDuration: 3000 }
          );
        }
        break;

      case 'recurring_card_effect_applied':
        this.notificationService.notify(
          {
            short: 'Ongoing event',
            medium: event.headline,
            detailed: `Recurring life event from ${event.cardName}: ${event.delta}${event.tail}.`,
          },
          { playerId: event.playerId, playerName: event.playerName, actionType: 'life_event_recurring', notificationDuration: 5000 }
        );
        break;

      case 'game_ended':
        // Replaces the old 'life_event' repurposing — that case reads
        // cardType/cardName (which bankruptcy/design_fee_cap never set),
        // so it silently rendered "Received: undefined" instead of
        // event.message. This case consumes message verbatim instead.
        this.notificationService.notify(
          {
            short: event.reason === 'win' ? 'Victory!' : 'Game Over',
            medium: event.message,
            detailed: event.message,
          },
          { playerId: event.playerId, playerName: event.playerName, actionType: 'game_ended' }
        );
        break;

      case 'life_event':
      case 'dice_conditional_card':
        this.notificationService.notify(
          {
            short: event.cardType === 'L' ? '📰' : '✓',
            medium: event.cardType === 'L' ? `📰 Life event: ${event.cardName}` : `Received: ${event.cardName}`,
            detailed: event.cardType === 'L'
              ? `${event.playerName} hit a life event: ${event.cardName}`
              : `${event.playerName} received: ${event.cardName}`,
          },
          { playerId: event.playerId, playerName: event.playerName, actionType: 'dice_conditional_card', notificationDuration: 5000 }
        );
        break;

      default:
        break;
    }
  };
}
