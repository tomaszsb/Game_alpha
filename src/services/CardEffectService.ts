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
    effectType: string
  ): Promise<CardEffectResult> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return { success: false, cardsAffected: [], message: `Player ${playerId} not found` };
    }

    // Parse the action and value
    const action = effect.effect_action.toLowerCase();
    const value = this.parseEffectValue(effect.effect_value);

    console.log(`🃏 [CardEffectService] Executing ${action} with value ${value} for player ${player.name}`);

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
   */
  private parseEffectValue(effectValue: string | number): number {
    if (typeof effectValue === 'number') {
      return effectValue;
    }
    const match = effectValue.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
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
    console.log(`🃏 Drawing ${count} ${cardType} card(s) for ${player.name}`);

    const drawnCards = this.cardService.drawCards(
      playerId,
      cardType,
      count,
      'manual_effect',
      `Manual action: Draw ${count} ${cardType} card${count !== 1 ? 's' : ''}`
    );

    // Special handling for OWNER-FUND-INITIATION: auto-play funding cards (B and I)
    if (player.currentSpace === 'OWNER-FUND-INITIATION' &&
        (cardType === 'B' || cardType === 'I') &&
        drawnCards.length > 0) {
      console.log(`💰 OWNER-FUND-INITIATION: Auto-playing ${drawnCards.length} funding card(s)`);
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
      console.log(`${player.name} has no ${cardType} cards to replace`);
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
      console.log(`${player.name} has ${currentCards.length} ${cardType} cards, creating choice for replacement`);

      const options = currentCards.map(cardId => {
        const cardData = this.dataService.getCardById(cardId);
        return {
          id: cardId,
          label: cardData ? cardData.card_name : `${cardType} Card ${cardId}`
        };
      });

      const selectedCardId = await this.choiceService.createChoice(
        playerId,
        'CARD_REPLACEMENT',
        `Choose ${replaceCount} ${cardType} card${replaceCount !== 1 ? 's' : ''} to replace:`,
        options,
        { newCardType: cardType, replaceCount }
      );

      if (selectedCardId && selectedCardId !== '') {
        console.log(`Player selected card ${selectedCardId} for replacement`);
        this.cardService.replaceCard(playerId, selectedCardId, cardType);
        affectedCards.push(selectedCardId);
      } else {
        console.log(`Player skipped card replacement`);
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
      console.log(`${player.name} has no ${cardType} cards to return`);
      return { success: true, cardsAffected: [], message: `No ${cardType} cards to return` };
    }

    const cardsToReturn: string[] = [];

    if (returnCount === 1 && currentCards.length === 1) {
      // Only one card - return it directly
      cardsToReturn.push(currentCards[0]);
    } else {
      // Multiple cards - need to choose which to return
      console.log(`${player.name} has ${currentCards.length} ${cardType} cards, need to return ${returnCount}`);

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
              label: cardData ? cardData.card_name : `${cardType} Card ${cardId}`
            };
          });

          const selectedCardId = await this.choiceService.createChoice(
            playerId,
            'CARD_SELECTION',
            `Select ${cardType} card to return (${i + 1} of ${returnCount}):`,
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
      console.log(`${player.name} returns ${cardType} cards: ${cardsToReturn.join(', ')}`);
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
      console.log(`${player.name} is the only player, cannot give card to self`);
      return { success: true, cardsAffected: [], message: 'Cannot give card to self' };
    }

    const currentCards = this.cardService.getPlayerCards(playerId, cardType);

    if (currentCards.length === 0) {
      console.log(`${player.name} has no ${cardType} cards to give`);
      return { success: true, cardsAffected: [], message: `No ${cardType} cards to give` };
    }

    let cardToGive: string | null = null;

    if (currentCards.length === 1) {
      cardToGive = currentCards[0];
    } else {
      // Multiple cards - create choice
      console.log(`${player.name} has ${currentCards.length} ${cardType} cards, creating choice`);

      const options = currentCards.map(cardId => {
        const cardData = this.dataService.getCardById(cardId);
        return {
          id: cardId,
          label: cardData ? cardData.card_name : `${cardType} Card ${cardId}`
        };
      });

      const selectedCardId = await this.choiceService.createChoice(
        playerId,
        'CARD_GIVE',
        `Select ${cardType} card to give to ${targetPlayer.name}:`,
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
      console.log(`${player.name} gives ${cardType} card ${cardToGive} to ${targetPlayer.name}`);
      return { success: true, cardsAffected: [cardToGive], message: `Gave card to ${targetPlayer.name}` };
    }

    return { success: true, cardsAffected: [], message: 'No card selected to give' };
  }

  /**
   * Handle transferring any card based on effect condition
   */
  private async handleTransferCard(
    playerId: string,
    player: Player,
    effect: SpaceEffect
  ): Promise<CardEffectResult> {
    const targetPlayer = this.getTargetPlayer(playerId, effect.condition);

    if (!targetPlayer) {
      console.log(`${player.name} could not transfer cards - no target player found`);
      return { success: true, cardsAffected: [], message: 'No target player found' };
    }

    // Transfer a card from player's hand to target
    // Priority order: W, B, E, L, I (transfer most valuable first)
    const cardTypes: CardType[] = ['W', 'B', 'E', 'L', 'I'];
    let transferredCard: string | null = null;

    for (const cardType of cardTypes) {
      const playerCards = this.cardService.getPlayerCards(playerId, cardType);
      if (playerCards.length > 0) {
        transferredCard = playerCards[0];
        break;
      }
    }

    if (transferredCard) {
      this.cardService.transferCard(
        playerId,
        targetPlayer.id,
        transferredCard,
        'manual_effect',
        'Manual action: Transfer card'
      );
      console.log(`${player.name} transfers card ${transferredCard} to ${targetPlayer.name}`);
      return { success: true, cardsAffected: [transferredCard], message: `Transferred card to ${targetPlayer.name}` };
    }

    console.log(`${player.name} has no cards to transfer`);
    return { success: true, cardsAffected: [], message: 'No cards to transfer' };
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
