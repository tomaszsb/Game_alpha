import { ITurnService, IDataService, IStateService, IGameRulesService, ICardService, IResourceService, IEffectEngineService, IMovementService, ILoggingService, IChoiceService, IDiceService, ISpaceEffectService, ICardEffectService, TurnResult, INotificationService } from '../types/ServiceContracts';
import { NegotiationService } from './NegotiationService';
import { DiceService } from './DiceService';
import { SpaceEffectService } from './SpaceEffectService';
import { MovementChoiceManager } from './MovementChoiceManager';
import { SpaceArrivalProcessor } from './SpaceArrivalProcessor';
import { DiceRollProcessor } from './DiceRollProcessor';
import { GameState, Player, DiceResultEffect, TurnEffectResult, CreateTempOptions } from '../types/StateTypes';
import { DiceEffect, SpaceEffect, Movement, CardType, VisitType } from '../types/DataTypes';
import { EffectFactory } from '../utils/EffectFactory';
import { EffectContext, Effect } from '../types/EffectTypes';
import { formatManualEffectButton, formatDiceRollFeedback, formatActionFeedback } from '../utils/buttonFormatting';
import { ConditionEvaluator } from '../utils/ConditionEvaluator';
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
  private readonly movementChoiceManager: MovementChoiceManager;
  private readonly spaceArrivalProcessor: SpaceArrivalProcessor;
  private readonly diceRollProcessor: DiceRollProcessor;
  private readonly notificationService?: INotificationService;
  private effectEngineService?: IEffectEngineService;
  private cardEffectService?: ICardEffectService;

  constructor(dataService: IDataService, stateService: IStateService, gameRulesService: IGameRulesService, cardService: ICardService, resourceService: IResourceService, movementService: IMovementService, negotiationService: NegotiationService, loggingService: ILoggingService, choiceService: IChoiceService, notificationService?: INotificationService, effectEngineService?: IEffectEngineService, diceService?: IDiceService, spaceEffectService?: ISpaceEffectService) {
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
    // Use provided DiceService or create a default instance
    this.diceService = diceService || new DiceService();
    // Use provided SpaceEffectService or create a default instance
    this.spaceEffectService = spaceEffectService || new SpaceEffectService(
      stateService,
      cardService,
      resourceService,
      gameRulesService,
      this.diceService
    );
    // Create ConditionEvaluator with GameRulesService for scope conditions
    this.conditionEvaluator = new ConditionEvaluator(gameRulesService);
    // Create MovementChoiceManager for unified movement choice handling
    this.movementChoiceManager = new MovementChoiceManager(
      stateService,
      dataService,
      movementService,
      choiceService,
      notificationService
    );
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
      notificationService
    );
    // Set the callback for processing dice roll effects (needed for circular dependency)
    this.diceRollProcessor.setProcessDiceRollEffectsCallback(
      (playerId, diceRoll) => this.processDiceRollEffects(playerId, diceRoll)
    );
  }

  /**
   * Set the EffectEngineService after construction to handle circular dependencies
   */
  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
    this.spaceArrivalProcessor.setEffectEngineService(effectEngineService);
  }

  /**
   * Set the CardEffectService after construction to handle dependencies
   */
  public setCardEffectService(cardEffectService: ICardEffectService): void {
    this.cardEffectService = cardEffectService;
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
      console.warn(`No cards of type ${cardType} found in CSV data`);
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
        console.warn(`🎮 TurnService.takeTurn - Player ${playerId} has already moved, clearing flag and continuing (AI turn recovery)`);
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

    try {
      const gameState = this.stateService.getGameState();
      
      // Validation: Game must be in PLAY phase
      if (gameState.gamePhase !== 'PLAY') {
        throw new Error('Cannot end turn outside of PLAY phase');
      }

      // Validation: Must have a current player
      if (!gameState.currentPlayerId) {
        throw new Error('No current player to end turn for');
      }

      // Get current player
      const currentPlayer = this.stateService.getPlayer(gameState.currentPlayerId);
      if (!currentPlayer) {
        throw new Error('Current player not found');
      }

      // Validation: Check if all required actions are completed (skip if force = true for Try Again)
      if (!force && gameState.requiredActions > gameState.completedActionCount) {
        throw new Error(`Cannot end turn: Player has not completed all required actions. Required: ${gameState.requiredActions}, Completed: ${gameState.completedActionCount}`);
      }


      // Resolve any pending movement choice if player has set their moveIntent
      // This handles the case where the UI set moveIntent without resolving the choice
      // (e.g., PlayerPanel click that just sets intent, or direct calls to endTurnWithMovement)
      if (gameState.awaitingChoice?.type === 'MOVEMENT' && currentPlayer.moveIntent) {
        this.choiceService.resolveChoice(gameState.awaitingChoice.id, currentPlayer.moveIntent);
      }

      // Process leaving space effects BEFORE movement (time spent on current space)
      // SKIP if skipAutoMove is true (e.g., after Try Again) - player is staying at same space
      if (!skipAutoMove) {
        await this.processLeavingSpaceEffects(currentPlayer.id, currentPlayer.currentSpace, currentPlayer.visitType);
      } else {
      }

      // Handle movement - check for player's move intent first
      if (!skipAutoMove) {
        // Check for dice_outcome or dice movement first
        const movement = this.dataService.getMovement(currentPlayer.currentSpace, currentPlayer.visitType);
        if ((movement?.movement_type === 'dice_outcome' || movement?.movement_type === 'dice') && currentPlayer.lastDiceRoll) {
          // Use dice roll to determine destination from DICE_ROLL_INFO.csv
          const diceRoll = currentPlayer.lastDiceRoll.total;

          // Use DICE_OUTCOMES.csv for dice-based movement
          // TODO: Implement getDiceRollDestinations in DataService if DICE_ROLL_INFO.csv is needed
          // const destinations = this.dataService.getDiceRollDestinations(currentPlayer.currentSpace, currentPlayer.visitType);
          let destination: string | null = null;

          // Use existing dice outcome logic
          destination = this.movementService.getDiceDestination(currentPlayer.currentSpace, currentPlayer.visitType, diceRoll);

          // Original code commented out for future implementation:
          // if (destinations.length >= diceRoll) {
          //   destination = destinations[diceRoll - 1];
          // } else {
          //   destination = this.movementService.getDiceDestination(currentPlayer.currentSpace, currentPlayer.visitType, diceRoll);
          // }

          if (destination) {
            process.stderr.write(`\n!!! [MOVE_CHECK] From: ${currentPlayer.currentSpace} To: ${destination} (Roll: ${diceRoll}) !!!\n`);
            // Emit movement event BEFORE the move so UI can show transition overlay
            this.stateService.emitAutoAction({
              type: 'movement',
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              playerColor: currentPlayer.color,
              spaceName: currentPlayer.currentSpace,
              fromSpace: currentPlayer.currentSpace,
              toSpace: destination,
              success: true,
              message: `${currentPlayer.name} moved from ${currentPlayer.currentSpace} to ${destination}`
            });
            await this.movementService.movePlayer(currentPlayer.id, destination);
          } else {
            console.warn(`🎲 No destination found for dice roll ${diceRoll} at ${currentPlayer.currentSpace}`);
          }
        } else if (currentPlayer.moveIntent) {
          // Execute the intended move
          // Emit movement event BEFORE the move so UI can show transition overlay
          this.stateService.emitAutoAction({
            type: 'movement',
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            playerColor: currentPlayer.color,
            spaceName: currentPlayer.currentSpace,
            fromSpace: currentPlayer.currentSpace,
            toSpace: currentPlayer.moveIntent,
            success: true,
            message: `${currentPlayer.name} moved from ${currentPlayer.currentSpace} to ${currentPlayer.moveIntent}`
          });
          await this.movementService.movePlayer(currentPlayer.id, currentPlayer.moveIntent);

          // Clear the move intent after execution
          this.stateService.setPlayerMoveIntent(currentPlayer.id, null);
        } else {
          // No intent set - fall back to auto-move for single destinations
          const validMoves = this.movementService.getValidMoves(currentPlayer.id);
          if (validMoves.length === 1) {
            // Only one move available - perform automatic movement
            // Emit movement event BEFORE the move so UI can show transition overlay
            this.stateService.emitAutoAction({
              type: 'movement',
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              playerColor: currentPlayer.color,
              spaceName: currentPlayer.currentSpace,
              fromSpace: currentPlayer.currentSpace,
              toSpace: validMoves[0],
              success: true,
              message: `${currentPlayer.name} moved from ${currentPlayer.currentSpace} to ${validMoves[0]}`
            });
            await this.movementService.movePlayer(currentPlayer.id, validMoves[0]);
          }
        }
      } else {
      }

      // Check for win condition before ending turn
      const hasWon = await this.gameRulesService.checkWinCondition(gameState.currentPlayerId);
      if (hasWon) {
        // Player has won - end the game
        this.stateService.endGame(gameState.currentPlayerId);
        return { nextPlayerId: gameState.currentPlayerId }; // Winner remains current player
      }

      // Commit current exploration session before advancing to next player
      this.loggingService.commitCurrentSession();

      // Commit TEMP state to REAL (new REAL/TEMP state model)
      // This finalizes all turn effects into the committed state
      const commitResult = this.stateService.commitTempToReal(gameState.currentPlayerId);
      if (!commitResult.success) {
        console.warn(`⚠️ Failed to commit TEMP state: ${commitResult.error}`);
      } else {
      }

      // Advance to next player
      const nextPlayerResult = await this.nextPlayer();

      return nextPlayerResult;
    } catch (error) {
      console.error(`🏁 TurnService.endTurnWithMovement - Error:`, error);
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
      
      // End the game with the determined winner
      this.stateService.endGame(winnerId || gameState.currentPlayerId);
      return { nextPlayerId: winnerId || gameState.currentPlayerId };
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
    if (currentPlayerIndex === -1) {
      throw new Error('Current player not found in player list');
    }

    // STEP 1: Process card expirations BEFORE turn advances
    // This ensures turnsRemaining counter works correctly:
    // - Card activated turn 5 with duration=3
    // - Turn 5 ends: turnsRemaining-- (now 2), turn advances to 6
    // - Turn 6 ends: turnsRemaining-- (now 1), turn advances to 7
    // - Turn 7 ends: turnsRemaining-- (now 0), EXPIRE, turn advances to 8
    // Result: Card active for turns 5, 6, 7 = 3 turns ✅
    this.cardService.endOfTurn();

    // STEP 2: Process active effects for all players at turn end
    // This happens at end of current turn (before turn counter advances)
    if (this.effectEngineService) {
      await this.effectEngineService.processActiveEffectsForAllPlayers();
    }

    // STEP 3: Reset re-roll flags for current player ending their turn
    // One-time use flags are cleared before next turn begins
    const currentPlayer = allPlayers[currentPlayerIndex];
    if (currentPlayer.turnModifiers?.canReRoll) {
      this.stateService.updatePlayer({
        id: currentPlayer.id,
        turnModifiers: {
          ...currentPlayer.turnModifiers,
          canReRoll: false
        }
      });
    }

    // STEP 4: Log turn end for current player
    // TIMING NOTE: Uses globalTurnCount + 1 to match turn_start numbering
    // Why +1? Turn hasn't advanced yet (still N-1), but we want to log "Turn N ended"
    // to match "Turn N started" from the beginning of this turn.
    // This is intentional and ensures turn start/end logs have matching numbers.
    this.loggingService.info(`Turn ${gameState.globalTurnCount + 1} ended`, {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      action: 'turn_end',
      turn: gameState.globalTurnCount + 1,
      space: currentPlayer.currentSpace
    });

    // STEP 4.5: Quick Start mode - finalize starting hand after P1's first turn
    // This distributes P1's captured card draws to all other players
    if (gameState.isCapturingStartingHand && currentPlayerIndex === 0) {
      this.finalizeQuickStartHand();
    }

    // Determine next player (wrap around to first player if at end)
    let nextPlayerIndex = (currentPlayerIndex + 1) % allPlayers.length;
    let nextPlayer = allPlayers[nextPlayerIndex];

    // Use while loop to handle multiple consecutive turn skips without recursion
    while (nextPlayer.turnModifiers && nextPlayer.turnModifiers.skipTurns > 0) {
      const turnModifiers = nextPlayer.turnModifiers;

      // Log turn skip
      this.loggingService.info(`Turn skipped (${turnModifiers.skipTurns} remaining)`, {
        playerId: nextPlayer.id,
        playerName: nextPlayer.name,
        action: 'skipTurn',
        skipCount: turnModifiers.skipTurns,
        reason: 'effect_modifier'
      });

      // Decrement skip count
      const newModifiers = { ...turnModifiers, skipTurns: turnModifiers.skipTurns - 1 };
      this.stateService.updatePlayer({ id: nextPlayer.id, turnModifiers: newModifiers });

      // If no more skips remaining, clean up
      if (newModifiers.skipTurns <= 0) {
        const restoredModifiers = { ...newModifiers, skipTurns: 0 };
        this.stateService.updatePlayer({ id: nextPlayer.id, turnModifiers: restoredModifiers });
        // Skip turns cleared
      }

      // Move to the next player in sequence
      nextPlayerIndex = (nextPlayerIndex + 1) % allPlayers.length;
      nextPlayer = this.stateService.getGameState().players[nextPlayerIndex]; // Get fresh player data
    }

    // STEP 5: Advance turn counter
    // TIMING NOTE: This happens AFTER all turn-end processing (expirations, effects, logging)
    // but BEFORE changing current player. This ensures:
    // - Turn-end processing uses the correct turn number (the turn that's ending)
    // - Next player's turn starts with the new turn number
    this.stateService.advanceTurn();

    // STEP 6: Set next player and prepare for their turn
    // Update current player in game state
    this.stateService.setCurrentPlayer(nextPlayer.id);

    // Reset turn flags for the new turn
    this.stateService.clearPlayerHasMoved();
    this.stateService.clearPlayerHasRolledDice();
    this.stateService.clearTurnActions();
    this.stateService.clearPlayerMoveIntent(nextPlayer.id);

    // Send End Turn notification for the previous player AFTER all state changes are complete
    if (this.notificationService) {
      const prevGameState = this.stateService.getGameState();
      const turnNumber = prevGameState.globalTurnCount; // Previous turn that just ended
      this.notificationService.notify(
        {
          short: 'Turn Ended',
          medium: `🏁 Turn ${turnNumber} ended`,
          detailed: `${currentPlayer.name} ended Turn ${turnNumber} at ${currentPlayer.currentSpace}`
        },
        {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          actionType: 'endTurn',
          notificationDuration: 3000
        }
      );
    }

    // Start next player's turn with unified function
    // This handles all arrival logic, movement choices, and turn start logging
    await this.startTurn(nextPlayer.id);

    return { nextPlayerId: nextPlayer.id };
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
        console.warn(`⚠️ Failed to create TEMP state: ${tempResult.error}`);
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

      // Handle movement choices after effects are processed
      await this.handleMovementChoices(player.id);

      // Auto-roll dice for REG dice-movement spaces (clerk/examiner makes the decision)
      // CHEAT spaces require manual roll (player actively cheating)
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      const isDiceMovementSpace = movement?.movement_type === 'dice';
      const isRegSpace = player.currentSpace.startsWith('REG-');

      if (isDiceMovementSpace && isRegSpace) {
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
   * Handle movement choices at turn start - delegates to MovementChoiceManager
   */
  private async handleMovementChoices(playerId: string): Promise<void> {
    await this.movementChoiceManager.handleMovementChoices(playerId);
  }

  /**
   * Restores movement choice if the current space requires one - delegates to MovementChoiceManager
   * Used after completing manual effects that clear the choice state
   *
   * @private
   */
  private async restoreMovementChoiceIfNeeded(playerId: string): Promise<void> {
    await this.movementChoiceManager.restoreMovementChoiceIfNeeded(playerId);
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
      
      // Add user messaging for OWNER-FUND-INITIATION space
      if (currentPlayer.currentSpace === 'OWNER-FUND-INITIATION') {
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
  async processDiceRollEffects(playerId: string, diceRoll: number): Promise<{ gameState: GameState, generatedEffects: Effect[], effectResults?: import('../types/EffectTypes').BatchEffectResult }> {
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

      // Generate ONLY effects from dice roll using EffectFactory
      const diceEffects = EffectFactory.createEffectsFromDiceRoll(
        diceEffectsData,
        playerId,
        currentPlayer.currentSpace,
        diceRoll,
        currentPlayer.name
      );


      if (diceEffects.length > 0) {
        if (!this.effectEngineService) {
          console.error(`❌ EffectEngineService not available - cannot process ${diceEffects.length} dice effects`);
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

        // Process ONLY dice effects through the Effect Engine
        const processingResult = await this.effectEngineService.processEffects(diceEffects, effectContext);

        if (!processingResult.success) {
          console.error(`❌ Failed to process some dice effects: ${processingResult.errors.join(', ')}`);
          // Log errors but don't throw - some effects may have succeeded
        } else {
        }

        return { gameState: this.stateService.getGameState(), generatedEffects: diceEffects, effectResults: processingResult };
      }

      return { gameState: this.stateService.getGameState(), generatedEffects: diceEffects, effectResults: undefined };
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
        console.warn(`Unknown space effect type: ${effect.effect_type}`);
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
      console.warn(`⚠️ Unknown manual effect type: ${baseType}`);
    }

    // Mark action as complete for non-card effects (money, time)
    // Card effects handle this inside applySpaceCardEffect (before restoreMovementChoiceIfNeeded)
    if (baseType !== 'cards') {
      const { text: buttonText } = formatManualEffectButton(manualEffect);
      this.stateService.setPlayerCompletedManualAction(baseType, buttonText);
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

    // Trigger the manual effect
    await this.triggerManualEffect(playerId, effectType);

    const afterState = this.stateService.getGameState();
    const afterPlayer = afterState.players.find(p => p.id === playerId)!;

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
          }
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
          }
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

      // Grammatically correct singular/plural
      const cardWord = count === 1 ? 'card' : 'cards';

      // Determine action verb based on effect type
      let actionDescription: string;
      let cardAction: 'draw' | 'remove' | 'replace' | 'give' | 'return';
      if (isReplaceAction) {
        actionDescription = `You replaced ${count} ${cardType} ${cardWord}!`;
        cardAction = 'replace';
      } else if (isGiveAction) {
        actionDescription = `You gave ${count} ${cardType} ${cardWord} to opponent!`;
        cardAction = 'give';
      } else if (isReturnAction) {
        actionDescription = `You returned ${count} ${cardType} ${cardWord}!`;
        cardAction = 'return';
      } else {
        actionDescription = `You picked up ${count} ${cardType} ${cardWord}!`;
        cardAction = 'draw';
      }

      effects.push({
        type: 'cards',
        description: actionDescription,
        cardType: cardType,
        cardCount: count,
        cardAction: cardAction,
        cardIds: drawnCardIds
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
          value: moneyChange
        });
      }
    } else if (baseType === 'time') {
      const action = manualEffect.effect_action; // 'add' or 'subtract'
      const amount = manualEffect.effect_value;
      const timeChange = afterPlayer.timeSpent - beforePlayer.timeSpent;
      effects.push({
        type: 'time',
        description: `Time ${action === 'add' ? 'spent' : 'saved'}: ${Math.abs(timeChange)} days`,
        value: timeChange
      });
    }

    const summary = effects.map(e => e.description).join(', ');

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

    return {
      diceValue: 0, // No dice roll for manual effects
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      hasChoices: false,
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

      // 6. Start new exploration session for the fresh attempt
      const newSessionId = this.loggingService.startNewExplorationSession();

      // 7. Reset turn flags so player can take fresh actions after Try Again
      this.stateService.clearPlayerHasMoved();
      this.stateService.clearPlayerHasRolledDice();
      this.stateService.clearTurnActions();

      // 8. Use REAL/TEMP state model for Try Again:
      // - Discard current TEMP state (which has effects applied)
      // - Create fresh TEMP from REAL with time penalty applied to REAL first
      this.stateService.discardTempState(playerId);
      const tryAgainTempOptions: CreateTempOptions = {
        playerId,
        spaceName: currentPlayer.currentSpace,
        visitType: currentPlayer.visitType,
        isTryAgain: true,
        tryAgainPenalty: timePenalty
      };
      const tempResult = this.stateService.createTempStateFromReal(tryAgainTempOptions);
      if (!tempResult.success) {
        throw new Error(`Failed to create Try Again state: ${tempResult.error}`);
      }

      // 9. Re-process space effects to re-apply cards and manual actions
      // This is critical for spaces like OWNER-SCOPE-INITIATION (card draws) and PM-DECISION-CHECK (manual actions)
      await this.processSpaceEffectsAfterMovement(playerId, currentPlayer.currentSpace, currentPlayer.visitType, true);


      // 10. Prepare success message
      const successMessage = `${currentPlayer.name} used Try Again: ${timePenalty} day${timePenalty !== 1 ? 's' : ''} penalty applied.`;

      // 10. Send Try Again notification
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

      // 11. Return success - player stays on space to retry with fresh state
      return {
        success: true,
        message: successMessage,
        shouldAdvanceTurn: false
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
   * Get human-readable name for card type
   * Delegates to DiceRollProcessor
   */
  private getCardTypeName(cardType: string): string {
    return this.diceRollProcessor.getCardTypeName(cardType);
  }

  /**
   * Evaluate whether an effect condition is met
   */
  private evaluateEffectCondition(playerId: string, condition: string | undefined, diceRoll?: number): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      console.warn(`Player ${playerId} not found for condition evaluation`);
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
          console.warn(`⚠️ Some time effects failed for leaving ${spaceName}:`, result.errors);
        }
      } else {
        console.warn(`⚠️ EffectEngineService not available - skipping time effects for leaving ${spaceName}`);
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

    if (currentPlayer.currentSpace !== 'OWNER-FUND-INITIATION') {
      throw new Error(`Player is not on OWNER-FUND-INITIATION space`);
    }

    // Calculate project scope from W cards (single source of truth)
    const projectScope = this.gameRulesService.calculateProjectScope(playerId);

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

      return {
        diceValue: 0, // No actual dice roll
        spaceName: currentPlayer.currentSpace,
        effects: effects,
        summary: fundingDescription,
        hasChoices: false,
        canReRoll: false,
        projectTime: {
          actionDays: 0, // Funding doesn't take time at this space
          totalDays,
          estimatedDays: projectLengthInfo.estimatedDays,
          progressPercent,
          uniqueWorkTypes: projectLengthInfo.uniqueWorkTypes.length
        }
      };

    } catch (error) {
      console.error(`❌ Error in automatic funding:`, error);
      throw new Error(`Failed to process automatic funding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
