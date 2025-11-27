import { describe, it, expect, beforeAll, vi } from 'vitest';
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
import { PlayerActionService } from '../src/services/PlayerActionService';
import { NegotiationService } from '../src/services/NegotiationService';
import { ITurnService } from '../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';

// Node.js compatible DataService for E2E testing
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
      throw new Error('Failed to load game data from filesystem');
    }
  }
}

describe('E2E-04: Space Try Again Logic', () => {
  let dataService: DataService;
  let stateService: StateService;
  let turnService: TurnService;

  beforeAll(async () => {
    // Initialize services
    dataService = new NodeDataService();
    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    const resourceService = new ResourceService(stateService);
    const choiceService = new ChoiceService(stateService);
    const gameRulesService = new GameRulesService(dataService, stateService);
    const cardService = new CardService(dataService, stateService, resourceService, loggingService);
    const movementService = new MovementService(dataService, stateService, choiceService, loggingService);
    
    // Handle circular dependency: EffectEngine -> Turn -> Negotiation -> EffectEngine
    const effectEngine = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as ITurnService, gameRulesService, {} as any); // targetingService
    const negotiationService = new NegotiationService(stateService, effectEngine);
    const turnServiceInstance = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService);

    // Complete the circular dependency wiring
    turnServiceInstance.setEffectEngineService(effectEngine);
    effectEngine.setTurnService(turnServiceInstance);
    
    turnService = turnServiceInstance;

    await dataService.loadData();
  });

  it('should revert state, apply penalty, and reset the current turn', async () => {
    // 1. Setup: Create two players
    stateService.resetGame();
    stateService.addPlayer('Player A');
    stateService.addPlayer('Player B');
    stateService.startGame();

    // Mark as initialized so we can test the Try Again logic specifically
    stateService.markAsInitialized();

    const players = stateService.getGameState().players;
    const playerA = players[0];
    const playerB = players[1];
    expect(stateService.getGameState().currentPlayerId).toBe(playerA.id);

    // Place Player A on a negotiable space
    stateService.updatePlayer({ 
      id: playerA.id, 
      currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First'
    });

    // 2. Save Snapshot
    stateService.savePreSpaceEffectSnapshot(playerA.id, 'OWNER-SCOPE-INITIATION');
    const snapshotTime = stateService.getPlayer(playerA.id)!.timeSpent;

    // 3. Mutate State (to prove revert works)
    stateService.updatePlayer({ id: playerA.id, money: 1000 });
    expect(stateService.getPlayer(playerA.id)!.money).toBe(1000);

    // 4. Action: Player A uses "Try Again"
    const result = await turnService.tryAgainOnSpace(playerA.id);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Player A used Try Again');
    expect(result.message).toContain('Reverted to OWNER-SCOPE-INITIATION with 1 day penalty');
    // TurnService.tryAgainOnSpace() now handles the complete flow internally
    // No external turn advancement needed

    // 6. Verification
    const finalState = stateService.getGameState();
    const finalPlayerA = stateService.getPlayer(playerA.id)!;

    // Verify state was reverted (money mutation is gone)
    expect(finalPlayerA.money).toBe(0); // Reverted to original value

    // Verify penalty was applied to reverted state
    expect(finalPlayerA.timeSpent).toBe(snapshotTime + 1);

    // Verify turn stays with Player A (Try Again should reset current turn, not advance)
    expect(finalState.currentPlayerId).toBe(playerA.id);

    // Verify turn flags are reset so player can take actions again
    expect(finalState.hasPlayerMovedThisTurn).toBe(false);
    expect(finalState.hasPlayerRolledDice).toBe(false);

    console.log('✅ E2E test for state revert, penalty, and turn reset passed');
  });

  it('should fail gracefully if no snapshot exists', async () => {
    stateService.resetGame();
    stateService.addPlayer('Player C');
    stateService.startGame();

    // Mark as initialized so we can test the snapshot logic specifically
    stateService.markAsInitialized();

    const playerC = stateService.getGameState().players[0];

    // Ensure no snapshot is present
    stateService.clearPreSpaceEffectSnapshot();

    const result = await turnService.tryAgainOnSpace(playerC.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('No snapshot available');
  });

  it('should fail gracefully if game is not initialized (race condition prevention)', async () => {
    stateService.resetGame();
    stateService.addPlayer('Player D');
    stateService.startGame();

    // Do NOT call markAsInitialized() to simulate the race condition
    const playerD = stateService.getGameState().players[0];

    const result = await turnService.tryAgainOnSpace(playerD.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Game is still initializing');
  });
});