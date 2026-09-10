// tests/regression/ConditionPathParity.test.ts
//
// Workstream 6 audit II, A1 (v3.2.56). The same CSV `condition` string used to
// get OPPOSITE answers depending on which code path read it:
//   - arrival path  (SpaceArrivalProcessor → GameRulesService)   unknown → false
//   - manual button (ManualActionProcessor → its own ConditionEvaluator) unknown → TRUE
//   - movement      (MovementService's private evaluator)        unknown → false,
//                   and a different vocabulary (money_/time_/cards_)
// Nothing shipped hit the gap, so it was latent — which is exactly why it needs
// a test: the first authored board that used a new word would have applied it
// on one path and silently dropped it on another.
//
// Every path below runs through the REAL GameRulesService, so this fails if any
// service grows its own evaluator again.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameRulesService } from '../../src/services/GameRulesService';
import { SpaceArrivalProcessor } from '../../src/services/SpaceArrivalProcessor';
import { ManualActionProcessor } from '../../src/services/ManualActionProcessor';
import { MovementService } from '../../src/services/MovementService';
import { ApprovalService } from '../../src/services/ApprovalService';
import { resetUnknownConditionWarnings } from '../../src/utils/ConditionEvaluator';
import { SpaceEffect, Movement } from '../../src/types/DataTypes';
import {
  createMockDataService,
  createMockStateService,
  createMockCardService,
  createMockLoggingService,
  createMockChoiceService,
  createMockResourceService,
  createMockMovementService,
} from '../mocks/mockServices';

const SPACE = 'PARITY-SPACE';

// [condition, expected "does the effect apply?"] — the answer must be the same
// on every path.
const CASES: Array<[string, boolean]> = [
  ['totally_unknown_rule', false],   // the bug: manual path used to say true
  ['LOAN_UP_TO_9M', false],          // unknown loan_ variant — used to say true
  ['dice_roll_3', false],            // no roll yet — manual path used to say true
  ['always', true],
  ['', true],
  ['scope_le_4m', true],             // scope pinned to $3M below
  ['scope_gt_4m', false],
  ['money_gt_1m', true],             // was movement-only vocabulary
  ['cards_le_3', true],              // was movement-only vocabulary
  ['per_200k', true],                // parameter, not a gate — must run
  ['to_left', true],                 // parameter, not a gate — must run
];

describe('condition evaluation is identical on every code path (A1)', () => {
  let dataService: any;
  let stateService: any;
  let gameRulesService: GameRulesService;
  let player: any;

  beforeEach(() => {
    resetUnknownConditionWarnings();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    dataService = createMockDataService();
    stateService = createMockStateService();
    player = {
      id: 'p1', name: 'P1', currentSpace: SPACE, visitType: 'First',
      visitedSpaces: [SPACE], money: 2000000, timeSpent: 3, hand: ['W001'],
      activeCards: [], loans: [],
    };
    stateService.getPlayer.mockReturnValue(player);
    gameRulesService = new GameRulesService(dataService, stateService);
    vi.spyOn(gameRulesService, 'calculateProjectScope').mockReturnValue(3000000);
  });

  const effectWith = (condition: string): SpaceEffect => ({
    space_name: SPACE, visit_type: 'First', effect_type: 'turn', effect_action: 'end_turn',
    effect_value: '0', condition, description: 'parity', trigger_type: 'manual',
  } as SpaceEffect);

  const viaArrival = (condition: string): boolean => {
    const processor = new SpaceArrivalProcessor(
      dataService, stateService, createMockCardService(), createMockLoggingService(), gameRulesService
    );
    return processor.filterSpaceEffectsByCondition([effectWith(condition)], player).length === 1;
  };

  const viaManualButton = async (condition: string): Promise<boolean> => {
    dataService.getSpaceEffects.mockReturnValue([effectWith(condition)]);
    const processor = new ManualActionProcessor(
      dataService, stateService, gameRulesService, createMockCardService(),
      createMockResourceService(), createMockMovementService(), {} as any, {} as any,
      createMockLoggingService()
    );
    try {
      await processor.triggerManualEffect('p1', 'turn:end_turn');
      return true;
    } catch (e) {
      if (String((e as Error).message).includes('condition not met')) return false;
      throw e;
    }
  };

  const viaMovement = (condition: string): boolean => {
    const movement: Movement = {
      space_name: SPACE, visit_type: 'First', movement_type: 'logic',
      destination_1: 'GATED-DESTINATION', condition_1: condition,
    } as Movement;
    dataService.getMovement.mockReturnValue(movement);
    const movementService = new MovementService(
      dataService, stateService, createMockChoiceService(), createMockLoggingService(),
      gameRulesService, new ApprovalService()
    );
    return movementService.getValidMoves('p1').includes('GATED-DESTINATION');
  };

  for (const [condition, expected] of CASES) {
    it(`"${condition}" → ${expected ? 'applies' : 'blocked'} on arrival, manual button and movement`, async () => {
      const results = {
        arrival: viaArrival(condition),
        manual: await viaManualButton(condition),
        movement: viaMovement(condition),
      };
      expect(results).toEqual({ arrival: expected, manual: expected, movement: expected });
    });
  }
});
