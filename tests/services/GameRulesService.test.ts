// tests/services/GameRulesService.test.ts

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameRulesService } from '../../src/services/GameRulesService';
import { IDataService, IStateService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { Movement, DiceOutcome, CardType, GameConfig } from '../../src/types/DataTypes';
import { createMockDataService, createMockStateService } from '../mocks/mockServices';

// Mock implementations using centralized creators
const mockDataService: vi.Mocked<IDataService> = createMockDataService();
const mockStateService: vi.Mocked<IStateService> = createMockStateService();

describe('GameRulesService', () => {
  let gameRulesService: GameRulesService;
  let mockPlayer: Player;
  let mockGameState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();
    
    gameRulesService = new GameRulesService(mockDataService, mockStateService);
    
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'START-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 100,
      projectScope: 0,
    score: 0,
      hand: ['W_001', 'W_002', 'B_001', 'L_001'], // Combined cards from old availableCards
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      turn: 1,
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      requiredActions: 0,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      // New stateful deck properties
      decks: {
        W: ['W_003', 'W_004', 'W_005'],
        B: ['B_002', 'B_003'],
        E: ['E_001', 'E_002', 'E_003'],
        L: ['L_002', 'L_003'],
        I: ['I_001', 'I_002']
      },
      discardPiles: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      }
    };
  });

  describe('isMoveValid', () => {
    it('should return true for valid moves', () => {
      const mockMovement: Movement = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'VALID-DESTINATION',
        destination_2: 'ANOTHER-DESTINATION'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = gameRulesService.isMoveValid('player1', 'VALID-DESTINATION');

      expect(result).toBe(true);
    });

    it('should return false for invalid destinations', () => {
      const mockMovement: Movement = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        movement_type: 'fixed',
        destination_1: 'VALID-DESTINATION'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = gameRulesService.isMoveValid('player1', 'INVALID-DESTINATION');

      expect(result).toBe(false);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.isMoveValid('nonexistent', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should return false when no movement data exists', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(undefined);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should handle dice movement type', () => {
      const mockMovement: Movement = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      const mockDiceOutcome: DiceOutcome = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        roll_1: 'DICE-DEST-1',
        roll_2: 'DICE-DEST-2',
        roll_3: 'DICE-DEST-1'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      const result = gameRulesService.isMoveValid('player1', 'DICE-DEST-1');

      expect(result).toBe(true);
    });

    it('should return empty destinations for none movement type', () => {
      const mockMovement: Movement = {
        space_name: 'END-SPACE',
        visit_type: 'First',
        movement_type: 'none'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should handle exceptions gracefully', () => {
      mockStateService.getGameState.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });
  });

  describe('canPlayCard', () => {
    it('should return true when all conditions are met', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'W_001');

      expect(result).toBe(true);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.canPlayCard('player1', 'W_001');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canPlayCard('nonexistent', 'W_001');

      expect(result).toBe(false);
    });

    it('should return false when player does not own the card', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'W_999');

      expect(result).toBe(false);
    });

    it('should return false when card ID has invalid format', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'INVALID_CARD');

      expect(result).toBe(false);
    });

    it('should return false when not player turn (for cards requiring turn)', () => {
      const gameStateNotPlayerTurn = { ...mockGameState, currentPlayerId: 'player2' };
      mockStateService.getGameState.mockReturnValue(gameStateNotPlayerTurn);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'W_001');

      expect(result).toBe(false);
    });

    it('should handle different card types', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      expect(gameRulesService.canPlayCard('player1', 'B_001')).toBe(true);
      expect(gameRulesService.canPlayCard('player1', 'L_001')).toBe(true);
    });
  });

  describe('canDrawCard', () => {
    it('should return true when all conditions are met', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canDrawCard('player1', 'E');

      expect(result).toBe(true);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'END' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.canDrawCard('player1', 'E');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canDrawCard('nonexistent', 'E');

      expect(result).toBe(false);
    });

    it('should return false for invalid card types', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canDrawCard('player1', 'X' as CardType);

      expect(result).toBe(false);
    });

    it('should return false when the deck for a card type is empty', () => {
      const gameStateWithEmptyWDeck = {
        ...mockGameState,
        decks: {
          ...mockGameState.decks,
          W: [] // Empty W deck
        }
      };

      mockStateService.getGameState.mockReturnValue(gameStateWithEmptyWDeck);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canDrawCard('player1', 'W');

      expect(result).toBe(false);
    });

    it('should handle all valid card types', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      expect(gameRulesService.canDrawCard('player1', 'W')).toBe(true);
      expect(gameRulesService.canDrawCard('player1', 'B')).toBe(true);
      expect(gameRulesService.canDrawCard('player1', 'E')).toBe(true);
      expect(gameRulesService.canDrawCard('player1', 'L')).toBe(true);
      expect(gameRulesService.canDrawCard('player1', 'I')).toBe(true);
    });
  });

  describe('canPlayerAfford', () => {
    it('should return true when player has sufficient money', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerAfford('player1', 500);

      expect(result).toBe(true);
    });

    it('should return false when player has insufficient money', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerAfford('player1', 1500);

      expect(result).toBe(false);
    });

    it('should return true when cost equals player money', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerAfford('player1', 1000);

      expect(result).toBe(true);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canPlayerAfford('nonexistent', 100);

      expect(result).toBe(false);
    });
  });

  describe('isPlayerTurn', () => {
    it('should return true when it is the player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);

      const result = gameRulesService.isPlayerTurn('player1');

      expect(result).toBe(true);
    });

    it('should return false when it is not the player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);

      const result = gameRulesService.isPlayerTurn('player2');

      expect(result).toBe(false);
    });

    it('should return false when no current player is set', () => {
      const gameStateNoCurrentPlayer = { ...mockGameState, currentPlayerId: null };
      mockStateService.getGameState.mockReturnValue(gameStateNoCurrentPlayer);

      const result = gameRulesService.isPlayerTurn('player1');

      expect(result).toBe(false);
    });
  });

  describe('isGameInProgress', () => {
    it('should return true when game phase is PLAY', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);

      const result = gameRulesService.isGameInProgress();

      expect(result).toBe(true);
    });

    it('should return false when game phase is SETUP', () => {
      const setupGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(setupGameState);

      const result = gameRulesService.isGameInProgress();

      expect(result).toBe(false);
    });

    it('should return false when game phase is END', () => {
      const endGameState = { ...mockGameState, gamePhase: 'END' as const };
      mockStateService.getGameState.mockReturnValue(endGameState);

      const result = gameRulesService.isGameInProgress();

      expect(result).toBe(false);
    });
  });

  describe('canPlayerTakeAction', () => {
    it('should return true when game is in progress and it is player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerTakeAction('player1');

      expect(result).toBe(true);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.canPlayerTakeAction('player1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canPlayerTakeAction('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when it is not the player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerTakeAction('player2');

      expect(result).toBe(false);
    });
  });

  describe('edge cases and private method coverage', () => {
    it('should handle dice movement with no dice outcome', () => {
      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(undefined);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should handle movement with all destination fields', () => {
      const mockMovement: Movement = {
        space_name: 'MULTI-DEST',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'DEST-1',
        destination_2: 'DEST-2',
        destination_3: 'DEST-3',
        destination_4: 'DEST-4',
        destination_5: 'DEST-5'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      expect(gameRulesService.isMoveValid('player1', 'DEST-3')).toBe(true);
      expect(gameRulesService.isMoveValid('player1', 'DEST-5')).toBe(true);
    });

    it('should filter empty destinations and remove duplicates', () => {
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: '',
        roll_3: 'DEST-A', // duplicate
        roll_4: 'DEST-B',
        roll_5: undefined,
        roll_6: '   ' // whitespace
      };

      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      expect(gameRulesService.isMoveValid('player1', 'DEST-A')).toBe(true);
      expect(gameRulesService.isMoveValid('player1', 'DEST-B')).toBe(true);
    });
  });

  describe('checkWinCondition', () => {
    it('should return true when player is on an ending space', async () => {
      // Arrange
      const endingSpaceConfig = {
        space_name: 'END-SPACE',
        phase: 'END',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: true,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false
      };

      const playerOnEndingSpace = { ...mockPlayer, currentSpace: 'END-SPACE' };
      mockStateService.getPlayer.mockReturnValue(playerOnEndingSpace);
      mockDataService.getGameConfigBySpace.mockReturnValue(endingSpaceConfig);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(true);
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('player1');
      expect(mockDataService.getGameConfigBySpace).toHaveBeenCalledWith('END-SPACE');
    });

    it('should return false when player is not on an ending space', async () => {
      // Arrange
      const normalSpaceConfig = {
        space_name: 'NORMAL-SPACE',
        phase: 'PLAY',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getGameConfigBySpace.mockReturnValue(normalSpaceConfig);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when player does not exist', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Act
      const result = await gameRulesService.checkWinCondition('nonexistent');

      // Assert
      expect(result).toBe(false);
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('nonexistent');
      expect(mockDataService.getGameConfigBySpace).not.toHaveBeenCalled();
    });

    it('should return false when space configuration is not found', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getGameConfigBySpace.mockReturnValue(undefined);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
      expect(mockDataService.getGameConfigBySpace).toHaveBeenCalledWith('START-SPACE');
    });

    it('should return false and log error when an exception occurs', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      mockStateService.getPlayer.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking win condition for player player1:',
        expect.any(Error)
      );

      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should handle space config with is_ending_space as false', async () => {
      // Arrange
      const nonEndingSpaceConfig = {
        space_name: 'MIDDLE-SPACE',
        phase: 'PLAY',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getGameConfigBySpace.mockReturnValue(nonEndingSpaceConfig);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Scoring System', () => {
    describe('calculatePlayerScore', () => {
      it('should calculate score based on money, project scope, loans, and time', () => {
        // Arrange
        const playerWithAssets: Player = {
          ...mockPlayer,
          money: 10000,
          timeSpent: 5,
          loans: [
            { id: 'loan1', principal: 5000, interestRate: 0.1, startTurn: 1 },
            { id: 'loan2', principal: 3000, interestRate: 0.15, startTurn: 2 }
          ]
        };

        mockStateService.getPlayer.mockReturnValue(playerWithAssets);
        
        // Mock calculateProjectScope to return a known value
        vi.spyOn(gameRulesService, 'calculateProjectScope').mockReturnValue(15000);

        // Act
        const score = gameRulesService.calculatePlayerScore('player1');

        // Assert
        // Score = Money(10000) + ProjectScope(15000) - Loans(2*5000) - Time(5*1000)
        // Score = 10000 + 15000 - 10000 - 5000 = 10000
        expect(score).toBe(10000);
      });

      it('should return 0 for non-existent player', () => {
        // Arrange
        mockStateService.getPlayer.mockReturnValue(undefined);

        // Act
        const score = gameRulesService.calculatePlayerScore('nonexistent');

        // Assert
        expect(score).toBe(0);
      });

      it('should ensure score does not go negative', () => {
        // Arrange
        const playerWithDebts: Player = {
          ...mockPlayer,
          money: 1000,
          timeSpent: 10,
          loans: [
            { id: 'loan1', principal: 5000, interestRate: 0.1, startTurn: 1 },
            { id: 'loan2', principal: 5000, interestRate: 0.1, startTurn: 2 },
            { id: 'loan3', principal: 5000, interestRate: 0.1, startTurn: 3 }
          ]
        };

        mockStateService.getPlayer.mockReturnValue(playerWithDebts);
        vi.spyOn(gameRulesService, 'calculateProjectScope').mockReturnValue(2000);

        // Act
        const score = gameRulesService.calculatePlayerScore('player1');

        // Assert
        // Score = Money(1000) + ProjectScope(2000) - Loans(3*5000) - Time(10*1000)
        // Score = 1000 + 2000 - 15000 - 10000 = -22000, but clamped to 0
        expect(score).toBe(0);
      });
    });

    describe('determineWinner', () => {
      it('should determine winner by highest score', () => {
        // Arrange
        const player1: Player = { ...mockPlayer, id: 'player1', name: 'Alice', score: 0 };
        const player2: Player = { ...mockPlayer, id: 'player2', name: 'Bob', score: 0 };
        const player3: Player = { ...mockPlayer, id: 'player3', name: 'Charlie', score: 0 };

        const mockGameStateWithPlayers = {
          ...mockGameState,
          players: [player1, player2, player3]
        };

        mockStateService.getGameState.mockReturnValue(mockGameStateWithPlayers);

        // Mock calculatePlayerScore to return different scores
        vi.spyOn(gameRulesService, 'calculatePlayerScore')
          .mockReturnValueOnce(5000)  // player1
          .mockReturnValueOnce(15000) // player2 (highest)
          .mockReturnValueOnce(8000); // player3

        // Act
        const winnerId = gameRulesService.determineWinner();

        // Assert
        expect(winnerId).toBe('player2');
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({ id: 'player1', score: 5000 });
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({ id: 'player2', score: 15000 });
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({ id: 'player3', score: 8000 });
      });

      it('should return null when no players exist', () => {
        // Arrange
        const emptyGameState = { ...mockGameState, players: [] };
        mockStateService.getGameState.mockReturnValue(emptyGameState);

        // Act
        const winnerId = gameRulesService.determineWinner();

        // Assert
        expect(winnerId).toBeNull();
      });
    });
  });

  describe('Enhanced Win Conditions', () => {
    describe('checkTurnLimit', () => {
      it('should return true when turn limit is reached', () => {
        // Arrange
        const gameStateAtLimit = { ...mockGameState, turn: 50 };
        mockStateService.getGameState.mockReturnValue(gameStateAtLimit);

        // Act
        const result = gameRulesService.checkTurnLimit(50);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when turn exceeds limit', () => {
        // Arrange
        const gameStateBeyondLimit = { ...mockGameState, turn: 55 };
        mockStateService.getGameState.mockReturnValue(gameStateBeyondLimit);

        // Act
        const result = gameRulesService.checkTurnLimit(50);

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when turn is below limit', () => {
        // Arrange
        const gameStateBelowLimit = { ...mockGameState, turn: 30 };
        mockStateService.getGameState.mockReturnValue(gameStateBelowLimit);

        // Act
        const result = gameRulesService.checkTurnLimit(50);

        // Assert
        expect(result).toBe(false);
      });

      it('should use default turn limit of 50', () => {
        // Arrange
        const gameStateAtDefaultLimit = { ...mockGameState, turn: 50 };
        mockStateService.getGameState.mockReturnValue(gameStateAtDefaultLimit);

        // Act
        const result = gameRulesService.checkTurnLimit();

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('checkGameEndConditions', () => {
      it('should return win condition when player reaches ending space', async () => {
        // Arrange
        const endingSpaceConfig: GameConfig = {
          space_name: 'ENDING-SPACE',
          phase: 'play',
          is_starting_space: false,
          is_ending_space: true,
          path_type: 'linear',
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true
        };

        mockStateService.getPlayer.mockReturnValue(mockPlayer);
        mockDataService.getGameConfigBySpace.mockReturnValue(endingSpaceConfig);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, turn: 10 });

        // Act
        const result = await gameRulesService.checkGameEndConditions('player1', 50);

        // Assert
        expect(result.shouldEnd).toBe(true);
        expect(result.reason).toBe('win');
        expect(result.winnerId).toBe('player1');
      });

      it('should return turn limit condition when limit is reached', async () => {
        // Arrange
        const nonEndingSpaceConfig: GameConfig = {
          space_name: 'REGULAR-SPACE',
          phase: 'play',
          is_starting_space: false,
          is_ending_space: false,
          path_type: 'linear',
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true
        };

        mockStateService.getPlayer.mockReturnValue(mockPlayer);
        mockDataService.getGameConfigBySpace.mockReturnValue(nonEndingSpaceConfig);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, turn: 50 });

        // Act
        const result = await gameRulesService.checkGameEndConditions('player1', 50);

        // Assert
        expect(result.shouldEnd).toBe(true);
        expect(result.reason).toBe('turn_limit');
        expect(result.winnerId).toBeUndefined();
      });

      it('should return no end condition when game should continue', async () => {
        // Arrange
        const nonEndingSpaceConfig: GameConfig = {
          space_name: 'REGULAR-SPACE',
          phase: 'play',
          is_starting_space: false,
          is_ending_space: false,
          path_type: 'linear',
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true
        };

        mockStateService.getPlayer.mockReturnValue(mockPlayer);
        mockDataService.getGameConfigBySpace.mockReturnValue(nonEndingSpaceConfig);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, turn: 25 });

        // Act
        const result = await gameRulesService.checkGameEndConditions('player1', 50);

        // Assert
        expect(result.shouldEnd).toBe(false);
        expect(result.reason).toBeNull();
        expect(result.winnerId).toBeUndefined();
      });

      it('should prioritize win condition over turn limit', async () => {
        // Arrange - Player wins on the exact turn limit
        const endingSpaceConfig: GameConfig = {
          space_name: 'ENDING-SPACE',
          phase: 'play',
          is_starting_space: false,
          is_ending_space: true,
          path_type: 'linear',
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true
        };

        mockStateService.getPlayer.mockReturnValue(mockPlayer);
        mockDataService.getGameConfigBySpace.mockReturnValue(endingSpaceConfig);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, turn: 50 });

        // Act
        const result = await gameRulesService.checkGameEndConditions('player1', 50);

        // Assert
        expect(result.shouldEnd).toBe(true);
        expect(result.reason).toBe('win');
        expect(result.winnerId).toBe('player1');
      });
    });
  });
});