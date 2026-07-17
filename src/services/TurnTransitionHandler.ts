// src/services/TurnTransitionHandler.ts
// Extracted from TurnService - handles turn-end processing and player advancement

import { IStateService, ICardService, ILoggingService, IEffectEngineService } from '../types/ServiceContracts';
import { INotificationService } from './NotificationService';
import { Player } from '../types/StateTypes';

/**
 * TurnTransitionHandler handles the turn-end sequence and player advancement.
 *
 * This includes:
 * - Card expirations (endOfTurn)
 * - Active effects processing for all players
 * - Re-roll flag resets
 * - Turn-end logging
 * - Quick start finalization
 * - Determining next player with skip-turn logic
 * - Advancing turn counter and setting current player
 * - Resetting turn flags
 * - Sending end-turn notifications
 *
 * Extracted from TurnService for better separation of concerns.
 */
export class TurnTransitionHandler {
  constructor(
    private stateService: IStateService,
    private cardService: ICardService,
    private loggingService: ILoggingService,
    private effectEngineService?: IEffectEngineService,
    private notificationService?: INotificationService
  ) {}

  /**
   * Set the EffectEngineService after construction (for circular dependency handling)
   */
  public setEffectEngineService(service: IEffectEngineService): void {
    this.effectEngineService = service;
  }

  /**
   * Set the NotificationService after construction
   */
  public setNotificationService(service: INotificationService): void {
    this.notificationService = service;
  }

  /**
   * Process end-of-turn effects for the current player.
   *
   * Orchestrates the full turn-end sequence:
   * - STEP 1: Card expirations (calls cardService.endOfTurn())
   * - STEP 2: Active effects processing (calls effectEngineService.processActiveEffectsForCurrentPlayer())
   * - STEP 3: Reset re-roll flags for current player
   * - STEP 4: Log turn end
   * - STEP 4.5: Quick start finalization
   *
   * @param currentPlayerId - The ID of the player whose turn is ending
   */
  public async processEndOfTurn(currentPlayerId: string): Promise<void> {
    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;
    const currentPlayerIndex = allPlayers.findIndex(p => p.id === currentPlayerId);
    const currentPlayer = allPlayers[currentPlayerIndex];

    // STEP 1: Process card expirations BEFORE turn advances
    // This ensures turnsRemaining counter works correctly:
    // - Card activated turn 5 with duration=3
    // - Turn 5 ends: turnsRemaining-- (now 2), turn advances to 6
    // - Turn 6 ends: turnsRemaining-- (now 1), turn advances to 7
    // - Turn 7 ends: turnsRemaining-- (now 0), EXPIRE, turn advances to 8
    // Result: Card active for turns 5, 6, 7 = 3 turns ✅
    this.cardService.endOfTurn();

    // STEP 2: Process active effects for the player whose turn is ending.
    // v3.0.119 — a duration effect now ticks only on the holder's own turn,
    // not every player's turn (this happens at end of current turn, before
    // the turn counter advances).
    if (this.effectEngineService) {
      await this.effectEngineService.processActiveEffectsForCurrentPlayer(currentPlayerId);
    }

    // STEP 3: Reset re-roll flags for current player ending their turn
    // One-time use flags are cleared before next turn begins
    if (currentPlayer.turnModifiers?.canReRoll) {
      this.stateService.updatePlayer({
        id: currentPlayer.id,
        turnModifiers: {
          ...currentPlayer.turnModifiers,
          canReRoll: false
        }
      });
    }

    // STEP 4: Emit turn_committed for the current player.
    // TIMING NOTE: Uses globalTurnCount + 1 to match turn_start numbering
    // Why +1? Turn hasn't advanced yet (still N-1), but we want to log "Turn N ended"
    // to match "Turn N started" from the beginning of this turn.
    // This is intentional and ensures turn start/end logs have matching numbers.
    // Domain-event stage 3: LogWriter + ToastWriter both react to this one
    // emission (replaces the former separate loggingService.info here +
    // notificationService.notify in advanceToNextPlayer below — verified
    // both read the same completed-turn number, just via different
    // variables at different points in the sequence).
    this.stateService.emitGameEvent({
      type: 'turn_committed',
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      turn: gameState.globalTurnCount + 1,
      spaceName: currentPlayer.currentSpace,
    });

    // STEP 4.5: Quick Start mode - finalize starting hand after P1's first turn
    // This distributes P1's captured card draws to all other players
    if (gameState.isCapturingStartingHand && currentPlayerIndex === 0) {
      this.finalizeQuickStartHand();
    }
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
   *
   * (Moved here from TurnService 2026-07-16 — it only ever needed
   * stateService + loggingService, both of which live here; the old
   * "accesses TurnService internals" callback justification was stale.)
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
   * Advance to the next player, handling skip-turn logic.
   *
   * This handles:
   * - Determining next player index (wrap around)
   * - Skip turn logic (while loop for multiple consecutive skips)
   * - STEP 5: Advancing turn counter
   * - STEP 6: Setting current player and resetting turn flags
   * - Sending end-turn notification
   *
   * @param currentPlayerIndex - Index of the current player in the players array
   * @param allPlayers - Array of all players
   * @returns The ID of the next player
   */
  public advanceToNextPlayer(currentPlayerIndex: number, allPlayers: Player[]): string {
    const currentPlayer = allPlayers[currentPlayerIndex];

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

    // Domain-event stage 3: the "Turn Ended" toast is now derived by
    // ToastWriter from the emitGameEvent('turn_committed') call in
    // processEndOfTurn above — the standalone notify() that used to live
    // here is gone.

    return nextPlayer.id;
  }
}
