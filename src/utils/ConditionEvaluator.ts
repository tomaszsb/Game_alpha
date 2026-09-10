import { Player } from '../types/StateTypes';
import { SpaceEffect } from '../types/DataTypes';
import { debugWarn } from './debugLog';

/**
 * ConditionEvaluator — THE condition vocabulary for CSV `condition` columns
 * (SPACE_EFFECTS.condition, MOVEMENT.condition_1..5).
 *
 * v3.2.56 (Workstream 6 audit II, A1): this is now the only place a condition
 * string is interpreted. Before, four copies existed and disagreed —
 * GameRulesService (unknown → false), this class (unknown → TRUE),
 * MovementService's private evaluator (money_/time_/cards_, unknown → false)
 * and a StateService init fallback ('always' only). The same CSV string could
 * apply on the manual-button path and be silently dropped on the arrival path.
 * No shipped board used a string that hit either unknown branch (measured
 * 2026-09-10: only dice_roll_1..6, all on auto rows), so unifying changed no
 * live behaviour.
 *
 * Services do not construct this directly — they call
 * GameRulesService.evaluateCondition(), which owns the project-scope provider.
 *
 * Unknown strings FAIL CLOSED (false) with a console.warn that is not
 * debug-gated: an unrecognised authored rule must not silently take effect.
 */

// Named resource thresholds. Union of the vocabularies that used to live in
// MovementService (money_/time_/cards_) and this file (loan_).
const RESOURCE_CONDITIONS: Record<string, (player: Player) => boolean> = {
  money_le_1m: p => (p.money || 0) <= 1000000,
  money_gt_1m: p => (p.money || 0) > 1000000,
  money_le_2m: p => (p.money || 0) <= 2000000,
  money_gt_2m: p => (p.money || 0) > 2000000,
  loan_up_to_1_4m: p => (p.money || 0) <= 1400000,
  loan_1_5m_to_2_75m: p => (p.money || 0) >= 1500000 && (p.money || 0) <= 2750000,
  loan_above_2_75m: p => (p.money || 0) > 2750000,
  time_le_5: p => (p.timeSpent || 0) <= 5,
  time_gt_5: p => (p.timeSpent || 0) > 5,
  time_le_10: p => (p.timeSpent || 0) <= 10,
  time_gt_10: p => (p.timeSpent || 0) > 10,
  cards_le_3: p => (p.hand?.length || 0) <= 3,
  cards_gt_3: p => (p.hand?.length || 0) > 3,
  cards_le_5: p => (p.hand?.length || 0) <= 5,
  cards_gt_5: p => (p.hand?.length || 0) > 5,
};

const SCOPE_THRESHOLD = 4000000; // $4M

// Warn once per distinct unknown string — StateService re-evaluates on every
// action-count pass, so an unconditional warn would flood the console.
const warnedUnknown = new Set<string>();

export class ConditionEvaluator {
  /**
   * @param projectScopeOf - how to read a player's project scope. Only
   *   GameRulesService has one; without it, scope conditions fail closed.
   */
  constructor(private readonly projectScopeOf?: (playerId: string) => number) {}

  /**
   * Static helper: Check if any effects in the array have dice-dependent conditions
   * @param effects - Array of space effects to check
   * @returns true if any effect requires a dice roll for condition evaluation
   */
  static anyEffectNeedsDiceRoll(effects: SpaceEffect[]): boolean {
    return effects.some(effect => ConditionEvaluator.isDiceConditionStatic(effect.condition));
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
      if (conditionLower === 'always') {
        return true;
      }

      // Dice conditions. With no roll yet the condition is simply not met —
      // expected when effects are filtered before the roll, so no warning.
      if (conditionLower === 'high') {
        return diceRoll !== undefined && diceRoll >= 4; // 4, 5, 6 are "high"
      }
      if (conditionLower === 'low') {
        return diceRoll !== undefined && diceRoll <= 3; // 1, 2, 3 are "low"
      }
      if (conditionLower.startsWith('dice_roll_')) {
        if (diceRoll === undefined) return false;
        return diceRoll === parseInt(conditionLower.replace('dice_roll_', ''), 10);
      }

      // Project scope — always calculated fresh, never written back (pure).
      if (conditionLower === 'scope_le_4m' || conditionLower === 'scope_gt_4m') {
        if (!this.projectScopeOf) {
          debugWarn(`No project-scope provider for condition "${condition}" — defaulting to false`);
          return false;
        }
        const projectScope = this.projectScopeOf(player.id);
        return conditionLower === 'scope_le_4m'
          ? projectScope <= SCOPE_THRESHOLD
          : projectScope > SCOPE_THRESHOLD;
      }

      const resourceCheck = RESOURCE_CONDITIONS[conditionLower];
      if (resourceCheck) {
        return resourceCheck(player);
      }

      // Rows that use the condition column as a PARAMETER, not a gate — who
      // receives a transfer (to_left/to_right, read by SpaceEffectService.
      // getTargetPlayer) or how an amount scales (per_200k, read by
      // applySpaceMoneyEffect/applySpaceTimeEffect). The effect must run so its
      // handler can read the parameter.
      if (this.isTargetingDirective(conditionLower) || this.isCalculationModifier(conditionLower)) {
        return true;
      }

      if (!warnedUnknown.has(conditionLower)) {
        warnedUnknown.add(conditionLower);
        console.warn(`Unknown effect condition: "${condition}" - defaulting to false (effect will not apply)`);
      }
      return false;

    } catch (error) {
      console.error(`Error evaluating condition "${condition}":`, error);
      return false;
    }
  }

  /**
   * Check if a condition is a dice roll condition
   * @param condition - The condition string
   * @returns true if this is a dice-dependent condition
   */
  isDiceCondition(condition: string | undefined): boolean {
    return ConditionEvaluator.isDiceConditionStatic(condition);
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

/** Test seam: forget which unknown strings have already warned. */
export function resetUnknownConditionWarnings(): void {
  warnedUnknown.clear();
}
