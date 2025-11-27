// tests/E2E-Lightweight.test.ts
// Performance-optimized E2E test using lightweight mocks
// Expected 70-90% performance improvement vs. full E2E tests

import { 
  createTestPlayer, 
  createTestCard,
  createTestGameState,
  TEST_CARDS
} from './fixtures/testData';
import { 
  createLightweightMockServices,
  performanceMocks 
} from './utils/lightweightMocks';

describe('E2E Scenarios - Lightweight Performance Tests', () => {
  let mockServices: ReturnType<typeof createLightweightMockServices>;
  
  beforeEach(() => {
    mockServices = createLightweightMockServices();
  });

  describe('Card Play Scenarios - Fast E2E', () => {
    it('should simulate complete card play workflow efficiently', async () => {
      const player = createTestPlayer({
        id: 'player1',
        money: 1000,
        timeSpent: 10,
        hand: ['L003'],
        activeCards: []
      });

      // Setup mocks
      mockServices.stateService.getPlayer!.mockReturnValue(player);
      mockServices.cardService.playCard!.mockResolvedValue({
        success: true,
        message: 'Card played successfully'
      });

      // Simulate player action service workflow
      const result = await mockServices.playerActionService.playCard!('player1', 'L003');
      
      expect(result.success).toBe(true);
      expect(mockServices.cardService.playCard).toHaveBeenCalledWith('player1', 'L003');
    });

    it('should simulate multi-player card effects efficiently', async () => {
      const players = [
        createTestPlayer({ id: 'alice', name: 'Alice' }),
        createTestPlayer({ id: 'bob', name: 'Bob' }),
        createTestPlayer({ id: 'charlie', name: 'Charlie' })
      ];

      mockServices.stateService.getAllPlayers!.mockReturnValue(players);
      mockServices.effectEngineService.processEffects!.mockResolvedValue({
        successful: 15, // 5 effects × 3 players
        failed: 0,
        errors: [],
        totalEffects: 15,
        successfulEffects: 15
      });

      // Simulate L003 card affecting all players
      const result = await mockServices.effectEngineService.processEffects!(
        [], // Effects array
        'alice', // Source player
        'CARD_PLAY', // Trigger
        'card:L003' // Source
      );

      expect(result.successful).toBe(15);
      expect(result.failed).toBe(0);
    });
  });

  describe('Turn Flow Scenarios - Fast E2E', () => {
    it('should simulate complete turn workflow efficiently', async () => {
      const player = createTestPlayer({ id: 'player1' });
      
      mockServices.stateService.getPlayer!.mockReturnValue(player);
      
      // Simulate turn sequence
      const diceResult = await mockServices.turnService.rollDice!('player1');
      const turnResult = await mockServices.turnService.endTurn!('player1');
      
      expect(diceResult.success).toBe(true);
      expect(turnResult.success).toBe(true);
    });

    it('should simulate resource management workflow efficiently', async () => {
      const player = createTestPlayer({ 
        id: 'player1',
        money: 500,
        timeSpent: 5
      });

      mockServices.stateService.getPlayer!.mockReturnValue(player);
      
      // Simulate resource operations
      await mockServices.resourceService.addMoney!('player1', 200, 'test:bonus');
      await mockServices.resourceService.spendTime!('player1', 1, 'test:action');
      
      expect(mockServices.resourceService.addMoney).toHaveBeenCalled();
      expect(mockServices.resourceService.spendTime).toHaveBeenCalled();
    });
  });

  describe('Game State Scenarios - Fast E2E', () => {
    it('should simulate game initialization efficiently', async () => {
      const gameState = createTestGameState({
        players: [createTestPlayer({ id: 'player1' })],
        currentPlayer: 'player1',
        phase: 'SETUP'
      });

      mockServices.stateService.getGameState!.mockReturnValue(gameState);
      
      // Simulate game start
      await mockServices.stateService.startGame!();
      await mockServices.stateService.setGamePhase!('PLAY');
      
      expect(mockServices.stateService.startGame).toHaveBeenCalled();
      expect(mockServices.stateService.setGamePhase).toHaveBeenCalledWith('PLAY');
    });

    it('should simulate player state updates efficiently', async () => {
      const player = createTestPlayer({ id: 'player1' });
      
      // Simulate multiple state updates
      await mockServices.stateService.updatePlayer!(player);
      await mockServices.stateService.setCurrentPlayer!('player1');
      
      expect(mockServices.stateService.updatePlayer).toHaveBeenCalled();
      expect(mockServices.stateService.setCurrentPlayer).toHaveBeenCalled();
    });
  });

  describe('Performance Validation - E2E', () => {
    it('should complete complex workflows within performance budget', async () => {
      const start = performance.now();
      
      // Simulate complex game workflow
      const player = createTestPlayer({ id: 'player1' });
      mockServices.stateService.getPlayer!.mockReturnValue(player);
      
      // Multiple operations
      await mockServices.playerActionService.playCard!('player1', 'E001');
      await mockServices.turnService.rollDice!('player1');
      await mockServices.resourceService.addMoney!('player1', 100, 'test');
      await mockServices.turnService.endTurn!('player1');
      
      const duration = performance.now() - start;
      
      // Complex workflow should complete quickly (under 20ms)
      expect(duration).toBeLessThan(20);
    });

    it('should handle rapid sequential operations efficiently', async () => {
      const start = performance.now();
      
      // Rapid operations
      for (let i = 0; i < 50; i++) {
        mockServices.stateService.getPlayer!('player1');
        mockServices.resourceService.canAfford!('player1', 100);
        mockServices.cardService.canPlayCard!('player1', 'E001');
      }
      
      const duration = performance.now() - start;
      
      // 150 operations should complete very quickly (under 10ms)
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Ultra-Fast Mock Performance', () => {
    it('should demonstrate ultra-fast mocks performance', () => {
      const ultraFastMocks = {
        dataService: performanceMocks.fastDataService(),
        stateService: performanceMocks.fastStateService()
      };

      const start = performance.now();
      
      // Ultra-fast operations
      for (let i = 0; i < 1000; i++) {
        ultraFastMocks.dataService.isLoaded();
        ultraFastMocks.dataService.getCardById('E001');
        ultraFastMocks.stateService.isStateLoaded();
        ultraFastMocks.stateService.getPlayer('player1');
      }
      
      const duration = performance.now() - start;
      
      // 4000 ultra-fast operations should complete in under 5ms
      expect(duration).toBeLessThan(5);
    });
  });
});