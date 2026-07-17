// src/services/ManualActionProcessor.ts
// Extracted from TurnService (2026-07-16) — everything that runs when a player
// presses a manual action button (draw/replace/give cards, money, time,
// investment funding) plus the automatic owner-seed-money funding, including
// the before/after resource snapshots and modal feedback both produce.
// Bodies moved verbatim from TurnService; the only changes are dependency
// plumbing (spaceEffectService/diceService/movementService called directly
// instead of through TurnService's private delegate wrappers).

import { IDataService, IStateService, IGameRulesService, ICardService, IResourceService, IMovementService, ISpaceEffectService, IDiceService, ILoggingService, ICardEffectService, IEffectEngineService, INotificationService } from '../types/ServiceContracts';
import { GameState, DiceResultEffect, TurnEffectResult } from '../types/StateTypes';
import { SpaceEffect } from '../types/DataTypes';
import { formatManualEffectButton, formatActionFeedback } from '../utils/buttonFormatting';
import { describeCardAction } from './DiceService';
import { buildResourceSnapshot } from '../utils/resourceSnapshot';
import { ConditionEvaluator } from '../utils/ConditionEvaluator';
import { interpolateTemplate, resolveFundingAmountToken } from '../utils/templateInterpolation';
import { calculateOwnerSeedMoney } from '../utils/ownerSeedMoney';
import { debugWarn } from '../utils/debugLog';

export class ManualActionProcessor {
  private readonly conditionEvaluator: ConditionEvaluator;
  private effectEngineService?: IEffectEngineService;

  constructor(
    private readonly dataService: IDataService,
    private readonly stateService: IStateService,
    private readonly gameRulesService: IGameRulesService,
    private readonly cardService: ICardService,
    private readonly resourceService: IResourceService,
    private readonly movementService: IMovementService,
    private readonly spaceEffectService: ISpaceEffectService,
    private readonly diceService: IDiceService,
    private readonly loggingService: ILoggingService,
    private readonly notificationService?: INotificationService,
    effectEngineService?: IEffectEngineService,
    private readonly cardEffectService?: ICardEffectService
  ) {
    this.effectEngineService = effectEngineService;
    this.conditionEvaluator = new ConditionEvaluator(gameRulesService);
  }

  /**
   * Set the EffectEngineService after construction (circular dependency handling)
   */
  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
  }

  /**
   * Trigger a manual space effect for the current player
   */
  async triggerManualEffect(playerId: string, effectType: string): Promise<GameState> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse effectType - might be compound like "cards:draw_b" or simple like "money"
    const [baseType, action] = effectType.includes(':') ? effectType.split(':') : [effectType, null];

    // Get manual effects for current space and visit type
    const spaceEffects = this.dataService.getSpaceEffects(player.currentSpace, player.visitType);

    const manualEffect = spaceEffects.find(effect => {
      const typeMatches = effect.trigger_type === 'manual' && effect.effect_type === baseType;
      // If action specified (e.g., "draw_b"), must match; otherwise just type match
      const actionMatches = !action || effect.effect_action === action;
      return typeMatches && actionMatches;
    });

    if (!manualEffect) {
      throw new Error(`No manual ${effectType} effect found for ${player.currentSpace} (${player.visitType})`);
    }

    // Evaluate condition before applying manual effect
    const conditionMet = this.evaluateEffectCondition(playerId, manualEffect.condition);
    if (!conditionMet) {
      throw new Error(`Manual ${effectType} effect condition not met: ${manualEffect.condition}`);
    }

    // Apply the effect based on type
    if (baseType === 'cards') {
      await this.applySpaceCardEffect(playerId, manualEffect, effectType);
    } else if (baseType === 'money') {
      // Special handling for get_investment_funding action
      if (manualEffect.effect_action === 'get_investment_funding') {
        await this.applyInvestmentFunding(playerId, manualEffect);
      } else {
        this.spaceEffectService.applySpaceMoneyEffect(playerId, manualEffect);
      }
    } else if (baseType === 'time') {
      this.spaceEffectService.applySpaceTimeEffect(playerId, manualEffect);
    } else if (baseType === 'turn') {
      // Handle turn effects (like "end_turn") - these are special and don't need processing here
      // Turn effects are handled by the UI component calling onEndTurn
    } else {
      debugWarn(`⚠️ Unknown manual effect type: ${baseType}`);
    }

    // Mark action as complete for non-card effects (money, time)
    // Card effects handle this inside applySpaceCardEffect (before restoreMovementChoiceIfNeeded)
    if (baseType !== 'cards') {
      const { text: buttonText } = formatManualEffectButton(manualEffect);
      // Store compound key (e.g., 'money:add_money') for precise matching
      const compoundKey = manualEffect.effect_action ? `${baseType}:${manualEffect.effect_action}` : baseType;
      this.stateService.setPlayerCompletedManualAction(compoundKey, buttonText);
      // Also store effect_action for fallback matching
      if (manualEffect.effect_action) {
        this.stateService.setPlayerCompletedManualAction(manualEffect.effect_action, buttonText);
      }
    }

    return this.stateService.getGameState();
  }

  /**
   * Trigger manual effect with modal feedback - similar to rollDiceWithFeedback
   */
  async triggerManualEffectWithFeedback(playerId: string, effectType: string): Promise<TurnEffectResult> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    const beforeState = this.stateService.getGameState();
    const beforePlayer = beforeState.players.find(p => p.id === playerId)!;
    // Capture project scope BEFORE applying the effect — calculateProjectScope
    // reads live state, so it must be called now to get the true "before".
    const beforeScope = this.gameRulesService.calculateProjectScope(playerId);
    const beforeSnapshot = buildResourceSnapshot(beforePlayer, beforeScope);

    // Trigger the manual effect
    await this.triggerManualEffect(playerId, effectType);

    const afterState = this.stateService.getGameState();
    const afterPlayer = afterState.players.find(p => p.id === playerId)!;
    const afterScope = this.gameRulesService.calculateProjectScope(playerId);
    const afterSnapshot = buildResourceSnapshot(afterPlayer, afterScope);

    // Parse effectType - might be compound like "cards:draw_b" or simple like "money"
    const [baseType, action] = effectType.includes(':') ? effectType.split(':') : [effectType, null];

    // Check if this was a skippable action that was NOT completed (user pressed cancel/skip)
    // Also check if it was an impossible action (auto-completed, no modal needed)
    const isSkippableAction = action && (action.startsWith('replace_') || action.startsWith('give_') || action.startsWith('return_'));
    if (isSkippableAction) {
      const compoundKey = `${baseType}:${action}`;
      const manualActions = afterState.completedActions?.manualActions || {};
      const wasCompleted = manualActions[compoundKey] !== undefined || manualActions[action] !== undefined;

      // Check if no cards were actually affected (either skipped or impossible)
      const beforeHand = beforePlayer.hand || [];
      const afterHand = afterPlayer.hand || [];
      const handChanged = beforeHand.length !== afterHand.length ||
                         beforeHand.some(id => !afterHand.includes(id)) ||
                         afterHand.some(id => !beforeHand.includes(id));

      if (!wasCompleted) {
        // Expected skippable-decline path (player backed out of an optional
        // action). Debug-level, not error — keeps it out of bug-report error counts.
        debugWarn(`[ManualAction] skippable action declined: effectType=${effectType}, action=${action}, space=${currentPlayer.currentSpace}, handBefore=${beforeHand.length}, handAfter=${afterHand.length}, handChanged=${beforeHand.length !== afterHand.length || beforeHand.some(id => !afterHand.includes(id))}.`);
        // Return empty effects so no modal is shown (user already knows they skipped)
        return {
          diceValue: 0,
          spaceName: currentPlayer.currentSpace,
          effects: [],
          summary: '',
          hasChoices: false,
          projectTime: {
            actionDays: 0,
            totalDays: afterPlayer.timeSpent,
            estimatedDays: this.gameRulesService.calculateEstimatedProjectLength(currentPlayer.id).estimatedDays,
            progressPercent: 0,
            uniqueWorkTypes: 0
          },
          before: beforeSnapshot,
          after: afterSnapshot
        };
      } else if (!handChanged) {
        // Action was marked complete but no cards changed - was impossible (e.g., no opponents)
        return {
          diceValue: 0,
          spaceName: currentPlayer.currentSpace,
          effects: [],
          summary: '',
          hasChoices: false,
          projectTime: {
            actionDays: 0,
            totalDays: afterPlayer.timeSpent,
            estimatedDays: this.gameRulesService.calculateEstimatedProjectLength(currentPlayer.id).estimatedDays,
            progressPercent: 0,
            uniqueWorkTypes: 0
          },
          before: beforeSnapshot,
          after: afterSnapshot
        };
      }
    }

    // Get the effect details for feedback
    const spaceEffects = this.dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
    const manualEffect = spaceEffects.find(effect => {
      const typeMatches = effect.trigger_type === 'manual' && effect.effect_type === baseType;
      // If action specified (e.g., "draw_b"), must match; otherwise just type match
      const actionMatches = !action || effect.effect_action === action;
      return typeMatches && actionMatches;
    });

    if (!manualEffect) {
      throw new Error(`No manual ${effectType} effect found for ${currentPlayer.currentSpace}`);
    }

    // Build modal config from SPACE_EFFECTS data (if customized)
    const effectModalConfig = (manualEffect.modal_title || manualEffect.modal_description || manualEffect.modal_button_label || manualEffect.modal_summary)
      ? {
          title: manualEffect.modal_title || undefined,
          description: manualEffect.modal_description || undefined,
          buttonLabel: manualEffect.modal_button_label || undefined,
          summary: manualEffect.modal_summary || undefined,
        }
      : undefined;

    // Create effect description for modal
    const effects: DiceResultEffect[] = [];

    if (baseType === 'cards') {
      const cardType = manualEffect.effect_action.replace('draw_', '').replace('replace_', '').replace('give_', '').replace('return_', '').toUpperCase();
      const isReplaceAction = manualEffect.effect_action.startsWith('replace_');
      const isGiveAction = manualEffect.effect_action.startsWith('give_');
      const isReturnAction = manualEffect.effect_action.startsWith('return_');

      // Determine which cards were drawn by comparing before/after hands
      const beforeHand = beforePlayer.hand || [];
      const afterHand = afterPlayer.hand || [];
      const drawnCardIds = afterHand.filter(cardId => !beforeHand.includes(cardId));

      // Parse effect_value - extract number from strings like "Draw 1" or just use numeric value
      let count: number;
      if (typeof manualEffect.effect_value === 'string') {
        // Extract digits from string (e.g., "Draw 1" -> 1)
        const match = manualEffect.effect_value.match(/\d+/);
        count = match ? parseInt(match[0], 10) : drawnCardIds.length;
      } else if (typeof manualEffect.effect_value === 'number') {
        count = manualEffect.effect_value;
      } else {
        // Fallback to actual drawn count if effect_value is undefined or invalid
        count = drawnCardIds.length;
      }

      // Determine action verb based on effect type; description is rendered
      // via describeCardAction so real-life voice stays in one place.
      const cardAction: 'draw' | 'remove' | 'replace' | 'give' | 'return' = isReplaceAction
        ? 'replace'
        : isGiveAction
          ? 'give'
          : isReturnAction
            ? 'return'
            : 'draw';
      const actionDescription = describeCardAction(cardAction, cardType, count);

      effects.push({
        type: 'cards',
        description: actionDescription,
        cardType: cardType,
        cardCount: count,
        cardAction: cardAction,
        cardIds: drawnCardIds,
        modalConfig: effectModalConfig
      });
    } else if (baseType === 'money') {
      const action = manualEffect.effect_action;

      // Special handling for investment funding
      if (action === 'get_investment_funding') {
        const moneyChange = afterPlayer.money - beforePlayer.money;
        const timeChange = afterPlayer.timeSpent - beforePlayer.timeSpent;

        const investmentBefore = beforePlayer.moneySources?.investmentDeals || 0;
        const investmentAfter = afterPlayer.moneySources?.investmentDeals || 0;
        const investmentGained = investmentAfter - investmentBefore;
        const feeCharged = investmentGained - moneyChange;

        // Add investment to effects
        if (investmentGained > 0) {
          effects.push({
            type: 'money',
            description: `Investment received: $${investmentGained.toLocaleString()}`,
            value: investmentGained
          });
        }

        // Add fee to effects
        if (feeCharged > 0) {
          effects.push({
            type: 'money',
            description: `Investment fee: 5% ($${feeCharged.toLocaleString()})`,
            value: -feeCharged
          });
        }

        // Add time to effects
        if (timeChange > 0) {
          effects.push({
            type: 'time',
            description: `Investment review time: ${timeChange} days`,
            value: timeChange
          });
        }
      } else {
        // Standard money effect handling
        const moneyChange = afterPlayer.money - beforePlayer.money;
        effects.push({
          type: 'money',
          description: `Money ${action === 'add' ? 'gained' : 'spent'}: $${Math.abs(moneyChange)}`,
          value: moneyChange,
          modalConfig: effectModalConfig
        });
      }
    } else if (baseType === 'time') {
      const action = manualEffect.effect_action; // 'add' or 'subtract'
      const timeChange = afterPlayer.timeSpent - beforePlayer.timeSpent;
      effects.push({
        type: 'time',
        description: `Time ${action === 'add' ? 'spent' : 'saved'}: ${Math.abs(timeChange)} days`,
        value: timeChange,
        modalConfig: effectModalConfig
      });
    }

    // Apply template interpolation to modal config descriptions
    const templateContext: Record<string, string | number> = {
      spaceName: currentPlayer.currentSpace,
      playerName: currentPlayer.name,
    };
    for (const effect of effects) {
      if (effect.cardType) templateContext.cardType = effect.cardType;
      if (effect.cardCount !== undefined) templateContext.count = effect.cardCount;
      if (effect.value !== undefined) templateContext.amount = Math.abs(effect.value);
      if (effect.modalConfig?.description) {
        effect.description = interpolateTemplate(effect.modalConfig.description, templateContext);
      }
    }

    // Use custom summary template if provided, otherwise join effect descriptions
    const customSummary = effectModalConfig?.summary
      ? interpolateTemplate(effectModalConfig.summary, templateContext)
      : null;
    const summary = customSummary || effects.map(e => e.description).join(', ');

    // Log manual action to action history
    this.loggingService.info(summary, {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      action: 'manual_action',
      effectType: effectType
    });

    // Send Manual Effect notification
    if (this.notificationService) {
      this.notificationService.notify(
        {
          short: 'Action Complete',
          medium: `✅ ${summary}`,
          detailed: `${currentPlayer.name} completed manual action: ${summary}`
        },
        {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          actionType: 'manualEffect',
          notificationDuration: 3000
        }
      );
    }

    // Calculate project time info for the modal
    const timeEffect = effects.find(e => e.type === 'time');
    const actionDays = timeEffect?.value || 0;
    const projectLengthInfo = this.gameRulesService.calculateEstimatedProjectLength(currentPlayer.id);
    const updatedPlayer = this.stateService.getPlayer(currentPlayer.id);
    const totalDays = updatedPlayer?.timeSpent || currentPlayer.timeSpent;
    const progressPercent = projectLengthInfo.estimatedDays > 0
      ? (totalDays / projectLengthInfo.estimatedDays) * 100
      : 0;

    // Pull NPC narrative for the modal's visual Summary block. Keeps the
    // visible text focused on story flavor; the auto-recap stays in
    // `summary` for TTS only. {fundingAmount} resolution (v3.0.99):
    // BANK-FUND-REVIEW/INVESTOR-FUND-REVIEW Subsequent stories quote the
    // prior funding amount inline — without this the modal showed the raw
    // "{fundingAmount}" token instead of the dollar figure.
    const rawVisualSummary = this.dataService.getSpaceContent(
      currentPlayer.currentSpace, currentPlayer.visitType
    )?.story;
    const visualSummary = rawVisualSummary
      ? resolveFundingAmountToken(rawVisualSummary, updatedPlayer || currentPlayer, this.dataService.getFundingSource(currentPlayer.currentSpace))
      : undefined;

    return {
      diceValue: 0, // No dice roll for manual effects
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      visualSummary,
      hasChoices: false,
      projectTime: {
        actionDays,
        totalDays,
        estimatedDays: projectLengthInfo.estimatedDays,
        progressPercent,
        uniqueWorkTypes: projectLengthInfo.uniqueWorkTypes.length
      },
      before: beforeSnapshot,
      after: afterSnapshot
    };
  }

  /**
   * Handle automatic funding for auto_apply_funding=Yes spaces
   * Calculates owner seed money as projectScope * random(0.8 to 1.2)
   * Owner seed money is separate from bank loans (B cards) and investor funding (I cards)
   */
  async handleAutomaticFunding(playerId: string): Promise<TurnEffectResult> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Workstream 6 #3: defensive guard inside handleAutomaticFunding —
    // caller (TurnService.startTurn) already gates on shouldAutoApplyFunding, but if
    // anything calls this directly, fail loudly rather than silently distribute funding.
    if (!this.dataService.shouldAutoApplyFunding(currentPlayer.currentSpace)) {
      throw new Error(`Player is not on an auto-funding space (current: ${currentPlayer.currentSpace})`);
    }

    // Calculate project scope from W cards (single source of truth)
    const projectScope = this.gameRulesService.calculateProjectScope(playerId);
    // Snapshot the player's resource state BEFORE any funding changes so the
    // result modal can render a before/after row. projectScope is already
    // computed above; reuse it. afterSnapshot is captured at return time below.
    const beforeSnapshot = buildResourceSnapshot(currentPlayer, projectScope);

    if (projectScope === 0) {
      console.error(`🚨 SCOPE BUG: Player ${currentPlayer.name} (${playerId}) at OWNER-FUND-INITIATION with 0 project scope. Hand: [${currentPlayer.hand.join(', ')}], W cards: ${currentPlayer.hand.filter(c => c.startsWith('W')).length}, activeCards: ${(currentPlayer.activeCards || []).length}`);
    }

    // Store project scope on player (permanent record)
    this.stateService.updatePlayer({
      id: playerId,
      projectScope: projectScope
    });

    // Calculate owner seed money: projectScope * random(0.8 to 1.2), rounded
    // to the nearest $10,000. Shared with EffectEngineService's
    // OWNER_SEED_MONEY effect path via calculateOwnerSeedMoney so both
    // funding flows can't drift apart.
    const { multiplier: seedMoneyMultiplier, amount: roundedSeedMoney } = calculateOwnerSeedMoney(projectScope);

    try {
      // Add owner seed money directly to player's funds
      // This is tracked separately from bank loans and investor deals
      this.resourceService.addMoney(
        playerId,
        roundedSeedMoney,
        'owner_seed_money',
        `Owner's personal seed money investment`,
        'owner'  // Tracks in moneySources.ownerFunding
      );

      // Mark that player has "rolled dice" to continue turn flow
      this.stateService.setPlayerHasRolledDice();

      const fundingDescription = `Owner invested $${roundedSeedMoney.toLocaleString()} as seed money (${(seedMoneyMultiplier * 100).toFixed(0)}% of project scope)`;

      // Create effect description for modal feedback
      const effects: DiceResultEffect[] = [{
        type: 'money',
        value: roundedSeedMoney,
        description: `🏠 Owner Seed Money: $${roundedSeedMoney.toLocaleString()}`,
        cardType: undefined,
        cardIds: []
      }];

      // Generate detailed feedback message for non-dice action and store it in state
      const feedbackMessage = formatActionFeedback(effects);
      this.stateService.setDiceRollCompletion(feedbackMessage);

      // Send Owner Seed Money notification
      if (this.notificationService) {
        this.notificationService.notify(
          {
            short: 'Seed Money',
            medium: `💰 Owner invested $${roundedSeedMoney.toLocaleString()}`,
            detailed: `${currentPlayer.name} invested personal seed money: $${roundedSeedMoney.toLocaleString()}`
          },
          {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            actionType: 'automaticFunding',
            notificationDuration: 3000
          }
        );
      }

      // Calculate project time info for the modal
      const projectLengthInfo = this.gameRulesService.calculateEstimatedProjectLength(currentPlayer.id);
      const updatedPlayer = this.stateService.getPlayer(currentPlayer.id);
      const totalDays = updatedPlayer?.timeSpent || currentPlayer.timeSpent;
      const progressPercent = projectLengthInfo.estimatedDays > 0
        ? (totalDays / projectLengthInfo.estimatedDays) * 100
        : 0;

      const afterPlayerForSnapshot = updatedPlayer || currentPlayer;
      const afterScope = this.gameRulesService.calculateProjectScope(playerId);
      const afterSnapshot = buildResourceSnapshot(afterPlayerForSnapshot, afterScope);
      // {fundingAmount} token — the story quotes the actual dollar figure in
      // NPC dialogue. ActionCenterPanel/PlayerPanelV2 already resolve it for
      // the on-panel story text (v3.0.98), but this modal path built
      // visualSummary straight from the raw story, so the modal showed the
      // literal "{fundingAmount}" placeholder instead of the number.
      // addMoney() above already landed in moneySources.ownerFunding, so the
      // shared resolver (also used by triggerManualEffectWithFeedback and
      // DiceRollProcessor for the other funding spaces) reads the same fresh
      // total rather than re-deriving it from roundedSeedMoney locally.
      const rawStory = this.dataService.getSpaceContent(
        currentPlayer.currentSpace, currentPlayer.visitType
      )?.story;
      const visualSummary = rawStory
        ? resolveFundingAmountToken(rawStory, afterPlayerForSnapshot, this.dataService.getFundingSource(currentPlayer.currentSpace))
        : undefined;
      const result: TurnEffectResult = {
        diceValue: 0, // No actual dice roll
        spaceName: currentPlayer.currentSpace,
        effects: effects,
        summary: fundingDescription,
        visualSummary,
        hasChoices: false,
        canReRoll: false,
        projectTime: {
          actionDays: 0, // Funding doesn't take time at this space
          totalDays,
          estimatedDays: projectLengthInfo.estimatedDays,
          progressPercent,
          uniqueWorkTypes: projectLengthInfo.uniqueWorkTypes.length
        },
        before: beforeSnapshot,
        after: afterSnapshot
      };

      // This fires from inside startTurn on every turn transition — including
      // the internal endTurn → startTurn path, which has no React caller to
      // capture the return value above. The auto-action event is the only
      // way this reaches GameLayout so it can show the real modal instead of
      // just the 3s toast below (fb: money buried mid-sentence in the NPC
      // dialogue, never confirmed as a distinct number).
      this.stateService.emitGameEvent({
        type: 'seed_money',
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        moneyAmount: roundedSeedMoney,
        spaceName: currentPlayer.currentSpace,
        message: fundingDescription,
        turnEffectResult: result
      });

      return result;

    } catch (error) {
      console.error(`❌ Error in automatic funding:`, error);
      throw new Error(`Failed to process automatic funding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // --- private helpers ---

  private async applySpaceCardEffect(playerId: string, effect: SpaceEffect, effectType: string): Promise<GameState> {
    // Delegate to CardEffectService if available
    if (this.cardEffectService) {
      const result = await this.cardEffectService.executeCardEffect(playerId, effect, effectType);

      // Determine if action was actually completed (not skipped)
      // For replace/return/give actions, user can skip - only mark complete if cards were affected
      // For draw actions, they always succeed
      // EXCEPTION: If action is IMPOSSIBLE (not just skipped), auto-complete it
      const action = effect.effect_action.toLowerCase();
      const isSkippableAction = action.startsWith('replace_') || action.startsWith('return_') || action.startsWith('give_');

      // Check if action was impossible (not just skipped by user)
      // Messages like "Cannot give card to self", "No E cards to give", etc. indicate impossibility
      const isImpossibleAction = result.message && (
        result.message.startsWith('Cannot') ||
        result.message.startsWith('No ') ||
        result.message.includes('not found')
      );

      const wasActuallyCompleted = !isSkippableAction || result.cardsAffected.length > 0 || isImpossibleAction;

      if (wasActuallyCompleted) {
        // Mark action as complete using compound key and effect_action
        // DO NOT mark by base type (e.g., 'cards') as it causes multiple same-type effects to all appear completed
        const { text: buttonText } = formatManualEffectButton(effect);
        this.stateService.setPlayerCompletedManualAction(effectType, buttonText);

        // Also mark by effect_action for matching
        if (effect.effect_action) {
          this.stateService.setPlayerCompletedManualAction(effect.effect_action, buttonText);
        }
      } else {
        // Reached only when the action is skippable, affected no cards, and
        // isn't impossible — i.e. the player declined an optional action. That's
        // expected, not an error; log at debug level so it doesn't inflate the
        // error count captured into bug reports.
        debugWarn(`[ManualAction] skippable action declined (not marked complete): effectType=${effectType}, action=${action}, cardsAffected=${result.cardsAffected.length}, message=${result.message}, isSkippable=${isSkippableAction}, isImpossible=${isImpossibleAction}.`);
      }

      // Restore movement choice if needed
      await this.movementService.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    }

    // CardEffectService is required - it should always be injected via setCardEffectService
    throw new Error('CardEffectService not initialized. Ensure setCardEffectService is called during service setup.');
  }

  /**
   * Apply investment funding - rolls dice, draws I card, applies time, and charges 5% fee
   */
  private async applyInvestmentFunding(playerId: string, effect: SpaceEffect): Promise<GameState> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const space = player.currentSpace;
    const visitType = player.visitType;
    const source = `space:${space}`;
    const reason = effect.description || 'Investment funding';

    // Step 1: Roll dice
    const diceRoll = this.diceService.rollDice();

    // Step 2: Apply time based on dice roll
    const diceEffects = this.dataService.getDiceEffects(space, visitType);
    const timeEffect = diceEffects.find(e => e.effect_type === 'time');
    if (timeEffect) {
      const diceRollEffectValue = this.diceService.getDiceRollEffectValue(timeEffect, diceRoll);
      const days = parseInt(diceRollEffectValue);
      if (!isNaN(days) && days > 0) {
        this.resourceService.addTime(playerId, days, source, `Investment review: ${days} days`);
      }
    }

    // Step 3: Capture investment before drawing card
    const investmentBefore = player.moneySources?.investmentDeals || 0;

    // Step 4: Draw and apply I card
    await this.cardService.drawAndApplyCard(playerId, 'I', source, reason);

    // Step 5: Calculate and charge 5% fee on NEW investment only
    const updatedPlayer = this.stateService.getPlayer(playerId);
    if (!updatedPlayer) return this.stateService.getGameState();

    const investmentAfter = updatedPlayer.moneySources?.investmentDeals || 0;
    const newInvestment = investmentAfter - investmentBefore;
    const feeAmount = Math.floor((newInvestment * 5) / 100);

    if (feeAmount > 0) {
      // Mandatory fee — the player didn't opt into it, it's an automatic
      // consequence of drawing investment funding. Same "charge into the red"
      // rule as design/regulatory fees and the contractor signing charge
      // (allowNegative), so it can't be silently skipped when unaffordable.
      this.resourceService.recordCost(playerId, 'investmentFee', feeAmount, `5% investment fee on $${newInvestment.toLocaleString()}`, 'handleAutomaticFunding', true);
      // Share the single bankruptcy rule (FinancialEffectHandler.checkBankruptcy)
      // via EffectEngineService's passthrough rather than growing a new copy.
      this.effectEngineService?.checkBankruptcy(playerId);
    }

    // Step 6: Mark dice as rolled
    this.stateService.setPlayerHasRolledDice();

    return this.stateService.getGameState();
  }

  /**
   * Evaluate whether an effect condition is met
   */
  private evaluateEffectCondition(playerId: string, condition: string | undefined, diceRoll?: number): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      debugWarn(`Player ${playerId} not found for condition evaluation`);
      return false;
    }
    return this.conditionEvaluator.evaluate(player, condition, diceRoll);
  }
}
