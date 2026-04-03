// src/services/SpaceArrivalProcessor.ts
// Extracted from TurnService - handles space arrival effect processing

import { IDataService, IStateService, ICardService, ILoggingService, IEffectEngineService, IGameRulesService } from '../types/ServiceContracts';
import { INotificationService } from './NotificationService';
import { Player } from '../types/StateTypes';
import { SpaceEffect, CardType, VisitType } from '../types/DataTypes';
import { EffectFactory } from '../utils/EffectFactory';
import { ConditionEvaluator } from '../utils/ConditionEvaluator';
import { AutoActionEvent } from './StateService';

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
    private notificationService?: INotificationService
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

    console.log(`🏠 Processing arrival space effects for ${currentPlayer.name} at ${spaceName} (${visitType} visit)`);

    try {
      // Get space effect data from DataService for the arrival space
      const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);

      // Check if any effects need dice roll for condition evaluation
      const needsDiceRoll = ConditionEvaluator.anyEffectNeedsDiceRoll(spaceEffectsData);

      let diceRoll: number | undefined;
      if (needsDiceRoll) {
        // Roll dice once for this space - used for all dice-dependent condition evaluations
        diceRoll = Math.floor(Math.random() * 6) + 1;
        console.log(`🎲 Rolled ${diceRoll} for condition evaluation at ${spaceName}`);

        // Log the dice roll
        this.loggingService.info(`🎲 ${currentPlayer.name} rolled ${diceRoll} at ${spaceName}`, {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          action: 'dice_roll',
          diceValue: diceRoll,
          spaceName: spaceName
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
        console.log(`ℹ️ No automatic space effects for arrival at ${spaceName}`);
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
        skipLogging
      );

      if (spaceEffects.length === 0) {
        console.log(`ℹ️ No processed space effects for arrival at ${spaceName}`);
        return;
      }

      console.log(`⚡ Processing ${spaceEffects.length} space arrival effects for ${spaceName}`);

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
          console.log(`✅ Applied ${result.successfulEffects} space arrival effects for ${spaceName}`);
        } else {
          console.warn(`⚠️ Some space arrival effects failed for ${spaceName}:`, result.errors);
        }
      } else {
        console.warn(`⚠️ EffectEngineService not available - skipping space arrival effects for ${spaceName}`);
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
      console.log(`🎯 Dice roll ${diceRoll} matches ${requiredRoll}! Drawing ${cardType} card for ${currentPlayer.name}`);

      try {
        const drawnCardIds = this.cardService.drawCards(
          currentPlayer.id,
          cardType as CardType,
          1,
          'dice_conditional_effect',
          `Auto effect: Rolled ${diceRoll} - Drew ${cardType} card`
        );

        // Get card details for display
        const cardData = drawnCardIds.length > 0 ? this.dataService.getCardById(drawnCardIds[0]) : null;
        const cardName = cardData?.card_name || `${cardType} Card`;

        // Emit auto-action event for modal display
        const autoActionEvent: AutoActionEvent = {
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
          message: `Rolled ${diceRoll} and drew: ${cardName}`
        };
        this.stateService.emitAutoAction(autoActionEvent);

        // Show notification for banner
        if (this.notificationService) {
          this.notificationService.notify(
            {
              short: `🎲 ${diceRoll}!`,
              medium: `🎲 Rolled ${diceRoll} - Drew: ${cardName}`,
              detailed: `${currentPlayer.name} rolled ${diceRoll} (needed ${requiredRoll}) and drew a ${cardType} card: ${cardName}`
            },
            {
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              actionType: 'dice_conditional_card',
              notificationDuration: 5000
            }
          );
        }
      } catch (error) {
        console.error(`Failed to draw ${cardType} card on dice conditional effect:`, error);
      }
    }

    // Log if dice was rolled but no card effects matched (for debugging)
    if (diceCardEffects.length === 0 && needsDiceRoll) {
      console.log(`🎲 Dice roll ${diceRoll} - no matching card effects at ${spaceName}`);
    }
  }
}
