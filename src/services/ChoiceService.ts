import { IChoiceService, IStateService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { Choice } from '../types/CommonTypes';
import { GameState } from '../types/StateTypes';

/**
 * Unified Choice Service
 * 
 * Provides a generic, promise-based system for handling player choices.
 * Can be used by any service that needs player input (movement, targeting, etc.)
 * 
 * Features:
 * - Promise-based choice resolution
 * - Type-safe choice options with validation
 * - Generic enough to handle movement, player targeting, and other choice types
 * - Centralized choice state management
 */
export class ChoiceService implements IChoiceService {
  private stateService: IStateService;
  private pendingChoices: Map<string, { resolve: (value: string) => void; reject: (reason: any) => void }> = new Map();

  constructor(stateService: IStateService) {
    this.stateService = stateService;

    // Observe cross-runtime resolution relays (fb:068a66f2). When another
    // device answers a choice whose pending promise we own, it stamps
    // awaitingChoice.resolvedWith via StateService.setChoiceResolution; that
    // syncs to us over WebSocket and fires this subscriber, where we resolve
    // the local promise. Guarded for the mock StateService in unit tests.
    if (typeof this.stateService.subscribe === 'function') {
      this.stateService.subscribe((state) => this.handleRelayedResolution(state));
    }
  }

  /**
   * Resolve a locally-owned promise from a relayed selection in synced state.
   * No-op unless there is an active choice carrying a `resolvedWith` selection
   * AND we hold its pending promise. Idempotent: once resolved the choice is
   * cleared, so a repeated state notification early-returns. (fb:068a66f2)
   * @private
   */
  private handleRelayedResolution(state: GameState): void {
    const choice = state.awaitingChoice;
    const selection = choice?.resolvedWith;
    if (!choice || !selection) return;

    const pending = this.pendingChoices.get(choice.id);
    if (!pending) return; // We don't own this promise (or it's already resolved).

    // Validate the relayed selection against the choice's own options.
    if (!choice.options.some(opt => opt.id === selection)) {
      debugWarn(`⚠️ [CHOICE] Relayed selection "${selection}" not a valid option for choice ${choice.id} — ignoring.`);
      return;
    }

    this.pendingChoices.delete(choice.id);
    pending.resolve(selection);
    // Clearing wipes resolvedWith for everyone and closes the modal on all devices.
    this.stateService.clearAwaitingChoice();
  }

  /**
   * Create a new choice and return a promise that resolves when the choice is made
   */
  async createChoice(
    playerId: string,
    type: Choice['type'],
    prompt: string,
    options: Choice['options'],
    metadata?: Choice['metadata']
  ): Promise<string> {
    // Generate unique ID for this choice
    const choiceId = this.generateChoiceId();

    // Validate inputs
    if (!playerId) {
      throw new Error('Player ID is required for choice creation');
    }

    if (!options || options.length === 0) {
      throw new Error('At least one option is required for choice creation');
    }

    // Validate that all options have required properties
    for (const option of options) {
      if (!option.id || !option.label) {
        throw new Error('All choice options must have both id and label properties');
      }
    }

    // Cancel any existing pending choice before creating a new one
    // This prevents orphaned promises that timeout with console errors
    const existingChoice = this.getActiveChoice();
    if (existingChoice && this.pendingChoices.has(existingChoice.id)) {
      const pending = this.pendingChoices.get(existingChoice.id)!;
      this.pendingChoices.delete(existingChoice.id);
      pending.resolve(''); // Resolve with empty to indicate cancellation
    }

    // Create the choice object
    const choice: Choice = {
      id: choiceId,
      playerId,
      type,
      prompt,
      options,
      ...(metadata && { metadata })
    };


    // Set the choice in game state
    this.stateService.setAwaitingChoice(choice);

    // Create and store the promise for resolution
    return new Promise<string>((resolve, reject) => {
      this.pendingChoices.set(choiceId, { resolve, reject });

      // Set a timeout to prevent hanging indefinitely
      setTimeout(() => {
        if (this.pendingChoices.has(choiceId)) {
          this.pendingChoices.delete(choiceId);
          this.stateService.clearAwaitingChoice();
          reject(new Error(`Choice ${choiceId} timed out after 5 minutes`));
        }
      }, 5 * 60 * 1000); // 5 minute timeout
    });
  }

  /**
   * Resolve an active choice with the player's selection
   */
  resolveChoice(choiceId: string, selection: string): boolean {

    // Get the active choice from game state
    const activeChoice = this.getActiveChoice();

    if (!activeChoice) {
      console.error(`❌ [CHOICE] resolveChoice FAILED: No active choice in state. choiceId=${choiceId}, selection=${selection}, pendingCount=${this.pendingChoices.size}`);
      return false;
    }


    if (activeChoice.id !== choiceId) {
      console.error(`❌ [CHOICE] resolveChoice FAILED: ID mismatch. expected=${activeChoice.id}, got=${choiceId}, type=${activeChoice.type}, selection=${selection}`);
      return false;
    }

    // Validate the selection against available options
    const validOption = activeChoice.options.find(option => option.id === selection);
    if (!validOption) {
      console.error(`❌ [CHOICE] resolveChoice FAILED: Invalid selection "${selection}". type=${activeChoice.type}, validOptions=[${activeChoice.options.map(opt => opt.id).join(', ')}]`);
      return false;
    }


    // Get the pending promise for this choice
    const pendingChoice = this.pendingChoices.get(choiceId);
    if (!pendingChoice) {
      // Cross-runtime case (fb:068a66f2): this device renders the modal from
      // synced `awaitingChoice` but never called createChoice for it — the
      // promise lives on the device that ran this player's startTurn (for a
      // LOGIC_QUESTION chain, the OUTGOING player's device, since startTurn
      // fires inside endTurn→nextPlayer). The selection is already validated
      // above, so relay it through shared state; the promise-owning device's
      // ChoiceService.handleRelayedResolution observes it and resolves.
      debugWarn(`↪️ [CHOICE] No local promise for ${choiceId} (type=${activeChoice.type}) — relaying selection "${selection}" via shared state for the owning runtime to resolve.`);
      this.stateService.setChoiceResolution(choiceId, selection);
      return true;
    }


    try {
      // Remove from pending choices
      this.pendingChoices.delete(choiceId);

      // Resolve the promise with the selection
      pendingChoice.resolve(selection);

      // Clear the choice from state (so End Turn button becomes enabled)
      this.stateService.clearAwaitingChoice();

      return true;

    } catch (error) {
      console.error(`❌ [CHOICE] Error resolving choice ${choiceId}:`, error);
      pendingChoice.reject(error);
      return false;
    }
  }

  /**
   * Skip/cancel an active choice without making a selection
   * Used when the action is optional and the player wants to skip it
   */
  skipChoice(choiceId: string): boolean {

    const activeChoice = this.getActiveChoice();
    if (!activeChoice || activeChoice.id !== choiceId) {
      debugWarn(`⚠️ [CHOICE] Cannot skip - no matching active choice`);
      return false;
    }

    const pendingChoice = this.pendingChoices.get(choiceId);
    if (pendingChoice) {
      // Remove from pending choices
      this.pendingChoices.delete(choiceId);

      // Resolve with empty string to indicate skip
      pendingChoice.resolve('');
    }

    // Clear the choice from state
    this.stateService.clearAwaitingChoice();
    return true;
  }

  /**
   * Get the currently active choice from game state
   */
  getActiveChoice(): Choice | null {
    const gameState = this.stateService.getGameState();
    return gameState.awaitingChoice;
  }

  /**
   * Check if there's an active choice waiting for resolution
   */
  hasActiveChoice(): boolean {
    return this.getActiveChoice() !== null;
  }

  // === PRIVATE HELPERS ===

  private generateChoiceId(): string {
    return `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // === DEBUG HELPERS ===

  /**
   * Get information about pending choices for debugging
   */
  getPendingChoicesInfo(): { choiceId: string; hasPromise: boolean }[] {
    return Array.from(this.pendingChoices.keys()).map(choiceId => ({
      choiceId,
      hasPromise: this.pendingChoices.has(choiceId)
    }));
  }

  /**
   * Clear all pending choices (for cleanup or testing)
   */
  clearAllPendingChoices(): void {
    // Reject all pending promises
    for (const [choiceId, { reject }] of this.pendingChoices.entries()) {
      reject(new Error(`Choice ${choiceId} was cancelled`));
    }
    
    // Clear the map
    this.pendingChoices.clear();
    
    // Clear game state
    this.stateService.clearAwaitingChoice();
    
  }
}
