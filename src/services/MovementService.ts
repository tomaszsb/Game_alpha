// src/services/MovementService.ts

import { IMovementService, IDataService, IStateService, IChoiceService, ILoggingService, IGameRulesService, INotificationService, IApprovalService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { shortName } from '../utils/boardCommon';
import { friendlySpaceName } from '../utils/logFormatting';
import { GameState, Player, PlayerUpdateData } from '../types/StateTypes';
import { Movement, VisitType, LogicQuestion } from '../types/DataTypes';

/**
 * Result of creating a movement choice
 */
export interface MovementChoiceResult {
  choiceCreated: boolean;
  autoSelected?: string;
  reason: string;
}

/**
 * Options for creating movement choices
 */
export interface MovementChoiceOptions {
  isRestoration?: boolean;
  skipLogging?: boolean;
}

/**
 * Internal interface for move result passed between phases
 */
interface MoveResult {
  player: Player;
  playerUpdate: PlayerUpdateData;
  sourceSpace: string;
  destinationSpace: string;
  newVisitType: VisitType;
}

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
  private notificationService?: INotificationService;

  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private choiceService: IChoiceService,
    private loggingService: ILoggingService,
    private gameRulesService: IGameRulesService,
    private approvalService?: IApprovalService,
    notificationService?: INotificationService
  ) {
    this.notificationService = notificationService;
  }

  /**
   * Set notification service (for dependency injection after construction)
   */
  public setNotificationService(service: INotificationService): void {
    this.notificationService = service;
  }

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
      debugWarn(`Player ${playerId} has invalid currentSpace: "${player.currentSpace}"`);
      return [];
    }

    const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
    if (!movement) {
      debugWarn(`No movement data found for space ${player.currentSpace} with visit type ${player.visitType}`);
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

      // SPECIAL HANDLING: Path-choice lock point Subsequent-visit filter.
      // Workstream 6 #4: lifted from `=== 'REG-DOB-TYPE-SELECT'` to data flags.
      // When the player visits a lock-point space a second time, restrict valid
      // moves to whatever destination they chose at the First visit. The
      // memory key is configured per-space in Spaces.csv.
      if (this.dataService.isPathChoiceLockPoint(player.currentSpace) &&
          player.visitType === 'Subsequent') {
        const memoryKey = this.dataService.getPathChoiceMemoryKey(player.currentSpace);
        const rememberedChoice = memoryKey ? player.pathChoiceMemory?.[memoryKey] : undefined;
        if (rememberedChoice) {
          validMoves = validMoves.filter(dest => dest === rememberedChoice);
        }
      }

      // SPECIAL HANDLING: Resume from side quest at a resume-hub space.
      // Workstream 7: previously read `mainPathResumePoint` and called
      // `extractDestinationsFromMovement` on its Movement row. That silently
      // returned [] for dice/logic-typed resume points (REG-FDNY-PLAN-EXAM,
      // REG-FDNY-FEE-REVIEW) because those destinations live in DICE_OUTCOMES.csv
      // / LOGIC_QUESTIONS.csv, not destination_1..5. The new approach reads the
      // destinations the examiner already granted the player (stored in
      // dobApprovedDestinations / fdnyApprovedDestinations by ApprovalService at
      // dice-resolution time), so the player can continue from any current
      // approval — regardless of movement type at the source space.
      if (this.dataService.isResumeHub(player.currentSpace) &&
          !player.hasUsedCheatBypass &&
          this.approvalService) {
        const approvedDestinations = this.approvalService.getApprovedDestinations(player)
          // Don't loop back to the hub the player is currently at, and don't
          // duplicate destinations already in the hub's own valid-move list.
          .filter(dest => dest !== player.currentSpace && !validMoves.includes(dest));
        validMoves = [...validMoves, ...approvedDestinations];
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
    const finalState = this.finalizeMove(moveResult);
    
    // Clear move intent after successful movement
    this.stateService.clearPlayerMoveIntent(playerId);
    
    return finalState;
  }

  /**
   * Phase 1: Validate move before execution
   * @private
   *
   * Enhanced with comprehensive validation and edge case handling.
   */
  private validateMove(playerId: string, destinationSpace: string) {

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
      debugWarn(`Player ${playerId} attempting to move to current space ${destinationSpace}`);
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
  private executeMove(moveValidation: {
    player: Player;
    destinationSpace: string;
    sourceSpace: string;
    newVisitType: VisitType;
    updatedVisitedSpaces: string[];
  }): MoveResult {
    const { player, destinationSpace, sourceSpace, newVisitType, updatedVisitedSpaces } = moveValidation;


    // Prepare the player update object (don't write to state yet)
    // Use PlayerUpdateData type to ensure all optional properties can be added later
    const playerUpdate: PlayerUpdateData = {
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
  private finalizeMove(moveResult: MoveResult): GameState {
    const { player, playerUpdate, sourceSpace, destinationSpace, newVisitType } = moveResult;


    // Update spaceVisitLog: close previous space entry and add new one
    const gameState = this.stateService.getGameState();
    const currentTurn = gameState.turn || 1;
    const currentTime = player.timeSpent || 0;

    // Get existing spaceVisitLog or create empty array
    const existingLog = player.spaceVisitLog || [];
    const updatedLog = [...existingLog];

    // Close the previous space entry (find the most recent entry for sourceSpace without exitTime)
    const lastEntryIndex = updatedLog.length - 1;
    if (lastEntryIndex >= 0 && updatedLog[lastEntryIndex].spaceName === sourceSpace && !updatedLog[lastEntryIndex].exitTime) {
      const entryTime = updatedLog[lastEntryIndex].entryTime || 0;
      updatedLog[lastEntryIndex] = {
        ...updatedLog[lastEntryIndex],
        exitTime: currentTime,
        exitTurn: currentTurn,
        daysSpent: currentTime - entryTime
      };
    }

    // Add new entry for destination space
    updatedLog.push({
      spaceName: destinationSpace,
      entryTurn: currentTurn,
      entryTime: currentTime,
      daysSpent: 0
    });

    // Add spaceVisitLog to playerUpdate
    playerUpdate.spaceVisitLog = updatedLog;

    // SPECIAL: Store path choice when leaving a lock-point space for the first time.
    // Workstream 6 #4: lifted from hardcoded REG-DOB-TYPE-SELECT + literal-typed
    // destination check. The destination_check that was previously inline (Plan
    // Exam vs Prof Cert) is now implicit — the destination must be in the
    // space's valid moves to even reach this code path, so any chosen
    // destination is by definition a valid lock-in.
    if (this.dataService.isPathChoiceLockPoint(sourceSpace) && player.visitType === 'First') {
      const memoryKey = this.dataService.getPathChoiceMemoryKey(sourceSpace);
      if (memoryKey) {
        playerUpdate.pathChoiceMemory = {
          ...player.pathChoiceMemory,
          [memoryKey]: destinationSpace
        };
      }
    }

    // SPECIAL: Track main-path resume point for side quest return
    // When arriving at a resume-hub space, check if we came from a main-path
    // space. If so, store the source as the resume point so we can offer its
    // destinations when the player returns from a side quest (funding, etc.).
    // Workstream 6 #5: lifted from `=== 'PM-DECISION-CHECK'` to is_resume_hub flag.
    if (this.dataService.isResumeHub(destinationSpace)) {
      const sourceConfig = this.dataService.getGameConfigBySpace(sourceSpace);
      const sourcePath = sourceConfig?.path_type?.toLowerCase() || '';
      if (sourcePath === 'main') {
        playerUpdate.mainPathResumePoint = sourceSpace;
      }
    }

    // SPECIAL: Point-of-no-return spaces (e.g. CHEAT-BYPASS) — clear the resume
    // point and permanently disable future resume-from-side-quest behavior.
    // Workstream 6 #6: lifted from `=== 'CHEAT-BYPASS'` to is_point_of_no_return flag.
    if (this.dataService.isPointOfNoReturn(destinationSpace)) {
      playerUpdate.hasUsedCheatBypass = true;
      playerUpdate.mainPathResumePoint = null; // Clear resume point
    }

    // DEBUG: Verify playerUpdate contains spaceVisitLog before calling updatePlayer

    // WRITE STATE: Update player's position (atomic operation)
    const updatedState = this.stateService.updatePlayer(playerUpdate);

    // LOG COMPLETION: Record the movement
    const fromFriendly = friendlySpaceName(this.dataService, sourceSpace);
    const toFriendly = friendlySpaceName(this.dataService, destinationSpace);
    this.loggingService.info(`Moved from ${fromFriendly} to ${toFriendly}`, {
      playerId: player.id,
      playerName: player.name,
      action: 'player_movement',
      sourceSpace: sourceSpace,
      destinationSpace: destinationSpace,
      visitType: newVisitType
    });

    // Note: REAL/TEMP state model handles state cleanup at turn boundaries
    // No manual snapshot clearing needed


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

    return uniqueDests;
  }

  /**
   * Gets the specific destination for a dice roll result
   * @param spaceName - The current space name
   * @param visitType - The visit type (First/Subsequent)
   * @param diceRoll - The dice roll result (1-6)
   * @returns The destination space name or null if no destination for this roll
   */
  getDiceDestination(spaceName: string, visitType: VisitType, diceRoll: number): string | null {
    // Validate dice roll range (single die: 1-6)
    if (diceRoll < 1 || diceRoll > 6) {
      debugWarn(`Invalid dice roll: ${diceRoll}. Must be 1-6.`);
      return null;
    }

    const diceOutcome = this.dataService.getDiceOutcome(spaceName, visitType);
    if (!diceOutcome) {
      debugWarn(`No dice outcome data for ${spaceName} (${visitType})`);
      return null;
    }

    // Map dice roll (1-6) directly to roll fields
    let destination: string | null = null;
    switch (diceRoll) {
      case 1: destination = diceOutcome.roll_1 || null; break;
      case 2: destination = diceOutcome.roll_2 || null; break;
      case 3: destination = diceOutcome.roll_3 || null; break;
      case 4: destination = diceOutcome.roll_4 || null; break;
      case 5: destination = diceOutcome.roll_5 || null; break;
      case 6: destination = diceOutcome.roll_6 || null; break;
      default: destination = null;
    }

    // Handle "or" choices - return first option (caller should present choice if needed)
    if (destination && destination.includes(' or ')) {
      const choices = destination.split(' or ').map(d => d.trim()).filter(d => d);
      destination = choices[0] || null;
    } else {
    }

    return destination && destination.trim() !== '' ? destination : null;
  }

  /**
   * Gets all destination choices for a dice roll result (handles "or" options)
   * @param spaceName - The current space name
   * @param visitType - The visit type (First/Subsequent)
   * @param diceRoll - The dice roll result (1-6)
   * @returns Array of destination space names (multiple if "or" choices exist)
   */
  getDiceDestinationChoices(spaceName: string, visitType: VisitType, diceRoll: number, playerId?: string): string[] {
    // Validate dice roll range (single die: 1-6)
    if (diceRoll < 1 || diceRoll > 6) {
      debugWarn(`Invalid dice roll: ${diceRoll}. Must be 1-6.`);
      return [];
    }

    const diceOutcome = this.dataService.getDiceOutcome(spaceName, visitType);
    if (!diceOutcome) {
      debugWarn(`No dice outcome data for ${spaceName} (${visitType})`);
      return [];
    }

    // Map dice roll (1-6) directly to roll fields
    let destinationStr: string | null = null;
    switch (diceRoll) {
      case 1: destinationStr = diceOutcome.roll_1 || null; break;
      case 2: destinationStr = diceOutcome.roll_2 || null; break;
      case 3: destinationStr = diceOutcome.roll_3 || null; break;
      case 4: destinationStr = diceOutcome.roll_4 || null; break;
      case 5: destinationStr = diceOutcome.roll_5 || null; break;
      case 6: destinationStr = diceOutcome.roll_6 || null; break;
      default: destinationStr = null;
    }

    if (!destinationStr || destinationStr.trim() === '') {
      return [];
    }

    // Handle "or" choices - return options for player to choose
    // For PASS outcomes at dice-based spaces, player chooses their next destination
    if (destinationStr.includes(' or ')) {
      let choices = destinationStr.split(' or ').map(d => d.trim()).filter(d => d);

      // FILTER based on path-choice memory exclusions (cross-space).
      // Workstream 6 #4: lifted from hardcoded REG-FDNY-PLAN-EXAM + DOB-path
      // switch. PATH_CHOICE_RULES.csv now drives this — any (space, memory_key,
      // chosen_value, excluded_destination) row applies. Educators can add new
      // cross-space exclusions purely via data.
      if (playerId) {
        const player = this.stateService.getPlayer(playerId);
        if (player) {
          const exclusions = this.dataService.getPathChoiceExclusions(spaceName, player.pathChoiceMemory);
          if (exclusions.length > 0) {
            choices = choices.filter(c => !exclusions.includes(c));
          }
        }
      }

      return choices;
    }

    return [destinationStr.trim()];
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


    // Use ChoiceService to handle the choice
    const selectedDestination = await this.choiceService.createChoice(
      playerId,
      'MOVEMENT',
      prompt,
      options
    );


    // Set the moving flag with pre-movement delay to allow UI to prepare
    this.stateService.setMoving(true);

    // Enhanced timing: Use configurable delays for smoother transitions
    // This ensures React has time to render state changes at each phase

    return new Promise((resolve, reject) => {
      // Phase 1: Pre-movement delay (UI preparation)
      setTimeout(async () => {

        try {
          // Phase 2: Execute movement
          const result = await this.movePlayer(playerId, selectedDestination);

          // Phase 3: Post-movement delay (UI settling)
          setTimeout(() => {
            this.stateService.clearAwaitingChoice();

            // Final phase: Clear moving flag and resolve
            setTimeout(() => {
              this.stateService.setMoving(false);
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

    return validDestinations;
  }

  /**
   * Gets logic-based movement results with explanation of which conditions matched
   * Used to show players WHY they're being directed to a specific destination
   * @param playerId - The ID of the player
   * @param spaceName - The current space name
   * @param visitType - The visit type
   * @returns Object with destination and explanation of matching conditions
   */
  public getLogicMovementWithExplanation(playerId: string, spaceName: string, visitType: VisitType): {
    destinations: string[];
    explanation: string;
    matchedConditions: string[];
  } {
    const movement = this.dataService.getMovement(spaceName, visitType);
    if (!movement || movement.movement_type !== 'logic') {
      return { destinations: [], explanation: '', matchedConditions: [] };
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return { destinations: [], explanation: '', matchedConditions: [] };
    }

    const validDestinations: string[] = [];
    const matchedConditions: string[] = [];

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
        if (pair.condition && pair.condition !== 'always') {
          matchedConditions.push(pair.condition);
        }
      }
    }

    // Generate human-readable explanation for the conditions
    const explanation = this.generateConditionExplanation(playerId, matchedConditions);

    return { destinations: validDestinations, explanation, matchedConditions };
  }

  /**
   * Generates a human-readable explanation for matched conditions
   * @private
   */
  private generateConditionExplanation(playerId: string, conditions: string[]): string {
    if (conditions.length === 0) {
      return 'Based on standard review procedures';
    }

    const player = this.stateService.getPlayer(playerId);
    const explanations: string[] = [];

    for (const condition of conditions) {
      const conditionLower = condition.toLowerCase();

      if (conditionLower === 'scope_le_4m') {
        const projectScope = player?.projectScope || 0;
        explanations.push(`project scope ($${(projectScope / 1000000).toFixed(1)}M) is ≤ $4M`);
      } else if (conditionLower === 'scope_gt_4m') {
        const projectScope = player?.projectScope || 0;
        explanations.push(`project scope ($${(projectScope / 1000000).toFixed(1)}M) exceeds $4M`);
      } else if (conditionLower === 'money_le_1m') {
        explanations.push('available funds are ≤ $1M');
      } else if (conditionLower === 'money_gt_1m') {
        explanations.push('available funds exceed $1M');
      } else if (conditionLower.startsWith('time_')) {
        explanations.push('time constraints apply');
      }
    }

    if (explanations.length === 0) {
      return 'Based on project review';
    }

    return `Because your ${explanations.join(' and ')}`;
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
      debugWarn(`Player ${playerId} not found for condition evaluation`);
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

      debugWarn(`🧠 Unknown movement condition: ${condition}`);
      return false;

    } catch (error) {
      console.error(`🧠 Error evaluating movement condition "${condition}":`, error);
      return false;
    }
  }

  // ========================================================================
  // Movement Choice Management (merged from MovementChoiceManager)
  // ========================================================================

  /**
   * Check if a space uses dice-based movement (requires skipping choice creation here)
   */
  public isDiceBasedMovement(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;

    const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
    return movement?.movement_type === 'dice_outcome' || movement?.movement_type === 'dice';
  }

  /**
   * Check if a space uses logic-based movement (auto-selection)
   */
  public isLogicMovement(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;

    const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
    return movement?.movement_type === 'logic';
  }

  /**
   * Create movement choice options from valid moves (with space titles)
   */
  private createChoiceOptionsWithTitles(validMoves: string[]): Array<{ id: string; label: string }> {
    return validMoves.map(destination => {
      // Use the board's friendly name (display_label_override > shortName), not
      // the raw space code, so the picker matches the board tiles. Append the
      // event title as flavor when it adds something.
      const friendly = this.dataService.getDisplayLabelOverride(destination) || shortName(destination);
      const destContent = this.dataService.getSpaceContent(destination, 'First');
      const destTitle = destContent?.title || '';
      const label = destTitle && destTitle !== friendly ? `${friendly} — ${destTitle}` : friendly;
      return { id: destination, label };
    });
  }

  /**
   * Create a prompt for movement choice
   */
  private createChoicePrompt(player: Player): string {
    const currentSpaceContent = this.dataService.getSpaceContent(player.currentSpace, player.visitType);
    return `At ${currentSpaceContent?.title || player.currentSpace}, choose your next path:`;
  }

  /**
   * Handle logic movement type — walks a yes/no question chain from
   * LOGIC_QUESTIONS.csv to determine the destination.
   *
   * The chain is fired-and-forgotten here (returns immediately with
   * choiceCreated:true). walkLogicChain() runs asynchronously, creating one
   * LOGIC_QUESTION choice at a time via ChoiceService, then resolves the
   * final destination into moveIntent.
   *
   * If no chain is authored for (currentSpace, visitType) — e.g. an older
   * data file is loaded — we fall back to auto-selecting the first valid
   * destination so gameplay still progresses.
   */
  public handleLogicMovement(playerId: string): MovementChoiceResult {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return { choiceCreated: false, reason: 'Player not found' };
    }

    const entry = this.dataService.getLogicQuestionEntry(player.currentSpace, player.visitType);
    if (!entry) {
      // No chain authored — auto-select first valid move so the turn still progresses
      const validMoves = this.getValidMoves(playerId);
      const fallback = validMoves[0];
      if (!fallback) {
        return { choiceCreated: false, reason: 'No logic chain and no valid moves' };
      }
      this.stateService.setPlayerMoveIntent(playerId, fallback);
      return {
        choiceCreated: false,
        autoSelected: fallback,
        reason: 'No logic chain authored — auto-selected first valid move',
      };
    }

    const stepTotal = this.dataService
      .getLogicQuestionsForSpace(player.currentSpace, player.visitType)
      .length;

    // Fire-and-forget: the chain resolves asynchronously as the player answers.
    // moveIntent is set when the chain terminates at a space-name target.
    this.walkLogicChain(playerId, entry, 1, stepTotal).catch((err) => {
      debugWarn('Logic chain walk failed:', err);
    });

    return { choiceCreated: true, reason: 'Logic question chain started' };
  }

  /**
   * Ask one question in the chain, then recursively resolve the answer's target.
   *
   * v3.0.20 (fb:58a2112b) — when the question has `auto_answer_from` set,
   * consult player state instead of opening a modal. The chain still resolves
   * end-to-end (recursing into the appropriate target) but the player isn't
   * asked questions the engine already knows the answer to (DOB / FDNY
   * approval status, primarily).
   * @private
   */
  private async walkLogicChain(
    playerId: string,
    question: LogicQuestion,
    stepIndex: number,
    stepTotal: number
  ): Promise<void> {
    const autoAnswer = this.tryAutoAnswer(playerId, question);
    let answerId: string;
    if (autoAnswer !== null) {
      // Skipped the modal entirely — log the auto-resolution so the player
      // can see in the game log that the engine answered for them.
      const player = this.stateService.getPlayer(playerId);
      this.loggingService.info(
        `Auto-answered "${question.question_text}" → ${autoAnswer} (from ${question.auto_answer_from})`,
        {
          playerId,
          playerName: player?.name,
          action: 'logic_question_auto_answered',
          spaceName: question.space_name,
          visibility: 'player',
        }
      );
      answerId = autoAnswer;
    } else {
      answerId = await this.choiceService.createChoice(
        playerId,
        'LOGIC_QUESTION',
        question.question_text,
        [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
        {
          logicSpaceName: question.space_name,
          logicVisitType: question.visit_type,
          logicQuestionId: question.question_id,
          logicStepIndex: stepIndex,
          logicStepTotal: stepTotal,
        }
      );
    }

    const target = answerId === 'yes' ? question.yes_target : question.no_target;
    await this.resolveLogicTarget(playerId, question, target, stepIndex + 1, stepTotal);
  }

  /**
   * Resolve a logic question against player state, returning 'yes'/'no' or
   * null when no auto-answer is available (modal should be shown).
   *
   * Supported auto_answer_from keys (extend here when new approval flags
   * land — keep the switch exhaustive on purpose so unknown keys log a
   * warning and fall through to the modal):
   *   'fdny_approved' — player.fdnyApprovalStatus === 'approved'
   *   'dob_approved'  — player.dobApprovalStatus === 'approved'
   * @private
   */
  private tryAutoAnswer(playerId: string, question: LogicQuestion): 'yes' | 'no' | null {
    const key = question.auto_answer_from?.trim();
    if (!key) return null;

    const player = this.stateService.getPlayer(playerId);
    if (!player) return null;

    switch (key) {
      case 'fdny_approved':
        return player.fdnyApprovalStatus === 'approved' ? 'yes' : 'no';
      case 'dob_approved':
        return player.dobApprovalStatus === 'approved' ? 'yes' : 'no';
      default:
        debugWarn(
          `LOGIC_QUESTIONS row ${question.space_name}/${question.visit_type}/${question.question_id} ` +
          `has unknown auto_answer_from='${key}' — falling through to modal. Update ` +
          `MovementService.tryAutoAnswer to support this key.`
        );
        return null;
    }
  }

  /**
   * Resolve a yes_target / no_target into either the next question (recurse)
   * or a destination move-intent (terminate).
   *
   * Target shapes (in precedence order):
   *   1. "Q<digit>" — another question in the same chain → recurse
   *   2. "<SPACE>,<SPACE>..."  — multi-destination → sub-choice modal (MOVEMENT)
   *   3. "<SPACE>" — single destination → setPlayerMoveIntent, terminate
   * @private
   */
  private async resolveLogicTarget(
    playerId: string,
    currentQuestion: LogicQuestion,
    target: string,
    nextStepIndex: number,
    stepTotal: number
  ): Promise<void> {
    const trimmed = (target || '').trim();
    if (!trimmed) {
      debugWarn(
        `Logic chain ${currentQuestion.space_name}/${currentQuestion.question_id} has empty target`
      );
      return;
    }

    // Case 1: Q-id → recurse
    if (/^Q\d+$/i.test(trimmed)) {
      const nextQuestion = this.dataService.getLogicQuestion(
        currentQuestion.space_name,
        currentQuestion.visit_type,
        trimmed.toUpperCase()
      );
      if (!nextQuestion) {
        debugWarn(
          `Logic chain ${currentQuestion.space_name} references missing ${trimmed}`
        );
        return;
      }
      await this.walkLogicChain(playerId, nextQuestion, nextStepIndex, stepTotal);
      return;
    }

    // Case 2: comma-separated destinations → sub-choice
    if (trimmed.includes(',')) {
      const destinations = trimmed
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (destinations.length === 0) return;
      if (destinations.length === 1) {
        this.stateService.setPlayerMoveIntent(playerId, destinations[0]);
        return;
      }

      const choiceOptions = this.createChoiceOptionsWithTitles(destinations);
      const selected = await this.choiceService.createChoice(
        playerId,
        'MOVEMENT',
        'Choose your destination:',
        choiceOptions
      );
      this.stateService.setPlayerMoveIntent(playerId, selected);
      return;
    }

    // Case 3: single space name
    this.stateService.setPlayerMoveIntent(playerId, trimmed);
  }

  /**
   * Create a movement choice for a player.
   * This is the main entry point that handles all movement choice scenarios:
   * 1. At turn start (for 'choice' movement type spaces)
   * 2. After manual effects (to restore cleared choice state)
   *
   * Note: Dice-based movement choices (scenario 3) are created AFTER dice roll
   * in TurnService.processTurnEffectsWithTracking().
   *
   * @param playerId - The player to create a choice for
   * @param options - Optional configuration
   * @returns Result indicating if choice was created and why
   */
  public async createMovementChoice(
    playerId: string,
    options: MovementChoiceOptions = {}
  ): Promise<MovementChoiceResult> {
    const { isRestoration = false } = options;
    const logPrefix = isRestoration ? '🔄' : '🎬';

    try {
      // Get player
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        return { choiceCreated: false, reason: 'Player not found' };
      }

      // GUARD: Skip choice creation for dice and dice_outcome spaces
      // Those choices are created AFTER dice roll in processTurnEffectsWithTracking()
      if (this.isDiceBasedMovement(playerId)) {
        return { choiceCreated: false, reason: 'Dice-based movement - choice created after roll' };
      }

      // Get valid moves
      const validMoves = this.getValidMoves(playerId);

      // Defensive check
      if (!validMoves || !Array.isArray(validMoves)) {
        return { choiceCreated: false, reason: 'No valid moves data' };
      }

      // Handle logic movement type - auto-selects destination
      if (this.isLogicMovement(playerId) && validMoves.length >= 1) {
        return this.handleLogicMovement(playerId);
      }

      // Multiple moves available - present choice to player
      if (validMoves.length > 1) {
        const choiceOptions = this.createChoiceOptionsWithTitles(validMoves);
        const prompt = this.createChoicePrompt(player);

        // Create the choice (don't await - we don't want to block)
        // The choice will be resolved when player selects or clicks End Turn
        this.choiceService.createChoice(
          playerId,
          'MOVEMENT',
          prompt,
          choiceOptions
        ).then(selectedDestination => {
          const currentPlayer = this.stateService.getPlayer(playerId);
          // Set moveIntent as safety net (usually already set by UI)
          if (!currentPlayer?.moveIntent) {
            this.stateService.setPlayerMoveIntent(playerId, selectedDestination);
          }
        }).catch(error => {
          // Choice timed out or was cancelled - this is okay
        });

        return { choiceCreated: true, reason: 'Multiple valid moves - choice presented' };
      }

      // Exactly 1 valid move on a choice-typed space.
      // fb:feedback-1779571011889-291d8076 — Subsequent visit to REG-DOB-TYPE-SELECT
      // (or any path-choice-lock-point space) narrows validMoves to the single
      // destination the player picked on First visit. Previously we returned
      // "no choice needed" but never set moveIntent, so StateService's
      // calculateRequiredActions kept counting the (movement_type='choice') as
      // required-but-uncompleted forever — End Turn greyed out, player saw
      // "1 action remaining" with no picker rendered (only one option means no
      // picker), and reported being stuck. Auto-set moveIntent to the single
      // destination so the choice is resolved silently and the player can
      // press End Turn.
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      if (validMoves.length === 1 && movement?.movement_type === 'choice' && !player.moveIntent) {
        this.stateService.setPlayerMoveIntent(playerId, validMoves[0]);
        return { choiceCreated: false, reason: 'Auto-routed: single valid move on choice space (lock-point memory)' };
      }

      // 0 moves, or non-choice movement type with 1 move - nothing to set
      return { choiceCreated: false, reason: `Only ${validMoves.length} valid move(s)` };

    } catch (error) {
      debugWarn(`${logPrefix} Error creating movement choice:`, error);
      return { choiceCreated: false, reason: `Error: ${error}` };
    }
  }

  /**
   * Convenience method for turn start movement choices
   */
  public async handleMovementChoices(playerId: string): Promise<MovementChoiceResult> {
    return this.createMovementChoice(playerId, { isRestoration: false });
  }

  /**
   * Convenience method for restoring movement choices after manual effects
   */
  public async restoreMovementChoiceIfNeeded(playerId: string): Promise<MovementChoiceResult> {
    return this.createMovementChoice(playerId, { isRestoration: true });
  }

}
