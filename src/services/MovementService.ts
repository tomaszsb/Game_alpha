// src/services/MovementService.ts

import { IMovementService, IDataService, IStateService, IChoiceService, ILoggingService, IGameRulesService } from '../types/ServiceContracts';
import { GameState, Player } from '../types/StateTypes';
import { Movement, VisitType } from '../types/DataTypes';

/**
 * Movement timing configuration for smooth state transitions
 */
const MOVEMENT_TIMING = {
  /** Delay before starting movement (allows UI to prepare) */
  PRE_MOVEMENT_DELAY: 50,
  /** Delay during movement animation */
  MOVEMENT_ANIMATION_DELAY: 150,
  /** Delay after movement (allows UI to settle) */
  POST_MOVEMENT_DELAY: 50,
  /** Timeout for movement operations to prevent hanging */
  MOVEMENT_TIMEOUT: 5000
} as const;

/**
 * MovementService handles all player movement logic.
 * This is a stateless service that orchestrates movement validation and execution.
 *
 * Enhanced with smooth state transitions and improved timing for better feel.
 */
export class MovementService implements IMovementService {
  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private choiceService: IChoiceService,
    private loggingService: ILoggingService,
    private gameRulesService: IGameRulesService
  ) {}

  /**
   * Gets all valid destination spaces for a player from their current position
   * @param playerId - The ID of the player
   * @returns Array of valid destination space names
   * @throws Error if player not found or no movement data available
   *
   * Enhanced with better validation and edge case handling.
   */
  getValidMoves(playerId: string): string[] {
    // Validate input
    if (!playerId || playerId.trim() === '') {
      throw new Error('Invalid playerId: must be a non-empty string');
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    // Validate player state
    if (!player.currentSpace || player.currentSpace.trim() === '') {
      console.warn(`Player ${playerId} has invalid currentSpace: "${player.currentSpace}"`);
      return [];
    }

    const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
    if (!movement) {
      console.warn(`No movement data found for space ${player.currentSpace} with visit type ${player.visitType}`);
      return [];
    }

    // Handle different movement types
    try {
      let validMoves: string[] = [];

      if (movement.movement_type === 'dice') {
        validMoves = this.getDiceDestinations(player.currentSpace, player.visitType);
      } else if (movement.movement_type === 'logic') {
        validMoves = this.getLogicDestinations(playerId, movement);
      } else {
        validMoves = this.extractDestinationsFromMovement(movement);
      }

      // SPECIAL HANDLING: Path choice memory for spaces that lock decisions
      // REG-DOB-TYPE-SELECT: Once player chooses Plan Exam vs Prof Cert, choice is locked
      if (player.currentSpace === 'REG-DOB-TYPE-SELECT' &&
          player.visitType === 'Subsequent' &&
          player.pathChoiceMemory?.['REG-DOB-TYPE-SELECT']) {

        const rememberedChoice = player.pathChoiceMemory['REG-DOB-TYPE-SELECT'];
        validMoves = validMoves.filter(dest => dest === rememberedChoice);

        console.log(`🔒 REG-DOB-TYPE-SELECT: Filtering to remembered choice: ${rememberedChoice}`);
      }

      return validMoves;
    } catch (error) {
      console.error(`Error getting valid moves for player ${playerId}:`, error);
      return [];
    }
  }

  /**
   * Moves a player to a destination space using validate → execute → finalize pattern
   * @param playerId - The ID of the player to move
   * @param destinationSpace - The target space name
   * @returns Updated game state after the move
   * @throws Error if move is invalid or player not found
   */
  async movePlayer(playerId: string, destinationSpace: string): Promise<GameState> {
    // PHASE 1: VALIDATE - Check everything before making any changes
    const moveValidation = this.validateMove(playerId, destinationSpace);

    // PHASE 2: EXECUTE - Perform the actual movement
    const moveResult = this.executeMove(moveValidation);

    // PHASE 3: FINALIZE - Write state, log completion, cleanup
    return this.finalizeMove(moveResult);
  }

  /**
   * Phase 1: Validate move before execution
   * @private
   *
   * Enhanced with comprehensive validation and edge case handling.
   */
  private validateMove(playerId: string, destinationSpace: string) {
    console.log(`🔍 Validating move: ${playerId} → ${destinationSpace}`);

    // Validate inputs
    if (!playerId || playerId.trim() === '') {
      throw new Error('Invalid playerId: must be a non-empty string');
    }
    if (!destinationSpace || destinationSpace.trim() === '') {
      throw new Error('Invalid destinationSpace: must be a non-empty string');
    }

    // Validate player exists
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    // Validate player has a current space
    if (!player.currentSpace || player.currentSpace.trim() === '') {
      throw new Error(`Player ${playerId} has invalid current space`);
    }

    // Prevent moving to the same space (edge case)
    if (player.currentSpace === destinationSpace) {
      console.warn(`Player ${playerId} attempting to move to current space ${destinationSpace}`);
      // Allow this but log it - some game mechanics might require it
    }

    // Validate move is legal
    const validMoves = this.getValidMoves(playerId);
    if (!validMoves.includes(destinationSpace)) {
      const validMovesStr = validMoves.length > 0 ? validMoves.join(', ') : 'none';
      throw new Error(
        `Invalid move: ${destinationSpace} is not a valid destination from ${player.currentSpace}. ` +
        `Valid destinations: ${validMovesStr}`
      );
    }

    // Determine visit type for destination space
    const newVisitType: VisitType = this.hasPlayerVisitedSpace(player, destinationSpace)
      ? 'Subsequent'
      : 'First';

    // Update visited spaces array if this is a first visit
    // Ensure we maintain immutability and prevent duplicates
    const updatedVisitedSpaces = newVisitType === 'First'
      ? [...player.visitedSpaces, destinationSpace]
      : player.visitedSpaces;

    console.log(`✅ Move validation passed: ${player.name} ${player.currentSpace} → ${destinationSpace} (${newVisitType})`);

    return {
      player,
      destinationSpace,
      sourceSpace: player.currentSpace,
      newVisitType,
      updatedVisitedSpaces
    };
  }

  /**
   * Phase 2: Execute the movement (prepare changes, no state writes yet)
   * @private
   */
  private executeMove(moveValidation: any) {
    const { player, destinationSpace, sourceSpace, newVisitType, updatedVisitedSpaces } = moveValidation;

    console.log(`⚡ Executing move: ${player.name} ${sourceSpace} → ${destinationSpace}`);

    // Prepare the player update object (don't write to state yet)
    const playerUpdate = {
      id: player.id,
      currentSpace: destinationSpace,
      visitType: newVisitType,
      visitedSpaces: updatedVisitedSpaces
    };

    return {
      player,
      playerUpdate,
      sourceSpace,
      destinationSpace,
      newVisitType
    };
  }

  /**
   * Phase 3: Finalize move (write state, log, cleanup)
   * @private
   */
  private finalizeMove(moveResult: any): GameState {
    const { player, playerUpdate, sourceSpace, destinationSpace, newVisitType } = moveResult;

    console.log(`📝 Finalizing move: ${player.name} ${sourceSpace} → ${destinationSpace}`);

    // SPECIAL: Store path choice memory for REG-DOB-TYPE-SELECT
    // Per DOB rules, once you choose Plan Exam vs Prof Cert, you're locked in for this application
    if (sourceSpace === 'REG-DOB-TYPE-SELECT' &&
        player.visitType === 'First' &&
        (destinationSpace === 'REG-DOB-PLAN-EXAM' || destinationSpace === 'REG-DOB-PROF-CERT')) {

      console.log(`🔒 Storing REG-DOB-TYPE-SELECT path choice: ${destinationSpace}`);

      // Store the choice in player's memory
      playerUpdate.pathChoiceMemory = {
        ...player.pathChoiceMemory,
        'REG-DOB-TYPE-SELECT': destinationSpace as 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT'
      };
    }

    // WRITE STATE: Update player's position (atomic operation)
    const updatedState = this.stateService.updatePlayer(playerUpdate);

    // LOG COMPLETION: Record the movement
    this.loggingService.info(`Moved from ${sourceSpace} to ${destinationSpace}`, {
      playerId: player.id,
      playerName: player.name,
      action: 'player_movement',
      sourceSpace: sourceSpace,
      destinationSpace: destinationSpace,
      visitType: newVisitType
    });

    // CLEANUP: Clear any existing snapshot for this player
    this.stateService.clearPlayerSnapshot(player.id);

    console.log(`✅ Move completed: ${player.name} now at ${destinationSpace}`);

    // Note: Movement is complete. Caller should now call endMove() to process arrival
    return updatedState;
  }

  /**
   * Complete the movement and trigger arrival processing
   * This should be called after movePlayer() to handle space effects
   */
  async endMove(playerId: string): Promise<GameState> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    console.log(`🏁 Ending move: ${player.name} at ${player.currentSpace} - triggering arrival processing`);

    // Note: Space entry logging moved to TurnService.startTurn to ensure proper action sequence

    // Return current state - space effects will be processed by TurnService
    // This creates a clear separation: MovementService handles movement, TurnService handles effects
    return this.stateService.getGameState();
  }

  /**
   * Extracts valid destinations from movement data
   * @private
   */
  private extractDestinationsFromMovement(movement: Movement): string[] {
    // For 'none' movement type, return empty array (terminal space)
    if (movement.movement_type === 'none') {
      return [];
    }

    const destinations: string[] = [];
    
    // Collect all non-empty values from destination_1 through destination_5
    if (movement.destination_1) destinations.push(movement.destination_1);
    if (movement.destination_2) destinations.push(movement.destination_2);
    if (movement.destination_3) destinations.push(movement.destination_3);
    if (movement.destination_4) destinations.push(movement.destination_4);
    if (movement.destination_5) destinations.push(movement.destination_5);

    return destinations;
  }

  /**
   * Gets destinations for dice-based movement
   * Handles "or" choices by splitting them into individual destinations
   * @private
   */
  private getDiceDestinations(spaceName: string, visitType: VisitType): string[] {
    const diceOutcome = this.dataService.getDiceOutcome(spaceName, visitType);
    if (!diceOutcome) {
      return [];
    }

    const destinations: string[] = [];
    if (diceOutcome.roll_1) destinations.push(diceOutcome.roll_1);
    if (diceOutcome.roll_2) destinations.push(diceOutcome.roll_2);
    if (diceOutcome.roll_3) destinations.push(diceOutcome.roll_3);
    if (diceOutcome.roll_4) destinations.push(diceOutcome.roll_4);
    if (diceOutcome.roll_5) destinations.push(diceOutcome.roll_5);
    if (diceOutcome.roll_6) destinations.push(diceOutcome.roll_6);

    // Filter out empty strings
    const filteredDests = destinations.filter(dest => dest && dest.trim() !== '');

    // Handle "or" choices by splitting them
    // e.g., "ENG-INITIATION or PM-DECISION-CHECK" becomes two separate destinations
    const expandedDests: string[] = [];
    filteredDests.forEach(dest => {
      if (dest.includes(' or ')) {
        const choices = dest.split(' or ').map(d => d.trim()).filter(d => d);
        expandedDests.push(...choices);
      } else {
        expandedDests.push(dest);
      }
    });

    // Remove duplicates
    const uniqueDests: string[] = [];
    expandedDests.forEach(dest => {
      if (!uniqueDests.includes(dest)) {
        uniqueDests.push(dest);
      }
    });

    console.log(`🎲 Dice destinations for ${spaceName} (${visitType}): ${uniqueDests.join(', ')}`);
    return uniqueDests;
  }

  /**
   * Gets the destination for a dice-based movement
   * @param spaceName - The current space name
   * @param visitType - The visit type (First/Subsequent)
   * @param diceRoll - The dice roll result (2-12)
   * @returns The destination space name or null if no destination for this roll
   */
  getDiceDestination(spaceName: string, visitType: VisitType, diceRoll: number): string | null {
    // Validate dice roll range first (before calling dataService)
    if (diceRoll < 2 || diceRoll > 12) {
      return null;
    }

    const diceOutcome = this.dataService.getDiceOutcome(spaceName, visitType);
    if (!diceOutcome) {
      return null;
    }

    // Map dice roll total to appropriate roll field
    // For two-dice games, we typically map the sum modulo 6, or use a lookup table
    // This is a simplified mapping - actual game rules may vary
    
    // Map dice total (2-12) to roll fields (1-6)
    // Simple modulo mapping: (diceRoll - 2) % 6 + 1 gives us 1-6
    const rollIndex = ((diceRoll - 2) % 6) + 1;
    const rollField = `roll_${rollIndex}` as keyof typeof diceOutcome;

    const destination = diceOutcome[rollField];
    return destination && destination.trim() !== '' ? destination : null;
  }

  /**
   * Handles movement choices by presenting options and awaiting player selection
   * @param playerId - The ID of the player making the choice
   * @returns Promise that resolves with the updated game state after movement
   *
   * Enhanced with improved timing and smooth state transitions.
   */
  async handleMovementChoiceV2(playerId: string): Promise<GameState> {
    // Validate input
    if (!playerId || playerId.trim() === '') {
      throw new Error('Invalid playerId: must be a non-empty string');
    }

    const validMoves = this.getValidMoves(playerId);

    if (validMoves.length === 0) {
      throw new Error(`No valid moves available for player ${playerId}`);
    }

    if (validMoves.length === 1) {
      // Only one option - move automatically without presenting a choice
      console.log(`🚶 Auto-moving player ${playerId} to ${validMoves[0]} (only option)`);

      // Use smooth timing even for auto-moves
      this.stateService.setMoving(true);

      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const result = await this.movePlayer(playerId, validMoves[0]);
            // Add a small delay after movement for UI to settle
            setTimeout(() => {
              this.stateService.setMoving(false);
              resolve(result);
            }, MOVEMENT_TIMING.POST_MOVEMENT_DELAY);
          } catch (error) {
            this.stateService.setMoving(false);
            reject(error);
          }
        }, MOVEMENT_TIMING.PRE_MOVEMENT_DELAY);
      });
    }

    // Multiple options - present choice to player
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const options = validMoves.map(destination => ({
      id: destination,
      label: destination
    }));

    const prompt = `Choose your destination from ${player.currentSpace}:`;

    console.log(`🎯 Presenting movement choice to ${player.name}: ${validMoves.length} options`);

    // Use ChoiceService to handle the choice
    const selectedDestination = await this.choiceService.createChoice(
      playerId,
      'MOVEMENT',
      prompt,
      options
    );

    console.log(`✅ Player ${player.name} chose to move to: ${selectedDestination}`);

    // Set the moving flag with pre-movement delay to allow UI to prepare
    this.stateService.setMoving(true);

    // Enhanced timing: Use configurable delays for smoother transitions
    // This ensures React has time to render state changes at each phase
    console.log(`🕐 MOVEMENT START: Preparing UI for movement (${MOVEMENT_TIMING.PRE_MOVEMENT_DELAY}ms)`);

    return new Promise((resolve, reject) => {
      // Phase 1: Pre-movement delay (UI preparation)
      setTimeout(async () => {
        console.log(`🕐 MOVEMENT EXECUTING: UI prepared, executing move (${MOVEMENT_TIMING.MOVEMENT_ANIMATION_DELAY}ms animation)`);

        try {
          // Phase 2: Execute movement
          const result = await this.movePlayer(playerId, selectedDestination);

          // Phase 3: Post-movement delay (UI settling)
          setTimeout(() => {
            console.log(`🕐 MOVEMENT COMPLETE: Movement finished, UI settling (${MOVEMENT_TIMING.POST_MOVEMENT_DELAY}ms)`);
            this.stateService.clearAwaitingChoice();

            // Final phase: Clear moving flag and resolve
            setTimeout(() => {
              this.stateService.setMoving(false);
              console.log(`✅ MOVEMENT FINALIZED: All state updates complete`);
              resolve(result);
            }, MOVEMENT_TIMING.POST_MOVEMENT_DELAY);
          }, MOVEMENT_TIMING.MOVEMENT_ANIMATION_DELAY);

        } catch (error) {
          console.error(`❌ MOVEMENT ERROR:`, error);
          this.stateService.clearAwaitingChoice();
          this.stateService.setMoving(false);
          reject(error);
        }
      }, MOVEMENT_TIMING.PRE_MOVEMENT_DELAY);
    });
  }

  /**
   * Legacy method - calls the new V2 implementation
   */
  async handleMovementChoice(playerId: string): Promise<GameState> {
    return this.handleMovementChoiceV2(playerId);
  }

  /**
   * Checks if a player has previously visited a space
   * @private
   */
  private hasPlayerVisitedSpace(player: Player, spaceName: string): boolean {
    // Use the proper visitedSpaces tracking instead of faulty heuristics
    return player.visitedSpaces.includes(spaceName);
  }

  /**
   * Gets valid destinations for logic-based movement by evaluating conditions
   * @private
   */
  private getLogicDestinations(playerId: string, movement: Movement): string[] {
    const validDestinations: string[] = [];
    
    // Check each destination and its corresponding condition
    const destinationConditionPairs = [
      { destination: movement.destination_1, condition: movement.condition_1 },
      { destination: movement.destination_2, condition: movement.condition_2 },
      { destination: movement.destination_3, condition: movement.condition_3 },
      { destination: movement.destination_4, condition: movement.condition_4 },
      { destination: movement.destination_5, condition: movement.condition_5 }
    ];

    for (const pair of destinationConditionPairs) {
      if (pair.destination && this.evaluateCondition(playerId, pair.condition)) {
        validDestinations.push(pair.destination);
      }
    }

    console.log(`🧠 Logic-based movement for player ${playerId}: ${validDestinations.length} valid destinations`);
    return validDestinations;
  }

  /**
   * Evaluates a movement condition against the current player's state
   * @private
   */
  private evaluateCondition(playerId: string, condition: string | undefined): boolean {
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

      // Project scope conditions - delegate to GameRulesService (single source of truth)
      if (conditionLower === 'scope_le_4m' || conditionLower === 'scope_gt_4m') {
        return this.gameRulesService.evaluateCondition(playerId, condition);
      }

      // Money-based conditions
      if (conditionLower.startsWith('money_')) {
        const playerMoney = player.money || 0;
        
        if (conditionLower === 'money_le_1m') {
          return playerMoney <= 1000000; // $1M
        }
        if (conditionLower === 'money_gt_1m') {
          return playerMoney > 1000000; // $1M
        }
        if (conditionLower === 'money_le_2m') {
          return playerMoney <= 2000000; // $2M
        }
        if (conditionLower === 'money_gt_2m') {
          return playerMoney > 2000000; // $2M
        }
      }

      // Time-based conditions
      if (conditionLower.startsWith('time_')) {
        const timeSpent = player.timeSpent || 0;
        
        if (conditionLower === 'time_le_5') {
          return timeSpent <= 5;
        }
        if (conditionLower === 'time_gt_5') {
          return timeSpent > 5;
        }
        if (conditionLower === 'time_le_10') {
          return timeSpent <= 10;
        }
        if (conditionLower === 'time_gt_10') {
          return timeSpent > 10;
        }
      }

      // Card count conditions
      if (conditionLower.startsWith('cards_')) {
        const handSize = player.hand?.length || 0;
        
        if (conditionLower === 'cards_le_3') {
          return handSize <= 3;
        }
        if (conditionLower === 'cards_gt_3') {
          return handSize > 3;
        }
        if (conditionLower === 'cards_le_5') {
          return handSize <= 5;
        }
        if (conditionLower === 'cards_gt_5') {
          return handSize > 5;
        }
      }

      console.warn(`🧠 Unknown movement condition: ${condition}`);
      return false;
      
    } catch (error) {
      console.error(`🧠 Error evaluating movement condition "${condition}":`, error);
      return false;
    }
  }

}