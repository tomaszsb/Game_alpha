import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggingService } from '../../src/services/LoggingService';
import { TurnService } from '../../src/services/TurnService';
import { createMockStateService, createMockDataService } from '../mocks/mockServices';
import { GameState } from '../../src/types/StateTypes';

describe('Transactional Logging Architecture', () => {
  let loggingService: LoggingService;
  let turnService: TurnService;
  let mockStateService: any;
  let mockDataService: any;
  let mockGameState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock services
    mockStateService = createMockStateService();
    mockDataService = createMockDataService();

    // Create a realistic game state with the new transactional logging field
    mockGameState = {
      players: [
        {
          id: 'player1',
          name: 'Alice',
          currentSpace: 'SPACE-A1',
          visitType: 'First' as const,
          visitedSpaces: ['SPACE-A1'],
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
      // Simplified turn tracking system
      globalTurnCount: 1,
      // Track individual player turn counts for statistics
      playerTurnCounts: { player1: 1 },
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      isMoving: false,
      isProcessingArrival: false,
      isInitialized: true,
      currentExplorationSessionId: null, // Key field for transactional logging
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
    mockStateService.getPlayer.mockReturnValue(mockGameState.players[0]);
    mockStateService.updateGameState.mockImplementation((newState: Partial<GameState>) => {
      Object.assign(mockGameState, newState);
      return mockGameState;
    });

    // Create services
    loggingService = new LoggingService(mockStateService);

    // Mock console methods to avoid spam during tests
    vi.spyOn(console, 'log').mockImplementation();
    vi.spyOn(console, 'warn').mockImplementation();
    vi.spyOn(console, 'error').mockImplementation();
    vi.spyOn(console, 'debug').mockImplementation();
  });

  describe('Session Lifecycle Management', () => {
    it('should start a new exploration session and update game state', () => {
      const sessionId = loggingService.startNewExplorationSession();

      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(mockStateService.updateGameState).toHaveBeenCalledWith(
        expect.objectContaining({
          currentExplorationSessionId: sessionId
        })
      );
    });

    it('should return current session ID when session is active', () => {
      const sessionId = loggingService.startNewExplorationSession();

      // Mock the updated state with the session ID
      mockGameState.currentExplorationSessionId = sessionId;

      const currentSessionId = loggingService.getCurrentSessionId();
      expect(currentSessionId).toBe(sessionId);
    });

    it('should return null when no session is active', () => {
      mockGameState.currentExplorationSessionId = null;

      const currentSessionId = loggingService.getCurrentSessionId();
      expect(currentSessionId).toBeNull();
    });

    it('should commit current session by marking entries as committed', () => {
      // Start a session
      const sessionId = loggingService.startNewExplorationSession();
      mockGameState.currentExplorationSessionId = sessionId;

      // Add some mock log entries for the session
      const mockLogEntries = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'dice_roll' as const,
          playerId: 'player1',
          playerName: 'Alice',
          description: 'Rolled a 7',
          details: {},
          isCommitted: false,
          explorationSessionId: sessionId
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'card_draw' as const,
          playerId: 'player1',
          playerName: 'Alice',
          description: 'Drew a card',
          details: {},
          isCommitted: false,
          explorationSessionId: sessionId
        }
      ];

      mockGameState.globalActionLog = mockLogEntries;

      // Commit the session
      loggingService.commitCurrentSession();

      // Verify all entries for this session are now committed
      expect(mockStateService.updateGameState).toHaveBeenCalledWith(
        expect.objectContaining({
          globalActionLog: [
            expect.objectContaining({ isCommitted: true, explorationSessionId: sessionId }),
            expect.objectContaining({ isCommitted: true, explorationSessionId: sessionId })
          ],
          currentExplorationSessionId: null
        })
      );
    });

    it('should handle commit when no session is active', () => {
      mockGameState.currentExplorationSessionId = null;

      loggingService.commitCurrentSession();

      // Should log a warning but not crash
      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Attempted to commit session but no current session exists'
        })
      );
    });
  });

  describe('Transactional Logging Behavior', () => {
    it('should mark logs as uncommitted when session is active', () => {
      // Start a session
      const sessionId = loggingService.startNewExplorationSession();
      mockGameState.currentExplorationSessionId = sessionId;

      // Log a message during active session
      loggingService.info('Player action during exploration', {
        playerId: 'player1',
        playerName: 'Alice'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: false, // Should be uncommitted during exploration
          explorationSessionId: sessionId
        })
      );
    });

    it('should mark logs as committed when no session is active', () => {
      mockGameState.currentExplorationSessionId = null;

      loggingService.info('System message', { playerId: 'system' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: true, // Should be immediately committed
          explorationSessionId: expect.stringMatching(/^system_\d+_[a-z0-9]+$/)
        })
      );
    });

    it('should respect explicit isCommitted flag in payload', () => {
      const sessionId = loggingService.startNewExplorationSession();
      mockGameState.currentExplorationSessionId = sessionId;

      // Log with explicit committed flag (like Try Again action)
      loggingService.info('Try Again action', {
        playerId: 'player1',
        playerName: 'Alice',
        isCommitted: true // Explicitly set as committed
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: true, // Should respect explicit flag
          explorationSessionId: sessionId
        })
      );
    });

    it('should always commit error logs regardless of session state', () => {
      const sessionId = loggingService.startNewExplorationSession();
      mockGameState.currentExplorationSessionId = sessionId;

      // Error logs should always be committed
      const testError = new Error('Test error');
      loggingService.error('An error occurred', testError, { playerId: 'player1' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          isCommitted: true, // Errors should always be committed
          explorationSessionId: sessionId
        })
      );
    });
  });

  describe('Cleanup Functionality', () => {
    it('should clean up old uncommitted entries', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago

      const mockLogEntries = [
        {
          id: '1',
          timestamp: oldDate,
          type: 'dice_roll' as const,
          playerId: 'player1',
          playerName: 'Alice',
          description: 'Old uncommitted entry',
          details: {},
          isCommitted: false,
          explorationSessionId: 'old_session'
        },
        {
          id: '2',
          timestamp: recentDate,
          type: 'card_draw' as const,
          playerId: 'player1',
          playerName: 'Alice',
          description: 'Recent uncommitted entry',
          details: {},
          isCommitted: false,
          explorationSessionId: 'recent_session'
        },
        {
          id: '3',
          timestamp: oldDate,
          type: 'turn_start' as const,
          playerId: 'player1',
          playerName: 'Alice',
          description: 'Old committed entry',
          details: {},
          isCommitted: true,
          explorationSessionId: 'old_session'
        }
      ];

      mockGameState.globalActionLog = mockLogEntries;

      loggingService.cleanupAbandonedSessions();

      // Should keep recent uncommitted and all committed entries, remove old uncommitted
      expect(mockStateService.updateGameState).toHaveBeenCalledWith(
        expect.objectContaining({
          globalActionLog: [
            expect.objectContaining({ id: '2' }), // Recent uncommitted - keep
            expect.objectContaining({ id: '3' })  // Old committed - keep
          ]
        })
      );

      // Should log the cleanup action
      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Cleaned up 1 abandoned log entries'
        })
      );
    });

    it('should do nothing when no cleanup is needed', () => {
      mockGameState.globalActionLog = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'dice_roll' as const,
          playerId: 'player1',
          playerName: 'Alice',
          description: 'Recent entry',
          details: {},
          isCommitted: true,
          explorationSessionId: 'session1'
        }
      ];

      const initialUpdateCalls = mockStateService.updateGameState.mock.calls.length;

      loggingService.cleanupAbandonedSessions();

      // Should not call updateGameState if no cleanup needed
      expect(mockStateService.updateGameState).toHaveBeenCalledTimes(initialUpdateCalls);
    });
  });
});