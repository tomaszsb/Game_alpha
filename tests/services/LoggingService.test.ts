import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggingService } from '../../src/services/LoggingService';
import { IStateService, LogLevel } from '../../src/types/ServiceContracts';
import { createMockStateService } from '../mocks/mockServices';

// Helper function to create expected log entry with transactional fields
const expectLogEntry = (baseEntry: any) => {
  return expect.objectContaining({
    ...baseEntry,
    isCommitted: true, // Default for system logs
    explorationSessionId: expect.stringMatching(/^system_\d+_[a-z0-9]+$/)
  });
};

describe('LoggingService', () => {
  let loggingService: LoggingService;
  let mockStateService: vi.Mocked<IStateService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStateService = createMockStateService();

    // Mock getGameState to return a state with the new transactional logging field
    mockStateService.getGameState.mockReturnValue({
      players: [],
      currentPlayerId: null,
      gamePhase: 'SETUP',
      turn: 0,
      // Simplified turn tracking system
      globalTurnCount: 0,
      // Track individual player turn counts for statistics
      playerTurnCounts: {},
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      isMoving: false,
      isProcessingArrival: false,
      isInitialized: false,
      gameStartTime: undefined,
      gameEndTime: undefined,
      winner: undefined,
      currentExplorationSessionId: null, // New field for transactional logging
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
    });

    loggingService = new LoggingService(mockStateService);

    // Mock console methods to avoid spam during tests
    vi.spyOn(console, 'log').mockImplementation();
    vi.spyOn(console, 'warn').mockImplementation();
    vi.spyOn(console, 'error').mockImplementation();
    vi.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Logging Methods', () => {
    it('should log info messages correctly', () => {
      loggingService.info('Test info message', { key: 'value' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
          type: 'system_log',
          playerId: 'system',
          playerName: 'System',
          description: 'Test info message',
          details: {
            level: LogLevel.INFO,
            key: 'value'
          }
        })
      );

      expect(console.log).toHaveBeenCalledWith('[INFO] Test info message', { key: 'value' });
    });

    it('should log warning messages correctly', () => {
      loggingService.warn('Test warning message');

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
          type: 'system_log',
          playerId: 'system',
          playerName: 'System',
          description: 'Test warning message',
          details: {
            level: LogLevel.WARN
          }
        })
      );

      expect(console.warn).toHaveBeenCalledWith('[WARN] Test warning message', {});
    });

    it('should log error messages correctly with error details', () => {
      const testError = new Error('Test error');
      testError.stack = 'Test stack trace';

      loggingService.error('Test error message', testError, { context: 'test' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'error_event',
        playerId: 'system',
        playerName: 'System',
        description: 'Test error message',
        details: {
          level: LogLevel.ERROR,
          context: 'test',
          errorMessage: 'Test error',
          errorStack: 'Test stack trace'
        }
        })
      );

      expect(console.error).toHaveBeenCalled();
    });

    it('should log debug messages correctly', () => {
      loggingService.debug('Test debug message');

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'system_log',
        playerId: 'system',
        playerName: 'System',
        description: 'Test debug message',
        details: {
          level: LogLevel.DEBUG
        }
        })
      );

      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe('Performance Timing', () => {
    beforeEach(() => {
      // Mock performance.now()
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(1000) // startPerformanceTimer
        .mockReturnValueOnce(1250); // endPerformanceTimer
    });

    it('should measure performance timing correctly', () => {
      loggingService.startPerformanceTimer('test-operation');
      loggingService.endPerformanceTimer('test-operation', 'Test operation completed');

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'system_log',
        playerId: 'system',
        playerName: 'System',
        description: 'Test operation completed',
        details: {
          level: LogLevel.INFO,
          performanceKey: 'test-operation',
          duration: '250.00ms',
          durationMs: 250
        }
        })
      );
    });

    it('should handle missing performance timer gracefully', () => {
      loggingService.endPerformanceTimer('nonexistent-timer');

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_log',
          description: "Performance timer 'nonexistent-timer' was not started"
        })
      );
    });
  });

  describe('Log Level Mapping', () => {
    it('should map ERROR level to error_event type', () => {
      const testError = new Error('Test');
      loggingService.error('Error message', testError);

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_event'
        })
      );
    });

    it('should map non-ERROR levels to system_log type', () => {
      loggingService.info('Info message');
      loggingService.warn('Warn message');
      loggingService.debug('Debug message');

      expect(mockStateService.logToActionHistory).toHaveBeenCalledTimes(3);
      
      const calls = mockStateService.logToActionHistory.mock.calls;
      calls.forEach(call => {
        expect(call[0]).toEqual(expect.objectContaining({
          type: 'system_log'
        }));
      });
    });
  });

  describe('Player name resolution', () => {
    it('should auto-resolve player name when only playerId is provided', () => {
      // Setup mock player
      const mockPlayer = { id: 'player123', name: 'Alice' };
      mockStateService.getPlayer.mockReturnValue(mockPlayer as any);

      loggingService.info('Player action logged', { playerId: 'player123' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'system_log',
        playerId: 'player123',
        playerName: 'Alice',
        description: 'Player action logged',
        details: {
          level: LogLevel.INFO,
          playerId: 'player123'
        }
        })
      );
    });

    it('should use provided playerName when both playerId and playerName are given', () => {
      loggingService.info('Player action logged', {
        playerId: 'player123',
        playerName: 'Explicit Name'
      });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'system_log',
        playerId: 'player123',
        playerName: 'Explicit Name',
        description: 'Player action logged',
        details: {
          level: LogLevel.INFO,
          playerId: 'player123',
          playerName: 'Explicit Name'
        }
        })
      );
    });

    it('should fallback to playerId when player is not found', () => {
      // Mock player not found
      mockStateService.getPlayer.mockReturnValue(null);

      loggingService.info('Player action logged', { playerId: 'unknown_player' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'system_log',
        playerId: 'unknown_player',
        playerName: 'unknown_player',
        description: 'Player action logged',
        details: {
          level: LogLevel.INFO,
          playerId: 'unknown_player'
        }
        })
      );
    });

    it('should use System for system logs', () => {
      loggingService.info('System message', { playerId: 'system' });

      expect(mockStateService.logToActionHistory).toHaveBeenCalledWith(
        expectLogEntry({
        type: 'system_log',
        playerId: 'system',
        playerName: 'System',
        description: 'System message',
        details: {
          level: LogLevel.INFO,
          playerId: 'system'
        }
        })
      );
    });
  });
});