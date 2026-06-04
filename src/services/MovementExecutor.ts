// src/services/MovementExecutor.ts
// Extracted from TurnService - handles movement execution during end-of-turn

import { IDataService, IStateService, IMovementService } from '../types/ServiceContracts';
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
  // Phase 2.1 audit (2026-06-04): approvalService is no longer needed here.
  // The Stage-1 gate override that lived on this service (v3.0.62 fix) now
  // lives in MovementService.getValidMoves, which both this executor and
  // validateMove consume through one resolver. Constructor signature accepts
  // an unused optional `approvalService` arg purely for back-compat with
  // existing call sites (ServiceProvider, ghost bootstrap, tests); it can be
  // removed in a follow-up sweep along with the call-site updates.
  constructor(
    private dataService: IDataService,
    private stateService: IStateService,
    private movementService: IMovementService,
    _unusedApprovalService?: unknown
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
        // Phase 2.1 audit (2026-06-04): one resolver. The Stage-1 gate override
        // that lived inline here (v3.0.62 fix) is now applied inside
        // getValidMoves alongside lock-point + resume-hub overrides — so the
        // dice path and validateMove agree by construction. Pass the rolled
        // value via the options arg; the resolver narrows the base set to that
        // roll's destination before the override stack runs.
        const validForRoll = this.movementService.getValidMoves(player.id, { diceRoll });
        const destination = validForRoll[0] ?? null;

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
