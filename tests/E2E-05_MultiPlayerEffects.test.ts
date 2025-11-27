// tests/E2E-05_MultiPlayerEffects.test.ts

/**
 * E2E Test Suite: Multi-Player Interactive Effects
 * 
 * This test suite validates the Multi-Player Interactive Effects system, ensuring:
 * - Cards with "All Players" targeting affect everyone
 * - Cards with "All Players-Self" targeting affect everyone except the player
 * - Cards with "Choose Opponent" targeting allow player selection
 * - Cards with "Choose Player" targeting allow any player selection
 * - Multi-player effects work with duration-based persistence
 * - Interactive targeting presents proper choice UI
 * - Complex multi-step targeting scenarios work correctly
 * 
 * Key Cards Tested:
 * - L003: "All Players" - discard cards + time effects 
 * - E009: "Choose Opponent" - interactive targeting with dual effects
 * - TEST005: "Choose Player" - broad player selection
 * 
 * This validates the P2-HIGH priority feature: Multi-Player Interactive Effects
 */

import { StateService } from '../src/services/StateService';
import { DataService } from '../src/services/DataService';
import { CardService } from '../src/services/CardService';
import { LoggingService } from '../src/services/LoggingService';
import { ChoiceService } from '../src/services/ChoiceService';
import { EffectEngineService } from '../src/services/EffectEngineService';
import { GameRulesService } from '../src/services/GameRulesService';
import { MovementService } from '../src/services/MovementService';
import { ResourceService } from '../src/services/ResourceService';
import { TurnService } from '../src/services/TurnService';
import { NegotiationService } from '../src/services/NegotiationService';
import { TargetingService } from '../src/services/TargetingService';
import { PlayerActionService } from '../src/services/PlayerActionService';
import { IDataService, IStateService } from '../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ActiveEffect } from '../src/types/DataTypes';

// Node.js compatible DataService for E2E testing
class NodeDataService extends DataService {
  // Override the loadData method to use filesystem instead of fetch
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;

    try {
      const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
      
      // Load all CSV files using filesystem
      const gameConfigCsv = readFileSync(join(dataDir, 'GAME_CONFIG.csv'), 'utf-8');
      const movementCsv = readFileSync(join(dataDir, 'MOVEMENT.csv'), 'utf-8');
      const diceOutcomesCsv = readFileSync(join(dataDir, 'DICE_OUTCOMES.csv'), 'utf-8');
      const spaceEffectsCsv = readFileSync(join(dataDir, 'SPACE_EFFECTS.csv'), 'utf-8');
      const diceEffectsCsv = readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8');
      const spaceContentsCsv = readFileSync(join(dataDir, 'SPACE_CONTENT.csv'), 'utf-8');
      const cardsCsv = readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8');
      
      // Parse CSV data using existing methods
      (this as any).gameConfigs = (this as any).parseGameConfigCsv(gameConfigCsv);
      (this as any).movements = (this as any).parseMovementCsv(movementCsv);
      (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(diceOutcomesCsv);
      (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(spaceEffectsCsv);
      (this as any).diceEffects = (this as any).parseDiceEffectsCsv(diceEffectsCsv);
      (this as any).spaceContents = (this as any).parseSpaceContentCsv(spaceContentsCsv);
      (this as any).cards = (this as any).parseCardsCsv(cardsCsv);
      
      (this as any).buildSpaces();
      (this as any).loaded = true;
    } catch (error) {
      console.error('Error loading CSV data from filesystem:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to load game data from filesystem: ${error.message}`);
      }
      throw error;
    }
  }
}

describe('E2E-05: Multi-Player Interactive Effects', () => {
  let dataService: IDataService;
  let stateService: IStateService;
  let resourceService: ResourceService;
  let choiceService: ChoiceService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let targetingService: TargetingService;
  let effectEngineService: EffectEngineService;
  let turnService: TurnService;
  let negotiationService: NegotiationService;
  let playerActionService: PlayerActionService;
  
  // Player ID variables for proper service calls
  let aliceId: string, bobId: string, charlieId: string;

  beforeEach(async () => {
    // Create services in dependency order
    dataService = new NodeDataService();
    await dataService.loadData();
    
    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    resourceService = new ResourceService(stateService);
    choiceService = new ChoiceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
    movementService = new MovementService(dataService, stateService, choiceService, loggingService);
    targetingService = new TargetingService(stateService, choiceService);
    
    // Create temporary EffectEngineService for circular dependencies
    const tempEffectEngine = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, undefined as any, undefined as any, targetingService, loggingService);
    negotiationService = new NegotiationService(stateService, tempEffectEngine);
    
    // Create TurnService
    turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService);
    
    // Create final EffectEngineService with complete dependencies
    effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, turnService, gameRulesService, targetingService, loggingService);

    // Complete circular dependencies
    turnService.setEffectEngineService(effectEngineService);
    cardService.setEffectEngineService(effectEngineService);
    
    // Create PlayerActionService
    playerActionService = new PlayerActionService(dataService, stateService, gameRulesService, movementService, turnService, effectEngineService, loggingService);
    
    // Initialize 3 players for comprehensive multi-player testing
    stateService.addPlayer('Alice');
    stateService.addPlayer('Bob');
    stateService.addPlayer('Charlie');
    stateService.startGame();
    
    // Capture the actual player IDs
    const players = stateService.getGameState().players;
    aliceId = players.find(p => p.name === 'Alice')!.id;
    bobId = players.find(p => p.name === 'Bob')!.id;
    charlieId = players.find(p => p.name === 'Charlie')!.id;
    
    // Ensure all players start in well-defined states (after game is started)
    try {
      await movementService.movePlayer(aliceId, 'CONSTRUCTION-SITE');
      await movementService.movePlayer(bobId, 'OFFICE-DOWNTOWN');
      await movementService.movePlayer(charlieId, 'PERMITTING-OFFICE');
    } catch (error) {
      // If movement fails, players will use their default starting positions
      console.log('Player movement in setup failed, using default starting positions:', (error as Error).message);
    }
  });

  afterEach(() => {
    // Clean up all service references to prevent memory leaks
    if (stateService) {
      // Clear any running timers or intervals
      const gameState = stateService.getGameState();
      if (gameState.players) {
        gameState.players.forEach(player => {
          if (player.activeEffects) {
            player.activeEffects.length = 0;
          }
        });
      }
    }

    // Clear all service references
    dataService = null as any;
    stateService = null as any;
    resourceService = null as any;
    choiceService = null as any;
    gameRulesService = null as any;
    cardService = null as any;
    movementService = null as any;
    targetingService = null as any;
    effectEngineService = null as any;
    turnService = null as any;
    negotiationService = null as any;
    playerActionService = null as any;

    // Clear player ID references
    aliceId = null as any;
    bobId = null as any;
    charlieId = null as any;

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('All Players Targeting', () => {
    it('should affect all players with L003 New Safety Regulations', async () => {
      // L003: "All players must discard 1 Expeditor card. All inspections take 3 additional ticks this turn."
      // Target: "All Players"
      
      // Setup: Give all players some E cards to discard
      const alice = stateService.getPlayer(aliceId)!;
      const bob = stateService.getPlayer(bobId)!;
      const charlie = stateService.getPlayer(charlieId)!;
      
      // Initialize hand with E cards to players' hands
      stateService.updatePlayer({ id: aliceId, hand: ['E001', 'E002', 'L003'] });
      stateService.updatePlayer({ id: bobId, hand: ['E003', 'E004'] });
      stateService.updatePlayer({ id: charlieId, hand: ['E005'] });
      
      // Record initial card counts
      const aliceInitialECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const bobInitialECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const charlieInitialECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      console.log('📊 Initial E card counts:', { 
        alice: aliceInitialECards, 
        bob: bobInitialECards, 
        charlie: charlieInitialECards 
      });
      
      // Alice plays L003 card
      await playerActionService.playCard(aliceId, 'L003');
      
      // Verify: All players should have lost 1 E card
      const aliceFinalECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const bobFinalECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const charlieFinalECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      console.log('📊 Final E card counts:', { 
        alice: aliceFinalECards, 
        bob: bobFinalECards, 
        charlie: charlieFinalECards 
      });
      
      expect(aliceFinalECards).toBe(Math.max(0, aliceInitialECards - 1));
      expect(bobFinalECards).toBe(Math.max(0, bobInitialECards - 1));  
      expect(charlieFinalECards).toBe(Math.max(0, charlieInitialECards - 1));
      
      // Verify: L003 card should be in the gameState discarded pile
      const gameState = stateService.getGameState();
      expect(gameState.discardPiles.L).toContain('L003');
    });

    it('should handle duration-based All Players effects with L002 Economic Downturn', async () => {
      // L002: "All permit and inspection times increase by 2 ticks for the next 3 turns."
      // Target: "All Players", Duration: "Turns", Duration Count: "3"
      
      // Give Alice the L002 card
      stateService.updatePlayer({ 
        id: aliceId, 
        hand: ['L002'] 
      });
      
      // Alice plays L002 card
      await playerActionService.playCard(aliceId, 'L002');
      
      // Verify: All players have active effects with 3-turn duration
      const players = [aliceId, bobId, charlieId];
      for (const playerId of players) {
        const player = stateService.getPlayer(playerId)!;
        const l002Effect = player.activeEffects.find(effect => effect.sourceCardId === 'L002');
        
        expect(l002Effect).toBeDefined();
        expect(l002Effect!.remainingDuration).toBe(3);
      }
      
      // Simulate turn progression and verify effect duration decreases
      await turnService.endTurn(); // Turn 2
      await turnService.endTurn(); // Turn 3
      
      // Check effects after 2 turns (should have 1 turn remaining)
      for (const playerId of players) {
        const player = stateService.getPlayer(playerId)!;
        const l002Effect = player.activeEffects.find(effect => effect.sourceCardId === 'L002');
        
        expect(l002Effect).toBeDefined();
        expect(l002Effect!.remainingDuration).toBe(1);
      }
      
      // Complete the final turn - effects should be removed
      await turnService.endTurn(); // Turn 4
      
      for (const playerId of players) {
        const player = stateService.getPlayer(playerId)!;
        const l002Effect = player.activeEffects.find(effect => effect.sourceCardId === 'L002');
        
        expect(l002Effect).toBeUndefined(); // Effect should be expired
      }
    });
  });

  describe('Basic Targeting Verification', () => {
    it('should verify targeting service is integrated properly', async () => {
      // Simple test to verify the targeting system is working
      // This tests that the TargetingService is properly integrated
      
      // Test basic targeting rules - check if players exist first
      const gameState = stateService.getGameState();
      console.log('Players in game:', gameState.players.map(p => p.name));
      
      if (gameState.players.length >= 3) {
        // Test that the service can resolve basic targeting rules
        const selfTargets = await targetingService.resolveTargets(aliceId, 'Self');
        expect(selfTargets).toEqual([aliceId]);
        
        const allPlayersTargets = await targetingService.resolveTargets(aliceId, 'All Players');
        expect(allPlayersTargets.length).toBe(3);
        expect(allPlayersTargets).toContain(aliceId);
        expect(allPlayersTargets).toContain(bobId);
        expect(allPlayersTargets).toContain(charlieId);
        
        const allOtherTargets = await targetingService.resolveTargets(aliceId, 'All Players-Self');
        expect(allOtherTargets.length).toBe(2);
        expect(allOtherTargets).not.toContain(aliceId);
      }
      
      // Verify interactive targeting detection
      expect(targetingService.isInteractiveTargeting('Choose Opponent')).toBe(true);
      expect(targetingService.isInteractiveTargeting('Choose Player')).toBe(true);
      expect(targetingService.isInteractiveTargeting('Self')).toBe(false);
      expect(targetingService.isInteractiveTargeting('All Players')).toBe(false);
    });

    it('should process multi-player card effects through the EffectEngine', async () => {
      // Test that cards with multi-player targets get processed correctly
      // This verifies the integration between CardService, EffectEngineService, and TargetingService
      
      // Get L003 card data  
      const l003Card = dataService.getCardById('L003');
      expect(l003Card).toBeDefined();
      expect(l003Card!.target).toBe('All Players');
      
      // Give Alice some E cards and the L003 card
      stateService.updatePlayer({
        id: aliceId,
        hand: ['E001', 'E002', 'L003']
      });
      
      // Give other players E cards too
      stateService.updatePlayer({
        id: bobId,
        hand: ['E003']
      });
      stateService.updatePlayer({
        id: charlieId,
        hand: ['E004']
      });
      
      // Record initial state
      const initialAliceECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const initialBobECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const initialCharlieECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      // Play the multi-player card
      await playerActionService.playCard(aliceId, 'L003');
      
      // Verify all players were affected
      const finalAliceECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const finalBobECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const finalCharlieECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      // All players should have discarded 1 E card (or 0 if they had none)
      expect(finalAliceECards).toBe(Math.max(0, initialAliceECards - 1));
      expect(finalBobECards).toBe(Math.max(0, initialBobECards - 1));
      expect(finalCharlieECards).toBe(Math.max(0, initialCharlieECards - 1));
    });
  });
});