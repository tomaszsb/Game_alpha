// tests/services/MovementService.test.ts

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MovementService } from '../../src/services/MovementService';
import { IDataService, IStateService, IChoiceService, ILoggingService, IGameRulesService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { Movement, DiceOutcome, Space, GameConfig } from '../../src/types/DataTypes';
import { createMockDataService, createMockStateService, createMockChoiceService, createMockLoggingService, createMockGameRulesService } from '../mocks/mockServices';

// Mock implementations using centralized creators
const mockDataService: vi.Mocked<IDataService> = createMockDataService();
const mockStateService: vi.Mocked<IStateService> = createMockStateService();
const mockChoiceService: vi.Mocked<IChoiceService> = createMockChoiceService();
const mockLoggingService: vi.Mocked<ILoggingService> = createMockLoggingService();
const mockGameRulesService: vi.Mocked<IGameRulesService> = createMockGameRulesService();

describe('MovementService', () => {
  let movementService: MovementService;
  let mockPlayer: Player;
  let mockGameState: GameState;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    movementService = new MovementService(mockDataService, mockStateService, mockChoiceService, mockLoggingService, mockGameRulesService);
    
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'START-QUICK-PLAY-GUIDE',
      visitType: 'First',
      visitedSpaces: ['START-QUICK-PLAY-GUIDE'],
      money: 1000,
      timeSpent: 100,
      projectScope: 0,
      score: 0,
      color: '#007bff',
      avatar: '👤',
      hand: [], // Player starts with no cards
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
      // New stateful deck properties
      decks: {
        W: ['W_001', 'W_002', 'W_003'],
        B: ['B_001', 'B_002'],
        E: ['E_001', 'E_002', 'E_003'],
        L: ['L_001', 'L_002'],
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

  describe('getValidMoves', () => {
    it('should return valid moves for fixed movement type', () => {
      const mockMovement: Movement = {
        space_name: 'START-QUICK-PLAY-GUIDE',
        visit_type: 'First',
        movement_type: 'fixed',
        destination_1: 'OWNER-SCOPE-INITIATION'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['OWNER-SCOPE-INITIATION']);
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('player1');
      expect(mockDataService.getMovement).toHaveBeenCalledWith('START-QUICK-PLAY-GUIDE', 'First');
    });

    it('should return valid moves for choice movement type with multiple destinations', () => {
      const mockMovement: Movement = {
        space_name: 'PM-DECISION-CHECK',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'LEND-SCOPE-CHECK',
        destination_2: 'ARCH-INITIATION',
        destination_3: 'CHEAT-BYPASS'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['LEND-SCOPE-CHECK', 'ARCH-INITIATION', 'CHEAT-BYPASS']);
    });

    it('should return valid moves for dice movement type', () => {
      const mockMovement: Movement = {
        space_name: 'LEND-SCOPE-CHECK',
        visit_type: 'First',
        movement_type: 'dice',
        destination_1: 'BANK-FUND-REVIEW',
        destination_2: 'INVESTOR-FUND-REVIEW'
      };

      const mockDiceOutcome: DiceOutcome = {
        space_name: 'LEND-SCOPE-CHECK',
        visit_type: 'First',
        roll_1: 'BANK-FUND-REVIEW',
        roll_2: 'BANK-FUND-REVIEW',
        roll_3: 'INVESTOR-FUND-REVIEW',
        roll_4: 'INVESTOR-FUND-REVIEW',
        roll_5: 'INVESTOR-FUND-REVIEW',
        roll_6: 'INVESTOR-FUND-REVIEW'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      const result = movementService.getValidMoves('player1');

      // Should remove duplicates
      expect(result).toEqual(['BANK-FUND-REVIEW', 'INVESTOR-FUND-REVIEW']);
    });

    it('should return empty array for none movement type', () => {
      const mockMovement: Movement = {
        space_name: 'END-SPACE',
        visit_type: 'First',
        movement_type: 'none'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual([]);
    });

    it('should throw error if player not found', () => {
      mockStateService.getPlayer.mockReturnValue(undefined);

      expect(() => movementService.getValidMoves('nonexistent')).toThrow('Player with ID nonexistent not found');
    });

    it('should return empty array if no movement data found', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(undefined);

      // Enhanced error handling: returns empty array instead of throwing
      const validMoves = movementService.getValidMoves('player1');
      expect(validMoves).toEqual([]);
    });

    it('should handle dice movement with no dice outcome data', () => {
      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(undefined);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual([]);
    });

    it('should filter out empty destinations', () => {
      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'VALID-DESTINATION',
        destination_2: '',
        destination_3: undefined
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['VALID-DESTINATION']);
    });
  });

  describe('movePlayer', () => {
    beforeEach(() => {
      const mockMovement: Movement = {
        space_name: 'START-QUICK-PLAY-GUIDE',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'DESTINATION-A',
        destination_2: 'DESTINATION-B'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
    });

    it('should successfully move player to valid destination', async () => {
      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...mockPlayer,
          currentSpace: 'DESTINATION-A',
          visitType: 'First'
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      // Mock the starting spaces for visit type logic
      const mockSpaces: Space[] = [{
        name: 'START-QUICK-PLAY-GUIDE',
        config: { is_starting_space: true } as GameConfig,
        content: [],
        movement: [],
        spaceEffects: [],
        diceEffects: [],
        diceOutcomes: []
      }];
      mockDataService.getAllSpaces.mockReturnValue(mockSpaces);

      const result = await movementService.movePlayer('player1', 'DESTINATION-A');

      expect(result).toBe(updatedGameState);
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        currentSpace: 'DESTINATION-A',
        visitType: 'First',
        visitedSpaces: ['START-QUICK-PLAY-GUIDE', 'DESTINATION-A']
      });
    });

    it('should set visit type to Subsequent for non-starting spaces', async () => {
      const updatedPlayer = {
        ...mockPlayer,
        currentSpace: 'NON-STARTING-SPACE',
        visitedSpaces: ['START-QUICK-PLAY-GUIDE', 'DESTINATION-A'] // Already visited DESTINATION-A
      };
      
      mockStateService.getPlayer.mockReturnValue(updatedPlayer);

      const mockMovement: Movement = {
        space_name: 'NON-STARTING-SPACE',
        visit_type: 'First',
        movement_type: 'fixed',
        destination_1: 'DESTINATION-A'
      };
      
      mockDataService.getMovement.mockReturnValueOnce(mockMovement);

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...updatedPlayer,
          currentSpace: 'DESTINATION-A',
          visitType: 'Subsequent'
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      // Mock no starting spaces
      mockDataService.getAllSpaces.mockReturnValue([]);

      const result = await movementService.movePlayer('player1', 'DESTINATION-A');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        currentSpace: 'DESTINATION-A',
        visitType: 'Subsequent',
        visitedSpaces: ['START-QUICK-PLAY-GUIDE', 'DESTINATION-A'] // No change since already visited
      });
    });

    it('should throw error for invalid destination', async () => {
      await expect(movementService.movePlayer('player1', 'INVALID-DESTINATION')).rejects.toThrow(
        'Invalid move: INVALID-DESTINATION is not a valid destination from START-QUICK-PLAY-GUIDE'
      );
    });

    it('should throw error if player not found during move', async () => {
      // First call returns player for getValidMoves, second call returns undefined for move
      mockStateService.getPlayer
        .mockReturnValueOnce(mockPlayer)
        .mockReturnValueOnce(undefined);

      await expect(movementService.movePlayer('player1', 'DESTINATION-A')).rejects.toThrow(
        'Player with ID player1 not found'
      );
    });

    it('should handle player moving to same space they are already on', async () => {
      const mockMovement: Movement = {
        space_name: 'START-QUICK-PLAY-GUIDE',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'START-QUICK-PLAY-GUIDE'
      };

      mockDataService.getMovement.mockReturnValue(mockMovement);

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...mockPlayer,
          visitType: 'Subsequent'
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);
      mockDataService.getAllSpaces.mockReturnValue([]);

      const result = await movementService.movePlayer('player1', 'START-QUICK-PLAY-GUIDE');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        currentSpace: 'START-QUICK-PLAY-GUIDE',
        visitType: 'Subsequent',
        visitedSpaces: ['START-QUICK-PLAY-GUIDE'] // No change since already in visitedSpaces
      });
    });
  });

  describe('getDiceDestination', () => {
    it('should return correct destination for dice roll 2', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: 'DEST-B',
        roll_3: 'DEST-C',
        roll_4: 'DEST-D',
        roll_5: 'DEST-E',
        roll_6: 'DEST-F'
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act - dice roll 2 should map to roll_1 (((2-2) % 6) + 1 = 1)
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 2);

      // Assert
      expect(result).toBe('DEST-A');
      expect(mockDataService.getDiceOutcome).toHaveBeenCalledWith('TEST-SPACE', 'First');
    });

    it('should return correct destination for dice roll 7', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: 'DEST-B',
        roll_3: 'DEST-C',
        roll_4: 'DEST-D',
        roll_5: 'DEST-E',
        roll_6: 'DEST-F'
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act - dice roll 7 should map to roll_6 (((7-2) % 6) + 1 = 6)
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 7);

      // Assert
      expect(result).toBe('DEST-F');
    });

    it('should return correct destination for dice roll 12', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: 'DEST-B',
        roll_3: 'DEST-C',
        roll_4: 'DEST-D',
        roll_5: 'DEST-E',
        roll_6: 'DEST-F'
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act - dice roll 12 should map to roll_5 (((12-2) % 6) + 1 = 5)
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 12);

      // Assert
      expect(result).toBe('DEST-E');
    });

    it('should return null when no dice outcome data found', () => {
      // Arrange
      mockDataService.getDiceOutcome.mockReturnValue(undefined);

      // Act
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 7);

      // Assert
      expect(result).toBeNull();
      expect(mockDataService.getDiceOutcome).toHaveBeenCalledWith('TEST-SPACE', 'First');
    });

    it('should return null when destination field is empty', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: '', // Empty destination
        roll_3: 'DEST-C'
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act - dice roll 3 should map to roll_2 (((3-2) % 6) + 1 = 2)
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 3);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when destination field is whitespace only', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: '   ', // Whitespace only
        roll_3: 'DEST-C'
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 3);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for invalid dice roll (less than 2)', () => {
      // Act
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 1);

      // Assert
      expect(result).toBeNull();
      expect(mockDataService.getDiceOutcome).not.toHaveBeenCalled();
    });

    it('should return null for invalid dice roll (greater than 12)', () => {
      // Act
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 13);

      // Assert
      expect(result).toBeNull();
      expect(mockDataService.getDiceOutcome).not.toHaveBeenCalled();
    });

    it('should handle subsequent visit type correctly', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'Subsequent',
        roll_1: 'SUBSEQUENT-DEST-A',
        roll_2: 'SUBSEQUENT-DEST-B'
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act
      const result = movementService.getDiceDestination('TEST-SPACE', 'Subsequent', 2);

      // Assert
      expect(result).toBe('SUBSEQUENT-DEST-A');
      expect(mockDataService.getDiceOutcome).toHaveBeenCalledWith('TEST-SPACE', 'Subsequent');
    });

    it('should handle destination with whitespace correctly', () => {
      // Arrange
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: '  DEST-A  ' // Destination with whitespace
      };
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      // Act
      const result = movementService.getDiceDestination('TEST-SPACE', 'First', 2);

      // Assert - our implementation returns the destination as-is since trim() !== '' checks for non-empty after trim
      expect(result).toBe('  DEST-A  ');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle movement with all destination fields filled', () => {
      const mockMovement: Movement = {
        space_name: 'MULTI-DESTINATION',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'DEST-1',
        destination_2: 'DEST-2',
        destination_3: 'DEST-3',
        destination_4: 'DEST-4',
        destination_5: 'DEST-5'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['DEST-1', 'DEST-2', 'DEST-3', 'DEST-4', 'DEST-5']);
    });

    it('should handle dice outcome with empty and duplicate destinations', () => {
      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: '',
        roll_3: 'DEST-A',
        roll_4: 'DEST-B',
        roll_5: undefined,
        roll_6: '   '  // whitespace only
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['DEST-A', 'DEST-B']);
    });
  });

  describe('path choice memory (REG-DOB-TYPE-SELECT)', () => {
    it('should store path choice memory on first visit to REG-DOB-TYPE-SELECT when choosing Plan Exam', async () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'First' as const
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getAllSpaces.mockReturnValue([]);

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...player,
          currentSpace: 'REG-DOB-PLAN-EXAM',
          visitType: 'First' as const,
          pathChoiceMemory: {
            'REG-DOB-TYPE-SELECT': 'REG-DOB-PLAN-EXAM'
          }
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      const result = await movementService.movePlayer('player1', 'REG-DOB-PLAN-EXAM');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          pathChoiceMemory: {
            'REG-DOB-TYPE-SELECT': 'REG-DOB-PLAN-EXAM'
          }
        })
      );
      expect(result).toBe(updatedGameState);
    });

    it('should store path choice memory on first visit to REG-DOB-TYPE-SELECT when choosing Prof Cert', async () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'First' as const
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getAllSpaces.mockReturnValue([]);

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...player,
          currentSpace: 'REG-DOB-PROF-CERT',
          visitType: 'First' as const,
          pathChoiceMemory: {
            'REG-DOB-TYPE-SELECT': 'REG-DOB-PROF-CERT'
          }
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      const result = await movementService.movePlayer('player1', 'REG-DOB-PROF-CERT');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          pathChoiceMemory: {
            'REG-DOB-TYPE-SELECT': 'REG-DOB-PROF-CERT'
          }
        })
      );
      expect(result).toBe(updatedGameState);
    });

    it('should filter moves to remembered choice on subsequent visit to REG-DOB-TYPE-SELECT', () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'Subsequent' as const,
        pathChoiceMemory: {
          'REG-DOB-TYPE-SELECT': 'REG-DOB-PLAN-EXAM' as const
        }
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'Subsequent',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      // Should only return the remembered choice, not both options
      expect(result).toEqual(['REG-DOB-PLAN-EXAM']);
    });

    it('should filter moves to Prof Cert if that was the original choice on subsequent visit', () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'Subsequent' as const,
        pathChoiceMemory: {
          'REG-DOB-TYPE-SELECT': 'REG-DOB-PROF-CERT' as const
        }
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'Subsequent',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      // Should only return the remembered choice
      expect(result).toEqual(['REG-DOB-PROF-CERT']);
    });

    it('should return all choices on first visit to REG-DOB-TYPE-SELECT', () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'First' as const
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      // On first visit, both choices should be available
      expect(result).toEqual(['REG-DOB-PLAN-EXAM', 'REG-DOB-PROF-CERT']);
    });

    it('should not store path memory for other destination spaces from REG-DOB-TYPE-SELECT', async () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'First' as const
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT',
        destination_3: 'SOME-OTHER-SPACE' // Edge case
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getAllSpaces.mockReturnValue([]);

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...player,
          currentSpace: 'SOME-OTHER-SPACE',
          visitType: 'First' as const
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      await movementService.movePlayer('player1', 'SOME-OTHER-SPACE');

      // Should NOT store path memory for non-DOB destinations
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.not.objectContaining({
          pathChoiceMemory: expect.anything()
        })
      );
    });

    it('should preserve existing path memory when storing new choice', async () => {
      const player = {
        ...mockPlayer,
        currentSpace: 'REG-DOB-TYPE-SELECT',
        visitType: 'First' as const,
        pathChoiceMemory: {
          'REG-DOB-TYPE-SELECT': 'REG-DOB-PLAN-EXAM' as const
        }
      };

      const mockMovement: Movement = {
        space_name: 'REG-DOB-TYPE-SELECT',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM',
        destination_2: 'REG-DOB-PROF-CERT'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getAllSpaces.mockReturnValue([]);

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{
          ...player,
          currentSpace: 'REG-DOB-PLAN-EXAM',
          visitType: 'First' as const,
          pathChoiceMemory: {
            'REG-DOB-TYPE-SELECT': 'REG-DOB-PLAN-EXAM'
          }
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      await movementService.movePlayer('player1', 'REG-DOB-PLAN-EXAM');

      // Should preserve existing memory
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          pathChoiceMemory: {
            'REG-DOB-TYPE-SELECT': 'REG-DOB-PLAN-EXAM'
          }
        })
      );
    });
  });

  describe('logic movement type', () => {
    it('should return valid moves for logic movement type with condition evaluation', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'LOW-SCOPE-PATH',
        destination_2: 'HIGH-SCOPE-PATH',
        condition_1: 'scope_le_4m',
        condition_2: 'scope_gt_4m'
      };

      // Set up player with low scope project (2 W cards = 1M scope)
      const lowScopePlayer = {
        ...mockPlayer,
        currentSpace: 'LOGIC-TEST-SPACE',
        hand: ['W001', 'W002']  // 2 Work cards = $1M scope
      };

      mockStateService.getPlayer.mockReturnValue(lowScopePlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      // Mock calculateProjectScope to return $1M
      mockGameRulesService.calculateProjectScope.mockReturnValue(1000000);

      // Mock evaluateCondition to properly evaluate scope conditions
      mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
        if (condition === 'scope_le_4m') return true;  // $1M <= $4M
        if (condition === 'scope_gt_4m') return false; // $1M > $4M is false
        return true;
      });

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['LOW-SCOPE-PATH']); // Only low scope path should be valid
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('player1');
      expect(mockDataService.getMovement).toHaveBeenCalledWith('LOGIC-TEST-SPACE', 'First');
    });

    it('should return high scope path for high scope projects', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'LOW-SCOPE-PATH',
        destination_2: 'HIGH-SCOPE-PATH',
        condition_1: 'scope_le_4m',
        condition_2: 'scope_gt_4m'
      };

      // Set up player with high scope project (10 W cards = 5M scope)
      const highScopePlayer = {
        ...mockPlayer,
        hand: ['W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008', 'W009', 'W010']
      };

      mockStateService.getPlayer.mockReturnValue(highScopePlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      // Mock calculateProjectScope to return $5M
      mockGameRulesService.calculateProjectScope.mockReturnValue(5000000);

      // Mock evaluateCondition to properly evaluate scope conditions
      mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
        if (condition === 'scope_le_4m') return false; // $5M <= $4M is false
        if (condition === 'scope_gt_4m') return true;  // $5M > $4M
        return true;
      });

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['HIGH-SCOPE-PATH']); // Only high scope path should be valid
    });

    it('should return multiple destinations when multiple conditions are met', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'MONEY-PATH',
        destination_2: 'TIME-PATH',
        destination_3: 'CARD-PATH',
        condition_1: 'money_le_2m',
        condition_2: 'time_le_10',
        condition_3: 'cards_le_5'
      };

      // Set up player with low money, low time, and few cards
      const multiConditionPlayer = {
        ...mockPlayer,
        money: 1500000, // $1.5M
        timeSpent: 5,
        hand: ['W001', 'E001', 'L001'] // 3 cards
      };

      mockStateService.getPlayer.mockReturnValue(multiConditionPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['MONEY-PATH', 'TIME-PATH', 'CARD-PATH']); // All conditions met
    });

    it('should return empty array when no conditions are met', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'RICH-PATH',
        destination_2: 'TIME-HEAVY-PATH',
        condition_1: 'money_gt_2m',
        condition_2: 'time_gt_10'
      };

      // Set up player with low money and low time
      const poorPlayer = {
        ...mockPlayer,
        money: 500000, // $0.5M
        timeSpent: 2
      };

      mockStateService.getPlayer.mockReturnValue(poorPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual([]); // No conditions met
    });

    it('should handle destinations with empty conditions as always valid', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'ALWAYS-PATH',
        destination_2: 'CONDITIONAL-PATH',
        condition_1: '', // Empty condition should be treated as 'always'
        condition_2: 'money_gt_2m'
      };

      // Set up player with low money
      const poorPlayer = {
        ...mockPlayer,
        money: 500000 // $0.5M
      };

      mockStateService.getPlayer.mockReturnValue(poorPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['ALWAYS-PATH']); // Only empty condition path available
    });

    it('should handle undefined conditions as always valid', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'ALWAYS-PATH',
        destination_2: 'NEVER-PATH',
        condition_1: undefined, // Undefined condition should be treated as 'always'
        condition_2: 'unknown_condition'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['ALWAYS-PATH']); // Only undefined condition path available
    });

    it('should handle unknown conditions by returning false', () => {
      const mockMovement: Movement = {
        space_name: 'LOGIC-TEST-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'VALID-PATH',
        destination_2: 'INVALID-PATH',
        condition_1: 'always',
        condition_2: 'unknown_condition_type'
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['VALID-PATH']); // Only 'always' condition path available
    });
  });
});