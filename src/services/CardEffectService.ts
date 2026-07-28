/**
 * CardEffectService - Handles card-related space effects
 *
 * Extracted from TurnService to consolidate card operations and eliminate code duplication.
 * This service handles: draw, replace, return, give, and transfer card operations
 * triggered by space effects.
 *
 * Architecture: This service focuses on card operations only. The calling code
 * (TurnService) handles turn-related wrap-up like marking actions complete
 * and restoring movement choices.
 */

import { ICardService, IStateService, IDataService, IChoiceService } from '../types/ServiceContracts';
import { debugLog } from '../utils/debugLog';
import { SpaceEffect, CardType } from '../types/DataTypes';
import { Player } from '../types/StateTypes';

/**
 * Result of a card effect operation
 */
export interface CardEffectResult {
  success: boolean;
  cardsAffected: string[];
  message?: string;
}

/**
 * Interface for CardEffectService
 */
export interface ICardEffectService {
  executeCardEffect(
    playerId: string,
    effect: SpaceEffect,
    effectType: string
  ): Promise<CardEffectResult>;
}

export class CardEffectService implements ICardEffectService {
  constructor(
    private readonly cardService: ICardService,
    private readonly stateService: IStateService,
    private readonly dataService: IDataService,
    private readonly choiceService: IChoiceService
  ) {}

  private getTypeName(cardType: string): string {
    switch (cardType) {
      case 'W': return 'Work';
      case 'B': return 'Bank';
      case 'E': return 'Expeditor';
      case 'L': return 'Life Events';
      case 'I': return 'Investment';
      default: return cardType;
    }
  }

  /**
   * Execute a card effect from a space
   *
   * @param playerId - The player receiving the effect
   * @param effect - The space effect to execute
   * @param effectType - The effect type string (used for logging)
   * @returns Result with success status and cards affected
   */
  public async executeCardEffect(
    playerId: string,
    effect: SpaceEffect,
    _effectType: string
  ): Promise<CardEffectResult> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return { success: false, cardsAffected: [], message: `Player ${playerId} not found` };
    }

    // Parse the action and value
    const action = effect.effect_action.toLowerCase();
    const value = this.parseEffectValue(effect.effect_value);

    debugLog(`🃏 [CardEffectService] Executing ${action} with value ${value} for player ${player.name}`);

    switch (action) {
      case 'draw_w':
        return this.handleDrawCards(playerId, player, 'W', value);
      case 'draw_b':
        return this.handleDrawCards(playerId, player, 'B', value);
      case 'draw_e':
        return this.handleDrawCards(playerId, player, 'E', value);
      case 'draw_l':
        return this.handleDrawCards(playerId, player, 'L', value);
      case 'draw_i':
        return this.handleDrawCards(playerId, player, 'I', value);
      case 'replace_e':
        return this.handleReplaceCards(playerId, player, 'E', value);
      case 'replace_l':
        return this.handleReplaceCards(playerId, player, 'L', value);
      case 'return_e':
        return this.handleReturnCards(playerId, player, 'E', value);
      case 'return_l':
        return this.handleReturnCards(playerId, player, 'L', value);
      case 'give_e':
        return this.handleGiveCard(playerId, player, 'E');
      case 'transfer':
        return this.handleTransferCard(playerId, player, effect);
      default:
        return { success: false, cardsAffected: [], message: `Unknown card action: ${action}` };
    }
  }

  /**
   * Check if an action is a card effect action
   */
  public isCardAction(action: string): boolean {
    const cardActions = [
      'draw_w', 'draw_b', 'draw_e', 'draw_l', 'draw_i',
      'replace_e', 'replace_l',
      'return_e', 'return_l',
      'give_e', 'transfer'
    ];
    return cardActions.includes(action.toLowerCase());
  }

  /**
   * Parse effect value to extract numeric count
   * Handles undefined, null, numbers, and strings containing numbers
   */
  private parseEffectValue(effectValue: string | number | undefined | null): number {
    if (effectValue === undefined || effectValue === null) {
      return 1; // Default to 1 card if not specified
    }
    if (typeof effectValue === 'number') {
      return effectValue;
    }
    const match = effectValue.match(/\d+/);
    return match ? parseInt(match[0]) : 1;
  }

  /**
   * Handle drawing cards of a specific type
   */
  private handleDrawCards(
    playerId: string,
    player: Player,
    cardType: CardType,
    count: number
  ): CardEffectResult {
    debugLog(`🃏 Drawing ${count} ${cardType} card(s) for ${player.name}`);

    const drawnCards = this.cardService.drawCards(
      playerId,
      cardType,
      count,
      'manual_effect',
      `Manual action: Draw ${count} ${cardType} card${count !== 1 ? 's' : ''}`
    );

    // Special handling for funding spaces: auto-play funding cards (B and I).
    // 2026-05-18 audit: lifted from hardcoded space-name array to data flag.
    const isFundingSpace = this.dataService?.isFundingSpace(player.currentSpace) ?? false;
    const isFundingCard = cardType === 'B' || cardType === 'I';

    if (isFundingSpace && isFundingCard && drawnCards.length > 0) {
      debugLog(`💰 ${player.currentSpace}: Auto-playing ${drawnCards.length} funding card(s)`);
      for (const cardId of drawnCards) {
        this.cardService.applyCardEffects(playerId, cardId);
        this.cardService.finalizePlayedCard(playerId, cardId);
      }
    }

    return {
      success: true,
      cardsAffected: drawnCards,
      message: `Drew ${drawnCards.length} ${cardType} card(s)`
    };
  }

  /**
   * Handle replacing cards of a specific type
   */
  private async handleReplaceCards(
    playerId: string,
    player: Player,
    cardType: CardType,
    count: number
  ): Promise<CardEffectResult> {
    const currentCards = this.cardService.getPlayerCards(playerId, cardType);
    const replaceCount = Math.min(count, currentCards.length);

    if (replaceCount === 0) {
      debugLog(`${player.name} has no ${cardType} cards to replace`);
      return { success: true, cardsAffected: [], message: `No ${cardType} cards to replace` };
    }

    const affectedCards: string[] = [];

    if (currentCards.length === 1 || replaceCount === currentCards.length) {
      // No choice needed - replace all
      const cardsToDiscard = currentCards.slice(0, replaceCount);
      this.cardService.discardCards(
        playerId,
        cardsToDiscard,
        'manual_effect',
        `Manual action: Replace ${replaceCount} ${cardType} cards - removing old cards`
      );
      affectedCards.push(...cardsToDiscard);

      const newCards = this.cardService.drawCards(
        playerId,
        cardType,
        replaceCount,
        'manual_effect',
        `Manual action: Replace ${replaceCount} ${cardType} cards - adding new cards`
      );
      affectedCards.push(...newCards);
    } else {
      // Multiple cards - create choice for which to replace
      debugLog(`${player.name} has ${currentCards.length} ${cardType} cards, creating choice for replacement`);

      const options = currentCards.map(cardId => {
        const cardData = this.dataService.getCardById(cardId);
        return {
          id: cardId,
          label: cardData ? cardData.card_name : `${cardType} ${cardId}`
        };
      });

      const selectedCardId = await this.choiceService.createChoice(
        playerId,
        'CARD_REPLACEMENT',
        `Choose ${replaceCount} ${this.getTypeName(cardType)} to replace:`,
        options,
        { newCardType: cardType, replaceCount }
      );

      if (selectedCardId && selectedCardId !== '') {
        debugLog(`Player selected card ${selectedCardId} for replacement`);
        this.cardService.replaceCard(playerId, selectedCardId, cardType);
        affectedCards.push(selectedCardId);
      } else {
        debugLog(`Player skipped card replacement`);
      }

      this.stateService.clearAwaitingChoice();
    }

    return {
      success: true,
      cardsAffected: affectedCards,
      message: `Replaced ${affectedCards.length > 0 ? affectedCards.length / 2 : 0} ${cardType} card(s)`
    };
  }

  /**
   * Handle returning cards of a specific type
   */
  private async handleReturnCards(
    playerId: string,
    player: Player,
    cardType: CardType,
    count: number
  ): Promise<CardEffectResult> {
    const currentCards = this.cardService.getPlayerCards(playerId, cardType);
    const returnCount = Math.min(count, currentCards.length);

    if (returnCount === 0) {
      debugLog(`${player.name} has no ${cardType} cards to return`);
      return { success: true, cardsAffected: [], message: `No ${cardType} cards to return` };
    }

    const cardsToReturn: string[] = [];

    if (returnCount === 1 && currentCards.length === 1) {
      // Only one card - return it directly
      cardsToReturn.push(currentCards[0]);
    } else {
      // Multiple cards - need to choose which to return
      debugLog(`${player.name} has ${currentCards.length} ${cardType} cards, need to return ${returnCount}`);

      for (let i = 0; i < returnCount; i++) {
        const remainingCards = currentCards.filter(id => !cardsToReturn.includes(id));
        if (remainingCards.length === 0) break;

        if (remainingCards.length === 1) {
          cardsToReturn.push(remainingCards[0]);
        } else {
          const options = remainingCards.map(cardId => {
            const cardData = this.dataService.getCardById(cardId);
            return {
              id: cardId,
              label: cardData ? cardData.card_name : `${cardType} ${cardId}`
            };
          });

          const selectedCardId = await this.choiceService.createChoice(
            playerId,
            'CARD_SELECTION',
            `Select ${this.getTypeName(cardType)} to return (${i + 1} of ${returnCount}):`,
            options
          );

          if (selectedCardId && selectedCardId !== '') {
            cardsToReturn.push(selectedCardId);
          }
          this.stateService.clearAwaitingChoice();
        }
      }
    }

    if (cardsToReturn.length > 0) {
      this.cardService.discardCards(
        playerId,
        cardsToReturn,
        'manual_effect',
        `Manual action: Return ${cardsToReturn.length} ${cardType} card${cardsToReturn.length > 1 ? 's' : ''}`
      );
      debugLog(`${player.name} returns ${cardType} cards: ${cardsToReturn.join(', ')}`);
    }

    return {
      success: true,
      cardsAffected: cardsToReturn,
      message: `Returned ${cardsToReturn.length} ${cardType} card(s)`
    };
  }

  /**
   * Handle giving a card to the next player (to the right)
   */
  private async handleGiveCard(
    playerId: string,
    player: Player,
    cardType: CardType
  ): Promise<CardEffectResult> {
    const gameState = this.stateService.getGameState();
    const players = gameState.players;
    const currentPlayerIndex = players.findIndex(p => p.id === playerId);

    // Get next player (to the right / next in turn order)
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const targetPlayer = players[nextPlayerIndex];

    if (targetPlayer.id === playerId) {
      debugLog(`${player.name} is the only player, cannot give card to self`);
      return { success: true, cardsAffected: [], message: 'Cannot give card to self' };
    }

    const currentCards = this.cardService.getPlayerCards(playerId, cardType);

    if (currentCards.length === 0) {
      debugLog(`${player.name} has no ${cardType} cards to give`);
      return { success: true, cardsAffected: [], message: `No ${cardType} cards to give` };
    }

    let cardToGive: string | null = null;

    if (currentCards.length === 1) {
      cardToGive = currentCards[0];
    } else {
      // Multiple cards - create choice
      debugLog(`${player.name} has ${currentCards.length} ${cardType} cards, creating choice`);

      const options = currentCards.map(cardId => {
        const cardData = this.dataService.getCardById(cardId);
        return {
          id: cardId,
          label: cardData ? cardData.card_name : `${cardType} ${cardId}`
        };
      });

      const selectedCardId = await this.choiceService.createChoice(
        playerId,
        'CARD_GIVE',
        `Select ${this.getTypeName(cardType)} to give to ${targetPlayer.name}:`,
        options,
        { targetPlayerId: targetPlayer.id, targetPlayerName: targetPlayer.name }
      );

      if (selectedCardId && selectedCardId !== '') {
        cardToGive = selectedCardId;
      }
      this.stateService.clearAwaitingChoice();
    }

    if (cardToGive) {
      this.cardService.transferCard(
        playerId,
        targetPlayer.id,
        cardToGive,
        'manual_effect',
        `Manual action: Give ${cardType} card to ${targetPlayer.name}`
      );
      debugLog(`${player.name} gives ${cardType} card ${cardToGive} to ${targetPlayer.name}`);
      return { success: true, cardsAffected: [cardToGive], message: `Gave card to ${targetPlayer.name}` };
    }

    return { success: true, cardsAffected: [], message: 'No card selected to give' };
  }

  /**
   * Handle transferring E card based on effect condition (left/right player)
   */
  private async handleTransferCard(
    playerId: string,
    player: Player,
    effect: SpaceEffect
  ): Promise<CardEffectResult> {
    const targetPlayer = this.getTargetPlayer(playerId, effect.condition);

    if (!targetPlayer) {
      debugLog(`${player.name} could not transfer cards - no target player found`);
      return { success: true, cardsAffected: [], message: 'No target player found' };
    }

    // Transfer specifically E cards (as per space effects intent)
    const eCards = this.cardService.getPlayerCards(playerId, 'E');

    if (eCards.length === 0) {
      debugLog(`${player.name} has no E cards to transfer`);
      return { success: true, cardsAffected: [], message: 'No E cards to transfer' };
    }

    let cardToTransfer: string | null = null;

    if (eCards.length === 1) {
      // Only one E card - transfer it
      cardToTransfer = eCards[0];
    } else {
      // Multiple E cards - let player choose
      debugLog(`${player.name} has ${eCards.length} E cards, creating choice`);

      const options = eCards.map(cardId => {
        const cardData = this.dataService.getCardById(cardId);
        return {
          id: cardId,
          label: cardData ? cardData.card_name : `Expeditor ${cardId}`
        };
      });

      const directionText = effect.condition === 'left' ? 'left' : 'right';
      const selectedCardId = await this.choiceService.createChoice(
        playerId,
        'CARD_GIVE',
        `Select Expeditor to reassign to ${targetPlayer.name} (on your ${directionText}):`,
        options,
        { targetPlayerId: targetPlayer.id, targetPlayerName: targetPlayer.name }
      );

      if (selectedCardId && selectedCardId !== '') {
        cardToTransfer = selectedCardId;
      }
      this.stateService.clearAwaitingChoice();
    }

    if (cardToTransfer) {
      this.cardService.transferCard(
        playerId,
        targetPlayer.id,
        cardToTransfer,
        'manual_effect',
        `Manual action: Transfer E card to ${targetPlayer.name}`
      );
      debugLog(`${player.name} transfers E card ${cardToTransfer} to ${targetPlayer.name}`);
      return { success: true, cardsAffected: [cardToTransfer], message: `Gave E card to ${targetPlayer.name}` };
    }

    return { success: true, cardsAffected: [], message: 'No E card selected to transfer' };
  }

  /**
   * Get target player based on condition string
   */
  private getTargetPlayer(playerId: string, condition?: string): Player | null {
    const gameState = this.stateService.getGameState();
    const players = gameState.players;
    const currentPlayerIndex = players.findIndex(p => p.id === playerId);

    if (condition === 'next_player' || condition === 'right') {
      const nextIndex = (currentPlayerIndex + 1) % players.length;
      return players[nextIndex].id !== playerId ? players[nextIndex] : null;
    }

    if (condition === 'prev_player' || condition === 'left') {
      const prevIndex = (currentPlayerIndex - 1 + players.length) % players.length;
      return players[prevIndex].id !== playerId ? players[prevIndex] : null;
    }

    // Default: next player
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    return players[nextIndex].id !== playerId ? players[nextIndex] : null;
  }
}
