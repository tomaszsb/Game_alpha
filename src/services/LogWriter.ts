// src/services/LogWriter.ts
// Domain-event stage 3 (docs/design/domain-events.md). Subscribes to the
// typed GameEvent bus and writes the permanent-log half of each collapsed
// dual-channel moment via the existing loggingService.info() — buffering
// within a turn transaction (Try Again discard) is automatic because
// LoggingService's session mechanism already tags every info() call made
// during an active exploration session; this class doesn't reinvent that.
import { IStateService, ILoggingService } from '../types/ServiceContracts';
import { GameEvent } from '../types/GameEvents';

export class LogWriter {
  constructor(
    private stateService: IStateService,
    private loggingService: ILoggingService,
  ) {
    this.stateService.subscribeToGameEvents(this.handleEvent);
  }

  private handleEvent = (event: GameEvent): void => {
    switch (event.type) {
      case 'turn_committed':
        this.loggingService.info(`Turn ${event.turn} ended`, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'turn_end',
          turn: event.turn,
          space: event.spaceName,
        });
        break;

      case 'turn_discarded':
        // isCommitted:true is deliberate — this entry must survive the
        // discardCurrentSession() call that follows it (see TurnService's
        // tryAgainOnSpace, which emits this event before discarding).
        this.loggingService.info(
          `Used Try Again: ${event.timePenalty} day penalty applied`,
          {
            playerId: event.playerId,
            playerName: event.playerName,
            action: 'try_again',
            spaceName: event.spaceName,
            timePenalty: event.timePenalty,
            tryAgainCount: event.tryAgainCount,
            isCommitted: true,
          }
        );
        break;

      case 'dice_rolled':
        this.loggingService.info(event.logMessage, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'dice_roll',
          diceValue: event.diceValue,
          space: event.spaceName,
        });
        break;

      case 'movement':
        // New coverage as of stage 3, but ONLY for the failure case.
        // Discovered during implementation: a successful move already gets
        // logged today, just not through this event — MovementService's
        // movePlayer() (called by every success branch in MovementExecutor)
        // writes its own "Moved from X to Y" entry directly. Logging success
        // here too would duplicate that entry. A FAILED move never calls
        // movePlayer() at all, so it has genuinely never reached the log —
        // that's the real gap this stage closes.
        if (!event.success) {
          this.loggingService.info(event.message, {
            playerId: event.playerId,
            playerName: event.playerName,
            action: 'player_movement',
            fromSpace: event.fromSpace,
            toSpace: event.toSpace,
            success: false,
          });
        }
        break;

      case 'manual_action_completed':
        this.loggingService.info(event.summary, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'manual_action',
          effectType: event.effectType,
        });
        break;

      case 'recurring_card_effect_applied':
        this.loggingService.info(event.headline, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'life_event_recurring',
          sourceCardId: event.sourceCardId,
          moneyDelta: event.moneyDelta,
          timeDelta: event.timeDelta,
          turnsLeftAfterThis: event.turnsLeftAfterThis,
        });
        break;

      default:
        break;
    }
  };
}
