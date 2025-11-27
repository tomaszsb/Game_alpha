import { TurnService } from '../../src/services/TurnService';
import { IDataService, IStateService, IGameRulesService, ICardService, IResourceService, IMovementService, IEffectEngineService, ILoggingService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock implementations
const mockDataService: anyIDataService = {
  getCardById: vi.fn(),
  getCards: vi.fn(),
  getCardsByType: vi.fn(),
  getAllCardTypes: vi.fn(),
  getGameConfig: vi.fn(),
  getGameConfigBySpace: vi.fn(),
  getPhaseOrder: vi.fn(),
  getAllSpaces: vi.fn(),
  getSpaceByName: vi.fn(),
  getMovement: vi.fn(),
  getAllMovements: vi.fn(),
  getDiceOutcome: vi.fn(),
  getAllDiceOutcomes: vi.fn(),
  getSpaceEffects: vi.fn(),
  getAllSpaceEffects: vi.fn(),
  getDiceEffects: vi.fn(),
  getAllDiceEffects: vi.fn(),
  getSpaceContent: vi.fn(),
  getAllSpaceContent: vi.fn(),
  isLoaded: vi.fn(),
  loadData: vi.fn(),
};

const mockStateService: anyIStateService = {
  getGameState: vi.fn(),
  getGameStateDeepCopy: vi.fn(),
  isStateLoaded: vi.fn(),
  subscribe: vi.fn(),
  addPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  removePlayer: vi.fn(),
  getPlayer: vi.fn(),
  getAllPlayers: vi.fn(),
  setCurrentPlayer: vi.fn(),
  setGamePhase: vi.fn(),
  advanceTurn: vi.fn(),
  nextPlayer: vi.fn(),
  initializeGame: vi.fn(),
  startGame: vi.fn(),
  endGame: vi.fn(),
  resetGame: vi.fn(),
  updateNegotiationState: vi.fn(),
  fixPlayerStartingSpaces: vi.fn(),
  forceResetAllPlayersToCorrectStartingSpace: vi.fn(),
  setAwaitingChoice: vi.fn(),
  clearAwaitingChoice: vi.fn(),
  setPlayerHasMoved: vi.fn(),
  clearPlayerHasMoved: vi.fn(),
  setPlayerCompletedManualAction: vi.fn(),
  setPlayerHasRolledDice: vi.fn(),
  clearPlayerCompletedManualActions: vi.fn(),
  clearPlayerHasRolledDice: vi.fn(),
  updateActionCounts: vi.fn(),
  clearTurnActions: vi.fn(),
  showCardModal: vi.fn(),
  dismissModal: vi.fn(),
  createPlayerSnapshot: vi.fn(),
  restorePlayerSnapshot: vi.fn(),
  validatePlayerAction: vi.fn(),
  canStartGame: vi.fn(),
  logToActionHistory: vi.fn(),
  savePreSpaceEffectSnapshot: vi.fn(),
  clearPreSpaceEffectSnapshot: vi.fn(),
  hasPreSpaceEffectSnapshot: vi.fn(),
  getPreSpaceEffectSnapshot: vi.fn(),
  setGameState: vi.fn(),
  updateGameState: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true),
  markAsInitialized: vi.fn(),
};

const mockGameRulesService: anyIGameRulesService = {
  isMoveValid: vi.fn(),
  canPlayCard: vi.fn(),
  canDrawCard: vi.fn(),
  canPlayerAfford: vi.fn(),
  isPlayerTurn: vi.fn(),
  isGameInProgress: vi.fn(),
  canPlayerTakeAction: vi.fn(),
  checkWinCondition: vi.fn(),
  calculateProjectScope: vi.fn(),
  evaluateCondition: vi.fn().mockReturnValue(true),
  calculatePlayerScore: vi.fn(),
  determineWinner: vi.fn(),
  checkTurnLimit: vi.fn(),
  checkGameEndConditions: vi.fn(),
};

const mockCardService: anyICardService = {
  canPlayCard: vi.fn(),
  isValidCardType: vi.fn(),
  playerOwnsCard: vi.fn(),
  playCard: vi.fn(),
  drawCards: vi.fn(),
  drawAndApplyCard: vi.fn(),
  discardCards: vi.fn(),
  removeCard: vi.fn(),
  replaceCard: vi.fn(),
  endOfTurn: vi.fn(),
  activateCard: vi.fn(),
  transferCard: vi.fn(),
  getCardType: vi.fn(),
  getPlayerCards: vi.fn(),
  getPlayerCardCount: vi.fn(),
  getCardToDiscard: vi.fn(),
  applyCardEffects: vi.fn(),
  finalizePlayedCard: vi.fn(),
  discardPlayedCard: vi.fn(),
  effectEngineService: {
    processEffects: vi.fn(),
    processEffect: vi.fn(),
    processActiveEffectsForAllPlayers: vi.fn(),
    validateEffect: vi.fn(),
    validateEffects: vi.fn(),
  } as any,
  setEffectEngineService: vi.fn(),
};

const mockResourceService: anyIResourceService = {
  addMoney: vi.fn(),
  spendMoney: vi.fn(),
  canAfford: vi.fn(),
  addTime: vi.fn(),
  spendTime: vi.fn(),
  updateResources: vi.fn(),
  getResourceHistory: vi.fn(),
  validateResourceChange: vi.fn(),
  takeOutLoan: vi.fn(),
  applyInterest: vi.fn(),
};

const mockMovementService: anyIMovementService = {
  getValidMoves: vi.fn(),
  movePlayer: vi.fn(),
  getDiceDestination: vi.fn(),
  handleMovementChoice: vi.fn(),
  handleMovementChoiceV2: vi.fn(),
};

const mockNegotiationService = {
  initiateNegotiation: vi.fn(),
  makeOffer: vi.fn(),
  acceptOffer: vi.fn(),
  declineOffer: vi.fn(),
  getActiveNegotiation: vi.fn(),
  hasActiveNegotiation: vi.fn(),
};

const mockEffectEngineService: anyIEffectEngineService = {
  processEffects: vi.fn(),
  processEffect: vi.fn(),
  processActiveEffectsForAllPlayers: vi.fn(),
  validateEffect: vi.fn(),
  validateEffects: vi.fn(),
};

const mockLoggingService: anyILoggingService = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
  startPerformanceTimer: vi.fn(),
  endPerformanceTimer: vi.fn(),
  startNewExplorationSession: vi.fn(),
  commitCurrentSession: vi.fn(),
  getCurrentSessionId: vi.fn(),
  cleanupAbandonedSessions: vi.fn(),
};

describe('TurnService', () => {
  let turnService: TurnService;
  
  const mockPlayers: Player[] = [
    {
      id: 'player1',
      name: 'Player 1',
      currentSpace: 'START-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
      projectScope: 0,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    },
    {
      id: 'player2', 
      name: 'Player 2',
      currentSpace: 'START-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
      projectScope: 0,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    },
    {
      id: 'player3',
      name: 'Player 3', 
      currentSpace: 'START-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
      projectScope: 0,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    }
  ];

  const mockGameState: GameState = {
    players: mockPlayers,
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 1,
    // Simplified turn tracking system
    globalTurnCount: 1,
    // Track individual player turn counts for statistics
    playerTurnCounts: { 'player1': 1, 'player2': 0, 'player3': 0 },
    activeModal: null,
    awaitingChoice: null,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    isGameOver: false,
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

  const mockPlayer: Player = mockPlayers[0];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create TurnService first without EffectEngineService to avoid circular dependency
    turnService = new TurnService(mockDataService, mockStateService, mockGameRulesService, mockCardService, mockResourceService, mockMovementService, mockNegotiationService as any, mockLoggingService);
    
    // Set EffectEngineService using setter injection to complete the circular dependency
    turnService.setEffectEngineService(mockEffectEngineService);
    
    // Setup default mock implementations
    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.setCurrentPlayer.mockReturnValue(mockGameState);
    mockStateService.advanceTurn.mockReturnValue(mockGameState);
    mockStateService.clearPlayerHasMoved.mockReturnValue(mockGameState);

    // Setup getPlayer to return the correct player from mockPlayers array
    mockStateService.getPlayer.mockImplementation(playerId =>
      mockPlayers.find(p => p.id === playerId) || null
    );

    // Setup movement service mocks for turn start logic
    mockMovementService.getValidMoves.mockReturnValue([]);
    mockMovementService.handleMovementChoiceV2.mockResolvedValue();
    
    // Setup default GameRulesService mock - no win by default
    mockGameRulesService.checkWinCondition.mockResolvedValue(false);
    mockGameRulesService.checkGameEndConditions.mockResolvedValue({ 
      shouldEnd: false, 
      reason: null, 
      winnerId: null 
    });
    
    // Setup default EffectEngineService mock - return successful BatchEffectResult
    mockEffectEngineService.processEffects.mockResolvedValue({
      success: true,
      totalEffects: 0,
      successfulEffects: 0,
      failedEffects: 0,
      results: [],
      errors: []
    });
    
    // Setup default for active effects processing
    mockEffectEngineService.processActiveEffectsForAllPlayers.mockResolvedValue();
  });

  describe('endTurn', () => {
    it('should advance from first player to second player', async () => {
      // Arrange - player1 is current player
      const gameState = { ...mockGameState, currentPlayerId: 'player1' };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act
      const result = await turnService.endTurn();

      // Assert
      expect(result.nextPlayerId).toBe('player2');
      expect(mockStateService.setCurrentPlayer).toHaveBeenCalledWith('player2');
      expect(mockStateService.advanceTurn).toHaveBeenCalled();
      expect(mockStateService.clearPlayerHasMoved).toHaveBeenCalled();
    });

    it('should advance from second player to third player', async () => {
      // Arrange - player2 is current player
      const gameState = { ...mockGameState, currentPlayerId: 'player2' };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act
      const result = await turnService.endTurn();

      // Assert
      expect(result.nextPlayerId).toBe('player3');
      expect(mockStateService.setCurrentPlayer).toHaveBeenCalledWith('player3');
    });

    it('should wrap around from last player to first player', async () => {
      // Arrange - player3 is current player (last player)
      const gameState = { ...mockGameState, currentPlayerId: 'player3' };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act
      const result = await turnService.endTurn();

      // Assert
      expect(result.nextPlayerId).toBe('player1');
      expect(mockStateService.setCurrentPlayer).toHaveBeenCalledWith('player1');
    });

    it('should work with two players', async () => {
      // Arrange - game with only two players
      const twoPlayerState = {
        ...mockGameState,
        players: [mockPlayers[0], mockPlayers[1]], // Only player1 and player2
        currentPlayerId: 'player1'
      };
      mockStateService.getGameState.mockReturnValue(twoPlayerState);

      // Act
      const result = await turnService.endTurn();

      // Assert
      expect(result.nextPlayerId).toBe('player2');
      expect(mockStateService.setCurrentPlayer).toHaveBeenCalledWith('player2');
    });

    it('should work with single player (wrap to self)', async () => {
      // Arrange - game with only one player
      const singlePlayerState = {
        ...mockGameState,
        players: [mockPlayers[0]], // Only player1
        currentPlayerId: 'player1'
      };
      mockStateService.getGameState.mockReturnValue(singlePlayerState);

      // Act
      const result = await turnService.endTurn();

      // Assert
      expect(result.nextPlayerId).toBe('player1');
      expect(mockStateService.setCurrentPlayer).toHaveBeenCalledWith('player1');
    });

    it('should throw error if game is not in PLAY phase', async () => {
      // Arrange
      const gameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act & Assert
      await expect(turnService.endTurn())
        .rejects.toThrow('Cannot end turn outside of PLAY phase');
      
      expect(mockStateService.setCurrentPlayer).not.toHaveBeenCalled();
    });

    it('should throw error if no current player', async () => {
      // Arrange
      const gameState = { ...mockGameState, currentPlayerId: null };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act & Assert
      await expect(turnService.endTurn())
        .rejects.toThrow('No current player to end turn for');
      
      expect(mockStateService.setCurrentPlayer).not.toHaveBeenCalled();
    });

    it('should throw error if no players in game', async () => {
      // Arrange
      const gameState = { ...mockGameState, players: [] };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act & Assert
      await expect(turnService.endTurn())
        .rejects.toThrow('No players in the game');
      
      expect(mockStateService.setCurrentPlayer).not.toHaveBeenCalled();
    });

    it('should throw error if current player not found in player list', async () => {
      // Arrange
      const gameState = { ...mockGameState, currentPlayerId: 'nonexistent' };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act & Assert
      await expect(turnService.endTurn())
        .rejects.toThrow('Current player not found in player list');
      
      expect(mockStateService.setCurrentPlayer).not.toHaveBeenCalled();
    });

    it('should call state service methods in correct order', async () => {
      // Arrange
      const callOrder: string[] = [];
      
      mockStateService.setCurrentPlayer.mockImplementation(() => {
        callOrder.push('setCurrentPlayer');
        return mockGameState;
      });
      
      mockStateService.advanceTurn.mockImplementation(() => {
        callOrder.push('advanceTurn');
        return mockGameState;
      });
      
      mockStateService.clearPlayerHasMoved.mockImplementation(() => {
        callOrder.push('clearPlayerHasMoved');
        return mockGameState;
      });

      // Act
      await turnService.endTurn();

      // Assert - advanceTurn is called BEFORE setCurrentPlayer (see TurnService.ts line 410-413)
      expect(callOrder).toEqual(['advanceTurn', 'setCurrentPlayer', 'clearPlayerHasMoved']);
    });

    it('should handle state service errors gracefully', async () => {
      // Arrange
      mockStateService.setCurrentPlayer.mockImplementation(() => {
        throw new Error('State service error');
      });

      // Act & Assert
      await expect(turnService.endTurn())
        .rejects.toThrow('State service error');
    });
  });

  describe('canPlayerTakeTurn', () => {
    it('should return true for current player in PLAY phase', () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(mockPlayers[0]);

      // Act
      const result = turnService.canPlayerTakeTurn('player1');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-current player', () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(mockPlayers[1]);

      // Act
      const result = turnService.canPlayerTakeTurn('player2');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if game is not in PLAY phase', () => {
      // Arrange
      const gameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(gameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayers[0]);

      // Act
      const result = turnService.canPlayerTakeTurn('player1');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if player does not exist', () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Act
      const result = turnService.canPlayerTakeTurn('nonexistent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getCurrentPlayerTurn', () => {
    it('should return current player ID', () => {
      // Act
      const result = turnService.getCurrentPlayerTurn();

      // Assert
      expect(result).toBe('player1');
    });

    it('should return null when no current player', () => {
      // Arrange
      const gameState = { ...mockGameState, currentPlayerId: null };
      mockStateService.getGameState.mockReturnValue(gameState);

      // Act
      const result = turnService.getCurrentPlayerTurn();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Space Effect Actions', () => {
    beforeEach(() => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockGameRulesService.checkWinCondition.mockResolvedValue(false);
      mockGameRulesService.checkGameEndConditions.mockResolvedValue({ 
        shouldEnd: false, 
        reason: null, 
        winnerId: null 
      });
    });

    it('should handle replace_e action', () => {
      // Arrange
      const playerWithCards = {
        ...mockPlayer,
        hand: ['E_old_1', 'E_old_2'] // Use hand property instead of cards
      };
      mockStateService.getPlayer.mockReturnValue(playerWithCards);
      
      const spaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First' as const,
        effect_type: 'cards' as const,
        effect_action: 'replace_e',
        effect_value: 1,
        condition: 'always',
        description: 'Replace 1 E card'
      };
      
      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);
      mockDataService.getDiceEffects.mockReturnValue([]);

      mockEffectEngineService.processEffects.mockImplementation(async (effects, context) => {
        // Get the player state that the service would be working with
        const player = mockStateService.getPlayer('player1');
        if (player) {
          // Simulate the card replacement by calling the StateService
          // Remove one old E card and add one new E card
          const oldCards = player.hand.filter(card => card !== 'E_old_1'); // Remove one old card
          mockStateService.updatePlayer({
            id: 'player1',
            hand: [...oldCards, 'E_001_TestCard'], // Add one new card in hand
          });
        }
        // Return a successful result
        return {
          success: true,
          totalEffects: effects.length,
          successfulEffects: effects.length,
          failedEffects: 0,
          results: [],
          errors: [],
        };
      });

      // Act
      const result = turnService.processTurnEffects('player1', 3);

      // Assert
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          hand: expect.arrayContaining([expect.stringMatching(/^E_\d+_/)]) // Should have 1 new E card in hand
        })
      );
    });

    it('should handle transfer action', () => {
      // Arrange
      const mockPlayersWithCards = [
        { ...mockPlayer, id: 'player1', name: 'Player 1', hand: ['W_1'] },
        { ...mockPlayer, id: 'player2', name: 'Player 2', hand: [] }
      ];
      
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: mockPlayersWithCards
      });
      // Ensure getPlayer returns the correct, updated player mock for this test
      mockStateService.getPlayer.mockImplementation(playerId => mockPlayersWithCards.find(p => p.id === playerId));
      
      const spaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First' as const,
        effect_type: 'cards' as const,
        effect_action: 'transfer',
        effect_value: 1,
        condition: 'to_right',
        description: 'Transfer 1 card to right player'
      };
      
      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);
      mockDataService.getDiceEffects.mockReturnValue([]);

      // Mock EffectEngineService to simulate card transfer between players
      mockEffectEngineService.processEffects.mockImplementation(async (effects, context) => {
        const sourcePlayer = mockStateService.getPlayer('player1');
        const targetPlayer = mockStateService.getPlayer('player2');
        
        if (sourcePlayer && targetPlayer && sourcePlayer.hand.length > 0) {
          const cardToTransfer = sourcePlayer.hand[0];
          
          // Update player1 (remove card from hand)
          mockStateService.updatePlayer({
            id: 'player1',
            hand: sourcePlayer.hand.filter(card => card !== cardToTransfer),
          });
          
          // Update player2 (add card to hand)
          mockStateService.updatePlayer({
            id: 'player2',
            hand: [...targetPlayer.hand, cardToTransfer],
          });
        }
        
        return {
          success: true,
          totalEffects: effects.length,
          successfulEffects: effects.length,
          failedEffects: 0,
          results: [],
          errors: [],
        };
      });

      // Act
      turnService.processTurnEffects('player1', 3);

      // Assert
      expect(mockStateService.updatePlayer).toHaveBeenCalledTimes(2); // Both players updated
    });

    it('should handle fee_percent action', () => {
      // Arrange
      const playerWithMoney = {
        ...mockPlayer,
        money: 1000
      };
      mockStateService.getPlayer.mockReturnValue(playerWithMoney);
      
      const spaceEffect = {
        space_name: 'TEST_SPACE',
        visit_type: 'First' as const,
        effect_type: 'money' as const,
        effect_action: 'fee_percent',
        effect_value: 5, // 5% fee
        condition: 'always',
        description: '5% fee'
      };
      
      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);
      mockDataService.getDiceEffects.mockReturnValue([]);

      // Mock EffectEngineService to simulate money reduction (5% fee)
      mockEffectEngineService.processEffects.mockImplementation(async (effects, context) => {
        const player = mockStateService.getPlayer('player1');
        
        if (player && player.money > 0) {
          const feeAmount = Math.floor(player.money * 0.05); // 5% fee
          const newMoney = player.money - feeAmount;
          
          // Update player with reduced money
          mockStateService.updatePlayer({
            id: 'player1',
            money: newMoney,
          });
        }
        
        return {
          success: true,
          totalEffects: effects.length,
          successfulEffects: effects.length,
          failedEffects: 0,
          results: [],
          errors: [],
        };
      });

      // Act
      turnService.processTurnEffects('player1', 3);

      // Assert
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          money: 950 // 1000 - (1000 * 5% = 50)
        })
      );
    });
  });

  describe('OWNER-FUND-INITIATION space funding logic', () => {
    beforeEach(() => {
      // Configure mockGameRulesService to properly evaluate scope conditions
      mockGameRulesService.calculateProjectScope.mockImplementation((playerId: string) => {
        const player = mockStateService.getPlayer(playerId);
        if (!player) return 0;

        // For these tests, use W cards from hand to calculate scope
        // Each W card represents $500k of scope
        const wCards = (player.hand || []).filter(cardId => cardId.startsWith('W'));
        return wCards.length * 500000;
      });

      mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
        if (!condition) return true;

        const conditionLower = condition.toLowerCase();

        // Evaluate scope conditions
        if (conditionLower === 'scope_le_4m') {
          const scope = mockGameRulesService.calculateProjectScope(playerId);
          return scope <= 4000000;
        }
        if (conditionLower === 'scope_gt_4m') {
          const scope = mockGameRulesService.calculateProjectScope(playerId);
          return scope > 4000000;
        }

        // Default: true for other conditions
        return true;
      });

      // Setup OWNER-FUND-INITIATION space effects
      mockDataService.getSpaceEffects.mockReturnValue([
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'time',
          effect_action: 'add',
          effect_value: 1,
          condition: 'always',
          description: '1 day for funding review',
          trigger_type: 'auto'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_b',
          effect_value: 1,
          condition: 'scope_le_4M',
          description: 'Draw 1 B card if scope ≤ $4M',
          trigger_type: 'auto'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_i',
          effect_value: 1,
          condition: 'scope_gt_4M',
          description: 'Draw 1 I card if scope > $4M',
          trigger_type: 'auto'
        }
      ]);

      mockDataService.getDiceEffects.mockReturnValue([]);
      mockDataService.getGameConfigBySpace.mockReturnValue(undefined);
      mockEffectEngineService.processEffects.mockResolvedValue({
        success: true,
        totalEffects: 1,
        successfulEffects: 1,
        failedEffects: 0,
        results: [],
        errors: []
      });
    });

    it('should award B card for project scope ≤ $4M', async () => {
      // Arrange - Player with project scope of $2M (4 W cards * $500k = $2M)
      const mockPlayer: Player = {
        id: 'player1',
        name: 'Test Player',
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        money: 1000,
        timeSpent: 0,
        projectScope: 2000000, // Deprecated field (not used)
        score: 0,
        color: '#ff0000',
        avatar: '👤',
        hand: ['W001', 'W002', 'W003', 'W004'], // 4 W cards = $2M scope
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      // Act
      await turnService.processTurnEffects('player1', 3);

      // Assert - Should process B card draw effect (not I card). Time effects now processed when leaving space.
      expect(mockEffectEngineService.processEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              cardType: 'B'
            })
          })
        ]),
        expect.any(Object)
      );

      // Should NOT include I card draw effect
      expect(mockEffectEngineService.processEffects).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              cardType: 'I'
            })
          })
        ]),
        expect.any(Object)
      );
    });

    it('should award I card for project scope > $4M', async () => {
      // Arrange - Player with project scope of $6M (12 W cards * $500k = $6M)
      const mockPlayer: Player = {
        id: 'player1',
        name: 'Test Player',
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        money: 1000,
        timeSpent: 0,
        projectScope: 6000000, // Deprecated field (not used)
        score: 0,
        color: '#ff0000',
        avatar: '👤',
        hand: ['W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008', 'W009', 'W010', 'W011', 'W012'], // 12 W cards = $6M scope
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      // Act
      await turnService.processTurnEffects('player1', 3);

      // Assert - Should process I card draw effect (not B card). Time effects now processed when leaving space.
      expect(mockEffectEngineService.processEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              cardType: 'I'
            })
          })
        ]),
        expect.any(Object)
      );

      // Should NOT include B card draw effect
      expect(mockEffectEngineService.processEffects).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              cardType: 'B'
            })
          })
        ]),
        expect.any(Object)
      );
    });

    it('should award B card for project scope exactly $4M', async () => {
      // Arrange - Player with project scope exactly $4M (edge case: 8 W cards * $500k = $4M)
      const mockPlayer: Player = {
        id: 'player1',
        name: 'Test Player',
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        money: 1000,
        timeSpent: 0,
        projectScope: 4000000, // Deprecated field (not used)
        score: 0,
        color: '#ff0000',
        avatar: '👤',
        hand: ['W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008'], // 8 W cards = exactly $4M
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      // Act
      await turnService.processTurnEffects('player1', 3);

      // Assert - Should get B card (≤ $4M condition)
      expect(mockEffectEngineService.processEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              cardType: 'B'
            })
          })
        ]),
        expect.any(Object)
      );
    });
  });
});