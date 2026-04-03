import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TargetingService } from '../../src/services/TargetingService';
import { IStateService, IChoiceService } from '../../src/types/ServiceContracts';
import { createMockStateService, createMockChoiceService } from '../mocks/mockServices';

describe('TargetingService', () => {
  let targetingService: TargetingService;
  let mockStateService: any;
  let mockChoiceService: any;

  // Mock game state with 3 players
  const mockGameState = {
    players: [
      { id: 'player1', name: 'Alice', money: 100, timeRemaining: 120 },
      { id: 'player2', name: 'Bob', money: 150, timeRemaining: 100 },
      { id: 'player3', name: 'Charlie', money: 200, timeRemaining: 80 }
    ],
    currentPlayer: 'player1',
    gamePhase: 'PLAY'
  };

  beforeEach(() => {
    // Create mocks for dependencies
    mockStateService = createMockStateService();
    mockChoiceService = createMockChoiceService();

    // Configure mockStateService to return our test game state
    mockStateService.getGameState.mockReturnValue(mockGameState);

    // Initialize the TargetingService with mocked dependencies
    targetingService = new TargetingService(mockStateService, mockChoiceService);
  });

  describe('resolveTargets - Non-interactive rules', () => {
    it('should resolve "Self" target to the source player', async () => {
      // Act
      const result = await targetingService.resolveTargets('player1', 'Self');

      // Assert
      expect(result).toEqual(['player1']);
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should resolve "All Players" target to all players', async () => {
      // Act
      const result = await targetingService.resolveTargets('player1', 'All Players');

      // Assert
      expect(result).toEqual(['player1', 'player2', 'player3']);
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should resolve "All Players-Self" target to all other players', async () => {
      // Act
      const result = await targetingService.resolveTargets('player1', 'All Players-Self');

      // Assert
      expect(result).toEqual(['player2', 'player3']);
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should handle "All Players-Self" for different source players', async () => {
      // Test with player2 as source
      const result = await targetingService.resolveTargets('player2', 'All Players-Self');

      // Assert
      expect(result).toEqual(['player1', 'player3']);
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown target rules by defaulting to Self', async () => {
      // Act
      const result = await targetingService.resolveTargets('player1', 'Unknown Rule');

      // Assert
      expect(result).toEqual(['player1']);
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should handle whitespace in target rules', async () => {
      // Act
      const selfResult = await targetingService.resolveTargets('player1', '  Self  ');
      const allResult = await targetingService.resolveTargets('player1', '  All Players  ');

      // Assert
      expect(selfResult).toEqual(['player1']);
      expect(allResult).toEqual(['player1', 'player2', 'player3']);
    });

    it('should return empty array if source player is not found', async () => {
      // Act
      const result = await targetingService.resolveTargets('nonexistent', 'Self');

      // Assert
      expect(result).toEqual([]);
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should handle single player game correctly', async () => {
      // Arrange - Mock game state with only one player
      const singlePlayerState = {
        players: [{ id: 'player1', name: 'Alice', money: 100, timeRemaining: 120 }],
        currentPlayer: 'player1',
        gamePhase: 'PLAY'
      };
      mockStateService.getGameState.mockReturnValue(singlePlayerState);

      // Act
      const selfResult = await targetingService.resolveTargets('player1', 'Self');
      const allResult = await targetingService.resolveTargets('player1', 'All Players');
      const othersResult = await targetingService.resolveTargets('player1', 'All Players-Self');

      // Assert
      expect(selfResult).toEqual(['player1']);
      expect(allResult).toEqual(['player1']);
      expect(othersResult).toEqual([]); // No other players
    });
  });

  describe('isInteractiveTargeting', () => {
    it('should identify non-interactive targeting rules', () => {
      expect(targetingService.isInteractiveTargeting('Self')).toBe(false);
      expect(targetingService.isInteractiveTargeting('All Players')).toBe(false);
      expect(targetingService.isInteractiveTargeting('All Players-Self')).toBe(false);
    });

    it('should identify interactive targeting rules', () => {
      expect(targetingService.isInteractiveTargeting('Choose Opponent')).toBe(true);
      expect(targetingService.isInteractiveTargeting('Choose Player')).toBe(true);
    });

    it('should handle whitespace in targeting rule detection', () => {
      expect(targetingService.isInteractiveTargeting('  Choose Opponent  ')).toBe(true);
      expect(targetingService.isInteractiveTargeting('  Self  ')).toBe(false);
    });

    it('should return false for unknown targeting rules', () => {
      expect(targetingService.isInteractiveTargeting('Unknown Rule')).toBe(false);
    });
  });

  describe('getTargetDescription', () => {
    it('should return appropriate description for no targets', () => {
      const result = targetingService.getTargetDescription([]);
      expect(result).toBe('No targets');
    });

    it('should return player name for single target', () => {
      const result = targetingService.getTargetDescription(['player1']);
      expect(result).toBe('Alice');
    });

    it('should return "All Players" for complete player list', () => {
      const result = targetingService.getTargetDescription(['player1', 'player2', 'player3']);
      expect(result).toBe('All Players');
    });

    it('should return comma-separated names for multiple targets', () => {
      const result = targetingService.getTargetDescription(['player2', 'player3']);
      expect(result).toBe('Bob, Charlie');
    });

    it('should handle unknown player IDs gracefully', () => {
      const result = targetingService.getTargetDescription(['unknown']);
      expect(result).toBe('Unknown Player (unknown)');
    });
  });

  describe('Interactive targeting (integration test setup)', () => {
    it('should call choiceService for "Choose Opponent" with multiple opponents', async () => {
      // Arrange
      mockChoiceService.createChoice.mockResolvedValue('player2');

      // Act
      const result = await targetingService.resolveTargets('player1', 'Choose Opponent');

      // Assert
      expect(result).toEqual(['player2']);
      expect(mockChoiceService.createChoice).toHaveBeenCalledWith(
        'player1',
        'TARGET_SELECTION',
        'Choose an opponent to target with this effect:',
        [
          { id: 'player2', label: 'Bob' },
          { id: 'player3', label: 'Charlie' }
        ]
      );
    });

    it('should auto-select single opponent for "Choose Opponent"', async () => {
      // Arrange - Mock game state with only two players
      const twoPlayerState = {
        players: [
          { id: 'player1', name: 'Alice', money: 100, timeRemaining: 120 },
          { id: 'player2', name: 'Bob', money: 150, timeRemaining: 100 }
        ],
        currentPlayer: 'player1',
        gamePhase: 'PLAY'
      };
      mockStateService.getGameState.mockReturnValue(twoPlayerState);

      // Act
      const result = await targetingService.resolveTargets('player1', 'Choose Opponent');

      // Assert
      expect(result).toEqual(['player2']);
      expect(mockChoiceService.createChoice).not.toHaveBeenCalled(); // No choice needed
    });

    it('should return empty array when no opponents available', async () => {
      // Arrange - Mock single player game
      const singlePlayerState = {
        players: [{ id: 'player1', name: 'Alice', money: 100, timeRemaining: 120 }],
        currentPlayer: 'player1',
        gamePhase: 'PLAY'
      };
      mockStateService.getGameState.mockReturnValue(singlePlayerState);

      // Act
      const result = await targetingService.resolveTargets('player1', 'Choose Opponent');

      // Assert
      expect(result).toEqual([]);
      expect(mockChoiceService.createChoice).not.toHaveBeenCalled();
    });

    it('should handle choice cancellation gracefully', async () => {
      // Arrange
      mockChoiceService.createChoice.mockResolvedValue(null);

      // Act
      const result = await targetingService.resolveTargets('player1', 'Choose Opponent');

      // Assert
      expect(result).toEqual([]);
      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(1);
    });
  });
});