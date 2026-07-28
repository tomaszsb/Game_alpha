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
  INotificationService,
  IFinancialEffectHandler,
  ICardEffectHandler
} from '../types/ServiceContracts';
import { Card } from '../types/DataTypes';
import { debugWarn } from '../utils/debugLog';
import { computeContractorTerms } from '../utils/contractorTerms';
import { calculateOwnerSeedMoney } from '../utils/ownerSeedMoney';
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
  processCardEffects(effects: Effect[], context: EffectContext, cardData?: Card): Promise<BatchEffectResult>;

  // Multi-player targeting methods
  processEffectsWithTargeting(effects: Effect[], context: EffectContext, targetRule?: string): Promise<BatchEffectResult>;

  // Duration-based effect methods
  processEffectsWithDuration(effects: Effect[], context: EffectContext, cardData?: Card): Promise<BatchEffectResult>;
  applyActiveEffects(playerId: string): Promise<void>;
  addActiveEffect(playerId: string, effect: Effect, sourceCardId: string, duration: number): void;
  processActiveEffectsForCurrentPlayer(currentPlayerId: string): Promise<void>;
  
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
  private notificationService?: INotificationService;
  private financialEffectHandler?: IFinancialEffectHandler;
  private cardEffectHandler?: ICardEffectHandler;

  constructor(
    resourceService: IResourceService,
    cardService: ICardService,
    choiceService: IChoiceService,
    stateService: IStateService,
    movementService: IMovementService,
    turnService: ITurnService,
    gameRulesService: IGameRulesService,
    targetingService: ITargetingService,
    loggingService: ILoggingService,
    dataService?: IDataService,
    notificationService?: INotificationService,
    financialEffectHandler?: IFinancialEffectHandler,
    cardEffectHandler?: ICardEffectHandler
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
    this.dataService = dataService;
    this.notificationService = notificationService;
    this.financialEffectHandler = financialEffectHandler;
    this.cardEffectHandler = cardEffectHandler;
  }

  // Circular dependency resolution — TurnService is part of the 3-way
  // Turn↔EffectEngine↔Card cycle. See docs/technical/ARCHITECTURE.md.
  public setTurnService(turnService: ITurnService): void {
    this.turnService = turnService;
  }

  /**
   * Passthrough to FinancialEffectHandler.checkBankruptcy — lets TurnService
   * (which doesn't hold FinancialEffectHandler directly) share the one
   * mandatory-bill bankruptcy rule instead of duplicating it. No-ops if no
   * financialEffectHandler is wired (e.g. some test setups).
   */
  public checkBankruptcy(playerId: string): void {
    this.financialEffectHandler?.checkBankruptcy(playerId);
  }

  /**
   * Assert that critical setter-injected dependencies are initialized.
   * Some services (notificationService, dataService) are optional and handled with null checks.
   * TurnService is required for specific effect types.
   * @throws Error if TurnService is not set (required for TURN_MODIFIER effects)
   */
  private assertCoreDependenciesReady(): void {
    if (!this.turnService) {
      throw new Error(
        'EffectEngineService not fully initialized: TurnService not set. ' +
        'Call setTurnService() before processing effects.'
      );
    }
    // Note: negotiationService is checked inline where needed (only for negotiation effects)
    // Note: notificationService and dataService are optional (used with null checks)
  }

  /**
   * Process multiple effects as a batch operation
   * 
   * @param effects Array of effects to process
   * @param context Processing context including source and metadata
   * @returns Promise resolving to batch processing results
   */
  async processEffects(effects: Effect[], context: EffectContext): Promise<BatchEffectResult> {
    // Ensure core setter-injected dependencies are ready
    this.assertCoreDependenciesReady();

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
        debugWarn(`⚠️ Effect batch size approaching limit: ${effects.length}/${EffectEngineService.MAX_EFFECTS_PER_BATCH}`);
      }

      const effect = effects[i];

      // Check if this is a dice_replace_draw effect and the previous discard was skipped
      if (effect.effectType === 'CARD_DRAW' &&
          'payload' in effect &&
          effect.payload.source?.includes(':dice_replace_draw')) {
        // Look for the previous CARD_DISCARD result
        const prevResult = results.length > 0 ? results[results.length - 1] : null;
        if (prevResult && prevResult.effectType === 'CARD_DISCARD' && prevResult.data?.skipped) {
          results.push({
            success: true,
            effectType: effect.effectType,
            data: { cardIds: [], skipped: true, reason: 'Replace was skipped' }
          });
          successfulEffects++;
          continue;
        }
      }

      try {
        const result = await this.processEffect(effect, context);
        results.push(result);

        if (result.success) {
          successfulEffects++;

          // Handle resultingEffects - add them to the effects array to be processed
          if (result.resultingEffects && result.resultingEffects.length > 0) {
            effects.push(...result.resultingEffects);
          }
        } else {
          failedEffects++;
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

    if (errors.length > 0) {
      debugWarn(`   Errors encountered:`, errors);
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
          // Delegate to FinancialEffectHandler (required)
          if (!this.financialEffectHandler) {
            throw new Error('FinancialEffectHandler not set - call setFinancialEffectHandler() before processing effects');
          }
          return this.financialEffectHandler.handleResourceChange(effect, context);

        case 'OWNER_SEED_MONEY':
          // Calculate owner seed money as 80-120% of project scope
          {
            const { payload } = effect;
            const source = payload.source || context.source;
            const reason = payload.reason || "Owner's personal seed money investment";

            // Get project scope from GameRulesService
            const projectScope = this.gameRulesService.calculateProjectScope(payload.playerId);

            // Calculate seed money: 80-120% of project scope, rounded to
            // nearest $10,000. Shared with TurnService.handleAutomaticFunding's
            // direct-arrival path via calculateOwnerSeedMoney so both funding
            // flows can't drift apart.
            const { multiplier: seedMoneyMultiplier, amount: ownerSeedMoney } = calculateOwnerSeedMoney(projectScope);


            // Add money with 'owner' source type
            this.resourceService.addMoney(
              payload.playerId,
              ownerSeedMoney,
              source,
              `${reason}: $${ownerSeedMoney.toLocaleString()} (${(seedMoneyMultiplier * 100).toFixed(0)}% of scope)`,
              'owner'
            );

            // Store funding result so ActionCenterPanel can show it persistently
            const fundingMessage = `Owner invested $${ownerSeedMoney.toLocaleString()} as seed money (${(seedMoneyMultiplier * 100).toFixed(0)}% of project scope)`;
            this.stateService.setDiceRollCompletion(fundingMessage);

            // Also store project scope on the player
            this.stateService.updatePlayer({
              id: payload.playerId,
              projectScope: projectScope
            });

            // Emit auto-action event for notification
            const player = this.stateService.getPlayer(payload.playerId);
            if (player) {
              this.stateService.emitGameEvent({
                type: 'seed_money',
                playerId: payload.playerId,
                playerName: player.name,
                cardType: 'Owner',
                cardName: "Owner's Personal Investment",
                amount: ownerSeedMoney,
                spaceName: player.currentSpace,
                message: `${player.name} invested $${ownerSeedMoney.toLocaleString()} of their own money (${(seedMoneyMultiplier * 100).toFixed(0)}% of project scope)`
              });
            }

            success = true;
          }
          break;

        case 'CONTRACTOR_UPDATE':
          // CON-INITIATION's dice rolls hire a contractor. Quality / Multiplier
          // come from DICE_EFFECTS.csv via EffectFactory.parseDiceEffect.
          // Both update player.contractor; multiplier also triggers immediate
          // construction-cost deduction via the formula:
          //   cost = totalWorkCost × (multiplier × 0.1) × qualityCoefficient
          // Quality coefficients: HIGH=1.5, MED=1.0, LOW=0.6.
          {
            const { payload } = effect;
            const player = this.stateService.getPlayer(payload.playerId);
            if (!player) {
              throw new Error(`Player ${payload.playerId} not found for CONTRACTOR_UPDATE`);
            }

            const existingContractor = player.contractor || { quality: 'MED' as const, multiplier: 1 };

            if (payload.kind === 'quality') {
              const raw = payload.value.toUpperCase().trim();
              const quality: 'HIGH' | 'MED' | 'LOW' =
                raw === 'HIGH' ? 'HIGH'
                  : (raw === 'MED' || raw === 'MEDIUM') ? 'MED'
                  : raw === 'LOW' ? 'LOW'
                  : 'MED';
              this.stateService.updatePlayer({
                id: payload.playerId,
                contractor: {
                  ...existingContractor,
                  quality,
                  hiredAt: player.currentSpace
                }
              });
            } else {
              // multiplier: parse 1..6, default 3 if malformed
              const parsed = parseInt(payload.value.trim(), 10);
              const multiplier = (!isNaN(parsed) && parsed >= 1 && parsed <= 6) ? parsed : 3;
              this.stateService.updatePlayer({
                id: payload.playerId,
                contractor: {
                  ...existingContractor,
                  multiplier,
                  hiredAt: player.currentSpace
                }
              });

              // Charge the agreed price + add the crew's schedule, both from the
              // shared computeContractorTerms helper (v3.0.92: bid centered on
              // the scope estimate, schedule varies with roll + crew quality —
              // maintainer call "A and C", 2026-07-02).
              const updatedPlayer = this.stateService.getPlayer(payload.playerId);
              const contractor = updatedPlayer?.contractor;
              let chargedConstructionCost = 0;
              let scheduleDaysAdded = 0;
              if (contractor) {
                const totalWorkCost = this.gameRulesService.calculateTotalWorkCost(payload.playerId);
                if (totalWorkCost > 0) {
                  const terms = computeContractorTerms(totalWorkCost, contractor.multiplier, contractor.quality);
                  const constructionCost = terms.cost;

                  // The crew's schedule lands regardless of the money charge —
                  // the work takes the time it takes.
                  if (terms.scheduleDays > 0) {
                    this.resourceService.addTime(
                      payload.playerId,
                      terms.scheduleDays,
                      payload.source || context.source,
                      `Construction schedule: ${contractor.quality} quality crew at ${contractor.multiplier}× — ${terms.scheduleDays} days`
                    );
                    scheduleDaysAdded = terms.scheduleDays;
                  }

                  if (constructionCost > 0) {
                    // The signing charge is a MANDATORY bill — the dice committed
                    // the player to this contract. Charge in full, into the red
                    // if needed (allowNegative), so an unpayable contract drives
                    // real bankruptcy exactly like the design/regulatory fees do
                    // (v3.0.91 rule). Pre-v3.0.92 this silently no-oped when
                    // unaffordable — a signed contract that cost nothing.
                    // Record the expenditure ONLY if the charge went through —
                    // recording an unpaid cost is the exact ledger-vs-cash
                    // mismatch the v3.0.91 money fix removed (fb:f0bdd78a).
                    const paid = this.resourceService.spendMoney(
                      payload.playerId,
                      constructionCost,
                      payload.source || context.source,
                      `Contractor hired: ${contractor.quality} quality, multiplier ${contractor.multiplier} — $${constructionCost.toLocaleString()}`,
                      undefined,
                      true
                    );
                    const refreshed = paid ? this.stateService.getPlayer(payload.playerId) : null;
                    if (paid) {
                      chargedConstructionCost = constructionCost;
                    }
                    if (refreshed) {
                      // Record through TEMP state (not updatePlayer): the turn-commit
                      // snapshot tracks `expenditures` + `costHistory`, so a real-state
                      // write here would be clobbered when the turn commits. Design
                      // fees use this same path (trackDesignExpenditure).
                      const gameState = this.stateService.getGameState();
                      const currentTurn = gameState.globalTurnCount || 0;
                      const currentConstruction = refreshed.expenditures?.construction || 0;
                      const costHistory = [...(refreshed.costHistory || [])];
                      costHistory.push({
                        id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        category: 'construction',
                        amount: constructionCost,
                        description: `Construction: ${contractor.quality} quality × multiplier ${contractor.multiplier}`,
                        turn: currentTurn,
                        timestamp: new Date(),
                        spaceName: refreshed.currentSpace
                      });
                      this.stateService.updateTempState(payload.playerId, {
                        expenditures: {
                          ...refreshed.expenditures,
                          construction: currentConstruction + constructionCost
                        },
                        costHistory
                      });
                    }
                    // An unpayable contract ends the project — same single
                    // bankruptcy rule the mandatory fees use.
                    this.financialEffectHandler?.checkBankruptcy(payload.playerId);
                  }
                }
              }
              // Surface the agreed price + schedule so the dice modal can show
              // the real terms, not just "multiplier 6×" (fb:40caa223).
              return {
                success: true,
                effectType: effect.effectType,
                data: (chargedConstructionCost > 0 || scheduleDaysAdded > 0)
                  ? { constructionCost: chargedConstructionCost, scheduleDays: scheduleDaysAdded }
                  : undefined
              };
            }
            success = true;
          }
          break;

        case 'CARD_DRAW':
          // Delegate to CardEffectHandler (required)
          if (!this.cardEffectHandler) {
            throw new Error('CardEffectHandler not set - call setCardEffectHandler() before processing effects');
          }
          return this.cardEffectHandler.handleCardDraw(effect, context);

        case 'CARD_DISCARD':
          // Delegate to CardEffectHandler (required)
          if (!this.cardEffectHandler) {
            throw new Error('CardEffectHandler not set - call setCardEffectHandler() before processing effects');
          }
          return this.cardEffectHandler.handleCardDiscard(effect, context);

        case 'CHOICE':
          if (isChoiceEffect(effect)) {
            const { payload } = effect;
            
            
            try {
              const selection = await this.choiceService.createChoice(payload.playerId, payload.type, payload.prompt, payload.options);
              
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
            
            
            try {
              const updatedState = await this.movementService.movePlayer(payload.playerId, payload.destinationSpace);
              
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
                } else {
                  console.error(`❌ Player ${payload.playerId} not found for re-roll grant`);
                  success = false;
                }
              } else {
                debugWarn(`Unsupported turn control action "${payload.action}" encountered and ignored.`);
                success = true; // The effect is "successfully" ignored, not a failure.
              }
              
              if (!success) {
                console.error(`❌ Failed to apply turn control: ${payload.action} for player ${payload.playerId}`);
              }
            } catch (error) {
              console.error(`❌ Error applying turn control:`, error);
              success = false;
            }
          }
          break;

        case 'CARD_ACTIVATION':
          if (!this.cardEffectHandler) {
            throw new Error('CardEffectHandler not set - call setCardEffectHandler() before processing effects');
          }
          return this.cardEffectHandler.handleCardActivation(effect, context);

        case 'EFFECT_GROUP_TARGETED':
          if (isEffectGroupTargetedEffect(effect)) {
            const { payload } = effect;
            
            
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
          success = true; // Mark as success to avoid errors
          break;

        case 'CHOICE_OF_EFFECTS':
          if (isChoiceOfEffectsEffect(effect)) {
            const { payload } = effect;
            
            
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
            
            
            // Find the matching range
            let matchingEffects: Effect[] = [];
            for (const range of payload.condition.ranges) {
              if (diceRoll >= range.min && diceRoll <= range.max) {
                matchingEffects = range.effects;
                break;
              }
            }
            
            if (matchingEffects.length === 0) {
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
          if (!this.cardEffectHandler) {
            throw new Error('CardEffectHandler not set - call setCardEffectHandler() before processing effects');
          }
          return this.cardEffectHandler.handlePlayCard(effect, context);

        case 'DURATION_STORED':
          if (isDurationStoredEffect(effect)) {
            success = true;
          }
          break;

        case 'PLAYER_AGREEMENT_REQUIRED':
          if (isPlayerAgreementRequiredEffect(effect)) {
            const { payload } = effect;

            try {
              // Create choices for target players to accept or decline the agreement
              const agreementResults = [];

              for (const targetPlayerId of payload.targetPlayerIds) {
                const targetPlayer = this.stateService.getPlayer(targetPlayerId);
                if (!targetPlayer) {
                  debugWarn(`Target player ${targetPlayerId} not found, skipping`);
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
          // Delegate to FinancialEffectHandler (required)
          if (!this.financialEffectHandler) {
            throw new Error('FinancialEffectHandler not set - call setFinancialEffectHandler() before processing effects');
          }
          return this.financialEffectHandler.handleFeeDeduction(effect, context);

        default: {
          // TypeScript exhaustiveness check - this should never be reached
          const _exhaustiveCheck: never = effect;
          const unknownEffect = effect as { effectType: string };
          return {
            success: false,
            effectType: unknownEffect.effectType as Effect['effectType'],
            error: `Unknown effect type: ${unknownEffect.effectType}`
          };
        }
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
      debugWarn('EFFECT_ENGINE: No effects to validate');
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
    
    // Get all players from StateService
    const allPlayers = this.stateService.getAllPlayers();
    const currentPlayerId = context.playerId ||
      (isResourceChangeEffect(payload.templateEffect)
        ? payload.templateEffect.payload.playerId
        : null);
    
    if (!currentPlayerId) {
      console.error('Cannot determine current player for targeted effect');
      console.error(`Context playerId: ${context.playerId}`);
      console.error(`Template effect type: ${payload.templateEffect.effectType}`);
      return false;
    }
    
    // Filter players based on target type
    let targetPlayers: string[] = [];
    
    switch (payload.targetType) {
      case 'OTHER_PLAYER_CHOICE': {
        // Filter out the current player, then let user choose one
        const otherPlayers = allPlayers.filter(player => player.id !== currentPlayerId);
        
        if (otherPlayers.length === 0) {
          return true; // Not an error, just no valid targets
        }
        
        // BUG-001 FIX: If only one valid target, apply effect automatically
        if (otherPlayers.length === 1) {
          const singleTarget = otherPlayers[0];
          targetPlayers = [singleTarget.id];
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
        break;
      }

      case 'ALL_OTHER_PLAYERS':
        targetPlayers = allPlayers
          .filter(player => player.id !== currentPlayerId)
          .map(player => player.id);
        break;
        
      case 'ALL_PLAYERS':
        targetPlayers = allPlayers.map(player => player.id);
        break;
        
      case 'Self':
        targetPlayers = [currentPlayerId];
        break;
        
      default:
        console.error(`Unknown target type: ${payload.targetType}`);
        return false;
    }
    
    if (targetPlayers.length === 0) {
      return true; // Not an error, just no targets
    }
    
    // Create targeted effects for each target player
    const targetedEffects: Effect[] = [];
    
    for (const targetPlayerId of targetPlayers) {
      // Clone the template effect and update the playerId
      const targetedEffect = this.cloneEffectWithNewPlayerId(payload.templateEffect, targetPlayerId);
      targetedEffects.push(targetedEffect);
    }
    
    
    // Process all targeted effects using batch processing
    const batchResult = await this.processEffects(targetedEffects, {
      ...context,
      source: `${context.source}:targeted`,
      triggerEvent: 'CARD_PLAY' // Targeted effects are typically from card play
    });
    
    
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
      const payload = clonedEffect.payload as Record<string, unknown>;
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

    // If no target rule specified, default to current player
    if (!targetRule || targetRule.trim() === 'Self' || targetRule.trim() === '') {
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
    

    if (targetPlayerIds.length === 0) {
      return { success: true, totalEffects: effects.length, successfulEffects: 0, failedEffects: 0, results: [], errors: [] };
    }

    // Apply effects to each target player
    let totalSuccessfulEffects = 0;
    const allResults: EffectResult[] = [];
    const allErrors: string[] = [];

    for (const targetPlayerId of targetPlayerIds) {
      
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
  async processCardEffects(effects: Effect[], context: EffectContext, cardData?: Card): Promise<BatchEffectResult> {
    // Ensure core setter-injected dependencies are ready
    this.assertCoreDependenciesReady();


    const cardId = cardData?.card_id || 'unknown';
    const targetRule = cardData?.target || 'Self';
    const hasDuration = !!(cardData && cardData.duration === 'Turns' && cardData.duration_count && parseInt(cardData.duration_count) > 0);
    const duration = hasDuration && cardData?.duration_count ? parseInt(cardData.duration_count) : 0;


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
    }

    if (targetPlayerIds.length === 0) {
      return { success: true, totalEffects: effects.length, successfulEffects: 0, failedEffects: 0, results: [], errors: [] };
    }

    // Handle duration-based effects
    if (hasDuration) {
      
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
      return this.processEffectsWithTargeting(effects, context, targetRule);
    }
  }

  /**
   * Process effects considering duration - if card has duration, store effects as active rather than applying immediately
   */
  async processEffectsWithDuration(effects: Effect[], context: EffectContext, cardData?: Card): Promise<BatchEffectResult> {

    // Check if this card should have duration-based effects
    const shouldUseDuration = !!(cardData &&
      cardData.duration === 'Turns' &&
      cardData.duration_count &&
      parseInt(cardData.duration_count) > 0);

    if (shouldUseDuration && cardData?.duration_count) {
      const duration = parseInt(cardData.duration_count);

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
      return this.processEffects(effects, context);
    }
  }

  /**
   * Add an active effect to a player's activeEffects list
   */
  addActiveEffect(playerId: string, effect: Effect, sourceCardId: string, duration: number): void {
    
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
      startTurn: gameState.globalTurnCount,
      effectType: effect.effectType,
      description: `Effect from ${sourceCardId} (${duration} turns remaining)`
    };

    const updatedActiveEffects = [...player.activeEffects, activeEffect];

    // Update via TEMP state (or main state if no TEMP exists)
    this.stateService.updateTempState(playerId, {
      activeEffects: updatedActiveEffects
    });

  }

  /**
   * Apply all active effects for a specific player and decrement their duration
   */
  async applyActiveEffects(playerId: string): Promise<void> {

    const player = this.stateService.getPlayer(playerId);
    if (!player || !player.activeEffects || player.activeEffects.length === 0) {
      return;
    }

    const remainingEffects = [];

    for (const activeEffect of player.activeEffects) {

      try {
        // Create a copy of the effect with updated source for active processing
        const activeEffectData = { ...activeEffect.effectData };
        if (activeEffectData.payload && typeof activeEffectData.payload === 'object') {
          activeEffectData.payload = {
            ...activeEffectData.payload,
            source: `active:${activeEffect.sourceCardId}`
          };
        }

        // v3.0.41 (Kid C follow-up) — phase gate for duration cards. The
        // parser carries the card's affected_phase through on the active
        // effect's payload; if the player isn't currently in the required
        // phase, skip the apply but DON'T decrement the duration (the
        // intent is "applies during X phase"; the effect lies dormant
        // outside the phase and resumes if/when the player re-enters).
        // Without this, L004 (CONSTRUCTION-phase tick over N turns) used
        // to fire against players still in DESIGN/REGULATORY phase.
        const requiredPhase = (activeEffectData.payload as any)?.requiredPhase;
        if (requiredPhase) {
          const spaceConfig = this.dataService?.getGameConfigBySpace(player.currentSpace);
          if (spaceConfig?.phase !== requiredPhase) {
            // Outside the gated phase — keep the effect, skip the apply.
            remainingEffects.push(activeEffect);
            continue;
          }
        }

        // v3.0.40 — capture money/timeSpent before the re-fire so we can
        // surface a player-facing "[card] still affecting you — -$X this
        // turn, N turns left" line. Without this, multi-turn duration cards
        // (Kid C) look identical to single-turn cards: silent re-fire each
        // turn with no narrative reminder.
        const beforeFire = this.stateService.getPlayer(playerId);
        const moneyBefore = beforeFire?.money ?? 0;
        const timeBefore = beforeFire?.timeSpent ?? 0;

        // Apply the effect with updated source
        await this.processEffect(activeEffectData, {
          source: `active:${activeEffect.sourceCardId}`,
          playerId: playerId,
          triggerEvent: 'ACTIVE_EFFECT'
        });

        // Decrement duration into a new value — do NOT mutate activeEffect
        // in place. player.activeEffects is a shared reference into live
        // state (StateService doesn't deep-copy it), so mutating the object
        // here would corrupt state before updateTempState below ever
        // commits it (v3.0.119 fix).
        const newRemainingDuration = activeEffect.remainingDuration - 1;

        // v3.0.40 — recurring-effect surfacing. Look up the source card so
        // the notification + log entry name the cause, not the cryptic
        // effectId. PM voice (life events are PM-narrated per project voice
        // rule). Posted AFTER processEffect so we observe the actual delta.
        this.surfaceRecurringEffect({
          playerId,
          sourceCardId: activeEffect.sourceCardId,
          moneyBefore,
          timeBefore,
          turnsLeftAfterThis: newRemainingDuration,
        });

        // Keep effect if it still has duration remaining
        if (newRemainingDuration > 0) {
          remainingEffects.push({
            ...activeEffect,
            remainingDuration: newRemainingDuration,
            description: `Effect from ${activeEffect.sourceCardId} (${newRemainingDuration} turns remaining)`
          });
        }
      } catch (error) {
        console.error(`   Error applying active effect ${activeEffect.effectId}:`, error);
        // Keep the effect to retry next turn
        remainingEffects.push(activeEffect);
      }
    }

    // Update player's active effects via TEMP state (or main state if no TEMP exists)
    this.stateService.updateTempState(playerId, {
      activeEffects: remainingEffects
    });

  }

  /**
   * v3.0.40 — emit a player-facing reminder + action-log entry when a
   * multi-turn duration card re-fires on a later turn. Without this, Kid C
   * cards (L002 / L004 / L008) silently apply each turn — the player sees
   * the resource line in the log but no narrative tie back to the card.
   *
   * Plain-English, PM voice. Skipped if the re-fire produced no money/time
   * delta (avoids spam for 0-tick cards) or if the card lookup fails.
   */
  private surfaceRecurringEffect(args: {
    playerId: string;
    sourceCardId: string;
    moneyBefore: number;
    timeBefore: number;
    turnsLeftAfterThis: number;
  }): void {
    const playerAfter = this.stateService.getPlayer(args.playerId);
    if (!playerAfter) return;

    const moneyDelta = playerAfter.money - args.moneyBefore;
    const timeDelta = playerAfter.timeSpent - args.timeBefore;
    if (moneyDelta === 0 && timeDelta === 0) return;

    const card = this.dataService?.getCardById(args.sourceCardId);
    const cardName = card?.card_name || 'A life event';

    const parts: string[] = [];
    if (moneyDelta !== 0) {
      const sign = moneyDelta > 0 ? '+' : '-';
      parts.push(`${sign}$${Math.abs(moneyDelta).toLocaleString()}`);
    }
    if (timeDelta !== 0) {
      const sign = timeDelta > 0 ? '+' : '-';
      parts.push(`${sign}${Math.abs(timeDelta)} day${Math.abs(timeDelta) === 1 ? '' : 's'}`);
    }
    const delta = parts.join(', ');

    const turnsLeft = args.turnsLeftAfterThis;
    const tail = turnsLeft > 0
      ? ` — ${turnsLeft} more turn${turnsLeft === 1 ? '' : 's'} to go`
      : ' — last one';

    const headline = `🔁 ${cardName} still affecting you: ${delta}${tail}`;

    // Domain-event stage 3: LogWriter + ToastWriter both react to this one
    // emission (replaces the former separate notificationService.notify +
    // loggingService.info calls).
    this.stateService.emitGameEvent({
      type: 'recurring_card_effect_applied',
      playerId: args.playerId,
      playerName: playerAfter.name,
      sourceCardId: args.sourceCardId,
      cardName,
      moneyDelta,
      timeDelta,
      turnsLeftAfterThis: turnsLeft,
      headline,
      delta,
      tail,
    });
  }

  /**
   * Process active effects for the player whose turn just ended (called at
   * turn transitions). v3.0.119 — previously ticked EVERY player's active
   * effects at EVERY turn end (maintainer ruling 2026-07-11, Option B), so a
   * "3-turn" event burned out in under one table round with 4 players. A
   * "3 turns" duration now means 3 of the holder's OWN turns.
   */
  async processActiveEffectsForCurrentPlayer(currentPlayerId: string): Promise<void> {
    await this.applyActiveEffects(currentPlayerId);
  }

  /**
   * Create a player agreement requirement effect
   */
  createPlayerAgreementEffect(
    requesterPlayerId: string,
    targetPlayerIds: string[],
    agreementType: 'CARD_TRANSFER' | 'RESOURCE_SHARE' | 'JOINT_ACTION' | 'PROTECTION_DEAL',
    agreementData: Record<string, unknown>,
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
}
