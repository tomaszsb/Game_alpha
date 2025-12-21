// src/services/EffectEngineService.ts

import {
  IResourceService,
  ICardService,
  IChoiceService,
  IStateService,
  IMovementService,
  ITurnService,
  IGameRulesService,
  ITargetingService,
  ILoggingService,
  IDataService,
  LogPayload,
  INotificationService
} from '../types/ServiceContracts';
import { NegotiationService } from './NegotiationService';
import { 
  Effect, 
  EffectContext, 
  EffectResult, 
  BatchEffectResult,
  isResourceChangeEffect,
  isCardDrawEffect,
  isCardDiscardEffect,
  isChoiceEffect,
  isLogEffect,
  isPlayerMovementEffect,
  isTurnControlEffect,
  isCardActivationEffect,
  isEffectGroupTargetedEffect,
  isConditionalEffect,
  isChoiceOfEffectsEffect,
  isPlayCardEffect,
  isDurationStoredEffect,
  isInitiateNegotiationEffect,
  isNegotiationResponseEffect,
  isPlayerAgreementRequiredEffect,
  isFeeDeductionEffect
} from '../types/EffectTypes';

/**
 * Unified Effect Processing Engine
 * 
 * This service provides a centralized system for processing all game effects.
 * It acts as a coordination layer between different services, ensuring that
 * complex multi-step effects are handled consistently and atomically.
 * 
 * Key Features:
 * - Standardized effect processing via Effect objects
 * - Batch processing with rollback capability
 * - Source tracking for debugging and logging
 * - Integration with all major game services
 * - Type-safe effect handling via discriminated unions
 */
export interface IEffectEngineService {
  // Core processing methods
  processEffects(effects: Effect[], context: EffectContext): Promise<BatchEffectResult>;
  processEffect(effect: Effect, context: EffectContext): Promise<EffectResult>;
  
  // Comprehensive card effect processing (targeting + duration)
  processCardEffects(effects: Effect[], context: EffectContext, cardData?: any): Promise<BatchEffectResult>;
  
  // Multi-player targeting methods
  processEffectsWithTargeting(effects: Effect[], context: EffectContext, targetRule?: string): Promise<BatchEffectResult>;
  
  // Duration-based effect methods
  processEffectsWithDuration(effects: Effect[], context: EffectContext, cardData?: any): Promise<BatchEffectResult>;
  applyActiveEffects(playerId: string): Promise<void>;
  addActiveEffect(playerId: string, effect: Effect, sourceCardId: string, duration: number): void;
  processActiveEffectsForAllPlayers(): Promise<void>;
  
  // Validation methods
  validateEffect(effect: Effect, context: EffectContext): boolean;
  validateEffects(effects: Effect[], context: EffectContext): boolean;
}

export class EffectEngineService implements IEffectEngineService {
  // Recursion safety limits to prevent infinite effect loops
  private static readonly MAX_EFFECT_DEPTH = 10;          // Maximum nesting depth for resulting effects
  private static readonly MAX_EFFECTS_PER_BATCH = 100;    // Maximum total effects in single batch
  private static readonly DEPTH_WARNING_THRESHOLD = 7;     // Warn when approaching depth limit
  private static readonly BATCH_WARNING_THRESHOLD = 80;    // Warn when approaching batch limit

  private resourceService: IResourceService;
  private cardService: ICardService;
  private choiceService: IChoiceService;
  private stateService: IStateService;
  private movementService: IMovementService;
  private turnService: ITurnService;
  private gameRulesService: IGameRulesService;
  private targetingService: ITargetingService;
  private loggingService: ILoggingService;
  private dataService?: IDataService;
  private negotiationService?: NegotiationService;
  private notificationService?: INotificationService;

  constructor(
    resourceService: IResourceService,
    cardService: ICardService,
    choiceService: IChoiceService,
    stateService: IStateService,
    movementService: IMovementService,
    turnService: ITurnService,
    gameRulesService: IGameRulesService,
    targetingService: ITargetingService,
    loggingService: ILoggingService
  ) {
    this.resourceService = resourceService;
    this.cardService = cardService;
    this.choiceService = choiceService;
    this.stateService = stateService;
    this.movementService = movementService;
    this.turnService = turnService;
    this.gameRulesService = gameRulesService;
    this.targetingService = targetingService;
    this.loggingService = loggingService;
    // NegotiationService is initialized separately to avoid circular dependencies
    this.negotiationService = undefined;
  }

  public setNegotiationService(negotiationService: NegotiationService): void {
    this.negotiationService = negotiationService;
  }

  public setTurnService(turnService: ITurnService): void {
    this.turnService = turnService;
  }

  public setNotificationService(notificationService: INotificationService): void {
    this.notificationService = notificationService;
  }

  public setDataService(dataService: IDataService): void {
    this.dataService = dataService;
  }

  /**
   * Process multiple effects as a batch operation
   * 
   * @param effects Array of effects to process
   * @param context Processing context including source and metadata
   * @returns Promise resolving to batch processing results
   */
  async processEffects(effects: Effect[], context: EffectContext): Promise<BatchEffectResult> {
    console.log(`🚨 DEBUG: EffectEngineService.processEffects() ENTRY - ${effects.length} effects from source: ${context.source}`);
    console.log(`🔧 EFFECT_ENGINE: Processing ${effects.length} effects from source: ${context.source}`);
    
    if (context.playerId) {
      console.log(`   Target Player: ${context.playerId}`);
    }
    
    if (context.triggerEvent) {
      console.log(`   Trigger Event: ${context.triggerEvent}`);
    }

    const results: EffectResult[] = [];
    const errors: string[] = [];
    let successfulEffects = 0;
    let failedEffects = 0;

    // Process each effect in sequence
    for (let i = 0; i < effects.length; i++) {
      // SAFETY CHECK: Prevent infinite effect loops by limiting total effects
      if (effects.length > EffectEngineService.MAX_EFFECTS_PER_BATCH) {
        const errorMsg = `Effect batch limit exceeded: ${effects.length} effects generated (max: ${EffectEngineService.MAX_EFFECTS_PER_BATCH}). Possible infinite loop detected.`;
        console.error(`🚨 ${errorMsg}`);
        errors.push(errorMsg);
        return {
          success: false,
          totalEffects: i,
          successfulEffects,
          failedEffects: failedEffects + 1,
          results,
          errors
        };
      }

      // Warning when approaching batch limit
      if (effects.length >= EffectEngineService.BATCH_WARNING_THRESHOLD && i === EffectEngineService.BATCH_WARNING_THRESHOLD) {
        console.warn(`⚠️ Effect batch size approaching limit: ${effects.length}/${EffectEngineService.MAX_EFFECTS_PER_BATCH}`);
      }

      const effect = effects[i];
      console.log(`  Processing effect ${i + 1}/${effects.length}: ${effect.effectType}`);

      try {
        const result = await this.processEffect(effect, context);
        results.push(result);

        if (result.success) {
          successfulEffects++;
          console.log(`    ✅ Effect ${i + 1} completed successfully`);

          // Handle resultingEffects - add them to the effects array to be processed
          if (result.resultingEffects && result.resultingEffects.length > 0) {
            console.log(`    🔄 Effect ${i + 1} generated ${result.resultingEffects.length} additional effect(s) - adding to queue`);
            effects.push(...result.resultingEffects);
          }
        } else {
          failedEffects++;
          console.log(`    ❌ Effect ${i + 1} failed: ${result.error}`);
          errors.push(`Effect ${i + 1} (${effect.effectType}): ${result.error}`);
        }
      } catch (error) {
        failedEffects++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const result: EffectResult = {
          success: false,
          effectType: effect.effectType,
          error: errorMessage
        };
        results.push(result);
        errors.push(`Effect ${i + 1} (${effect.effectType}): ${errorMessage}`);
        console.log(`    💥 Effect ${i + 1} threw exception: ${errorMessage}`);
      }
    }

    const batchResult: BatchEffectResult = {
      success: failedEffects === 0,
      totalEffects: effects.length,
      successfulEffects,
      failedEffects,
      results,
      errors
    };

    console.log(`🔧 EFFECT_ENGINE: Batch complete - ${successfulEffects}/${effects.length} successful`);
    if (errors.length > 0) {
      console.warn(`   Errors encountered:`, errors);
    }

    return batchResult;
  }

  /**
   * Process a single effect
   * 
   * @param effect Effect to process
   * @param context Processing context
   * @returns Promise resolving to effect processing result
   */
  async processEffect(effect: Effect, context: EffectContext): Promise<EffectResult> {
    console.log(`    🎯 Processing ${effect.effectType} effect`);
    
    let success = false; // Declare success variable at method scope

    try {
      // Validate effect before processing
      if (!this.validateEffect(effect, context)) {
        return {
          success: false,
          effectType: effect.effectType,
          error: 'Effect validation failed'
        };
      }

      // Process effect based on type using type guards and switch statement
      switch (effect.effectType) {
        case 'RESOURCE_CHANGE':
          if (isResourceChangeEffect(effect)) {
            const { payload } = effect;
            const source = payload.source || context.source;
            const reason = payload.reason || 'Effect processing';
            const sourceType = payload.sourceType || 'other';  // Default to 'other' if not specified

            // Handle percentage-based design fees
            let actualAmount = payload.amount;
            if (payload.percentageOfScope !== undefined && payload.resource === 'MONEY') {
              const player = this.stateService.getPlayer(payload.playerId);
              if (player) {
                // Calculate project scope dynamically from W cards (not the stored value which may be stale)
                const projectScope = this.gameRulesService.calculateProjectScope(payload.playerId);
                actualAmount = -Math.floor((projectScope * payload.percentageOfScope) / 100);
                console.log(`🔧 EFFECT_ENGINE: Calculating design fee: ${payload.percentageOfScope}% of ${projectScope.toLocaleString()} = ${Math.abs(actualAmount).toLocaleString()}`);

                // Track as design expenditure if fee category is provided
                if (payload.feeCategory && actualAmount < 0) {
                  const feeAmount = Math.abs(actualAmount);
                  const gameState = this.stateService.getGameState();
                  const currentTurn = gameState.globalTurnCount || gameState.turn || 0;

                  // Build update data for the player
                  const updateData: any = { id: payload.playerId };

                  if (player.expenditures) {
                    // Add to design expenditures
                    updateData.expenditures = {
                      ...player.expenditures,
                      design: (player.expenditures.design || 0) + feeAmount
                    };
                  }

                  // Also track in detailed costs
                  if (player.costs) {
                    const costCategory = payload.feeCategory === 'architectural' ? 'architectural' : 'engineering';
                    const updatedCosts = { ...player.costs };
                    updatedCosts[costCategory] = (updatedCosts[costCategory] || 0) + feeAmount;
                    updatedCosts.total = (updatedCosts.total || 0) + feeAmount;
                    updateData.costs = updatedCosts;

                    // Add to cost history
                    const costHistory = [...(player.costHistory || [])];
                    costHistory.push({
                      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      category: costCategory,
                      amount: feeAmount,
                      description: `${payload.feeCategory === 'architectural' ? 'Architect' : 'Engineer'} fee: ${payload.percentageOfScope}% of scope`,
                      turn: currentTurn,
                      timestamp: new Date(),
                      spaceName: player.currentSpace
                    });
                    updateData.costHistory = costHistory;
                  }

                  // Apply all updates at once
                  this.stateService.updatePlayer(updateData);

                  // Check for 20% design fee cap rule
                  const updatedPlayer = this.stateService.getPlayer(payload.playerId);
                  if (updatedPlayer) {
                    const totalDesignFees = updatedPlayer.expenditures?.design || 0;
                    // Calculate project scope dynamically from W cards
                    const playerScope = this.gameRulesService.calculateProjectScope(payload.playerId);
                    const designFeeRatio = playerScope > 0 ? (totalDesignFees / playerScope) * 100 : 0;

                    if (designFeeRatio >= 20) {
                      console.log(`⛔ DESIGN FEE CAP EXCEEDED: ${designFeeRatio.toFixed(1)}% (${totalDesignFees.toLocaleString()} / ${playerScope.toLocaleString()})`);

                      // Get space phase to determine consequence
                      const spaceConfig = this.dataService ? this.dataService.getGameConfigBySpace(updatedPlayer.currentSpace) : null;
                      const currentPhase = (spaceConfig && spaceConfig.phase) ? spaceConfig.phase.toUpperCase() : 'UNKNOWN';

                      if (currentPhase === 'DESIGN') {
                        // DESIGN phase: Game Over (loss)
                        console.log(`💀 GAME OVER: Design fees exceeded 20% cap during DESIGN phase`);
                        console.log(`   Player: ${updatedPlayer.name}, Design Fees: $${totalDesignFees.toLocaleString()}, Scope: $${playerScope.toLocaleString()}, Ratio: ${designFeeRatio.toFixed(1)}%`);

                        // Emit auto-action event for modal display
                        this.stateService.emitAutoAction({
                          type: 'life_event',
                          playerId: payload.playerId,
                          playerName: updatedPlayer.name,
                          success: false,
                          spaceName: updatedPlayer.currentSpace,
                          message: `⛔ GAME OVER: Design fees exceeded 20% of project scope!`
                        });

                        // End the game - player loses
                        this.stateService.endGame(); // No winner
                      } else {
                        // CONSTRUCTION phase or later: Apply punishment (time penalty)
                        console.log(`⚠️ PENALTY: Design fees exceeded 20% cap during ${currentPhase} phase - applying time penalty`);

                        // Add 2 time units as penalty
                        const timePenalty = 2;
                        this.resourceService.addTime(payload.playerId, timePenalty, 'penalty', 'Design fee cap exceeded - time penalty');

                        // Show notification
                        if (this.notificationService) {
                          this.notificationService.notify(
                            {
                              short: '⚠️ Penalty',
                              medium: `⚠️ Design fees at ${designFeeRatio.toFixed(1)}% - +${timePenalty} weeks penalty`,
                              detailed: `Design fees exceeded 20% of project scope ($${totalDesignFees.toLocaleString()} / $${playerScope.toLocaleString()}). Time penalty: +${timePenalty} weeks added to project.`
                            },
                            {
                              playerId: payload.playerId,
                              playerName: updatedPlayer.name,
                              actionType: 'design_fee_penalty',
                              notificationDuration: 6000
                            }
                          );
                        }
                      }
                    }
                  }
                }
              }
            }

            console.log(`🔧 EFFECT_ENGINE: Processing ${payload.resource} change for player ${payload.playerId} by ${actualAmount}`);

            if (payload.resource === 'MONEY') {
              if (actualAmount > 0) {
                success = this.resourceService.addMoney(payload.playerId, actualAmount, source, reason, sourceType);

                // Show notification for significant money additions (funding from owner)
                if (success && this.notificationService) {
                  const player = this.stateService.getPlayer(payload.playerId);
                  if (player) {
                    // Check if this is owner funding (from B card or OWNER-FUND-INITIATION)
                    const isFunding = source.includes('card:B') ||
                                     source.includes('OWNER-FUND') ||
                                     sourceType === 'owner' ||
                                     reason.toLowerCase().includes('funding');

                    const formattedAmount = actualAmount.toLocaleString();
                    const notificationMessage = isFunding
                      ? `💰 Owner Funding: +$${formattedAmount}`
                      : `💵 Received: +$${formattedAmount}`;

                    this.notificationService.notify(
                      {
                        short: `+$${formattedAmount}`,
                        medium: notificationMessage,
                        detailed: `${player.name} received $${formattedAmount} (${reason})`
                      },
                      {
                        playerId: payload.playerId,
                        playerName: player.name,
                        actionType: 'money_received',
                        notificationDuration: 4000
                      }
                    );
                  }
                }
              } else if (actualAmount < 0) {
                success = this.resourceService.spendMoney(payload.playerId, Math.abs(actualAmount), source, reason);

                // Show notification for design fee deductions
                if (success && this.notificationService && payload.percentageOfScope !== undefined) {
                  const player = this.stateService.getPlayer(payload.playerId);
                  if (player) {
                    const feeType = payload.feeCategory === 'architectural' ? 'Architect' : 'Engineer';
                    const formattedAmount = Math.abs(actualAmount).toLocaleString();
                    this.notificationService.notify(
                      {
                        short: `-$${formattedAmount}`,
                        medium: `💸 ${feeType} Fee: -$${formattedAmount}`,
                        detailed: `${player.name} paid ${feeType} fee: ${payload.percentageOfScope}% of project scope = $${formattedAmount}`
                      },
                      {
                        playerId: payload.playerId,
                        playerName: player.name,
                        actionType: 'fee_paid',
                        notificationDuration: 5000
                      }
                    );
                  }
                }

                // Check for bankruptcy (out of money) after spending
                if (success) {
                  const updatedPlayer = this.stateService.getPlayer(payload.playerId);
                  if (updatedPlayer && updatedPlayer.money < 0) {
                    console.log(`⛔ BANKRUPTCY: ${updatedPlayer.name} has run out of money! Money: $${updatedPlayer.money.toLocaleString()}`);

                    // Emit game over event
                    this.stateService.emitAutoAction({
                      type: 'life_event',
                      playerId: payload.playerId,
                      playerName: updatedPlayer.name,
                      success: false,
                      spaceName: updatedPlayer.currentSpace,
                      message: `💸 BANKRUPTCY: ${updatedPlayer.name} has run out of money and cannot continue the project!`
                    });

                    // End the game
                    this.stateService.endGame();
                  }
                }
              } else {
                success = true; // No change needed for 0 amount
              }
            } else if (payload.resource === 'TIME') {
              if (payload.amount > 0) {
                this.resourceService.addTime(payload.playerId, payload.amount, source, reason);
                success = true;
                
                // Log to action log if available
                const player = this.stateService.getPlayer(payload.playerId);
                if (player && typeof window !== 'undefined' && typeof (window as any).addActionToLog === 'function') {
                  (window as any).addActionToLog({
                    type: 'resource_change',
                    playerId: payload.playerId,
                    playerName: player.name,
                    description: `Added ${payload.amount} day${payload.amount !== 1 ? 's' : ''} of time`,
                    details: {
                      time: payload.amount
                    }
                  });
                }
              } else if (payload.amount < 0) {
                this.resourceService.spendTime(payload.playerId, Math.abs(payload.amount), source, reason);
                success = true;
              } else {
                success = true; // No change needed for 0 amount
              }
            }
            
            if (!success) {
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to process ${payload.resource} change of ${payload.amount} for player ${payload.playerId}`
              };
            }
          }
          break;

        case 'CARD_DRAW':
          if (isCardDrawEffect(effect)) {
            const { payload } = effect;
            const source = payload.source || context.source;
            const reason = payload.reason || 'Effect processing';
            
            console.log(`🔧 EFFECT_ENGINE: Drawing ${payload.count} ${payload.cardType} card(s) for player ${payload.playerId}`);
            
            try {
              const drawnCards = this.cardService.drawCards(payload.playerId, payload.cardType, payload.count, source, reason);
              console.log(`    ✅ Drew ${drawnCards.length} card(s): ${drawnCards.join(', ')}`);

              // Show notification for L (Life Event) card draws - these are important!
              if (payload.cardType === 'L' && drawnCards.length > 0 && this.notificationService) {
                const player = this.stateService.getPlayer(payload.playerId);
                if (player) {
                  // Get the card name(s) for a more informative notification
                  const cardNames = drawnCards.map(cardId => {
                    const card = this.dataService?.getCardById(cardId);
                    return card?.name || cardId;
                  });

                  const notificationMessage = drawnCards.length === 1
                    ? `🎲 Life Event: ${cardNames[0]}`
                    : `🎲 Life Events: ${cardNames.join(', ')}`;

                  this.notificationService.notify(
                    {
                      short: 'Life Event!',
                      medium: notificationMessage,
                      detailed: `Drew ${drawnCards.length} Life Event card(s): ${cardNames.join(', ')}`
                    },
                    {
                      playerId: payload.playerId,
                      playerName: player.name,
                      actionType: 'card_draw_L',
                      notificationDuration: 5000  // Show for 5 seconds since it's important
                    }
                  );
                }
              }

              // Special handling for OWNER-FUND-INITIATION: automatically play drawn funding cards
              console.log(`🔍 BUG #2 DEBUG: Checking OWNER-FUND-INITIATION auto-play condition`);
              console.log(`    - context.metadata?.spaceName = "${context.metadata?.spaceName}"`);
              console.log(`    - drawnCards.length = ${drawnCards.length}`);
              console.log(`    - Card type = ${payload.cardType}`);

              if (context.metadata?.spaceName === 'OWNER-FUND-INITIATION' && drawnCards.length > 0) {
                console.log(`    💰 OWNER-FUND-INITIATION: Automatically playing drawn funding card: ${drawnCards[0]}`);

                // Get card details for auto-action event
                const drawnCardData = this.dataService?.getCardById(drawnCards[0]);
                const cardName = drawnCardData?.card_name || `${payload.cardType} Card`;
                const fundingPlayer = this.stateService.getPlayer(payload.playerId);
                const fundingType = payload.cardType === 'B' ? 'Bank' : 'Investment';

                // Emit auto-action event for seed money modal
                this.stateService.emitAutoAction({
                  type: 'seed_money',
                  playerId: payload.playerId,
                  playerName: fundingPlayer?.name || 'Unknown',
                  cardType: payload.cardType,
                  cardName: cardName,
                  cardId: drawnCards[0],
                  success: true,
                  spaceName: 'OWNER-FUND-INITIATION',
                  message: `🏠 Owner Seed Money: ${cardName} (${fundingType} funding approved)`
                });

                const playCardEffects = drawnCards.map(cardId => ({
                  effectType: 'PLAY_CARD' as const,
                  payload: {
                    playerId: payload.playerId,
                    cardId: cardId,
                    source: `auto_play:OWNER-FUND-INITIATION`
                  }
                }));

                console.log(`    💰 Created ${playCardEffects.length} PLAY_CARD effect(s) to auto-apply funding`);
                return {
                  success: true,
                  effectType: effect.effectType,
                  resultingEffects: playCardEffects,
                  data: { cardIds: drawnCards }
                };
              } else {
                console.log(`    ⚠️ OWNER-FUND-INITIATION auto-play NOT triggered (condition not met)`);
              }
              
              // Log to action log if available
              const player = this.stateService.getPlayer(payload.playerId);
              if (player && typeof window !== 'undefined' && typeof (window as any).addActionToLog === 'function') {
                (window as any).addActionToLog({
                  type: 'card_draw',
                  playerId: payload.playerId,
                  playerName: player.name,
                  description: `Drew ${payload.count} ${payload.cardType} card${payload.count > 1 ? 's' : ''}`,
                  details: {
                    cards: drawnCards
                  }
                });
              }
              
              // Store drawn cards in result for potential use by other effects
              return {
                success: true,
                effectType: effect.effectType,
                data: { cardIds: drawnCards },
                resultingEffects: [{
                  effectType: 'LOG',
                  payload: {
                    message: `Drew ${drawnCards.length} ${payload.cardType} card(s): ${drawnCards.join(', ')}`,
                    level: 'INFO',
                    source,
                    action: 'card_draw',
                    playerId: payload.playerId
                  }
                }]
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown card draw error';
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to draw ${payload.count} ${payload.cardType} cards for player ${payload.playerId}: ${errorMessage}`
              };
            }
          }
          break;

        case 'CARD_DISCARD':
          if (isCardDiscardEffect(effect)) {
            const { payload } = effect;
            const source = payload.source || context.source;
            const reason = payload.reason || 'Effect processing';
            let cardIdsToDiscard = payload.cardIds;
            
            // If cardIds is empty but cardType and count are provided, determine cards at runtime
            if ((!cardIdsToDiscard || cardIdsToDiscard.length === 0) && payload.cardType && payload.count) {
              console.log(`🔧 EFFECT_ENGINE: Finding ${payload.count} ${payload.cardType} card(s) to discard for player ${payload.playerId}`);
              
              // Get all cards of the specified type from the player's hand
              const allCardsOfType = this.cardService.getPlayerCards(payload.playerId, payload.cardType);
              
              // Take the first 'count' cards from that list
              if (allCardsOfType.length > 0) {
                cardIdsToDiscard = allCardsOfType.slice(0, payload.count);
              }
              
              if (cardIdsToDiscard.length === 0) {
                console.log(`    ⚠️  Player ${payload.playerId} has no ${payload.cardType} cards to discard - effect skipped`);
                break; // Skip this effect if no cards can be discarded
              }
            }
            
            console.log(`🔧 EFFECT_ENGINE: Discarding ${cardIdsToDiscard.length} card(s) for player ${payload.playerId}`);
            console.log(`    Card IDs: ${cardIdsToDiscard.join(', ')}`);
            
            try {
              const discardResult = await this.cardService.discardCards(payload.playerId, cardIdsToDiscard, source, reason);

              if (!discardResult) {
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: `Failed to discard cards for player ${payload.playerId}: Card discard operation failed`
                };
              }

              console.log(`    ✅ Successfully discarded ${cardIdsToDiscard.length} card(s)`);
              return {
                success: true,
                effectType: effect.effectType,
                data: { cardIds: cardIdsToDiscard }
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown card discard error';
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to discard cards for player ${payload.playerId}: ${errorMessage}`
              };
            }
          }
          break;

        case 'CHOICE':
          if (isChoiceEffect(effect)) {
            const { payload } = effect;
            
            console.log(`🔧 EFFECT_ENGINE: Presenting ${payload.type} choice to player ${payload.playerId}`);
            console.log(`    Prompt: "${payload.prompt}"`);
            console.log(`    Options: ${payload.options.map(opt => `${opt.id}:${opt.label}`).join(', ')}`);
            
            try {
              const selection = await this.choiceService.createChoice(payload.playerId, payload.type, payload.prompt, payload.options);
              console.log(`    ✅ Player selected: ${selection}`);
              
              // Return success with the selection - calling code can handle the choice result
              return {
                success: true,
                effectType: effect.effectType,
                resultingEffects: [{
                  effectType: 'LOG',
                  payload: {
                    message: `Player ${payload.playerId} selected "${selection}" for ${payload.type} choice`,
                    level: 'INFO',
                    source: context.source,
                    action: 'choice_made'
                  }
                }]
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown choice error';
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to present choice to player ${payload.playerId}: ${errorMessage}`
              };
            }
          }
          break;

        case 'LOG':
          if (isLogEffect(effect)) {
            const { payload } = effect;

            const logPayload: LogPayload = {
              source: payload.source || context.source,
              ...context.metadata,
              action: payload.action,
            };

            // Check for playerId in payload first, then context
            const playerId = payload.playerId || context.playerId;
            if (playerId) {
              const player = this.stateService.getPlayer(playerId);
              logPayload.playerId = playerId;
              logPayload.playerName = player?.name || 'Unknown Player';
            }

            switch (payload.level) {
              case 'INFO':
                this.loggingService.info(payload.message, logPayload);
                break;
              case 'WARN':
                this.loggingService.warn(payload.message, logPayload);
                break;
              case 'ERROR':
                this.loggingService.error(payload.message, new Error(payload.message), logPayload);
                break;
            }
            success = true;
          }
          break;

        case 'PLAYER_MOVEMENT':
          if (isPlayerMovementEffect(effect)) {
            const { payload } = effect;
            const source = payload.source || context.source;
            const reason = payload.reason || 'Effect processing';
            
            console.log(`🔧 EFFECT_ENGINE: Moving player ${payload.playerId} to ${payload.destinationSpace}`);
            
            try {
              const updatedState = await this.movementService.movePlayer(payload.playerId, payload.destinationSpace);
              console.log(`    ✅ Successfully moved player to ${payload.destinationSpace}`);
              
              // Log the movement
              return {
                success: true,
                effectType: effect.effectType,
                resultingEffects: [{
                  effectType: 'LOG',
                  payload: {
                    message: `Player ${payload.playerId} moved to ${payload.destinationSpace} (${reason})`,
                    level: 'INFO',
                    source,
                    action: 'player_movement'
                  }
                }]
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown movement error';
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to move player ${payload.playerId} to ${payload.destinationSpace}: ${errorMessage}`
              };
            }
          }
          break;

        case 'TURN_CONTROL':
          if (isTurnControlEffect(effect)) {
            const { payload } = effect;
            console.log(`🔄 EFFECT_ENGINE: Executing turn control action: ${payload.action} for player ${payload.playerId}`);
            console.log(`    Source: ${payload.source || context.source}`);
            console.log(`    Reason: ${payload.reason || 'Effect processing'}`);
            
            try {
              // Execute turn control action through TurnService
              if (payload.action === 'SKIP_TURN') {
                success = this.turnService.setTurnModifier(payload.playerId, payload.action);
              } else if (payload.action === 'GRANT_REROLL') {
                const player = this.stateService.getPlayer(payload.playerId);
                if (player) {
                  this.stateService.updatePlayer({
                    id: payload.playerId,
                    turnModifiers: {
                      ...player.turnModifiers,
                      skipTurns: player.turnModifiers?.skipTurns || 0,
                      canReRoll: true
                    }
                  });
                  success = true;
                  console.log(`✅ Granted re-roll ability to player ${payload.playerId}`);
                } else {
                  console.error(`❌ Player ${payload.playerId} not found for re-roll grant`);
                  success = false;
                }
              } else {
                console.warn(`Unsupported turn control action "${payload.action}" encountered and ignored.`);
                success = true; // The effect is "successfully" ignored, not a failure.
              }
              
              if (success) {
                console.log(`✅ Turn control applied: ${payload.action} for player ${payload.playerId}`);
              } else {
                console.error(`❌ Failed to apply turn control: ${payload.action} for player ${payload.playerId}`);
              }
            } catch (error) {
              console.error(`❌ Error applying turn control:`, error);
              success = false;
            }
          }
          break;

        case 'CARD_ACTIVATION':
          if (isCardActivationEffect(effect)) {
            const { payload } = effect;
            console.log(`🎴 EFFECT_ENGINE: Activating card ${payload.cardId} for player ${payload.playerId} for ${payload.duration} turns`);
            console.log(`    Source: ${payload.source || context.source}`);
            console.log(`    Reason: ${payload.reason || 'Effect processing'}`);
            
            
            try {
              // Activate card through CardService
              this.cardService.activateCard(payload.playerId, payload.cardId, payload.duration);
              success = true;
              
              console.log(`✅ Card ${payload.cardId} activated successfully for ${payload.duration} turns`);
            } catch (error) {
              console.error(`❌ Error activating card ${payload.cardId}:`, error);
              success = false;
            }
          }
          break;

        case 'EFFECT_GROUP_TARGETED':
          if (isEffectGroupTargetedEffect(effect)) {
            const { payload } = effect;
            console.log(`🎯 EFFECT_ENGINE: Processing targeted effect - ${payload.targetType}`);
            console.log(`    Source: ${payload.source || context.source}`);
            console.log(`    Prompt: ${payload.prompt}`);
            
            
            try {
              success = await this.processTargetedEffect(payload, context);
            } catch (error) {
              console.error(`❌ Error processing targeted effect:`, error);
              success = false;
            }
          }
          break;

        case 'RECALCULATE_SCOPE':
          // DEPRECATED: Project scope is now calculated on-demand from W cards
          // This effect is kept for backwards compatibility but does nothing
          console.log(`📊 RECALCULATE_SCOPE effect is deprecated - project scope calculated on-demand from W cards`);
          success = true; // Mark as success to avoid errors
          break;

        case 'CHOICE_OF_EFFECTS':
          if (isChoiceOfEffectsEffect(effect)) {
            const { payload } = effect;
            
            console.log(`🎯 EFFECT_ENGINE: Processing choice effect for player ${payload.playerId}`);
            
            // Present choice to player using ChoiceService
            const choiceOptions = payload.options.map((option, index) => ({
              id: index.toString(),
              label: option.label
            }));

            const selectedOptionId = await this.choiceService.createChoice(
              payload.playerId,
              'GENERAL',
              payload.prompt,
              choiceOptions
            );

            const chosenOptionIndex = parseInt(selectedOptionId, 10);
            const chosenOption = payload.options[chosenOptionIndex];
            
            if (!chosenOption) {
              console.error(`🎯 EFFECT_ENGINE: Invalid choice option index: ${chosenOptionIndex}`);
              return {
                success: false,
                effectType: effect.effectType,
                error: 'Invalid choice option selected'
              };
            }
            
            console.log(`🎯 Player chose: "${chosenOption.label}"`);
            
            // Recursively process the chosen effects
            const chosenEffectContext: EffectContext = {
              ...context,
              source: `Choice: ${chosenOption.label}`
            };
            
            const batchResult = await this.processEffects(chosenOption.effects, chosenEffectContext);
            success = batchResult.success;
            
            if (!success) {
              console.error(`🎯 EFFECT_ENGINE: Failed to process chosen effects: ${batchResult.errors.join(', ')}`);
            }
          }
          break;

        case 'CONDITIONAL_EFFECT':
          if (isConditionalEffect(effect)) {
            const { payload } = effect;
            const source = payload.source || context.source;
            const reason = payload.reason || 'Conditional effect processing';
            
            console.log(`🎲 EFFECT_ENGINE: Processing conditional effect for player ${payload.playerId}`);
            
            // Get dice roll from context
            const diceRoll = context.diceRoll;
            if (diceRoll === undefined) {
              console.error(`🎲 EFFECT_ENGINE: No dice roll provided in context for conditional effect`);
              return {
                success: false,
                effectType: effect.effectType,
                error: 'No dice roll provided for conditional effect'
              };
            }
            
            console.log(`🎲 Evaluating dice roll: ${diceRoll}`);
            
            // Find the matching range
            let matchingEffects: Effect[] = [];
            for (const range of payload.condition.ranges) {
              if (diceRoll >= range.min && diceRoll <= range.max) {
                matchingEffects = range.effects;
                console.log(`🎯 Dice roll ${diceRoll} matches range ${range.min}-${range.max}, executing ${range.effects.length} effect(s)`);
                break;
              }
            }
            
            if (matchingEffects.length === 0) {
              console.log(`🎲 Dice roll ${diceRoll} matches no ranges or results in no effects`);
              success = true; // Not an error, just no effects to process
            } else {
              try {
                // Recursively process the matching effects
                const batchResult = await this.processEffects(matchingEffects, context);
                success = batchResult.success;
                
                if (!success) {
                  return {
                    success: false,
                    effectType: effect.effectType,
                    error: `Failed to process conditional effects: ${batchResult.errors.join(', ')}`
                  };
                }
                
                console.log(`✅ Successfully processed ${matchingEffects.length} conditional effect(s)`);
              } catch (error) {
                console.error('🚨 EFFECT_ENGINE: CONDITIONAL_EFFECT error:', error);
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: `Failed to process conditional effects: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
              }
            }
          }
          break;

        case 'PLAY_CARD':
          if (isPlayCardEffect(effect)) {
            const { payload } = effect;
            try {
              console.log(`🎴 EFFECT_ENGINE: Processing PLAY_CARD for ${payload.cardId} (player ${payload.playerId})`);
              console.log(`    Source: ${payload.source}`);

              // Check if this is an auto-play scenario (e.g., OWNER-FUND-INITIATION)
              const isAutoPlay = payload.source?.startsWith('auto_play:');

              if (isAutoPlay) {
                console.log(`    💰 Auto-play detected - applying card effects before finalizing`);
                // For auto-play, we need to apply card effects (they haven't been applied yet)
                await this.cardService.applyCardEffects(payload.playerId, payload.cardId);
                console.log(`    ✅ Card effects applied for ${payload.cardId}`);
              } else {
                console.log(`    ℹ️  Manual play - effects already applied by PlayerActionService`);
              }

              // Finalize card (move to active or discard based on duration)
              this.cardService.finalizePlayedCard(payload.playerId, payload.cardId);
              console.log(`    ✅ Finalized card ${payload.cardId}`);

              success = true;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(`❌ Error finalizing card ${payload.cardId}:`, errorMsg);
              success = false;
              // Store error message for proper error reporting
              return {
                success: false,
                effectType: effect.effectType,
                error: errorMsg
              };
            }
          }
          break;

        case 'DURATION_STORED':
          if (isDurationStoredEffect(effect)) {
            console.log(`⏳ EFFECT_ENGINE: Duration effect stored for processing`);
            success = true;
          }
          break;

        case 'INITIATE_NEGOTIATION':
          if (isInitiateNegotiationEffect(effect)) {
            const { payload } = effect;
            console.log(`🤝 EFFECT_ENGINE: Initiating ${payload.negotiationType} negotiation`);
            console.log(`    Initiator: ${payload.initiatorId}`);
            console.log(`    Targets: ${payload.targetPlayerIds.join(', ')}`);

            try {
              if (!this.negotiationService) {
                console.error('❌ NegotiationService not available for INITIATE_NEGOTIATION effect');
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: 'NegotiationService not available'
                };
              }

              const result = await this.negotiationService.initiateNegotiation(payload.initiatorId, {
                type: payload.negotiationType,
                targetPlayerIds: payload.targetPlayerIds,
                context: payload.context,
                source: payload.source || context.source
              });

              if (result.success) {
                console.log(`✅ Negotiation initiated: ${result.negotiationId}`);
                success = true;
              } else {
                console.error(`❌ Failed to initiate negotiation: ${result.message}`);
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: result.message
                };
              }
            } catch (error) {
              console.error(`❌ Error initiating negotiation:`, error);
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to initiate negotiation: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }
          break;

        case 'NEGOTIATION_RESPONSE':
          if (isNegotiationResponseEffect(effect)) {
            const { payload } = effect;
            console.log(`🤝 EFFECT_ENGINE: Processing negotiation response: ${payload.response}`);
            console.log(`    Player: ${payload.respondingPlayerId}`);
            console.log(`    Negotiation: ${payload.negotiationId}`);

            try {
              if (!this.negotiationService) {
                console.error('❌ NegotiationService not available for NEGOTIATION_RESPONSE effect');
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: 'NegotiationService not available'
                };
              }

              let result;
              switch (payload.response) {
                case 'ACCEPT':
                  result = await this.negotiationService.acceptOffer(payload.respondingPlayerId);
                  break;
                case 'DECLINE':
                  result = await this.negotiationService.declineOffer(payload.respondingPlayerId);
                  break;
                case 'COUNTER_OFFER':
                  result = await this.negotiationService.makeOffer(payload.respondingPlayerId, payload.responseData || {});
                  break;
                default:
                  return {
                    success: false,
                    effectType: effect.effectType,
                    error: `Unknown negotiation response: ${payload.response}`
                  };
              }

              if (result.success) {
                console.log(`✅ Negotiation response processed: ${payload.response}`);
                success = true;
              } else {
                console.error(`❌ Failed to process negotiation response: ${result.message}`);
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: result.message
                };
              }
            } catch (error) {
              console.error(`❌ Error processing negotiation response:`, error);
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to process negotiation response: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }
          break;

        case 'PLAYER_AGREEMENT_REQUIRED':
          if (isPlayerAgreementRequiredEffect(effect)) {
            const { payload } = effect;
            console.log(`🤝 EFFECT_ENGINE: Processing player agreement requirement`);
            console.log(`    Requester: ${payload.requesterPlayerId}`);
            console.log(`    Targets: ${payload.targetPlayerIds.join(', ')}`);
            console.log(`    Type: ${payload.agreementType}`);

            try {
              // Create choices for target players to accept or decline the agreement
              const agreementResults = [];

              for (const targetPlayerId of payload.targetPlayerIds) {
                const targetPlayer = this.stateService.getPlayer(targetPlayerId);
                if (!targetPlayer) {
                  console.warn(`Target player ${targetPlayerId} not found, skipping`);
                  continue;
                }

                const choiceResult = await this.choiceService.createChoice(
                  targetPlayerId,
                  'GENERAL',
                  payload.prompt,
                  [
                    { id: 'accept', label: 'Accept' },
                    { id: 'decline', label: 'Decline' }
                  ]
                );

                agreementResults.push({
                  playerId: targetPlayerId,
                  playerName: targetPlayer.name,
                  response: choiceResult,
                  accepted: choiceResult === 'accept'
                });

                console.log(`   Player ${targetPlayer.name} ${choiceResult === 'accept' ? 'accepted' : 'declined'} the agreement`);
              }

              // Store agreement results for other effects to use
              return {
                success: true,
                effectType: effect.effectType,
                resultingEffects: [{
                  effectType: 'LOG',
                  payload: {
                    message: `Agreement request processed: ${agreementResults.filter(r => r.accepted).length}/${agreementResults.length} players accepted`,
                    level: 'INFO',
                    source: payload.source || context.source,
                    action: 'negotiation_resolved'
                  }
                }]
              };
            } catch (error) {
              console.error(`❌ Error processing player agreement:`, error);
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to process player agreement: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }
          break;

        case 'FEE_DEDUCTION':
          if (isFeeDeductionEffect(effect)) {
            const { payload } = effect;
            console.log(`💰 EFFECT_ENGINE: Processing FEE_DEDUCTION`);
            console.log(`    Player: ${payload.playerId}`);
            console.log(`    Fee Type: ${payload.feeType}`);
            console.log(`    Description: ${payload.feeDescription}`);

            try {
              const player = this.stateService.getPlayer(payload.playerId);
              if (!player) {
                console.warn(`Player ${payload.playerId} not found for fee deduction`);
                return {
                  success: false,
                  effectType: effect.effectType,
                  error: `Player ${payload.playerId} not found`
                };
              }

              // Calculate total loan amount from player's loans array
              let feeAmount = 0;
              const totalLoanAmount = (player.loans || []).reduce((sum, loan) => sum + loan.principal, 0);
              console.log(`    Total loan amount: $${totalLoanAmount}`);

              if (payload.feeType === 'LOAN_PERCENTAGE' && totalLoanAmount > 0) {
                // Parse percentage from description
                const feeDesc = payload.feeDescription.toLowerCase();

                // Check for tiered fee structure (e.g., BANK-FUND-REVIEW)
                // "1% for loan of up to $1.4M or 2% for loan between $1.5M and 2.75M or 3% above 2.75M"
                if (feeDesc.includes('1.4m') || feeDesc.includes('2.75m')) {
                  if (totalLoanAmount <= 1400000) {
                    feeAmount = Math.round(totalLoanAmount * 0.01);
                  } else if (totalLoanAmount <= 2750000) {
                    feeAmount = Math.round(totalLoanAmount * 0.02);
                  } else {
                    feeAmount = Math.round(totalLoanAmount * 0.03);
                  }
                  console.log(`    Tiered fee: $${feeAmount} (loan: $${totalLoanAmount})`);
                }
                // Check for fixed percentage (e.g., "5% of amount borrowed")
                else {
                  const percentMatch = feeDesc.match(/(\d+)%/);
                  if (percentMatch) {
                    const percent = parseInt(percentMatch[1]) / 100;
                    feeAmount = Math.round(totalLoanAmount * percent);
                    console.log(`    ${percentMatch[1]}% fee: $${feeAmount} (loan: $${totalLoanAmount})`);
                  }
                }
              } else if (payload.feeType === 'DICE_BASED') {
                // Dice-based fees require a dice roll - for now log and skip
                console.log(`    Dice-based fee - requires dice roll context, skipping calculation`);
                // Log that this fee type is encountered but not yet implemented
                this.loggingService.info(`Fee deduction pending: ${payload.feeDescription} (dice roll required)`, {
                  playerId: payload.playerId,
                  action: 'fee_pending',
                  source: payload.source || context.source
                });
                success = true;
                break;
              } else if (payload.feeType === 'FIXED') {
                // Fixed fees - try to parse amount from description
                const amountMatch = payload.feeDescription.match(/\$?([\d,]+)/);
                if (amountMatch) {
                  feeAmount = parseInt(amountMatch[1].replace(/,/g, ''));
                }
              }

              // Apply the fee deduction if we have an amount
              if (feeAmount > 0) {
                this.resourceService.spendMoney(payload.playerId, feeAmount, payload.source || context.source, payload.feeDescription);
                console.log(`    ✅ Deducted fee: $${feeAmount.toLocaleString()}`);

                // Log the fee deduction
                this.loggingService.info(`Fee paid: $${feeAmount.toLocaleString()} (${payload.feeDescription})`, {
                  playerId: payload.playerId,
                  action: 'fee_deducted',
                  source: payload.source || context.source
                });

                success = true;
              } else if (totalLoanAmount === 0 && payload.feeType === 'LOAN_PERCENTAGE') {
                // No loan means no fee to pay
                console.log(`    ℹ️  No loan amount - fee does not apply`);
                this.loggingService.info(`Fee not applicable: No loan to charge against`, {
                  playerId: payload.playerId,
                  action: 'fee_skipped',
                  source: payload.source || context.source
                });
                success = true;
              } else {
                console.warn(`    ⚠️  Could not calculate fee amount from: ${payload.feeDescription}`);
                success = true; // Don't fail on unparseable fee descriptions
              }
            } catch (error) {
              console.error(`❌ Error processing fee deduction:`, error);
              return {
                success: false,
                effectType: effect.effectType,
                error: `Failed to process fee deduction: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }
          break;

        default:
          // TypeScript exhaustiveness check - this should never be reached
          const _exhaustiveCheck: never = effect;
          return {
            success: false,
            effectType: (effect as any).effectType,
            error: `Unknown effect type: ${(effect as any).effectType}`
          };
      }

      return {
        success,
        effectType: effect.effectType
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during effect processing';
      console.error(`❌ Error processing ${effect.effectType} effect:`, errorMessage);
      
      return {
        success: false,
        effectType: effect.effectType,
        error: errorMessage
      };
    }
  }

  /**
   * Validate a single effect before processing
   * 
   * @param effect Effect to validate
   * @param context Processing context
   * @returns true if effect is valid, false otherwise
   */
  validateEffect(effect: Effect, context: EffectContext): boolean {
    if (!effect || !effect.effectType) {
      console.error('EFFECT_ENGINE: Invalid effect - missing effectType');
      return false;
    }

    // Basic validation based on effect type
    switch (effect.effectType) {
      case 'RESOURCE_CHANGE':
        if (isResourceChangeEffect(effect)) {
          const { payload } = effect;
          if (!payload.playerId || !payload.resource || payload.amount === undefined) {
            console.error('EFFECT_ENGINE: RESOURCE_CHANGE effect missing required fields');
            return false;
          }
        }
        break;

      case 'CARD_DRAW':
        if (isCardDrawEffect(effect)) {
          const { payload } = effect;
          if (!payload.playerId || !payload.cardType || !payload.count || payload.count <= 0) {
            console.error('EFFECT_ENGINE: CARD_DRAW effect missing required fields or invalid count');
            return false;
          }
        }
        break;

      case 'CARD_DISCARD':
        if (isCardDiscardEffect(effect)) {
          const { payload } = effect;
          if (!payload.playerId) {
            console.error('EFFECT_ENGINE: CARD_DISCARD effect missing playerId');
            return false;
          }
          // Either cardIds must be provided, or cardType and count for runtime determination
          if ((!payload.cardIds || payload.cardIds.length === 0) && 
              (!payload.cardType || !payload.count || payload.count <= 0)) {
            console.error('EFFECT_ENGINE: CARD_DISCARD effect must have either cardIds or both cardType and count');
            return false;
          }
        }
        break;

      case 'CHOICE_OF_EFFECTS':
        if (isChoiceOfEffectsEffect(effect)) {
          const { payload } = effect;
          if (!payload.playerId || !payload.prompt || !payload.options || payload.options.length === 0) {
            console.error('EFFECT_ENGINE: CHOICE_OF_EFFECTS effect missing required fields or empty options');
            return false;
          }
          
          // Validate each option
          for (const option of payload.options) {
            if (!option.label || !Array.isArray(option.effects)) {
              console.error('EFFECT_ENGINE: CHOICE_OF_EFFECTS option missing label or effects array');
              return false;
            }
          }
        }
        break;

      case 'CONDITIONAL_EFFECT':
        if (isConditionalEffect(effect)) {
          const { payload } = effect;
          if (!payload.playerId || !payload.condition || !payload.condition.ranges || payload.condition.ranges.length === 0) {
            console.error('EFFECT_ENGINE: CONDITIONAL_EFFECT effect missing required fields or empty ranges');
            return false;
          }
          
          // Validate each range
          for (const range of payload.condition.ranges) {
            if (range.min === undefined || range.max === undefined || range.min > range.max) {
              console.error('EFFECT_ENGINE: CONDITIONAL_EFFECT range has invalid min/max values');
              return false;
            }
            if (!Array.isArray(range.effects)) {
              console.error('EFFECT_ENGINE: CONDITIONAL_EFFECT range missing effects array');
              return false;
            }
          }
        }
        break;

      // Add more validation as needed for other effect types
    }

    return true;
  }

  /**
   * Validate multiple effects before batch processing
   * 
   * @param effects Effects to validate
   * @param context Processing context
   * @returns true if all effects are valid, false otherwise
   */
  validateEffects(effects: Effect[], context: EffectContext): boolean {
    if (!effects || effects.length === 0) {
      console.warn('EFFECT_ENGINE: No effects to validate');
      return true; // Empty array is technically valid
    }

    return effects.every((effect, index) => {
      const isValid = this.validateEffect(effect, context);
      if (!isValid) {
        console.error(`EFFECT_ENGINE: Effect validation failed at index ${index}`);
      }
      return isValid;
    });
  }

  // === DEBUG AND UTILITY METHODS ===

  /**
   * Get a summary of effect types in an array
   */
  getEffectSummary(effects: Effect[]): { [effectType: string]: number } {
    const summary: { [effectType: string]: number } = {};
    effects.forEach(effect => {
      summary[effect.effectType] = (summary[effect.effectType] || 0) + 1;
    });
    return summary;
  }

  /**
   * Process a targeted effect by handling player selection and applying effects
   */
  private async processTargetedEffect(
    payload: Extract<Effect, { effectType: 'EFFECT_GROUP_TARGETED' }>['payload'], 
    context: EffectContext
  ): Promise<boolean> {
    console.log(`🎯 EFFECT_ENGINE: Processing targeted effect with targetType: ${payload.targetType}`);
    
    // Get all players from StateService
    const allPlayers = this.stateService.getAllPlayers();
    const currentPlayerId = context.playerId || 
      (payload.templateEffect.effectType === 'RESOURCE_CHANGE' ? 
        (payload.templateEffect as any).payload?.playerId : null);
    
    if (!currentPlayerId) {
      console.error('Cannot determine current player for targeted effect');
      console.error(`Context playerId: ${context.playerId}`);
      console.error(`Template effect type: ${payload.templateEffect.effectType}`);
      return false;
    }
    
    // Filter players based on target type
    let targetPlayers: string[] = [];
    
    switch (payload.targetType) {
      case 'OTHER_PLAYER_CHOICE':
        // Filter out the current player, then let user choose one
        const otherPlayers = allPlayers.filter(player => player.id !== currentPlayerId);
        
        if (otherPlayers.length === 0) {
          console.log('No other players available for targeting');
          return true; // Not an error, just no valid targets
        }
        
        // BUG-001 FIX: If only one valid target, apply effect automatically
        if (otherPlayers.length === 1) {
          const singleTarget = otherPlayers[0];
          targetPlayers = [singleTarget.id];
          console.log(`🎯 Single target detected - applying effect automatically to: ${singleTarget.name || singleTarget.id}`);
          console.log(`✅ Automatic targeting resolved without ChoiceService`);
          break;
        }
        
        // Multiple targets: present choice to player
        const choice = {
          id: `target_player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          playerId: currentPlayerId,
          type: 'PLAYER_TARGET' as const,
          prompt: payload.prompt,
          options: otherPlayers.map(player => ({
            id: player.id,
            label: player.name || `Player ${player.id}`
          }))
        };
        
        console.log(`🎯 Creating player choice for targeting: ${choice.options.length} options`);
        
        // Use ChoiceService to present the choice and await result
        const chosenTargetId = await this.choiceService.createChoice(
          currentPlayerId,
          'PLAYER_TARGET',
          payload.prompt,
          choice.options
        );
        
        if (!chosenTargetId) {
          console.error('No target selected for targeted effect');
          return false;
        }
        
        targetPlayers = [chosenTargetId];
        console.log(`✅ Player chosen for targeting: ${chosenTargetId}`);
        break;
        
      case 'ALL_OTHER_PLAYERS':
        targetPlayers = allPlayers
          .filter(player => player.id !== currentPlayerId)
          .map(player => player.id);
        console.log(`🎯 Targeting all other players: ${targetPlayers.length} players`);
        break;
        
      case 'ALL_PLAYERS':
        targetPlayers = allPlayers.map(player => player.id);
        console.log(`🎯 Targeting all players: ${targetPlayers.length} players`);
        break;
        
      case 'Self':
        targetPlayers = [currentPlayerId];
        console.log(`🎯 Targeting self: ${currentPlayerId}`);
        break;
        
      default:
        console.error(`Unknown target type: ${payload.targetType}`);
        return false;
    }
    
    if (targetPlayers.length === 0) {
      console.log('No valid targets found for targeted effect');
      return true; // Not an error, just no targets
    }
    
    // Create targeted effects for each target player
    const targetedEffects: Effect[] = [];
    
    for (const targetPlayerId of targetPlayers) {
      // Clone the template effect and update the playerId
      const targetedEffect = this.cloneEffectWithNewPlayerId(payload.templateEffect, targetPlayerId);
      targetedEffects.push(targetedEffect);
    }
    
    console.log(`🎯 Generated ${targetedEffects.length} targeted effects`);
    
    // Process all targeted effects using batch processing
    const batchResult = await this.processEffects(targetedEffects, {
      ...context,
      source: `${context.source}:targeted`,
      triggerEvent: 'CARD_PLAY' // Targeted effects are typically from card play
    });
    
    console.log(`🎯 Targeted effects batch result: ${batchResult.successfulEffects}/${batchResult.totalEffects} successful`);
    
    return batchResult.success;
  }

  /**
   * Clone an effect and replace the playerId with a new target
   */
  private cloneEffectWithNewPlayerId(templateEffect: Effect, newPlayerId: string): Effect {
    // Deep clone the effect object
    const clonedEffect = JSON.parse(JSON.stringify(templateEffect)) as Effect;
    
    // Update playerId in the payload if it exists
    if ('payload' in clonedEffect && typeof clonedEffect.payload === 'object' && clonedEffect.payload !== null) {
      const payload = clonedEffect.payload as any;
      if ('playerId' in payload) {
        payload.playerId = newPlayerId;
      }
    }
    
    return clonedEffect;
  }

  /**
   * Process effects with multi-player targeting support
   */
  async processEffectsWithTargeting(effects: Effect[], context: EffectContext, targetRule?: string): Promise<BatchEffectResult> {
    console.log(`🎯 EFFECT_ENGINE: Processing ${effects.length} effects with targeting rule: ${targetRule || 'None'}`);

    // If no target rule specified, default to current player
    if (!targetRule || targetRule.trim() === 'Self' || targetRule.trim() === '') {
      console.log(`   🎯 No multi-targeting needed, processing normally`);
      return this.processEffects(effects, context);
    }

    // Resolve target players
    const sourcePlayerId = context.playerId;
    if (!sourcePlayerId) {
      console.error(`   🎯 No source player ID in context for targeting`);
      return { success: false, totalEffects: 0, successfulEffects: 0, failedEffects: 0, results: [], errors: ['No source player ID'] };
    }

    const targetPlayerIds = await this.targetingService.resolveTargets(sourcePlayerId, targetRule);
    const targetDescription = this.targetingService.getTargetDescription(targetPlayerIds);
    
    console.log(`   🎯 Resolved targets: ${targetDescription} (${targetPlayerIds.length} players)`);

    if (targetPlayerIds.length === 0) {
      console.log(`   🎯 No valid targets found, skipping effects`);
      return { success: true, totalEffects: effects.length, successfulEffects: 0, failedEffects: 0, results: [], errors: [] };
    }

    // Apply effects to each target player
    let totalSuccessfulEffects = 0;
    const allResults: EffectResult[] = [];
    const allErrors: string[] = [];

    for (const targetPlayerId of targetPlayerIds) {
      console.log(`   🎯 Applying effects to target: ${targetPlayerId}`);
      
      // Clone effects with the correct target player ID
      const targetedEffects = effects.map(effect => this.cloneEffectWithNewPlayerId(effect, targetPlayerId));
      
      // Create targeted context
      const targetedContext: EffectContext = {
        ...context,
        playerId: targetPlayerId,
        source: `${context.source}:targeting:${targetRule}`,
        metadata: {
          ...context.metadata,
          originalSource: sourcePlayerId,
          targetRule: targetRule,
          targetDescription: targetDescription
        }
      };

      // Apply effects to this target using the cloned effects with correct player IDs
      const targetResult = await this.processEffects(targetedEffects, targetedContext);
      totalSuccessfulEffects += targetResult.successfulEffects;
      allResults.push(...targetResult.results);
      
      if (targetResult.errors) {
        allErrors.push(...targetResult.errors);
      }
    }

    const totalExpected = effects.length * targetPlayerIds.length;
    const success = totalSuccessfulEffects === totalExpected;

    console.log(`🎯 Multi-target effects complete: ${totalSuccessfulEffects}/${totalExpected} successful across ${targetPlayerIds.length} players`);

    return {
      success: success,
      totalEffects: totalExpected,
      successfulEffects: totalSuccessfulEffects,
      failedEffects: totalExpected - totalSuccessfulEffects,
      results: allResults,
      errors: allErrors
    };
  }

  /**
   * Process effects considering both duration and targeting - comprehensive effect processing
   */
  async processCardEffects(effects: Effect[], context: EffectContext, cardData?: any): Promise<BatchEffectResult> {
    console.log(`🎯🕒 EFFECT_ENGINE: Processing ${effects.length} card effects with full targeting and duration support`);
    
    const cardId = cardData?.card_id || 'unknown';
    const targetRule = cardData?.target || 'Self';
    const hasDuration = cardData && cardData.duration === 'Turns' && cardData.duration_count && parseInt(cardData.duration_count) > 0;
    const duration = hasDuration ? parseInt(cardData.duration_count) : 0;

    console.log(`   Card: ${cardId}, Target: ${targetRule}, Duration: ${hasDuration ? `${duration} turns` : 'Immediate'}`);

    // First resolve targeting
    const sourcePlayerId = context.playerId;
    if (!sourcePlayerId) {
      console.error(`   No source player ID in context`);
      return { success: false, totalEffects: 0, successfulEffects: 0, failedEffects: 0, results: [], errors: ['No source player ID'] };
    }

    let targetPlayerIds: string[];
    if (!targetRule || targetRule.trim() === 'Self' || targetRule.trim() === '') {
      targetPlayerIds = [sourcePlayerId];
    } else {
      targetPlayerIds = await this.targetingService.resolveTargets(sourcePlayerId, targetRule);
      const targetDescription = this.targetingService.getTargetDescription(targetPlayerIds);
      console.log(`   Resolved targets: ${targetDescription} (${targetPlayerIds.length} players)`);
    }

    if (targetPlayerIds.length === 0) {
      console.log(`   No valid targets found, skipping effects`);
      return { success: true, totalEffects: effects.length, successfulEffects: 0, failedEffects: 0, results: [], errors: [] };
    }

    // Handle duration-based effects
    if (hasDuration) {
      console.log(`   Storing effects as active for ${duration} turns on ${targetPlayerIds.length} players`);
      
      for (const targetPlayerId of targetPlayerIds) {
        for (const effect of effects) {
          // Create targeted version of the effect
          const targetedEffect = { ...effect };
          if (targetedEffect.payload && typeof targetedEffect.payload === 'object') {
            targetedEffect.payload = { ...targetedEffect.payload, playerId: targetPlayerId };
          }
          
          this.addActiveEffect(targetPlayerId, targetedEffect, cardId, duration);
        }
      }

      const totalStored = effects.length * targetPlayerIds.length;
      return {
        success: true,
        totalEffects: totalStored,
        successfulEffects: totalStored,
        failedEffects: 0,
        results: Array(totalStored).fill(null).map(() => ({
          success: true,
          effectType: 'DURATION_STORED',
          message: `Effect stored as active for ${duration} turns`
        })),
        errors: []
      };
    } else {
      // Immediate effects with targeting
      console.log(`   Applying immediate effects to ${targetPlayerIds.length} players`);
      return this.processEffectsWithTargeting(effects, context, targetRule);
    }
  }

  /**
   * Process effects considering duration - if card has duration, store effects as active rather than applying immediately
   */
  async processEffectsWithDuration(effects: Effect[], context: EffectContext, cardData?: any): Promise<BatchEffectResult> {
    console.log(`🕒 EFFECT_ENGINE: Processing ${effects.length} effects with duration consideration`);
    console.log(`🕒 Card data:`, cardData ? `${cardData.card_id} - duration: ${cardData.duration}, count: ${cardData.duration_count}` : 'No card data');

    // Check if this card should have duration-based effects
    const shouldUseDuration = cardData && 
      cardData.duration === 'Turns' && 
      cardData.duration_count && 
      parseInt(cardData.duration_count) > 0;

    if (shouldUseDuration) {
      const duration = parseInt(cardData.duration_count);
      console.log(`🕒 Storing ${effects.length} effects as active for ${duration} turns`);
      
      // Store effects as active rather than applying immediately
      for (const effect of effects) {
        if (context.playerId) {
          this.addActiveEffect(context.playerId, effect, cardData.card_id, duration);
        } else if (effect.payload && 'playerId' in effect.payload) {
          // Effect specifies its own target player
          this.addActiveEffect(effect.payload.playerId as string, effect, cardData.card_id, duration);
        }
      }

      return {
        success: true,
        totalEffects: effects.length,
        successfulEffects: effects.length,
        failedEffects: 0,
        results: effects.map(effect => ({
          success: true,
          effectType: effect.effectType,
          message: `Effect stored as active for ${duration} turns`
        })),
        errors: []
      };
    } else {
      // No duration, process effects immediately as before
      console.log(`🕒 No duration detected, processing effects immediately`);
      return this.processEffects(effects, context);
    }
  }

  /**
   * Add an active effect to a player's activeEffects list
   */
  addActiveEffect(playerId: string, effect: Effect, sourceCardId: string, duration: number): void {
    console.log(`🕒 Adding active effect to player ${playerId} for ${duration} turns`);
    
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      console.error(`Player ${playerId} not found when adding active effect`);
      return;
    }

    const gameState = this.stateService.getGameState();
    const activeEffect = {
      effectId: `${sourceCardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceCardId: sourceCardId,
      effectData: effect,
      remainingDuration: duration,
      startTurn: gameState.turn,
      effectType: effect.effectType,
      description: `Effect from ${sourceCardId} (${duration} turns remaining)`
    };

    const updatedActiveEffects = [...player.activeEffects, activeEffect];
    
    this.stateService.updatePlayer({
      id: playerId,
      activeEffects: updatedActiveEffects
    });

    console.log(`✅ Added active effect ${activeEffect.effectId} to player ${playerId}`);
  }

  /**
   * Apply all active effects for a specific player and decrement their duration
   */
  async applyActiveEffects(playerId: string): Promise<void> {
    console.log(`🔄 Applying active effects for player ${playerId}`);
    
    const player = this.stateService.getPlayer(playerId);
    if (!player || !player.activeEffects || player.activeEffects.length === 0) {
      console.log(`   No active effects for player ${playerId}`);
      return;
    }

    console.log(`   Processing ${player.activeEffects.length} active effects`);
    const remainingEffects = [];

    for (const activeEffect of player.activeEffects) {
      console.log(`   Applying effect ${activeEffect.effectId} (${activeEffect.remainingDuration} turns remaining)`);
      
      try {
        // Create a copy of the effect with updated source for active processing
        const activeEffectData = { ...activeEffect.effectData };
        if (activeEffectData.payload && typeof activeEffectData.payload === 'object') {
          activeEffectData.payload = { 
            ...activeEffectData.payload, 
            source: `active:${activeEffect.sourceCardId}` 
          };
        }

        // Apply the effect with updated source
        await this.processEffect(activeEffectData, {
          source: `active:${activeEffect.sourceCardId}`,
          playerId: playerId,
          triggerEvent: 'ACTIVE_EFFECT'
        });

        // Decrement duration
        activeEffect.remainingDuration -= 1;

        // Keep effect if it still has duration remaining
        if (activeEffect.remainingDuration > 0) {
          remainingEffects.push({
            ...activeEffect,
            description: `Effect from ${activeEffect.sourceCardId} (${activeEffect.remainingDuration} turns remaining)`
          });
          console.log(`   Effect ${activeEffect.effectId} continues for ${activeEffect.remainingDuration} more turns`);
        } else {
          console.log(`   Effect ${activeEffect.effectId} expired and removed`);
        }
      } catch (error) {
        console.error(`   Error applying active effect ${activeEffect.effectId}:`, error);
        // Keep the effect to retry next turn
        remainingEffects.push(activeEffect);
      }
    }

    // Update player's active effects
    this.stateService.updatePlayer({
      id: playerId,
      activeEffects: remainingEffects
    });

    console.log(`✅ Active effects processed for ${playerId}: ${remainingEffects.length} effects remaining`);
  }

  /**
   * Process active effects for all players (called at turn transitions)
   */
  async processActiveEffectsForAllPlayers(): Promise<void> {
    console.log(`🌍 Processing active effects for all players`);
    
    const gameState = this.stateService.getGameState();
    const players = gameState.players;

    for (const player of players) {
      await this.applyActiveEffects(player.id);
    }

    console.log(`✅ Completed processing active effects for all ${players.length} players`);
  }

  /**
   * Create a negotiation initiation effect
   */
  createNegotiationEffect(
    initiatorId: string,
    targetPlayerIds: string[],
    negotiationType: 'CARD_EXCHANGE' | 'RESOURCE_TRADE' | 'FAVOR_REQUEST' | 'ALLIANCE_PROPOSAL',
    context: {
      description: string;
      requiresAgreement: boolean;
      offerData?: any;
      requestData?: any;
    },
    source?: string
  ): Effect {
    return {
      effectType: 'INITIATE_NEGOTIATION',
      payload: {
        initiatorId,
        targetPlayerIds,
        negotiationType,
        context,
        source
      }
    };
  }

  /**
   * Create a player agreement requirement effect
   */
  createPlayerAgreementEffect(
    requesterPlayerId: string,
    targetPlayerIds: string[],
    agreementType: 'CARD_TRANSFER' | 'RESOURCE_SHARE' | 'JOINT_ACTION' | 'PROTECTION_DEAL',
    agreementData: any,
    prompt: string,
    source?: string
  ): Effect {
    return {
      effectType: 'PLAYER_AGREEMENT_REQUIRED',
      payload: {
        requesterPlayerId,
        targetPlayerIds,
        agreementType,
        agreementData,
        prompt,
        source
      }
    };
  }

  /**
   * Create a negotiation response effect
   */
  createNegotiationResponseEffect(
    respondingPlayerId: string,
    negotiationId: string,
    response: 'ACCEPT' | 'DECLINE' | 'COUNTER_OFFER',
    responseData?: any,
    source?: string
  ): Effect {
    return {
      effectType: 'NEGOTIATION_RESPONSE',
      payload: {
        respondingPlayerId,
        negotiationId,
        response,
        responseData,
        source
      }
    };
  }
}