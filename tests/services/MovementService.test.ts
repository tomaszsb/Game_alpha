// tests/services/MovementService.test.ts

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MovementService } from '../../src/services/MovementService';
import { IDataService, IStateService, IChoiceService, ILoggingService, IGameRulesService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { Movement, DiceOutcome, Space, GameConfig } from '../../src/types/DataTypes';
import { createMockDataService, createMockStateService, createMockChoiceService, createMockLoggingService, createMockGameRulesService } from '../mocks/mockServices';

// Mock implementations using centralized creators
const mockDataService: any = createMockDataService();
const mockStateService: any = createMockStateService();
const mockChoiceService: any = createMockChoiceService();
const mockLoggingService: any = createMockLoggingService();
const mockGameRulesService: any = createMockGameRulesService();

describe('MovementService', () => {
  let movementService: MovementService;
  let mockPlayer: any;
  let mockGameState: any;

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
      const mockSpaces: any[] = [{
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
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          currentSpace: 'DESTINATION-A',
          visitType: 'First',
          visitedSpaces: ['START-QUICK-PLAY-GUIDE', 'DESTINATION-A']
        })
      );
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

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          currentSpace: 'DESTINATION-A',
          visitType: 'Subsequent',
          visitedSpaces: ['START-QUICK-PLAY-GUIDE', 'DESTINATION-A'] // No change since already visited
        })
      );
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

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          currentSpace: 'START-QUICK-PLAY-GUIDE',
          visitType: 'Subsequent',
          visitedSpaces: ['START-QUICK-PLAY-GUIDE'] // No change since already in visitedSpaces
        })
      );
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
    // Workstream 6 #4: mock the data-driven helpers. REG-DOB-TYPE-SELECT is a
    // lock point with memory_key 'dob_path' (matching real Spaces.csv). Stored
    // memory uses that key, not the literal 'REG-DOB-TYPE-SELECT' from the
    // pre-Workstream-6 hardcode.
    beforeEach(() => {
      mockDataService.isPathChoiceLockPoint.mockImplementation((spaceName: string) => spaceName === 'REG-DOB-TYPE-SELECT');
      mockDataService.getPathChoiceMemoryKey.mockImplementation((spaceName: string) => spaceName === 'REG-DOB-TYPE-SELECT' ? 'dob_path' : '');
    });

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
            'dob_path': 'REG-DOB-PLAN-EXAM'
          }
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      const result = await movementService.movePlayer('player1', 'REG-DOB-PLAN-EXAM');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          pathChoiceMemory: {
            'dob_path': 'REG-DOB-PLAN-EXAM'
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
            'dob_path': 'REG-DOB-PROF-CERT'
          }
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      const result = await movementService.movePlayer('player1', 'REG-DOB-PROF-CERT');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          pathChoiceMemory: {
            'dob_path': 'REG-DOB-PROF-CERT'
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
          'dob_path': 'REG-DOB-PLAN-EXAM'
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
          'dob_path': 'REG-DOB-PROF-CERT'
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

    it('should not store path memory when leaving a non-lock-point space', async () => {
      // Workstream 6 #4: pre-lift this test verified that the literal check
      // `destinationSpace === 'REG-DOB-PLAN-EXAM' || === 'REG-DOB-PROF-CERT'`
      // gated the memory write. Post-lift, a lock-point space writes whatever
      // destination the player chose (educators get a permissive contract:
      // valid moves come from MOVEMENT.csv, so any chosen destination is
      // implicitly approved). The test now verifies the COMPLEMENTARY property
      // — leaving a NON-lock-point space writes no memory regardless of
      // destination, which is what protects against unintended writes.
      const player = {
        ...mockPlayer,
        currentSpace: 'NON-LOCK-POINT-SPACE',
        visitType: 'First' as const
      };

      const mockMovement: Movement = {
        space_name: 'NON-LOCK-POINT-SPACE',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'REG-DOB-PLAN-EXAM'
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getAllSpaces.mockReturnValue([]);
      // isPathChoiceLockPoint already mocked false-by-default for non-DOB spaces.

      const updatedGameState: GameState = {
        ...mockGameState,
        players: [{ ...player, currentSpace: 'REG-DOB-PLAN-EXAM', visitType: 'First' as const }]
      };
      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      await movementService.movePlayer('player1', 'REG-DOB-PLAN-EXAM');

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
          'unrelated_key': 'PRIOR-DESTINATION'
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
            'unrelated_key': 'PRIOR-DESTINATION',
            'dob_path': 'REG-DOB-PLAN-EXAM'
          }
        }]
      };

      mockStateService.updatePlayer.mockReturnValue(updatedGameState);

      await movementService.movePlayer('player1', 'REG-DOB-PLAN-EXAM');

      // Workstream 6 #4: existing memory under unrelated keys should be
      // preserved when a new lock-point write happens.
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          pathChoiceMemory: {
            'unrelated_key': 'PRIOR-DESTINATION',
            'dob_path': 'REG-DOB-PLAN-EXAM'
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

    // REG-FDNY-FEE-REVIEW specific tests (Issue: Logic Movement Type Implementation)
    describe('REG-FDNY-FEE-REVIEW logic movement', () => {
      const fdnyMovement: Movement = {
        space_name: 'REG-FDNY-FEE-REVIEW',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'REG-FDNY-PLAN-EXAM',
        destination_2: 'CON-INITIATION',
        destination_3: 'PM-DECISION-CHECK',
        destination_4: 'REG-DOB-TYPE-SELECT',
        condition_1: 'scope_gt_4m',
        condition_2: 'always',
        condition_3: 'always',
        condition_4: 'scope_le_4m'
      };

      it('should show FDNY-PLAN-EXAM for large projects (>$4M scope)', () => {
        // Set up player with high scope project at REG-FDNY-FEE-REVIEW
        const highScopePlayer = {
          ...mockPlayer,
          currentSpace: 'REG-FDNY-FEE-REVIEW',
          visitType: 'First' as const,
          hand: ['W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008', 'W009', 'W010']
        };

        mockStateService.getPlayer.mockReturnValue(highScopePlayer);
        mockDataService.getMovement.mockReturnValue(fdnyMovement);

        // Mock scope calculation to return $5M (>$4M threshold)
        mockGameRulesService.calculateProjectScope.mockReturnValue(5000000);
        mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
          if (condition === 'scope_gt_4m') return true;  // $5M > $4M
          if (condition === 'scope_le_4m') return false; // $5M <= $4M is false
          return true;
        });

        const result = movementService.getValidMoves('player1');

        // Large projects: FDNY-PLAN-EXAM + always-available options
        expect(result).toContain('REG-FDNY-PLAN-EXAM');
        expect(result).toContain('CON-INITIATION');
        expect(result).toContain('PM-DECISION-CHECK');
        expect(result).not.toContain('REG-DOB-TYPE-SELECT'); // Not available for large projects
      });

      it('should show REG-DOB-TYPE-SELECT for small projects (≤$4M scope)', () => {
        // Set up player with low scope project at REG-FDNY-FEE-REVIEW
        const lowScopePlayer = {
          ...mockPlayer,
          currentSpace: 'REG-FDNY-FEE-REVIEW',
          visitType: 'First' as const,
          hand: ['W001', 'W002'] // 2 W cards = low scope
        };

        mockStateService.getPlayer.mockReturnValue(lowScopePlayer);
        mockDataService.getMovement.mockReturnValue(fdnyMovement);

        // Mock scope calculation to return $1M (≤$4M threshold)
        mockGameRulesService.calculateProjectScope.mockReturnValue(1000000);
        mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
          if (condition === 'scope_gt_4m') return false; // $1M > $4M is false
          if (condition === 'scope_le_4m') return true;  // $1M <= $4M
          return true;
        });

        const result = movementService.getValidMoves('player1');

        // Small projects: REG-DOB-TYPE-SELECT + always-available options
        expect(result).toContain('REG-DOB-TYPE-SELECT');
        expect(result).toContain('CON-INITIATION');
        expect(result).toContain('PM-DECISION-CHECK');
        expect(result).not.toContain('REG-FDNY-PLAN-EXAM'); // Not available for small projects
      });

      it('should always show CON-INITIATION and PM-DECISION-CHECK regardless of scope', () => {
        // Test with boundary scope ($4M exactly)
        const boundaryPlayer = {
          ...mockPlayer,
          currentSpace: 'REG-FDNY-FEE-REVIEW',
          visitType: 'First' as const,
          hand: ['W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008']
        };

        mockStateService.getPlayer.mockReturnValue(boundaryPlayer);
        mockDataService.getMovement.mockReturnValue(fdnyMovement);

        // Mock scope at exactly $4M (should satisfy scope_le_4m but not scope_gt_4m)
        mockGameRulesService.calculateProjectScope.mockReturnValue(4000000);
        mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
          if (condition === 'scope_gt_4m') return false; // $4M > $4M is false
          if (condition === 'scope_le_4m') return true;  // $4M <= $4M is true
          return true;
        });

        const result = movementService.getValidMoves('player1');

        // CON-INITIATION and PM-DECISION-CHECK should ALWAYS be available
        expect(result).toContain('CON-INITIATION');
        expect(result).toContain('PM-DECISION-CHECK');
      });
    });
  });

  describe('Resume from side quest (mainPathResumePoint)', () => {
    // Workstream 6 #5+#6: mock the new data-flag helpers so the engine reads the
    // resume-mechanic flags off the (mock) data layer. Equivalent to the real
    // Spaces.csv flagging PM-DECISION-CHECK as is_resume_hub and CHEAT-BYPASS as
    // is_point_of_no_return.
    beforeEach(() => {
      mockDataService.isResumeHub.mockImplementation((spaceName: string) => spaceName === 'PM-DECISION-CHECK');
      mockDataService.isPointOfNoReturn.mockImplementation((spaceName: string) => spaceName === 'CHEAT-BYPASS');
    });

    const pmDecisionMovement: Movement = {
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'Subsequent',
      movement_type: 'choice',
      destination_1: 'LEND-SCOPE-CHECK',
      destination_2: 'ARCH-INITIATION',
      destination_3: 'CHEAT-BYPASS',
      destination_4: 'PM-DECISION-CHECK',
      destination_5: 'OWNER-DECISION-REVIEW'
    };

    const archScopeMovement: Movement = {
      space_name: 'ARCH-SCOPE-CHECK',
      visit_type: 'First',
      movement_type: 'choice',
      destination_1: 'PM-DECISION-CHECK',
      destination_2: 'ENG-INITIATION'
    };

    it('should add resume point destinations at PM-DECISION-CHECK when mainPathResumePoint is set', () => {
      const player: Player = {
        ...mockPlayer,
        currentSpace: 'PM-DECISION-CHECK',
        visitType: 'Subsequent',
        visitedSpaces: ['OWNER-SCOPE-INITIATION', 'PM-DECISION-CHECK', 'ARCH-INITIATION', 'ARCH-FEE-REVIEW', 'ARCH-SCOPE-CHECK'],
        mainPathResumePoint: 'ARCH-SCOPE-CHECK',
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockImplementation((spaceName: string, _visitType: string) => {
        if (spaceName === 'PM-DECISION-CHECK') return pmDecisionMovement;
        if (spaceName === 'ARCH-SCOPE-CHECK') return archScopeMovement;
        return undefined;
      });

      const result = movementService.getValidMoves('player1');

      // Standard PM-DECISION-CHECK destinations
      expect(result).toContain('LEND-SCOPE-CHECK');
      expect(result).toContain('ARCH-INITIATION');
      expect(result).toContain('CHEAT-BYPASS');
      // Resume point destination (from ARCH-SCOPE-CHECK)
      expect(result).toContain('ENG-INITIATION');
    });

    it('should not duplicate destinations already in the standard list', () => {
      const player: Player = {
        ...mockPlayer,
        currentSpace: 'PM-DECISION-CHECK',
        visitType: 'Subsequent',
        visitedSpaces: ['PM-DECISION-CHECK', 'ARCH-SCOPE-CHECK'],
        mainPathResumePoint: 'ARCH-SCOPE-CHECK',
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockImplementation((spaceName: string, _visitType: string) => {
        if (spaceName === 'PM-DECISION-CHECK') return pmDecisionMovement;
        if (spaceName === 'ARCH-SCOPE-CHECK') return archScopeMovement;
        return undefined;
      });

      const result = movementService.getValidMoves('player1');

      // PM-DECISION-CHECK appears in both standard and resume destinations — should not be duplicated
      const pmCount = result.filter(d => d === 'PM-DECISION-CHECK').length;
      expect(pmCount).toBe(1);
    });

    it('should not add resume destinations when hasUsedCheatBypass is true', () => {
      const player: Player = {
        ...mockPlayer,
        currentSpace: 'PM-DECISION-CHECK',
        visitType: 'Subsequent',
        visitedSpaces: ['PM-DECISION-CHECK', 'ARCH-SCOPE-CHECK', 'CHEAT-BYPASS'],
        mainPathResumePoint: 'ARCH-SCOPE-CHECK',
        hasUsedCheatBypass: true,
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(pmDecisionMovement);

      const result = movementService.getValidMoves('player1');

      // Should NOT include ENG-INITIATION — cheat bypass disables resume
      expect(result).not.toContain('ENG-INITIATION');
      // Standard destinations should still be there
      expect(result).toContain('LEND-SCOPE-CHECK');
      expect(result).toContain('ARCH-INITIATION');
    });

    it('should not add resume destinations when mainPathResumePoint is null', () => {
      const player: Player = {
        ...mockPlayer,
        currentSpace: 'PM-DECISION-CHECK',
        visitType: 'Subsequent',
        visitedSpaces: ['PM-DECISION-CHECK'],
        mainPathResumePoint: null,
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(pmDecisionMovement);

      const result = movementService.getValidMoves('player1');

      expect(result).toEqual(['LEND-SCOPE-CHECK', 'ARCH-INITIATION', 'CHEAT-BYPASS', 'PM-DECISION-CHECK', 'OWNER-DECISION-REVIEW']);
    });

    it('should not add resume destinations on non-PM-DECISION-CHECK spaces', () => {
      const player: Player = {
        ...mockPlayer,
        currentSpace: 'ARCH-SCOPE-CHECK',
        visitType: 'First',
        visitedSpaces: ['ARCH-SCOPE-CHECK'],
        mainPathResumePoint: 'SOME-SPACE',
      };

      mockStateService.getPlayer.mockReturnValue(player);
      mockDataService.getMovement.mockReturnValue(archScopeMovement);

      const result = movementService.getValidMoves('player1');

      // Just the standard ARCH-SCOPE-CHECK destinations
      expect(result).toEqual(['PM-DECISION-CHECK', 'ENG-INITIATION']);
    });

    describe('finalizeMove tracking', () => {
      it('should set mainPathResumePoint when arriving at PM-DECISION-CHECK from a Main path space', async () => {
        const player: Player = {
          ...mockPlayer,
          currentSpace: 'ARCH-SCOPE-CHECK',
          visitType: 'First',
          visitedSpaces: ['ARCH-SCOPE-CHECK'],
          spaceVisitLog: [{ spaceName: 'ARCH-SCOPE-CHECK', entryTurn: 1, entryTime: 0, daysSpent: 0 }],
        };

        const movement: Movement = {
          space_name: 'ARCH-SCOPE-CHECK',
          visit_type: 'First',
          movement_type: 'choice',
          destination_1: 'PM-DECISION-CHECK',
          destination_2: 'ENG-INITIATION'
        };

        mockStateService.getPlayer.mockReturnValue(player);
        mockDataService.getMovement.mockReturnValue(movement);
        mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
          if (spaceName === 'ARCH-SCOPE-CHECK') {
            return { space_name: 'ARCH-SCOPE-CHECK', phase: 'DESIGN', path_type: 'Main', is_starting_space: false, is_ending_space: false, min_players: 1, max_players: 4, requires_dice_roll: true } as GameConfig;
          }
          return undefined;
        });
        mockStateService.updatePlayer.mockReturnValue(mockGameState);
        mockStateService.getGameState.mockReturnValue(mockGameState);

        await movementService.movePlayer('player1', 'PM-DECISION-CHECK');

        // Check that updatePlayer was called with mainPathResumePoint
        const updateCall = mockStateService.updatePlayer.mock.calls[0][0];
        expect(updateCall.mainPathResumePoint).toBe('ARCH-SCOPE-CHECK');
      });

      it('should set hasUsedCheatBypass and clear resume point when moving to CHEAT-BYPASS', async () => {
        const player: Player = {
          ...mockPlayer,
          currentSpace: 'PM-DECISION-CHECK',
          visitType: 'First',
          visitedSpaces: ['PM-DECISION-CHECK'],
          mainPathResumePoint: 'ARCH-SCOPE-CHECK',
          spaceVisitLog: [{ spaceName: 'PM-DECISION-CHECK', entryTurn: 1, entryTime: 0, daysSpent: 0 }],
        };

        const movement: Movement = {
          space_name: 'PM-DECISION-CHECK',
          visit_type: 'First',
          movement_type: 'choice',
          destination_1: 'CHEAT-BYPASS'
        };

        mockStateService.getPlayer.mockReturnValue(player);
        mockDataService.getMovement.mockReturnValue(movement);
        mockDataService.getGameConfigBySpace.mockReturnValue(undefined);
        mockStateService.updatePlayer.mockReturnValue(mockGameState);
        mockStateService.getGameState.mockReturnValue(mockGameState);

        await movementService.movePlayer('player1', 'CHEAT-BYPASS');

        const updateCall = mockStateService.updatePlayer.mock.calls[0][0];
        expect(updateCall.hasUsedCheatBypass).toBe(true);
        expect(updateCall.mainPathResumePoint).toBeNull();
      });

      it('should NOT set mainPathResumePoint when arriving at PM-DECISION-CHECK from a side quest space', async () => {
        const player: Player = {
          ...mockPlayer,
          currentSpace: 'BANK-FUND-REVIEW',
          visitType: 'First',
          visitedSpaces: ['BANK-FUND-REVIEW'],
          mainPathResumePoint: 'ARCH-SCOPE-CHECK', // Already set from earlier
          spaceVisitLog: [{ spaceName: 'BANK-FUND-REVIEW', entryTurn: 1, entryTime: 0, daysSpent: 0 }],
        };

        const movement: Movement = {
          space_name: 'BANK-FUND-REVIEW',
          visit_type: 'First',
          movement_type: 'fixed',
          destination_1: 'PM-DECISION-CHECK'
        };

        mockStateService.getPlayer.mockReturnValue(player);
        mockDataService.getMovement.mockReturnValue(movement);
        mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
          if (spaceName === 'BANK-FUND-REVIEW') {
            return { space_name: 'BANK-FUND-REVIEW', phase: 'FUNDING', path_type: 'Side quest money', is_starting_space: false, is_ending_space: false, min_players: 1, max_players: 4, requires_dice_roll: false } as GameConfig;
          }
          return undefined;
        });
        mockStateService.updatePlayer.mockReturnValue(mockGameState);
        mockStateService.getGameState.mockReturnValue(mockGameState);

        await movementService.movePlayer('player1', 'PM-DECISION-CHECK');

        // Should NOT overwrite the existing resume point
        const updateCall = mockStateService.updatePlayer.mock.calls[0][0];
        expect(updateCall.mainPathResumePoint).toBeUndefined();
      });
    });
  });

  // Walker unit tests for LOGIC movement — covers the three target grammars
  // (Q-id recurse, comma-split sub-choice, single-space terminal) plus the
  // two fallbacks (missing chain auto-selects, missing Q-id short-circuits).
  // These lock in the contract so a future data-layer refactor can't silently
  // re-break the REG-FDNY-FEE-REVIEW chain without a test turning red.
  describe('handleLogicMovement — walker', () => {
    // Helpers to build a chain like REG-FDNY-FEE-REVIEW in miniature.
    const q = (id: string, yes: string, no: string, text = `${id}?`) => ({
      space_name: 'LOGIC-SPACE',
      visit_type: 'First' as const,
      question_id: id,
      question_text: text,
      yes_target: yes,
      no_target: no,
    });

    beforeEach(() => {
      mockPlayer.currentSpace = 'LOGIC-SPACE';
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockStateService.getGameState.mockReturnValue(mockGameState);
    });

    it('returns choiceCreated and asks Q1 via createChoice', () => {
      const q1 = q('Q1', 'DEST-A', 'DEST-B');
      mockDataService.getLogicQuestionEntry.mockReturnValue(q1);
      mockDataService.getLogicQuestionsForSpace.mockReturnValue([q1]);
      // Hang the first createChoice — we only care that it was invoked with
      // the correct question and metadata; we don't need to drive answers.
      mockChoiceService.createChoice.mockReturnValue(new Promise(() => {}));

      const result = movementService.handleLogicMovement('player1');

      expect(result.choiceCreated).toBe(true);
      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(1);
      const [pid, type, prompt, options, metadata] = mockChoiceService.createChoice.mock.calls[0];
      expect(pid).toBe('player1');
      expect(type).toBe('LOGIC_QUESTION');
      expect(prompt).toBe('Q1?');
      expect(options).toEqual([
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ]);
      expect(metadata).toMatchObject({
        logicSpaceName: 'LOGIC-SPACE',
        logicVisitType: 'First',
        logicQuestionId: 'Q1',
        logicStepIndex: 1,
        logicStepTotal: 1,
      });
    });

    it('falls back to first valid move when no chain is authored', () => {
      mockDataService.getLogicQuestionEntry.mockReturnValue(undefined);
      mockDataService.getMovement.mockReturnValue({
        space_name: 'LOGIC-SPACE',
        visit_type: 'First',
        movement_type: 'logic',
        destination_1: 'DEST-FALLBACK',
        destination_2: '',
        destination_3: '',
        destination_4: '',
        destination_5: '',
      } as Movement);

      const result = movementService.handleLogicMovement('player1');

      expect(result.choiceCreated).toBe(false);
      expect(result.autoSelected).toBe('DEST-FALLBACK');
      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', 'DEST-FALLBACK');
      expect(mockChoiceService.createChoice).not.toHaveBeenCalled();
    });

    it('returns choiceCreated:false when no chain AND no valid moves', () => {
      mockDataService.getLogicQuestionEntry.mockReturnValue(undefined);
      mockDataService.getMovement.mockReturnValue(undefined);

      const result = movementService.handleLogicMovement('player1');

      expect(result.choiceCreated).toBe(false);
      expect(result.autoSelected).toBeUndefined();
      expect(mockStateService.setPlayerMoveIntent).not.toHaveBeenCalled();
    });

    it('recurses into the next Q-id when yes_target is "Q2"', async () => {
      const q1 = q('Q1', 'Q2', 'DEST-NO', 'first?');
      const q2 = q('Q2', 'DEST-YES', 'DEST-NO2', 'second?');
      mockDataService.getLogicQuestionEntry.mockReturnValue(q1);
      mockDataService.getLogicQuestionsForSpace.mockReturnValue([q1, q2]);
      mockDataService.getLogicQuestion.mockImplementation((_s: string, _v: string, id: string) =>
        id === 'Q2' ? q2 : undefined
      );
      // Answer yes to Q1 (→ Q2), then yes to Q2 (→ DEST-YES terminal).
      mockChoiceService.createChoice
        .mockResolvedValueOnce('yes')
        .mockResolvedValueOnce('yes');

      movementService.handleLogicMovement('player1');
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(2);
      // The second createChoice call should be for Q2 with stepIndex=2.
      const secondMeta = mockChoiceService.createChoice.mock.calls[1][4];
      expect(secondMeta).toMatchObject({ logicQuestionId: 'Q2', logicStepIndex: 2 });
      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', 'DEST-YES');
    });

    it('terminates with setPlayerMoveIntent on a single-space target', async () => {
      const q1 = q('Q1', 'DEST-A', 'DEST-B');
      mockDataService.getLogicQuestionEntry.mockReturnValue(q1);
      mockDataService.getLogicQuestionsForSpace.mockReturnValue([q1]);
      mockChoiceService.createChoice.mockResolvedValueOnce('no');

      movementService.handleLogicMovement('player1');
      await new Promise((r) => setImmediate(r));

      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', 'DEST-B');
      // No sub-choice MOVEMENT modal for a plain single-space target.
      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(1);
    });

    it('opens a MOVEMENT sub-choice when target is comma-separated', async () => {
      const q1 = q('Q1', 'DEST-X,DEST-Y,DEST-Z', 'DEST-NO');
      mockDataService.getLogicQuestionEntry.mockReturnValue(q1);
      mockDataService.getLogicQuestionsForSpace.mockReturnValue([q1]);
      mockDataService.getSpaceContent.mockReturnValue(undefined);
      mockChoiceService.createChoice
        .mockResolvedValueOnce('yes') // answer to Q1
        .mockResolvedValueOnce('DEST-Y'); // sub-choice selection

      movementService.handleLogicMovement('player1');
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(2);
      const [, subType, subPrompt, subOptions] = mockChoiceService.createChoice.mock.calls[1];
      expect(subType).toBe('MOVEMENT');
      expect(subPrompt).toContain('destination');
      expect(subOptions.map((o: { id: string }) => o.id)).toEqual(['DEST-X', 'DEST-Y', 'DEST-Z']);
      expect(mockStateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', 'DEST-Y');
    });

    it('short-circuits silently when a Q-id target references a missing question', async () => {
      const q1 = q('Q1', 'Q99', 'DEST-NO');
      mockDataService.getLogicQuestionEntry.mockReturnValue(q1);
      mockDataService.getLogicQuestionsForSpace.mockReturnValue([q1]);
      mockDataService.getLogicQuestion.mockReturnValue(undefined); // Q99 doesn't exist
      mockChoiceService.createChoice.mockResolvedValueOnce('yes');

      movementService.handleLogicMovement('player1');
      await new Promise((r) => setImmediate(r));

      // No further question asked, no destination committed.
      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(1);
      expect(mockStateService.setPlayerMoveIntent).not.toHaveBeenCalled();
    });
  });
});