// src/services/MovementExecutor.ts
// Extracted from TurnService - handles movement execution during end-of-turn

import { IDataService, IStateService, IMovementService, IApprovalService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
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
    private movementService: IMovementService,
    private approvalService?: IApprovalService
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
        const diceRoll = player.lastDiceRoll.total;
        let destination = this.movementService.getDiceDestination(player.currentSpace, player.visitType, diceRoll);

        // v3.0.62 — Stage-1 approval gate override on the dice path.
        // Mirrors the v3.0.61 fix in MovementService.getValidMoves. The gate at
        // has_final_review_gate spaces forces the player back to the missing
        // examiner; the dice destination from DICE_OUTCOMES.csv would otherwise
        // win here and fail downstream validateMove (which DOES consult the
        // gate via getValidMoves). Without this override, players who lose
        // DOB/FDNY approval mid-game crash on END TURN at REG-DOB-FINAL-REVIEW.
        if (this.approvalService && this.dataService.hasFinalReviewGate(player.currentSpace)) {
          const gate = this.approvalService.checkFinalReviewGate(player);
          if (!gate.passed && gate.routeTo) {
            destination = gate.routeTo;
          }
        }

        if (destination) {
          // Movement logged via emitAutoAction below
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
          console.error(`[MovementExecutor] STUCK: No destination for dice roll ${diceRoll} at ${player.currentSpace} (${player.visitType}). Player ${player.name} cannot move.`);
          this.stateService.emitAutoAction({
            type: 'movement',
            playerId: player.id,
            playerName: player.name,
            playerColor: player.color,
            spaceName: player.currentSpace,
            fromSpace: player.currentSpace,
            toSpace: undefined,
            success: false,
            message: `⚠️ Movement failed: no destination found for dice roll ${diceRoll} at ${player.currentSpace}. Please contact support or reload.`
          });
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
        if (validMoves.length === 0) {
          console.error(`[MovementExecutor] STUCK: No valid moves and no moveIntent at ${player.currentSpace} (${player.visitType}). Player ${player.name} cannot move. validMoves=[], lastDiceRoll=${JSON.stringify(player.lastDiceRoll)}`);
          this.stateService.emitAutoAction({
            type: 'movement',
            playerId: player.id,
            playerName: player.name,
            playerColor: player.color,
            spaceName: player.currentSpace,
            fromSpace: player.currentSpace,
            toSpace: undefined,
            success: false,
            message: `⚠️ Movement failed: no valid destinations from ${player.currentSpace}. Please contact support or reload.`
          });
        }
        return { moved: false, fromSpace: player.currentSpace, toSpace: null, reason: 'none' };
      }
    } else {
      return null;
    }
  }
}
