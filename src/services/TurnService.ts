import { ITurnService, IDataService, IStateService, IGameRulesService, ICardService, IResourceService, IEffectEngineService, IMovementService, ILoggingService, IChoiceService, IDiceService, ISpaceEffectService, ICardEffectService, INotificationService, IApprovalService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { NegotiationService } from './NegotiationService';
import { DiceService } from './DiceService';
import { SpaceEffectService } from './SpaceEffectService';
import { SpaceArrivalProcessor } from './SpaceArrivalProcessor';
import { DiceRollProcessor } from './DiceRollProcessor';
import { TurnTransitionHandler } from './TurnTransitionHandler';
import { MovementExecutor } from './MovementExecutor';
import { TurnEffectsOrchestrator } from './TurnEffectsOrchestrator';
import { ManualActionProcessor } from './ManualActionProcessor';
import { GameState, Player, TurnEffectResult, CreateTempOptions, MutablePlayerState } from '../types/StateTypes';
import { SpaceEffect, VisitType } from '../types/DataTypes';
import { Effect } from '../types/EffectTypes';
import { getCardTypeName } from '../utils/cardTypeNames';
import { friendlySpaceName } from '../utils/logFormatting';
import { calculateSpaceTimeAddTotal } from '../utils/costPreview';

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
  private readonly spaceArrivalProcessor: SpaceArrivalProcessor;
  private readonly diceRollProcessor: DiceRollProcessor;
  private readonly movementExecutor: MovementExecutor;
  private readonly turnTransitionHandler: TurnTransitionHandler;
  private readonly turnEffectsOrchestrator: TurnEffectsOrchestrator;
  private readonly manualActionProcessor: ManualActionProcessor;
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
    // Create SpaceArrivalProcessor for space arrival effect processing
    this.spaceArrivalProcessor = new SpaceArrivalProcessor(
      dataService,
      stateService,
      cardService,
      loggingService,
      gameRulesService,
      effectEngineService,
      notificationService,
      this.diceService
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
    // Create TurnEffectsOrchestrator — converts space/dice CSV rows into
    // Effect objects and runs them through the EffectEngine (extracted 2026-07-16)
    this.turnEffectsOrchestrator = new TurnEffectsOrchestrator(
      dataService,
      stateService,
      this.diceService,
      this.spaceArrivalProcessor,
      effectEngineService
    );
    // Create ManualActionProcessor — manual action buttons + automatic
    // owner-seed-money funding, with modal feedback (extracted 2026-07-16)
    this.manualActionProcessor = new ManualActionProcessor(
      dataService,
      stateService,
      gameRulesService,
      cardService,
      resourceService,
      movementService,
      this.spaceEffectService,
      this.diceService,
      loggingService,
      notificationService,
      effectEngineService,
      cardEffectService
    );
    // Set the callback for processing dice roll effects (needed for circular dependency)
    this.diceRollProcessor.setProcessDiceRollEffectsCallback(
      (playerId, diceRoll) => this.turnEffectsOrchestrator.processDiceRollEffects(playerId, diceRoll)
    );
    // Create MovementExecutor for movement execution during end-of-turn.
    // Phase 2.1 audit (2026-06-04): MovementExecutor no longer needs
    // approvalService — the Stage-1 gate override now lives in
    // MovementService.getValidMoves (one resolver for both dice and intent
    // paths). The 4th arg here is unused; kept positionally for back-compat
    // until a future sweep removes it from the constructor signature.
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
  }

  /**
   * Set the EffectEngineService after construction to handle circular dependencies
   */
  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
    this.spaceArrivalProcessor.setEffectEngineService(effectEngineService);
    this.turnTransitionHandler.setEffectEngineService(effectEngineService);
    this.turnEffectsOrchestrator.setEffectEngineService(effectEngineService);
    this.manualActionProcessor.setEffectEngineService(effectEngineService);
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

      // Domain-event stage 3: LogWriter reacts to this (manual Roll Dice
      // button path — the other DiceRolled emitter is SpaceArrivalProcessor's
      // arrival-triggered piggyback roll, a genuinely different trigger).
      this.stateService.emitGameEvent({
        type: 'dice_rolled',
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        spaceName: currentPlayer.currentSpace,
        diceValue: diceRoll,
        trigger: 'manual',
        logMessage: 'Outcome determined',
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
        const winnerId = gameState.currentPlayerId;
        const winnerPlayer = this.stateService.getPlayer(winnerId);

        // Workstream 7 Phase 7.4 — end-game penalty when the winner reached
        // FINISH without DOB sign-off. Backstop for the Stage-1 gate at
        // REG-DOB-FINAL-REVIEW (should never normally fire, but safe-guards
        // legacy save states and any future direct-routes-to-FINISH path).
        if (this.approvalService && winnerPlayer) {
          const penalty = this.approvalService.computeEndGamePenalty(winnerPlayer);
          if (penalty) {
            this.stateService.updatePlayer({
              id: winnerId,
              timeSpent: penalty.newTimeSpent,
              money: penalty.newMoney,
            });
            this.stateService.updateGameState({
              endGamePenalty: {
                dobMissing: true,
                days: penalty.days,
                fee: penalty.fee,
                playerId: winnerId,
              },
            });
            this.loggingService.info(`End-game penalty applied: missing DOB sign-off (+${penalty.days} days, +$${penalty.fee.toLocaleString()} fee).`, {
              playerId: winnerId,
              playerName: winnerPlayer.name,
              action: 'end_game_penalty',
              penaltyDays: penalty.days,
              penaltyFee: penalty.fee,
            });
          }
        }

        // Domain-event stage 4: the WIN ending previously had zero
        // announcement anywhere outside EndGameModal — no log, no toast,
        // no GameEvent. LogWriter/ToastWriter both react to this now.
        this.stateService.endGame(winnerId);
        this.stateService.emitGameEvent({
          type: 'game_ended',
          reason: 'win',
          playerId: winnerId,
          playerName: winnerPlayer?.name ?? 'A player',
          spaceName: winnerPlayer?.currentSpace ?? '',
          message: `🏆 ${winnerPlayer?.name ?? 'A player'} reached the finish line and won the game!`,
        });
        return { nextPlayerId: winnerId }; // Winner remains current player
      }

      step = 'commit_turn_transaction';
      // COMMIT the turn transaction — finalizes the log session AND folds TEMP
      // into REAL together (see commitTurnTransaction), before advancing.
      this.commitTurnTransaction(gameState.currentPlayerId);

      // v3.0.41: clear any unresolved choice promises before advancing the
      // turn. Normal happy-path choices await synchronously in the calling
      // flow and won't be in the pending map by now; this catches edge
      // cases (Try-Again-while-choice-open, force end-turn) where a stale
      // `.then(...)` callback could otherwise fire post-turn against the
      // wrong player's state.
      this.choiceService.cancelAllPendingChoices('turn ended');

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

  // ==========================================================================
  // Turn transaction boundary (Phase 2.2)
  //
  // A turn keeps TWO books that must move in lockstep: the player's TEMP/REAL
  // state (StateService) and the exploration-session log (LoggingService).
  // These three methods are the SINGLE place those two books are opened,
  // committed, or thrown away together. Any future turn-lifecycle bookkeeping
  // belongs HERE, not hand-coded at the call sites — that is what keeps the
  // two systems from drifting (the drift that caused the v3.0.63 ghost-log bug).
  // ==========================================================================

  /**
   * BEGIN a turn transaction: open a fresh log session AND snapshot REAL→TEMP.
   * Called once at the top of every turn.
   */
  private beginTurnTransaction(opts: CreateTempOptions): void {
    this.loggingService.startNewExplorationSession();
    const tempResult = this.stateService.createTempStateFromReal(opts);
    if (!tempResult.success) {
      debugWarn(`⚠️ Failed to create TEMP state: ${tempResult.error}`);
    }
  }

  /**
   * COMMIT a turn transaction: finalize the log session AND fold TEMP into REAL.
   * Called when a turn ends normally.
   */
  private commitTurnTransaction(playerId: string): void {
    this.loggingService.commitCurrentSession();
    const commitResult = this.stateService.commitTempToReal(playerId);
    if (!commitResult.success) {
      debugWarn(`⚠️ Failed to commit TEMP state: ${commitResult.error}`);
    }
  }

  /**
   * DISCARD a turn transaction: throw away the session's provisional log
   * entries AND roll TEMP state back to REAL. Called by Try Again.
   *
   * NOTE: Try-Again ledger reconciliation (outflows stick / inflows revert)
   * is a separate business rule that runs in tryAgainOnSpace BEFORE this —
   * applyToRealState must precede discardTempState, which restores the
   * player's main state from REAL.
   */
  private discardTurnTransaction(playerId: string): void {
    this.loggingService.discardCurrentSession();
    this.stateService.discardTempState(playerId);
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

      // 1. BEGIN the turn transaction — opens the log session AND snapshots
      // REAL→TEMP together (see beginTurnTransaction). TEMP holds this turn's
      // effects; REAL is preserved for Try Again.
      const tempOptions: CreateTempOptions = {
        playerId: player.id,
        spaceName: player.currentSpace,
        visitType: player.visitType
      };
      this.beginTurnTransaction(tempOptions);

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
        const autoRollResult = await this.rollDiceWithFeedback(player.id);
        // Same reason as the seed_money event below: this fires from inside
        // startTurn on every turn transition (including the internal
        // endTurn → startTurn path with no React caller), so the rich
        // result — DOB/FDNY approval verdict banner included — was silently
        // discarded here with nothing shown to the player beyond a badge
        // quietly changing in the panel header (v3.0.99).
        this.stateService.emitGameEvent({
          type: 'auto_dice_roll',
          playerId: player.id,
          playerName: player.name,
          diceValue: autoRollResult.diceValue,
          spaceName: player.currentSpace,
          message: autoRollResult.summary,
          turnEffectResult: autoRollResult
        });
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

  /**
   * Process space + dice effects for the current space (space entry)
   * Delegates to TurnEffectsOrchestrator
   */
  async processTurnEffects(playerId: string, diceRoll: number): Promise<GameState> {
    return this.turnEffectsOrchestrator.processTurnEffects(playerId, diceRoll);
  }

  /**
   * Process ONLY dice effects (not space effects) for a dice roll
   * Delegates to TurnEffectsOrchestrator
   */
  async processDiceRollEffects(playerId: string, diceRoll: number): Promise<{ gameState: GameState, generatedEffects: Effect[], effectResults?: import('../types/EffectTypes').BatchEffectResult, rollGroups?: Array<{ rollGroup: string; diceValue: number; effectCount: number }> }> {
    return this.turnEffectsOrchestrator.processDiceRollEffects(playerId, diceRoll);
  }

  /**
   * Trigger a manual space effect for the current player
   * Delegates to ManualActionProcessor
   */
  async triggerManualEffect(playerId: string, effectType: string): Promise<GameState> {
    return this.manualActionProcessor.triggerManualEffect(playerId, effectType);
  }

  /**
   * Trigger manual effect with modal feedback - similar to rollDiceWithFeedback
   * Delegates to ManualActionProcessor
   */
  async triggerManualEffectWithFeedback(playerId: string, effectType: string): Promise<TurnEffectResult> {
    return this.manualActionProcessor.triggerManualEffectWithFeedback(playerId, effectType);
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

      // 4. Calculate the time penalty from space effects. Shared with the
      // PlayerPanelV2 cost-preview toggle (src/utils/costPreview.ts) so the
      // preview can never drift from what pressing this button actually
      // does — see calculateSpaceTimeAddTotal.
      const spaceEffects = this.dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType);
      const timePenalty = calculateSpaceTimeAddTotal(spaceEffects);


      // 5. Emit turn_discarded — LogWriter's write must precede
      // discardCurrentSession so its entry inherits the current session ID
      // (it survives the discard because LogWriter forces isCommitted=true;
      // the discard only removes uncommitted entries from the current
      // session). ToastWriter also reacts to this same emission slightly
      // earlier than the old standalone notify did (before, not after, the
      // ledger reconciliation + discard below) — harmless, since none of
      // that is visible to the player.
      const tryAgainCount = this.stateService.getTryAgainCount(playerId) + 1;
      this.stateService.emitGameEvent({
        type: 'turn_discarded',
        playerId: playerId,
        playerName: currentPlayer.name,
        spaceName: currentPlayer.currentSpace,
        timePenalty: timePenalty,
        tryAgainCount: tryAgainCount,
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

      // DISCARD the turn transaction — throws away the abandoned attempt's
      // provisional log entries AND rolls TEMP state back to REAL together
      // (see discardTurnTransaction). Runs AFTER applyToRealState: the ledger
      // reconciliation above writes the sticky outflows into REAL, then
      // discardTempState restores the player's main state from that REAL.
      // The committed try_again entry (step 5, isCommitted=true) survives the
      // log discard; only the uncommitted pencil entries are torn out — which
      // is what keeps ghost actions out of the post-game log after a rollback
      // (the v3.0.63 fix, now part of the single transaction boundary).
      this.discardTurnTransaction(playerId);


      // 8. Prepare success message
      const successMessage = `${currentPlayer.name} used Try Again: ${timePenalty} day${timePenalty !== 1 ? 's' : ''} penalty applied.`;

      // 9. The "Try Again Used" toast is now derived by ToastWriter from the
      // emitGameEvent('turn_discarded') call in step 5 above — the
      // standalone notify() that used to live here is gone.

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
      const friendly = friendlySpaceName(this.dataService, player.currentSpace);
      this.loggingService.info(`${player.name} starts at ${friendly}`, {
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
   * Delegates to TurnEffectsOrchestrator
   */
  private async processLeavingSpaceEffects(playerId: string, spaceName: string, visitType: VisitType): Promise<void> {
    await this.turnEffectsOrchestrator.processLeavingSpaceEffects(playerId, spaceName, visitType);
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
   * Handle automatic funding for auto_apply_funding=Yes spaces (owner seed money)
   * Delegates to ManualActionProcessor
   */
  async handleAutomaticFunding(playerId: string): Promise<TurnEffectResult> {
    return this.manualActionProcessor.handleAutomaticFunding(playerId);
  }
}
