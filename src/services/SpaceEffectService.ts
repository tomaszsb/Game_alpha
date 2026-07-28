import { IStateService, ICardService, IResourceService, IGameRulesService, IDiceService, IDataService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { GameState, Player } from '../types/StateTypes';
import { SpaceEffect } from '../types/DataTypes';

/**
 * SpaceEffectService - Handles application of space and dice effects
 *
 * Extracted from TurnService to create a focused service for:
 * - Dice roll effect application (cards, money, time, quality)
 * - Space effect application (money, time changes)
 * - Target player resolution for transfer effects
 */
export interface ISpaceEffectService {
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
    private readonly diceService: IDiceService,
    // Workstream 6 #7: dataService used to look up data-driven design fee flags
    // (fee_calculation_method, fee_label) instead of substring-matching ARCH/ENG.
    private readonly dataService: IDataService
  ) {}

  // v3.0.42: deleted applyDiceEffect / applyCardEffect / applyMoneyEffect /
  // applyTimeEffect / applyQualityEffect / applyMultiplierEffect /
  // calculateAndDeductConstructionCost. All were unreachable: the dice/
  // quality/multiplier pipeline was migrated to EffectEngineService's
  // CONTRACTOR_UPDATE handler in v2.65.9 and TurnService's private wrappers
  // (the only callers) are gone. applySpaceMoneyEffect / applySpaceTimeEffect
  // below are the surviving live methods.


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
        debugWarn(`⚠️ Space effect: Player cannot afford $${value} subtract (has $${player.money}). Spending remaining balance.`);
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
        debugWarn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
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
        debugWarn(`Unknown add_per_amount condition: ${effect.condition}, using base value`);
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
    debugWarn(`Unknown transfer condition: ${condition}`);
    return null;
  }
}
