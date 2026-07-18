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

      // --- Domain-event stage 4: approval domain. Per the maintainer's
      // log-coverage decision, these previously reached only a modal
      // banner (approval_outcome_determined), a toast only
      // (routed_back_to_review), or a dedicated player-panel notice
      // (approval_revoked) — never the permanent log. ---

      case 'approval_revoked':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'approval_revoked',
          spaceName: event.spaceName,
          cardName: event.cardName,
        });
        break;

      case 'approval_outcome_determined':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'approval_outcome_determined',
          spaceName: event.spaceName,
          approval: event.approval,
          kind: event.kind,
          source: event.source,
        });
        break;

      case 'routed_back_to_review':
        this.loggingService.info(event.reason, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'routed_back_to_review',
          spaceName: event.spaceName,
          toSpace: event.toSpace,
          kind: event.kind,
        });
        break;

      case 'game_ended':
        // Reuses the 'game_end' action tag — already fully registered
        // (ActionLogEntry union, LoggingService's validTypes, GameLog's
        // label/color, 🏆 prefix) but never fired from anywhere until now.
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          playerName: event.playerName,
          action: 'game_end',
          reason: event.reason,
          spaceName: event.spaceName,
        });
        break;

      // --- Domain-event stage 4: CardService lifecycle (log-only — grep
      // confirmed zero companion toasts anywhere in CardService.ts) ---

      case 'card_drawn':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          action: 'card_draw',
          cardType: event.cardType,
          count: event.count,
          cards: event.cards,
          source: event.source,
        });
        break;

      case 'deck_reshuffled':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          action: 'deck_reshuffle',
          cardType: event.cardType,
        });
        break;

      case 'card_transferred':
        this.loggingService.info(event.message, {
          playerId: event.sourcePlayerId,
          action: 'card_transfer',
          cardId: event.cardId,
          cardName: event.cardName,
          targetPlayerId: event.targetPlayerId,
        });
        break;

      case 'card_expired':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          action: 'card_expire',
          cardId: event.cardId,
        });
        break;

      case 'card_discarded':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          action: 'card_discard',
          cardIds: event.cardIds,
        });
        break;

      case 'card_played':
        this.loggingService.info(`Played ${event.cardName}`, {
          playerId: event.playerId,
          action: 'card_play',
          cardId: event.cardId,
          cardName: event.cardName,
          activated: event.activated,
          durationTurns: event.durationTurns,
        });
        break;

      case 'card_activated':
        this.loggingService.info(`Activated "${event.cardName}" for ${event.durationTurns} turns.`, {
          playerId: event.playerId,
          action: 'card_activate',
          cardId: event.cardId,
          durationTurns: event.durationTurns,
        });
        break;

      case 'card_replaced':
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          action: 'card_discard', // reused verbatim — matches today's tag exactly
          oldCardId: event.oldCardId,
          newCardId: event.newCardId,
          newCardType: event.newCardType,
        });
        break;

      case 'card_effect_target_resolved': {
        // Preserve today's (accidentally inconsistent) per-mechanic action
        // tags exactly, so behavior stays bit-for-bit identical.
        const action = event.mechanic === 'return_to_sender'
          ? (event.resolved ? 'card_return_to_hand' : 'card_no_target')
          : (event.resolved ? 'favor_called_in' : 'card_no_target');
        this.loggingService.info(event.message, {
          playerId: event.playerId,
          action,
          targetPlayerName: event.targetPlayerName,
          cardName: event.cardName,
        });
        break;
      }

      default:
        break;
    }
  };
}
