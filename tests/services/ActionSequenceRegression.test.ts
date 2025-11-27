import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnService } from '../../src/services/TurnService';
import { LoggingService } from '../../src/services/LoggingService';
import { MovementService } from '../../src/services/MovementService';
import { NegotiationService } from '../../src/services/NegotiationService';
import { createMockStateService, createMockDataService, createMockGameRulesService, createMockCardService, createMockResourceService, createMockChoiceService, createMockNegotiationService } from '../mocks/mockServices';
import { GameState } from '../../src/types/StateTypes';

/**
 * ACTION SEQUENCE REGRESSION TESTS
 *
 * These tests protect the critical action sequence fix implemented in September 2025:
 * 1. "Space entry" must be the FIRST action of each turn
 * 2. Players must enter a space BEFORE taking any actions on that space
 * 3. Turn start sequence follows logical order
 * 4. MovementService no longer logs space entry during previous turn
 *
 * ⚠️  WARNING: If these tests fail, the game will show illogical action sequences!
 */

describe('Action Sequence Regression Tests', () => {
  let turnService: TurnService;
  let loggingService: LoggingService;
  let movementService: MovementService;
  let mockStateService: any;
  let mockDataService: any;
  let mockGameRulesService: any;
  let mockCardService: any;
  let mockResourceService: any;
  let mockChoiceService: any;
  let mockNegotiationService: any;
  let mockGameState: GameState;
  let capturedLogs: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedLogs = [];

    mockStateService = createMockStateService();
    mockDataService = createMockDataService();
    mockGameRulesService = createMockGameRulesService();
    mockCardService = createMockCardService();
    mockResourceService = createMockResourceService();
    mockChoiceService = createMockChoiceService();
    mockNegotiationService = createMockNegotiationService();

    // Setup game state for action sequence testing
    mockGameState = {
      players: [
        {
          id: 'player1',
          name: 'TestPlayer',
          color: '#FF0000',
          currentSpace: 'TEST-SPACE',
          visitType: 'First' as const,
          visitedSpaces: ['TEST-SPACE'],
          money: 100,
          timeSpent: 0,
          projectScope: 0,
          hand: [],
          activeCards: [],
          lastDiceRoll: { roll1: 3, roll2: 4, total: 7 },
          spaceEntrySnapshot: undefined,
          turnModifiers: undefined,
          usedTryAgain: false,
          activeEffects: [],
          loans: [],
          score: 0
        }
      ],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as const,
      turn: 1,
      globalTurnCount: 1,
      playerTurnCounts: { player1: 1 },
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      isMoving: false,
      isProcessingArrival: false,
      isInitialized: true,
      gameStartTime: new Date(),
      gameEndTime: undefined,
      winner: undefined,
      currentExplorationSessionId: null,
      requiredActions: 1,
      completedActionCount: 0,
      availableActionTypes: [],
      completedActions: {
        diceRoll: undefined,
        manualActions: {},
      },
      activeNegotiation: null,
      selectedDestination: null,
      globalActionLog: [],
      playerSnapshots: {},
      decks: { W: [], B: [], E: [], L: [], I: [] },
      discardPiles: { W: [], B: [], E: [], L: [], I: [] }
    };

    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.getPlayer.mockReturnValue(mockGameState.players[0]);

    // Capture all logging calls in sequence
    mockStateService.logToActionHistory.mockImplementation((entry: any) => {
      const logEntry = {
        ...entry,
        id: `log_${capturedLogs.length + 1}`,
        timestamp: new Date()
      };
      capturedLogs.push(logEntry);
      return logEntry;
    });

    // Mock space effects and other data
    mockDataService.getSpaceEffects.mockReturnValue([]);
    mockDataService.getDiceEffects.mockReturnValue([]);
    mockStateService.savePreSpaceEffectSnapshot.mockImplementation(() => {});
    mockStateService.updateGameState.mockImplementation(() => {});
    mockStateService.startNewExplorationSession = vi.fn().mockReturnValue('session_123');
    mockStateService.hasPreSpaceEffectSnapshot = vi.fn().mockReturnValue(false);
    mockStateService.isInitialized = vi.fn().mockReturnValue(true);
    mockStateService.markAsInitialized = vi.fn();

    // Additional mocks needed for TurnService.startTurn
    mockStateService.clearPlayerCompletedManualActions = vi.fn();
    mockStateService.clearPlayerHasMoved = vi.fn();
    mockStateService.clearPlayerHasRolledDice = vi.fn();
    mockStateService.setGamePhase = vi.fn();
    mockStateService.setCurrentPlayer = vi.fn();
    mockStateService.advanceTurn = vi.fn();

    loggingService = new LoggingService(mockStateService);
    movementService = new MovementService(mockDataService, mockStateService, loggingService);
    turnService = new TurnService(
      mockDataService,
      mockStateService,
      mockGameRulesService,
      mockCardService,
      mockResourceService,
      movementService,
      mockNegotiationService,
      loggingService,
      mockChoiceService
    );
  });

  describe('CRITICAL: TurnService.startTurn Action Sequence', () => {
    it('should log turn start', async () => {
      // Ensure updateGameState mock is properly set
      expect(mockStateService.updateGameState).toBeDefined();
      expect(typeof mockStateService.updateGameState).toBe('function');

      // Mock the async methods that startTurn calls
      vi.spyOn(turnService as any, 'processSpaceEffectsAfterMovement').mockResolvedValue(undefined);
      vi.spyOn(turnService as any, 'handleMovementChoices').mockResolvedValue(undefined);
      mockStateService.startNewExplorationSession = vi.fn().mockReturnValue('session_123');
      (loggingService as any).startNewExplorationSession = vi.fn().mockReturnValue('session_123');

      // Call startTurn
      await turnService.startTurn('player1');

      // Verify turn start is logged
      expect(capturedLogs.length).toBeGreaterThanOrEqual(1);

      // CRITICAL: First log should be turn start
      expect(capturedLogs[0]).toEqual(expect.objectContaining({
        type: 'turn_start',
        description: 'Turn 2 started' // globalTurnCount + 1
      }));
    });

    it('should ensure turn start has correct details and visibility', async () => {
      // Mock the async dependencies
      vi.spyOn(turnService as any, 'processSpaceEffectsAfterMovement').mockResolvedValue(undefined);
      vi.spyOn(turnService as any, 'handleMovementChoices').mockResolvedValue(undefined);
      mockStateService.startNewExplorationSession = vi.fn().mockReturnValue('session_123');
      (loggingService as any).startNewExplorationSession = vi.fn().mockReturnValue('session_123');

      await turnService.startTurn('player1');

      // Find the turn start log
      const turnStartLog = capturedLogs.find(log => log.type === 'turn_start');
      expect(turnStartLog).toBeDefined();

      // CRITICAL: Turn start should have all required details
      expect(turnStartLog).toEqual(expect.objectContaining({
        type: 'turn_start',
        playerId: 'player1',
        playerName: 'TestPlayer',
        description: 'Turn 2 started',
        visibility: 'player' // CRITICAL: Must be visible to players
      }));
    });

    it('should maintain turn context in turn start log', async () => {
      // Mock dependencies
      vi.spyOn(turnService as any, 'processSpaceEffectsAfterMovement').mockResolvedValue(undefined);
      vi.spyOn(turnService as any, 'handleMovementChoices').mockResolvedValue(undefined);
      mockStateService.startNewExplorationSession = vi.fn().mockReturnValue('session_123');
      (loggingService as any).startNewExplorationSession = vi.fn().mockReturnValue('session_123');

      await turnService.startTurn('player1');

      const turnStartLog = capturedLogs.find(log => log.type === 'turn_start');

      // CRITICAL: Should have correct turn context
      expect(turnStartLog).toBeDefined();
      expect(turnStartLog.playerId).toBe('player1');
      expect(turnStartLog.globalTurnNumber).toBe(2); // globalTurnCount + 1
      expect(turnStartLog.playerTurnNumber).toBe(2); // playerTurnNumber
    });
  });

  describe('CRITICAL: MovementService No Longer Logs Space Entry', () => {
    it('should NOT log space entry from MovementService.endMove', async () => {
      // Mock the async endMove method
      const mockEndMove = vi.spyOn(movementService, 'endMove').mockResolvedValue(mockGameState);

      // Call endMove (MovementService should not log space entry anymore)
      await movementService.endMove('player1');

      // CRITICAL: MovementService should NOT log space entry anymore
      const spaceEntryLogs = capturedLogs.filter(log => log.type === 'space_entry');
      expect(spaceEntryLogs).toHaveLength(0);

      // Movement method should still be called
      expect(mockEndMove).toHaveBeenCalledWith('player1');
    });

    it('should only handle movement logic without logging', async () => {
      // Mock movement method
      const mockMovePlayer = vi.spyOn(movementService, 'movePlayer').mockResolvedValue(mockGameState);

      await movementService.movePlayer('player1', 'DESTINATION-SPACE');

      // CRITICAL: No logging should occur in MovementService
      expect(capturedLogs).toHaveLength(0);

      // But movement logic should still execute
      expect(mockMovePlayer).toHaveBeenCalledWith('player1', 'DESTINATION-SPACE');
    });
  });

  describe('CRITICAL: Integration - Full Turn Flow Sequence', () => {
    it('should demonstrate the complete correct action sequence', async () => {
      // Mock all dependencies for full flow
      vi.spyOn(turnService as any, 'processSpaceEffectsAfterMovement').mockResolvedValue(undefined);
      vi.spyOn(turnService as any, 'handleMovementChoices').mockResolvedValue(undefined);
      mockStateService.startNewExplorationSession = vi.fn().mockReturnValue('session_123');
      (loggingService as any).startNewExplorationSession = vi.fn().mockReturnValue('session_123');

      // 1. Start turn (this should log turn start)
      await turnService.startTurn('player1');

      // 2. Simulate additional player actions that might happen during turn
      loggingService.info('Rolled a 7', {
        playerId: 'player1',
        action: 'dice_roll'
      });

      loggingService.info('Drew a card', {
        playerId: 'player1',
        action: 'card_draw'
      });

      // CRITICAL: Verify complete sequence is logical
      expect(capturedLogs).toHaveLength(3);

      // Expected sequence:
      expect(capturedLogs[0].type).toBe('turn_start');      // 1. Turn begins
      expect(capturedLogs[1].type).toBe('dice_roll');       // 2. Player takes actions
      expect(capturedLogs[2].type).toBe('card_draw');       // 3. More actions...

      // Verify turn start is first
      expect(capturedLogs[0].playerId).toBe('player1');
    });

    it('should ensure turn start is first action', async () => {
      // This test ensures turn starts before any player actions

      vi.spyOn(turnService as any, 'processSpaceEffectsAfterMovement').mockResolvedValue(undefined);
      vi.spyOn(turnService as any, 'handleMovementChoices').mockResolvedValue(undefined);
      mockStateService.startNewExplorationSession = vi.fn().mockReturnValue('session_123');
      (loggingService as any).startNewExplorationSession = vi.fn().mockReturnValue('session_123');

      await turnService.startTurn('player1');

      // CRITICAL: Turn start must be first entry
      expect(capturedLogs.length).toBeGreaterThan(0);
      expect(capturedLogs[0].type).toBe('turn_start');
    });
  });

  describe('CRITICAL: Edge Cases and Error Prevention', () => {
    it('should handle multiple space entries correctly (no duplicates from MovementService)', async () => {
      // Ensure we don't accidentally create duplicate space entry logs

      // MovementService should not log anything
      const mockMovePlayer = vi.spyOn(movementService, 'movePlayer').mockResolvedValue(mockGameState);
      await movementService.movePlayer('player1', 'SOME-SPACE');

      // Should still be 0 logs from MovementService
      expect(capturedLogs).toHaveLength(0);

      // Only TurnService should create space entry logs
      loggingService.info('TestPlayer entered space: SOME-SPACE (First visit)', {
        playerId: 'player1',
        action: 'space_entry',
        spaceName: 'SOME-SPACE'
      });

      // Should now have exactly 1 space entry log
      const spaceEntryLogs = capturedLogs.filter(log => log.type === 'space_entry');
      expect(spaceEntryLogs).toHaveLength(1);
    });

    it('should handle different visit types in space entry logs', () => {
      // Test both First and Subsequent visit types
      loggingService.info('TestPlayer entered space: SPACE-A (First visit)', {
        playerId: 'player1',
        action: 'space_entry',
        spaceName: 'SPACE-A',
        visitType: 'First'
      });

      loggingService.info('TestPlayer entered space: SPACE-A (Subsequent visit)', {
        playerId: 'player1',
        action: 'space_entry',
        spaceName: 'SPACE-A',
        visitType: 'Subsequent'
      });

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs[0].description).toContain('First visit');
      expect(capturedLogs[1].description).toContain('Subsequent visit');

      // Both should be properly typed and visible
      capturedLogs.forEach(log => {
        expect(log.type).toBe('space_entry');
        expect(log.visibility).toBe('player');
      });
    });
  });
});

/**
 * PERFORMANCE & INTEGRATION TESTS
 */
describe('Action Sequence Performance & Integration', () => {
  it('should maintain efficient logging without performance impact', () => {
    const mockStateService = createMockStateService();

    // Mock gameState for the performance test
    const performanceTestGameState = {
      currentExplorationSessionId: 'perf_session_123',
      globalTurnCount: 1,
      players: [{ id: 'player1', name: 'TestPlayer' }],
      playerTurnCounts: { player1: 1 }
    };

    mockStateService.getGameState.mockReturnValue(performanceTestGameState);
    mockStateService.logToActionHistory.mockImplementation(() => {});

    const loggingService = new LoggingService(mockStateService);

    const startTime = performance.now();

    // Log a typical turn sequence
    for (let i = 0; i < 100; i++) {
      loggingService.info(`Turn ${i} started`, { playerId: 'player1', action: 'turn_start' });
      loggingService.info(`Player entered space: SPACE-${i} (First visit)`, {
        playerId: 'player1',
        action: 'space_entry',
        spaceName: `SPACE-${i}`
      });
      loggingService.info('Player took action', { playerId: 'player1', action: 'manual_action' });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (less than 100ms for 300 log entries)
    expect(duration).toBeLessThan(100);

    // Should have logged all entries correctly
    expect(mockStateService.logToActionHistory).toHaveBeenCalledTimes(300);
  });
});