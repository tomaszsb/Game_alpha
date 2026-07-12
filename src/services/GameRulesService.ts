// src/services/GameRulesService.ts

import { IGameRulesService, IDataService, IStateService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { Card, CardType, Movement } from '../types/DataTypes';

/**
 * GameRulesService acts as the centralized authority for all game rule validations.
 * This service keeps validation logic centralized and helps other services stay focused
 * on their primary responsibilities.
 */
export class GameRulesService implements IGameRulesService {
  // Cache for calculateProjectScope to avoid redundant calculations
  // Key: playerId, Value: { cacheKey: stringified card array, value: calculated scope }
  private projectScopeCache: Map<string, { cacheKey: string; value: number }> = new Map();

  constructor(
    private dataService: IDataService,
    private stateService: IStateService
  ) {}

  /**
   * Validates if a player can move to a specific destination
   * @param playerId - The ID of the player attempting to move
   * @param destination - The destination space name
   * @returns true if the move is valid
   */
  isMoveValid(playerId: string, destination: string): boolean {
    try {
      // Game must be in progress
      if (!this.isGameInProgress()) {
        return false;
      }

      // Player must exist
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        return false;
      }

      // Get movement data for player's current space
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      if (!movement) {
        return false;
      }

      // Check if destination is in the list of valid destinations
      const validDestinations = this.extractValidDestinations(movement);
      return validDestinations.includes(destination);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates if a player can play a specific card
   * @param playerId - The ID of the player
   * @param cardId - The ID of the card to play
   * @returns true if the card can be played
   */
  canPlayCard(playerId: string, cardId: string): boolean {
    // Game must be in progress
    if (!this.isGameInProgress()) {
      return false;
    }

    // Player must exist
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    // Player must own the card
    if (!this.playerOwnsCard(playerId, cardId)) {
      return false;
    }

    // Get card type to check additional restrictions
    const cardType = this.getCardType(cardId);
    if (!cardType) {
      return false;
    }

    // Some card types may require it to be the player's turn
    if (this.cardRequiresPlayerTurn(cardType)) {
      if (!this.isPlayerTurn(playerId)) {
        return false;
      }
    }

    // Check phase restrictions
    const card = this.dataService.getCardById(cardId);
    if (card && card.phase_restriction && card.phase_restriction !== 'Any') {
      const currentActivityPhase = this.getCurrentActivityPhase(playerId);
      if (currentActivityPhase && card.phase_restriction !== currentActivityPhase) {
        return false;
      }
      // If currentActivityPhase is null (player not on a phased space), allow any cards to be played
    }

    // fb:feedback-1782842888855-aff0e337 — used to hard-block a pure
    // time-reduction card at timeSpent=0 here (isTimeReductionBlockedByZeroTime).
    // Superseded 2026-07-08: the maintainer chose a soft warning over a hard
    // block (getCardEffectSummary states the real, possibly-partial day count
    // instead), applied uniformly regardless of bundled effects — the button
    // stays offered either way now.

    // fb:58277eca — block cards the player can't afford. E030 "Time Crunch"
    // costs $8K via money_effect=-8000; before this check, the Play button
    // rendered, click silently failed in handlePlayECard's catch with no
    // user-facing message ("button does nothing"). Negative money_effect
    // means the player pays; require player.money >= |amount|.
    if (card && card.money_effect) {
      const moneyDelta = parseInt(card.money_effect, 10);
      if (!isNaN(moneyDelta) && moneyDelta < 0) {
        if ((player.money || 0) < Math.abs(moneyDelta)) {
          return false;
        }
      }
    }

    // fb:73318276 — same "button does nothing" class as fb:58277eca above.
    // E024 "Return to Sender" cancels any player's currently-ACTIVE Expeditor
    // effect (CardService.handleReturnToSender picks a target from every
    // player's activeCards — self OR opponents). When nobody currently has an
    // active E effect in play (common, since most Expeditors are Immediate-
    // duration one-shots, not ongoing), activating it silently no-ops — no
    // modal, no message, nothing observable, which read as "how does this
    // card work?" Gate it here so the button isn't offered with no target.
    if (card?.card_id === 'E024') {
      const anyActiveExpeditor = this.stateService.getGameState().players.some((p) =>
        (p.activeCards || []).some((ac) => {
          const activeCardData = this.dataService.getCardById(ac.cardId);
          return activeCardData?.card_type === 'E';
        }),
      );
      if (!anyActiveExpeditor) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates if a player can draw a card of a specific type
   * @param playerId - The ID of the player
   * @param cardType - The type of card to draw
   * @returns true if the player can draw the card
   */
  canDrawCard(playerId: string, cardType: CardType): boolean {
    // Game must be in progress
    if (!this.isGameInProgress()) {
      return false;
    }

    // Player must exist
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    // Validate card type
    if (!this.isValidCardType(cardType)) {
      return false;
    }

    // Check if deck has cards available (stateful deck system)
    const gameState = this.stateService.getGameState();
    if (!gameState.decks || !gameState.decks[cardType] || gameState.decks[cardType].length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Validates if a player can afford a specific cost
   * @param playerId - The ID of the player
   * @param cost - The cost amount
   * @returns true if the player can afford the cost
   */
  canPlayerAfford(playerId: string, cost: number): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    return player.money >= cost;
  }

  /**
   * Validates if it's currently a specific player's turn
   * @param playerId - The ID of the player
   * @returns true if it's the player's turn
   */
  isPlayerTurn(playerId: string): boolean {
    const gameState = this.stateService.getGameState();
    return gameState.currentPlayerId === playerId;
  }

  /**
   * Validates if the game is currently in progress
   * @returns true if the game is in the PLAY phase
   */
  isGameInProgress(): boolean {
    const gameState = this.stateService.getGameState();
    return gameState.gamePhase === 'PLAY';
  }

  /**
   * Validates if a player can take any action (combines multiple checks)
   * @param playerId - The ID of the player
   * @returns true if the player can take actions
   */
  canPlayerTakeAction(playerId: string): boolean {
    // Game must be in progress
    if (!this.isGameInProgress()) {
      return false;
    }

    // Player must exist
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    // For most actions, it should be the player's turn
    // Exception: some cards might be playable out of turn
    return this.isPlayerTurn(playerId);
  }

  /**
   * Helper method to get current activity phase based on player's current space
   * @private
   */
  private getCurrentActivityPhase(playerId: string): string | null {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return null;
    }

    // Get the game config for the player's current space to determine its phase
    const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
    if (!spaceConfig || !spaceConfig.phase) {
      return null; // Space has no specific phase, allow any cards
    }

    // Map the space's phase to card phase restrictions
    // The CSV phases in GAME_CONFIG match the card phase_restriction values
    switch (spaceConfig.phase.toUpperCase()) {
      case 'CONSTRUCTION':
        return 'CONSTRUCTION';
      case 'DESIGN':
        return 'DESIGN';
      case 'FUNDING':
        return 'FUNDING';
      case 'REGULATORY':
        return 'REGULATORY_REVIEW';
      default:
        // SETUP / OWNER / END are real lifecycle stages, but no card is ever
        // restricted to them — every phase_restriction is one of the 4 work
        // phases above or "Any". Returning the stage name (instead of null)
        // means a phase-restricted expeditor won't match and is correctly
        // blocked until its work phase, matching the classic panel's
        // long-standing local gate (CardsSection / ActionCenterPanel: "Can only
        // be activated during X phase"). "Any" cards are never gated by the
        // caller, so they still play in every stage. Only a space with NO phase
        // at all (guarded above) falls through to the permissive null.
        return spaceConfig.phase.toUpperCase();
    }
  }

  /**
   * Extracts valid destinations from movement data
   * @private
   */
  private extractValidDestinations(movement: Movement): string[] {
    const destinations: string[] = [];
    
    // Handle different movement types
    if (movement.movement_type === 'none') {
      return []; // Terminal space
    }

    // For dice movement, get destinations from dice outcomes
    if (movement.movement_type === 'dice') {
      const diceOutcome = this.dataService.getDiceOutcome(movement.space_name, movement.visit_type);
      if (diceOutcome) {
        if (diceOutcome.roll_1) destinations.push(diceOutcome.roll_1);
        if (diceOutcome.roll_2) destinations.push(diceOutcome.roll_2);
        if (diceOutcome.roll_3) destinations.push(diceOutcome.roll_3);
        if (diceOutcome.roll_4) destinations.push(diceOutcome.roll_4);
        if (diceOutcome.roll_5) destinations.push(diceOutcome.roll_5);
        if (diceOutcome.roll_6) destinations.push(diceOutcome.roll_6);
      }
    } else {
      // For other movement types, get destinations from movement data
      if (movement.destination_1) destinations.push(movement.destination_1);
      if (movement.destination_2) destinations.push(movement.destination_2);
      if (movement.destination_3) destinations.push(movement.destination_3);
      if (movement.destination_4) destinations.push(movement.destination_4);
      if (movement.destination_5) destinations.push(movement.destination_5);
    }

    // Remove duplicates and filter out empty strings
    const filteredDests = destinations.filter(dest => dest && dest.trim() !== '');
    const uniqueDests: string[] = [];
    filteredDests.forEach(dest => {
      if (!uniqueDests.includes(dest)) {
        uniqueDests.push(dest);
      }
    });
    
    return uniqueDests;
  }

  /**
   * Checks if a player owns a specific card
   * @private
   */
  private playerOwnsCard(playerId: string, cardId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    // Check if card is in player's hand
    return player.hand ? player.hand.includes(cardId) : false;
  }

  /**
   * Gets the type of a card from its ID
   * @private
   */
  private getCardType(cardId: string): CardType | null {
    // Extract card type from card ID (assumes format like "W_001", "B_002", etc.)
    const cardType = cardId.charAt(0) as CardType;
    return this.isValidCardType(cardType) ? cardType : null;
  }

  /**
   * Validates if a card type is valid
   * @private
   */
  private isValidCardType(cardType: string): boolean {
    const validTypes: CardType[] = ['W', 'B', 'E', 'L', 'I'];
    return validTypes.includes(cardType as CardType);
  }

  private cardRequiresPlayerTurn(cardType: CardType): boolean {
    // Business rule: Most cards require player's turn, but some might be playable anytime
    // For now, assume all cards require player's turn
    return true;
  }

  /**
   * Gets the count of cards a player has of a specific type
   * @private
   */
  private getPlayerCardCount(playerId: string, cardType?: CardType): number {
    const player = this.stateService.getPlayer(playerId);
    if (!player || !player.hand) {
      return 0;
    }

    if (cardType) {
      // Count cards of specific type in player's hand
      return player.hand.filter(cardId => {
        const type = this.getCardType(cardId);
        return type === cardType;
      }).length;
    }

    // Return total card count
    return player.hand.length;
  }

  /**
   * Checks if a player has met the win condition
   * @param playerId - The ID of the player to check
   * @returns Promise<boolean> - true if the player has won
   */
  async checkWinCondition(playerId: string): Promise<boolean> {
    try {

      // Get the player's current state
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        return false;
      }


      // Get the space configuration for the player's current space
      const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
      if (!spaceConfig) {
        return false;
      }


      // Check if the current space is marked as an ending space
      const hasWon = spaceConfig.is_ending_space === true;

      if (hasWon) {
      } else {
      }

      return hasWon;
    } catch (error) {
      console.error(`❌ [WIN CHECK] Error checking win condition for player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * Check if the game should end for any reason (currently: win condition only —
   * there is no turn limit; see maintainer ruling 2026-07-11)
   * @param playerId - The ID of the player to check for win condition
   * @returns Object indicating if game should end and why
   */
  async checkGameEndConditions(playerId: string): Promise<{
    shouldEnd: boolean;
    reason: 'win' | null;
    winnerId?: string;
  }> {
    try {
      // Check if player won by reaching ending space
      const playerWon = await this.checkWinCondition(playerId);
      if (playerWon) {
        return {
          shouldEnd: true,
          reason: 'win',
          winnerId: playerId
        };
      }

      return {
        shouldEnd: false,
        reason: null
      };
    } catch (error) {
      console.error('Error checking game end conditions:', error);
      return {
        shouldEnd: false,
        reason: null
      };
    }
  }

  /**
   * Check if the current player can end their turn.
   * This involves checking if all required actions are completed.
   * @param playerId - The ID of the player to check
   * @returns true if the player can end their turn, false otherwise.
   */
  canEndTurn(playerId: string): boolean {
    // Player must exist and be current player
    const player = this.stateService.getPlayer(playerId);
    if (!player || !this.isPlayerTurn(playerId) || !this.isGameInProgress()) {
      return false;
    }

    // No pending choices should exist
    // EXCEPTION: MOVEMENT choices are allowed if player has selected a destination (moveIntent)
    const awaitingChoice = this.stateService.getGameState().awaitingChoice;
    if (awaitingChoice) {
      const isMovementWithIntent =
        awaitingChoice.type === 'MOVEMENT' &&
        !!player.moveIntent;
      if (!isMovementWithIntent) {
        return false;
      }
    }

    // All required actions for the turn must be completed
    const gameState = this.stateService.getGameState();
    return gameState.requiredActions <= gameState.completedActionCount;
  }

  /**
   * Calculates the total project scope for a player based on their Work (W) cards
   * Uses service-level caching to avoid redundant calculations.
   * Cache is invalidated when the player's card arrays change.
   * @param playerId - The ID of the player
   * @returns The total cost/value of all W cards owned by the player
   */
  calculateProjectScope(playerId: string): number {
    try {
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.error(`Player ${playerId} not found when calculating project scope`);
        return 0;
      }

      // Get all W cards for this player from BOTH hand and activeCards
      const handWorkCards = player.hand.filter(cardId => cardId.startsWith('W'));
      const activeWorkCards = (player.activeCards || [])
        .map(ac => ac.cardId)
        .filter(cardId => cardId.startsWith('W'));

      const allWorkCards = [...handWorkCards, ...activeWorkCards];

      // Create cache key from card arrays
      const cacheKey = JSON.stringify(allWorkCards.sort());

      // Check cache - return cached value if cards haven't changed
      const cached = this.projectScopeCache.get(playerId);
      if (cached && cached.cacheKey === cacheKey) {
        return cached.value;
      }

      // Cache miss - calculate scope

      let totalScope = 0;

      // Calculate total scope by summing up card costs
      for (const cardId of allWorkCards) {
        // Extract base card ID from generated ID (e.g., W111_1756274803252_sezfko0rc_0 -> W111)
        const baseCardId = cardId.split('_')[0];
        const cardData = this.dataService.getCardById(baseCardId);
        if (cardData) {
          // Use cost field from CSV
          const cardCost = cardData.cost || 0;
          totalScope += cardCost;
        } else {
          debugWarn(`Card data not found for base card ID: ${baseCardId} (from ${cardId})`);
        }
      }

      // Store in cache
      this.projectScopeCache.set(playerId, { cacheKey, value: totalScope });

      return totalScope;
    } catch (error) {
      console.error(`Error calculating project scope for player ${playerId}:`, error);
      return 0;
    }
  }

  /**
   * Calculate the total work cost from W cards (used for construction phase costs)
   * This is different from project scope - work_cost represents actual construction costs,
   * while cost represents design/scope value.
   *
   * @param playerId - The ID of the player
   * @returns The total work_cost of all W cards owned by the player
   */
  calculateTotalWorkCost(playerId: string): number {
    try {
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.error(`Player ${playerId} not found when calculating work cost`);
        return 0;
      }

      // Get all W cards for this player from BOTH hand and activeCards
      const handWorkCards = player.hand.filter(cardId => cardId.startsWith('W'));
      const activeWorkCards = (player.activeCards || [])
        .map(ac => ac.cardId)
        .filter(cardId => cardId.startsWith('W'));

      const allWorkCards = [...handWorkCards, ...activeWorkCards];


      let totalWorkCost = 0;

      for (const cardId of allWorkCards) {
        // Extract base card ID from generated ID (e.g., W111_1756274803252_sezfko0rc_0 -> W111)
        const baseCardId = cardId.split('_')[0];
        const cardData = this.dataService.getCardById(baseCardId);
        if (cardData && cardData.work_cost) {
          const workCost = typeof cardData.work_cost === 'string'
            ? parseFloat(cardData.work_cost)
            : cardData.work_cost;
          if (!isNaN(workCost)) {
            totalWorkCost += workCost;
          }
        }
      }

      return totalWorkCost;
    } catch (error) {
      console.error(`Error calculating work cost for player ${playerId}:`, error);
      return 0;
    }
  }

  /**
   * Calculate the estimated project length based on work types
   * Formula: Base path time (300 days) + 100 days per unique work type
   * @param playerId - The ID of the player
   * @returns Object with estimated length and breakdown
   */
  calculateEstimatedProjectLength(playerId: string): {
    estimatedDays: number;
    basePathDays: number;
    workTypeDays: number;
    contingencyDays: number;
    uniqueWorkTypes: string[];
  } {
    const BASE_PATH_DAYS = 300; // Minimum project path time estimate
    const DAYS_PER_WORK_TYPE = 100; // Additional days per work type
    const CONTINGENCY_RATE = 0.10; // 10% contingency for unexpected issues (life events)

    try {
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.error(`Player ${playerId} not found when calculating project length`);
        const contingency = Math.round(BASE_PATH_DAYS * CONTINGENCY_RATE);
        return { estimatedDays: BASE_PATH_DAYS + contingency, basePathDays: BASE_PATH_DAYS, workTypeDays: 0, contingencyDays: contingency, uniqueWorkTypes: [] };
      }

      // Get all W cards for this player from BOTH hand and activeCards
      const handWorkCards = player.hand.filter(cardId => cardId.startsWith('W'));
      const activeWorkCards = (player.activeCards || [])
        .map(ac => ac.cardId)
        .filter(cardId => cardId.startsWith('W'));

      const allWorkCards = [...handWorkCards, ...activeWorkCards];

      // Get unique work types from W cards
      const workTypes = new Set<string>();
      for (const cardId of allWorkCards) {
        const baseCardId = cardId.split('_')[0];
        const cardData = this.dataService.getCardById(baseCardId);
        if (cardData && cardData.work_type_restriction) {
          workTypes.add(cardData.work_type_restriction);
        }
      }

      const uniqueWorkTypes = Array.from(workTypes);
      const workTypeDays = uniqueWorkTypes.length * DAYS_PER_WORK_TYPE;
      const subtotal = BASE_PATH_DAYS + workTypeDays;
      const contingencyDays = Math.round(subtotal * CONTINGENCY_RATE);
      const estimatedDays = subtotal + contingencyDays;

      return {
        estimatedDays,
        basePathDays: BASE_PATH_DAYS,
        workTypeDays,
        contingencyDays,
        uniqueWorkTypes
      };
    } catch (error) {
      console.error(`Error calculating project length for player ${playerId}:`, error);
      const contingency = Math.round(BASE_PATH_DAYS * CONTINGENCY_RATE);
      return { estimatedDays: BASE_PATH_DAYS + contingency, basePathDays: BASE_PATH_DAYS, workTypeDays: 0, contingencyDays: contingency, uniqueWorkTypes: [] };
    }
  }

  /**
   * Calculate a player's final score based on their assets and liabilities
   * @param playerId - The ID of the player
   * @returns The calculated score
   */
  calculatePlayerScore(playerId: string): number {
    try {
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        console.error(`Player ${playerId} not found when calculating score`);
        return 0;
      }

      let score = 0;

      // Add player's final money
      score += player.money;

      // Add player's project scope (using existing calculateProjectScope method)
      score += this.calculateProjectScope(playerId);

      // Subtract penalty for loans (each loan costs 5000 points)
      score -= player.loans.length * 5000;

      // Subtract penalty for time spent (each time unit costs 1000 points)
      score -= player.timeSpent * 1000;


      return Math.max(0, score); // Ensure score doesn't go negative
    } catch (error) {
      console.error(`Error calculating score for player ${playerId}:`, error);
      return 0;
    }
  }

  /**
   * Determine the winner of the game based on highest score
   * @returns The player ID of the winner, or null if no winner can be determined
   */
  determineWinner(): string | null {
    try {
      const gameState = this.stateService.getGameState();
      const players = gameState.players;

      if (players.length === 0) {
        return null;
      }

      let highestScore = -1;
      let winnerId: string | null = null;

      // Calculate scores for all players and update their score property
      for (const player of players) {
        const playerScore = this.calculatePlayerScore(player.id);
        
        // Update the player's score in the game state
        this.stateService.updatePlayer({
          id: player.id,
          score: playerScore
        });

        // Track the highest score
        if (playerScore > highestScore) {
          highestScore = playerScore;
          winnerId = player.id;
        }
      }

      return winnerId;
    } catch (error) {
      console.error('Error determining winner:', error);
      return null;
    }
  }

  /**
   * Evaluate a condition for a player
   * This is the single source of truth for condition evaluation across all services
   *
   * @param playerId - The ID of the player to evaluate the condition for
   * @param condition - The condition string to evaluate (e.g., 'always', 'scope_le_4M', 'scope_gt_4M')
   * @param diceRoll - Optional dice roll value for dice-based conditions
   * @returns true if the condition is met, false otherwise
   */
  evaluateCondition(playerId: string, condition: string | undefined, diceRoll?: number): boolean {
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

      // Project scope conditions - PURE EVALUATION (no state updates during condition check)
      // Always calculate fresh to ensure correctness - state updates happen elsewhere
      // (e.g., when W cards are drawn, at OWNER-FUND-INITIATION via TurnService.handleAutomaticFunding)
      if (conditionLower === 'scope_le_4m') {
        const projectScope = this.calculateProjectScope(playerId);
        return projectScope <= 4000000; // $4M
      }

      if (conditionLower === 'scope_gt_4m') {
        const projectScope = this.calculateProjectScope(playerId);
        return projectScope > 4000000; // $4M
      }

      // High/low dice conditions
      if (conditionLower === 'high') {
        return diceRoll !== undefined && diceRoll >= 4; // 4, 5, 6 are "high"
      }

      if (conditionLower === 'low') {
        return diceRoll !== undefined && diceRoll <= 3; // 1, 2, 3 are "low"
      }

      // Dice roll specific values (e.g., dice_roll_1, dice_roll_3)
      if (conditionLower.startsWith('dice_roll_')) {
        // Dice roll conditions require a dice value to evaluate
        if (diceRoll === undefined) {
          // No dice roll yet - condition is not met (return false without warning)
          // This is expected when UI components filter effects before dice is rolled
          return false;
        }
        const requiredRoll = parseInt(conditionLower.replace('dice_roll_', ''));
        return diceRoll === requiredRoll;
      }

      // Unknown condition - default to false
      debugWarn(`Unknown condition: "${condition}", defaulting to false`);
      return false;
    } catch (error) {
      console.error(`Error evaluating condition "${condition}":`, error);
      return false;
    }
  }
}
