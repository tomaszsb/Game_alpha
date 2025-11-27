import { IChoiceService, IStateService } from '../types/ServiceContracts';
import { Choice } from '../types/CommonTypes';

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

    // Create the choice object
    const choice: Choice = {
      id: choiceId,
      playerId,
      type,
      prompt,
      options,
      ...(metadata && { metadata })
    };

    console.log(`🎯 Choice Created [${playerId}]: ${type} - "${prompt}"`);
    console.log(`   Options: ${options.map(opt => `${opt.id}:${opt.label}`).join(', ')}`);

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
    console.log(`🎯 Resolving Choice [${choiceId}]: Selection = "${selection}"`);

    // Get the active choice from game state
    const activeChoice = this.getActiveChoice();
    
    if (!activeChoice) {
      console.error(`ChoiceService.resolveChoice: No active choice found`);
      return false;
    }

    if (activeChoice.id !== choiceId) {
      console.error(`ChoiceService.resolveChoice: Choice ID mismatch. Expected ${activeChoice.id}, got ${choiceId}`);
      return false;
    }

    // Validate the selection against available options
    const validOption = activeChoice.options.find(option => option.id === selection);
    if (!validOption) {
      console.error(`ChoiceService.resolveChoice: Invalid selection "${selection}". Valid options: ${activeChoice.options.map(opt => opt.id).join(', ')}`);
      return false;
    }

    // Get the pending promise for this choice
    const pendingChoice = this.pendingChoices.get(choiceId);
    if (!pendingChoice) {
      console.error(`ChoiceService.resolveChoice: No pending promise found for choice ${choiceId}`);
      return false;
    }

    try {
      // Remove from pending choices
      this.pendingChoices.delete(choiceId);

      // Resolve the promise with the selection
      pendingChoice.resolve(selection);

      console.log(`✅ Choice Resolved [${choiceId}]: "${validOption.label}" selected`);
      return true;

    } catch (error) {
      console.error(`ChoiceService.resolveChoice: Error resolving choice ${choiceId}:`, error);
      pendingChoice.reject(error);
      return false;
    }
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
    
    console.log('🧹 All pending choices cleared');
  }
}