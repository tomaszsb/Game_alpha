// tests/regression/TryAgainVisitType.test.ts

/**
 * Regression Test: Try Again / Negotiate Turn Advancement
 *
 * Bug Description (March 2026):
 * When a player uses "Try Again" (Negotiate) on a space:
 * 1. They pay a time penalty.
 * 2. Their turn SHOULD end and advance to the next player.
 * 3. When it is their turn again, they should retry the same space with a fresh state.
 *
 * This test validates the "Pay-and-Wait" model.
 */

import { vitest, describe, it, expect, beforeEach } from 'vitest';
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
import { CardEffectService } from '../../src/services/CardEffectService';
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

describe('Try Again / Negotiate Regression', () => {
  let dataService: IDataService;
  let stateService: IStateService;
  let resourceService: ResourceService;
  let choiceService: ChoiceService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let targetingService: TargetingService;
  let effectEngineService: EffectEngineService;
  let cardEffectService: CardEffectService;
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
    negotiationService = new NegotiationService(stateService, null as any);

    effectEngineService = new EffectEngineService(
        resourceService,
        cardService,
        choiceService,
        stateService,
        movementService,
        undefined as any, // NotificationService (optional)
        undefined as any, // SpaceArrivalProcessor (linked later)
        targetingService,
        loggingService
    );

    cardEffectService = new (CardEffectService as any)(
        stateService,
        cardService,
        resourceService,
        gameRulesService,
        effectEngineService
    );

    turnService = new TurnService(
      dataService, stateService, gameRulesService, cardService,
      resourceService, movementService, negotiationService, loggingService, choiceService
    );

    turnService.setEffectEngineService(effectEngineService);
    turnService.setCardEffectService(cardEffectService);

    // Link circular dependencies
    stateService.setGameRulesService(gameRulesService);

    // Add players and start game
    stateService.addPlayer('Player 1');
    stateService.addPlayer('Player 2');
    const players = stateService.getGameState().players;
    player1Id = players[0].id;
    player2Id = players[1].id;

    stateService.updateGameState({ gamePhase: 'PLAY', currentPlayerId: player1Id });
    
    // Ensure game is marked as initialized for Try Again availability
    stateService.markAsInitialized();
  });

  it('should advance turn to next player after using Try Again', async () => {
    // 1. Move Player 1 to a space that allows negotiation
    // OWNER-SCOPE-INITIATION allows negotiation
    stateService.updatePlayer({
      id: player1Id,
      currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First',
      timeSpent: 10
    });

    // 2. Start turn to initialize TEMP state
    await turnService.startTurn(player1Id);
    
    // Verify player 1 is current
    expect(stateService.getGameState().currentPlayerId).toBe(player1Id);
    const initialTime = stateService.getPlayer(player1Id)!.timeSpent;

    // 3. Call tryAgainOnSpace
    const result = await turnService.tryAgainOnSpace(player1Id);
    console.log('Try Again Result:', result);
    
    // Verify success and shouldAdvanceTurn flag
    expect(result.success).toBe(true);
    expect(result.shouldAdvanceTurn).toBe(true);

    // 4. In a real app (GameLayout.tsx), handleTryAgain uses this flag to call endTurnWithMovement
    if (result.shouldAdvanceTurn) {
        await turnService.endTurnWithMovement(true, true);
    }

    // 5. Verify it is now Player 2's turn
    expect(stateService.getGameState().currentPlayerId).toBe(player2Id);
    
    // 6. Verify Player 1's time increased (penalty applied to REAL state)
    const p1 = stateService.getPlayer(player1Id)!;
    expect(p1.timeSpent).toBeGreaterThan(initialTime);
  });
});
