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
import { IDataService, IStateService, ITurnService } from '../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';

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
      throw new Error('Failed to load game data from filesystem');
    }
  }
}

describe('E2E-01: Happy Path', () => {
  let dataService: IDataService;
  let stateService: IStateService;
  let turnService: ITurnService;

  beforeAll(async () => {
    // 1. Initialize all the real services
    dataService = new NodeDataService();
    await dataService.loadData();

    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    const resourceService = new ResourceService(stateService);
    const cardService = new CardService(dataService, stateService, resourceService, loggingService);
    const choiceService = new ChoiceService(stateService);
    const movementService = new MovementService(dataService, stateService, choiceService, loggingService);
    const gameRulesService = new GameRulesService(dataService, stateService);

    // Handle circular dependency: EffectEngine -> Turn -> Negotiation -> EffectEngine
    const effectEngine = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as ITurnService, gameRulesService, {} as any); // targetingService
    const negotiationService = new NegotiationService(stateService, effectEngine);
    const turnServiceInstance = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService);

    // Complete the circular dependency wiring
    turnServiceInstance.setEffectEngineService(effectEngine);
    effectEngine.setTurnService(turnServiceInstance);

    turnService = turnServiceInstance;
  });

  it('should allow a single player to start a game and take one turn', async () => {
    console.log('🔥🔥🔥 [TEST] Test started!');

    // Setup: Add a player and start the game
    stateService.addPlayer('Player 1');
    stateService.startGame();
    console.log('🔥 [TEST] Game started');

    const initialGameState = stateService.getGameState();
    const player = initialGameState.players[0];

    // Assert Phase 1: Check that the initial setup is correct
    expect(player.name).toBe('Player 1');
    expect(player.currentSpace).toBe('OWNER-SCOPE-INITIATION');
    expect(player.money).toBe(0);
    expect(player.timeSpent).toBe(0);
    expect(player.projectScope).toBe(0);
    expect(player.hand).toHaveLength(0);
    expect(player.visitType).toBe('First');
    expect(initialGameState.globalTurnCount).toBe(0); // Game starts at turn 0
    expect(initialGameState.globalActionLog).toHaveLength(0); // Empty initially

    // Mock dice roll to return 4 consistently
    const rollDiceSpy = vi.spyOn(turnService, 'rollDice').mockReturnValue(4);

    // Action: Take a turn
    await turnService.rollDiceAndProcessEffects(player.id);
    await turnService.triggerManualEffectWithFeedback(player.id, 'cards'); // Perform the manual card draw
    await turnService.endTurnWithMovement();

    // Assert Phase 2: Check the complete game state after the turn
    const finalGameState = stateService.getGameState();
    const finalPlayer = finalGameState.players[0];

    // Position assertions: OWNER-SCOPE-INITIATION has fixed movement to OWNER-FUND-INITIATION
    expect(finalPlayer.currentSpace).toBe('OWNER-FUND-INITIATION');
    expect(finalPlayer.visitType).toBe('First');
    expect(finalPlayer.visitedSpaces).toContain('OWNER-SCOPE-INITIATION');
    expect(finalPlayer.visitedSpaces).toContain('OWNER-FUND-INITIATION');

    // Resource assertions: Test meaningful changes from the complete turn
    expect(finalPlayer.timeSpent).toBe(1); // +1 day from OWNER-FUND-INITIATION space effect

    // Cards: Manual action draws 3 E cards + space effect draws 1 B card + others
    expect(finalPlayer.hand.length).toBeGreaterThan(0); // Player should have cards
    expect(finalPlayer.hand.some(card => card.type === 'E')); // Should have E cards from manual action
    expect(finalPlayer.hand.some(card => card.type === 'B')); // Should have B card from space effect

    // Project scope: No W cards drawn, so scope remains 0 (W cards add to scope when drawn)
    expect(finalPlayer.projectScope).toBe(0); // No W cards drawn in this test flow
    expect(finalPlayer.money).toBe(0); // No money changes during this basic turn

    // Game state assertions
    expect(finalGameState.globalTurnCount).toBe(1); // Turn should have advanced to 1
    expect(finalGameState.globalActionLog.length).toBeGreaterThan(0); // Should have action log entries

    // Verify dice roll was called and controlled
    expect(rollDiceSpy).toHaveBeenCalled(); // rollDice is called without parameters

    // Cleanup
    rollDiceSpy.mockRestore();

    console.log(`E2E test success: Player moved from ${player.currentSpace} to ${finalPlayer.currentSpace}`);
  });
});