import { Player } from '../types/StateTypes';
import { IGameRulesService } from '../types/ServiceContracts';
import { SpaceEffect } from '../types/DataTypes';

/**
 * ConditionEvaluator - Evaluates effect conditions against player state
 *
 * Extracted from TurnService to create a focused utility for condition evaluation.
 * Handles various condition types from CSV data (SPACE_EFFECTS.csv, DICE_EFFECTS.csv).
 */
export class ConditionEvaluator {
  constructor(private readonly gameRulesService?: IGameRulesService) {}

  /**
   * Static helper: Check if any effects in the array have dice-dependent conditions
   * @param effects - Array of space effects to check
   * @returns true if any effect requires a dice roll for condition evaluation
   */
  static anyEffectNeedsDiceRoll(effects: SpaceEffect[]): boolean {
    return effects.some(effect => {
      const condition = effect.condition?.toLowerCase().trim() || '';
      return condition.startsWith('dice_roll_') ||
             condition === 'high' ||
             condition === 'low';
    });
  }

  /**
   * Static helper: Check if a condition string is dice-dependent
   * @param condition - The condition string to check
   * @returns true if this is a dice-dependent condition
   */
  static isDiceConditionStatic(condition: string | undefined): boolean {
    if (!condition) return false;
    const conditionLower = condition.toLowerCase().trim();
    return conditionLower.startsWith('dice_roll_') ||
           conditionLower === 'high' ||
           conditionLower === 'low';
  }

  /**
   * Evaluate whether an effect condition is met
   * @param player - The player to evaluate the condition for
   * @param condition - The condition string from CSV data
   * @param diceRoll - Optional dice roll value for dice-dependent conditions
   * @returns true if condition is met, false otherwise
   */
  evaluate(player: Player, condition: string | undefined, diceRoll?: number): boolean {
    // If no condition is specified, assume it should always apply
    if (!condition || condition.trim() === '') {
      return true;
    }

    const conditionLower = condition.toLowerCase().trim();

    try {
      // Always apply conditions
      if (conditionLower === 'always') {
        return true;
      }

      // Dice roll conditions (used in SPACE_EFFECTS.csv)
      if (conditionLower.startsWith('dice_roll_') && diceRoll !== undefined) {
        const requiredRoll = parseInt(conditionLower.replace('dice_roll_', ''));
        return diceRoll === requiredRoll;
      }

      // Project scope conditions - delegate to GameRulesService if available
      if (conditionLower === 'scope_le_4m' || conditionLower === 'scope_gt_4m') {
        if (this.gameRulesService) {
          return this.gameRulesService.evaluateCondition(player.id, condition, diceRoll);
        }
        // Fallback if no GameRulesService
        console.warn(`GameRulesService not available for scope condition: ${condition}`);
        return true;
      }

      // Loan amount conditions
      if (conditionLower.startsWith('loan_')) {
        return this.evaluateLoanCondition(conditionLower, player.money || 0);
      }

      // Percentage-based conditions (often used in dice effects)
      if (conditionLower.includes('%')) {
        // These are typically values, not conditions - return true for now
        return true;
      }

      // Direction conditions (for card transfer targeting)
      if (conditionLower === 'to_left' || conditionLower === 'to_right') {
        // These are targeting directives, not boolean conditions
        // The actual target resolution happens in EffectEngineService
        // For condition evaluation, we always return true (effect should be processed)
        return true;
      }

      // High/low dice conditions
      if (conditionLower === 'high') {
        return diceRoll !== undefined && diceRoll >= 4; // 4, 5, 6 are "high"
      }

      if (conditionLower === 'low') {
        return diceRoll !== undefined && diceRoll <= 3; // 1, 2, 3 are "low"
      }

      // Amount-based conditions (calculation modifiers)
      if (conditionLower.includes('per_') || conditionLower.includes('of_borrowed_amount')) {
        // These are typically calculation modifiers, not boolean conditions
        return true;
      }

      // Fallback for unknown conditions
      console.warn(`Unknown effect condition: "${condition}" - defaulting to true`);
      return true;

    } catch (error) {
      console.error(`Error evaluating condition "${condition}":`, error);
      return false;
    }
  }

  /**
   * Evaluate loan-based conditions
   * @param conditionLower - Lowercase condition string
   * @param playerMoney - Player's current money
   * @returns true if loan condition is met
   */
  private evaluateLoanCondition(conditionLower: string, playerMoney: number): boolean {
    if (conditionLower === 'loan_up_to_1_4m') {
      return playerMoney <= 1400000; // $1.4M
    }
    if (conditionLower === 'loan_1_5m_to_2_75m') {
      return playerMoney >= 1500000 && playerMoney <= 2750000; // $1.5M to $2.75M
    }
    if (conditionLower === 'loan_above_2_75m') {
      return playerMoney > 2750000; // Above $2.75M
    }
    // Unknown loan condition
    return true;
  }

  /**
   * Check if a condition is a dice roll condition
   * @param condition - The condition string
   * @returns true if this is a dice-dependent condition
   */
  isDiceCondition(condition: string | undefined): boolean {
    if (!condition) return false;
    const conditionLower = condition.toLowerCase().trim();
    return conditionLower.startsWith('dice_roll_') ||
           conditionLower === 'high' ||
           conditionLower === 'low';
  }

  /**
   * Check if a condition is a targeting directive (not a boolean condition)
   * @param condition - The condition string
   * @returns true if this is a targeting directive
   */
  isTargetingDirective(condition: string | undefined): boolean {
    if (!condition) return false;
    const conditionLower = condition.toLowerCase().trim();
    return conditionLower === 'to_left' || conditionLower === 'to_right';
  }

  /**
   * Check if a condition is a calculation modifier (not a boolean condition)
   * @param condition - The condition string
   * @returns true if this is a calculation modifier
   */
  isCalculationModifier(condition: string | undefined): boolean {
    if (!condition) return false;
    const conditionLower = condition.toLowerCase().trim();
    return conditionLower.includes('%') ||
           conditionLower.includes('per_') ||
           conditionLower.includes('of_borrowed_amount');
  }
}

/**
 * Create a standalone condition evaluator without GameRulesService
 * Use this for simple condition checks that don't need scope evaluation
 */
export function createConditionEvaluator(gameRulesService?: IGameRulesService): ConditionEvaluator {
  return new ConditionEvaluator(gameRulesService);
}
