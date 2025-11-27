import { StateService } from '../../src/services/StateService';
import { IDataService } from '../../src/types/ServiceContracts';
import { GameState, Player, GamePhase } from '../../src/types/StateTypes';
import { createMockDataService } from '../mocks/mockServices';
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('StateService', () => {
  let stateService: StateService;
  let mockDataService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock using centralized creator, then configure specific return values
    mockDataService = createMockDataService();
    mockDataService.isLoaded.mockReturnValue(true);
    mockDataService.getGameConfig.mockReturnValue([
      { 
        space_name: 'OWNER-SCOPE-INITIATION', 
        phase: 'SETUP',
        path_type: 'A',
        is_starting_space: true, 
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false 
      }
    ]);
    mockDataService.getMovement.mockReturnValue(undefined);
    mockDataService.getCardsByType.mockReturnValue([]);

    stateService = new StateService(mockDataService);
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const initialState = stateService.getGameState();
      
      expect(initialState.players).toEqual([]);
      expect(initialState.currentPlayerId).toBeNull();
      expect(initialState.gamePhase).toBe('SETUP');
      expect(initialState.turn).toBe(0);
      expect(initialState.gameStartTime).toBeUndefined();
      expect(initialState.gameEndTime).toBeUndefined();
      expect(initialState.winner).toBeUndefined();
    });

    it('should indicate state is loaded', () => {
      expect(stateService.isStateLoaded()).toBe(true);
    });

    it('should return a copy of state to prevent mutations', () => {
      const state1 = stateService.getGameState();
      const state2 = stateService.getGameState();
      
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('Player Management', () => {
    it('should add a player successfully', () => {
      // Arrange: Tell the mock what to return for this specific test
      mockDataService.getGameConfig.mockReturnValue([
        { space_name: 'OWNER-SCOPE-INITIATION', is_starting_space: true }
      ] as any);

      // Act
      const newState = stateService.addPlayer('Alice');

      // Assert
      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].name).toBe('Alice');
      expect(newState.players[0].id).toBeDefined();
      expect(newState.players[0].currentSpace).toBe('OWNER-SCOPE-INITIATION');
      expect(newState.players[0].visitType).toBe('First');
      expect(newState.players[0].money).toBe(0);
      expect(newState.players[0].timeSpent).toBe(0);
      expect(newState.players[0].hand).toEqual([]);
    });

    it('should add multiple players', () => {
      stateService.addPlayer('Alice');
      const newState = stateService.addPlayer('Bob');
      
      expect(newState.players).toHaveLength(2);
      expect(newState.players.map(p => p.name)).toEqual(['Alice', 'Bob']);
    });

    it('should prevent adding players with duplicate names', () => {
      stateService.addPlayer('Alice');
      
      expect(() => stateService.addPlayer('Alice')).toThrow('Player with name "Alice" already exists');
    });

    it('should prevent adding players outside setup phase', () => {
      stateService.setGamePhase('PLAY');
      
      expect(() => stateService.addPlayer('Alice')).toThrow('Cannot add players outside of setup phase');
    });

    it('should update player data successfully', () => {
      const addedState = stateService.addPlayer('Alice');
      const playerId = addedState.players[0].id;
      
      const updatedState = stateService.updatePlayer({
        id: playerId,
        money: 100,
        timeSpent: 5,
        currentSpace: 'NEW-SPACE'
      });
      
      const updatedPlayer = updatedState.players[0];
      expect(updatedPlayer.money).toBe(100);
      expect(updatedPlayer.timeSpent).toBe(5);
      expect(updatedPlayer.currentSpace).toBe('NEW-SPACE');
      expect(updatedPlayer.name).toBe('Alice'); // Unchanged
    });

    it('should update player cards immutably', () => {
      const addedState = stateService.addPlayer('Alice');
      const playerId = addedState.players[0].id;
      
      const updatedState = stateService.updatePlayer({
        id: playerId,
        hand: ['card1', 'card2']
      });
      
      const updatedPlayer = updatedState.players[0];
      expect(updatedPlayer.hand).toEqual(['card1', 'card2']);
    });

    it('should throw error when updating non-existent player', () => {
      expect(() => stateService.updatePlayer({
        id: 'non-existent',
        money: 100
      })).toThrow('Player with ID "non-existent" not found');
    });

    it('should require player ID for updates', () => {
      expect(() => stateService.updatePlayer({
        money: 100
      })).toThrow('Player ID is required for updates');
    });

    it('should remove player successfully', () => {
      stateService.addPlayer('Alice');
      const addedState = stateService.addPlayer('Bob');
      const bobId = addedState.players[1].id;
      
      const newState = stateService.removePlayer(bobId);
      
      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].name).toBe('Alice');
    });

    it('should update currentPlayerId when removing current player', () => {
      stateService.addPlayer('Alice');
      const addedState = stateService.addPlayer('Bob');
      const aliceId = addedState.players[0].id;
      const bobId = addedState.players[1].id;
      
      stateService.setCurrentPlayer(aliceId);
      const newState = stateService.removePlayer(aliceId);
      
      expect(newState.currentPlayerId).toBe(bobId);
    });

    it('should set currentPlayerId to null when removing last player', () => {
      const addedState = stateService.addPlayer('Alice');
      const playerId = addedState.players[0].id;
      
      const newState = stateService.removePlayer(playerId);
      
      expect(newState.players).toHaveLength(0);
      expect(newState.currentPlayerId).toBeNull();
    });

    it('should prevent removing players outside setup phase', () => {
      const addedState = stateService.addPlayer('Alice');
      const playerId = addedState.players[0].id;
      
      stateService.setGamePhase('PLAY');
      
      expect(() => stateService.removePlayer(playerId)).toThrow('Cannot remove players outside of setup phase');
    });

    it('should keep currentPlayerId unchanged when removing different player', () => {
      stateService.addPlayer('Alice');
      const addedState = stateService.addPlayer('Bob');
      const aliceId = addedState.players[0].id;
      const bobId = addedState.players[1].id;
      
      stateService.setCurrentPlayer(aliceId);
      const newState = stateService.removePlayer(bobId);
      
      expect(newState.currentPlayerId).toBe(aliceId);
      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].name).toBe('Alice');
    });

    it('should get player by ID', () => {
      const addedState = stateService.addPlayer('Alice');
      const playerId = addedState.players[0].id;
      
      const player = stateService.getPlayer(playerId);
      
      expect(player).toBeDefined();
      expect(player!.name).toBe('Alice');
    });

    it('should return undefined for non-existent player ID', () => {
      const player = stateService.getPlayer('non-existent');
      
      expect(player).toBeUndefined();
    });

    it('should get all players as a copy', () => {
      stateService.addPlayer('Alice');
      stateService.addPlayer('Bob');
      
      const players1 = stateService.getAllPlayers();
      const players2 = stateService.getAllPlayers();
      
      expect(players1).not.toBe(players2);
      expect(players1).toEqual(players2);
      expect(players1).toHaveLength(2);
    });
  });

  describe('Game Flow Methods', () => {
    beforeEach(() => {
      stateService.addPlayer('Alice');
      stateService.addPlayer('Bob');
    });

    it('should set current player successfully', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      
      const newState = stateService.setCurrentPlayer(aliceId);
      
      expect(newState.currentPlayerId).toBe(aliceId);
    });

    it('should throw error when setting non-existent current player', () => {
      expect(() => stateService.setCurrentPlayer('non-existent')).toThrow('Player with ID "non-existent" not found');
    });

    it('should set game phase successfully', () => {
      const newState = stateService.setGamePhase('PLAY');
      
      expect(newState.gamePhase).toBe('PLAY');
    });

    it('should set game start time when entering PLAY phase', () => {
      const newState = stateService.setGamePhase('PLAY');
      
      expect(newState.gameStartTime).toBeInstanceOf(Date);
    });

    it('should set game end time when entering END phase', () => {
      stateService.setGamePhase('PLAY');
      const newState = stateService.setGamePhase('END');
      
      expect(newState.gameEndTime).toBeInstanceOf(Date);
    });

    it('should advance turn successfully', () => {
      const initialTurn = stateService.getGameState().turn;
      const newState = stateService.advanceTurn();
      
      expect(newState.turn).toBe(initialTurn + 1);
    });

    it('should move to next player', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      const bobId = players[1].id;
      
      stateService.setCurrentPlayer(aliceId);
      const newState = stateService.nextPlayer();
      
      expect(newState.currentPlayerId).toBe(bobId);
    });

    it('should wrap around to first player after last player', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      const bobId = players[1].id;
      
      stateService.setCurrentPlayer(bobId);
      const newState = stateService.nextPlayer();
      
      expect(newState.currentPlayerId).toBe(aliceId);
    });

    it('should handle next player when no current player is set', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      
      const newState = stateService.nextPlayer();
      
      expect(newState.currentPlayerId).toBe(aliceId);
    });

    it('should throw error when calling nextPlayer with no players', () => {
      const emptyStateService = new StateService(mockDataService);
      
      expect(() => emptyStateService.nextPlayer()).toThrow('No players available');
    });
  });

  describe('Game Lifecycle Methods', () => {
    beforeEach(() => {
      stateService.addPlayer('Alice');
      stateService.addPlayer('Bob');
    });

    it('should initialize game to default state', () => {
      stateService.setGamePhase('PLAY');
      stateService.advanceTurn();
      
      const newState = stateService.initializeGame();
      
      expect(newState.players).toEqual([]);
      expect(newState.currentPlayerId).toBeNull();
      expect(newState.gamePhase).toBe('SETUP');
      expect(newState.turn).toBe(0);
    });

    it('should start game successfully', () => {
      // Arrange: Create fresh StateService and add players
      const freshStateService = new StateService(mockDataService);
      mockDataService.getGameConfig.mockReturnValue([
        { space_name: 'OWNER-SCOPE-INITIATION', is_starting_space: true, min_players: 1, max_players: 4 }
      ] as any);
      
      freshStateService.addPlayer('Player1');
      freshStateService.addPlayer('Player2');
      
      // Act
      const newState = freshStateService.startGame();
      
      // Assert
      expect(newState.gamePhase).toBe('PLAY');
      expect(newState.gameStartTime).toBeInstanceOf(Date);
      expect(newState.currentPlayerId).toBe(newState.players[0].id);
    });

    it('should prevent starting game when requirements not met', () => {
      const emptyStateService = new StateService(mockDataService);
      
      expect(() => emptyStateService.startGame()).toThrow('Cannot start game: requirements not met');
    });

    it('should end game successfully', () => {
      const players = stateService.getAllPlayers();
      const winnerId = players[0].id;
      
      const newState = stateService.endGame(winnerId);
      
      expect(newState.gamePhase).toBe('END');
      expect(newState.gameEndTime).toBeInstanceOf(Date);
      expect(newState.winner).toBe(winnerId);
    });

    it('should end game without winner', () => {
      const newState = stateService.endGame();
      
      expect(newState.gamePhase).toBe('END');
      expect(newState.winner).toBeUndefined();
    });

    it('should reset game to initial state', () => {
      stateService.setGamePhase('PLAY');
      stateService.advanceTurn();
      
      const newState = stateService.resetGame();
      
      expect(newState.players).toEqual([]);
      expect(newState.currentPlayerId).toBeNull();
      expect(newState.gamePhase).toBe('SETUP');
      expect(newState.turn).toBe(0);
    });
  });

  describe('Validation Methods', () => {
    beforeEach(() => {
      stateService.addPlayer('Alice');
      stateService.addPlayer('Bob');
    });

    it('should validate player action successfully', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      
      stateService.setGamePhase('PLAY');
      stateService.setCurrentPlayer(aliceId);
      
      const isValid = stateService.validatePlayerAction(aliceId, 'move');
      
      expect(isValid).toBe(true);
    });

    it('should reject action when not in PLAY phase', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      
      const isValid = stateService.validatePlayerAction(aliceId, 'move');
      
      expect(isValid).toBe(false);
    });

    it('should reject action from non-current player', () => {
      const players = stateService.getAllPlayers();
      const aliceId = players[0].id;
      const bobId = players[1].id;
      
      stateService.setGamePhase('PLAY');
      stateService.setCurrentPlayer(aliceId);
      
      const isValid = stateService.validatePlayerAction(bobId, 'move');
      
      expect(isValid).toBe(false);
    });

    it('should reject action from non-existent player', () => {
      stateService.setGamePhase('PLAY');
      
      const isValid = stateService.validatePlayerAction('non-existent', 'move');
      
      expect(isValid).toBe(false);
    });

    it('should check if game can start with sufficient players', () => {
      // Arrange: Create fresh StateService and add players
      const freshStateService = new StateService(mockDataService);
      mockDataService.getGameConfig.mockReturnValue([
        { space_name: 'OWNER-SCOPE-INITIATION', is_starting_space: true, min_players: 1, max_players: 4 }
      ] as any);
      
      freshStateService.addPlayer('PlayerA');
      freshStateService.addPlayer('PlayerB');
      
      // Act
      const canStart = freshStateService.canStartGame();
      
      // Assert
      expect(canStart).toBe(true);
    });

    it('should prevent starting game with insufficient players', () => {
      const emptyStateService = new StateService(mockDataService);
      
      const canStart = emptyStateService.canStartGame();
      
      expect(canStart).toBe(false);
    });

    it('should prevent starting game when not in SETUP phase', () => {
      stateService.setGamePhase('PLAY');
      
      const canStart = stateService.canStartGame();
      
      expect(canStart).toBe(false);
    });
  });

  describe('Immutability Verification', () => {
    it('should not mutate original state when adding player', () => {
      const originalState = stateService.getGameState();
      const originalPlayersCount = originalState.players.length;
      
      stateService.addPlayer('Alice');
      
      expect(originalState.players.length).toBe(originalPlayersCount);
    });

    it('should not mutate original state when updating player', () => {
      const addedState = stateService.addPlayer('Alice');
      const playerId = addedState.players[0].id;
      const originalMoney = addedState.players[0].money;
      
      stateService.updatePlayer({ id: playerId, money: 100 });
      
      expect(addedState.players[0].money).toBe(originalMoney);
    });

    it('should not mutate original state when setting game phase', () => {
      const originalState = stateService.getGameState();
      const originalPhase = originalState.gamePhase;
      
      stateService.setGamePhase('PLAY');
      
      expect(originalState.gamePhase).toBe(originalPhase);
    });

    it('should return different object references for state copies', () => {
      stateService.addPlayer('Alice');
      
      const state1 = stateService.getGameState();
      const state2 = stateService.getGameState();
      
      expect(state1).not.toBe(state2);
      expect(state1.players).not.toBe(state2.players);
    });

    it('should not allow external mutation of returned players array', () => {
      stateService.addPlayer('Alice');
      
      const players = stateService.getAllPlayers();
      const originalLength = players.length;
      
      players.push({
        id: 'fake',
        name: 'Fake',
        currentSpace: 'FAKE',
        visitType: 'First',
        money: 0,
        timeSpent: 0,
        projectScope: 0,
        score: 0,
        color: '#000000',
        avatar: '👤',
        hand: [],
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      });
      
      const currentPlayers = stateService.getAllPlayers();
      expect(currentPlayers.length).toBe(originalLength);
    });
  });

  describe('Fallback Logic (DataService not available)', () => {
    let mockDataServiceNotLoaded: any;
    let stateServiceWithUnloadedData: StateService;

    beforeEach(() => {
      // Create a mock DataService that returns false for isLoaded()
      mockDataServiceNotLoaded = {
        isLoaded: vi.fn().mockReturnValue(false),
        getGameConfig: vi.fn().mockReturnValue([]),
        loadData: vi.fn().mockResolvedValue(undefined),
        getGameConfigBySpace: vi.fn().mockReturnValue(undefined),
        getPhaseOrder: vi.fn().mockReturnValue([]),
        getAllSpaces: vi.fn().mockReturnValue([]),
        getSpaceByName: vi.fn().mockReturnValue(undefined),
        getMovement: vi.fn().mockReturnValue(undefined),
        getAllMovements: vi.fn().mockReturnValue([]),
        getDiceOutcome: vi.fn().mockReturnValue(undefined),
        getAllDiceOutcomes: vi.fn().mockReturnValue([]),
        getSpaceEffects: vi.fn().mockReturnValue([]),
        getAllSpaceEffects: vi.fn().mockReturnValue([]),
        getDiceEffects: vi.fn().mockReturnValue([]),
        getAllDiceEffects: vi.fn().mockReturnValue([]),
        getSpaceContent: vi.fn().mockReturnValue(undefined),
        getAllSpaceContent: vi.fn().mockReturnValue([]),
        getCards: vi.fn().mockReturnValue([]),
        getCardById: vi.fn().mockReturnValue(undefined),
        getCardsByType: vi.fn().mockReturnValue([]),
        getAllCardTypes: vi.fn().mockReturnValue([])
      } as any;

      stateServiceWithUnloadedData = new StateService(mockDataServiceNotLoaded);
    });

    it('should use fallback logic in canStartGame when DataService not loaded', () => {
      // Add players within fallback range (1-6)
      stateServiceWithUnloadedData.addPlayer('Alice');
      stateServiceWithUnloadedData.addPlayer('Bob');
      
      const canStart = stateServiceWithUnloadedData.canStartGame();
      
      expect(canStart).toBe(true);
      expect(mockDataServiceNotLoaded.isLoaded).toHaveBeenCalled();
    });

    it('should use fallback logic when too many players for hardcoded limits', () => {
      // Add 7 players (exceeds hardcoded max of 6)
      for (let i = 1; i <= 7; i++) {
        stateServiceWithUnloadedData.addPlayer(`Player${i}`);
      }
      
      const canStart = stateServiceWithUnloadedData.canStartGame();
      
      expect(canStart).toBe(false); // Should fail hardcoded limit of max 6 players
    });

    it('should use fallback starting space when DataService not available', () => {
      const newState = stateServiceWithUnloadedData.addPlayer('Alice');
      
      expect(newState.players[0].currentSpace).toBe('OWNER-SCOPE-INITIATION');
      expect(mockDataServiceNotLoaded.isLoaded).toHaveBeenCalled();
    });

    it('should use fallback logic when DataService isLoaded but no configs available', () => {
      // Create a mock where isLoaded returns true but getGameConfig returns empty array
      const mockDataServiceEmptyConfigs = {
        ...mockDataServiceNotLoaded,
        isLoaded: vi.fn().mockReturnValue(true),
        getGameConfig: vi.fn().mockReturnValue([])
      } as any;

      const stateServiceEmptyConfigs = new StateService(mockDataServiceEmptyConfigs);
      stateServiceEmptyConfigs.addPlayer('Alice');
      stateServiceEmptyConfigs.addPlayer('Bob');
      
      const canStart = stateServiceEmptyConfigs.canStartGame();
      
      expect(canStart).toBe(true); // Should use fallback 1-6 player range
    });
  });
});