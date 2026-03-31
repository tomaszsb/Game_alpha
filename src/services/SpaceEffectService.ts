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
  applyMultiplierEffect(playerId: string, effect: string): GameState;
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

    // Apply effect based on type (normalize to lowercase and trim whitespace)
    const effectType = effect.effect_type.toLowerCase().trim();
    switch (effectType) {
      case 'cards':
        return this.applyCardEffect(playerId, effect.card_type || 'W', rollEffect);

      case 'money':
        return this.applyMoneyEffect(playerId, rollEffect);

      case 'time':
        return this.applyTimeEffect(playerId, rollEffect);

      case 'quality':
        return this.applyQualityEffect(playerId, rollEffect);

      case 'multiplier':
        return this.applyMultiplierEffect(playerId, rollEffect);

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
   * Apply a quality effect - stores contractor quality on player
   * Quality affects change order frequency: HIGH = fewer, LOW = more
   */
  applyQualityEffect(playerId: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse quality from effect string (e.g., "HIGH", "MED", "LOW")
    const qualityUpper = effect.toUpperCase().trim();
    let quality: 'HIGH' | 'MED' | 'LOW';

    if (qualityUpper === 'HIGH') {
      quality = 'HIGH';
    } else if (qualityUpper === 'MED' || qualityUpper === 'MEDIUM') {
      quality = 'MED';
    } else if (qualityUpper === 'LOW') {
      quality = 'LOW';
    } else {
      console.warn(`Unknown quality level: ${effect}, defaulting to MED`);
      quality = 'MED';
    }


    // Update player's contractor info, preserving existing multiplier if set
    const existingContractor = player.contractor || { quality: 'MED', multiplier: 1 };
    return this.stateService.updatePlayer({
      id: playerId,
      contractor: {
        ...existingContractor,
        quality,
        hiredAt: player.currentSpace
      }
    });
  }

  /**
   * Apply a multiplier effect - stores contractor cost multiplier on player
   * Multiplier affects base construction cost (1-6)
   * After setting multiplier, calculates and deducts construction costs
   */
  applyMultiplierEffect(playerId: string, effect: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse multiplier from effect string (e.g., "1", "2", ..., "6")
    const multiplier = parseInt(effect.trim(), 10);

    if (isNaN(multiplier) || multiplier < 1 || multiplier > 6) {
      console.warn(`Invalid multiplier: ${effect}, defaulting to 3`);
      const existingContractor = player.contractor || { quality: 'MED', multiplier: 3 };
      this.stateService.updatePlayer({
        id: playerId,
        contractor: {
          ...existingContractor,
          multiplier: 3,
          hiredAt: player.currentSpace
        }
      });
      // Calculate construction cost with default values
      return this.calculateAndDeductConstructionCost(playerId);
    }


    // Update player's contractor info, preserving existing quality if set
    const existingContractor = player.contractor || { quality: 'MED', multiplier: 1 };
    this.stateService.updatePlayer({
      id: playerId,
      contractor: {
        ...existingContractor,
        multiplier,
        hiredAt: player.currentSpace
      }
    });

    // Now calculate and deduct construction costs
    return this.calculateAndDeductConstructionCost(playerId);
  }

  /**
   * Calculate and deduct construction costs based on contractor quality and multiplier
   *
   * Formula: Construction Cost = Work Cost × (Multiplier × 0.1) × Quality Coefficient
   *
   * Quality Coefficients:
   * - HIGH = 1.5 (experienced contractor, higher upfront cost, fewer change orders)
   * - MED = 1.0 (standard contractor)
   * - LOW = 0.6 (cheap contractor, lower upfront cost, more change orders)
   *
   * Multiplier: 1-6 determines percentage of work cost (10% to 60%)
   *
   * Example for $1M work cost:
   * - HIGH + mult 6: $1M × 0.6 × 1.5 = $900K
   * - MED + mult 3: $1M × 0.3 × 1.0 = $300K
   * - LOW + mult 1: $1M × 0.1 × 0.6 = $60K
   */
  private calculateAndDeductConstructionCost(playerId: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const contractor = player.contractor;
    if (!contractor) {
      console.warn(`No contractor info for player ${playerId}, skipping construction cost`);
      return this.stateService.getGameState();
    }

    // Get total work cost from W cards
    const totalWorkCost = this.gameRulesService.calculateTotalWorkCost(playerId);
    if (totalWorkCost <= 0) {
      return this.stateService.getGameState();
    }

    // Quality coefficient
    const qualityCoefficients: Record<'HIGH' | 'MED' | 'LOW', number> = {
      'HIGH': 1.5,
      'MED': 1.0,
      'LOW': 0.6
    };
    const qualityCoeff = qualityCoefficients[contractor.quality] || 1.0;

    // Multiplier as percentage (1 = 10%, 6 = 60%)
    const multiplierPercent = contractor.multiplier * 0.1;

    // Calculate construction cost
    const constructionCost = Math.round(totalWorkCost * multiplierPercent * qualityCoeff);


    // Deduct the construction cost
    if (constructionCost > 0) {
      this.resourceService.spendMoney(
        playerId,
        constructionCost,
        'turn_effect',
        `Contractor hired: ${contractor.quality} quality, multiplier ${contractor.multiplier} - $${constructionCost.toLocaleString()}`
      );

      // Update expenditures.construction
      const updatedPlayer = this.stateService.getPlayer(playerId);
      if (updatedPlayer) {
        const currentConstruction = updatedPlayer.expenditures?.construction || 0;
        this.stateService.updatePlayer({
          id: playerId,
          expenditures: {
            ...updatedPlayer.expenditures,
            construction: currentConstruction + constructionCost
          }
        });
      }
    }

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

    if (effect.effect_action === 'add') {
      this.resourceService.addMoney(playerId, value, 'space_effect', `Space effect: add $${value}`);
    } else if (effect.effect_action === 'subtract') {
      if (!this.resourceService.canAfford(playerId, value)) {
        console.warn(`⚠️ Space effect: Player cannot afford $${value} subtract (has $${player.money}). Spending remaining balance.`);
        if (player.money > 0) {
          this.resourceService.spendMoney(playerId, player.money, 'space_effect', `Space effect: subtract $${value} (capped)`);
        }
      } else {
        this.resourceService.spendMoney(playerId, value, 'space_effect', `Space effect: subtract $${value}`);
      }
    } else if (effect.effect_action === 'fee_percent') {
      const feeAmount = Math.floor((player.money * value) / 100);
      if (feeAmount > 0) {
        this.resourceService.spendMoney(playerId, feeAmount, 'space_effect', `Space effect: ${value}% fee ($${feeAmount})`);
      }
    } else if (effect.effect_action === 'add_per_amount') {
      let additionalAmount = value;

      if (effect.condition === 'per_200k') {
        const totalBorrowed = player.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
        const multiplier = Math.floor(totalBorrowed / 200000);
        additionalAmount = value * multiplier;
      } else {
        console.warn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
      }

      if (additionalAmount > 0) {
        this.resourceService.addMoney(playerId, additionalAmount, 'space_effect', `Space effect: add_per_amount $${additionalAmount}`);
      }
    }

    return this.stateService.getGameState();
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
      } else {
        // For other conditions, use value directly (fallback)
        console.warn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
      }

      newTime += additionalTime;
    }

    newTime = Math.max(0, newTime); // Ensure time doesn't go below 0


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
