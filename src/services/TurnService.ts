import { ITurnService, IDataService, IStateService, IGameRulesService, ICardService, IResourceService, IEffectEngineService, IMovementService, ILoggingService, IChoiceService, IDiceService, ISpaceEffectService, ICardEffectService, TurnResult, INotificationService, IApprovalService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { NegotiationService } from './NegotiationService';
import { DiceService } from './DiceService';
import { SpaceEffectService } from './SpaceEffectService';
import { SpaceArrivalProcessor } from './SpaceArrivalProcessor';
import { DiceRollProcessor } from './DiceRollProcessor';
import { TurnTransitionHandler } from './TurnTransitionHandler';
import { MovementExecutor } from './MovementExecutor';
import { GameState, Player, DiceResultEffect, TurnEffectResult, CreateTempOptions, MutablePlayerState } from '../types/StateTypes';
import { DiceEffect, SpaceEffect, Movement, CardType, VisitType } from '../types/DataTypes';
import { EffectFactory } from '../utils/EffectFactory';
import { EffectContext, Effect } from '../types/EffectTypes';
import { formatManualEffectButton, formatDiceRollFeedback, formatActionFeedback } from '../utils/buttonFormatting';
import { getCardTypeName } from '../utils/cardTypeNames';
import { describeCardAction } from './DiceService';
import { buildResourceSnapshot } from '../utils/resourceSnapshot';
import { ConditionEvaluator } from '../utils/ConditionEvaluator';
import { interpolateTemplate } from '../utils/templateInterpolation';
import { AutoActionEvent } from './StateService';

export class TurnService implements ITurnService {
  private readonly dataService: IDataService;
  private readonly stateService: IStateService;
  private readonly gameRulesService: IGameRulesService;
  private readonly cardService: ICardService;
  private readonly resourceService: IResourceService;
  private readonly movementService: IMovementService;
  private readonly negotiationService: NegotiationService;
  private readonly loggingService: ILoggingService;
  private readonly choiceService: IChoiceService;
  private readonly diceService: IDiceService;
  private readonly spaceEffectService: ISpaceEffectService;
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly spaceArrivalProcessor: SpaceArrivalProcessor;
  private readonly diceRollProcessor: DiceRollProcessor;
  private readonly movementExecutor: MovementExecutor;
  private readonly turnTransitionHandler: TurnTransitionHandler;
  private readonly notificationService?: INotificationService;
  private effectEngineService?: IEffectEngineService;
  private readonly cardEffectService?: ICardEffectService;
  private readonly approvalService?: IApprovalService;

  constructor(dataService: IDataService, stateService: IStateService, gameRulesService: IGameRulesService, cardService: ICardService, resourceService: IResourceService, movementService: IMovementService, negotiationService: NegotiationService, loggingService: ILoggingService, choiceService: IChoiceService, notificationService?: INotificationService, effectEngineService?: IEffectEngineService, diceService?: IDiceService, spaceEffectService?: ISpaceEffectService, cardEffectService?: ICardEffectService, approvalService?: IApprovalService) {
    this.dataService = dataService;
    this.stateService = stateService;
    this.gameRulesService = gameRulesService;
    this.cardService = cardService;
    this.resourceService = resourceService;
    this.movementService = movementService;
    this.negotiationService = negotiationService;
    this.loggingService = loggingService;
    this.choiceService = choiceService;
    this.notificationService = notificationService;
    this.effectEngineService = effectEngineService;
    this.cardEffectService = cardEffectService;
    this.approvalService = approvalService;
    // Use provided DiceService or create a default instance
    this.diceService = diceService || new DiceService();
    // Use provided SpaceEffectService or create a default instance
    this.spaceEffectService = spaceEffectService || new SpaceEffectService(
      stateService,
      cardService,
      resourceService,
      gameRulesService,
      this.diceService,
      dataService
    );
    // Create ConditionEvaluator with GameRulesService for scope conditions
    this.conditionEvaluator = new ConditionEvaluator(gameRulesService);
    // Create SpaceArrivalProcessor for space arrival effect processing
    this.spaceArrivalProcessor = new SpaceArrivalProcessor(
      dataService,
      stateService,
      cardService,
      loggingService,
      gameRulesService,
      effectEngineService,
      notificationService
    );
    // Create DiceRollProcessor for dice roll processing with feedback
    this.diceRollProcessor = new DiceRollProcessor(
      dataService,
      stateService,
      gameRulesService,
      this.diceService,
      choiceService,
      movementService,
      notificationService,
      approvalService
    );
    // Set the callback for processing dice roll effects (needed for circular dependency)
    this.diceRollProcessor.setProcessDiceRollEffectsCallback(
      (playerId, diceRoll) => this.processDiceRollEffects(playerId, diceRoll)
    );
    // Create MovementExecutor for movement execution during end-of-turn
    this.movementExecutor = new MovementExecutor(
      dataService,
      stateService,
      movementService
    );
    // Create TurnTransitionHandler for turn-end processing and player advancement
    this.turnTransitionHandler = new TurnTransitionHandler(
      stateService,
      cardService,
      loggingService,
      effectEngineService,
      notificationService
    );
    // Set the callback for finalizing quick start hand (needed because it accesses TurnService internals)
    this.turnTransitionHandler.setFinalizeQuickStartHandCallback(
      () => this.finalizeQuickStartHand()
    );
  }

  /**
   * Set the EffectEngineService after construction to handle circular dependencies
   */
  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
    this.spaceArrivalProcessor.setEffectEngineService(effectEngineService);
    this.turnTransitionHandler.setEffectEngineService(effectEngineService);
  }

  /**
   * Assert that all required setter-injected dependencies are initialized.
   * Call this at the start of public methods that depend on these services.
   * @throws Error if EffectEngineService is not set
   */
  private assertDependenciesReady(): void {
    if (!this.effectEngineService) {
      throw new Error(
        'TurnService not fully initialized: EffectEngineService not set. ' +
        'Call setEffectEngineService() before using TurnService methods.'
      );
    }
  }

  /**
   * Get a list of available actions for the current player based on game state.
   * This is used by UI components to determine which buttons to display.
   *
   * @param playerId - The ID of the player to get actions for.
   * @returns An array of ActionType strings.
   */
  public getAvailableActions(playerId: string): import('../types/ServiceContracts').ActionType[] {
    const actions: import('../types/ServiceContracts').ActionType[] = [];
    const gameState = this.stateService.getGameState();
    const player = this.stateService.getPlayer(playerId);

    if (!player || !this.gameRulesService.isPlayerTurn(playerId)) {
      return actions;
    }

    // If player hasn't moved and is on a space that requires dice roll for movement
    const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
    if (spaceConfig?.requires_dice_roll && !gameState.hasPlayerRolledDice) {
      actions.push('ROLL_TO_MOVE');
    }

    // Add other actions based on available manual effects
    // For now, hardcode some common manual actions
    const spaceEffects = this.dataService.getSpaceEffects(player.currentSpace, player.visitType);
    const manualSpaceEffects = spaceEffects.filter(effect => effect.trigger_type === 'manual');
    
    manualSpaceEffects.forEach(effect => {
      if (effect.effect_type === 'money') {
        actions.push('ROLL_FOR_MONEY');
      } else if (effect.effect_type === 'time') {
        actions.push('ROLL_FOR_TIME');
      } else if (effect.effect_type === 'cards') {
        if (effect.effect_action === 'draw_w') actions.push('ROLL_FOR_CARDS_W');
        if (effect.effect_action === 'draw_b') actions.push('ROLL_FOR_CARDS_B');
        if (effect.effect_action === 'draw_e') actions.push('ROLL_FOR_CARDS_E');
        if (effect.effect_action === 'draw_l') actions.push('ROLL_FOR_CARDS_L');
        if (effect.effect_action === 'draw_i') actions.push('ROLL_FOR_CARDS_I');
      }
    });

    // If the player can end their turn, add 'END_TURN'
    if (this.gameRulesService.canEndTurn(playerId)) {
      actions.push('END_TURN');
    }

    return actions;
  }

  /**
   * Check if a player can end their turn
   *
   * A player can end their turn if:
   * - It is their turn
   * - There are no pending choices to resolve
   * - All required actions have been completed
   *
   * @param playerId - The ID of the player to check
   * @returns true if player can end turn, false otherwise
   */
  public canEndTurn(playerId: string): boolean {
    // Delegate to GameRulesService to avoid duplicate logic
    return this.gameRulesService.canEndTurn(playerId);
  }

  /**
   * Generate dynamic card IDs that reference actual cards from the CSV data
   * Format: STATIC_ID_timestamp_random_index
   */
  private generateCardIds(cardType: string, count: number): string[] {
    const cardsOfType = this.dataService.getCardsByType(cardType as any);
    if (cardsOfType.length === 0) {
      debugWarn(`No cards of type ${cardType} found in CSV data`);
      return [];
    }

    const cardIds: string[] = [];
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 9);

    for (let i = 0; i < count; i++) {
      // Randomly select a card from available cards of this type
      const randomCard = cardsOfType[Math.floor(Math.random() * cardsOfType.length)];
      // Create dynamic ID that starts with the static card ID
      const dynamicId = `${randomCard.card_id}_${timestamp}_${randomString}_${i}`;
      cardIds.push(dynamicId);
    }

    return cardIds;
  }

  async takeTurn(playerId: string): Promise<TurnResult> {
    // Ensure all setter-injected dependencies are ready
    this.assertDependenciesReady();

    // Turn start is logged in nextPlayer() method

    try {
      // Validation: Check if it's the player's turn
      if (!this.canPlayerTakeTurn(playerId)) {
        throw new Error(`It is not player ${playerId}'s turn`);
      }

      // Check if player has already moved this turn
      const gameState = this.stateService.getGameState();
      // State validation check
      if (gameState.hasPlayerMovedThisTurn) {
        debugWarn(`🎮 TurnService.takeTurn - Player ${playerId} has already moved, clearing flag and continuing (AI turn recovery)`);
        this.stateService.clearPlayerHasMoved();
      }

      // Get current player data
      const currentPlayer = this.stateService.getPlayer(playerId);
      if (!currentPlayer) {
        throw new Error(`Player ${playerId} not found`);
      }

      // Player position logged in turn start/end

      // Roll dice
      const diceRoll = this.rollDice();
      
      // Log dice roll to action history
      this.loggingService.info(`Rolled a ${diceRoll}`, {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        action: 'dice_roll',
        roll: diceRoll,
        space: currentPlayer.currentSpace
      });

      // Process turn effects based on dice roll
      await this.processTurnEffects(playerId, diceRoll);

      // Process leaving space effects BEFORE movement (time spent on current space)
      await this.processLeavingSpaceEffects(currentPlayer.id, currentPlayer.currentSpace, currentPlayer.visitType);

      // Note: Movement now happens in endTurnWithMovement()
      // This allows proper separation of intent (set during turn) from action (executed at turn end)
      const newGameState = this.stateService.getGameState();

      // Mark that the player has completed their action
      this.stateService.setPlayerHasMoved();

      return {
        newState: newGameState,
        diceRoll: diceRoll
      };
    } catch (error) {
      console.error(`🎮 TurnService.takeTurn - Error during turn:`, error);
      throw error;
    }
  }

  /**
   * Roll dice and process effects only (no movement)
   * This is for the "Roll Dice" button
   */
  async rollDiceAndProcessEffects(playerId: string): Promise<{ diceRoll: number }> {
    // Ensure all setter-injected dependencies are ready
    this.assertDependenciesReady();

    try {
      // Validation: Check if it's the player's turn
      if (!this.canPlayerTakeTurn(playerId)) {
        throw new Error(`It is not player ${playerId}'s turn`);
      }

      // Check if player has already moved this turn
      const gameState = this.stateService.getGameState();
      if (gameState.hasPlayerMovedThisTurn) {
        throw new Error(`Player ${playerId} has already moved this turn`);
      }

      // Get current player data
      const currentPlayer = this.stateService.getPlayer(playerId);
      if (!currentPlayer) {
        throw new Error(`Player ${playerId} not found`);
      }

      // Player position for dice roll

      // Roll dice
      const diceRoll = this.rollDice();

      // Store dice roll in player state for dice_outcome movement
      this.stateService.updatePlayer({
        id: currentPlayer.id,
        lastDiceRoll: {
          roll1: diceRoll,
          roll2: 0,
          total: diceRoll
        }
      });

      // Log dice roll to action history
      this.loggingService.info(`Rolled a ${diceRoll}`, {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        action: 'dice_roll',
        roll: diceRoll,
        space: currentPlayer.currentSpace
      });

      // Process turn effects based on dice roll (but NO movement)
      await this.processTurnEffects(playerId, diceRoll);

      // Mark that the player has rolled dice this turn (enables End Turn button)
      this.stateService.setPlayerHasRolledDice();

      // Mark that the player has taken an action (increments action counter)
      this.stateService.setPlayerHasMoved();

      // Dice roll processing complete
      return { diceRoll };
    } catch (error) {
      console.error(`🎲 TurnService.rollDiceAndProcessEffects - Error:`, error);
      throw error;
    }
  }

  /**
   * Handle movement and advance to next player
   * This is for the "End Turn" button
   */
  async endTurnWithMovement(force: boolean = false, skipAutoMove: boolean = false): Promise<{ nextPlayerId: string }> {
    // Ensure all setter-injected dependencies are ready
    this.assertDependenciesReady();

    // Per-step diagnostic — when end-turn fails, we want the failure point
    // surfaced to the user along with the error message (see ActionCenterPanel
    // handleEndTurn). Same shape as the v2.65.7 server save-source-files
    // diagnostic and the v2.66.0 drag-to-save banner (fb:56d0282c).
    let step = 'init';
    let currentSpaceForLog: string | undefined;
    try {
      step = 'validate_phase';
      const gameState = this.stateService.getGameState();

      // Validation: Game must be in PLAY phase
      if (gameState.gamePhase !== 'PLAY') {
        throw new Error('Cannot end turn outside of PLAY phase');
      }

      // Validation: Must have a current player
      if (!gameState.currentPlayerId) {
        throw new Error('No current player to end turn for');
      }

      step = 'find_player';
      // Get current player
      const currentPlayer = this.stateService.getPlayer(gameState.currentPlayerId);
      if (!currentPlayer) {
        throw new Error('Current player not found');
      }
      currentSpaceForLog = currentPlayer.currentSpace;

      step = 'check_actions';
      // Validation: Check if all required actions are completed (skip if force = true for Try Again)
      if (!force && gameState.requiredActions > gameState.completedActionCount) {
        throw new Error(`Cannot end turn: Player has not completed all required actions. Required: ${gameState.requiredActions}, Completed: ${gameState.completedActionCount}`);
      }

      step = 'check_scope_gate';
      // Guard: Cannot leave a scope-gated space without enough W cards.
      // Workstream 6 #2: lifted from `=== 'OWNER-SCOPE-INITIATION'` literal to the
      // min_w_cards_to_leave data flag so educators can gate other spaces too.
      if (!skipAutoMove) {
        const minW = this.dataService.getMinWCardsToLeave(currentPlayer.currentSpace);
        if (minW > 0) {
          const wCardCount = currentPlayer.hand.filter(c => c.startsWith('W')).length;
          if (wCardCount < minW) {
            throw new Error(`Your project needs scope — add at least ${minW} ${getCardTypeName('W', minW)} before leaving this space.`);
          }
        }
      }

      step = 'resolve_choice';
      // Resolve any pending movement choice if player has set their moveIntent
      // This handles the case where the UI set moveIntent without resolving the choice
      // (e.g., PlayerPanel click that just sets intent, or direct calls to endTurnWithMovement)
      if (gameState.awaitingChoice?.type === 'MOVEMENT' && currentPlayer.moveIntent) {
        this.choiceService.resolveChoice(gameState.awaitingChoice.id, currentPlayer.moveIntent);
      }

      // Process leaving space effects BEFORE movement (time spent on current space)
      // SKIP if skipAutoMove is true (e.g., after Try Again) - player is staying at same space
      if (!skipAutoMove) {
        step = 'leaving_effects';
        await this.processLeavingSpaceEffects(currentPlayer.id, currentPlayer.currentSpace, currentPlayer.visitType);
      }

      step = 'execute_movement';
      // Execute movement (delegates to MovementExecutor)
      await this.movementExecutor.executeMovement(currentPlayer, gameState, skipAutoMove);

      step = 'check_win';
      // Check for win condition before ending turn
      const hasWon = await this.gameRulesService.checkWinCondition(gameState.currentPlayerId);
      if (hasWon) {
        // Player has won - end the game
        this.stateService.endGame(gameState.currentPlayerId);
        return { nextPlayerId: gameState.currentPlayerId }; // Winner remains current player
      }

      step = 'commit_session';
      // Commit current exploration session before advancing to next player
      this.loggingService.commitCurrentSession();

      step = 'commit_temp_to_real';
      // Commit TEMP state to REAL (new REAL/TEMP state model)
      // This finalizes all turn effects into the committed state
      const commitResult = this.stateService.commitTempToReal(gameState.currentPlayerId);
      if (!commitResult.success) {
        debugWarn(`⚠️ Failed to commit TEMP state: ${commitResult.error}`);
      }

      step = 'next_player';
      // Advance to next player
      const nextPlayerResult = await this.nextPlayer();

      return nextPlayerResult;
    } catch (error) {
      // Surface step + context to docker logs AND to the throwing error so
      // the UI banner can show e.g. "Cannot end turn: ... (step: check_actions)".
      console.error('🏁 TurnService.endTurnWithMovement - Error:', {
        step,
        currentSpace: currentSpaceForLog,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        (error as Error & { step?: string }).step = step;
      }
      throw error;
    }
  }

  async endTurn(): Promise<{ nextPlayerId: string }> {
    const gameState = this.stateService.getGameState();
    
    // Validation: Game must be in PLAY phase
    if (gameState.gamePhase !== 'PLAY') {
      throw new Error('Cannot end turn outside of PLAY phase');
    }

    // Validation: Must have a current player
    if (!gameState.currentPlayerId) {
      throw new Error('No current player to end turn for');
    }

    // Check for game end conditions (win or turn limit) before ending turn
    const endConditions = await this.gameRulesService.checkGameEndConditions(gameState.currentPlayerId);
    if (endConditions.shouldEnd) {
      let winnerId: string | null = null;
      
      if (endConditions.reason === 'win' && endConditions.winnerId) {
        // Player won by reaching ending space
        winnerId = endConditions.winnerId;
        // Log game end victory
        this.loggingService.info('Won the game by reaching the ending space!', {
          playerId: winnerId,
          playerName: this.stateService.getPlayer(winnerId)?.name || 'Unknown',
          action: 'gameEnd',
          winCondition: 'space_victory',
          finalSpace: this.stateService.getPlayer(winnerId)?.currentSpace
        });
      } else if (endConditions.reason === 'turn_limit') {
        // Game ended due to turn limit - determine winner by score
        winnerId = this.gameRulesService.determineWinner();
        // Log game end by turn limit
        this.loggingService.info(`Game ended: Turn limit reached. Winner determined by score.`, {
          playerId: winnerId || gameState.currentPlayerId,
          playerName: this.stateService.getPlayer(winnerId || gameState.currentPlayerId)?.name || 'Unknown',
          action: 'gameEnd',
          winCondition: 'turn_limit',
          finalTurn: gameState.globalTurnCount
        });
      }
      
      // Workstream 7 Phase 7.4 — end-game penalty when the winner reached
      // FINISH without DOB sign-off. Backstop for the Stage-1 gate at
      // REG-DOB-FINAL-REVIEW (should never normally fire, but safe-guards
      // legacy save states and any future direct-routes-to-FINISH path).
      const finalWinnerId = winnerId || gameState.currentPlayerId;
      if (this.approvalService && endConditions.reason === 'win') {
        const winnerPlayer = this.stateService.getPlayer(finalWinnerId);
        if (winnerPlayer) {
          const penalty = this.approvalService.computeEndGamePenalty(winnerPlayer);
          if (penalty) {
            this.stateService.updatePlayer({
              id: finalWinnerId,
              timeSpent: penalty.newTimeSpent,
              money: penalty.newMoney,
            });
            this.stateService.updateGameState({
              endGamePenalty: {
                dobMissing: true,
                days: penalty.days,
                fee: penalty.fee,
                playerId: finalWinnerId,
              },
            });
            this.loggingService.info(`End-game penalty applied: missing DOB sign-off (+${penalty.days} days, +$${penalty.fee.toLocaleString()} fee).`, {
              playerId: finalWinnerId,
              playerName: winnerPlayer.name,
              action: 'end_game_penalty',
              penaltyDays: penalty.days,
              penaltyFee: penalty.fee,
            });
          }
        }
      }

      // End the game with the determined winner
      this.stateService.endGame(finalWinnerId);
      return { nextPlayerId: finalWinnerId };
    }

    // Commit current exploration session before advancing to next player
    this.loggingService.commitCurrentSession();

    // Use the common nextPlayer method
    return await this.nextPlayer();
  }

  /**
   * Advances to the next player in turn order.
   *
   * TURN END SEQUENCE TIMING (Critical for correctness):
   * =====================================================
   * The order of operations during turn end is carefully designed to ensure:
   * 1. Card expirations work correctly (turnsRemaining counter)
   * 2. Logging displays correct turn numbers
   * 3. Turn counter advances at the right time
   *
   * SEQUENCE BREAKDOWN:
   * -------------------
   * Step 1: Process card expirations (line 459)
   *   - Decrements turnsRemaining for active cards
   *   - Expires cards with turnsRemaining <= 0
   *   - MUST happen BEFORE turn advances
   *   - Why: Card activated turn 5 with duration=3 should expire end of turn 7
   *          If we advanced turn first, expiration check would be wrong
   *
   * Step 2: Process active effects (line 464)
   *   - Applies duration-based card effects for all players
   *   - Happens at end of current turn (before advance)
   *
   * Step 3: Reset re-roll flags (line 471)
   *   - Clears one-time use flags for current player
   *
   * Step 4: Log turn end (line 481)
   *   - Uses globalTurnCount + 1 to match turn start numbering
   *   - Why +1? Turn start logs "Turn N started", turn end should log "Turn N ended"
   *   - But globalTurnCount hasn't advanced yet (still N-1)
   *   - So we add +1 to get N
   *   - This is intentional and correct!
   *
   * Step 5: Advance turn counter (line 525)
   *   - Increments globalTurnCount (N-1 → N)
   *   - Happens AFTER all turn-end processing
   *   - Happens BEFORE setting next player
   *
   * Step 6: Set next player and start their turn (line 528, 556)
   *   - Changes currentPlayerId
   *   - Calls startTurn() to process arrival effects
   *
   * TIMING EXAMPLE:
   * ---------------
   * Turn 7 ends for Player A:
   * 1. endOfTurn() - Card with turnsRemaining=1 decrements to 0, expires ✅
   * 2. processActiveEffects() - Turn 7 effects applied ✅
   * 3. Log "Turn 8 ended" (globalTurnCount=7, so 7+1=8) ✅
   * 4. advanceTurn() - globalTurnCount: 7 → 8
   * 5. setCurrentPlayer(Player B)
   * 6. startTurn(Player B) - "Turn 8 started" logged ✅
   *
   * NOTE: Loan interest is NO LONGER applied here (changed to upfront fee model)
   *       Interest is charged once when loan is taken, not every turn.
   *       See ResourceService.takeOutLoan() for upfront fee implementation.
   */
  private async nextPlayer(): Promise<{ nextPlayerId: string }> {
    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;

    if (allPlayers.length === 0) {
      throw new Error('No players in the game');
    }

    // Find the current player index
    const currentPlayerIndex = allPlayers.findIndex(p => p.id === gameState.currentPlayerId);
    if (currentPlayerIndex === -1 || gameState.currentPlayerId === null) {
      throw new Error('Current player not found in player list');
    }
    const currentPlayerId = gameState.currentPlayerId;

    // STEPS 1-4.5: Process end-of-turn effects (card expirations, active effects,
    // re-roll resets, turn-end logging, quick start finalization)
    await this.turnTransitionHandler.processEndOfTurn(currentPlayerId);

    // STEPS 5-6: Advance to next player (skip-turn logic, advance turn counter,
    // set current player, reset turn flags, send end-turn notification)
    const nextPlayerId = this.turnTransitionHandler.advanceToNextPlayer(currentPlayerIndex, allPlayers);

    // Start next player's turn with unified function
    // This handles all arrival logic, movement choices, and turn start logging
    await this.startTurn(nextPlayerId);

    return { nextPlayerId };
  }

  /**
   * Finalize Quick Start mode by distributing P1's captured cards to all players.
   * Called at the end of P1's first turn in Quick Start mode.
   *
   * This method:
   * 1. Gets the captured starting hand from P1's turn
   * 2. Copies those cards to all other players' hands
   * 3. Removes the starting cards from each player's per-player deck
   * 4. Clears the isCapturingStartingHand flag
   */
  private finalizeQuickStartHand(): void {
    const gameState = this.stateService.getGameState();

    if (!gameState.isCapturingStartingHand) {
      return; // Not in Quick Start capture mode
    }

    const startingHand = gameState.startingHand || [];
    if (startingHand.length === 0) {
      this.stateService.updateGameState({ isCapturingStartingHand: false });
      return;
    }


    const allPlayers = gameState.players;
    const playerDecks = gameState.playerDecks ? { ...gameState.playerDecks } : {};

    // P1 already has the cards in their hand (captured during their turn)
    // Now distribute to all other players
    for (let i = 1; i < allPlayers.length; i++) {
      const player = allPlayers[i];

      // Add starting cards to player's hand
      const currentHand = player.hand || [];
      const updatedHand = [...currentHand, ...startingHand];

      this.stateService.updatePlayer({
        id: player.id,
        hand: updatedHand
      });


      // Remove starting cards from this player's deck
      if (playerDecks[player.id]) {
        for (const cardId of startingHand) {
          const cardType = this.getCardTypeFromId(cardId);
          if (cardType && playerDecks[player.id][cardType]) {
            const deck = playerDecks[player.id][cardType];
            const cardIndex = deck.indexOf(cardId);
            if (cardIndex !== -1) {
              deck.splice(cardIndex, 1);
            }
          }
        }
      }
    }

    // Update game state with modified decks and clear capturing flag
    this.stateService.updateGameState({
      playerDecks,
      isCapturingStartingHand: false
    });

    // Log the completion
    this.loggingService.info(`Quick Start: Starting hand distributed to all players`, {
      startingHand,
      playerCount: allPlayers.length,
      action: 'quick_start_finalized'
    });

  }

  /**
   * Helper to get card type from card ID for Quick Start mode.
   */
  private getCardTypeFromId(cardId: string): 'W' | 'B' | 'E' | 'L' | 'I' | null {
    if (!cardId) return null;
    const firstChar = cardId.charAt(0).toUpperCase();
    if (['W', 'B', 'E', 'L', 'I'].includes(firstChar)) {
      return firstChar as 'W' | 'B' | 'E' | 'L' | 'I';
    }
    return null;
  }

  /**
   * Unified turn start function with correct sequence:
   * 1. Lock UI to prevent player actions
   * 2. Save snapshot for Try Again feature
   * 3. Process arrival effects of the space
   * 4. Unlock UI and handle movement choices
   */
  public async startTurn(playerId: string): Promise<void> {
    // Ensure all setter-injected dependencies are ready
    this.assertDependenciesReady();

    // Clear any old choices from the previous turn
    this.stateService.clearAwaitingChoice();

    try {
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        throw new Error(`Player ${playerId} not found`);
      }

      const gameState = this.stateService.getGameState();

      // Log turn start for this player using simplified turn numbering
      const playerTurnNumber = (gameState.playerTurnCounts[player.id] || 0) + 1;
      const turnLabel = `Turn ${gameState.globalTurnCount + 1}`;
      this.loggingService.info(`${turnLabel} started`, {
        playerId: player.id,
        playerName: player.name,
        action: 'turn_start',
        turn: gameState.globalTurnCount + 1,
        playerTurnNumber: playerTurnNumber,
        spaceName: player.currentSpace,
        visitType: player.visitType,
        visibility: 'player',
        isCommitted: true  // Force turn_start to be immediately visible in log
      });

      // 1. Start new exploration session for transactional logging
      const sessionId = this.loggingService.startNewExplorationSession();

      // 1.5. Create TEMP state from REAL for this turn (new REAL/TEMP state model)
      // This allows all turn effects to apply to TEMP, preserving REAL for Try Again
      const tempOptions: CreateTempOptions = {
        playerId: player.id,
        spaceName: player.currentSpace,
        visitType: player.visitType
      };
      const tempResult = this.stateService.createTempStateFromReal(tempOptions);
      if (!tempResult.success) {
        debugWarn(`⚠️ Failed to create TEMP state: ${tempResult.error}`);
      }

      // 2. Lock UI to prevent player actions during arrival processing
      this.stateService.updateGameState({ isProcessingArrival: true });

      // 3. Mark game as fully initialized (enables Try Again feature)
      if (!this.stateService.isInitialized()) {
        this.stateService.markAsInitialized();
      }

      // 4. Process space effects (including space entry logging as first effect)
      await this.processSpaceEffectsAfterMovement(player.id, player.currentSpace, player.visitType, false);

      // Note: REAL/TEMP state model handles Try Again state preservation
      // TEMP state contains effects applied this turn; REAL state is preserved for reversion

      // 5. Unlock UI after processing is complete
      this.stateService.updateGameState({ isProcessingArrival: false });

      // Auto-apply funding when arriving at a space flagged auto_apply_funding=Yes
      // (no button needed). Workstream 6 #3: lifted from `=== 'OWNER-FUND-INITIATION'`.
      if (this.dataService.shouldAutoApplyFunding(player.currentSpace)) {
        await this.handleAutomaticFunding(player.id);
      }

      // Handle movement choices after effects are processed
      await this.handleMovementChoices(player.id);

      // Auto-roll dice for REGULATORY-phase dice-movement spaces (clerk/examiner makes the decision)
      // CHEAT spaces require manual roll (player actively cheating)
      // Workstream 6 #8: lifted from `currentSpace.startsWith('REG-')` to phase check
      // so educator-added regulatory spaces (any prefix) get the same auto-roll behavior.
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      const isDiceMovementSpace = movement?.movement_type === 'dice';
      const spacePhase = this.dataService.getGameConfigBySpace(player.currentSpace)?.phase;
      const isRegulatoryPhaseSpace = spacePhase === 'REGULATORY';

      if (isDiceMovementSpace && isRegulatoryPhaseSpace) {
        // Small delay so player sees they arrived before dice rolls
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.rollDiceWithFeedback(player.id);
      }

    } catch (error) {
      // Ensure UI is unlocked if there's an error
      this.stateService.updateGameState({ isProcessingArrival: false });
      console.error(`🚨 TurnService.startTurn - Error during turn start for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Handles movement choice logic after arrival effects are processed
   *
   * ARCHITECTURE NOTE: This is 1 of 3 paths that create movement choices:
   * 1. handleMovementChoices() - Called at turn start (THIS METHOD)
   * 2. processTurnEffectsWithTracking() - Called after dice roll for dice_outcome spaces
   * 3. restoreMovementChoiceIfNeeded() - Called after manual effects clear choice state
   *
   * Duplicate prevention: dice_outcome guard ensures paths 1 & 3 skip dice spaces,
   * while path 2 only handles dice spaces. Guards are mutually exclusive.
   *
   * @private
   */
  /**
   * Handle movement choices at turn start - delegates to MovementService
   */
  private async handleMovementChoices(playerId: string): Promise<void> {
    await this.movementService.handleMovementChoices(playerId);
  }

  /**
   * Restores movement choice if the current space requires one - delegates to MovementService
   * Used after completing manual effects that clear the choice state
   *
   * @private
   */
  private async restoreMovementChoiceIfNeeded(playerId: string): Promise<void> {
    await this.movementService.restoreMovementChoiceIfNeeded(playerId);
  }

  rollDice(): number {
    return this.diceService.rollDice();
  }

  canPlayerTakeTurn(playerId: string): boolean {
    const gameState = this.stateService.getGameState();
    
    // Game must be in PLAY phase
    if (gameState.gamePhase !== 'PLAY') {
      return false;
    }

    // Must be the current player's turn
    if (gameState.currentPlayerId !== playerId) {
      return false;
    }

    // Player must exist
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    return true;
  }

  getCurrentPlayerTurn(): string | null {
    const gameState = this.stateService.getGameState();
    return gameState.currentPlayerId;
  }

  async processTurnEffects(playerId: string, diceRoll: number): Promise<GameState> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    try {
      // Get space effect data from DataService
      const spaceEffectsData = this.dataService.getSpaceEffects(
        currentPlayer.currentSpace, 
        currentPlayer.visitType
      );
      
      // Filter space effects based on conditions (e.g., scope_le_4M, scope_gt_4M)
      const conditionFilteredEffects = this.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);

      // Filter out manual effects and time effects - manual effects are triggered by buttons, time effects on leaving space
      const filteredSpaceEffects = conditionFilteredEffects.filter(effect =>
        effect.trigger_type !== 'manual' && effect.effect_type !== 'time'
      );
      
      // Get dice effect data from DataService  
      const diceEffectsData = this.dataService.getDiceEffects(
        currentPlayer.currentSpace, 
        currentPlayer.visitType
      );
      
      // Get space configuration for action processing
      const spaceConfig = this.dataService.getGameConfigBySpace(currentPlayer.currentSpace);
      
      // Generate all effects from space entry using EffectFactory
      const spaceEffects = EffectFactory.createEffectsFromSpaceEntry(
        filteredSpaceEffects,
        playerId,
        currentPlayer.currentSpace,
        currentPlayer.visitType,
        spaceConfig || undefined,
        currentPlayer.name
      );
      
      // Generate all effects from dice roll using EffectFactory
      const diceEffects = EffectFactory.createEffectsFromDiceRoll(
        diceEffectsData,
        playerId,
        currentPlayer.currentSpace,
        diceRoll,
        currentPlayer.name
      );
      
      // Add user messaging when funding is auto-applied (paired with shouldAutoApplyFunding).
      // Workstream 6 #3: lifted from `=== 'OWNER-FUND-INITIATION'`.
      if (this.dataService.shouldAutoApplyFunding(currentPlayer.currentSpace)) {
        spaceEffects.push({
          effectType: 'LOG',
          payload: {
            message: `Reviewing project scope for funding level...`,
            level: 'INFO',
            source: `space:${currentPlayer.currentSpace}:${currentPlayer.visitType}`,
            action: 'space_effect'
          }
        });
      }

      // Combine all effects for unified processing
      const allEffects = [...spaceEffects, ...diceEffects];
      
      
      if (allEffects.length > 0) {
        if (!this.effectEngineService) {
          console.error(`❌ EffectEngineService not available - cannot process ${allEffects.length} effects`);
          throw new Error('EffectEngineService not initialized - effects cannot be processed');
        }
        
        // Create effect processing context
        const effectContext: EffectContext = {
          source: 'turn_effects:space_entry',
          playerId: playerId,
          triggerEvent: 'SPACE_ENTRY',
          metadata: {
            spaceName: currentPlayer.currentSpace,
            visitType: currentPlayer.visitType,
            diceRoll: diceRoll,
            playerName: currentPlayer.name
          }
        };
        
        // Process all effects through the unified Effect Engine
        const processingResult = await this.effectEngineService.processEffects(allEffects, effectContext);
        
        if (!processingResult.success) {
          console.error(`❌ Failed to process some space/dice effects: ${processingResult.errors.join(', ')}`);
          // Log errors but don't throw - some effects may have succeeded
        } else {
        }
      } else {
      }
      
      return this.stateService.getGameState();
      
    } catch (error) {
      console.error(`❌ Error processing turn effects:`, error);
      throw new Error(`Failed to process turn effects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process ONLY dice effects (not space effects) for a dice roll
   * Returns the effects that were generated for feedback purposes and the processing results
   */
  async processDiceRollEffects(playerId: string, diceRoll: number): Promise<{ gameState: GameState, generatedEffects: Effect[], effectResults?: import('../types/EffectTypes').BatchEffectResult, rollGroups?: Array<{ rollGroup: string; diceValue: number; effectCount: number }> }> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }


    try {
      // Get ONLY dice effect data from DataService
      const diceEffectsData = this.dataService.getDiceEffects(
        currentPlayer.currentSpace,
        currentPlayer.visitType
      );

      if (diceEffectsData.length === 0) {
        return { gameState: this.stateService.getGameState(), generatedEffects: [], effectResults: undefined };
      }

      // Group dice effects by roll_group. Empty/undefined roll_group all share one roll.
      const groups = new Map<string, typeof diceEffectsData>();
      for (const effect of diceEffectsData) {
        const key = effect.roll_group || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(effect);
      }

      // Roll separately for each group. The first/default group uses the passed-in diceRoll.
      const allDiceEffects: Effect[] = [];
      const rollGroupResults: Array<{ rollGroup: string; diceValue: number; effectCount: number }> = [];
      let isFirstGroup = true;

      for (const [groupKey, groupEffects] of groups) {
        const groupDiceRoll = isFirstGroup ? diceRoll : this.diceRollProcessor.rollDice();
        isFirstGroup = false;

        const effects = EffectFactory.createEffectsFromDiceRoll(
          groupEffects,
          playerId,
          currentPlayer.currentSpace,
          groupDiceRoll,
          currentPlayer.name
        );
        allDiceEffects.push(...effects);
        rollGroupResults.push({ rollGroup: groupKey, diceValue: groupDiceRoll, effectCount: effects.length });
      }

      if (allDiceEffects.length > 0) {
        if (!this.effectEngineService) {
          console.error(`❌ EffectEngineService not available - cannot process ${allDiceEffects.length} dice effects`);
          throw new Error('EffectEngineService not initialized - dice effects cannot be processed');
        }

        // Create effect processing context for dice effects only
        const effectContext: EffectContext = {
          source: 'dice_roll',
          playerId: playerId,
          triggerEvent: 'DICE_ROLL',
          metadata: {
            spaceName: currentPlayer.currentSpace,
            visitType: currentPlayer.visitType,
            diceRoll: diceRoll,
            playerName: currentPlayer.name
          }
        };

        // Process ALL dice effects through the Effect Engine
        const processingResult = await this.effectEngineService.processEffects(allDiceEffects, effectContext);

        if (!processingResult.success) {
          console.error(`❌ Failed to process some dice effects: ${processingResult.errors.join(', ')}`);
        }

        // Only include rollGroups when there are multiple groups
        const rollGroups = rollGroupResults.length > 1 ? rollGroupResults : undefined;
        return { gameState: this.stateService.getGameState(), generatedEffects: allDiceEffects, effectResults: processingResult, rollGroups };
      }

      return { gameState: this.stateService.getGameState(), generatedEffects: allDiceEffects, effectResults: undefined };
    } catch (error) {
      console.error(`❌ Error processing dice effects for ${currentPlayer.name}:`, error);
      throw error;
    }
  }

  private async applySpaceEffect(
    playerId: string,
    effect: SpaceEffect,
    currentState: GameState
  ): Promise<GameState> {
    // Apply effect based on type
    switch (effect.effect_type) {
      case 'cards':
        return await this.applySpaceCardEffect(playerId, effect, effect.effect_type);

      case 'money':
        return this.applySpaceMoneyEffect(playerId, effect);
      
      case 'time':
        return this.applySpaceTimeEffect(playerId, effect);
      
      default:
        debugWarn(`Unknown space effect type: ${effect.effect_type}`);
        return currentState;
    }
  }

  private applyDiceEffect(
    playerId: string,
    effect: DiceEffect,
    diceRoll: number,
    currentState: GameState
  ): GameState {
    return this.spaceEffectService.applyDiceEffect(playerId, effect, diceRoll, currentState);
  }

  private getDiceRollEffect(effect: DiceEffect, diceRoll: number): string | undefined {
    return this.diceService.getDiceRollEffect(effect, diceRoll);
  }

  private applyCardEffect(playerId: string, cardType: string, effect: string): GameState {
    return this.spaceEffectService.applyCardEffect(playerId, cardType, effect);
  }

  private applyMoneyEffect(playerId: string, effect: string): GameState {
    return this.spaceEffectService.applyMoneyEffect(playerId, effect);
  }

  private applyTimeEffect(playerId: string, effect: string): GameState {
    return this.spaceEffectService.applyTimeEffect(playerId, effect);
  }

  private applyQualityEffect(playerId: string, effect: string): GameState {
    return this.spaceEffectService.applyQualityEffect(playerId, effect);
  }

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

        if (isImpossibleAction) {
        }
      } else {
        // Reached only when the action is skippable, affected no cards, and
        // isn't impossible — i.e. the player declined an optional action. That's
        // expected, not an error; log at debug level so it doesn't inflate the
        // error count captured into bug reports.
        debugWarn(`[ManualAction] skippable action declined (not marked complete): effectType=${effectType}, action=${action}, cardsAffected=${result.cardsAffected.length}, message=${result.message}, isSkippable=${isSkippableAction}, isImpossible=${isImpossibleAction}.`);
      }

      // Restore movement choice if needed
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    }

    // CardEffectService is required - it should always be injected via setCardEffectService
    throw new Error('CardEffectService not initialized. Ensure setCardEffectService is called during service setup.');
  }

  private applySpaceMoneyEffect(playerId: string, effect: SpaceEffect): GameState {
    return this.spaceEffectService.applySpaceMoneyEffect(playerId, effect);
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
    const diceRoll = Math.floor(Math.random() * 6) + 1;

    // Step 2: Apply time based on dice roll
    const diceEffects = this.dataService.getDiceEffects(space, visitType);
    const timeEffect = diceEffects.find(e => e.effect_type === 'time');
    if (timeEffect) {
      const diceRollEffectValue = this.getDiceRollEffectValue(timeEffect, diceRoll);
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
      this.resourceService.recordCost(playerId, 'investmentFee', feeAmount, `5% investment fee on $${newInvestment.toLocaleString()}`, 'handleAutomaticFunding');
    }

    // Step 6: Mark dice as rolled
    this.stateService.setPlayerHasRolledDice();

    return this.stateService.getGameState();
  }

  private applySpaceTimeEffect(playerId: string, effect: SpaceEffect): GameState {
    return this.spaceEffectService.applySpaceTimeEffect(playerId, effect);
  }

  private getTargetPlayer(currentPlayerId: string, condition: string): Player | null {
    return this.spaceEffectService.getTargetPlayer(currentPlayerId, condition);
  }

  private parseNumericValue(effect: string): number {
    return this.diceService.parseNumericValue(effect);
  }

  /**
   * Get the dice roll effect value for a specific roll
   */
  private getDiceRollEffectValue(diceEffect: DiceEffect, diceRoll: number): string {
    return this.diceService.getDiceRollEffectValue(diceEffect, diceRoll);
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
    let newState = this.stateService.getGameState();


    if (baseType === 'cards') {
      newState = await this.applySpaceCardEffect(playerId, manualEffect, effectType);
    } else if (baseType === 'money') {
      // Special handling for get_investment_funding action
      if (manualEffect.effect_action === 'get_investment_funding') {
        newState = await this.applyInvestmentFunding(playerId, manualEffect);
      } else {
        newState = this.applySpaceMoneyEffect(playerId, manualEffect);
      }
    } else if (baseType === 'time') {
      newState = this.applySpaceTimeEffect(playerId, manualEffect);
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
    const isSkippableAction = action && (action.startsWith('replace_') || action.startsWith('return_') || action.startsWith('give_'));
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
        const amount = manualEffect.effect_value;
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
      const amount = manualEffect.effect_value;
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
    // `summary` for TTS only.
    const visualSummary = this.dataService.getSpaceContent(
      currentPlayer.currentSpace, currentPlayer.visitType
    )?.story || undefined;

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
   * Initiate negotiation for a player - delegates to NegotiationService
   */
  async performNegotiation(playerId: string): Promise<{ success: boolean; message: string }> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }


    try {
      // Simply delegate to NegotiationService to initiate negotiation
      const result = await this.negotiationService.initiateNegotiation(playerId, {
        type: 'space_negotiation',
        space: player.currentSpace,
        initiatedBy: playerId
      });

      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      console.error(`Error initiating negotiation for player ${player.name}:`, error);
      return {
        success: false,
        message: `Failed to start negotiation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Try again on space - apply time penalty and reset dice state for re-roll
   * Based on CSV: "negotiate by repeating the roll next turn" / "waste time and hope to renegotiate next turn"
   * @param playerId - The player trying again
   * @returns Promise resolving to the action result
   */
  async tryAgainOnSpace(playerId: string): Promise<{ success: boolean; message: string; shouldAdvanceTurn?: boolean }> {

    try {
      // 0. Check if game is fully initialized (prevent race condition on first turn)
      if (!this.stateService.isInitialized()) {
        return {
          success: false,
          message: 'Game is still initializing - Try Again will be available shortly',
          shouldAdvanceTurn: false
        };
      }

      // 1. Get the current player
      const currentPlayer = this.stateService.getPlayer(playerId);
      if (!currentPlayer) {
        return {
          success: false,
          message: 'Player not found',
          shouldAdvanceTurn: false
        };
      }

      // 2. Check if player has active TEMP state (i.e., is in their turn)
      if (!this.stateService.hasActiveTempState(playerId)) {
        return {
          success: false,
          message: 'Try Again not available - no active turn state',
          shouldAdvanceTurn: false
        };
      }


      // 3. Check if space allows negotiation (try again)
      const spaceContent = this.dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
      if (!spaceContent || !spaceContent.can_negotiate) {
        return {
          success: false,
          message: 'Try again not available on this space',
          shouldAdvanceTurn: false
        };
      }

      // 4. Calculate the time penalty from space effects
      const spaceEffects = this.dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
      const timePenalty = spaceEffects
        .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add')
        .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);


      // 5. Log the Try Again action
      this.loggingService.info(`Used Try Again: ${timePenalty} day penalty applied`, {
        playerId: playerId,
        playerName: currentPlayer.name,
        action: 'try_again',
        spaceName: currentPlayer.currentSpace,
        timePenalty: timePenalty,
        tryAgainCount: this.stateService.getTryAgainCount(playerId) + 1,
        isCommitted: true
      });

      // 6. Cancel any pending choice (e.g., card replacement modal) so the
      // awaiting promise resolves and the action button stops spinning
      const activeChoice = this.choiceService?.getActiveChoice?.();
      if (activeChoice) {
        this.choiceService.skipChoice(activeChoice.id);
      }

      // 7. Beta Try Again (Workstream 2): outflows stick, inflows revert.
      // Read the turn's cost ledger — it accumulates everything the player
      // has PAID or PLAYED during the attempt (money spends, cards
      // consumed via user-initiated playCard). The time penalty is always
      // additive; the ledger contents are applied to REAL so they survive
      // the TEMP rollback.
      const ledger = this.stateService.getTurnOutflow(playerId);
      const realState = this.stateService.getRealPlayerState(playerId);

      const changes: Partial<MutablePlayerState> = { timeSpent: timePenalty };
      if (realState) {
        if (ledger.moneySpent > 0) {
          changes.money = realState.money - ledger.moneySpent;
        }
        // Hand = (REAL hand) − played cards + drawn L cards
        // Played cards stay consumed; L cards drawn this turn persist because
        // a law change doesn't unchange just because the player retries.
        const hasHandChange =
          ledger.cardsConsumed.length > 0 || ledger.lifeEventsDrawn.length > 0;
        if (hasHandChange) {
          let newHand = realState.hand.filter(
            (c) => !ledger.cardsConsumed.includes(c)
          );
          if (ledger.lifeEventsDrawn.length > 0) {
            newHand = [...newHand, ...ledger.lifeEventsDrawn];
          }
          changes.hand = newHand;
        }
      }
      this.stateService.applyToRealState(playerId, changes);
      this.stateService.discardTempState(playerId);


      // 8. Prepare success message
      const successMessage = `${currentPlayer.name} used Try Again: ${timePenalty} day${timePenalty !== 1 ? 's' : ''} penalty applied.`;

      // 9. Send Try Again notification
      if (this.notificationService) {
        this.notificationService.notify(
          {
            short: 'Try Again Used',
            medium: `🔄 Try Again: ${timePenalty} day penalty`,
            detailed: successMessage
          },
          {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            actionType: 'tryAgain',
            notificationDuration: 3000
          }
        );
      }

      // 10. Return success - turn will advance, player retries next round
      return {
        success: true,
        message: successMessage,
        shouldAdvanceTurn: true
      };

    } catch (error) {
      console.error(`❌ Failed to process Try Again:`, error);
      return {
        success: false,
        message: `Failed to try again: ${error instanceof Error ? error.message : 'Unknown error'}`,
        shouldAdvanceTurn: false
      };
    }
  }

  /**
   * Re-roll dice if player has re-roll ability from E066 card
   * Delegates to DiceRollProcessor with logging
   */
  async rerollDice(playerId: string): Promise<TurnEffectResult> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Log re-roll attempt
    this.loggingService.info('Used re-roll ability', {
      playerId: playerId,
      playerName: currentPlayer.name,
      action: 'reroll',
      space: currentPlayer.currentSpace
    });

    // Delegate to DiceRollProcessor
    return this.diceRollProcessor.rerollDice(playerId);
  }

  /**
   * Roll dice and process effects with detailed feedback for UI
   * Delegates to DiceRollProcessor
   */
  async rollDiceWithFeedback(playerId: string): Promise<TurnEffectResult> {
    return this.diceRollProcessor.rollDiceWithFeedback(playerId);
  }

  /**
   * Process turn effects while tracking changes for feedback
   * Delegates to DiceRollProcessor
   */
  private async processTurnEffectsWithTracking(playerId: string, diceRoll: number, effects: DiceResultEffect[]): Promise<void> {
    await this.diceRollProcessor.processTurnEffectsWithTracking(playerId, diceRoll, effects);
  }

  /**
   * Generate an explanatory message when dice outcome sends player back to a review/exam space
   * Delegates to DiceRollProcessor
   */
  private getReviewLoopExplanation(fromSpace: string, toSpace: string): string | null {
    return this.diceRollProcessor.getReviewLoopExplanation(fromSpace, toSpace);
  }

  /**
   * Generate a human-readable summary of the effects
   * Delegates to DiceRollProcessor
   */
  private generateEffectSummary(effects: DiceResultEffect[], diceValue: number): string {
    return this.diceRollProcessor.generateEffectSummary(effects, diceValue);
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

  /**
   * Process space effects for a player after movement (for arrival effects)
   * Delegates to SpaceArrivalProcessor for the actual processing.
   */
  private async processSpaceEffectsAfterMovement(playerId: string, spaceName: string, visitType: VisitType, skipLogging: boolean = false): Promise<void> {
    await this.spaceArrivalProcessor.processSpaceEffectsAfterMovement(playerId, spaceName, visitType, skipLogging);
  }

  /**
   * Place players on their starting spaces without processing effects
   * Effects will be processed when players actually take their first turn
   */
  public async placePlayersOnStartingSpaces(): Promise<void> {
    const gameState = this.stateService.getGameState();
    const players = gameState.players;


    // Simply ensure all players are on their starting space
    // No effects processing - that happens when they take their first turn
    for (const player of players) {

      // Log the initial placement for the Game Log
      this.loggingService.info(`${player.name} placed on starting space: ${player.currentSpace}`, {
        playerId: player.id,
        playerName: player.name,
        action: 'game_start',
        spaceName: player.currentSpace,
        description: 'Initial placement'
      });
    }

  }


  /**
   * Process time effects for a player when leaving a space
   * Time effects represent the time spent working on activities at that space
   * and should be applied when the player finishes their work and leaves
   */
  private async processLeavingSpaceEffects(playerId: string, spaceName: string, visitType: VisitType): Promise<void> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }


    try {
      // Get space effect data from DataService for the current space
      const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);

      // Filter space effects based on conditions and only get time effects
      const conditionFilteredEffects = this.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);
      const timeEffects = conditionFilteredEffects.filter(effect =>
        effect.effect_type === 'time' && effect.trigger_type !== 'manual'
      );

      if (timeEffects.length === 0) {
        return;
      }


      // Generate effects from leaving space using EffectFactory
      const leavingEffects = EffectFactory.createEffectsFromSpaceEntry(
        timeEffects,
        playerId,
        spaceName,
        visitType,
        undefined,
        currentPlayer?.name
      );

      if (leavingEffects.length === 0) {
        return;
      }

      // Create effect context for leaving space
      const effectContext = {
        source: 'space_leaving',
        playerId,
        triggerEvent: 'SPACE_EXIT' as const,
        metadata: {
          spaceName,
          visitType,
          playerName: currentPlayer.name
        }
      };

      // Process effects using EffectEngine
      if (this.effectEngineService) {
        const result = await this.effectEngineService.processEffects(leavingEffects, effectContext);
        if (result.success) {
        } else {
          debugWarn(`⚠️ Some time effects failed for leaving ${spaceName}:`, result.errors);
        }
      } else {
        debugWarn(`⚠️ EffectEngineService not available - skipping time effects for leaving ${spaceName}`);
      }
    } catch (error) {
      console.error(`❌ Error processing leaving space time effects for ${spaceName}:`, error);
    }
  }

  /**
   * Set turn modifier for a player (e.g., skip their next turn)
   *
   * @param playerId - The ID of the player to apply the modifier to
   * @param action - The turn control action to apply ('SKIP_TURN')
   * @returns true if the modifier was successfully applied, false otherwise
   */
  public setTurnModifier(playerId: string, action: 'SKIP_TURN'): boolean {
    try {
      
      // Get current player state
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.error(`❌ Cannot apply turn modifier: Player ${playerId} not found`);
        return false;
      }
      
      // Apply the turn modifier based on action type
      switch (action) {
        case 'SKIP_TURN':
          // Initialize player's turn modifiers if they don't exist
          const currentModifiers = player.turnModifiers || { skipTurns: 0 };
          
          // Increment skip turns count
          const newModifiers = { ...currentModifiers, skipTurns: currentModifiers.skipTurns + 1 };
          this.stateService.updatePlayer({ id: playerId, turnModifiers: newModifiers });
          
          
          return true;
          
        default:
          console.error(`❌ Unknown turn control action: ${action}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Error applying turn modifier:`, error);
      return false;
    }
  }

  /**
   * Filter space effects based on conditions (e.g., scope_le_4M, dice_roll_3)
   * Public method for UI components to get condition-filtered effects
   * Delegates to SpaceArrivalProcessor
   */
  public filterSpaceEffectsByCondition(spaceEffects: SpaceEffect[], player: Player, diceRoll?: number): SpaceEffect[] {
    return this.spaceArrivalProcessor.filterSpaceEffectsByCondition(spaceEffects, player, diceRoll);
  }

  /**
   * Handle automatic funding for OWNER-FUND-INITIATION space
   * Calculates owner seed money as projectScope * random(0.8 to 1.2)
   * Owner seed money is separate from bank loans (B cards) and investor funding (I cards)
   */
  async handleAutomaticFunding(playerId: string): Promise<TurnEffectResult> {

    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Workstream 6 #3: defensive guard inside handleAutomaticFunding —
    // caller (line ~755) already gates on shouldAutoApplyFunding, but if
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

    // Calculate owner seed money: projectScope * random(0.8 to 1.2)
    // This represents the owner's personal investment into the project
    const seedMoneyMultiplier = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    const ownerSeedMoney = Math.round(projectScope * seedMoneyMultiplier);

    // Round to nearest $10,000 for cleaner numbers
    const roundedSeedMoney = Math.round(ownerSeedMoney / 10000) * 10000;


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
      const visualSummary = this.dataService.getSpaceContent(
        currentPlayer.currentSpace, currentPlayer.visitType
      )?.story || undefined;
      return {
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

    } catch (error) {
      console.error(`❌ Error in automatic funding:`, error);
      throw new Error(`Failed to process automatic funding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
