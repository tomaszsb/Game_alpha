// src/services/DiceRollProcessor.ts
// Extracted from TurnService - handles dice roll processing with feedback

import { IDataService, IStateService, IGameRulesService, IDiceService, IChoiceService, IMovementService, IApprovalService } from '../types/ServiceContracts';
import { debugLog, debugWarn } from '../utils/debugLog';
import { DiceResultEffect, TurnEffectResult, Player, GameState } from '../types/StateTypes';
import { ApprovalStatus } from '../types/DataTypes';
import { formatDiceRollFeedback } from '../utils/buttonFormatting';
import { describeCardAction } from './DiceService';
import { Effect } from '../types/EffectTypes';
import { buildResourceSnapshot } from '../utils/resourceSnapshot';
import { shortName } from '../utils/boardCommon';
import { resolveFundingAmountToken } from '../utils/templateInterpolation';
import { DOB_AUDIT_SPACE, getDobLabel } from './ApprovalService';

/**
 * Interface for dice roll effects processing result
 */
export interface DiceRollEffectsResult {
  gameState: GameState;
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
  // Phase 7.5 — transient narration set by handleDiceBasedMovement when an
  // approval outcome fires. Read by buildTurnEffectResult and cleared at the
  // top of every rollDiceWithFeedback / rerollDice call. `kind` drives the
  // modal banner's color/icon; gate-bounce (not a real approval status) is
  // treated as 'minor-objection' since it's a redirect, not a hard denial.
  private lastApprovalOutcome?: { text: string; kind: ApprovalStatus };

  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private gameRulesService: IGameRulesService,
    private diceService: IDiceService,
    private choiceService: IChoiceService,
    private movementService: IMovementService,
    private approvalService?: IApprovalService
  ) {}

  /**
   * Set the callback for processing dice roll effects.
   * This is needed because the actual effect processing is in TurnService.
   */
  public setProcessDiceRollEffectsCallback(callback: ProcessDiceRollEffectsCallback): void {
    this.processDiceRollEffectsCallback = callback;
  }

  /**
   * Roll a single die (1-6)
   */
  public rollDice(): number {
    return this.diceService.rollDice();
  }

  /**
   * Generate a human-readable summary of the effects
   */
  public generateEffectSummary(effects: DiceResultEffect[], diceValue: number, storyText?: string, spaceName?: string): string {
    return this.diceService.generateEffectSummary(effects, diceValue, storyText, spaceName);
  }

  /**
   * Generate an explanatory message when dice outcome sends player back to a review/exam space
   */
  public getReviewLoopExplanation(fromSpace: string, toSpace: string): string | null {
    // Workstream 6 Phase 6.3: review-loop messages lifted from a hardcoded
    // 4-entry record to the `review_loop_message` Spaces.csv column. Real data
    // currently keeps the same 4 messages on the same 4 spaces (migrated
    // verbatim from the previous hardcode). Educators can configure the
    // message per-space.
    const dataMessage = this.dataService.getReviewLoopMessage(toSpace);
    if (dataMessage) {
      return dataMessage;
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

    // Snapshot BEFORE rolling so the modal can render before/after rows.
    const beforeScope = this.gameRulesService.calculateProjectScope(playerId);
    const beforeSnapshot = buildResourceSnapshot(currentPlayer, beforeScope);

    // Roll dice
    const diceRoll = this.rollDice();
    this.lastRollGroups = undefined;
    this.lastApprovalOutcome = undefined;
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

    // Generate summary — pass spaceName so the speaker-aware voice kicks in
    // (NPC attribution at owner/banker/etc. spaces; first-person at the five
    // PM-voiced spaces). fb:c3e5322b / fb:94c374d8 / fb:44a4eb47.
    const summary = this.generateEffectSummary(effects, diceRoll, storyText, currentPlayer.currentSpace);
    const hasChoices = effects.some(effect => effect.type === 'choice');

    // Generate detailed feedback message and store it in state
    const feedbackMessage = formatDiceRollFeedback(diceRoll, effects);
    this.stateService.setDiceRollCompletion(feedbackMessage);

    // Check if player can re-roll (from E066 card effect)
    const canReRoll = currentPlayer.turnModifiers?.canReRoll || false;

    // Calculate project time info for the modal
    const result = this.buildTurnEffectResult(currentPlayer, diceRoll, effects, summary, hasChoices, canReRoll, beforeSnapshot);
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

    // Capture BEFORE snapshot prior to mutating state for the re-roll.
    const beforeScope = this.gameRulesService.calculateProjectScope(playerId);
    const beforeSnapshot = buildResourceSnapshot(currentPlayer, beforeScope);

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
    this.lastApprovalOutcome = undefined;

    // Process effects for new dice roll
    const effects: DiceResultEffect[] = [];
    await this.processTurnEffectsWithTracking(playerId, newDiceRoll, effects);

    // Look up space story for narrative summary
    const spaceContent = this.dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
    const storyText = spaceContent?.story || undefined;

    // Generate summary for new result (speaker-aware via spaceName)
    const summary = this.generateEffectSummary(effects, newDiceRoll, storyText, currentPlayer.currentSpace);
    const hasChoices = effects.some(effect => effect.type === 'choice');

    return this.buildTurnEffectResult(currentPlayer, newDiceRoll, effects, summary, hasChoices, false, beforeSnapshot);
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
    canReRoll: boolean,
    beforeSnapshot?: import('../types/StateTypes').ResourceSnapshot
  ): TurnEffectResult {
    const timeEffect = effects.find(e => e.type === 'time');
    const actionDays = timeEffect?.value || 0;
    const projectLengthInfo = this.gameRulesService.calculateEstimatedProjectLength(currentPlayer.id);
    const updatedPlayer = this.stateService.getPlayer(currentPlayer.id);
    const totalDays = updatedPlayer?.timeSpent || currentPlayer.timeSpent;
    const progressPercent = projectLengthInfo.estimatedDays > 0
      ? (totalDays / projectLengthInfo.estimatedDays) * 100
      : 0;

    // After-snapshot reads live state (which reflects all applied effects).
    const afterScope = this.gameRulesService.calculateProjectScope(currentPlayer.id);
    const afterPlayerForSnapshot = updatedPlayer || currentPlayer;
    const afterSnapshot = buildResourceSnapshot(afterPlayerForSnapshot, afterScope);

    // Story prose for the modal's visual Summary block. The full assembled
    // `summary` (storyText + tone + recap) remains for TTS via getTtsText.
    // {fundingAmount} resolution (v3.0.99): BANK-FUND-REVIEW/INVESTOR-FUND-
    // REVIEW Subsequent stories quote the prior funding amount inline —
    // without this the modal showed the raw "{fundingAmount}" token.
    const rawBaseStory = this.dataService.getSpaceContent(
      currentPlayer.currentSpace, currentPlayer.visitType
    )?.story;
    const baseStory = rawBaseStory
      ? resolveFundingAmountToken(rawBaseStory, afterPlayerForSnapshot, this.dataService.getFundingSource(currentPlayer.currentSpace))
      : undefined;

    return {
      diceValue,
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      visualSummary: baseStory,
      // Phase 7.5 originally concatenated this into visualSummary as trailing
      // prose; split out (v3.0.99) so the modal can render it as its own
      // color-coded banner instead of buried inline text — see
      // TurnEffectResult.approvalOutcome for why.
      approvalOutcome: this.lastApprovalOutcome,
      hasChoices,
      canReRoll,
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
    effectResults: { results: Array<{ data?: { cardIds?: string[]; skipped?: boolean; constructionCost?: number; scheduleDays?: number } }> } | undefined,
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
        const cardAction = isReplaceDraw ? 'replace' : 'draw';

        effects.push({
          type: 'cards',
          description: describeCardAction(cardAction, effect.payload.cardType, effect.payload.count),
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

        const removeCount = effect.payload.count || effect.payload.cardIds.length;
        effects.push({
          type: 'cards',
          description: describeCardAction('remove', effect.payload.cardType || '', removeCount),
          cardType: effect.payload.cardType,
          cardCount: removeCount,
          cardAction: 'remove',
          cardIds: effectResult?.data?.cardIds || effect.payload.cardIds || []
        });
      } else if (effect.effectType === 'CONTRACTOR_UPDATE') {
        // CON-INITIATION dice rolls. Surface the qualitative outcome so the
        // player can see what they rolled — pre-fix, the modal showed nothing
        // useful (fb:0520fd41).
        const { kind, value } = effect.payload;
        if (kind === 'quality') {
          const friendly = ({ HIGH: 'High', MED: 'Medium', LOW: 'Low' } as Record<string, string>)[value.toUpperCase().trim()] || value;
          effects.push({
            type: 'qualitative_outcome',
            description: `Hired a contractor of ${friendly} quality`,
            outcomeKind: 'quality',
            outcomeLabel: 'Quality',
            outcomeValue: friendly
          });
        } else {
          // multiplier: "1" → "1×". When the hire actually charged money, the
          // engine hands back the computed terms — show the dollar figure and
          // schedule the player agreed to, not just the multiplier (fb:40caa223
          // + the v3.0.92 price/schedule redesign).
          const clean = value.trim();
          const agreedPrice = effectResult?.data?.constructionCost;
          const scheduleDays = effectResult?.data?.scheduleDays;
          const parts: string[] = [];
          if (agreedPrice && agreedPrice > 0) parts.push(`agreed price $${agreedPrice.toLocaleString()}`);
          if (scheduleDays && scheduleDays > 0) parts.push(`schedule +${scheduleDays} days`);
          effects.push({
            type: 'qualitative_outcome',
            description: parts.length > 0
              ? `Contractor signed at ${clean}× — ${parts.join(', ')}`
              : `Contractor cost multiplier: ${clean}×`,
            outcomeKind: 'multiplier',
            outcomeLabel: agreedPrice && agreedPrice > 0 ? 'Agreed price' : 'Multiplier',
            outcomeValue: agreedPrice && agreedPrice > 0
              ? `$${agreedPrice.toLocaleString()} (${clean}×${scheduleDays ? `, +${scheduleDays}d` : ''})`
              : `${clean}×`
          });
        }
      } else if (effect.effectType === 'RESOURCE_CHANGE') {
        if (effect.payload.resource === 'MONEY') {
          let displayAmount = effect.payload.amount;
          let description = effect.payload.amount > 0 ? 'Received project funding' : 'Paid project costs';

          const payload = effect.payload as { percentageOfScope?: number; feeCategory?: string };
          if (payload.percentageOfScope !== undefined) {
            const projectScope = this.gameRulesService.calculateProjectScope(currentPlayer.id);
            displayAmount = -Math.floor((projectScope * payload.percentageOfScope) / 100);
            const feeType = payload.feeCategory === 'architectural'
              ? 'Architect'
              : payload.feeCategory === 'construction'
                ? 'Change order'
                : 'Engineer';
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
    // Workstream 7 — Plan Approval Mechanic.
    // If the player rolled at a regulated examiner space (DOB plan exam, FDNY
    // plan exam, DOB audit), update approval state before computing destinations.
    // The roll-to-status mapping lives in ApprovalService; the destination
    // routing is unchanged (the existing dice table still drives where the
    // player physically moves).
    if (this.approvalService) {
      const outcome = this.approvalService.resolveDiceOutcome(
        currentPlayer.currentSpace,
        currentPlayer.visitType,
        diceRoll
      );
      if (outcome) {
        const update = this.approvalService.applyOutcome(outcome);
        // Workstream 7 Try-Again rollback: route through TEMP. Falls through to
        // updatePlayer if no active TEMP (e.g. between turns).
        this.stateService.updateTempState(playerId, update);
        debugLog(`📋 Approval outcome at ${currentPlayer.currentSpace} (${currentPlayer.visitType}, roll ${diceRoll}): ${outcome.approval} → ${outcome.kind}`);
        // Phase 7.5 — record NPC-voiced narration for the modal banner.
        const narration = this.approvalService.narrateOutcome(
          outcome,
          currentPlayer.currentSpace,
          currentPlayer.visitType
        );
        this.lastApprovalOutcome = { text: narration, kind: outcome.kind };
        // Domain-event stage 4: per the maintainer's log-coverage decision,
        // this previously reached only the modal banner above — never the
        // permanent log.
        this.stateService.emitGameEvent({
          type: 'approval_outcome_determined',
          playerId,
          playerName: currentPlayer.name,
          spaceName: currentPlayer.currentSpace,
          approval: outcome.approval,
          kind: outcome.kind,
          source: 'examiner_roll',
          message: narration,
        });
      }
    }

    // Workstream 7 Phase 7.4 — REG-DOB-FINAL-REVIEW Stage-1 gate.
    // Before the existing dice-driven movement (Stage 2 — paperwork roll), the
    // clerk verifies prior approvals are on file. Missing approvals override
    // the dice destination with a forced route back to the missing examiner.
    // The dice value the player rolled is discarded — they didn't get to "roll
    // for paperwork" because they failed the prior-approval check.
    if (this.approvalService && this.dataService.hasFinalReviewGate(currentPlayer.currentSpace)) {
      const gate = this.approvalService.checkFinalReviewGate(currentPlayer);
      if (!gate.passed && gate.routeTo) {
        const destContent = this.dataService.getSpaceContent(gate.routeTo, 'First');
        const destTitle = destContent?.title || gate.routeTo;
        effects.push({
          type: 'movement',
          description: `Sent back to ${destTitle}: ${gate.reason}`,
          destination: gate.routeTo,
        });
        this.stateService.setPlayerMoveIntent(playerId, gate.routeTo);
        debugLog(`🛂 Final-review gate failed at ${currentPlayer.currentSpace} (missing=${gate.missing}) → routing to ${gate.routeTo}`);
        // Phase 7.5 — gate-bounce narration for the modal banner. Not a real
        // approval status change (the player was bounced, not denied), so
        // 'minor-objection' gives the amber "go fix this" treatment.
        this.lastApprovalOutcome = { text: `🛂 ${getDobLabel()} clerk: ${gate.reason}`, kind: 'minor-objection' };
        // Domain-event stage 3: ToastWriter reacts to this emission (no
        // log-channel case for routed_back_to_review — see stage-3 scope note).
        this.stateService.emitGameEvent({
          type: 'routed_back_to_review',
          playerId,
          playerName: currentPlayer.name,
          spaceName: currentPlayer.currentSpace,
          toSpace: gate.routeTo,
          toSpaceTitle: destTitle,
          // FinalReviewGateResult.reason is optional in its type but every
          // passed:false branch in checkFinalReviewGate sets it; fallback
          // only guards a type it's never actually seen at runtime.
          reason: gate.reason || `Sent back to ${destTitle}`,
          kind: 'gate_bounce',
        });
        return; // Skip Stage-2 dice resolution entirely.
      }
    }

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

      // Prof-cert self-certification grants DOB approval on a "pass" roll — one
      // that routes onward (to FDNY) rather than into the DOB audit. Without
      // this, a Prof Cert player never gets the DOB-approval flag and loops at
      // FDNY forever (fb:f1bc011b). Driven off CSV data (path_type='Prof', the
      // self-cert track) — NOT a hardcoded space id. The audit shares that
      // track but is resolved above by resolveDiceOutcome, so it's excluded;
      // granting on the resolved destination (not a re-hardcoded roll
      // threshold) keeps it in lockstep with the dice table. Routed through
      // TEMP so Try-Again rolls it back like other approvals.
      const profCertConfig = this.dataService.getGameConfigBySpace(currentPlayer.currentSpace);
      if (
        this.approvalService &&
        profCertConfig?.path_type === 'Prof' &&
        currentPlayer.currentSpace !== DOB_AUDIT_SPACE &&
        singleDest !== DOB_AUDIT_SPACE
      ) {
        // Domain-event stage 4: grantProfCertApproval() now owns the
        // announcement text too, instead of it being hardcoded here.
        const profCertResult = this.approvalService.grantProfCertApproval(playerId, currentPlayer);
        this.stateService.updateTempState(playerId, profCertResult.update);
        this.lastApprovalOutcome = { text: profCertResult.event.message, kind: 'approved' };
        this.stateService.emitGameEvent(profCertResult.event);
        debugLog(`📋 Prof Cert pass at ${currentPlayer.currentSpace} (roll ${diceRoll}) → DOB approval granted`);
      }

      // Show explanation if player is being sent back to a review/exam space
      const loopExplanation = this.getReviewLoopExplanation(currentPlayer.currentSpace, singleDest);
      if (loopExplanation) {
        this.stateService.emitGameEvent({
          type: 'routed_back_to_review',
          playerId,
          playerName: currentPlayer.name,
          spaceName: currentPlayer.currentSpace,
          toSpace: singleDest,
          toSpaceTitle: destTitle,
          reason: loopExplanation,
          kind: 'single_destination',
        });
      }
    } else if (destinations.length > 1) {
      // Multiple destinations - present choice
      const currentSpaceContent = this.dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
      // Voice rule (no game language): no "you rolled N" — frame the real-world
      // outcome and ask for the next step (not "path").
      const prompt = `Based on how things turned out at ${currentSpaceContent?.title || currentPlayer.currentSpace}, choose your next step:`;

      effects.push({
        type: 'choice',
        description: prompt,
        moveOptions: destinations
      });

      const options = destinations.map(dest => {
        // Friendly board name (display_label_override > shortName), not the raw
        // space code — matches the choice-movement picker and the board tiles.
        const friendly = this.dataService.getDisplayLabelOverride(dest) || shortName(dest);
        const destContent = this.dataService.getSpaceContent(dest, 'First');
        const destTitle = destContent?.title || '';
        return { id: dest, label: destTitle && destTitle !== friendly ? `${friendly} — ${destTitle}` : friendly };
      });

      this.choiceService.createChoice(playerId, 'MOVEMENT', prompt, options)
        .then(selectedDestination => {
          debugLog(`✅ Player ${currentPlayer.name || playerId} selected destination (dice_outcome): ${selectedDestination}`);
          this.stateService.setPlayerMoveIntent(playerId, selectedDestination);

          const loopExplanation = this.getReviewLoopExplanation(currentPlayer.currentSpace, selectedDestination);
          if (loopExplanation) {
            const destContent = this.dataService.getSpaceContent(selectedDestination, 'First');
            this.stateService.emitGameEvent({
              type: 'routed_back_to_review',
              playerId,
              playerName: currentPlayer.name,
              spaceName: currentPlayer.currentSpace,
              toSpace: selectedDestination,
              toSpaceTitle: destContent?.title || selectedDestination,
              reason: loopExplanation,
              kind: 'chosen_destination',
            });
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
