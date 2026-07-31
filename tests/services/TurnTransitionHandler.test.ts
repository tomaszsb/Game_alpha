import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnTransitionHandler } from '../../src/services/TurnTransitionHandler';
import {
  createMockStateService,
  createMockCardService,
  createMockLoggingService,
  createMockEffectEngineService,
} from '../mocks/mockServices';

describe('TurnTransitionHandler', () => {
  let handler: TurnTransitionHandler;
  let mockStateService: any;
  let mockCardService: any;
  let mockLoggingService: any;
  let mockEffectEngineService: any;

  const mockPlayer: any = {
    id: 'player1',
    name: 'Alice',
    currentSpace: 'TEST-SPACE',
    turnModifiers: { skipTurns: 0 },
  };

  const mockGameState: any = {
    players: [mockPlayer],
    globalTurnCount: 3,
    isCapturingStartingHand: false,
  };

  beforeEach(() => {
    mockStateService = createMockStateService();
    mockCardService = createMockCardService();
    mockLoggingService = createMockLoggingService();
    mockEffectEngineService = createMockEffectEngineService();

    mockStateService.getGameState.mockReturnValue(mockGameState);

    handler = new TurnTransitionHandler(mockStateService, mockCardService, mockLoggingService, mockEffectEngineService);
  });

  describe('processEndOfTurn', () => {
    it('processes card expirations via cardService.endOfTurn()', async () => {
      await handler.processEndOfTurn('player1');
      expect(mockCardService.endOfTurn).toHaveBeenCalled();
    });

    // Homeowner Violation mechanic (L050/L051) — the daily-accrual hook this
    // gap was originally about. Confirms the wiring: called once per
    // turn-end, for the player whose turn is ending, same cadence as the
    // active-effects step.
    it('runs the L051 daily-accrual check for the player whose turn is ending', async () => {
      await handler.processEndOfTurn('player1');
      expect(mockCardService.processViolationDailyAccrual).toHaveBeenCalledWith('player1');
      expect(mockCardService.processViolationDailyAccrual).toHaveBeenCalledTimes(1);
    });

    it('runs the daily-accrual check even when there is no active violation (no-op is the card service\'s job, not this wiring\'s)', async () => {
      mockCardService.processViolationDailyAccrual.mockImplementation(() => {});
      await expect(handler.processEndOfTurn('player1')).resolves.not.toThrow();
      expect(mockCardService.processViolationDailyAccrual).toHaveBeenCalledWith('player1');
    });

    it('processes active effects for the current player when effectEngineService is set', async () => {
      await handler.processEndOfTurn('player1');
      expect(mockEffectEngineService.processActiveEffectsForCurrentPlayer).toHaveBeenCalledWith('player1');
    });

    it('does not throw when effectEngineService was never set', async () => {
      const noEffectEngineHandler = new TurnTransitionHandler(mockStateService, mockCardService, mockLoggingService);
      await expect(noEffectEngineHandler.processEndOfTurn('player1')).resolves.not.toThrow();
    });

    it('clears the canReRoll flag for the current player when set', async () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [{ ...mockPlayer, turnModifiers: { skipTurns: 0, canReRoll: true } }],
      });

      await handler.processEndOfTurn('player1');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        turnModifiers: { skipTurns: 0, canReRoll: false },
      });
    });

    it('does not touch turnModifiers when canReRoll is already false', async () => {
      await handler.processEndOfTurn('player1');
      expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
    });

    it('emits a turn_committed event with the completed turn number', async () => {
      await handler.processEndOfTurn('player1');

      expect(mockStateService.emitGameEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'turn_committed',
        playerId: 'player1',
        playerName: 'Alice',
        turn: mockGameState.globalTurnCount + 1,
        spaceName: 'TEST-SPACE',
      }));
    });

    it('finalizes Quick Start hand distribution only for player index 0 while capturing', async () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, { ...mockPlayer, id: 'player2', name: 'Bob' }],
        isCapturingStartingHand: true,
        startingHand: ['W001'],
      });

      await handler.processEndOfTurn('player1'); // index 0 — should finalize
      expect(mockStateService.updateGameState).toHaveBeenCalledWith(
        expect.objectContaining({ isCapturingStartingHand: false })
      );
    });

    it('does not finalize Quick Start hand for a non-first player index', async () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [{ ...mockPlayer, id: 'player0' }, mockPlayer],
        isCapturingStartingHand: true,
        startingHand: ['W001'],
      });

      await handler.processEndOfTurn('player1'); // index 1 — should NOT finalize
      expect(mockStateService.updateGameState).not.toHaveBeenCalled();
    });
  });

  describe('advanceToNextPlayer', () => {
    it('advances to the next player in order and resets turn flags', () => {
      const player2 = { ...mockPlayer, id: 'player2', name: 'Bob', turnModifiers: { skipTurns: 0 } };
      const nextId = handler.advanceToNextPlayer(0, [mockPlayer, player2]);

      expect(nextId).toBe('player2');
      expect(mockStateService.advanceTurn).toHaveBeenCalled();
      expect(mockStateService.setCurrentPlayer).toHaveBeenCalledWith('player2');
      expect(mockStateService.clearPlayerHasMoved).toHaveBeenCalled();
      expect(mockStateService.clearPlayerHasRolledDice).toHaveBeenCalled();
      expect(mockStateService.clearTurnActions).toHaveBeenCalled();
      expect(mockStateService.clearPlayerMoveIntent).toHaveBeenCalledWith('player2');
    });

    it('wraps around to the first player after the last', () => {
      const player2 = { ...mockPlayer, id: 'player2', name: 'Bob', turnModifiers: { skipTurns: 0 } };
      const nextId = handler.advanceToNextPlayer(1, [mockPlayer, player2]);
      expect(nextId).toBe('player1');
    });

    it('skips a player with pending skipTurns and decrements the counter', () => {
      const skippedPlayer = { ...mockPlayer, id: 'player2', name: 'Bob', turnModifiers: { skipTurns: 1 } };
      const player3 = { ...mockPlayer, id: 'player3', name: 'Carol', turnModifiers: { skipTurns: 0 } };
      mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [mockPlayer, skippedPlayer, player3] });

      const nextId = handler.advanceToNextPlayer(0, [mockPlayer, skippedPlayer, player3]);

      expect(nextId).toBe('player3');
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'player2', turnModifiers: expect.objectContaining({ skipTurns: 0 }) })
      );
    });
  });
});
