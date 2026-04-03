// src/services/MovementExecutor.ts
// Extracted from TurnService - handles movement execution during end-of-turn

import { IDataService, IStateService, IMovementService } from '../types/ServiceContracts';
import { Player } from '../types/StateTypes';
import { GameState } from '../types/StateTypes';

/**
 * Result of movement execution, describing what happened.
 */
export interface MovementResult {
  moved: boolean;
  fromSpace: string;
  toSpace: string | null;
  reason: 'dice' | 'intent' | 'auto' | 'none';
}

/**
 * MovementExecutor handles the movement portion of end-of-turn processing.
 *
 * This includes:
 * - Checking for dice_outcome/dice movement type and using dice roll to determine destination
 * - Handling player moveIntent
 * - Falling back to auto-move for single destinations
 * - Emitting movement auto-action events
 *
 * Extracted from TurnService for better separation of concerns.
 */
export class MovementExecutor {
  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private movementService: IMovementService
  ) {}

  /**
   * Execute movement for a player during end-of-turn.
   *
   * Handles three movement scenarios in priority order:
   * 1. Dice-based movement (dice_outcome or dice movement type with a lastDiceRoll)
   * 2. Player moveIntent (player has chosen a destination)
   * 3. Auto-move fallback (single valid destination available)
   *
   * @param player - The current player
   * @param gameState - The current game state
   * @param skipAutoMove - If true, skip all movement (e.g., after Try Again)
   * @returns MovementResult describing what happened, or null if movement was skipped
   */
  async executeMovement(player: Player, gameState: GameState, skipAutoMove: boolean): Promise<MovementResult | null> {
    // Handle movement - check for player's move intent first
    if (!skipAutoMove) {
      // Check for dice_outcome or dice movement first
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      if ((movement?.movement_type === 'dice_outcome' || movement?.movement_type === 'dice') && player.lastDiceRoll) {
        // Use dice roll to determine destination from DICE_ROLL_INFO.csv
        const diceRoll = player.lastDiceRoll.total;

        // Use DICE_OUTCOMES.csv for dice-based movement
        // TODO: Implement getDiceRollDestinations in DataService if DICE_ROLL_INFO.csv is needed
        // const destinations = this.dataService.getDiceRollDestinations(currentPlayer.currentSpace, currentPlayer.visitType);
        let destination: string | null = null;

        // Use existing dice outcome logic
        destination = this.movementService.getDiceDestination(player.currentSpace, player.visitType, diceRoll);

        // Original code commented out for future implementation:
        // if (destinations.length >= diceRoll) {
        //   destination = destinations[diceRoll - 1];
        // } else {
        //   destination = this.movementService.getDiceDestination(currentPlayer.currentSpace, currentPlayer.visitType, diceRoll);
        // }

        if (destination) {
          process.stderr.write(`\n!!! [MOVE_CHECK] From: ${player.currentSpace} To: ${destination} (Roll: ${diceRoll}) !!!\n`);
          // Emit movement event BEFORE the move so UI can show transition overlay
          this.stateService.emitAutoAction({
            type: 'movement',
            playerId: player.id,
            playerName: player.name,
            playerColor: player.color,
            spaceName: player.currentSpace,
            fromSpace: player.currentSpace,
            toSpace: destination,
            success: true,
            message: `${player.name} moved from ${player.currentSpace} to ${destination}`
          });
          await this.movementService.movePlayer(player.id, destination);
          return { moved: true, fromSpace: player.currentSpace, toSpace: destination, reason: 'dice' };
        } else {
          console.warn(`🎲 No destination found for dice roll ${diceRoll} at ${player.currentSpace}`);
          return { moved: false, fromSpace: player.currentSpace, toSpace: null, reason: 'none' };
        }
      } else if (player.moveIntent) {
        // Execute the intended move
        // Emit movement event BEFORE the move so UI can show transition overlay
        this.stateService.emitAutoAction({
          type: 'movement',
          playerId: player.id,
          playerName: player.name,
          playerColor: player.color,
          spaceName: player.currentSpace,
          fromSpace: player.currentSpace,
          toSpace: player.moveIntent,
          success: true,
          message: `${player.name} moved from ${player.currentSpace} to ${player.moveIntent}`
        });
        await this.movementService.movePlayer(player.id, player.moveIntent);

        const toSpace = player.moveIntent;

        // Clear the move intent after execution
        this.stateService.setPlayerMoveIntent(player.id, null);

        return { moved: true, fromSpace: player.currentSpace, toSpace, reason: 'intent' };
      } else {
        // No intent set - fall back to auto-move for single destinations
        const validMoves = this.movementService.getValidMoves(player.id);
        if (validMoves.length === 1) {
          // Only one move available - perform automatic movement
          // Emit movement event BEFORE the move so UI can show transition overlay
          this.stateService.emitAutoAction({
            type: 'movement',
            playerId: player.id,
            playerName: player.name,
            playerColor: player.color,
            spaceName: player.currentSpace,
            fromSpace: player.currentSpace,
            toSpace: validMoves[0],
            success: true,
            message: `${player.name} moved from ${player.currentSpace} to ${validMoves[0]}`
          });
          await this.movementService.movePlayer(player.id, validMoves[0]);
          return { moved: true, fromSpace: player.currentSpace, toSpace: validMoves[0], reason: 'auto' };
        }
        return { moved: false, fromSpace: player.currentSpace, toSpace: null, reason: 'none' };
      }
    } else {
      return null;
    }
  }
}
