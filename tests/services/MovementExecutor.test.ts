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
      mockMovementService.getDiceDestination.mockReturnValue('SPACE-B');

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result).toEqual({
        moved: true,
        fromSpace: 'SPACE-A',
        toSpace: 'SPACE-B',
        reason: 'dice'
      });
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('p1', 'SPACE-B');
      expect(mockStateService.emitAutoAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'movement', toSpace: 'SPACE-B' })
      );
    });

    it('moves player when movement_type is dice', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 5, dice: [5] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice' });
      mockMovementService.getDiceDestination.mockReturnValue('SPACE-C');

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.moved).toBe(true);
      expect(result?.reason).toBe('dice');
      expect(result?.toSpace).toBe('SPACE-C');
    });

    it('returns moved:false when getDiceDestination returns null', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 4, dice: [4] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getDiceDestination.mockReturnValue(null);

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
      const player = makePlayer({ lastDiceRoll: null });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      // Falls through to auto-move path since dice condition not met
      expect(result?.reason).toBe('none');
      expect(mockMovementService.getDiceDestination).not.toHaveBeenCalled();
    });

    it('skips dice path when movement_type is not dice-related', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 3, dice: [3] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });
      mockMovementService.getValidMoves.mockReturnValue([]);

      const result = await executor.executeMovement(player, makeGameState(), false);

      expect(result?.reason).toBe('none');
      expect(mockMovementService.getDiceDestination).not.toHaveBeenCalled();
    });
  });

  // === Intent movement path ===

  describe('intent movement', () => {
    it('moves player to moveIntent destination', async () => {
      const player = makePlayer({ moveIntent: 'SPACE-D' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });

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

      await executor.executeMovement(player, makeGameState(), false);

      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('p1', null);
    });

    it('emits auto-action event before moving', async () => {
      const player = makePlayer({ moveIntent: 'SPACE-F' });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'linear' });

      await executor.executeMovement(player, makeGameState(), false);

      expect(mockStateService.emitAutoAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'movement',
          playerId: 'p1',
          fromSpace: 'SPACE-A',
          toSpace: 'SPACE-F'
        })
      );
    });

    it('dice path takes priority over intent when both exist', async () => {
      const player = makePlayer({
        moveIntent: 'SPACE-INTENT',
        lastDiceRoll: { total: 2, dice: [2] } as any
      });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getDiceDestination.mockReturnValue('SPACE-DICE');

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
      mockMovementService.getDiceDestination.mockReturnValue('SPACE-DEST');

      const callOrder: string[] = [];
      mockStateService.emitAutoAction.mockImplementation(() => { callOrder.push('emit'); });
      mockMovementService.movePlayer.mockImplementation(async () => { callOrder.push('move'); });

      await executor.executeMovement(player, makeGameState(), false);

      expect(callOrder).toEqual(['emit', 'move']);
    });

    it('emits auto-action before auto-move', async () => {
      const player = makePlayer();
      mockDataService.getMovement.mockReturnValue(null);
      mockMovementService.getValidMoves.mockReturnValue(['SPACE-AUTO']);

      const callOrder: string[] = [];
      mockStateService.emitAutoAction.mockImplementation(() => { callOrder.push('emit'); });
      mockMovementService.movePlayer.mockImplementation(async () => { callOrder.push('move'); });

      await executor.executeMovement(player, makeGameState(), false);

      expect(callOrder).toEqual(['emit', 'move']);
    });

    it('uses dice roll total, not individual die values', async () => {
      const player = makePlayer({ lastDiceRoll: { total: 6, dice: [3, 3] } as any });
      mockDataService.getMovement.mockReturnValue({ movement_type: 'dice_outcome' });
      mockMovementService.getDiceDestination.mockReturnValue('SPACE-SIX');

      await executor.executeMovement(player, makeGameState(), false);

      expect(mockMovementService.getDiceDestination).toHaveBeenCalledWith('SPACE-A', 'First', 6);
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
