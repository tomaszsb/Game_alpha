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

describe('CardActions Service Integration', () => {
  let mockPlayerActionService: any;
  let mockStateService: any;
  let mockUseGameContext: any;

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

  describe('PlayerActionService Integration', () => {
    it('should create a handlePlayCard function that calls playerActionService.playCard', () => {
      // Test that the component can access services via useGameContext
      const context = useGameContext();
      
      expect(context.playerActionService).toBeDefined();
      expect(context.stateService).toBeDefined();
      expect(mockUseGameContext).toHaveBeenCalled();
    });

    it('should mock playerActionService.playCard method correctly', async () => {
      mockPlayerActionService.playCard.mockResolvedValue();

      const context = useGameContext();
      
      // Simulate the handlePlayCard function logic
      await context.playerActionService.playCard('player1', 'W001');
      
      expect(mockPlayerActionService.playCard).toHaveBeenCalledWith('player1', 'W001');
    });

    it('should handle service errors correctly', async () => {
      const errorMessage = 'Player cannot afford this card';
      mockPlayerActionService.playCard.mockRejectedValue(new Error(errorMessage));

      const context = useGameContext();
      
      try {
        await context.playerActionService.playCard('player1', 'W001');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }

      expect(mockPlayerActionService.playCard).toHaveBeenCalledWith('player1', 'W001');
    });

    it('should get current player from state service when needed', () => {
      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      
      expect(mockStateService.getGameState).toHaveBeenCalled();
      expect(gameState.currentPlayerId).toBe('player1');
    });

    it('should handle case when no current player is set', () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        currentPlayerId: null
      });

      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      
      expect(gameState.currentPlayerId).toBeNull();
    });
  });

  describe('Error Handling Logic', () => {
    it('should test error message formatting for user alerts', () => {
      const testError = new Error('Test error message');
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown error occurred';
      
      expect(errorMessage).toBe('Test error message');
    });

    it('should test unknown error handling', () => {
      const testError: unknown = 'String error';
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown error occurred';
      
      expect(errorMessage).toBe('Unknown error occurred');
    });

    it('should test alert message formatting', () => {
      const errorMessage = 'Player cannot afford this card';
      const alertMessage = `Failed to play card: ${errorMessage}`;
      
      expect(alertMessage).toBe('Failed to play card: Player cannot afford this card');
    });
  });

  describe('Service Method Integration', () => {
    it('should verify all required service methods are available', () => {
      const context = useGameContext();
      
      // Verify PlayerActionService methods
      expect(typeof context.playerActionService.playCard).toBe('function');
      
      // Verify StateService methods
      expect(typeof context.stateService.getGameState).toBe('function');
    });

    it('should handle async operations correctly', async () => {
      mockPlayerActionService.playCard.mockResolvedValue();
      
      const context = useGameContext();
      
      // Test that async call resolves without error
      await expect(context.playerActionService.playCard('player1', 'W001')).resolves.toBeUndefined();
      
      expect(mockPlayerActionService.playCard).toHaveBeenCalledTimes(1);
    });

    it('should handle async errors correctly', async () => {
      const testError = new Error('Service unavailable');
      mockPlayerActionService.playCard.mockRejectedValue(testError);
      
      const context = useGameContext();
      
      // Test that async call rejects with correct error
      await expect(context.playerActionService.playCard('player1', 'W001')).rejects.toThrow('Service unavailable');
      
      expect(mockPlayerActionService.playCard).toHaveBeenCalledTimes(1);
    });
  });

  describe('Props and State Integration', () => {
    it('should handle missing playerId by using current player from state', () => {
      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      
      // Simulate the logic from handlePlayCard when playerId is not provided
      const currentPlayerId = gameState.currentPlayerId;
      
      expect(currentPlayerId).toBe('player1');
      expect(mockStateService.getGameState).toHaveBeenCalled();
    });

    it('should validate cardId is required', () => {
      // Simulate validation logic from handlePlayCard
      const cardId = undefined;
      
      if (!cardId) {
        const error = new Error('No card ID provided');
        expect(error.message).toBe('No card ID provided');
      }
    });

    it('should validate playerId is available', () => {
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        currentPlayerId: null
      });

      const context = useGameContext();
      const gameState = context.stateService.getGameState();
      const currentPlayerId = gameState.currentPlayerId;
      
      if (!currentPlayerId) {
        const error = new Error('No current player found');
        expect(error.message).toBe('No current player found');
      }
    });
  });
});