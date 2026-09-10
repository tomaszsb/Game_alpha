import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ConditionEvaluator, resetUnknownConditionWarnings } from '../../src/utils/ConditionEvaluator';
import { Player } from '../../src/types/StateTypes';
import { SpaceEffect } from '../../src/types/DataTypes';

// Make debug functions always call through to console (bypass debug gate)
vi.mock('../../src/utils/debugLog', () => ({
  debugLog: (...args: unknown[]) => console.log(...args),
  debugWarn: (...args: unknown[]) => console.warn(...args),
  debugDebug: (...args: unknown[]) => console.debug(...args),
  resetDebugCache: () => {},
}));

describe('ConditionEvaluator', () => {
  let conditionEvaluator: ConditionEvaluator;
  let projectScopeOf: Mock<(playerId: string) => number>;

  const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
    id: 'player1',
    name: 'Test Player',
    money: 2000000,
    timeSpent: 10,
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    cards: { W: [], B: [], E: [], L: [], I: [] },
    ...overrides
  } as Player);

  beforeEach(() => {
    projectScopeOf = vi.fn((_playerId: string) => 3000000);
    conditionEvaluator = new ConditionEvaluator(projectScopeOf);
    resetUnknownConditionWarnings();
  });

  describe('evaluate', () => {
    describe('empty/null conditions', () => {
      it('should return true for undefined condition', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, undefined)).toBe(true);
      });

      it('should return true for empty string condition', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, '')).toBe(true);
      });

      it('should return true for whitespace-only condition', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, '   ')).toBe(true);
      });
    });

    describe('always condition', () => {
      it('should return true for "always" condition', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'always')).toBe(true);
      });

      it('should be case-insensitive for "ALWAYS"', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'ALWAYS')).toBe(true);
      });
    });

    describe('dice roll conditions', () => {
      it('should return true when dice roll matches required roll', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'dice_roll_3', 3)).toBe(true);
      });

      it('should return false when dice roll does not match', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'dice_roll_3', 5)).toBe(false);
      });

      it('should be not-met (false, no warning) when dice roll is undefined', () => {
        // Used to fall through to the unknown branch and return TRUE here,
        // while GameRulesService returned false for the same call.
        const player = createMockPlayer();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(conditionEvaluator.evaluate(player, 'dice_roll_3')).toBe(false);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
      });

      it('should handle dice_roll_1 through dice_roll_6', () => {
        const player = createMockPlayer();
        for (let i = 1; i <= 6; i++) {
          expect(conditionEvaluator.evaluate(player, `dice_roll_${i}`, i)).toBe(true);
          expect(conditionEvaluator.evaluate(player, `dice_roll_${i}`, i === 6 ? 1 : i + 1)).toBe(false);
        }
      });
    });

    describe('scope conditions', () => {
      it('should read scope through the provider for scope_le_4m / scope_gt_4m', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'scope_le_4m')).toBe(true); // $3M
        expect(conditionEvaluator.evaluate(player, 'scope_gt_4M')).toBe(false);
        expect(projectScopeOf).toHaveBeenCalledWith('player1');
      });

      it('should treat exactly $4M as scope_le_4m', () => {
        projectScopeOf.mockReturnValue(4000000);
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'scope_le_4m')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'scope_gt_4m')).toBe(false);
      });

      it('should fail closed with warning when there is no scope provider', () => {
        const evaluatorNoService = new ConditionEvaluator();
        const player = createMockPlayer();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(evaluatorNoService.evaluate(player, 'scope_le_4m')).toBe(false);
        expect(evaluatorNoService.evaluate(player, 'scope_gt_4m')).toBe(false);
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });
    });

    describe('loan conditions', () => {
      it('should return true for loan_up_to_1_4m when money <= 1.4M', () => {
        const player = createMockPlayer({ money: 1400000 });
        expect(conditionEvaluator.evaluate(player, 'loan_up_to_1_4m')).toBe(true);
      });

      it('should return false for loan_up_to_1_4m when money > 1.4M', () => {
        const player = createMockPlayer({ money: 1500000 });
        expect(conditionEvaluator.evaluate(player, 'loan_up_to_1_4m')).toBe(false);
      });

      it('should return true for loan_1_5m_to_2_75m when money in range', () => {
        const player = createMockPlayer({ money: 2000000 });
        expect(conditionEvaluator.evaluate(player, 'loan_1_5m_to_2_75m')).toBe(true);
      });

      it('should return false for loan_1_5m_to_2_75m when money below range', () => {
        const player = createMockPlayer({ money: 1400000 });
        expect(conditionEvaluator.evaluate(player, 'loan_1_5m_to_2_75m')).toBe(false);
      });

      it('should return false for loan_1_5m_to_2_75m when money above range', () => {
        const player = createMockPlayer({ money: 3000000 });
        expect(conditionEvaluator.evaluate(player, 'loan_1_5m_to_2_75m')).toBe(false);
      });

      it('should return true for loan_above_2_75m when money > 2.75M', () => {
        const player = createMockPlayer({ money: 3000000 });
        expect(conditionEvaluator.evaluate(player, 'loan_above_2_75m')).toBe(true);
      });

      it('should return false for loan_above_2_75m when money <= 2.75M', () => {
        const player = createMockPlayer({ money: 2750000 });
        expect(conditionEvaluator.evaluate(player, 'loan_above_2_75m')).toBe(false);
      });

      it('should fail closed for an unrecognised loan_ variant (used to return true)', () => {
        const player = createMockPlayer();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(conditionEvaluator.evaluate(player, 'loan_up_to_9m')).toBe(false);
        warnSpy.mockRestore();
      });
    });

    // Moved here from MovementService's former private evaluator.
    describe('money / time / hand-size conditions', () => {
      it('evaluates money_ thresholds', () => {
        const player = createMockPlayer({ money: 1500000 });
        expect(conditionEvaluator.evaluate(player, 'money_le_1m')).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'money_gt_1m')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'money_le_2m')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'money_gt_2m')).toBe(false);
      });

      it('evaluates time_ thresholds', () => {
        const player = createMockPlayer({ timeSpent: 7 });
        expect(conditionEvaluator.evaluate(player, 'time_le_5')).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'time_gt_5')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'time_le_10')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'time_gt_10')).toBe(false);
      });

      it('evaluates cards_ thresholds on hand size', () => {
        const player = createMockPlayer({ hand: ['W001', 'E001', 'L001', 'B001'] } as Partial<Player>);
        expect(conditionEvaluator.evaluate(player, 'cards_le_3')).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'cards_gt_3')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'cards_le_5')).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'cards_gt_5')).toBe(false);
      });
    });

    describe('percentage conditions', () => {
      it('should return true for percentage conditions (value, not boolean)', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, '10%')).toBe(true);
        expect(conditionEvaluator.evaluate(player, '5%')).toBe(true);
      });
    });

    describe('direction conditions', () => {
      it('should return true for to_left (targeting directive)', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'to_left')).toBe(true);
      });

      it('should return true for to_right (targeting directive)', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'to_right')).toBe(true);
      });
    });

    describe('high/low dice conditions', () => {
      it('should return true for "high" when dice >= 4', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'high', 4)).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'high', 5)).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'high', 6)).toBe(true);
      });

      it('should return false for "high" when dice < 4', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'high', 1)).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'high', 2)).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'high', 3)).toBe(false);
      });

      it('should return false for "high" when no dice roll', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'high')).toBe(false);
      });

      it('should return true for "low" when dice <= 3', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'low', 1)).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'low', 2)).toBe(true);
        expect(conditionEvaluator.evaluate(player, 'low', 3)).toBe(true);
      });

      it('should return false for "low" when dice > 3', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'low', 4)).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'low', 5)).toBe(false);
        expect(conditionEvaluator.evaluate(player, 'low', 6)).toBe(false);
      });
    });

    describe('calculation modifier conditions', () => {
      it('should return true for per_ conditions', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'per_200k')).toBe(true);
      });

      it('should return true for of_borrowed_amount conditions', () => {
        const player = createMockPlayer();
        expect(conditionEvaluator.evaluate(player, 'of_borrowed_amount')).toBe(true);
      });
    });

    describe('unknown conditions', () => {
      it('should FAIL CLOSED (false) for unknown conditions, with a non-debug warning', () => {
        const player = createMockPlayer();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(conditionEvaluator.evaluate(player, 'unknown_condition')).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
          'Unknown effect condition: "unknown_condition" - defaulting to false (effect will not apply)'
        );

        warnSpy.mockRestore();
      });

      it('should warn only once per distinct unknown string', () => {
        const player = createMockPlayer();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        conditionEvaluator.evaluate(player, 'mystery');
        conditionEvaluator.evaluate(player, 'MYSTERY');
        conditionEvaluator.evaluate(player, 'other_mystery');
        expect(warnSpy).toHaveBeenCalledTimes(2);

        warnSpy.mockRestore();
      });
    });

    describe('error handling', () => {
      it('should return false and log error on exception', () => {
        const badPlayer = { id: 'bad' } as Player; // Minimal player that might cause issues
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Force an error with a scope provider that throws
        const evaluator = new ConditionEvaluator(() => { throw new Error('Test error'); });

        expect(evaluator.evaluate(badPlayer, 'scope_le_4m')).toBe(false);
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
      });
    });
  });

  describe('isDiceCondition', () => {
    it('should return true for dice_roll_ conditions', () => {
      expect(conditionEvaluator.isDiceCondition('dice_roll_3')).toBe(true);
      expect(conditionEvaluator.isDiceCondition('dice_roll_1')).toBe(true);
    });

    it('should return true for high/low conditions', () => {
      expect(conditionEvaluator.isDiceCondition('high')).toBe(true);
      expect(conditionEvaluator.isDiceCondition('low')).toBe(true);
    });

    it('should return false for non-dice conditions', () => {
      expect(conditionEvaluator.isDiceCondition('always')).toBe(false);
      expect(conditionEvaluator.isDiceCondition('scope_le_4m')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(conditionEvaluator.isDiceCondition(undefined)).toBe(false);
    });
  });

  describe('isTargetingDirective', () => {
    it('should return true for direction conditions', () => {
      expect(conditionEvaluator.isTargetingDirective('to_left')).toBe(true);
      expect(conditionEvaluator.isTargetingDirective('to_right')).toBe(true);
    });

    it('should return false for non-targeting conditions', () => {
      expect(conditionEvaluator.isTargetingDirective('always')).toBe(false);
      expect(conditionEvaluator.isTargetingDirective('high')).toBe(false);
    });
  });

  describe('isCalculationModifier', () => {
    it('should return true for percentage conditions', () => {
      expect(conditionEvaluator.isCalculationModifier('10%')).toBe(true);
    });

    it('should return true for per_ conditions', () => {
      expect(conditionEvaluator.isCalculationModifier('per_200k')).toBe(true);
    });

    it('should return true for of_borrowed_amount', () => {
      expect(conditionEvaluator.isCalculationModifier('of_borrowed_amount')).toBe(true);
    });

    it('should return false for boolean conditions', () => {
      expect(conditionEvaluator.isCalculationModifier('always')).toBe(false);
      expect(conditionEvaluator.isCalculationModifier('high')).toBe(false);
    });
  });

  describe('static anyEffectNeedsDiceRoll', () => {
    const createMockEffect = (condition: string): SpaceEffect => ({
      space_name: 'TEST-SPACE',
      visit_type: 'First',
      effect_type: 'cards',
      effect_action: 'draw_L',
      effect_value: '1',
      condition: condition,
      description: 'Test effect',
      trigger_type: 'auto'
    });

    it('should return true when any effect has dice_roll_X condition', () => {
      const effects = [
        createMockEffect(''),
        createMockEffect('dice_roll_3'),
        createMockEffect('scope_le_4M')
      ];
      expect(ConditionEvaluator.anyEffectNeedsDiceRoll(effects)).toBe(true);
    });

    it('should return true when any effect has "high" condition', () => {
      const effects = [
        createMockEffect(''),
        createMockEffect('high')
      ];
      expect(ConditionEvaluator.anyEffectNeedsDiceRoll(effects)).toBe(true);
    });

    it('should return true when any effect has "low" condition', () => {
      const effects = [
        createMockEffect('scope_gt_4M'),
        createMockEffect('low')
      ];
      expect(ConditionEvaluator.anyEffectNeedsDiceRoll(effects)).toBe(true);
    });

    it('should return false when no effects have dice conditions', () => {
      const effects = [
        createMockEffect(''),
        createMockEffect('scope_le_4M'),
        createMockEffect('always')
      ];
      expect(ConditionEvaluator.anyEffectNeedsDiceRoll(effects)).toBe(false);
    });

    it('should return false for empty effects array', () => {
      expect(ConditionEvaluator.anyEffectNeedsDiceRoll([])).toBe(false);
    });

    it('should handle all dice_roll_1 through dice_roll_6', () => {
      for (let i = 1; i <= 6; i++) {
        const effects = [createMockEffect(`dice_roll_${i}`)];
        expect(ConditionEvaluator.anyEffectNeedsDiceRoll(effects)).toBe(true);
      }
    });
  });

  describe('static isDiceConditionStatic', () => {
    it('should return true for dice_roll_X conditions', () => {
      expect(ConditionEvaluator.isDiceConditionStatic('dice_roll_1')).toBe(true);
      expect(ConditionEvaluator.isDiceConditionStatic('dice_roll_3')).toBe(true);
      expect(ConditionEvaluator.isDiceConditionStatic('dice_roll_6')).toBe(true);
    });

    it('should return true for high/low conditions', () => {
      expect(ConditionEvaluator.isDiceConditionStatic('high')).toBe(true);
      expect(ConditionEvaluator.isDiceConditionStatic('low')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(ConditionEvaluator.isDiceConditionStatic('DICE_ROLL_3')).toBe(true);
      expect(ConditionEvaluator.isDiceConditionStatic('HIGH')).toBe(true);
      expect(ConditionEvaluator.isDiceConditionStatic('Low')).toBe(true);
    });

    it('should return false for non-dice conditions', () => {
      expect(ConditionEvaluator.isDiceConditionStatic('always')).toBe(false);
      expect(ConditionEvaluator.isDiceConditionStatic('scope_le_4M')).toBe(false);
      expect(ConditionEvaluator.isDiceConditionStatic('to_left')).toBe(false);
    });

    it('should return false for undefined or empty', () => {
      expect(ConditionEvaluator.isDiceConditionStatic(undefined)).toBe(false);
      expect(ConditionEvaluator.isDiceConditionStatic('')).toBe(false);
    });
  });
});
