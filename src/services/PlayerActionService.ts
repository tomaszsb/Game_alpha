import { IPlayerActionService, IDataService, IStateService, IGameRulesService, IMovementService, ITurnService, IEffectEngineService, ILoggingService } from '../types/ServiceContracts';
import { debugLog } from '../utils/debugLog';
import { EffectFactory } from '../utils/EffectFactory';
import { EffectContext, Effect } from '../types/EffectTypes';

/**
 * PlayerActionService handles player actions and orchestrates interactions between multiple services.
 * This service acts as the "brain" of the game, coordinating player intentions with game state updates.
 */
export class PlayerActionService implements IPlayerActionService {
  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private gameRulesService: IGameRulesService,
    private movementService: IMovementService,
    private turnService: ITurnService,
    private effectEngineService: IEffectEngineService,
    private loggingService: ILoggingService
  ) {}

  /**
   * Handles a player playing a card from their hand.
   * 
   * @param playerId - The ID of the player attempting to play the card
   * @param cardId - The ID of the card being played
   * @throws Error if the action is invalid (validation failures)
   */
  public async playCard(playerId: string, cardId: string): Promise<void> {
    try {
      // Card play attempt now logged to action history

      // 1. Get current game state and player
      const gameState = this.stateService.getGameState();
      const player = this.stateService.getPlayer(playerId);
      
      if (!player) {
        throw new Error(`Player with ID '${playerId}' not found`);
      }

      // Log the card play attempt
      this.loggingService.info(`Attempting to play card: ${cardId}`, {
        playerId: playerId,
        action: 'playCard',
        cardId: cardId,
        status: 'attempt'
      });

      // 2. Get card data from DataService
      const card = this.dataService.getCardById(cardId);
      
      if (!card) {
        throw new Error(`Card with ID '${cardId}' not found`);
      }

      // Card details available in action history

      // 3. Validate the action using GameRulesService
      const canPlayCard = this.gameRulesService.canPlayCard(playerId, cardId);
      
      if (!canPlayCard) {
        throw new Error(`Player '${player.name}' cannot play card '${card.card_name}'. Validation failed.`);
      }

      // 3.5. Validate player owns the card in their hand
      const playerCardType = card.card_type;
      
      // Check if card is in player's hand
      if (!player.hand || !player.hand.includes(cardId)) {
        throw new Error(`Player '${player.name}' does not have card '${card.card_name}' in their ${playerCardType} hand`);
      }

      // 4. Validate player can afford the card cost (Effect Engine will handle the deduction)
      if (card.cost !== undefined && card.cost > 0) {
        const canAfford = this.gameRulesService.canPlayerAfford(playerId, card.cost);
        
        if (!canAfford) {
          throw new Error(`Player '${player.name}' cannot afford card '${card.card_name}'. Cost: $${card.cost}, Available: $${player.money}`);
        }
      }

      // 5. Generate effects from the card using EffectFactory
      const effects = EffectFactory.createEffectsFromCard(card, playerId);
      debugLog(`🏭 Generated ${effects.length} effects from card ${card.card_name}`);

      // 6. Create effect processing context
      const effectContext: EffectContext = {
        source: `player_action:card_play`,
        playerId: playerId,
        triggerEvent: 'CARD_PLAY',
        metadata: {
          cardId: cardId,
          cardName: card.card_name,
          cardType: card.card_type,
          playerName: player.name
        }
      };

      // 7. Process all effects through the Effect Engine (with targeting and duration awareness)
      debugLog(`🔧 Processing card effects through Effect Engine with targeting support...`);
      debugLog('SERVICE: About to wait for Effect Engine...');
      const processingResult = await this.effectEngineService.processCardEffects(effects, effectContext, card);
      debugLog('SERVICE: Effect Engine has finished.');
      
      if (!processingResult.success) {
        throw new Error(`Failed to process card effects: ${processingResult.errors.join(', ')}`);
      }

      debugLog(`✅ Card effects processed successfully: ${processingResult.successfulEffects}/${processingResult.totalEffects} effects completed`);

      // 8. The Effect Engine has now handled all card effects including:
      //    - Card cost deduction (via RESOURCE_CHANGE effects from EffectFactory)
      //    - Money/time changes (via card-specific effects)  
      //    - Drawing additional cards (via CARD_DRAW effects)
      //    - Loan amounts (via expanded card mechanics)
      //    - Multi-player targeting (All Players, Choose Opponent, etc.)
      //    - Duration-based effects that persist across turns
      //    - Any other card-specific effects

      // 9. Handle card lifecycle (move from hand to discard/active) - this only affects the source player
      debugLog(`🔧 Processing card lifecycle for source player...`);
      const playCardEffect: Effect = {
        effectType: 'PLAY_CARD',
        payload: {
          playerId: playerId,
          cardId: cardId,
          source: `card_lifecycle:${cardId}`
        }
      };

      const lifecycleResult = await this.effectEngineService.processEffect(playCardEffect, effectContext);
      if (!lifecycleResult.success) {
        throw new Error(`Failed to process card lifecycle: ${lifecycleResult.error || 'Unknown error'}`);
      }

      // Card play completion logged to action history

      // Log successful card play
      this.loggingService.info(`Successfully played card: ${card.card_name}`, {
        playerId: playerId,
        action: 'playCard',
        cardId: cardId,
        cardName: card.card_name,
        success: true
      });

    } catch (error) {
      // Log failed card play
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const gameState = this.stateService.getGameState();
      const player = this.stateService.getPlayer(playerId);
      
      if (player) {
        this.loggingService.error(
          `Failed to play card: ${cardId}`,
          new Error(errorMessage),
          {
            playerId: playerId,
            action: 'playCard',
            cardId: cardId,
            success: false
          }
        );
      }
      
      // Re-throw with additional context
      throw new Error(`Failed to play card: ${errorMessage}`);
    }
  }

  // Phase 2.1 audit (2026-06-04): rollDice + private handlePlayerMovement +
  // endTurn deleted. These were a legacy monolithic dice-and-move pattern that
  // had zero callers in src as of 2026-06-04 (only the playCard method is
  // used by CardActions.tsx; rollDice / endTurn were only exercised by the
  // service's own unit tests). The live UI calls
  // turnService.rollDiceWithFeedback (delegates to
  // DiceRollProcessor.rollDiceWithFeedback — richer: tracks effect deltas for
  // the modal feedback, decouples roll from movement) and
  // turnService.endTurnWithMovement (drives MovementExecutor.executeMovement
  // for the deferred end-of-turn move). The deleted rollDice path was also
  // a third caller of MovementService.getDiceDestination without the Stage-1
  // gate override that v3.0.62 added — removing it eliminates the only
  // remaining parallel-systems debt site on the movement resolver.
  //
  // Constructor still accepts movementService, turnService, effectEngineService
  // for back-compat with ServiceProvider + test mocks; playCard only uses
  // dataService, stateService, gameRulesService, effectEngineService,
  // loggingService. Dropping the unused constructor args is a follow-up sweep.
}