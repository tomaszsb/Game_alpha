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

describe('E2E-03: Complex Space Features Test', () => {
  let dataService: DataService;
  let stateService: StateService;
  let cardService: CardService;
  let choiceService: ChoiceService;
  let effectEngineService: EffectEngineService;
  let gameRulesService: GameRulesService;
  let movementService: MovementService;
  let resourceService: ResourceService;
  let turnService: TurnService;
  let playerActionService: PlayerActionService;
  let negotiationService: NegotiationService;

  beforeAll(async () => {
    // Initialize services
    dataService = new NodeDataService();
    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    resourceService = new ResourceService(stateService);
    choiceService = new ChoiceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    cardService = new CardService(dataService, stateService, resourceService, loggingService);
    movementService = new MovementService(dataService, stateService, choiceService, loggingService);

    // Handle circular dependency: EffectEngine -> Turn -> Negotiation -> EffectEngine
    effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as ITurnService, gameRulesService, {} as any); // targetingService
    negotiationService = new NegotiationService(stateService, effectEngineService);
    turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService);

    // Complete the circular dependency wiring
    turnService.setEffectEngineService(effectEngineService);
    effectEngineService.setTurnService(turnService);

    playerActionService = new PlayerActionService(dataService, stateService, gameRulesService, movementService, turnService, effectEngineService, loggingService);

    // Load game data
    await dataService.loadData();
  });

  it('should handle space try-again functionality with time penalty', async () => {
    // Reset game state for this test
    stateService.resetGame();
    
    // 1. Setup: Create player
    stateService.addPlayer('Test Player');
    stateService.startGame();
    
    const gameState = stateService.getGameState();
    const player = gameState.players[0];
    expect(player).toBeDefined();
    expect(player.name).toBe('Test Player');

    // Place player on OWNER-SCOPE-INITIATION (can_negotiate=true, time penalty)
    stateService.updatePlayer({
      id: player.id,
      currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First'
    });

    // Create snapshot for Try Again functionality
    stateService.savePreSpaceEffectSnapshot(player.id, 'OWNER-SCOPE-INITIATION');

    // Mark game as initialized (required for Try Again to work)
    stateService.markAsInitialized();

    // Set player as having rolled dice (to verify reset)
    stateService.setPlayerHasRolledDice();
    stateService.setPlayerHasMoved();

    // Get initial player state
    const initialTime = player.timeSpent || 0;
    
    console.log('Initial player state:', {
      timeSpent: initialTime,
      hasRolledDice: stateService.getGameState().hasPlayerRolledDice,
      hasMoved: stateService.getGameState().hasPlayerMovedThisTurn
    });

    // 2. Action: Roll dice to create a snapshot, then try again on space
    await turnService.rollDiceWithFeedback(player.id);
    const result = await turnService.tryAgainOnSpace(player.id);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('penalty');
    
    // 3. Verify time penalty was applied 
    const updatedPlayer = stateService.getPlayer(player.id)!;
    expect(updatedPlayer.timeSpent).toBeGreaterThan(initialTime);
    
    // 4. Verify dice state was reset (player can re-roll)
    const finalGameState = stateService.getGameState();
    expect(finalGameState.hasPlayerRolledDice).toBe(false);
    expect(finalGameState.hasPlayerMovedThisTurn).toBe(false);
    
    console.log('Final player state:', {
      timeSpent: updatedPlayer.timeSpent,
      hasRolledDice: finalGameState.hasPlayerRolledDice,
      hasMoved: finalGameState.hasPlayerMovedThisTurn
    });
    
    // 5. Verify action was logged
    const actionLogs = finalGameState.globalActionLog || [];
    const tryAgainLog = actionLogs.find(log => log.description.includes('Try Again: Reverted'));
    expect(tryAgainLog).toBeDefined();
    
    console.log('✅ Space try-again functionality test passed');
  });

  it('should fail try-again on non-negotiable spaces', async () => {
    // Reset game state for this test
    stateService.resetGame();
    
    // 1. Setup: Create player
    stateService.addPlayer('Decision Maker');
    stateService.startGame();
    
    const gameState = stateService.getGameState();
    const player = gameState.players[0];

    // Place player on PM-DECISION-CHECK (can_negotiate=false)
    stateService.updatePlayer({
      id: player.id,
      currentSpace: 'PM-DECISION-CHECK',
      visitType: 'First'
    });

    // Create snapshot for Try Again functionality (but this space shouldn't allow it)
    stateService.savePreSpaceEffectSnapshot(player.id, 'PM-DECISION-CHECK');

    // Mark game as initialized (required for Try Again logic to work)
    stateService.markAsInitialized();

    const initialTime = player.timeSpent || 0;

    // 2. Action: Simulate dice roll first, then try to try again (should fail)
    await turnService.rollDiceWithFeedback(player.id);
    const result = await turnService.tryAgainOnSpace(player.id);
    
    expect(result.success).toBe(false);
    expect(result.message).toBe('Try again not available on this space');
    
    // 3. Verify no time penalty was applied
    const updatedPlayer = stateService.getPlayer(player.id)!;
    expect(updatedPlayer.timeSpent).toBe(initialTime);
    
    console.log('✅ Non-negotiable space rejection test passed');
  });

  it('should detect negotiation capability from CSV data', async () => {
    // Check various spaces for negotiation capability
    const ownerScopeContent = dataService.getSpaceContent('OWNER-SCOPE-INITIATION', 'First');
    expect(ownerScopeContent).toBeDefined();
    expect(ownerScopeContent?.can_negotiate).toBe(true);
    expect(ownerScopeContent?.title).toBe('The owner dreams up an idea of project scope.');
    
    const pmDecisionContent = dataService.getSpaceContent('PM-DECISION-CHECK', 'First');
    expect(pmDecisionContent).toBeDefined();
    expect(pmDecisionContent?.can_negotiate).toBe(false);
    
    const archFeeContent = dataService.getSpaceContent('ARCH-FEE-REVIEW', 'First');
    expect(archFeeContent).toBeDefined();
    expect(archFeeContent?.can_negotiate).toBe(true);
    
    console.log('✅ CSV negotiation capability detection test passed');
  });

  it('should calculate correct time penalties from space effects', async () => {
    // Test penalty calculation for different spaces
    const ownerScopeEffects = dataService.getSpaceEffects('OWNER-SCOPE-INITIATION', 'First');
    const timePenalty1 = ownerScopeEffects
      .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add')
      .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);
    expect(timePenalty1).toBe(1);
    
    const archFeeEffects = dataService.getSpaceEffects('ARCH-FEE-REVIEW', 'First');
    const timePenalty50 = archFeeEffects
      .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add')
      .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);
    expect(timePenalty50).toBe(50);
    
    console.log('✅ Time penalty calculation test passed');
  });
});