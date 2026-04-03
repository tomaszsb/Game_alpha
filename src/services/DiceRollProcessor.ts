// src/services/DiceRollProcessor.ts
// Extracted from TurnService - handles dice roll processing with feedback

import { IDataService, IStateService, IGameRulesService, IDiceService, IChoiceService, IMovementService } from '../types/ServiceContracts';
import { debugLog, debugWarn } from '../utils/debugLog';
import { INotificationService } from './NotificationService';
import { DiceResultEffect, TurnEffectResult, Player } from '../types/StateTypes';
import { formatDiceRollFeedback } from '../utils/buttonFormatting';
import { Effect } from '../types/EffectTypes';

/**
 * Interface for dice roll effects processing result
 */
export interface DiceRollEffectsResult {
  gameState: any;
  generatedEffects: Effect[];
  effectResults?: { results: Array<{ data?: { cardIds?: string[]; skipped?: boolean } }> };
  rollGroups?: Array<{ rollGroup: string; diceValue: number; effectCount: number }>;
}

/**
 * Callback type for processing dice roll effects
 */
export type ProcessDiceRollEffectsCallback = (
  playerId: string,
  diceRoll: number
) => Promise<DiceRollEffectsResult>;

/**
 * DiceRollProcessor handles dice roll processing with detailed feedback for UI.
 *
 * This includes:
 * - Rolling dice with feedback (rollDiceWithFeedback)
 * - Re-rolling dice (rerollDice)
 * - Tracking effects for UI display
 * - Handling movement choices based on dice outcomes
 *
 * Extracted from TurnService for better separation of concerns.
 */
export class DiceRollProcessor {
  private processDiceRollEffectsCallback?: ProcessDiceRollEffectsCallback;
  private lastRollGroups?: Array<{ rollGroup: string; diceValue: number; effectCount: number }>;

  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private gameRulesService: IGameRulesService,
    private diceService: IDiceService,
    private choiceService: IChoiceService,
    private movementService: IMovementService,
    private notificationService?: INotificationService
  ) {}

  /**
   * Set the callback for processing dice roll effects.
   * This is needed because the actual effect processing is in TurnService.
   */
  public setProcessDiceRollEffectsCallback(callback: ProcessDiceRollEffectsCallback): void {
    this.processDiceRollEffectsCallback = callback;
  }

  /**
   * Set notification service
   */
  public setNotificationService(service: INotificationService): void {
    this.notificationService = service;
  }

  /**
   * Roll a single die (1-6)
   */
  public rollDice(): number {
    return this.diceService.rollDice();
  }

  /**
   * Get human-readable name for card type
   */
  public getCardTypeName(cardType: string): string {
    return this.diceService.getCardTypeName(cardType);
  }

  /**
   * Generate a human-readable summary of the effects
   */
  public generateEffectSummary(effects: DiceResultEffect[], diceValue: number, storyText?: string): string {
    return this.diceService.generateEffectSummary(effects, diceValue, storyText);
  }

  /**
   * Generate an explanatory message when dice outcome sends player back to a review/exam space
   */
  public getReviewLoopExplanation(fromSpace: string, toSpace: string): string | null {
    const reviewLoopMessages: { [key: string]: string } = {
      'REG-DOB-PLAN-EXAM': 'The examiner found minor issues that need to be addressed. Additional documentation or corrections are required before continuing.',
      'REG-FDNY-PLAN-EXAM': 'Fire safety review identified items needing attention. The FDNY examiner requires additional information or modifications.',
      'ARCH-INITIATION': 'Design changes are needed. You must consult with the architect to revise the plans before resubmitting.',
      'ENG-INITIATION': 'Structural or engineering modifications required. The engineer needs to update calculations or drawings.',
    };

    const explanation = reviewLoopMessages[toSpace];
    if (explanation) {
      return explanation;
    }

    if (fromSpace.includes('AUDIT') && toSpace.includes('PLAN-EXAM')) {
      return 'The audit revealed discrepancies that require re-examination. Your plans will be reviewed again with the new information.';
    }

    if (fromSpace.includes('PLAN-EXAM') && toSpace === fromSpace) {
      return 'The plan examination could not be completed today due to complexity. You will need to return to continue the review.';
    }

    return null;
  }

  /**
   * Roll dice and process effects with detailed feedback for UI
   */
  public async rollDiceWithFeedback(playerId: string): Promise<TurnEffectResult> {
    debugLog(`🎲 ROLL_DICE_FEEDBACK: ========== START ==========`);
    debugLog(`🎲 ROLL_DICE_FEEDBACK: playerId: ${playerId}`);

    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      console.error(`🎲 ROLL_DICE_FEEDBACK: ERROR - Player ${playerId} not found!`);
      throw new Error(`Player ${playerId} not found`);
    }

    // Roll dice
    const diceRoll = this.rollDice();
    this.lastRollGroups = undefined;
    debugLog(`🎲 ROLL_DICE_FEEDBACK: Dice roll result: ${diceRoll}`);

    // Process effects and track changes
    const effects: DiceResultEffect[] = [];
    await this.processTurnEffectsWithTracking(playerId, diceRoll, effects);
    debugLog(`🎲 ROLL_DICE_FEEDBACK: Number of effects: ${effects.length}`);

    // Mark dice roll states
    this.stateService.setPlayerHasRolledDice();
    this.stateService.setPlayerHasMoved();

    // Look up space story for narrative summary
    const spaceContent = this.dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
    const storyText = spaceContent?.story || undefined;

    // Generate summary
    const summary = this.generateEffectSummary(effects, diceRoll, storyText);
    const hasChoices = effects.some(effect => effect.type === 'choice');

    // Generate detailed feedback message and store it in state
    const feedbackMessage = formatDiceRollFeedback(diceRoll, effects);
    this.stateService.setDiceRollCompletion(feedbackMessage);

    // Check if player can re-roll (from E066 card effect)
    const canReRoll = currentPlayer.turnModifiers?.canReRoll || false;

    // Calculate project time info for the modal
    const result = this.buildTurnEffectResult(currentPlayer, diceRoll, effects, summary, hasChoices, canReRoll);
    result.rollGroups = this.lastRollGroups;

    debugLog(`🎲 ROLL_DICE_FEEDBACK: ========== END ==========`);
    return result;
  }

  /**
   * Re-roll dice if player has re-roll ability from E066 card
   */
  public async rerollDice(playerId: string): Promise<TurnEffectResult> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Validate player can re-roll
    if (!currentPlayer.turnModifiers?.canReRoll) {
      throw new Error(`Player ${playerId} does not have re-roll ability`);
    }

    // Consume the re-roll ability
    this.stateService.updatePlayer({
      id: playerId,
      turnModifiers: {
        ...currentPlayer.turnModifiers,
        canReRoll: false
      }
    });

    // Roll new dice
    const newDiceRoll = this.rollDice();

    // Process effects for new dice roll
    const effects: DiceResultEffect[] = [];
    await this.processTurnEffectsWithTracking(playerId, newDiceRoll, effects);

    // Look up space story for narrative summary
    const spaceContent = this.dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
    const storyText = spaceContent?.story || undefined;

    // Generate summary for new result
    const summary = this.generateEffectSummary(effects, newDiceRoll, storyText);
    const hasChoices = effects.some(effect => effect.type === 'choice');

    return this.buildTurnEffectResult(currentPlayer, newDiceRoll, effects, summary, hasChoices, false);
  }

  /**
   * Build the TurnEffectResult with project time info
   */
  private buildTurnEffectResult(
    currentPlayer: Player,
    diceValue: number,
    effects: DiceResultEffect[],
    summary: string,
    hasChoices: boolean,
    canReRoll: boolean
  ): TurnEffectResult {
    const timeEffect = effects.find(e => e.type === 'time');
    const actionDays = timeEffect?.value || 0;
    const projectLengthInfo = this.gameRulesService.calculateEstimatedProjectLength(currentPlayer.id);
    const updatedPlayer = this.stateService.getPlayer(currentPlayer.id);
    const totalDays = updatedPlayer?.timeSpent || currentPlayer.timeSpent;
    const progressPercent = projectLengthInfo.estimatedDays > 0
      ? (totalDays / projectLengthInfo.estimatedDays) * 100
      : 0;

    return {
      diceValue,
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      hasChoices,
      canReRoll,
      projectTime: {
        actionDays,
        totalDays,
        estimatedDays: projectLengthInfo.estimatedDays,
        progressPercent,
        uniqueWorkTypes: projectLengthInfo.uniqueWorkTypes.length
      }
    };
  }

  /**
   * Process turn effects while tracking changes for feedback
   */
  public async processTurnEffectsWithTracking(
    playerId: string,
    diceRoll: number,
    effects: DiceResultEffect[]
  ): Promise<void> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) return;

    if (!this.processDiceRollEffectsCallback) {
      debugWarn('DiceRollProcessor: processDiceRollEffectsCallback not set');
      return;
    }

    // Process effects using the callback
    const { generatedEffects, effectResults, rollGroups } = await this.processDiceRollEffectsCallback(playerId, diceRoll);

    // Store roll groups for the caller to pick up
    this.lastRollGroups = rollGroups;

    // Convert generated effects to DiceResultEffect format
    this.convertEffectsToResults(generatedEffects, effectResults, effects, currentPlayer);

    // Check for movement choices
    this.handleMovementChoices(playerId, currentPlayer, diceRoll, effects);
  }

  /**
   * Convert generated effects to DiceResultEffect format
   */
  private convertEffectsToResults(
    generatedEffects: Effect[],
    effectResults: { results: Array<{ data?: { cardIds?: string[]; skipped?: boolean } }> } | undefined,
    effects: DiceResultEffect[],
    currentPlayer: Player
  ): void {
    generatedEffects.forEach((effect, index) => {
      const effectResult = effectResults?.results[index];

      // Skip effects that were skipped by the user
      if (effectResult?.data?.skipped) {
        debugLog(`   ⏭️ Skipping display of skipped effect: ${effect.effectType}`);
        return;
      }

      if (effect.effectType === 'CARD_DRAW') {
        const isReplaceDraw = effect.payload.source?.includes(':dice_replace_draw');
        const actionVerb = isReplaceDraw ? 'Replaced' : 'Drew';
        const cardAction = isReplaceDraw ? 'replace' : 'draw';

        effects.push({
          type: 'cards',
          description: `${actionVerb} ${effect.payload.count} ${this.getCardTypeName(effect.payload.cardType)} card${effect.payload.count > 1 ? 's' : ''}`,
          cardType: effect.payload.cardType,
          cardCount: effect.payload.count,
          cardAction: cardAction as 'draw' | 'replace',
          cardIds: effectResult?.data?.cardIds || []
        });
      } else if (effect.effectType === 'CARD_DISCARD') {
        const isReplaceDiscard = effect.payload.source?.includes(':dice_replace');
        if (isReplaceDiscard) {
          debugLog(`   ⏭️ Skipping display of replace discard - will show in draw effect`);
          return;
        }

        effects.push({
          type: 'cards',
          description: `Removed ${effect.payload.count || effect.payload.cardIds.length} ${this.getCardTypeName(effect.payload.cardType || 'card')} card${(effect.payload.count || effect.payload.cardIds.length) > 1 ? 's' : ''}`,
          cardType: effect.payload.cardType,
          cardCount: effect.payload.count || effect.payload.cardIds.length,
          cardAction: 'remove',
          cardIds: effectResult?.data?.cardIds || effect.payload.cardIds || []
        });
      } else if (effect.effectType === 'RESOURCE_CHANGE') {
        if (effect.payload.resource === 'MONEY') {
          let displayAmount = effect.payload.amount;
          let description = effect.payload.amount > 0 ? 'Received project funding' : 'Paid project costs';

          const payload = effect.payload as { percentageOfScope?: number; feeCategory?: string };
          if (payload.percentageOfScope !== undefined) {
            const projectScope = this.gameRulesService.calculateProjectScope(currentPlayer.id);
            displayAmount = -Math.floor((projectScope * payload.percentageOfScope) / 100);
            const feeType = payload.feeCategory === 'architectural' ? 'Architect' : 'Engineer';
            description = `${feeType} fee: ${payload.percentageOfScope}% of scope`;
          }

          effects.push({
            type: 'money',
            description,
            value: displayAmount
          });
        } else if (effect.payload.resource === 'TIME') {
          effects.push({
            type: 'time',
            description: effect.payload.amount > 0 ? 'Project delayed' : 'Gained efficiency',
            value: effect.payload.amount
          });
        }
      }
    });
  }

  /**
   * Handle movement choices based on dice roll
   */
  private handleMovementChoices(
    playerId: string,
    currentPlayer: Player,
    diceRoll: number,
    effects: DiceResultEffect[]
  ): void {
    const movementRule = this.dataService.getMovement(currentPlayer.currentSpace, currentPlayer.visitType);

    if (movementRule && movementRule.movement_type === 'choice') {
      const moveOptions = [
        movementRule.destination_1,
        movementRule.destination_2,
        movementRule.destination_3,
        movementRule.destination_4,
        movementRule.destination_5
      ].filter((dest): dest is string => !!dest);

      if (moveOptions.length > 0) {
        effects.push({
          type: 'choice',
          description: 'Choose your next destination',
          moveOptions: moveOptions
        });
      }
    } else if (movementRule && (movementRule.movement_type === 'dice_outcome' || movementRule.movement_type === 'dice')) {
      this.handleDiceBasedMovement(playerId, currentPlayer, diceRoll, effects);
    }
  }

  /**
   * Handle dice-based movement (e.g., CHEAT-BYPASS, REG-FDNY-PLAN-EXAM)
   */
  private handleDiceBasedMovement(
    playerId: string,
    currentPlayer: Player,
    diceRoll: number,
    effects: DiceResultEffect[]
  ): void {
    const destinations = this.movementService.getDiceDestinationChoices(
      currentPlayer.currentSpace,
      currentPlayer.visitType,
      diceRoll,
      playerId  // Pass playerId to filter choices based on path memory
    );

    if (destinations.length === 1) {
      // Single destination - auto-select
      const singleDest = destinations[0];
      const destContent = this.dataService.getSpaceContent(singleDest, 'First');
      const destTitle = destContent?.title || singleDest;

      effects.push({
        type: 'movement',
        description: `Next: ${destTitle}`,
        destination: singleDest
      });

      debugLog(`🎲 Single dice destination: ${singleDest} - auto-selecting`);
      this.stateService.setPlayerMoveIntent(playerId, singleDest);

      // Show explanation if player is being sent back to a review/exam space
      const loopExplanation = this.getReviewLoopExplanation(currentPlayer.currentSpace, singleDest);
      if (loopExplanation && this.notificationService) {
        this.notificationService.notify(
          {
            short: `→ ${destTitle}`,
            medium: `📋 ${loopExplanation}`,
            detailed: `${currentPlayer.name} is being directed to ${destTitle}. ${loopExplanation}`
          },
          {
            playerId: playerId,
            playerName: currentPlayer.name,
            actionType: 'review_loop_explanation'
          }
        );
      }
    } else if (destinations.length > 1) {
      // Multiple destinations - present choice
      const currentSpaceContent = this.dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
      const prompt = `You rolled ${diceRoll}. Based on your outcome at ${currentSpaceContent?.title || currentPlayer.currentSpace}, choose your next path:`;

      effects.push({
        type: 'choice',
        description: prompt,
        moveOptions: destinations
      });

      const options = destinations.map(dest => {
        const destContent = this.dataService.getSpaceContent(dest, 'First');
        const destTitle = destContent?.title || dest;
        return { id: dest, label: destTitle !== dest ? `${dest} - ${destTitle}` : dest };
      });

      this.choiceService.createChoice(playerId, 'MOVEMENT', prompt, options)
        .then(selectedDestination => {
          debugLog(`✅ Player ${currentPlayer.name || playerId} selected destination (dice_outcome): ${selectedDestination}`);
          this.stateService.setPlayerMoveIntent(playerId, selectedDestination);

          const loopExplanation = this.getReviewLoopExplanation(currentPlayer.currentSpace, selectedDestination);
          if (loopExplanation && this.notificationService) {
            const destContent = this.dataService.getSpaceContent(selectedDestination, 'First');
            this.notificationService.notify(
              {
                short: `→ ${destContent?.title || selectedDestination}`,
                medium: `📋 ${loopExplanation}`,
                detailed: `${currentPlayer.name} chose ${destContent?.title || selectedDestination}. ${loopExplanation}`
              },
              {
                playerId: playerId,
                playerName: currentPlayer.name,
                actionType: 'review_loop_explanation'
              }
            );
          }
        })
        .catch(() => {
          debugLog(`🔄 Movement choice created for dice_outcome (will be resolved when player selects destination)`);
        });
    } else {
      debugWarn(`⚠️ No destinations found for dice roll ${diceRoll} at ${currentPlayer.currentSpace}`);
    }
  }
}
