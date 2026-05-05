import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import React from 'react'; // Added missing React import
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './utils/test-utils';
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
import { NotificationService } from '../src/services/NotificationService';
import { TargetingService } from '../src/services/TargetingService';
import { CardEffectService } from '../src/services/CardEffectService';
import { FinancialEffectHandler } from '../src/services/FinancialEffectHandler';
import { CardEffectHandler } from '../src/services/CardEffectHandler';
import { IDataService, IStateService, ITurnService, IServiceContainer } from '../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GameLayout } from '../src/components/layout/GameLayout'; 
import { GameContext } from '../src/context/GameContext';
import { GameState, Player } from '../src/types/StateTypes';
import { Card, CardType } from '../src/types/DataTypes';

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

let globalDataService: IDataService;
let globalStateService: StateService;
let globalTurnService: TurnService;
let globalCardService: CardService;
let globalResourceService: ResourceService;
let globalMovementService: MovementService;
let globalChoiceService: ChoiceService;
let globalGameRulesService: GameRulesService;
let globalEffectEngineService: EffectEngineService;
let globalNegotiationService: NegotiationService;
let globalLoggingService: LoggingService;
let globalNotificationService: NotificationService;
let globalTargetingService: TargetingService;
let globalCardEffectService: CardEffectService;

const setupGameE2E = async (initialPlayerName: string = 'Alice') => {
  const gameServices: IServiceContainer = {
    dataService: globalDataService,
    stateService: globalStateService,
    turnService: globalTurnService,
    cardService: globalCardService,
    resourceService: globalResourceService,
    movementService: globalMovementService,
    choiceService: globalChoiceService,
    gameRulesService: globalGameRulesService,
    effectEngineService: globalEffectEngineService,
    negotiationService: globalNegotiationService,
    loggingService: globalLoggingService,
    notificationService: globalNotificationService,
    playerActionService: {} as any,
  };

  globalStateService.resetGame();
  globalStateService.addPlayer(initialPlayerName);
  
  const actualPlayer = globalStateService.getAllPlayers()[0];
  const actualPlayerId = actualPlayer.id;

  globalStateService.setCurrentPlayer(actualPlayerId);
  globalStateService.startGame();

  // Initialize the first turn correctly
  await globalTurnService.startTurn(actualPlayerId);

  const { rerender } = renderWithProviders(
    <GameLayout viewPlayerId={actualPlayerId} />,
    { gameServices }
  );

  return { gameServices, actualPlayerId, rerender };
};

const mockWCard: any = {
  card_id: 'W_TEST_DYNAMIC_ID',
  card_name: 'Test W Card',
  card_type: 'W',
  description: 'Test Description',
  work_cost: 1000000,
  work_type_restriction: 'Architectural',
  duration_turns: 3,
  phase_restriction: 'Design'
};

const mockBCard: any = {
  card_id: 'B_TEST_ID',
  card_name: 'Test B Card',
  card_type: 'B',
  description: 'Test Bank Funding',
  cost: 0,
  loan_amount: 1000000,
  loan_rate: 0.05,
  money_effect: 'add 1000000',
  phase_restriction: 'Any'
};

describe('E2E-01: Happy Path with New UI', () => {

  beforeAll(async () => {
    globalDataService = new NodeDataService();
    await globalDataService.loadData();

    globalStateService = new StateService(globalDataService);
    globalLoggingService = new LoggingService(globalStateService);
    globalResourceService = new ResourceService(globalStateService);
    globalGameRulesService = new GameRulesService(globalDataService, globalStateService);
    globalStateService.setGameRulesService(globalGameRulesService);
    globalChoiceService = new ChoiceService(globalStateService);
    globalCardService = new CardService(globalDataService, globalStateService, globalResourceService, globalLoggingService, globalGameRulesService);
    globalMovementService = new MovementService(globalDataService, globalStateService, globalChoiceService, globalLoggingService, globalGameRulesService);
    globalNotificationService = new NotificationService(globalStateService, globalLoggingService);
    globalTargetingService = new TargetingService(globalStateService, globalChoiceService);

    const financialEffectHandler = new FinancialEffectHandler(globalResourceService, globalStateService, globalGameRulesService, globalLoggingService);
    const cardEffectHandler = new CardEffectHandler(globalCardService, globalStateService, globalChoiceService, globalLoggingService);

    globalEffectEngineService = new EffectEngineService(
      globalResourceService,
      globalCardService,
      globalChoiceService,
      globalStateService,
      globalMovementService,
      {} as ITurnService,
      globalGameRulesService,
      globalTargetingService,
      globalLoggingService,
      globalDataService,
      globalNotificationService,
      financialEffectHandler,
      cardEffectHandler
    );

    globalNegotiationService = new NegotiationService(globalStateService, globalEffectEngineService);

    globalTurnService = new TurnService(
      globalDataService,
      globalStateService,
      globalGameRulesService,
      globalCardService,
      globalResourceService,
      globalMovementService,
      globalNegotiationService,
      globalLoggingService,
      globalChoiceService,
      globalNotificationService
    );

    globalTurnService.setEffectEngineService(globalEffectEngineService);
    globalEffectEngineService.setTurnService(globalTurnService);
    globalCardService.setEffectEngineService(globalEffectEngineService);

    // Create and wire CardEffectService for manual card actions
    globalCardEffectService = new CardEffectService(globalCardService, globalStateService, globalDataService, globalChoiceService);
    globalTurnService.setCardEffectService(globalCardEffectService);
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(globalDataService, 'getCardById').mockImplementation((cardId) => {
      if (cardId.startsWith('W_TEST')) return mockWCard;
      if (cardId.startsWith('B_TEST')) return mockBCard;
      return undefined;
    });

    vi.spyOn(globalCardService, 'drawCards').mockImplementation((playerId: any, cardType: any, count: any) => {
      const player = globalStateService.getPlayer(playerId);
      if (player) {
        const drawnCards: string[] = [];
        for (let i = 0; i < count; i++) {
          const drawnCardId = `${cardType}_TEST_${i}`;
          drawnCards.push(drawnCardId);
        }
        const updatedHand = [...player.hand, ...drawnCards];
        globalStateService.updatePlayer({ id: playerId, hand: updatedHand });

        // Update currentCard to show in UI
        globalStateService.updatePlayer({ id: playerId, currentCard: drawnCards[0] } as any);
        
        return drawnCards;
      }
      return [];
    });
  });


  it('should allow a single player to start a game and take one turn via UI interaction', async () => {
    console.log('🔥🔥🔥 [E2E TEST] Happy Path with New UI started!');

    const { gameServices, actualPlayerId } = await setupGameE2E('Alice');

    // Assert Phase 1: Initial UI state and player info
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Verify starting space exists in the UI
    await waitFor(() => {
      expect(screen.getAllByText(/OWNER-SCOPE-INITIATION/i).length).toBeGreaterThan(0);
    });

    // Mock dice roll to return 4 consistently for controlled movement
    const rollDiceSpy = vi.spyOn(gameServices.turnService, 'rollDice').mockReturnValue(4);

    // Wait for manual action buttons to appear (ActionCenterPanel renders these as text buttons)
    const pickUpCardsButton = await screen.findByRole('button', { name: /Draw 3 E cards/i }, { timeout: 5000 });
    const rollForWCardsButton = await screen.findByRole('button', { name: /Roll for W Cards/i });

    // UI Interaction 1: Execute Manual Action "Draw 3 E cards"
    fireEvent.click(pickUpCardsButton);

    // UI Interaction 2: Execute Manual Action "Roll for W Cards"
    fireEvent.click(rollForWCardsButton);

    // Wait for "End Turn" to become enabled
    const endTurnButton = screen.getByRole('button', { name: /End Turn/i });
    await waitFor(() => {
        expect(endTurnButton).toBeEnabled();
    }, { timeout: 3000 });

    // UI Interaction 3: Click "End Turn" to trigger movement
    fireEvent.click(endTurnButton);

    // Wait for movement to complete and dismiss overlay if it appears
    await waitFor(() => {
      // Dismiss movement transition overlay if present
      const overlay = screen.queryByText(/your turn!/i);
      if (overlay) fireEvent.click(overlay);
    }, { timeout: 5000 });

    // After End Turn, the player moves to OWNER-FUND-INITIATION
    await waitFor(() => {
      expect(screen.getAllByText(/OWNER-FUND-INITIATION/i).length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // OWNER-FUND-INITIATION has only auto effects (card draws + time)
    // End Turn should be enabled immediately since there are no manual actions
    await waitFor(() => {
      const etButton = screen.getByRole('button', { name: /End Turn/i });
      expect(etButton).toBeEnabled();
    }, { timeout: 5000 });

    // Click End Turn to finish Alice's Turn 1
    fireEvent.click(screen.getByRole('button', { name: /End Turn/i }));

    await waitFor(() => {
      // Alice's turn 1 has ended, global turn count should be 1
      expect(gameServices.stateService.getGameState().globalTurnCount).toBe(1);
    }, { timeout: 5000 });

    // Cleanup
    rollDiceSpy.mockRestore();

    console.log(`E2E test success: Player completed a turn via new UI`);
  });
});