import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementExecutor, MovementResult } from '../../src/services/MovementExecutor';
import { createMockDataService, createMockStateService, createMockMovementService } from '../mocks/mockServices';
import { Player } from '../../src/types/StateTypes';

describe('MovementExecutor', () => {
  let executor: MovementExecutor;
  let mockDataService: ReturnType<typeof createMockDataService>;
  let mockStateService: ReturnType<typeof createMockStateService>;
  let mockMovementService: ReturnType<typeof createMockMovementService>;

  const makePlayer = (overrides: Partial<Player> = {}): Player => ({
    id: 'p1',
    name: 'Test Player',
    color: '#ff0000',
    currentSpace: 'SPACE-A',
    visitType: 'First',
    money: 100000,
    timeSpent: 0,
    turnsSkipped: 0,
    cards: [],
    loans: [],
    moveIntent: null,
    lastDiceRoll: null,
    isActive: true,
    turnOrder: 1,
    ...overrides
  } as Player);

  const makeGameState = () => ({
    players: [makePlayer()],
    currentPlayerIndex: 0,
  } as any);

  beforeEach(() => {
    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    mockMovementService = createMockMovementService();
    mockMovementService.movePlayer.mockResolvedValue(undefined);
    executor = new MovementExecutor(mockDataService, mockStateService, mockMovementService);
  });

  // === skipAutoMove ===

  describe('skipAutoMove', () => {
    it('returns null when skipAutoMove is true', async () => {
      const result = await executor.executeMovement(makePlayer(), makeGameState(), true);
      expect(result).toBeNull();
      expect(mockMovementService.movePlayer).not.toHaveBeenCalled();
    });
  });

  // === Dice movement path ===

  describe('dice movement', () => {
    it('moves player to dice destination when movement_type is dice_outcome', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 3, dice: [3] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      // Phase 2.1: executor now consumes getValidMoves({ diceRoll }) — the
      // unified resolver narrows to this roll's dest and applies overrides.
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-B']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: true,
        fromSpace: 'SPACE-A',
        toSpace: 'SPACE-B',
        reason: 'dice'
      });
      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('p1', { diceRoll: 3 });
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'SPACE-B');
      expect(mockStateService.emitGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'movement', toSpace: 'SPACE-B' })
      );
    });

    it('moves player when movement_type is dice', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 5, dice: [5] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-C']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.moved).toBe(true);
      expect(result?.reason).toBe('dice');
      expect(result?.toSpace).toBe('SPACE-C');
      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('p1', { diceRoll: 5 });
    });

    it('returns moved:false when getValidMoves returns [] for this dice roll', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 4, dice: [4] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: false,
        fromSpace: 'SPACE-A',
        toSpace: null,
        reason: 'none'
      });
      expect(mockMovementService.movePlayer).not.toHaveBeenCalled();
    });

    it('skips dice path when player has no lastDiceRoll', async () => {
      const player = makePlayer({ lastDiceRoll: null as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      // Falls through to auto-move path since dice condition not met
      expect(result?.reason).toBe('none');
      // Confirm dice-path branch did NOT call getValidMoves with diceRoll
      const diceRollCalls = mockMovementService.getValidMoves.mock.calls.filter(
        ([, opts]: [string, any]) => opts && opts.diceRoll !== undefined
      );
      expect(diceRollCalls.length).toBe(0);
    });

    it('skips dice path when movement_type is not dice-related', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 3, dice: [3] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.reason).toBe('none');
      // Confirm dice-path branch did NOT call getValidMoves with diceRoll
      const diceRollCalls = mockMovementService.getValidMoves.mock.calls.filter(
        ([, opts]: [string, any]) => opts && opts.diceRoll !== undefined
      );
      expect(diceRollCalls.length).toBe(0);
    });

    // v3.0.62 regression — Stage-1 gate override on the dice path.
    // Phase 2.1 audit (2026-06-04) restructured this: MovementExecutor no longer
    // applies the gate inline — it consumes the unified getValidMoves({ diceRoll })
    // resolver which applies the gate in one place. These tests now assert the
    // executor consumes the resolver's gate-overridden output correctly.
    it('uses gate-overridden destination when has_final_review_gate fires (via getValidMoves)', async () => {
      const player = makePlayer({
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        lastDiceRoll: { total: 3, dice: [3] } as any,
      });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      // Resolver returns the gate's routeTo because gate failed (live behavior
      // tested in MovementService unit tests below).
      mockMovementService.getValidMoves.mockReturnValue(['REG-DOB-PLAN-EXAM']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('p1', { diceRoll: 3 });
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'REG-DOB-PLAN-EXAM');
      expect(result?.toSpace).toBe('REG-DOB-PLAN-EXAM');
      expect(result?.reason).toBe('dice');
    });

    it('uses dice destination when has_final_review_gate passes (via getValidMoves)', async () => {
      const player = makePlayer({
        currentSpace: 'REG-DOB-FINAL-REVIEW',
        lastDiceRoll: { total: 1, dice: [1] } as any,
      });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      // Resolver returns the raw dice destination because gate passed.
      mockMovementService.getValidMoves.mockReturnValue(['FINISH']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'FINISH');
      expect(result?.toSpace).toBe('FINISH');
    });
  });

  // === Intent movement path ===

  describe('intent movement', () => {
    it('moves player to moveIntent destination', async () => {
      const player = makePlayer({ moveIntent: 'SPACE-D' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      // Phase 2.1 follow-up (v3.0.67): intent is reconciled against the live
      // resolver before execution — intent must be a currently-valid move.
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-D']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: true,
        fromSpace: 'SPACE-A',
        toSpace: 'SPACE-D',
        reason: 'intent'
      });
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'SPACE-D');
      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('p1', null);
    });

    it('clears moveIntent after execution', async () => {
      const player = makePlayer({ moveIntent: 'SPACE-E' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-E']);

      await executor.executeMovement(player, makeGameState(), false);

      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('p1', null);
    });

    it('emits auto-action event before moving', async () => {
      const player = makePlayer({ moveIntent: 'SPACE-F' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-F']);

      await executor.executeMovement(player, makeGameState(), false);

      expect(mockStateService.emitGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'movement',
          playerId: 'p1',
          fromSpace: 'SPACE-A',
          toSpace: 'SPACE-F'
        })
      );
    });

    // v3.0.67 — stale-intent reconciliation (fb:49559c76 / fb:dc702660).
    // A moveIntent set earlier (e.g. a Stage-1 gate reroute to REG-DOB-PLAN-EXAM
    // when DOB was missing) can go stale if approval state changes before END
    // TURN. v3.0.66 removed the inline gate override, so a stale intent reached
    // validateMove and threw "Invalid move" (v3.0.61 crash family reintroduced).
    // The executor now reconciles intent against the live resolver first.
    it('does NOT crash when moveIntent is stale (not in current valid moves); clears it and reports no move', async () => {
      const player = makePlayer({ currentSpace: 'REG-DOB-FINAL-REVIEW', moveIntent: 'REG-DOB-PLAN-EXAM' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      // DOB now reads approved at execution → resolver returns the raw Final
      // Review destinations, which do NOT include the stale reroute intent.
      mockMovementService.getValidMoves.mockReturnValue(['FINISH', 'CON-INSPECT', 'REG-FDNY-FEE-REVIEW']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({ moved: false, fromSpace: 'REG-DOB-FINAL-REVIEW', toSpace: null, reason: 'none' });
      expect(mockMovementService.movePlayer).not.toHaveBeenCalled();
      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('p1', null);
    });

    it('reconciles a stale intent to the single forced destination (gate reroute) instead of crashing', async () => {
      const player = makePlayer({ currentSpace: 'REG-DOB-FINAL-REVIEW', moveIntent: 'FINISH' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      // Gate fails at execution → resolver collapses to the single reroute, which
      // differs from the stale intent. Executor trusts the resolver.
      mockMovementService.getValidMoves.mockReturnValue(['REG-DOB-PLAN-EXAM']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.moved).toBe(true);
      expect(result?.toSpace).toBe('REG-DOB-PLAN-EXAM');
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'REG-DOB-PLAN-EXAM');
    });

    it('dice path takes priority over intent when both exist', async () => {
      const player = makePlayer({
        moveIntent: 'SPACE-INTENT',
        lastDiceRoll: { total: 2, dice: [2] } as any
      });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-DICE']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.reason).toBe('dice');
      expect(result?.toSpace).toBe('SPACE-DICE');
    });
  });

  // === Auto-move fallback path ===

  describe('auto-move fallback', () => {
    it('auto-moves when exactly one valid move exists', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-ONLY']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: true,
        fromSpace: 'SPACE-A',
        toSpace: 'SPACE-ONLY',
        reason: 'auto'
      });
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'SPACE-ONLY');
    });

    it('does not auto-move when multiple valid moves exist', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-X', 'SPACE-Y']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: false,
        fromSpace: 'SPACE-A',
        toSpace: null,
        reason: 'none'
      });
      expect(mockMovementService.movePlayer).not.toHaveBeenCalled();
    });

    it('does not auto-move when no valid moves exist', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: false,
        fromSpace: 'SPACE-A',
        toSpace: null,
        reason: 'none'
      });
    });
  });

  // === Edge cases ===

  describe('edge cases', () => {
    it('handles null movement data gracefully', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue(null);
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.moved).toBe(false);
      expect(result?.reason).toBe('none');
    });

    it('handles undefined movement data gracefully', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue(undefined);
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-NEXT']);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.moved).toBe(true);
      expect(result?.reason).toBe('auto');
    });

    it('emits auto-action before dice move', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 1, dice: [1] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-DEST']);

      const callOrder: string[] = [];
      mockStateService.emitGameEvent.mockImplementation(() => { callOrder.push('emit'); });
      mockMovementService.movePlayer.mockImplementation(async () => { callOrder.push('move'); });

      await executor.executeMovement(player, makeGameState(), false);

      expect(callOrder).toEqual(['emit', 'move']);
    });

    it('emits auto-action before auto-move', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue(null);
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-AUTO']);

      const callOrder: string[] = [];
      mockStateService.emitGameEvent.mockImplementation(() => { callOrder.push('emit'); });
      mockMovementService.movePlayer.mockImplementation(async () => { callOrder.push('move'); });

      await executor.executeMovement(player, makeGameState(), false);

      expect(callOrder).toEqual(['emit', 'move']);
    });

    it('uses dice roll total, not individual die values', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 6, dice: [3, 3] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-SIX']);

      await executor.executeMovement(player, makeGameState(), false);

      // Phase 2.1: executor now passes total via getValidMoves options.
      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('p1', { diceRoll: 6 });
    });

    it('passes correct visitType to getMovement', async () => {
      const player = makePlayer({ visitType: 'Subsequent' as any });
      mockDataService.getMovement.mockReturnValue(null);
      mockMovementService.getValidMoves.mockReturnValue([]);

      await executor.executeMovement(player, makeGameState(), false);

      expect(mockDataService.getMovement).toHaveBeenCalledWith('SPACE-A', 'Subsequent');
    });
  });
});
