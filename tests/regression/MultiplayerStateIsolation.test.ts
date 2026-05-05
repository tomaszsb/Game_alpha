// tests/regression/MultiplayerStateIsolation.test.ts

/**
 * Regression Test: Multiplayer State Isolation Bug
 *
 * Bug Description (Dec 29, 2025):
 * When Player 1 finishes their turn and moves to a new space,
 * Player 2 also moves to the same space without taking any action.
 *
 * Test validates that:
 * - Each player has independent position state
 * - Player 1 movement does not affect Player 2 position
 * - Turn switching maintains correct player positions
 */

import { StateService } from '../../src/services/StateService';
import { DataService } from '../../src/services/DataService';
import { CardService } from '../../src/services/CardService';
import { LoggingService } from '../../src/services/LoggingService';
import { ChoiceService } from '../../src/services/ChoiceService';
import { EffectEngineService } from '../../src/services/EffectEngineService';
import { GameRulesService } from '../../src/services/GameRulesService';
import { MovementService } from '../../src/services/MovementService';
import { ResourceService } from '../../src/services/ResourceService';
import { TurnService } from '../../src/services/TurnService';
import { NegotiationService } from '../../src/services/NegotiationService';
import { TargetingService } from '../../src/services/TargetingService';
import { IDataService, IStateService } from '../../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';

// Node.js compatible DataService for testing
class NodeDataService extends DataService {
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;

    try {
      const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');

      const gameConfigCsv = readFileSync(join(dataDir, 'GAME_CONFIG.csv'), 'utf-8');
      const movementCsv = readFileSync(join(dataDir, 'MOVEMENT.csv'), 'utf-8');
      const diceOutcomesCsv = readFileSync(join(dataDir, 'DICE_OUTCOMES.csv'), 'utf-8');
      const spaceEffectsCsv = readFileSync(join(dataDir, 'SPACE_EFFECTS.csv'), 'utf-8');
      const diceEffectsCsv = readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8');
      const spaceContentsCsv = readFileSync(join(dataDir, 'SPACE_CONTENT.csv'), 'utf-8');
      const cardsCsv = readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8');

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
      throw error;
    }
  }
}

describe('Multiplayer State Isolation', () => {
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
  let loggingService: LoggingService;

  let player1Id: string;
  let player2Id: string;

  beforeEach(async () => {
    // Create services in dependency order
    dataService = new NodeDataService();
    await dataService.loadData();

    stateService = new StateService(dataService);
    loggingService = new LoggingService(stateService);
    resourceService = new ResourceService(stateService);
    choiceService = new ChoiceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
    movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService);
    targetingService = new TargetingService(stateService, choiceService);

    const tempEffectEngine = new EffectEngineService(
      resourceService, cardService, choiceService, stateService,
      movementService, undefined as any, undefined as any,
      targetingService, loggingService
    );
    negotiationService = new NegotiationService(stateService, tempEffectEngine);

    turnService = new TurnService(
      dataService, stateService, gameRulesService, cardService,
      resourceService, movementService, negotiationService, loggingService, choiceService
    );

    effectEngineService = new EffectEngineService(
      resourceService, cardService, choiceService, stateService,
      movementService, turnService, gameRulesService,
      targetingService, loggingService
    );

    turnService.setEffectEngineService(effectEngineService);
    cardService.setEffectEngineService(effectEngineService);

    // Initialize 2 players
    stateService.addPlayer('Player1');
    stateService.addPlayer('Player2');

    // Capture player IDs before game start
    const players = stateService.getGameState().players;
    player1Id = players.find(p => p.name === 'Player1')!.id;
    player2Id = players.find(p => p.name === 'Player2')!.id;
  });

  describe('Player position independence', () => {
    it('should have separate currentSpace for each player at game start', async () => {
      // Start game
      stateService.startGame();

      const gameState = stateService.getGameState();
      const player1 = gameState.players.find(p => p.id === player1Id)!;
      const player2 = gameState.players.find(p => p.id === player2Id)!;

      // Both should be at starting space
      expect(player1.currentSpace).toBe('OWNER-SCOPE-INITIATION');
      expect(player2.currentSpace).toBe('OWNER-SCOPE-INITIATION');

      // Verify they are separate objects
      expect(player1).not.toBe(player2);
      expect(player1.id).not.toBe(player2.id);
    });

    it('should NOT change Player2 position when Player1 moves', async () => {
      // Start game
      stateService.startGame();

      // Get initial positions
      let gameState = stateService.getGameState();
      const startingSpace = gameState.players.find(p => p.id === player1Id)!.currentSpace;

      console.log('Starting positions:');
      console.log('  Player1:', gameState.players.find(p => p.id === player1Id)!.currentSpace);
      console.log('  Player2:', gameState.players.find(p => p.id === player2Id)!.currentSpace);

      // Get valid moves for Player1
      const validMoves = movementService.getValidMoves(player1Id);
      console.log('Valid moves for Player1:', validMoves);

      // Player1 moves to first valid destination
      if (validMoves.length > 0) {
        const destination = validMoves[0];
        console.log('Moving Player1 to:', destination);

        await movementService.movePlayer(player1Id, destination);

        // Get updated state
        gameState = stateService.getGameState();
        const player1After = gameState.players.find(p => p.id === player1Id)!;
        const player2After = gameState.players.find(p => p.id === player2Id)!;

        console.log('After Player1 move:');
        console.log('  Player1:', player1After.currentSpace);
        console.log('  Player2:', player2After.currentSpace);

        // CRITICAL: Player1 should be at new position
        expect(player1After.currentSpace).toBe(destination);

        // CRITICAL: Player2 should still be at starting space
        expect(player2After.currentSpace).toBe(startingSpace);
        expect(player2After.currentSpace).not.toBe(destination);
      }
    });

    it('should NOT change Player2 position during full turn cycle', async () => {
      // Start game
      stateService.startGame();

      // Get starting space
      let gameState = stateService.getGameState();
      const startingSpace = gameState.players.find(p => p.id === player1Id)!.currentSpace;

      // Verify Player1 is current player
      expect(gameState.currentPlayerId).toBe(player1Id);

      console.log('\n=== Turn 1 Start ===');
      console.log('Current player:', gameState.currentPlayerId);
      console.log('Player1 position:', gameState.players.find(p => p.id === player1Id)!.currentSpace);
      console.log('Player2 position:', gameState.players.find(p => p.id === player2Id)!.currentSpace);

      // Set a move intent for Player1
      const validMoves = movementService.getValidMoves(player1Id);
      if (validMoves.length > 0) {
        const destination = validMoves[0];
        stateService.setPlayerMoveIntent(player1Id, destination);

        console.log('\nPlayer1 move intent set to:', destination);

        // Force complete Player1's turn (skip action requirements for test)
        // Directly call movePlayer to simulate movement
        await movementService.movePlayer(player1Id, destination);

        console.log('\n=== After Player1 Move ===');
        gameState = stateService.getGameState();
        console.log('Player1 position:', gameState.players.find(p => p.id === player1Id)!.currentSpace);
        console.log('Player2 position:', gameState.players.find(p => p.id === player2Id)!.currentSpace);

        // Now switch to Player2
        stateService.setCurrentPlayer(player2Id);

        console.log('\n=== After Switch to Player2 ===');
        gameState = stateService.getGameState();
        console.log('Current player:', gameState.currentPlayerId);
        console.log('Player1 position:', gameState.players.find(p => p.id === player1Id)!.currentSpace);
        console.log('Player2 position:', gameState.players.find(p => p.id === player2Id)!.currentSpace);

        const player1Final = gameState.players.find(p => p.id === player1Id)!;
        const player2Final = gameState.players.find(p => p.id === player2Id)!;

        // CRITICAL ASSERTIONS
        expect(player1Final.currentSpace).toBe(destination);
        expect(player2Final.currentSpace).toBe(startingSpace);
        expect(player2Final.currentSpace).not.toBe(player1Final.currentSpace);
      }
    });

    it('should maintain separate state when accessing players array', () => {
      // Add players
      stateService.addPlayer('TestA');
      stateService.addPlayer('TestB');

      const gameState = stateService.getGameState();
      const players = gameState.players;

      // Get players by index
      const testA = players.find(p => p.name === 'TestA')!;
      const testB = players.find(p => p.name === 'TestB')!;

      // Verify they are separate objects
      expect(testA).not.toBe(testB);

      // Modify one player's position (directly on the returned object - should NOT affect state)
      const originalSpaceA = testA.currentSpace;
      testA.currentSpace = 'MODIFIED-TEST-SPACE';

      // Get fresh state
      const freshState = stateService.getGameState();
      const freshTestA = freshState.players.find(p => p.name === 'TestA')!;

      // The state should be immutable - mutation should not have affected it
      // If this fails, there's a reference leak
      expect(freshTestA.currentSpace).toBe(originalSpaceA);
    });
  });

  describe('State service player update isolation', () => {
    it('should only update the specified player', () => {
      stateService.addPlayer('TestA');
      stateService.addPlayer('TestB');

      const players = stateService.getGameState().players;
      const testAId = players.find(p => p.name === 'TestA')!.id;
      const testBId = players.find(p => p.name === 'TestB')!.id;

      // Update TestA's position
      stateService.updatePlayer({
        id: testAId,
        currentSpace: 'NEW-SPACE-A'
      });

      // Verify only TestA was updated
      const gameState = stateService.getGameState();
      const testA = gameState.players.find(p => p.id === testAId)!;
      const testB = gameState.players.find(p => p.id === testBId)!;

      expect(testA.currentSpace).toBe('NEW-SPACE-A');
      expect(testB.currentSpace).toBe('OWNER-SCOPE-INITIATION'); // Should be unchanged
    });

    it('should not share array references between players', () => {
      stateService.addPlayer('TestA');
      stateService.addPlayer('TestB');

      const players = stateService.getGameState().players;
      const testA = players.find(p => p.name === 'TestA')!;
      const testB = players.find(p => p.name === 'TestB')!;

      // Check that arrays are separate
      expect(testA.hand).not.toBe(testB.hand);
      expect(testA.visitedSpaces).not.toBe(testB.visitedSpaces);
      expect(testA.activeCards).not.toBe(testB.activeCards);
      expect(testA.loans).not.toBe(testB.loans);
    });
  });
});
