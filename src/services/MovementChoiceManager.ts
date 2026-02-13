// src/services/MovementChoiceManager.ts
// Extracted from TurnService - manages movement choice creation and restoration

import { IStateService, IDataService, IMovementService, IChoiceService, INotificationService } from '../types/ServiceContracts';
import { Player } from '../types/StateTypes';

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
 * MovementChoiceManager handles movement choice creation for players.
 *
 * ARCHITECTURE NOTE: Movement choices can be created in 3 scenarios:
 * 1. At turn start (for 'choice' movement type spaces)
 * 2. After dice roll (for 'dice_outcome' spaces) - handled elsewhere
 * 3. After manual effects (to restore cleared choice state)
 *
 * This manager unifies scenarios 1 and 3 to eliminate code duplication.
 * Scenario 2 remains in TurnService.processTurnEffectsWithTracking().
 */
export class MovementChoiceManager {
  constructor(
    private stateService: IStateService,
    private dataService: IDataService,
    private movementService: IMovementService,
    private choiceService: IChoiceService,
    private notificationService?: INotificationService
  ) {}

  /**
   * Set notification service (for dependency injection after construction)
   */
  public setNotificationService(service: INotificationService): void {
    this.notificationService = service;
  }

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
   * Create movement choice options from valid moves
   */
  private createChoiceOptions(validMoves: string[]): Array<{ id: string; label: string }> {
    return validMoves.map(destination => {
      const destContent = this.dataService.getSpaceContent(destination, 'First');
      const destTitle = destContent?.title || destination;
      const label = destTitle !== destination ? `${destination} - ${destTitle}` : destination;
      return { id: destination, label: label };
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
   * Handle logic movement type - auto-selects destination based on game rules
   */
  public handleLogicMovement(playerId: string): MovementChoiceResult {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return { choiceCreated: false, reason: 'Player not found' };
    }

    const validMoves = this.movementService.getValidMoves(playerId);
    if (!validMoves || validMoves.length === 0) {
      return { choiceCreated: false, reason: 'No valid moves for logic movement' };
    }

    const firstDestination = validMoves[0];
    const logicResult = this.movementService.getLogicMovementWithExplanation(
      playerId,
      player.currentSpace,
      player.visitType
    );

    // Auto-set move intent to first valid destination
    this.stateService.setPlayerMoveIntent(playerId, firstDestination);

    // Show explanation of why this destination was chosen
    if (this.notificationService) {
      const destContent = this.dataService.getSpaceContent(firstDestination, 'First');
      const destTitle = destContent?.title || firstDestination;
      const spaceContent = this.dataService.getSpaceContent(player.currentSpace, player.visitType);
      const explanation = logicResult.explanation || 'Based on your project status';

      this.notificationService.notify(
        {
          short: `Clerk: → ${destTitle}`,
          medium: `📋 ${explanation}. You'll proceed to ${destTitle}`,
          detailed: `${player.name} at ${spaceContent?.title || player.currentSpace}: ${explanation}. The clerk directs you to ${destTitle}.`
        },
        {
          playerId: playerId,
          playerName: player.name,
          actionType: 'logic_decision_path'
        }
      );
    }


    return {
      choiceCreated: false,
      autoSelected: firstDestination,
      reason: 'Logic movement auto-selected destination'
    };
  }

  /**
   * Create a movement choice for a player
   * This is the main entry point that handles all movement choice scenarios
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
        const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
        return { choiceCreated: false, reason: 'Dice-based movement - choice created after roll' };
      }

      // Get valid moves
      const validMoves = this.movementService.getValidMoves(playerId);

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
        const playerName = player.name || 'Unknown Player';

        const choiceOptions = this.createChoiceOptions(validMoves);
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
          const name = currentPlayer?.name || 'Unknown Player';
          // Set moveIntent as safety net (usually already set by UI)
          if (!currentPlayer?.moveIntent) {
            this.stateService.setPlayerMoveIntent(playerId, selectedDestination);
          }
        }).catch(error => {
          // Choice timed out or was cancelled - this is okay
        });

        return { choiceCreated: true, reason: 'Multiple valid moves - choice presented' };
      }

      // 0 or 1 moves - no choice needed
      return { choiceCreated: false, reason: `Only ${validMoves.length} valid move(s)` };

    } catch (error) {
      console.warn(`${logPrefix} Error creating movement choice:`, error);
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
