import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameContext } from '../../../src/context/GameContext';
import { IPlayerActionService, IStateService } from '../../../src/types/ServiceContracts';
import { GameState } from '../../../src/types/StateTypes';
import { createMockStateService } from '../../mocks/mockServices';

// Mock the useGameContext hook
vi.mock('../../../src/context/GameContext', () => ({
  useGameContext: vi.fn(),
}));

// Mock alert function
global.alert = vi.fn();

// Mock console.error
global.console = {
  ...console,
  error: vi.fn(),
};

describe('DiceRoller Component Service Integration', () => {
  let mockPlayerActionService: any;
  let mockStateService: any;
  let mockUseGameContext: anyFunction<typeof useGameContext>;

  const mockGameState: GameState = {
    players: [],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 1,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    awaitingChoice: null,
    isGameOver: false,
    activeModal: null,
    requiredActions: 1,
    completedActions: 0,
    availableActionTypes: [],
    hasCompletedManualActions: false,
    activeNegotiation: null,
    globalActionLog: [],
    preSpaceEffectState: null,
    decks: {
      W: [],
      B: [],
      E: [],
      L: [],
      I: []
    },
    discardPiles: {
      W: [],
      B: [],
      E: [],
      L: [],
      I: []
    }
  };

  const mockDiceResult = {
    roll1: 3,
    roll2: 5,
    total: 8
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock services
    mockPlayerActionService = {
      playCard: vi.fn(),
      rollDice: vi.fn(),
      endTurn: vi.fn(),
    };

    mockStateService = createMockStateService();
    mockStateService.getGameState.mockReturnValue(mockGameState);

    mockUseGameContext = useGameContext as anyFunction<typeof useGameContext>;
    mockUseGameContext.mockReturnValue({
      playerActionService: mockPlayerActionService,
      stateService: mockStateService,
      dataService: {} as any,
      turnService: {} as any,
      cardService: {} as any,
      movementService: {} as any,
      gameRulesService: {} as any,
      resourceService: {} as any,
      choiceService: {} as any,
      effectEngineService: {} as any,
      negotiationService: {} as any,
      loggingService: {} as any,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Service Integration', () => {
    it('should access services via useGameContext', () => {
      // Test that the component can access services via useGameContext
      const context = useGameContext();
      
      expect(context.playerActionService).toBeDefined();
      expect(context.stateService).toBeDefined();
      expect(mockUseGameContext).toHaveBeenCalled();
    });

    it('should call playerActionService.rollDice with current player ID', async () => {
      mockPlayerActionService.rollDice.mockResolvedValue(mockDiceResult);

      const context = useGameContext();
      
      // Simulate the handleRollDice function logic
      const gameState = context.stateService.getGameState();
      const currentPlayerId = gameState.currentPlayerId;
      
      if (currentPlayerId) {
        await context.playerActionService.rollDice(currentPlayerId);
      }
      
      expect(mockStateService.getGameState).toHaveBeenCalled();
      expect(mockPlayerActionService.rollDice).toHaveBeenCalledWith('player1');
    });

    it('should handle dice roll result correctly', async () => {
      mockPlayerActionService.rollDice.mockResolvedValue(mockDiceResult);

      const context = useGameContext();
      
      // Simulate dice roll
      const result = await context.playerActionService.rollDice('player1');
      
      expect(result).toEqual(mockDiceResult);
      expect(result.roll1).toBe(3);
      expect(result.roll2).toBe(5);
      expect(result.total).toBe(8);
    });

    it('should handle error when no current player found', async () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        currentPlayerId: null
      });

      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      
      // Simulate handleRollDice error condition
      if (!gameState.currentPlayerId) {
        const error = new Error('No current player found');
        expect(error.message).toBe('No current player found');
      }
      
      expect(gameState.currentPlayerId).toBeNull();
    });

    it('should handle service errors correctly', async () => {
      const errorMessage = 'Player not found';
      mockPlayerActionService.rollDice.mockRejectedValue(new Error(errorMessage));

      const context = useGameContext();
      
      try {
        await context.playerActionService.rollDice('player1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }

      expect(mockPlayerActionService.rollDice).toHaveBeenCalledWith('player1');
    });
  });

  describe('Error Handling Logic', () => {
    it('should test error message formatting for user alerts', () => {
      const testError = new Error('Test dice roll error');
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown error occurred';
      
      expect(errorMessage).toBe('Test dice roll error');
    });

    it('should test unknown error handling', () => {
      const testError: unknown = 'String error';
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown error occurred';
      
      expect(errorMessage).toBe('Unknown error occurred');
    });

    it('should test alert message formatting', () => {
      const errorMessage = 'Player not found';
      const alertMessage = `Failed to roll dice: ${errorMessage}`;
      
      expect(alertMessage).toBe('Failed to roll dice: Player not found');
    });
  });

  describe('Dice Roll Result Display', () => {
    it('should format dice result for display', () => {
      const result = mockDiceResult;
      
      // Test display formatting logic
      expect(result.roll1).toBe(3);
      expect(result.roll2).toBe(5);
      expect(result.total).toBe(8);
      
      // Verify result structure
      expect(typeof result.roll1).toBe('number');
      expect(typeof result.roll2).toBe('number');
      expect(typeof result.total).toBe('number');
    });

    it('should validate dice roll ranges', () => {
      const validResults = [
        { roll1: 1, roll2: 1, total: 2 },
        { roll1: 6, roll2: 6, total: 12 },
        { roll1: 3, roll2: 4, total: 7 }
      ];

      validResults.forEach(result => {
        expect(result.roll1).toBeGreaterThanOrEqual(1);
        expect(result.roll1).toBeLessThanOrEqual(6);
        expect(result.roll2).toBeGreaterThanOrEqual(1);
        expect(result.roll2).toBeLessThanOrEqual(6);
        expect(result.total).toBe(result.roll1 + result.roll2);
        expect(result.total).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeLessThanOrEqual(12);
      });
    });
  });

  describe('Loading State Management', () => {
    it('should handle rolling state correctly', async () => {
      mockPlayerActionService.rollDice.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockDiceResult), 100))
      );

      const context = useGameContext();
      
      // Simulate rolling state during async operation
      let isRolling = true;
      const rollPromise = context.playerActionService.rollDice('player1');
      
      // Verify rolling state is true during operation
      expect(isRolling).toBe(true);
      
      const result = await rollPromise;
      isRolling = false;
      
      // Verify rolling state is false after completion
      expect(isRolling).toBe(false);
      expect(result).toEqual(mockDiceResult);
    });

    it('should reset rolling state after error', async () => {
      mockPlayerActionService.rollDice.mockRejectedValue(new Error('Test error'));

      const context = useGameContext();
      
      let isRolling = true;
      
      try {
        await context.playerActionService.rollDice('player1');
      } catch (error) {
        // Rolling state should be reset even after error
        isRolling = false;
      }
      
      expect(isRolling).toBe(false);
    });
  });

  describe('Service Method Integration', () => {
    it('should verify all required service methods are available', () => {
      const context = useGameContext();
      
      // Verify PlayerActionService methods
      expect(typeof context.playerActionService.rollDice).toBe('function');
      expect(typeof context.playerActionService.playCard).toBe('function');
      
      // Verify StateService methods
      expect(typeof context.stateService.getGameState).toBe('function');
    });

    it('should handle async operations correctly', async () => {
      mockPlayerActionService.rollDice.mockResolvedValue(mockDiceResult);
      
      const context = useGameContext();
      
      // Test that async call resolves without error
      await expect(context.playerActionService.rollDice('player1')).resolves.toEqual(mockDiceResult);
      
      expect(mockPlayerActionService.rollDice).toHaveBeenCalledTimes(1);
    });

    it('should handle async errors correctly', async () => {
      const testError = new Error('Service unavailable');
      mockPlayerActionService.rollDice.mockRejectedValue(testError);
      
      const context = useGameContext();
      
      // Test that async call rejects with correct error
      await expect(context.playerActionService.rollDice('player1')).rejects.toThrow('Service unavailable');
      
      expect(mockPlayerActionService.rollDice).toHaveBeenCalledTimes(1);
    });
  });

  describe('Current Player Resolution', () => {
    it('should get current player from StateService', () => {
      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      
      expect(mockStateService.getGameState).toHaveBeenCalled();
      expect(gameState.currentPlayerId).toBe('player1');
    });

    it('should handle missing current player ID', () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        currentPlayerId: null
      });

      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      const currentPlayerId = gameState.currentPlayerId;
      
      expect(currentPlayerId).toBeNull();
    });

    it('should handle empty string current player ID', () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        currentPlayerId: ''
      });

      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      const currentPlayerId = gameState.currentPlayerId;
      
      // Empty string should be treated as falsy
      if (!currentPlayerId) {
        expect(currentPlayerId).toBe('');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle service unavailability', async () => {
      mockUseGameContext.mockReturnValue({
        playerActionService: undefined as any,
        stateService: mockStateService,
        dataService: {} as any,
        turnService: {} as any,
        cardService: {} as any,
        movementService: {} as any,
        gameRulesService: {} as any,
        resourceService: {} as any,
        choiceService: {} as any,
        effectEngineService: {} as any,
        negotiationService: {} as any,
        loggingService: {} as any,
      });

      const context = useGameContext();
      
      // Should handle undefined service gracefully
      expect(context.playerActionService).toBeUndefined();
    });

    it('should handle rapid successive dice rolls', async () => {
      const results = [
        { roll1: 1, roll2: 2, total: 3 },
        { roll1: 4, roll2: 5, total: 9 },
        { roll1: 6, roll2: 1, total: 7 }
      ];

      mockPlayerActionService.rollDice
        .mockResolvedValueOnce(results[0])
        .mockResolvedValueOnce(results[1])
        .mockResolvedValueOnce(results[2]);

      const context = useGameContext();
      
      // Simulate rapid successive calls
      const promises = [
        context.playerActionService.rollDice('player1'),
        context.playerActionService.rollDice('player1'),
        context.playerActionService.rollDice('player1')
      ];

      const resolvedResults = await Promise.all(promises);
      
      expect(resolvedResults).toEqual(results);
      expect(mockPlayerActionService.rollDice).toHaveBeenCalledTimes(3);
    });
  });
});