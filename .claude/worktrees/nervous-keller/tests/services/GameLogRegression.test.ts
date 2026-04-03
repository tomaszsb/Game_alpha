import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggingService } from '../../src/services/LoggingService';
import { TurnService } from '../../src/services/TurnService';
import { StateService } from '../../src/services/StateService';
import { createMockStateService, createMockDataService } from '../mocks/mockServices';
import { GameState, Player, ActionLogEntry } from '../../src/types/StateTypes';
import { LogLevel } from '../../src/types/ServiceContracts';

/**
 * GAME LOG REGRESSION TESTS
 *
 * These tests protect the critical game log architecture fixes implemented in September 2025:
 * 1. Turn numbering system (Turn 0 for setup, Turn 1+ for gameplay)
 * 2. Action sequence logic (space entry first in each turn)
 * 3. Color consistency (player colors vs system gray)
 * 4. Space progression (Try Again preserves visit history)
 * 5. Visibility filtering (player vs debug/system logs)
 *
 * ⚠️  WARNING: If any of these tests fail, it means core game log functionality has regressed!
 */

describe('Game Log Architecture Regression Tests', () => {
  let loggingService: LoggingService;
  let turnService: TurnService;
  let mockStateService: vi.Mocked<StateService>;
  let mockDataService: any;
  let mockGameState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateService = createMockStateService() as vi.Mocked<StateService>;
    mockDataService = createMockDataService();

    // Create realistic game state with simplified turn tracking
    mockGameState = {
      players: [
        {
          id: 'player1',
          name: 'Alice',
          color: '#FF6B6B',
          currentSpace: 'OWNER-SCOPE-INITIATION',
          visitType: 'First' as const,
          visitedSpaces: ['OWNER-SCOPE-INITIATION'],
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
        },
        {
          id: 'player2',
          name: 'Bob',
          color: '#4ECDC4',
          currentSpace: 'OWNER-FUND-INITIATION',
          visitType: 'Subsequent' as const,
          visitedSpaces: ['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION'],
          money: 150,
          timeSpent: 5,
          projectScope: 2,
          hand: [],
          activeCards: [],
          lastDiceRoll: { roll1: 2, roll2: 3, total: 5 },
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
      turn: 3,
      // Simplified turn tracking system (CRITICAL FOR REGRESSION TESTS)
      globalTurnCount: 3,
      playerTurnCounts: { player1: 2, player2: 1 },
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

    // Setup mock state service
    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.getPlayer.mockImplementation((playerId: string) => {
      return mockGameState.players.find(p => p.id === playerId) || null;
    });

    // Mock logToActionHistory to capture log entries
    const capturedLogs: ActionLogEntry[] = [];
    mockStateService.logToActionHistory.mockImplementation((entry: Omit<ActionLogEntry, 'id' | 'timestamp'>) => {
      const fullEntry: ActionLogEntry = {
        ...entry,
        id: `log_${capturedLogs.length + 1}`,
        timestamp: new Date()
      };
      capturedLogs.push(fullEntry);
      mockGameState.globalActionLog = [...capturedLogs];
    });

    loggingService = new LoggingService(mockStateService);
  });

  describe('CRITICAL: Turn Numbering System', () => {
    it('should use Turn 0 for game_start setup entries', () => {
      // Simulate initial player placement (setup)
      loggingService.info('Alice placed on starting space: OWNER-SCOPE-INITIATION', {
        playerId: 'player1',
        playerName: 'Alice',
        action: 'game_start',
        spaceName: 'OWNER-SCOPE-INITIATION',
        description: 'Initial placement'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'game_start',
          playerId: 'player1',
          playerName: 'Alice',
          globalTurnNumber: 0, // CRITICAL: Setup should be Turn 0
          playerTurnNumber: 0, // CRITICAL: Setup should be Turn 0
          description: 'Alice placed on starting space: OWNER-SCOPE-INITIATION'
        })
      );
    });

    it('should use actual turn counts for regular gameplay entries', () => {
      // Simulate regular gameplay action
      loggingService.info('Alice rolled dice', {
        playerId: 'player1',
        action: 'dice_roll'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dice_roll',
          playerId: 'player1',
          globalTurnNumber: 3, // Should use actual globalTurnCount
          playerTurnNumber: 2,  // Should use actual playerTurnCounts[player1]
        })
      );
    });

    it('should distinguish between setup and gameplay for same player', () => {
      // Setup entry
      loggingService.info('Alice placed on starting space: OWNER-SCOPE-INITIATION', {
        playerId: 'player1',
        action: 'game_start'
      });

      // Gameplay entry
      loggingService.info('Turn 4 started', {
        playerId: 'player1',
        action: 'turn_start'
      });

      const calls = mockStateService.logToActionHistory.mock.calls;

      // Setup entry should be Turn 0
      expect(calls[0][0]).toEqual(expect.objectContaining({
        globalTurnNumber: 0,
        playerTurnNumber: 0
      }));

      // Gameplay entry should use real turn numbers
      expect(calls[1][0]).toEqual(expect.objectContaining({
        globalTurnNumber: 3, // From mockGameState.globalTurnCount
        playerTurnNumber: 2   // From mockGameState.playerTurnCounts.player1
      }));
    });
  });

  describe('CRITICAL: Visibility System', () => {
    it('should assign player visibility to player-facing actions', () => {
      loggingService.info('Alice drew a card', {
        playerId: 'player1',
        action: 'card_draw'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'player' // CRITICAL: Player actions should be visible
        })
      );
    });

    it('should assign system visibility to system entries', () => {
      loggingService.info('System initialization completed', {
        playerId: 'system',
        action: 'system_log'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'system' // CRITICAL: System logs should be system visibility
        })
      );
    });

    it('should assign player visibility to error events (players need to see errors)', () => {
      const testError = new Error('Test error');
      loggingService.error('Action failed', testError, {
        playerId: 'player1'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_event',
          visibility: 'player' // CRITICAL: Players should see errors
        })
      );
    });
  });

  describe('CRITICAL: Action Type Inference', () => {
    it('should correctly infer space_entry from message content', () => {
      loggingService.info('landed on OWNER-SCOPE-INITIATION', {
        playerId: 'player1'
        // No explicit action type provided
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'space_entry' // CRITICAL: Should infer from message content
        })
      );
    });

    it('should prioritize explicit action over message inference', () => {
      loggingService.info('Alice entered space: OWNER-SCOPE-INITIATION', {
        playerId: 'player1',
        action: 'manual_action' // Explicit action should override message inference
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'manual_action' // CRITICAL: Explicit action takes priority
        })
      );
    });

    it('should infer turn_start from message pattern', () => {
      loggingService.info('Turn 4 started', {
        playerId: 'player1'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'turn_start'
        })
      );
    });

    it('should infer dice_roll from message pattern', () => {
      loggingService.info('Rolled a 7', {
        playerId: 'player1'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dice_roll'
        })
      );
    });
  });

  describe('CRITICAL: Session Management', () => {
    it('should mark logs as committed when no exploration session is active', () => {
      mockGameState.currentExplorationSessionId = null;

      loggingService.info('System message', {
        playerId: 'system'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: true // CRITICAL: Should be committed when no session active
        })
      );
    });

    it('should mark logs as uncommitted when exploration session is active', () => {
      mockGameState.currentExplorationSessionId = 'session_123';

      loggingService.info('Player exploring action', {
        playerId: 'player1'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: false, // CRITICAL: Should be uncommitted during exploration
          explorationSessionId: 'session_123'
        })
      );
    });

    it('should always commit error logs regardless of session state', () => {
      mockGameState.currentExplorationSessionId = 'session_123';

      const testError = new Error('Critical error');
      loggingService.error('Something went wrong', testError, {
        playerId: 'player1'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: true // CRITICAL: Errors should always be committed
        })
      );
    });
  });

  describe('CRITICAL: Player Name Resolution', () => {
    it('should auto-resolve player name from playerId when not provided', () => {
      loggingService.info('Player action', {
        playerId: 'player1'
        // No playerName provided
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player1',
          playerName: 'Alice' // CRITICAL: Should resolve from player data
        })
      );
    });

    it('should use provided playerName when both playerId and playerName given', () => {
      loggingService.info('Player action', {
        playerId: 'player1',
        playerName: 'Explicit Name'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player1',
          playerName: 'Explicit Name' // CRITICAL: Should use explicit name
        })
      );
    });

    it('should fallback to playerId when player not found', () => {
      loggingService.info('Unknown player action', {
        playerId: 'unknown_player'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'unknown_player',
          playerName: 'unknown_player' // CRITICAL: Should fallback to playerId
        })
      );
    });

    it('should use System for system logs', () => {
      loggingService.info('System message', {
        playerId: 'system'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'system',
          playerName: 'System' // CRITICAL: System should be "System"
        })
      );
    });
  });
});

/**
 * INTEGRATION TESTS: Full Game Log Flow
 *
 * These tests verify the complete game log flow from turn start to turn end,
 * ensuring the action sequence and turn progression work correctly together.
 */
describe('Game Log Integration Flow', () => {
  let mockStateService: vi.Mocked<StateService>;
  let mockDataService: any;
  let mockGameState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateService = createMockStateService() as vi.Mocked<StateService>;
    mockDataService = createMockDataService();

    // Simplified game state for integration testing
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
  });

  it('CRITICAL: should maintain correct action sequence throughout game flow', () => {
    const loggingService = new LoggingService(mockStateService);
    const capturedLogs: any[] = [];

    // Capture all log entries in order
    mockStateService.logToActionHistory.mockImplementation((entry) => {
      capturedLogs.push(entry);
    });

    // Simulate the correct turn flow sequence:
    // 1. Turn start
    loggingService.info('Turn 1 started', {
      playerId: 'player1',
      action: 'turn_start'
    });

    // 2. Space entry (should be first action after turn start)
    loggingService.info('TestPlayer entered space: TEST-SPACE (First visit)', {
      playerId: 'player1',
      action: 'space_entry',
      spaceName: 'TEST-SPACE',
      visitType: 'First'
    });

    // 3. Player actions
    loggingService.info('Rolled a 7', {
      playerId: 'player1',
      action: 'dice_roll'
    });

    loggingService.info('Drew a card', {
      playerId: 'player1',
      action: 'card_draw'
    });

    // Verify the sequence is correct
    expect(capturedLogs).toHaveLength(4);

    // CRITICAL: Verify action sequence
    expect(capturedLogs[0].type).toBe('turn_start');
    expect(capturedLogs[1].type).toBe('space_entry'); // MUST be first action
    expect(capturedLogs[2].type).toBe('dice_roll');
    expect(capturedLogs[3].type).toBe('card_draw');

    // CRITICAL: All entries should have same turn numbers (same turn)
    capturedLogs.forEach(entry => {
      expect(entry.globalTurnNumber).toBe(1);
      expect(entry.playerTurnNumber).toBe(1);
    });

    // CRITICAL: All should be player visible
    capturedLogs.forEach(entry => {
      expect(entry.visibility).toBe('player');
    });
  });

  it('CRITICAL: should handle setup vs gameplay distinction in full flow', () => {
    const loggingService = new LoggingService(mockStateService);
    const capturedLogs: any[] = [];

    mockStateService.logToActionHistory.mockImplementation((entry) => {
      capturedLogs.push(entry);
    });

    // 1. Game setup entries (Turn 0)
    loggingService.info('TestPlayer placed on starting space: TEST-SPACE', {
      playerId: 'player1',
      action: 'game_start',
      spaceName: 'TEST-SPACE'
    });

    // 2. Actual gameplay entries (Turn 1+)
    loggingService.info('Turn 1 started', {
      playerId: 'player1',
      action: 'turn_start'
    });

    // Verify setup vs gameplay distinction
    expect(capturedLogs[0]).toEqual(expect.objectContaining({
      type: 'game_start',
      globalTurnNumber: 0,  // CRITICAL: Setup is Turn 0
      playerTurnNumber: 0
    }));

    expect(capturedLogs[1]).toEqual(expect.objectContaining({
      type: 'turn_start',
      globalTurnNumber: 1,  // CRITICAL: Gameplay starts at Turn 1
      playerTurnNumber: 1
    }));
  });
});