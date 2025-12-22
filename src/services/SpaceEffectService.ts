import { IStateService, ICardService, IResourceService, IGameRulesService, IDiceService } from '../types/ServiceContracts';
import { GameState, Player } from '../types/StateTypes';
import { DiceEffect, SpaceEffect, CardType } from '../types/DataTypes';

/**
 * SpaceEffectService - Handles application of space and dice effects
 *
 * Extracted from TurnService to create a focused service for:
 * - Dice roll effect application (cards, money, time, quality)
 * - Space effect application (money, time changes)
 * - Target player resolution for transfer effects
 */
export interface ISpaceEffectService {
  applyDiceEffect(playerId: string, effect: DiceEffect, diceRoll: number, currentState: GameState): GameState;
  applyCardEffect(playerId: string, cardType: string, effect: string): GameState;
  applyMoneyEffect(playerId: string, effect: string): GameState;
  applyTimeEffect(playerId: string, effect: string): GameState;
  applyQualityEffect(playerId: string, effect: string): GameState;
  applySpaceMoneyEffect(playerId: string, effect: SpaceEffect): GameState;
  applySpaceTimeEffect(playerId: string, effect: SpaceEffect): GameState;
  getTargetPlayer(currentPlayerId: string, condition: string): Player | null;
}

export class SpaceEffectService implements ISpaceEffectService {
  constructor(
    private readonly stateService: IStateService,
    private readonly cardService: ICardService,
    private readonly resourceService: IResourceService,
    private readonly gameRulesService: IGameRulesService,
    private readonly diceService: IDiceService
  ) {}

  /**
   * Apply a dice effect based on the roll result
   */
  applyDiceEffect(
    playerId: string,
    effect: DiceEffect,
    diceRoll: number,
    currentState: GameState
  ): GameState {
    // Get the effect for the specific dice roll
    const rollEffect = this.diceService.getDiceRollEffect(effect, diceRoll);

    if (!rollEffect || rollEffect === 'No change') {
      return currentState;
    }

    // Apply effect based on type
    switch (effect.effect_type) {
      case 'cards':
        return this.applyCardEffect(playerId, effect.card_type || 'W', rollEffect);

      case 'money':
        return this.applyMoneyEffect(playerId, rollEffect);

      case 'time':
        return this.applyTimeEffect(playerId, rollEffect);

      case 'quality':
        return this.applyQualityEffect(playerId, rollEffect);

      default:
        console.warn(`Unknown effect type: ${effect.effect_type}`);
        return currentState;
    }
  }

  /**
   * Apply a card effect (draw, remove, replace)
   */
  applyCardEffect(playerId: string, cardType: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    if (effect.includes('Draw')) {
      const drawCount = this.diceService.parseNumericValue(effect);
      if (drawCount > 0) {
        // Use unified CardService.drawCards with source tracking
        const drawnCardIds = this.cardService.drawCards(
          playerId,
          cardType as CardType,
          drawCount,
          'turn_effect',
          `Draw ${drawCount} ${cardType} card${drawCount > 1 ? 's' : ''} from space effect`
        );
        console.log(`Player ${player.name} draws ${drawCount} ${cardType} cards:`, drawnCardIds);
      }
    } else if (effect.includes('Remove') || effect.includes('Discard')) {
      const removeCount = this.diceService.parseNumericValue(effect);
      if (removeCount > 0) {
        const currentCards = this.cardService.getPlayerCards(playerId, cardType as CardType);
        const cardsToRemove = currentCards.slice(0, removeCount);
        if (cardsToRemove.length > 0) {
          // Use unified CardService.discardCards with source tracking
          this.cardService.discardCards(
            playerId,
            cardsToRemove,
            'turn_effect',
            `Remove ${removeCount} ${cardType} card${removeCount > 1 ? 's' : ''} from space effect`
          );
        }
      }
    } else if (effect.includes('Replace')) {
      const replaceCount = this.diceService.parseNumericValue(effect);
      const currentCards = this.cardService.getPlayerCards(playerId, cardType as CardType);
      if (replaceCount > 0 && currentCards.length > 0) {
        // Remove old cards using discardCards
        const cardsToRemove = currentCards.slice(0, replaceCount);
        this.cardService.discardCards(
          playerId,
          cardsToRemove,
          'turn_effect',
          `Replace ${replaceCount} ${cardType} cards - removing old cards`
        );

        // Add new cards using drawCards
        const drawnCardIds = this.cardService.drawCards(
          playerId,
          cardType as CardType,
          replaceCount,
          'turn_effect',
          `Replace ${replaceCount} ${cardType} cards - adding new cards`
        );
        console.log(`Player ${player.name} replaces ${replaceCount} ${cardType} cards:`, drawnCardIds);
      }
    }

    // Return current state since CardService methods handle state updates
    return this.stateService.getGameState();
  }

  /**
   * Apply a money effect (percentage or fixed amount)
   */
  applyMoneyEffect(playerId: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    let moneyChange = 0;
    let description = '';

    if (effect.includes('%')) {
      // Percentage-based effect
      const percentage = this.diceService.parseNumericValue(effect);

      // Check if this is a design fee space (ARCH-FEE-REVIEW or ENG-FEE-REVIEW)
      // Design fees are calculated as percentage of project scope, not player's money
      const isDesignFeeSpace = player.currentSpace.includes('ARCH-FEE-REVIEW') ||
                               player.currentSpace.includes('ENG-FEE-REVIEW');

      if (isDesignFeeSpace) {
        // Calculate fee based on project scope (dynamically from W cards)
        const projectScope = this.gameRulesService.calculateProjectScope(playerId);
        moneyChange = -Math.floor((projectScope * percentage) / 100);
        const feeType = player.currentSpace.includes('ARCH') ? 'Architect' : 'Engineer';
        description = `${feeType} design fee: ${percentage}% of $${projectScope.toLocaleString()} = $${Math.abs(moneyChange).toLocaleString()}`;
        console.log(`💸 ${description}`);
      } else {
        // Default: percentage of current money (for other effects)
        moneyChange = Math.floor((player.money * percentage) / 100);
        description = `Space effect: ${percentage}% = $${Math.abs(moneyChange).toLocaleString()}`;
      }
    } else {
      // Fixed amount effect
      moneyChange = this.diceService.parseNumericValue(effect);
      description = `Space effect: $${Math.abs(moneyChange).toLocaleString()}`;
    }

    // Use unified ResourceService for money changes
    if (moneyChange > 0) {
      this.resourceService.addMoney(playerId, moneyChange, 'turn_effect', description, 'other');
    } else if (moneyChange < 0) {
      this.resourceService.spendMoney(playerId, Math.abs(moneyChange), 'turn_effect', description);
    }

    // Return current state since ResourceService handles state updates
    return this.stateService.getGameState();
  }

  /**
   * Apply a time effect
   */
  applyTimeEffect(playerId: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const timeChange = this.diceService.parseNumericValue(effect);

    // Use unified ResourceService for time changes
    if (timeChange > 0) {
      this.resourceService.addTime(playerId, timeChange, 'turn_effect', `Space effect: +${timeChange} time`);
    } else if (timeChange < 0) {
      this.resourceService.spendTime(playerId, Math.abs(timeChange), 'turn_effect', `Space effect: -${Math.abs(timeChange)} time`);
    }

    // Return current state since ResourceService handles state updates
    return this.stateService.getGameState();
  }

  /**
   * Apply a quality effect (logs quality level)
   */
  applyQualityEffect(playerId: string, effect: string): GameState {
    // Quality effects might affect other game state in the future
    // For now, just log the quality level
    console.log(`Player ${playerId} quality level: ${effect}`);
    return this.stateService.getGameState();
  }

  /**
   * Apply a space-based money effect
   */
  applySpaceMoneyEffect(playerId: string, effect: SpaceEffect): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const value = typeof effect.effect_value === 'string' ?
      parseInt(effect.effect_value) : effect.effect_value;

    let newMoney = player.money;

    if (effect.effect_action === 'add') {
      newMoney += value;
    } else if (effect.effect_action === 'subtract') {
      newMoney -= value;
    } else if (effect.effect_action === 'fee_percent') {
      // Apply percentage-based fee
      const feeAmount = Math.floor((player.money * value) / 100);
      newMoney -= feeAmount;
      console.log(`Player ${player.name} pays ${value}% fee (${feeAmount}) based on condition: ${effect.condition}`);
    } else if (effect.effect_action === 'add_per_amount') {
      // Calculate based on condition (e.g., "per_200k" = per $200,000)
      let additionalAmount = value;

      if (effect.condition === 'per_200k') {
        // Calculate amount based on total borrowed (sum of all loan principals)
        const totalBorrowed = player.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
        const multiplier = Math.floor(totalBorrowed / 200000);
        additionalAmount = value * multiplier;
        console.log(`Player ${player.name} gains ${additionalAmount} money (${value} per $200K, borrowed ${totalBorrowed})`);
      } else {
        // For other conditions, use value directly (fallback)
        console.warn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
      }

      newMoney += additionalAmount;
    }

    newMoney = Math.max(0, newMoney); // Ensure money doesn't go below 0

    console.log(`Player ${player.name} money change: ${effect.effect_action} ${value}, new total: ${newMoney}`);

    return this.stateService.updatePlayer({
      id: playerId,
      money: newMoney
    });
  }

  /**
   * Apply a space-based time effect
   */
  applySpaceTimeEffect(playerId: string, effect: SpaceEffect): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const value = typeof effect.effect_value === 'string' ?
      parseInt(effect.effect_value) : effect.effect_value;

    let newTime = player.timeSpent || 0;

    if (effect.effect_action === 'add') {
      newTime += value;
    } else if (effect.effect_action === 'subtract') {
      newTime -= value;
    } else if (effect.effect_action === 'add_per_amount') {
      // Calculate based on condition (e.g., "per_200k" = per $200,000)
      let additionalTime = value;

      if (effect.condition === 'per_200k') {
        // Calculate time based on total borrowed (sum of all loan principals)
        const totalBorrowed = player.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
        const multiplier = Math.floor(totalBorrowed / 200000);
        additionalTime = value * multiplier;
        console.log(`Player ${player.name} gains ${additionalTime} time (${value} per $200K, borrowed ${totalBorrowed})`);
      } else {
        // For other conditions, use value directly (fallback)
        console.warn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
      }

      newTime += additionalTime;
    }

    newTime = Math.max(0, newTime); // Ensure time doesn't go below 0

    console.log(`Player ${player.name} time change: ${effect.effect_action} ${value}, new total: ${newTime}`);

    return this.stateService.updatePlayer({
      id: playerId,
      timeSpent: newTime
    });
  }

  /**
   * Get target player for transfer effects based on condition
   */
  getTargetPlayer(currentPlayerId: string, condition: string): Player | null {
    const gameState = this.stateService.getGameState();
    const players = gameState.players;
    const currentPlayerIndex = players.findIndex(p => p.id === currentPlayerId);

    if (currentPlayerIndex === -1) {
      return null;
    }

    if (condition === 'to_right') {
      // Get player to the right (next in turn order)
      const targetIndex = (currentPlayerIndex + 1) % players.length;
      return players[targetIndex];
    } else if (condition === 'to_left') {
      // Get player to the left (previous in turn order)
      const targetIndex = (currentPlayerIndex - 1 + players.length) % players.length;
      return players[targetIndex];
    }

    // Unknown condition
    console.warn(`Unknown transfer condition: ${condition}`);
    return null;
  }
}
