// Phase 2.1 audit (2026-06-04) — unified getValidMoves resolver behavior.
//
// Pins the new contract: when `options.diceRoll` is provided, the dice base
// is narrowed to that single roll's destination BEFORE the override stack
// (lock-point, resume-hub, Stage-1 gate) runs. This collapses the two-resolver
// split between getValidMoves and getDiceDestination that caused the v3.0.61
// → v3.0.62 crash family.
//
// Live caller: MovementExecutor.executeMovement dice branch (END-TURN dice
// movement) — was patching the Stage-1 gate inline, now consumes this
// resolver's gate-overridden output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementService } from '../../src/services/MovementService';
import { ApprovalService } from '../../src/services/ApprovalService';
import { Movement, DiceOutcome } from '../../src/types/DataTypes';
import {
  createMockDataService,
  createMockStateService,
  createMockChoiceService,
  createMockLoggingService,
  createMockGameRulesService,
} from '../mocks/mockServices';

const FINAL_REVIEW_DICE_OUTCOME: DiceOutcome = {
  space_name: 'REG-DOB-FINAL-REVIEW',
  visit_type: 'First',
  roll_1: 'CON-INITIATION',
  roll_2: 'CON-INITIATION',
  roll_3: 'CON-INITIATION',
  roll_4: 'FINISH',
  roll_5: 'FINISH',
  roll_6: 'FINISH',
};

describe('MovementService.getValidMoves — unified resolver (Phase 2.1)', () => {
  let movementService: MovementService;
  let mockDataService: any;
  let mockStateService: any;
  let approvalService: ApprovalService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    approvalService = new ApprovalService();

    movementService = new MovementService(
      mockDataService,
      mockStateService,
      createMockChoiceService(),
      createMockLoggingService(),
      createMockGameRulesService(),
      approvalService
    );
  });

  describe('dice-narrowing (options.diceRoll)', () => {
    it('without diceRoll: returns all unique dice outcomes (existing behavior)', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'approved',
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({
        space_name: 'REG-DOB-FINAL-REVIEW',
        visit_type: 'First',
        movement_type: 'dice',
      } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(false);

      const result = movementService.getValidMoves('p1');

      // Two unique outcomes after dedup
      expect(result).toEqual(['CON-INITIATION', 'FINISH']);
    });

    it('with diceRoll=3: narrows to that roll\'s destination only', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'approved',
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({
        space_name: 'REG-DOB-FINAL-REVIEW',
        visit_type: 'First',
        movement_type: 'dice',
      } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(false);

      const result = movementService.getValidMoves('p1', { diceRoll: 3 });

      expect(result).toEqual(['CON-INITIATION']);
    });

    it('with diceRoll=4: returns FINISH (the roll-4 outcome)', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'approved',
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({
        space_name: 'REG-DOB-FINAL-REVIEW',
        visit_type: 'First',
        movement_type: 'dice',
      } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(false);

      const result = movementService.getValidMoves('p1', { diceRoll: 4 });

      expect(result).toEqual(['FINISH']);
    });

    it('with invalid diceRoll=7: returns []', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({
        movement_type: 'dice',
      } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(false);

      const result = movementService.getValidMoves('p1', { diceRoll: 7 });

      expect(result).toEqual([]);
    });
  });

  describe('Stage-1 gate override applies on dice-narrowed path (v3.0.62 regression)', () => {
    it('gate FAILS (missing DOB): collapses to [gate.routeTo] regardless of dice roll', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
        dobApprovalStatus: 'none', // gate will fail
        fdnyApprovalStatus: 'approved',
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({
        movement_type: 'dice',
      } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(true);

      // Even though dice roll 4 normally goes to FINISH, the failed gate
      // forces the player back to the missing examiner (REG-DOB-PLAN-EXAM).
      const result = movementService.getValidMoves('p1', { diceRoll: 4 });

      expect(result).toEqual(['REG-DOB-PLAN-EXAM']);
    });

    it('gate FAILS (missing FDNY): collapses to FDNY exam regardless of dice roll', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'none',
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(true);

      const result = movementService.getValidMoves('p1', { diceRoll: 1 });

      expect(result).toEqual(['REG-FDNY-PLAN-EXAM']);
    });

    it('gate PASSES (both approvals present): keeps the dice destination', () => {
      const player = {
        id: 'p1',
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        visitType: 'First',
        visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'approved',
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' } as Movement);
      mockDataService.getDiceOutcome.mockReturnValue(FINAL_REVIEW_DICE_OUTCOME);
      mockDataService.hasFinalReviewGate.mockReturnValue(true);

      const result = movementService.getValidMoves('p1', { diceRoll: 4 });

      expect(result).toEqual(['FINISH']);
    });
  });

  describe('diceRoll option on non-dice spaces (defensive)', () => {
    it('diceRoll on a choice space is ignored, choice destinations returned', () => {
      const player = {
        id: 'p1',
        currentSpace: 'PM-DECISION-CHECK',
        visitType: 'First',
        visitedSpaces: ['PM-DECISION-CHECK'],
      } as any;
      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue({
        space_name: 'PM-DECISION-CHECK',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'LEND-SCOPE-CHECK',
        destination_2: 'ARCH-INITIATION',
      } as Movement);
      mockDataService.isResumeHub.mockReturnValue(false);
      mockDataService.hasFinalReviewGate.mockReturnValue(false);
      mockDataService.isPathChoiceLockPoint.mockReturnValue(false);

      const result = movementService.getValidMoves('p1', { diceRoll: 5 });

      // diceRoll is ignored — choice space returns its destinations as usual
      expect(result).toEqual(['LEND-SCOPE-CHECK', 'ARCH-INITIATION']);
    });
  });
});
