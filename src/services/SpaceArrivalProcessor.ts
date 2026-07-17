// src/services/SpaceArrivalProcessor.ts
// Extracted from TurnService - handles space arrival effect processing

import { IDataService, IStateService, ICardService, ILoggingService, IEffectEngineService, IGameRulesService, IDiceService } from '../types/ServiceContracts';
import { debugLog, debugWarn } from '../utils/debugLog';
import { INotificationService } from './NotificationService';
import { Player } from '../types/StateTypes';
import { SpaceEffect, CardType, VisitType } from '../types/DataTypes';
import { EffectFactory } from '../utils/EffectFactory';
import { ConditionEvaluator } from '../utils/ConditionEvaluator';
import { friendlySpaceName } from '../utils/logFormatting';
import { GameEvent, LifeEventEffectSummary } from '../types/GameEvents';
import { snapshotPlayerForLifeEvent, diffLifeEventSnapshot } from '../utils/lifeEventReceipts';
import { DiceService } from './DiceService';

/**
 * SpaceArrivalProcessor handles the processing of space effects when a player arrives at a space.
 *
 * This includes:
 * - Rolling dice for condition evaluation (if needed)
 * - Processing dice-conditional card effects
 * - Filtering effects by player conditions
 * - Generating and executing effects via EffectEngine
 *
 * Extracted from TurnService for better separation of concerns.
 */
export class SpaceArrivalProcessor {
  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private cardService: ICardService,
    private loggingService: ILoggingService,
    private gameRulesService: IGameRulesService,
    private effectEngineService?: IEffectEngineService,
    private notificationService?: INotificationService,
    private diceService: IDiceService = new DiceService()
  ) {}

  /**
   * Set the EffectEngineService after construction (for circular dependency handling)
   */
  public setEffectEngineService(service: IEffectEngineService): void {
    this.effectEngineService = service;
  }

  /**
   * Set the NotificationService after construction
   */
  public setNotificationService(service: INotificationService): void {
    this.notificationService = service;
  }

  /**
   * Filter space effects based on conditions (e.g., scope_le_4M, dice_roll_3)
   * Delegates to GameRulesService for consistent condition evaluation
   *
   * @param spaceEffects - Array of space effects to filter
   * @param player - The player to evaluate conditions for
   * @param diceRoll - Optional dice roll value for dice-dependent conditions
   */
  public filterSpaceEffectsByCondition(
    spaceEffects: SpaceEffect[],
    player: Player,
    diceRoll?: number
  ): SpaceEffect[] {
    return spaceEffects.filter(effect => {
      return this.gameRulesService.evaluateCondition(player.id, effect.condition, diceRoll);
    });
  }

  /**
   * Process space effects for a player after movement (for arrival effects)
   * This is the main entry point for space arrival processing.
   *
   * @param playerId - The player ID
   * @param spaceName - The space the player arrived at
   * @param visitType - First or Return visit
   * @param skipLogging - Whether to skip logging (for silent operations)
   */
  public async processSpaceEffectsAfterMovement(
    playerId: string,
    spaceName: string,
    visitType: VisitType,
    skipLogging: boolean = false
  ): Promise<void> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    debugLog(`🏠 Processing arrival space effects for ${currentPlayer.name} at ${spaceName} (${visitType} visit)`);

    try {
      // Get space effect data from DataService for the arrival space
      const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);

      // Check if any effects need dice roll for condition evaluation
      const needsDiceRoll = ConditionEvaluator.anyEffectNeedsDiceRoll(spaceEffectsData);

      let diceRoll: number | undefined;
      if (needsDiceRoll) {
        // Roll dice once for this space - used for all dice-dependent condition evaluations
        diceRoll = this.diceService.rollDice();
        debugLog(`🎲 Rolled ${diceRoll} for condition evaluation at ${spaceName}`);

        // Domain-event stage 3: LogWriter reacts to this (arrival-triggered
        // piggyback roll — the other DiceRolled emitter is TurnService's
        // manual Roll Dice button path). fb:91738221 — drop the leading 🎲
        // (the actionLogFormatting layer prepends it for dice_roll entries,
        // was causing "🎲 🎲" double-emoji), and use the friendly space name.
        // Voice rule (no game language): no "rolled" / no raw die number in
        // the player-visible description — frame it as the outcome coming
        // back, matching TurnService's "Outcome determined" (fb:1783080880242).
        const friendlyForLog = friendlySpaceName(this.dataService, spaceName);
        this.stateService.emitGameEvent({
          type: 'dice_rolled',
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          spaceName: spaceName,
          diceValue: diceRoll,
          trigger: 'arrival',
          logMessage: `${currentPlayer.name}'s outcome came back at ${friendlyForLog}`,
        });
      }

      // Filter space effects based on conditions (e.g., scope_le_4M, dice_roll_3)
      const conditionFilteredEffects = this.filterSpaceEffectsByCondition(
        spaceEffectsData,
        currentPlayer,
        diceRoll
      );

      // Process dice-conditional card effects that passed the filter
      await this.processDiceConditionalCardEffects(
        conditionFilteredEffects,
        currentPlayer,
        spaceName,
        diceRoll,
        needsDiceRoll
      );

      // Filter out manual effects and time effects
      // Manual effects are triggered by buttons, time effects on leaving space
      const filteredSpaceEffects = conditionFilteredEffects.filter(effect =>
        effect.trigger_type !== 'manual' && effect.effect_type !== 'time'
      );

      if (filteredSpaceEffects.length === 0) {
        debugLog(`ℹ️ No automatic space effects for arrival at ${spaceName}`);
        return;
      }

      // Generate effects from space arrival using EffectFactory
      const spaceEffects = EffectFactory.createEffectsFromSpaceEntry(
        filteredSpaceEffects,
        playerId,
        spaceName,
        visitType,
        undefined,
        currentPlayer?.name,
        skipLogging,
        friendlySpaceName(this.dataService, spaceName)
      );

      if (spaceEffects.length === 0) {
        debugLog(`ℹ️ No processed space effects for arrival at ${spaceName}`);
        return;
      }

      debugLog(`⚡ Processing ${spaceEffects.length} space arrival effects for ${spaceName}`);

      // Create effect context for space arrival
      const effectContext = {
        source: 'space_arrival',
        playerId,
        triggerEvent: 'SPACE_ENTRY' as const,
        metadata: {
          spaceName,
          visitType,
          playerName: currentPlayer.name
        }
      };

      // Process effects using EffectEngine
      if (this.effectEngineService) {
        const result = await this.effectEngineService.processEffects(spaceEffects, effectContext);
        if (result.success) {
          debugLog(`✅ Applied ${result.successfulEffects} space arrival effects for ${spaceName}`);
        } else {
          debugWarn(`⚠️ Some space arrival effects failed for ${spaceName}:`, result.errors);
        }
      } else {
        debugWarn(`⚠️ EffectEngineService not available - skipping space arrival effects for ${spaceName}`);
      }
    } catch (error) {
      console.error(`❌ Error processing space arrival effects for ${spaceName}:`, error);
    }
  }

  /**
   * Process dice-conditional card effects that passed the condition filter.
   * These effects have conditions like 'dice_roll_3' and only appear in
   * the filtered list if the dice matched.
   */
  private async processDiceConditionalCardEffects(
    conditionFilteredEffects: SpaceEffect[],
    currentPlayer: Player,
    spaceName: string,
    diceRoll: number | undefined,
    needsDiceRoll: boolean
  ): Promise<void> {
    if (diceRoll === undefined) {
      return;
    }

    const diceCardEffects = conditionFilteredEffects.filter(effect =>
      effect.trigger_type === 'auto' &&
      effect.effect_type === 'cards' &&
      ConditionEvaluator.isDiceConditionStatic(effect.condition)
    );

    for (const effect of diceCardEffects) {
      // Extract card type and required roll from the effect
      const cardType = effect.effect_action.replace(/^draw_/i, '').toUpperCase();
      const requiredRoll = parseInt(effect.condition.replace('dice_roll_', ''), 10);

      // Effect passed condition check, so dice matched - draw the card
      debugLog(`🎯 Dice roll ${diceRoll} matches ${requiredRoll}! Drawing ${cardType} card for ${currentPlayer.name}`);

      try {
        // Snapshot before the draw so we can diff what the auto-applied L-card
        // actually did and show the player a receipt instead of the card's raw
        // "roll a die / on 1-3…" instruction text (fb:7a2a2956, fb:701b26e3).
        const isCapturing = this.stateService.getGameState().isCapturingStartingHand;
        const resolveCard = (id: string) => this.dataService.getCardById(id);
        const beforeSnapshot = (cardType === 'L' && !isCapturing)
          ? snapshotPlayerForLifeEvent(this.stateService.getPlayer(currentPlayer.id), resolveCard)
          : null;

        const drawnCardIds = this.cardService.drawCards(
          currentPlayer.id,
          cardType as CardType,
          1,
          'dice_conditional_effect',
          // Voice rule (no game language): no die number, no "card"/type code.
          `Auto effect: ${cardType === 'L' ? 'a life event occurred' : 'received a new resource'}`
        );

        // Apply the auto-drawn Life Event (L) card's money/time effects.
        // drawCards only adds the card to hand — without this a life event's
        // tick_modifier / money_effect never reached state. onlyResourceEffects
        // applies just the pure-arithmetic money/time + Kid B (self-E draws) +
        // Kid D (dice-conditional, using diceRoll). Kid E (global forced
        // discard) still deferred. Card stays in hand as a record.
        if (cardType === 'L' && !isCapturing) {
          for (const drawnId of drawnCardIds) {
            await this.cardService.applyCardEffects(currentPlayer.id, drawnId, {
              onlyResourceEffects: true,
              diceRoll,
            });
          }
        }

        // Get card details for display
        const cardData = drawnCardIds.length > 0 ? this.dataService.getCardById(drawnCardIds[0]) : null;
        const cardName = cardData?.card_name || `${cardType} Card`;

        // Build the "what just happened" receipts for the LifeEventModal. Shared
        // with CardEffectHandler via lifeEventReceipts so the two emission paths
        // can't drift. For a dice_conditional card whose roll landed on the
        // "no effect" branch (e.g. L043 4-6 → 0 days), the diff is empty — add an
        // explicit "no change this time" line so the realized outcome is never
        // ambiguous (the player shouldn't be left reading roll instructions).
        let effectsSummary: LifeEventEffectSummary[] = [];
        if (cardType === 'L' && !isCapturing) {
          const afterSnapshot = snapshotPlayerForLifeEvent(this.stateService.getPlayer(currentPlayer.id), resolveCard);
          effectsSummary = diffLifeEventSnapshot(beforeSnapshot, afterSnapshot, drawnCardIds[0]);
          if (cardData?.card_mechanic === 'dice_conditional' && !effectsSummary.some(e => e.kind === 'time')) {
            effectsSummary = [...effectsSummary, { kind: 'time', amount: 0, label: 'No change this time' }];
          }
          // L041-style competing_worktype_conditional and L046-style
          // leader_phase_conditional cards need a reveal saying WHICH player the
          // effect actually landed on — CardEffectHandler's copy of this same
          // receipt-building logic added these two branches, but this arrival-
          // triggered path (auto dice-conditional draws on landing, e.g. every
          // space's "draw_L on dice_roll_N" effect) never got them, so an L046
          // drawn this way showed "-4 days" with no name attached (fb:f3f89f0d
          // — "how is this determined? How do I know which player got the
          // bonus?"). Mirrors CardEffectHandler.ts exactly to close the drift.
          for (const drawnId of drawnCardIds) {
            const drawnCard = this.dataService.getCardById(drawnId);
            if (drawnCard?.card_mechanic === 'competing_worktype_conditional') {
              const reveal = this.cardService.buildCompetingWorktypeReveal(currentPlayer.id);
              effectsSummary = [...reveal, ...effectsSummary];
            } else if (drawnCard?.card_mechanic === 'leader_phase_conditional') {
              const days = parseInt(drawnCard.tick_modifier ?? '0', 10) || 0;
              const reveal = this.cardService.buildLeaderReveal(currentPlayer.id, days);
              effectsSummary = [...reveal, ...effectsSummary];
            }
          }
        }

        // Emit game event for modal display
        const gameEvent: GameEvent = {
          type: cardType === 'L' ? 'life_event' : 'dice_conditional_card',
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          diceValue: diceRoll,
          requiredRoll: requiredRoll,
          cardType: cardType,
          cardName: cardName,
          cardId: drawnCardIds.length > 0 ? drawnCardIds[0] : undefined,
          success: true,
          spaceName: spaceName,
          message: cardType === 'L' ? `Life event: ${cardName}` : `Received: ${cardName}`,
          effectsSummary: effectsSummary.length > 0 ? effectsSummary : undefined,
        };
        this.stateService.emitGameEvent(gameEvent);
        // Domain-event stage 3: the notification banner is now derived by
        // ToastWriter from the emitGameEvent call above — the standalone
        // notify() that used to live here is gone.
      } catch (error) {
        console.error(`Failed to draw ${cardType} card on dice conditional effect:`, error);
      }
    }

    // Log if dice was rolled but no card effects matched (for debugging)
    if (diceCardEffects.length === 0 && needsDiceRoll) {
      debugLog(`🎲 Dice roll ${diceRoll} - no matching card effects at ${spaceName}`);
    }
  }
}
