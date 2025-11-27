import { ITurnService, IDataService, IStateService, IGameRulesService, ICardService, IResourceService, IEffectEngineService, IMovementService, ILoggingService, IChoiceService, TurnResult } from '../types/ServiceContracts';
import { NegotiationService } from './NegotiationService';
import { INotificationService } from './NotificationService';
import { GameState, Player, DiceResultEffect, TurnEffectResult } from '../types/StateTypes';
import { DiceEffect, SpaceEffect, Movement, CardType, VisitType } from '../types/DataTypes';
import { EffectFactory } from '../utils/EffectFactory';
import { EffectContext, Effect } from '../types/EffectTypes';
import { formatManualEffectButton, formatDiceRollFeedback, formatActionFeedback } from '../utils/buttonFormatting';

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
  private readonly notificationService?: INotificationService;
  private effectEngineService?: IEffectEngineService;

  constructor(dataService: IDataService, stateService: IStateService, gameRulesService: IGameRulesService, cardService: ICardService, resourceService: IResourceService, movementService: IMovementService, negotiationService: NegotiationService, loggingService: ILoggingService, choiceService: IChoiceService, notificationService?: INotificationService, effectEngineService?: IEffectEngineService) {
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
  }

  /**
   * Set the EffectEngineService after construction to handle circular dependencies
   */
  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
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
      console.log(`🚪 Processing leaving space effects for ${currentPlayer.name} leaving ${currentPlayer.currentSpace}`);
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
    // Dice action start
    
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
      console.log(`🎲 Stored dice roll ${diceRoll} for player ${currentPlayer.name}`);

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

      console.log(`🏁 TurnService.endTurnWithMovement - Moving player ${currentPlayer.name} from ${currentPlayer.currentSpace}`);

      // Note: Movement choices are resolved by the UI before calling endTurnWithMovement
      // The choice may still be in state (for UI display), but the promise has been resolved
      // and the movement intent has been set, so we can proceed

      // Process leaving space effects BEFORE movement (time spent on current space)
      console.log(`🚪 Processing leaving space effects for ${currentPlayer.name} leaving ${currentPlayer.currentSpace}`);
      await this.processLeavingSpaceEffects(currentPlayer.id, currentPlayer.currentSpace, currentPlayer.visitType);

      // Handle movement - check for player's move intent first
      if (!skipAutoMove) {
        // Check for dice_outcome movement first
        const movement = this.dataService.getMovement(currentPlayer.currentSpace, currentPlayer.visitType);
        if (movement?.movement_type === 'dice_outcome' && currentPlayer.lastDiceRoll) {
          // Use dice roll to determine destination from DICE_ROLL_INFO.csv
          const diceRoll = currentPlayer.lastDiceRoll.total;

          // Try new DICE_ROLL_INFO.csv first (for spaces like CHEAT-BYPASS)
          const destinations = this.dataService.getDiceRollDestinations(currentPlayer.currentSpace, currentPlayer.visitType);
          let destination: string | null = null;

          if (destinations.length >= diceRoll) {
            destination = destinations[diceRoll - 1];
          } else {
            // Fallback to old DICE_OUTCOMES.csv for backward compatibility
            destination = this.movementService.getDiceDestination(currentPlayer.currentSpace, currentPlayer.visitType, diceRoll);
          }

          if (destination) {
            console.log(`🎲 Dice-determined movement: ${currentPlayer.name} rolled ${diceRoll}, moving to ${destination}`);
            await this.movementService.movePlayer(currentPlayer.id, destination);
          } else {
            console.warn(`🎲 No destination found for dice roll ${diceRoll} at ${currentPlayer.currentSpace}`);
          }
        } else if (currentPlayer.moveIntent) {
          // Execute the intended move
          console.log(`🎯 Executing player's intended move to: ${currentPlayer.moveIntent}`);
          await this.movementService.movePlayer(currentPlayer.id, currentPlayer.moveIntent);

          // Clear the move intent after execution
          this.stateService.setPlayerMoveIntent(currentPlayer.id, null);
        } else {
          // No intent set - fall back to auto-move for single destinations
          const validMoves = this.movementService.getValidMoves(currentPlayer.id);
          if (validMoves.length === 1) {
            // Only one move available - perform automatic movement
            console.log(`🚶 Auto-moving player ${currentPlayer.name} to ${validMoves[0]} (end-of-turn move)`);
            await this.movementService.movePlayer(currentPlayer.id, validMoves[0]);
          }
        }
      } else {
        console.log(`🔄 Skipping auto-movement for ${currentPlayer.name} - skip requested`);
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
    console.log(`🔄 Committed exploration session for current player turn`);

    // Use the common nextPlayer method
    return await this.nextPlayer();
  }

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

    // Process card expirations before ending turn
    // Processing card expirations
    this.cardService.endOfTurn();

    // Process active effects for all players at turn end
    console.log(`🕒 Processing active effects for all players at end of turn ${gameState.turn}`);
    if (this.effectEngineService) {
      await this.effectEngineService.processActiveEffectsForAllPlayers();
    }

    // Reset re-roll flag for the current player ending their turn
    const currentPlayer = allPlayers[currentPlayerIndex];
    if (currentPlayer.turnModifiers?.canReRoll) {
      // Re-roll flag reset
      this.stateService.updatePlayer({
        id: currentPlayer.id,
        turnModifiers: {
          ...currentPlayer.turnModifiers,
          canReRoll: false
        }
      });
    }

    // Log turn end for current player (use globalTurnCount + 1 to match turn_start numbering)
    this.loggingService.info(`Turn ${gameState.globalTurnCount + 1} ended`, {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      action: 'turn_end',
      turn: gameState.globalTurnCount + 1,
      space: currentPlayer.currentSpace
    });

    // Apply loan interest for the player ending their turn
    // Applying loan interest
    this.resourceService.applyInterest(currentPlayer.id);

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

    // Advance turn counter BEFORE changing current player (so turn increments for correct player)
    this.stateService.advanceTurn();

    // Update the current player in the game state
    this.stateService.setCurrentPlayer(nextPlayer.id);

    // Reset turn flags
    this.stateService.clearPlayerHasMoved();
    this.stateService.clearPlayerHasRolledDice();
    this.stateService.clearTurnActions();

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

    // Process turn start with unified function (handles all arrival logic and movement choices)
    // Note: startTurn will handle the turn start logging
    await this.startTurn(nextPlayer.id);

    return { nextPlayerId: nextPlayer.id };
  }

  /**
   * Unified turn start function with correct sequence:
   * 1. Lock UI to prevent player actions
   * 2. Save snapshot for Try Again feature
   * 3. Process arrival effects of the space
   * 4. Unlock UI and handle movement choices
   */
  public async startTurn(playerId: string): Promise<void> {
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

      // 2. Lock UI to prevent player actions during arrival processing
      this.stateService.updateGameState({ isProcessingArrival: true });

      // 3. Mark game as fully initialized (enables Try Again feature)
      if (!this.stateService.isInitialized()) {
        this.stateService.markAsInitialized();
        console.log('🎯 Game marked as fully initialized - Try Again now available');
      }

      // 4. Process space effects (including space entry logging as first effect)
      await this.processSpaceEffectsAfterMovement(player.id, player.currentSpace, player.visitType, false);

      // 5. Save snapshot for Try Again feature AFTER processing effects
      // This ensures the snapshot captures state after first-visit effects have been applied
      this.stateService.savePreSpaceEffectSnapshot(player.id, player.currentSpace);

      // 6. Unlock UI after processing is complete
      this.stateService.updateGameState({ isProcessingArrival: false });

      // Handle movement choices after effects are processed
      await this.handleMovementChoices(player.id);

    } catch (error) {
      // Ensure UI is unlocked if there's an error
      this.stateService.updateGameState({ isProcessingArrival: false });
      console.error(`🚨 TurnService.startTurn - Error during turn start for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Handles movement choice logic after arrival effects are processed
   * @private
   */
  private async handleMovementChoices(playerId: string): Promise<void> {
    console.log(`🎬 TurnService.handleMovementChoices - Checking movement choices for player ${playerId}`);

    try {
      // Get player to check movement type
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.log(`🎬 TurnService.handleMovementChoices - Player ${playerId} not found`);
        return;
      }

      // Check movement type - skip choice creation for dice_outcome spaces
      // Those choices are created AFTER dice roll in processTurnEffectsWithTracking()
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      if (movement?.movement_type === 'dice_outcome') {
        console.log(`🎬 TurnService.handleMovementChoices - Skipping choice for dice_outcome space ${player.currentSpace} (choice created after dice roll)`);
        return;
      }

      // Check if the player's current space requires a movement choice
      const validMoves = this.movementService.getValidMoves(playerId);

      // Defensive check - ensure validMoves is an array
      if (!validMoves || !Array.isArray(validMoves)) {
        console.log(`🎬 TurnService.startTurn - No valid moves data available for player ${playerId}`);
        return;
      }

      if (validMoves.length > 1) {
        // Multiple moves available - present choice to player
        const playerName = player.name || 'Unknown Player';
        console.log(`🎯 Player ${playerName} is at a choice space with ${validMoves.length} options - creating movement choice`);

        // Create choice for player to set their movement intent
        const options = validMoves.map(destination => ({
          id: destination,
          label: destination
        }));

        const prompt = `Choose your destination from ${player.currentSpace}:`;

        // Wait for player to make their choice
        const selectedDestination = await this.choiceService.createChoice(
          playerId,
          'MOVEMENT',
          prompt,
          options
        );

        console.log(`✅ Player ${playerName} selected destination: ${selectedDestination}`);

        // Set the player's movement intent so it can be executed at turn end
        this.stateService.setPlayerMoveIntent(playerId, selectedDestination);

        // Don't clear the choice here - let the UI keep showing the selected option
        // It will be cleared when the next turn starts
      } else {
        // 0 or 1 moves - no choice needed, turn proceeds normally
        console.log(`🎬 TurnService.startTurn - No choice needed (${validMoves.length} valid moves)`);
      }
    } catch (error) {
      // If movement service fails, log but don't crash the turn
      console.warn(`🎬 TurnService.startTurn - Error checking for movement choices:`, error);
    }
  }

  /**
   * Restores movement choice if the current space requires one
   * Used after completing manual effects that clear the choice state
   * @private
   */
  private async restoreMovementChoiceIfNeeded(playerId: string): Promise<void> {
    console.log(`🔄 TurnService.restoreMovementChoiceIfNeeded - Checking if movement choice needs restoration for player ${playerId}`);

    try {
      // Get player to check movement type
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.log(`🔄 Player ${playerId} not found`);
        return;
      }

      // Check movement type - skip choice restoration for dice_outcome spaces
      // Those choices are created ONLY in processTurnEffectsWithTracking() after dice roll
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      if (movement?.movement_type === 'dice_outcome') {
        console.log(`🔄 TurnService.restoreMovementChoiceIfNeeded - Skipping restore for dice_outcome space ${player.currentSpace} (choice created after dice roll)`);
        return;
      }

      // Check if the player's current space requires a movement choice
      const validMoves = this.movementService.getValidMoves(playerId);

      // Defensive check - ensure validMoves is an array
      if (!validMoves || !Array.isArray(validMoves)) {
        console.log(`🔄 No valid moves data available for player ${playerId}`);
        return;
      }

      if (validMoves.length > 1) {
        const playerName = player.name || 'Unknown Player';

        // Check if player already has a move intent set
        if (player.moveIntent) {
          console.log(`🔄 Player ${playerName} already has move intent: ${player.moveIntent} - restoring choice for UI display only`);

          // Restore the choice to UI state so buttons show, but don't wait for resolution
          // since the intent is already set
          const options = validMoves.map(destination => ({
            id: destination,
            label: destination
          }));

          const prompt = `Choose your destination from ${player.currentSpace}:`;

          // Create the choice in state for UI display (the moveIntent is already set)
          const choice = {
            id: `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId,
            type: 'MOVEMENT' as const,
            prompt,
            options
          };

          this.stateService.setAwaitingChoice(choice);
          console.log(`🔄 Movement choice restored to UI state (intent already set to ${player.moveIntent})`);
          return;
        }

        console.log(`🔄 Restoring movement choice for ${playerName} (${validMoves.length} options)`);

        // Create choice for player to set their movement intent
        const options = validMoves.map(destination => ({
          id: destination,
          label: destination
        }));

        const prompt = `Choose your destination from ${player.currentSpace}:`;

        // Create the choice (don't await - just set it in state)
        // The UI will show the choice and wait for player selection
        this.choiceService.createChoice(
          playerId,
          'MOVEMENT',
          prompt,
          options
        ).then(selectedDestination => {
            const player = this.stateService.getPlayer(playerId);
            const playerName = player?.name || 'Unknown Player';
            console.log(`✅ Player ${playerName} selected destination (restored): ${selectedDestination}`);
            this.stateService.setPlayerMoveIntent(playerId, selectedDestination);
        }).catch(error => {
          // Handle error silently - choice might be resolved later
          console.log(`🔄 Movement choice created (will be resolved when player selects destination)`);
        });
      } else {
        console.log(`🔄 No movement choice needed (${validMoves.length} valid moves)`);
      }
    } catch (error) {
      console.warn(`🔄 Error restoring movement choice:`, error);
    }
  }

  rollDice(): number {
    const roll = Math.floor(Math.random() * 6) + 1;
    
    // Safety check - dice should never be 0 or greater than 6
    if (roll < 1 || roll > 6) {
      console.error(`Invalid dice roll generated: ${roll}. Rolling again.`);
      return Math.floor(Math.random() * 6) + 1;
    }
    
    return roll;
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
        console.log(`💰 Adding user messaging for OWNER-FUND-INITIATION space`);
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
      
      console.log(`🏭 Generated ${spaceEffects.length} space effects + ${diceEffects.length} dice effects = ${allEffects.length} total effects`);
      
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
        console.log(`🔧 Processing ${allEffects.length} space/dice effects through Effect Engine...`);
        const processingResult = await this.effectEngineService.processEffects(allEffects, effectContext);
        
        if (!processingResult.success) {
          console.error(`❌ Failed to process some space/dice effects: ${processingResult.errors.join(', ')}`);
          // Log errors but don't throw - some effects may have succeeded
        } else {
          console.log(`✅ All space/dice effects processed successfully: ${processingResult.successfulEffects}/${processingResult.totalEffects} effects completed`);
        }
      } else {
        console.log(`ℹ️ No space or dice effects to process for ${currentPlayer.currentSpace}`);
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

    console.log(`🎲 Processing dice roll effects for ${currentPlayer.name} on ${currentPlayer.currentSpace} (rolled ${diceRoll})`);

    try {
      // Get ONLY dice effect data from DataService
      const diceEffectsData = this.dataService.getDiceEffects(
        currentPlayer.currentSpace,
        currentPlayer.visitType
      );

      if (diceEffectsData.length === 0) {
        console.log(`ℹ️ No dice effects to process for ${currentPlayer.currentSpace}`);
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

      console.log(`🎲 Generated ${diceEffects.length} dice effects from roll ${diceRoll}`);

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
        console.log(`🔧 Processing ${diceEffects.length} dice effects through Effect Engine...`);
        const processingResult = await this.effectEngineService.processEffects(diceEffects, effectContext);

        if (!processingResult.success) {
          console.error(`❌ Failed to process some dice effects: ${processingResult.errors.join(', ')}`);
          // Log errors but don't throw - some effects may have succeeded
        } else {
          console.log(`✅ All dice effects processed successfully: ${processingResult.successfulEffects}/${processingResult.totalEffects} effects completed`);
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
    // Get the effect for the specific dice roll
    const rollEffect = this.getDiceRollEffect(effect, diceRoll);
    
    if (!rollEffect || rollEffect === 'No change') {
      return currentState;
    }

    // Apply effect based on type
    switch (effect.effect_type) {
      case 'cards':
        return this.applyCardEffect(playerId, effect.card_type || 'W', rollEffect);
      
      case 'money':
        return this.applyMoneyEffect(playerId, rollEffect);
      
      case 'time':
        return this.applyTimeEffect(playerId, rollEffect);
      
      case 'quality':
        return this.applyQualityEffect(playerId, rollEffect);
      
      default:
        console.warn(`Unknown effect type: ${effect.effect_type}`);
        return currentState;
    }
  }

  private getDiceRollEffect(effect: DiceEffect, diceRoll: number): string | undefined {
    switch (diceRoll) {
      case 1: return effect.roll_1;
      case 2: return effect.roll_2;
      case 3: return effect.roll_3;
      case 4: return effect.roll_4;
      case 5: return effect.roll_5;
      case 6: return effect.roll_6;
      default: return undefined;
    }
  }

  private applyCardEffect(playerId: string, cardType: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    if (effect.includes('Draw')) {
      const drawCount = this.parseNumericValue(effect);
      if (drawCount > 0) {
        // Use unified CardService.drawCards with source tracking
        const drawnCardIds = this.cardService.drawCards(
          playerId, 
          cardType as any, 
          drawCount, 
          'turn_effect', 
          `Draw ${drawCount} ${cardType} card${drawCount > 1 ? 's' : ''} from space effect`
        );
        console.log(`Player ${player.name} draws ${drawCount} ${cardType} cards:`, drawnCardIds);
      }
    } else if (effect.includes('Remove') || effect.includes('Discard')) {
      const removeCount = this.parseNumericValue(effect);
      if (removeCount > 0) {
        const currentCards = this.cardService.getPlayerCards(playerId, cardType as CardType);
        const cardsToRemove = currentCards.slice(0, removeCount);
        if (cardsToRemove.length > 0) {
          // Use unified CardService.discardCards with source tracking
          this.cardService.discardCards(
            playerId,
            cardsToRemove,
            'turn_effect',
            `Remove ${removeCount} ${cardType} card${removeCount > 1 ? 's' : ''} from space effect`
          );
        }
      }
    } else if (effect.includes('Replace')) {
      const replaceCount = this.parseNumericValue(effect);
      const currentCards = this.cardService.getPlayerCards(playerId, cardType as CardType);
      if (replaceCount > 0 && currentCards.length > 0) {
        // Remove old cards using discardCards
        const cardsToRemove = currentCards.slice(0, replaceCount);
        this.cardService.discardCards(
          playerId,
          cardsToRemove,
          'turn_effect',
          `Replace ${replaceCount} ${cardType} cards - removing old cards`
        );
        
        // Add new cards using drawCards
        const drawnCardIds = this.cardService.drawCards(
          playerId,
          cardType as any,
          replaceCount,
          'turn_effect',
          `Replace ${replaceCount} ${cardType} cards - adding new cards`
        );
        console.log(`Player ${player.name} replaces ${replaceCount} ${cardType} cards:`, drawnCardIds);
      }
    }

    // Return current state since CardService methods handle state updates
    return this.stateService.getGameState();
  }

  private applyMoneyEffect(playerId: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    let moneyChange = 0;

    if (effect.includes('%')) {
      // Percentage-based effect
      const percentage = this.parseNumericValue(effect);
      moneyChange = Math.floor((player.money * percentage) / 100);
    } else {
      // Fixed amount effect
      moneyChange = this.parseNumericValue(effect);
    }

    // Use unified ResourceService for money changes
    if (moneyChange > 0) {
      this.resourceService.addMoney(playerId, moneyChange, 'turn_effect', `Space effect: +$${moneyChange.toLocaleString()}`);
    } else if (moneyChange < 0) {
      this.resourceService.spendMoney(playerId, Math.abs(moneyChange), 'turn_effect', `Space effect: -$${Math.abs(moneyChange).toLocaleString()}`);
    }

    // Return current state since ResourceService handles state updates
    return this.stateService.getGameState();
  }

  private applyTimeEffect(playerId: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const timeChange = this.parseNumericValue(effect);

    // Use unified ResourceService for time changes
    if (timeChange > 0) {
      this.resourceService.addTime(playerId, timeChange, 'turn_effect', `Space effect: +${timeChange} time`);
    } else if (timeChange < 0) {
      this.resourceService.spendTime(playerId, Math.abs(timeChange), 'turn_effect', `Space effect: -${Math.abs(timeChange)} time`);
    }

    // Return current state since ResourceService handles state updates
    return this.stateService.getGameState();
  }

  private applyQualityEffect(playerId: string, effect: string): GameState {
    // Quality effects might affect other game state in the future
    // For now, just log the quality level
    console.log(`Player ${playerId} quality level: ${effect}`);
    return this.stateService.getGameState();
  }

  private async applySpaceCardEffect(playerId: string, effect: SpaceEffect, effectType: string): Promise<GameState> {
    console.log(`🔧 [DEBUG] applySpaceCardEffect called - effect.effect_action: "${effect.effect_action}"`);

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse the effect action and value
    const action = effect.effect_action.toLowerCase(); // e.g., "draw_w", "add", etc. - normalize to lowercase
    console.log(`🔧 [DEBUG] Normalized action: "${action}" (original: "${effect.effect_action}")`);

    // Extract numeric value from effect_value (e.g., "Draw 3" → 3, "Replace 1" → 1)
    let value: number;
    if (typeof effect.effect_value === 'string') {
      const match = effect.effect_value.match(/\d+/);
      value = match ? parseInt(match[0]) : 0;
    } else {
      value = effect.effect_value;
    }
    console.log(`🔧 [DEBUG] Parsed value: ${value} (from effect_value: "${effect.effect_value}")`);

    if (action === 'draw_w') {
      console.log(`🔧 [DEBUG] Matched draw_w - drawing ${value} W cards`);
      // Use CardService for W card draws (includes action logging)
      this.cardService.drawCards(
        playerId,
        'W',
        value,
        'manual_effect',
        `Manual action: Draw ${value} W card${value !== 1 ? 's' : ''}`
      );

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'draw_b') {
      console.log(`🔧 [DEBUG] Matched draw_b - drawing ${value} B cards`);
      // Use CardService for B card draws (includes action logging)
      const drawnCards = this.cardService.drawCards(
        playerId,
        'B',
        value,
        'manual_effect',
        `Manual action: Draw ${value} B card${value !== 1 ? 's' : ''}`
      );

      // Special handling for OWNER-FUND-INITIATION: automatically play drawn funding cards
      if (player.currentSpace === 'OWNER-FUND-INITIATION' && drawnCards.length > 0) {
        console.log(`💰 OWNER-FUND-INITIATION: Automatically playing ${drawnCards.length} funding card(s)`);
        for (const cardId of drawnCards) {
          this.cardService.applyCardEffects(playerId, cardId);
          this.cardService.finalizePlayedCard(playerId, cardId);
        }
      }

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'draw_e') {
      console.log(`🔧 [DEBUG] Matched draw_e - drawing ${value} E cards`);
      // Use CardService for E card draws (includes action logging)
      this.cardService.drawCards(
        playerId,
        'E',
        value,
        'manual_effect',
        `Manual action: Draw ${value} E card${value !== 1 ? 's' : ''}`
      );

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'draw_l') {
      console.log(`🔧 [DEBUG] Matched draw_l - drawing ${value} L cards`);
      // Use CardService for L card draws (includes action logging)
      this.cardService.drawCards(
        playerId,
        'L',
        value,
        'manual_effect',
        `Manual action: Draw ${value} L card${value !== 1 ? 's' : ''}`
      );

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'draw_i') {
      // Use CardService for I card draws (includes action logging)
      const drawnCards = this.cardService.drawCards(
        playerId,
        'I',
        value,
        'manual_effect',
        `Manual action: Draw ${value} I card${value !== 1 ? 's' : ''}`
      );

      // Special handling for OWNER-FUND-INITIATION: automatically play drawn funding cards
      if (player.currentSpace === 'OWNER-FUND-INITIATION' && drawnCards.length > 0) {
        console.log(`💰 OWNER-FUND-INITIATION: Automatically playing ${drawnCards.length} funding card(s)`);
        for (const cardId of drawnCards) {
          this.cardService.applyCardEffects(playerId, cardId);
          this.cardService.finalizePlayedCard(playerId, cardId);
        }
      }

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'replace_e') {
      // Replace E cards - create choice if player has multiple E cards
      const currentECards = this.cardService.getPlayerCards(playerId, 'E');
      const replaceCount = Math.min(value, currentECards.length);

      if (replaceCount === 0) {
        console.log(`Player ${player.name} has no E cards to replace`);
        return this.stateService.getGameState();
      }

      if (currentECards.length === 1 || replaceCount === currentECards.length) {
        // Only one card or replacing all cards - no choice needed
        this.cardService.discardCards(
          playerId,
          currentECards.slice(0, replaceCount),
          'manual_effect',
          `Manual action: Replace ${replaceCount} E cards - removing old cards`
        );

        this.cardService.drawCards(
          playerId,
          'E',
          replaceCount,
          'manual_effect',
          `Manual action: Replace ${replaceCount} E cards - adding new cards`
        );
      } else {
        // Multiple cards available - create choice for which to replace
        console.log(`Player ${player.name} has ${currentECards.length} E cards, creating choice for replacement`);

        // Create choice options for each E card
        const options = currentECards.map(cardId => {
          const cardData = this.dataService.getCardById(cardId);
          return {
            id: cardId,
            label: cardData ? cardData.card_name : `E Card ${cardId}`
          };
        });

        // Use ChoiceService to create the choice and await player selection
        const selectedCardId = await this.choiceService.createChoice(
          playerId,
          'CARD_REPLACEMENT',
          `Choose ${replaceCount} E card${replaceCount !== 1 ? 's' : ''} to replace:`,
          options,
          { newCardType: 'E', replaceCount: replaceCount } // Pass the new card type and count as metadata
        );

        console.log(`Player selected card ${selectedCardId} for replacement`);

        // Perform the actual card replacement
        this.cardService.replaceCard(playerId, selectedCardId, 'E');

        // Clear the choice from state after resolution
        this.stateService.clearAwaitingChoice();
      }

      // IMPORTANT: Mark action as complete BEFORE restoring movement choice
      // This ensures action counts are correct when movement buttons re-appear
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);

      // BUG FIX: Restore movement choice if this space requires one
      // This fixes the bug where completing a card action clears the movement choice
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'replace_l') {
      // Replace L cards using CardService (includes action logging)
      const currentLCards = this.cardService.getPlayerCards(playerId, 'L');
      const replaceCount = Math.min(value, currentLCards.length);

      if (replaceCount > 0) {
        // Use CardService for replacement (discard old + draw new)
        this.cardService.discardCards(
          playerId,
          currentLCards.slice(0, replaceCount),
          'manual_effect',
          `Manual action: Replace ${replaceCount} L cards - removing old cards`
        );
        this.cardService.drawCards(
          playerId,
          'L',
          replaceCount,
          'manual_effect',
          `Manual action: Replace ${replaceCount} L cards - adding new cards`
        );
      } else {
        console.log(`Player ${player.name} has no L cards to replace`);
      }

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'return_e') {
      // Return E cards using CardService (includes action logging)
      const currentECards = this.cardService.getPlayerCards(playerId, 'E');
      const returnCount = Math.min(value, currentECards.length);

      if (returnCount > 0) {
        this.cardService.discardCards(
          playerId,
          currentECards.slice(0, returnCount),
          'manual_effect',
          `Manual action: Return ${returnCount} E cards`
        );
      } else {
        console.log(`Player ${player.name} has no E cards to return`);
      }

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'return_l') {
      // Return L cards using CardService (includes action logging)
      const currentLCards = this.cardService.getPlayerCards(playerId, 'L');
      const returnCount = Math.min(value, currentLCards.length);

      if (returnCount > 0) {
        this.cardService.discardCards(
          playerId,
          currentLCards.slice(0, returnCount),
          'manual_effect',
          `Manual action: Return ${returnCount} L cards`
        );
      } else {
        console.log(`Player ${player.name} has no L cards to return`);
      }

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    } else if (action === 'transfer') {
      // Transfer cards to another player
      const targetPlayer = this.getTargetPlayer(playerId, effect.condition);

      if (!targetPlayer) {
        console.log(`Player ${player.name} could not transfer cards - no target player found`);

        // Mark action as complete BEFORE restoring movement choice
        const { text: buttonText } = formatManualEffectButton(effect);
        this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
        await this.restoreMovementChoiceIfNeeded(playerId);

        return this.stateService.getGameState();
      }

      // Transfer a card from player's hand to target
      // Priority order: W, B, E, L, I (transfer most valuable first)
      const cardTypes: CardType[] = ['W', 'B', 'E', 'L', 'I'];
      let transferredCard: string | null = null;

      for (const cardType of cardTypes) {
        const playerCards = this.cardService.getPlayerCards(playerId, cardType);
        if (playerCards.length > 0) {
          transferredCard = playerCards[0];
          break;
        }
      }

      if (transferredCard) {
        // Use CardService for transfer (includes action logging)
        this.cardService.transferCard(
          playerId,
          targetPlayer.id,
          transferredCard,
          'manual_effect',
          'Manual action: Transfer card'
        );
        console.log(`Player ${player.name} transfers card ${transferredCard} to ${targetPlayer.name}`);
      } else {
        console.log(`Player ${player.name} has no cards to transfer`);
      }

      // Mark action as complete BEFORE restoring movement choice
      const { text: buttonText } = formatManualEffectButton(effect);
      this.stateService.setPlayerCompletedManualAction(effectType, buttonText);
      await this.restoreMovementChoiceIfNeeded(playerId);

      return this.stateService.getGameState();
    }
    
    return this.stateService.getGameState();
  }

  private applySpaceMoneyEffect(playerId: string, effect: SpaceEffect): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const value = typeof effect.effect_value === 'string' ? 
      parseInt(effect.effect_value) : effect.effect_value;
    
    let newMoney = player.money;
    
    if (effect.effect_action === 'add') {
      newMoney += value;
    } else if (effect.effect_action === 'subtract') {
      newMoney -= value;
    } else if (effect.effect_action === 'fee_percent') {
      // Apply percentage-based fee
      const feeAmount = Math.floor((player.money * value) / 100);
      newMoney -= feeAmount;
      console.log(`Player ${player.name} pays ${value}% fee (${feeAmount}) based on condition: ${effect.condition}`);
    } else if (effect.effect_action === 'add_per_amount') {
      // Calculate based on condition (e.g., "per_200k" = per $200,000)
      let additionalAmount = value;

      if (effect.condition === 'per_200k') {
        // Calculate amount based on total borrowed (sum of all loan principals)
        const totalBorrowed = player.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
        const multiplier = Math.floor(totalBorrowed / 200000);
        additionalAmount = value * multiplier;
        console.log(`Player ${player.name} gains ${additionalAmount} money (${value} per $200K, borrowed ${totalBorrowed})`);
      } else {
        // For other conditions, use value directly (fallback)
        console.warn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
      }

      newMoney += additionalAmount;
    }
    
    newMoney = Math.max(0, newMoney); // Ensure money doesn't go below 0

    console.log(`Player ${player.name} money change: ${effect.effect_action} ${value}, new total: ${newMoney}`);

    return this.stateService.updatePlayer({
      id: playerId,
      money: newMoney
    });
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

    console.log(`💰 Applying investment funding for ${player.name} at ${space}`);

    // Step 1: Roll dice
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    console.log(`🎲 Investment funding dice roll: ${diceRoll}`);

    // Step 2: Apply time based on dice roll
    const diceEffects = this.dataService.getDiceEffects(space, visitType);
    const timeEffect = diceEffects.find(e => e.effect_type === 'time');
    if (timeEffect) {
      const diceRollEffectValue = this.getDiceRollEffectValue(timeEffect, diceRoll);
      const days = parseInt(diceRollEffectValue);
      if (!isNaN(days) && days > 0) {
        this.resourceService.addTime(playerId, days, source, `Investment review: ${days} days`);
        console.log(`⏰ Added ${days} days for investment review`);
      }
    }

    // Step 3: Capture investment before drawing card
    const investmentBefore = player.moneySources?.investmentDeals || 0;

    // Step 4: Draw and apply I card
    console.log(`🎴 Drawing I card for investment funding...`);
    await this.cardService.drawAndApplyCard(playerId, 'I', source, reason);

    // Step 5: Calculate and charge 5% fee on NEW investment only
    const updatedPlayer = this.stateService.getPlayer(playerId);
    const investmentAfter = updatedPlayer.moneySources?.investmentDeals || 0;
    const newInvestment = investmentAfter - investmentBefore;
    const feeAmount = Math.floor((newInvestment * 5) / 100);

    if (feeAmount > 0) {
      this.resourceService.recordCost(playerId, 'investor', feeAmount, `5% investment fee on $${newInvestment.toLocaleString()}`);
      console.log(`💸 Charged 5% investment fee: $${feeAmount.toLocaleString()} on new investment of $${newInvestment.toLocaleString()}`);
    }

    // Step 6: Mark dice as rolled
    this.stateService.setPlayerHasRolledDice();

    return this.stateService.getGameState();
  }

  private applySpaceTimeEffect(playerId: string, effect: SpaceEffect): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const value = typeof effect.effect_value === 'string' ? 
      parseInt(effect.effect_value) : effect.effect_value;
    
    let newTime = player.timeSpent || 0;
    
    if (effect.effect_action === 'add') {
      newTime += value;
    } else if (effect.effect_action === 'subtract') {
      newTime -= value;
    } else if (effect.effect_action === 'add_per_amount') {
      // Calculate based on condition (e.g., "per_200k" = per $200,000)
      let additionalTime = value;

      if (effect.condition === 'per_200k') {
        // Calculate time based on total borrowed (sum of all loan principals)
        const totalBorrowed = player.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
        const multiplier = Math.floor(totalBorrowed / 200000);
        additionalTime = value * multiplier;
        console.log(`Player ${player.name} gains ${additionalTime} time (${value} per $200K, borrowed ${totalBorrowed})`);
      } else {
        // For other conditions, use value directly (fallback)
        console.warn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
      }

      newTime += additionalTime;
    }
    
    newTime = Math.max(0, newTime); // Ensure time doesn't go below 0

    console.log(`Player ${player.name} time change: ${effect.effect_action} ${value}, new total: ${newTime}`);

    return this.stateService.updatePlayer({
      id: playerId,
      timeSpent: newTime
    });
  }

  private getTargetPlayer(currentPlayerId: string, condition: string): Player | null {
    const gameState = this.stateService.getGameState();
    const players = gameState.players;
    const currentPlayerIndex = players.findIndex(p => p.id === currentPlayerId);
    
    if (currentPlayerIndex === -1) {
      return null;
    }

    if (condition === 'to_right') {
      // Get player to the right (next in turn order)
      const targetIndex = (currentPlayerIndex + 1) % players.length;
      return players[targetIndex];
    } else if (condition === 'to_left') {
      // Get player to the left (previous in turn order)  
      const targetIndex = (currentPlayerIndex - 1 + players.length) % players.length;
      return players[targetIndex];
    }
    
    // Unknown condition
    console.warn(`Unknown transfer condition: ${condition}`);
    return null;
  }

  private parseNumericValue(effect: string): number {
    // Extract numeric value from effect string (including negatives)
    const matches = effect.match(/(-?\d+)/);
    if (matches) {
      return parseInt(matches[1], 10);
    }

    // Handle special cases
    if (effect.toLowerCase().includes('many')) {
      return 3; // Default "many" to 3
    }

    return 0;
  }

  /**
   * Get the dice roll effect value for a specific roll
   */
  private getDiceRollEffectValue(diceEffect: DiceEffect, diceRoll: number): string {
    switch (diceRoll) {
      case 1: return diceEffect.roll_1 || '';
      case 2: return diceEffect.roll_2 || '';
      case 3: return diceEffect.roll_3 || '';
      case 4: return diceEffect.roll_4 || '';
      case 5: return diceEffect.roll_5 || '';
      case 6: return diceEffect.roll_6 || '';
      default: return '';
    }
  }

  /**
   * Apply dice roll chance effects (like "draw_l_on_1" - draw a card if dice roll is 1)
   */
  private applyDiceRollChanceEffect(playerId: string, effect: SpaceEffect): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    console.log(`🎲 Applying dice roll chance effect: ${effect.effect_action} for ${player.name}`);

    // Roll a dice (1-6)
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    console.log(`🎲 Dice rolled: ${diceRoll}`);

    // Parse the effect action to understand the condition
    // Format: "draw_l_on_1" means draw L card if roll is 1
    const actionParts = effect.effect_action.split('_');
    if (actionParts.length >= 3 && actionParts[0] === 'draw') {
      const cardType = actionParts[1].toUpperCase() as CardType;
      const triggerRoll = parseInt(actionParts[3]); // "on_1" -> 1
      const cardCount = parseInt(effect.effect_value.toString()) || 1;

      if (diceRoll === triggerRoll) {
        console.log(`🎯 Dice roll ${diceRoll} matches trigger ${triggerRoll}! Drawing ${cardCount} ${cardType} card(s)`);

        // Use the CardService to draw cards
        try {
          const drawnCardIds = this.cardService.drawCards(playerId, cardType, cardCount, 'dice_roll_chance',
            `Manual effect: Drew ${cardCount} ${cardType} card(s) on dice roll ${diceRoll}`);

          // Get the card names for better feedback
          const cardNames = drawnCardIds.map(cardId => {
            const cardData = this.dataService.getCardById(cardId);
            return cardData ? cardData.card_name : cardId;
          });

          // Log dice roll result to game log
          if (cardNames.length > 0) {
            const cardList = cardNames.join(', ');
            this.loggingService.info(`🎲 ${player.name} rolled ${diceRoll} and drew: ${cardList}`, {
              playerId: player.id,
              playerName: player.name,
              action: 'dice_roll',
              diceValue: diceRoll,
              spaceName: player.currentSpace,
              description: `Automatic dice roll - drew ${cardCount} ${cardType} card(s)`
            });
          }

          // Set UI completion message
          this.stateService.setDiceRollCompletion(`Rolled ${diceRoll} - Drew ${cardCount} ${cardType} card(s)`);
        } catch (error) {
          console.warn(`Failed to draw ${cardType} cards:`, error);
        }
      } else {
        console.log(`🎲 Dice roll ${diceRoll} does not match trigger ${triggerRoll}. No cards drawn.`);

        // Log dice roll result to game log
        this.loggingService.info(`🎲 ${player.name} rolled ${diceRoll} (needed ${triggerRoll} to draw ${cardType} card) - No card drawn`, {
          playerId: player.id,
          playerName: player.name,
          action: 'dice_roll',
          diceValue: diceRoll,
          spaceName: player.currentSpace,
          description: `Automatic dice roll - no match`
        });

        // Set UI completion message for non-matching roll
        this.stateService.setDiceRollCompletion(`Rolled ${diceRoll} - No card drawn`);
      }
    } else {
      console.warn(`Unknown dice_roll_chance effect format: ${effect.effect_action}`);
    }

    return this.stateService.getGameState();
  }

  /**
   * Trigger a manual space effect for the current player
   */
  async triggerManualEffect(playerId: string, effectType: string): Promise<GameState> {
    console.log(`🔧 [DEBUG] triggerManualEffect called with effectType: "${effectType}"`);

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse effectType - might be compound like "cards:draw_b" or simple like "money"
    const [baseType, action] = effectType.includes(':') ? effectType.split(':') : [effectType, null];
    console.log(`🔧 [DEBUG] Parsed - baseType: "${baseType}", action: "${action}"`);

    // Get manual effects for current space and visit type
    const spaceEffects = this.dataService.getSpaceEffects(player.currentSpace, player.visitType);
    console.log(`🔧 [DEBUG] Found ${spaceEffects.length} space effects for ${player.currentSpace} (${player.visitType})`);
    console.log(`🔧 [DEBUG] Space effects:`, spaceEffects.map(e => `${e.trigger_type}:${e.effect_type}:${e.effect_action}`));

    const manualEffect = spaceEffects.find(effect => {
      const typeMatches = effect.trigger_type === 'manual' && effect.effect_type === baseType;
      // If action specified (e.g., "draw_b"), must match; otherwise just type match
      const actionMatches = !action || effect.effect_action === action;
      console.log(`🔧 [DEBUG] Checking effect - trigger: ${effect.trigger_type}, type: ${effect.effect_type}, action: ${effect.effect_action} | typeMatches: ${typeMatches}, actionMatches: ${actionMatches}`);
      return typeMatches && actionMatches;
    });

    if (!manualEffect) {
      console.log(`🔧 [DEBUG] ERROR: No manual effect found!`);
      throw new Error(`No manual ${effectType} effect found for ${player.currentSpace} (${player.visitType})`);
    }

    console.log(`🔧 [DEBUG] Found manual effect:`, manualEffect);

    // Evaluate condition before applying manual effect
    const conditionMet = this.evaluateEffectCondition(playerId, manualEffect.condition);
    if (!conditionMet) {
      throw new Error(`Manual ${effectType} effect condition not met: ${manualEffect.condition}`);
    }

    console.log(`🔧 Triggering manual ${effectType} effect for player ${player.name} on ${player.currentSpace}`);
    console.log(`🔧 Effect details: ${manualEffect.effect_action} ${manualEffect.effect_value}`);

    // Apply the effect based on type
    let newState = this.stateService.getGameState();

    console.log(`🔧 [DEBUG] About to apply effect - baseType: "${baseType}"`);

    if (baseType === 'cards') {
      console.log(`🔧 [DEBUG] Calling applySpaceCardEffect`);
      newState = await this.applySpaceCardEffect(playerId, manualEffect, effectType);
      console.log(`🔧 [DEBUG] applySpaceCardEffect returned, player hand length:`, newState.players.find(p => p.id === playerId)?.hand.length);
    } else if (baseType === 'money') {
      // Special handling for get_investment_funding action
      if (manualEffect.effect_action === 'get_investment_funding') {
        newState = await this.applyInvestmentFunding(playerId, manualEffect);
      } else {
        newState = this.applySpaceMoneyEffect(playerId, manualEffect);
      }
    } else if (baseType === 'time') {
      newState = this.applySpaceTimeEffect(playerId, manualEffect);
    } else if (baseType === 'dice_roll_chance') {
      // Handle dice roll chance effects (like "draw_l_on_1")
      console.log(`🎲 Processing dice_roll_chance effect: ${manualEffect.effect_action}`);
      newState = this.applyDiceRollChanceEffect(playerId, manualEffect);

      // Mark that dice has been rolled to prevent duplicate dice roll buttons
      this.stateService.setPlayerHasRolledDice();
    } else if (baseType === 'turn') {
      // Handle turn effects (like "end_turn") - these are special and don't need processing here
      console.log(`🏁 Processing turn effect: ${manualEffect.effect_action}`);
      // Turn effects are handled by the UI component calling onEndTurn
    } else {
      console.warn(`⚠️ Unknown manual effect type: ${baseType}`);
    }

    // Mark action as complete for non-card effects (money, time, dice_roll_chance)
    // Card effects handle this inside applySpaceCardEffect (before restoreMovementChoiceIfNeeded)
    if (baseType !== 'cards') {
      const { text: buttonText } = formatManualEffectButton(manualEffect);
      this.stateService.setPlayerCompletedManualAction(baseType, buttonText);
    }

    console.log(`🔧 Manual ${effectType} effect completed for player ${player.name}`);
    return this.stateService.getGameState();
  }

  /**
   * Trigger manual effect with modal feedback - similar to rollDiceWithFeedback
   */
  async triggerManualEffectWithFeedback(playerId: string, effectType: string): Promise<TurnEffectResult> {
    console.log(`🔧 TurnService.triggerManualEffectWithFeedback - Starting for player ${playerId}, effect: ${effectType}`);

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
      const cardType = manualEffect.effect_action.replace('draw_', '').replace('replace_', '').toUpperCase();

      // Determine which cards were drawn by comparing before/after hands
      const beforeHand = beforePlayer.hand || [];
      const afterHand = afterPlayer.hand || [];
      const drawnCardIds = afterHand.filter(cardId => !beforeHand.includes(cardId));

      // Parse effect_value with fallback to actual drawn count
      let count: number;
      if (typeof manualEffect.effect_value === 'string') {
        const parsed = parseInt(manualEffect.effect_value, 10);
        count = isNaN(parsed) ? drawnCardIds.length : parsed;
      } else if (typeof manualEffect.effect_value === 'number') {
        count = manualEffect.effect_value;
      } else {
        // Fallback to actual drawn count if effect_value is undefined or invalid
        count = drawnCardIds.length;
      }

      // Grammatically correct singular/plural
      const cardWord = count === 1 ? 'card' : 'cards';

      effects.push({
        type: 'cards',
        description: `You picked up ${count} ${cardType} ${cardWord}!`,
        cardType: cardType,
        cardCount: count,
        cardAction: 'draw',
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

    return {
      diceValue: 0, // No dice roll for manual effects
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      hasChoices: false
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

    console.log(`🤝 Starting negotiation for player ${player.name} on space ${player.currentSpace}`);

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
    console.log(`🔄 Try Again requested for player ${playerId}`);

    try {
      // 0. Check if game is fully initialized (prevent race condition on first turn)
      if (!this.stateService.isInitialized()) {
        console.log('🚫 Try Again blocked - game not fully initialized');
        return {
          success: false,
          message: 'Game is still initializing - Try Again will be available shortly',
          shouldAdvanceTurn: false
        };
      }

      // 1. Get the current player to determine their space
      const currentPlayer = this.stateService.getPlayer(playerId);
      if (!currentPlayer) {
        return {
          success: false,
          message: 'Player not found',
          shouldAdvanceTurn: false
        };
      }

      // 2. Check for the snapshot for this specific player and space
      if (!this.stateService.hasPreSpaceEffectSnapshot(playerId, currentPlayer.currentSpace)) {
        return {
          success: false,
          message: 'No snapshot available - Try Again not possible at this time',
          shouldAdvanceTurn: false
        };
      }

      // 3. Get the snapshot object (do not restore it yet)
      const snapshotState = this.stateService.getPlayerSnapshot(playerId);
      if (!snapshotState) {
        throw new Error('Snapshot exists but could not be retrieved');
      }

      // Find player in snapshot to get their space info
      const snapshotPlayer = snapshotState.players.find(p => p.id === playerId);
      if (!snapshotPlayer) {
        throw new Error(`Player ${playerId} not found in snapshot`);
      }

      console.log(`🔄 ${snapshotPlayer.name} trying again on space ${snapshotPlayer.currentSpace}`);

      // Check if space allows negotiation (try again)
      const spaceContent = this.dataService.getSpaceContent(snapshotPlayer.currentSpace, snapshotPlayer.visitType);
      if (!spaceContent || !spaceContent.can_negotiate) {
        return {
          success: false,
          message: 'Try again not available on this space',
          shouldAdvanceTurn: false
        };
      }

      // 3. Calculate the timePenalty
      const spaceEffects = this.dataService.getSpaceEffects(snapshotPlayer.currentSpace, snapshotPlayer.visitType);
      const timePenalty = spaceEffects
        .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add')
        .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);

      console.log(`⏰ Applying ${timePenalty} day penalty for Try Again on ${snapshotPlayer.currentSpace}`);

      // 4. Log the Try Again action with committed status before abandoning current session
      this.loggingService.info(`Used Try Again: Reverted to ${snapshotPlayer.currentSpace} with ${timePenalty} day penalty`, {
        playerId: playerId,
        playerName: snapshotPlayer.name,
        action: 'try_again',
        spaceName: snapshotPlayer.currentSpace,
        timePenalty: timePenalty,
        isCommitted: true // This action is immediately committed
      });

      // 5. Start new exploration session for the fresh attempt (current session will be abandoned)
      const newSessionId = this.loggingService.startNewExplorationSession();
      console.log(`🔄 Started new exploration session ${newSessionId} after Try Again for ${snapshotPlayer.name}`);

      // 6. Revert player to snapshot state with time penalty applied atomically
      // This handles all the complex state reconstruction, action flag resets, and penalty application
      this.stateService.revertPlayerToSnapshot(playerId, timePenalty);

      console.log(`✅ ${snapshotPlayer.name} reverted to ${snapshotPlayer.currentSpace} with ${timePenalty} day penalty`);

      // 6. DO NOT save a new snapshot - preserve the original clean snapshot for multiple Try Again attempts
      // This ensures subsequent Try Again attempts revert to the original state, not the penalty-applied state

      // 7. Prepare success message for immediate display
      const successMessage = `${snapshotPlayer.name} used Try Again: Reverted to ${snapshotPlayer.currentSpace} with ${timePenalty} day${timePenalty !== 1 ? 's' : ''} penalty.`;

      // Send Try Again notification
      if (this.notificationService) {
        this.notificationService.notify(
          {
            short: 'Try Again Used',
            medium: `🔄 Try Again: ${timePenalty} day penalty`,
            detailed: successMessage
          },
          {
            playerId: snapshotPlayer.id,
            playerName: snapshotPlayer.name,
            actionType: 'tryAgain',
            notificationDuration: 3000
          }
        );
      }

      // 10. Return success - state reversion has reset turn flags automatically
      // Signal that turn should advance after Try Again (player retries NEXT turn)
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
   * Consumes the re-roll ability and returns new dice result
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
    
    // Validate player can re-roll
    if (!currentPlayer.turnModifiers?.canReRoll) {
      throw new Error(`Player ${playerId} does not have re-roll ability`);
    }
    
    // Re-roll ability usage is logged above
    
    // Consume the re-roll ability
    this.stateService.updatePlayer({
      id: playerId,
      turnModifiers: {
        ...currentPlayer.turnModifiers,
        canReRoll: false
      }
    });
    
    // Note: Snapshot already saved after movement, no need to save again
    
    // Roll new dice
    const newDiceRoll = this.rollDice();
    
    // Log re-roll to action history
    this.loggingService.info(`Re-rolled a ${newDiceRoll}`, {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      action: 'dice_roll',
      roll: newDiceRoll,
      space: currentPlayer.currentSpace,
      isReroll: true
    });
    
    // Process effects for new dice roll
    const effects: DiceResultEffect[] = [];
    await this.processTurnEffectsWithTracking(playerId, newDiceRoll, effects);
    
    // Generate summary for new result
    const summary = this.generateEffectSummary(effects, newDiceRoll);
    const hasChoices = effects.some(effect => effect.type === 'choice');
    
    return {
      diceValue: newDiceRoll,
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      hasChoices,
      canReRoll: false // No longer available after use
    };
  }

  /**
   * Roll dice and process effects with detailed feedback for UI
   * Returns comprehensive information about the dice roll and its effects
   */
  async rollDiceWithFeedback(playerId: string): Promise<TurnEffectResult> {
    console.log(`🎲 ROLL_DICE_FEEDBACK: ========== START ==========`);
    console.log(`🎲 ROLL_DICE_FEEDBACK: playerId: ${playerId}`);

    // Note: Snapshot is now saved immediately after movement in MovementService
    // This ensures Try Again always works regardless of when player presses it

    const currentPlayer = this.stateService.getPlayer(playerId);
    console.log(`🎲 ROLL_DICE_FEEDBACK: currentPlayer:`, currentPlayer);

    if (!currentPlayer) {
      console.error(`🎲 ROLL_DICE_FEEDBACK: ERROR - Player ${playerId} not found!`);
      throw new Error(`Player ${playerId} not found`);
    }

    const beforeState = this.stateService.getGameState();
    const beforePlayer = beforeState.players.find(p => p.id === playerId)!;
    console.log(`🎲 ROLL_DICE_FEEDBACK: beforePlayer state:`, {
      space: beforePlayer.currentSpace,
      visitType: beforePlayer.visitType,
      hasRolledDice: beforeState.hasPlayerRolledDice,
      hasMoved: beforeState.hasPlayerMovedThisTurn
    });

    // Roll dice
    console.log(`🎲 ROLL_DICE_FEEDBACK: Calling rollDice()...`);
    const diceRoll = this.rollDice();
    console.log(`🎲 ROLL_DICE_FEEDBACK: Dice roll result: ${diceRoll}`);

    // EffectEngine handles dice roll logging with comprehensive context

    // Note: Dice roll logging now handled above in rollDice action

    // Process effects and track changes
    const effects: DiceResultEffect[] = [];
    console.log(`🎲 ROLL_DICE_FEEDBACK: Calling processTurnEffectsWithTracking...`);
    await this.processTurnEffectsWithTracking(playerId, diceRoll, effects);
    console.log(`🎲 ROLL_DICE_FEEDBACK: Effects after processing:`, effects);
    console.log(`🎲 ROLL_DICE_FEEDBACK: Number of effects: ${effects.length}`);

    // Mark dice roll states
    console.log(`🎲 ROLL_DICE_FEEDBACK: Marking dice as rolled and player as moved...`);
    this.stateService.setPlayerHasRolledDice();
    this.stateService.setPlayerHasMoved();

    // Generate summary
    const summary = this.generateEffectSummary(effects, diceRoll);
    const hasChoices = effects.some(effect => effect.type === 'choice');
    console.log(`🎲 ROLL_DICE_FEEDBACK: Summary: ${summary}`);
    console.log(`🎲 ROLL_DICE_FEEDBACK: hasChoices: ${hasChoices}`);

    // Generate detailed feedback message and store it in state
    const feedbackMessage = formatDiceRollFeedback(diceRoll, effects);
    this.stateService.setDiceRollCompletion(feedbackMessage);

    // Check if player can re-roll (from E066 card effect)
    const canReRoll = currentPlayer.turnModifiers?.canReRoll || false;

    const result = {
      diceValue: diceRoll,
      spaceName: currentPlayer.currentSpace,
      effects,
      summary,
      hasChoices,
      canReRoll
    };

    console.log(`🎲 ROLL_DICE_FEEDBACK: Returning result:`, result);
    console.log(`🎲 ROLL_DICE_FEEDBACK: ========== END ==========`);

    return result;
  }

  /**
   * Process turn effects while tracking changes for feedback
   */
  private async processTurnEffectsWithTracking(playerId: string, diceRoll: number, effects: DiceResultEffect[]): Promise<void> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) return;

    const beforeMoney = currentPlayer.money;
    const beforeTime = currentPlayer.timeSpent;

    // Process effects using the dice-only method and get the generated effects and results
    const { gameState, generatedEffects, effectResults } = await this.processDiceRollEffects(playerId, diceRoll);

    // Convert generated effects to DiceResultEffect format, enriched with card IDs from results
    generatedEffects.forEach((effect, index) => {
      // Get the corresponding result to access card IDs
      const effectResult = effectResults?.results[index];

      if (effect.effectType === 'CARD_DRAW') {
        effects.push({
          type: 'cards',
          description: `Drew ${effect.payload.count} ${this.getCardTypeName(effect.payload.cardType)} card${effect.payload.count > 1 ? 's' : ''}`,
          cardType: effect.payload.cardType,
          cardCount: effect.payload.count,
          cardAction: 'draw',
          cardIds: effectResult?.data?.cardIds || []
        });
      } else if (effect.effectType === 'CARD_DISCARD') {
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
          effects.push({
            type: 'money',
            description: effect.payload.amount > 0 ? 'Received project funding' : 'Paid project costs',
            value: effect.payload.amount
          });
        } else if (effect.payload.resource === 'TIME') {
          effects.push({
            type: 'time',
            description: effect.payload.amount > 0 ? 'Project delayed' : 'Gained efficiency',
            value: effect.payload.amount
          });
        }
      }
      // Skip LOG effects - they're for internal tracking
    });

    // Check for movement choices
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
    } else if (movementRule && movementRule.movement_type === 'dice_outcome') {
        // Handle dice-based movement (e.g., CHEAT-BYPASS)
        // Get destinations from DiceRoll Info.csv based on the dice roll
        const destinations = this.dataService.getDiceRollDestinations(
            currentPlayer.currentSpace,
            currentPlayer.visitType
        );

        if (destinations.length >= diceRoll) {
            // Get the destination for this specific dice roll (1-indexed)
            const destination = destinations[diceRoll - 1];

            if (destination) {
                effects.push({
                    type: 'choice',
                    description: 'Choose your next destination',
                    moveOptions: [destination]
                });

                // Create the movement choice and set player's move intent
                const options = [{
                    id: destination,
                    label: destination
                }];

                const prompt = `Choose your destination from ${currentPlayer.currentSpace}:`;

                // Create the choice (don't await - just set it in state)
                // The UI will show the choice and wait for player selection
                this.choiceService.createChoice(
                    playerId,
                    'MOVEMENT',
                    prompt,
                    options
                ).then(selectedDestination => {
                    console.log(`✅ Player ${currentPlayer.name || playerId} selected destination (dice_outcome): ${selectedDestination}`);
                    this.stateService.setPlayerMoveIntent(playerId, selectedDestination);
                }).catch(error => {
                    // Handle error silently - choice might be resolved later
                    console.log(`🔄 Movement choice created for dice_outcome (will be resolved when player selects destination)`);
                });
            }
        }
    }
  }

  /**
   * Generate a human-readable summary of the effects
   */
  private generateEffectSummary(effects: DiceResultEffect[], diceValue: number): string {
    if (effects.length === 0) {
      return `Rolled ${diceValue} - No special effects this turn.`;
    }

    const summaryParts: string[] = [];
    let hasPositive = false;
    let hasNegative = false;

    effects.forEach(effect => {
      switch (effect.type) {
        case 'money':
          if (effect.value! > 0) {
            summaryParts.push('gained funding');
            hasPositive = true;
          } else {
            summaryParts.push('paid costs');
            hasNegative = true;
          }
          break;
        case 'cards':
          summaryParts.push(`drew ${effect.cardCount} card${effect.cardCount! > 1 ? 's' : ''}`);
          hasPositive = true;
          break;
        case 'time':
          if (effect.value! > 0) {
            summaryParts.push('faced delays');
            hasNegative = true;
          } else {
            summaryParts.push('gained efficiency');
            hasPositive = true;
          }
          break;
        case 'choice':
          summaryParts.push('must choose next move');
          break;
      }
    });

    const tone = hasPositive && !hasNegative ? 'Great roll!' :
                hasNegative && !hasPositive ? 'Challenging turn.' :
                'Mixed results.';

    return `${tone} You ${summaryParts.join(', ')}.`;
  }

  /**
   * Get human-readable name for card type
   */
  private getCardTypeName(cardType: string): string {
    switch (cardType) {
      case 'W': return 'Work';
      case 'B': return 'Business';
      case 'E': return 'Expeditor';
      case 'L': return 'Life Events';
      case 'I': return 'Investment';
      default: return cardType;
    }
  }

  /**
   * Evaluate whether an effect condition is met
   */
  private evaluateEffectCondition(playerId: string, condition: string | undefined, diceRoll?: number): boolean {
    // If no condition is specified, assume it should always apply
    if (!condition || condition.trim() === '') {
      return true;
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      console.warn(`Player ${playerId} not found for condition evaluation`);
      return false;
    }

    const conditionLower = condition.toLowerCase().trim();

    try {
      // Always apply conditions
      if (conditionLower === 'always') {
        return true;
      }

      // Dice roll conditions (used in SPACE_EFFECTS.csv)
      if (conditionLower.startsWith('dice_roll_') && diceRoll !== undefined) {
        const requiredRoll = parseInt(conditionLower.replace('dice_roll_', ''));
        return diceRoll === requiredRoll;
      }

      // Project scope conditions - delegate to GameRulesService (single source of truth)
      if (conditionLower === 'scope_le_4m' || conditionLower === 'scope_gt_4m') {
        return this.gameRulesService.evaluateCondition(playerId, condition, diceRoll);
      }

      // Loan amount conditions
      if (conditionLower.startsWith('loan_')) {
        const playerMoney = player.money || 0;
        
        if (conditionLower === 'loan_up_to_1_4m') {
          return playerMoney <= 1400000; // $1.4M
        }
        if (conditionLower === 'loan_1_5m_to_2_75m') {
          return playerMoney >= 1500000 && playerMoney <= 2750000; // $1.5M to $2.75M
        }
        if (conditionLower === 'loan_above_2_75m') {
          return playerMoney > 2750000; // Above $2.75M
        }
      }

      // Percentage-based conditions (often used in dice effects)
      if (conditionLower.includes('%')) {
        // These are typically values, not conditions - return true for now
        return true;
      }

      // Direction conditions (for card transfer targeting)
      if (conditionLower === 'to_left' || conditionLower === 'to_right') {
        // These are targeting directives, not boolean conditions
        // The actual target resolution happens in EffectEngineService
        // For condition evaluation, we always return true (effect should be processed)
        return true;
      }

      // High/low conditions
      if (conditionLower === 'high') {
        return diceRoll !== undefined && diceRoll >= 4; // 4, 5, 6 are "high"
      }
      
      if (conditionLower === 'low') {
        return diceRoll !== undefined && diceRoll <= 3; // 1, 2, 3 are "low"
      }

      // Amount-based conditions
      if (conditionLower.includes('per_') || conditionLower.includes('of_borrowed_amount')) {
        // These are typically calculation modifiers, not boolean conditions
        return true;
      }

      // Fallback for unknown conditions
      console.warn(`Unknown effect condition: "${condition}" - defaulting to true`);
      return true;

    } catch (error) {
      console.error(`Error evaluating condition "${condition}":`, error);
      return false;
    }
  }

  /**
   * Process space effects for a player after movement (for arrival effects)
   * This is separate from processTurnEffects which processes effects before movement
   */
  private async processSpaceEffectsAfterMovement(playerId: string, spaceName: string, visitType: VisitType, skipLogging: boolean = false): Promise<void> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    console.log(`🏠 Processing arrival space effects for ${currentPlayer.name} at ${spaceName} (${visitType} visit)`);

    try {
      // Check if there's already a snapshot for this player at this same space (multiple Try Again logic)
      const hasSnapshot = this.stateService.hasPreSpaceEffectSnapshot(playerId, spaceName);
      if (hasSnapshot) {
        console.log(`🔄 Snapshot exists for player ${playerId} at ${spaceName} - skipping automatic effects but enabling manual actions`);
        // Still need to calculate manual actions even when snapshot exists
        const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);
        const conditionFilteredEffects = this.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);
        const manualEffects = conditionFilteredEffects.filter(effect => effect.trigger_type === 'manual');

        if (manualEffects.length > 0) {
          console.log(`🎯 Processing ${manualEffects.length} manual effects for ${currentPlayer.name} at ${spaceName}`);
          this.stateService.updateActionCounts();
        }
        return;
      }

      // Get space effect data from DataService for the arrival space
      const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);

      // Filter space effects based on conditions (e.g., scope_le_4M, scope_gt_4M)
      const conditionFilteredEffects = this.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);

      // Check for automatic dice roll scenarios BEFORE filtering out manual effects
      // If the space has requires_dice_roll=false but has a dice_roll_chance effect, automatically trigger it
      const spaceData = this.dataService.getSpaceByName(spaceName);

      if (spaceData?.config && !spaceData.config.requires_dice_roll) {
        const diceRollChanceEffect = conditionFilteredEffects.find(effect =>
          effect.effect_type === 'dice_roll_chance'
        );

        if (diceRollChanceEffect) {
          console.log(`🎲 Automatic dice roll triggered for ${spaceName} (requires_dice_roll=false with dice_roll_chance effect)`);

          // Perform the automatic dice roll
          await this.applyDiceRollChanceEffect(playerId, diceRollChanceEffect);

          // BUG FIX: Do NOT set hasPlayerRolledDice for automatic dice effects
          // This flag should only be set when the player MANUALLY clicks "Roll Dice"
          // Automatic dice effects are just background mechanics, not player actions
          // Setting this flag incorrectly causes the UI to think actions are complete when they're not
        }
      }

      // Filter out manual effects and time effects - manual effects are triggered by buttons, time effects on leaving space
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
   * Place players on their starting spaces without processing effects
   * Effects will be processed when players actually take their first turn
   */
  public async placePlayersOnStartingSpaces(): Promise<void> {
    const gameState = this.stateService.getGameState();
    const players = gameState.players;

    console.log(`🏁 Placing ${players.length} players on starting spaces (no effects processing)`);

    // Simply ensure all players are on their starting space
    // No effects processing - that happens when they take their first turn
    for (const player of players) {
      console.log(`📍 Placing ${player.name} on starting space: ${player.currentSpace}`);

      // Log the initial placement for the Game Log
      this.loggingService.info(`${player.name} placed on starting space: ${player.currentSpace}`, {
        playerId: player.id,
        playerName: player.name,
        action: 'game_start',
        spaceName: player.currentSpace,
        description: 'Initial placement'
      });
    }

    console.log(`✅ All players placed on starting spaces`);
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

    console.log(`🚪 Processing leaving space time effects for ${currentPlayer.name} leaving ${spaceName} (${visitType} visit)`);

    try {
      // Get space effect data from DataService for the current space
      const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);

      // Filter space effects based on conditions and only get time effects
      const conditionFilteredEffects = this.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);
      const timeEffects = conditionFilteredEffects.filter(effect =>
        effect.effect_type === 'time' && effect.trigger_type !== 'manual'
      );

      if (timeEffects.length === 0) {
        console.log(`ℹ️ No time effects for leaving ${spaceName}`);
        return;
      }

      console.log(`⏰ Processing ${timeEffects.length} time effects for leaving ${spaceName}`);

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
        console.log(`ℹ️ No processed time effects for leaving ${spaceName}`);
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
          console.log(`✅ Applied ${result.successfulEffects} time effects for leaving ${spaceName}`);
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
      console.log(`🔄 TurnService.setTurnModifier - Applying ${action} to player ${playerId}`);
      
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
          
          console.log(`✅ Player ${player.name} will skip their next ${newModifiers.skipTurns} turn(s)`);
          
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
   * Filter space effects based on their conditions
   * Evaluates conditions like scope_le_4M, scope_gt_4M, etc.
   */
  /**
   * Filter space effects based on conditions (e.g., scope_le_4M)
   * Public method for UI components to get condition-filtered effects
   * Delegates to GameRulesService for consistent condition evaluation
   */
  public filterSpaceEffectsByCondition(spaceEffects: SpaceEffect[], player: Player): SpaceEffect[] {
    return spaceEffects.filter(effect => {
      return this.gameRulesService.evaluateCondition(player.id, effect.condition);
    });
  }

  /**
   * Handle automatic funding for OWNER-FUND-INITIATION space
   * Awards B card if project scope ≤ $4M, I card otherwise
   */
  async handleAutomaticFunding(playerId: string): Promise<TurnEffectResult> {
    console.log(`💰 TurnService.handleAutomaticFunding - Starting for player ${playerId}`);

    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    if (currentPlayer.currentSpace !== 'OWNER-FUND-INITIATION') {
      throw new Error(`Player is not on OWNER-FUND-INITIATION space`);
    }

    const beforeState = this.stateService.getGameState();

    // Calculate project scope from W cards (single source of truth)
    const projectScope = this.gameRulesService.calculateProjectScope(playerId);

    // Store project scope on player (permanent record)
    this.stateService.updatePlayer({
      id: playerId,
      projectScope: projectScope
    });

    // Determine funding type based on project scope
    const fundingCardType = projectScope <= 4000000 ? 'B' : 'I';
    const fundingDescription = projectScope <= 4000000
      ? `Bank funding approved (scope ≤ $4M)`
      : `Investor funding required (scope > $4M)`;

    console.log(`💰 Project scope: $${projectScope.toLocaleString()}, awarding ${fundingCardType} card`);

    // Draw and automatically play the funding card using atomic method
    try {
      const result = await this.cardService.drawAndApplyCard(
        playerId,
        fundingCardType,
        'auto_funding',
        'Automatic funding for OWNER-FUND-INITIATION space'
      );

      if (!result.success) {
        throw new Error('Failed to draw and apply funding card.');
      }

      console.log(`💰 Automatically awarded and played ${fundingCardType} card: ${result.drawnCardId}`);

      // Mark that player has "rolled dice" to continue turn flow
      this.stateService.setPlayerHasRolledDice();

      const afterState = this.stateService.getGameState();

      // Create effect description for modal feedback
      const effects: DiceResultEffect[] = [{
        type: 'cards',
        description: `${fundingDescription} - ${fundingCardType} card awarded and applied!`,
        cardType: fundingCardType,
        cardCount: 1,
        cardAction: 'draw',
        cardIds: result.drawnCardId ? [result.drawnCardId] : []
      }];

      // Generate detailed feedback message for non-dice action and store it in state
      const feedbackMessage = formatActionFeedback(effects);
      this.stateService.setDiceRollCompletion(feedbackMessage);

      // Send Automatic Funding notification
      if (this.notificationService) {
        this.notificationService.notify(
          {
            short: 'Funding Approved',
            medium: `💰 ${fundingDescription}`,
            detailed: `${currentPlayer.name} received automatic funding: ${fundingDescription}`
          },
          {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            actionType: 'automaticFunding',
            notificationDuration: 3000
          }
        );
      }

      return {
        diceValue: 0, // No actual dice roll
        spaceName: currentPlayer.currentSpace,
        effects: effects,
        summary: fundingDescription,
        hasChoices: false,
        canReRoll: false
      };

    } catch (error) {
      console.error(`❌ Error in automatic funding:`, error);
      throw new Error(`Failed to process automatic funding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}