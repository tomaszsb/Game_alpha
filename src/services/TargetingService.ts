// src/services/TargetingService.ts

import { IStateService, IChoiceService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';

export interface ITargetingService {
  resolveTargets(sourcePlayerId: string, targetRule: string): Promise<string[]>;
  isInteractiveTargeting(targetRule: string): boolean;
}

/**
 * TargetingService handles resolution of multi-player effect targets.
 * 
 * Supported target types:
 * - "Self": Only the source player
 * - "All Players": All players in the game
 * - "All Players-Self": All players except the source player
 * - "Choose Opponent": Player selects an opponent (interactive)
 * - "Choose Player": Player selects any player (interactive)
 */
export class TargetingService implements ITargetingService {
  constructor(
    private stateService: IStateService,
    private choiceService: IChoiceService
  ) {}

  /**
   * Resolves a target rule into an array of player IDs
   * @param sourcePlayerId - The player who initiated the effect
   * @param targetRule - The targeting rule from the card data
   * @returns Promise resolving to array of player IDs to target
   */
  async resolveTargets(sourcePlayerId: string, targetRule: string): Promise<string[]> {

    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;
    const sourcePlayer = allPlayers.find(p => p.id === sourcePlayerId);

    if (!sourcePlayer) {
      console.error(`Source player ${sourcePlayerId} not found`);
      return [];
    }

    switch (targetRule.trim()) {
      case 'Self':
        return [sourcePlayerId];

      case 'All Players':
        return allPlayers.map(p => p.id);

      case 'All Players-Self':
        return allPlayers.filter(p => p.id !== sourcePlayerId).map(p => p.id);

      case 'Choose Opponent':
        return await this.resolveChooseOpponent(sourcePlayerId);

      case 'Choose Player':
        return await this.resolveChoosePlayer(sourcePlayerId);

      default:
        debugWarn(`🎯 Unknown target rule: "${targetRule}", defaulting to Self`);
        return [sourcePlayerId];
    }
  }

  /**
   * Checks if a target rule requires interactive player choice
   * @param targetRule - The targeting rule to check
   * @returns true if the rule requires player interaction
   */
  isInteractiveTargeting(targetRule: string): boolean {
    const interactiveRules = ['Choose Opponent', 'Choose Player'];
    return interactiveRules.includes(targetRule.trim());
  }

  /**
   * Handles "Choose Opponent" targeting - player selects from available opponents
   * @param sourcePlayerId - The player making the choice
   * @returns Promise resolving to array with selected opponent's ID
   */
  private async resolveChooseOpponent(sourcePlayerId: string): Promise<string[]> {

    const gameState = this.stateService.getGameState();
    const opponents = gameState.players.filter(p => p.id !== sourcePlayerId);

    if (opponents.length === 0) {
      return [];
    }

    if (opponents.length === 1) {
      // Only one opponent, auto-select
      const targetId = opponents[0].id;
      return [targetId];
    }

    // Multiple opponents, present choice
    const options = opponents.map(opponent => ({
      id: opponent.id,
      label: opponent.name
    }));

    const result = await this.choiceService.createChoice(
      sourcePlayerId,
      'TARGET_SELECTION',
      'Choose an opponent to target with this effect:',
      options
    );
    
    if (result) {
      const selectedOpponent = opponents.find(p => p.id === result);
      return [result];
    } else {
      debugWarn(`   🎯 Choose Opponent selection failed or cancelled`);
      return [];
    }
  }

  /**
   * Handles "Choose Player" targeting - player selects from all players
   * @param sourcePlayerId - The player making the choice
   * @returns Promise resolving to array with selected player's ID
   */
  private async resolveChoosePlayer(sourcePlayerId: string): Promise<string[]> {

    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;

    if (allPlayers.length === 1) {
      // Only current player, auto-select self
      return [sourcePlayerId];
    }

    // Multiple players, present choice
    const options = allPlayers.map(player => ({
      id: player.id,
      label: player.name + (player.id === sourcePlayerId ? ' (You)' : '')
    }));

    const result = await this.choiceService.createChoice(
      sourcePlayerId,
      'TARGET_SELECTION',
      'Choose a player to target with this effect:',
      options
    );
    
    if (result) {
      const selectedPlayer = allPlayers.find(p => p.id === result);
      return [result];
    } else {
      debugWarn(`   🎯 Choose Player selection failed or cancelled`);
      return [];
    }
  }

  /**
   * Gets displayable target information for logging/UI purposes
   * @param targetIds - Array of target player IDs
   * @returns String description of the targets
   */
  getTargetDescription(targetIds: string[]): string {
    if (targetIds.length === 0) {
      return 'No targets';
    }

    const gameState = this.stateService.getGameState();
    const targetNames = targetIds.map(id => {
      const player = gameState.players.find(p => p.id === id);
      return player ? player.name : `Unknown Player (${id})`;
    });

    if (targetIds.length === 1) {
      return targetNames[0];
    } else if (targetIds.length === gameState.players.length) {
      return 'All Players';
    } else {
      return targetNames.join(', ');
    }
  }
}
