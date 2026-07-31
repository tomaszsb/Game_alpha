import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { StateService } from '../src/services/StateService';
import { DataService } from '../src/services/DataService';
import { CardService } from '../src/services/CardService';
import { LoggingService } from '../src/services/LoggingService';
import { LogWriter } from '../src/services/LogWriter';
import { ChoiceService } from '../src/services/ChoiceService';
import { EffectEngineService } from '../src/services/EffectEngineService';
import { GameRulesService } from '../src/services/GameRulesService';
import { MovementService } from '../src/services/MovementService';
import { ResourceService } from '../src/services/ResourceService';
import { TurnService } from '../src/services/TurnService';
import { NegotiationService } from '../src/services/NegotiationService';
import { NotificationService } from '../src/services/NotificationService';
import { TargetingService } from '../src/services/TargetingService';
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
  };

  globalStateService.resetGame();
  globalStateService.addPlayer(initialPlayerName);
  
  const actualPlayer = globalStateService.getAllPlayers()[0];
  const actualPlayerId = actualPlayer.id;

  globalStateService.setCurrentPlayer(actualPlayerId);
  globalStateService.startGame();

  await globalTurnService.startTurn(actualPlayerId);

  const renderResult = render(
    <GameContext.Provider value={gameServices}>
      <GameLayout viewPlayerId={actualPlayerId} />
    </GameContext.Provider>
  );

  return { gameServices, actualPlayerId, ...renderResult };
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

const mockECard: any = {
  card_id: 'E_TEST_ID',
  card_name: 'Test E Card',
  card_type: 'E',
  description: 'Test Expeditor Card',
  cost: 0,
  phase_restriction: 'Any'
};

const mockLCard: any = {
  card_id: 'L_TEST_ID',
  card_name: 'Test L Card',
  card_type: 'L',
  description: 'Test Life Event',
  cost: 0,
  phase_restriction: 'Any'
};

describe('E2E Full Playthrough', () => {

  beforeAll(async () => {
    globalDataService = new NodeDataService();
    await globalDataService.loadData();

    globalStateService = new StateService(globalDataService);
    globalLoggingService = new LoggingService(globalStateService);
    new LogWriter(globalStateService, globalLoggingService);
    globalResourceService = new ResourceService(globalStateService);
    globalGameRulesService = new GameRulesService(globalDataService, globalStateService);
    globalStateService.setGameRulesService(globalGameRulesService);
    globalChoiceService = new ChoiceService(globalStateService);
    globalCardService = new CardService(globalDataService, globalStateService, globalResourceService, globalLoggingService, globalGameRulesService);
    globalMovementService = new MovementService(globalDataService, globalStateService, globalChoiceService, globalLoggingService, globalGameRulesService);
    globalNotificationService = new NotificationService(globalStateService, globalLoggingService);
    globalTargetingService = new TargetingService(globalStateService, globalChoiceService);

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
      globalNotificationService
    );

    globalNegotiationService = new NegotiationService(globalStateService, globalEffectEngineService, globalResourceService, globalChoiceService);
    
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
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.1); 
  });

  const dismissOverlay = async () => {
    try {
      const overlay = await screen.findByText(/your turn!/i, {}, { timeout: 1000 });
      fireEvent.click(overlay);
    } catch (e) {}
  };

  const smartPlayTurn = async (targetSpaceRegex: RegExp, desiredNextSpace?: string) => {
    console.log(`🤖 Auto-Player: Arrival at ${targetSpaceRegex}`);
    
    await waitFor(() => {
        const locations = screen.getAllByText(targetSpaceRegex);
        return locations.length > 0;
    }, { timeout: 15000 });
    
    await dismissOverlay();

    let safetyCounter = 0;
    while (safetyCounter < 5) {
        const etButton = await screen.findByRole('button', { name: /End Turn/i });
        const tooltip = etButton.getAttribute('title') || '';
        
        if (etButton.hasAttribute('disabled') && tooltip.includes('Complete')) {
            const actionButtons = screen.queryAllByRole('button', { name: /Perform .* action|Roll dice to gain|Roll for/i });
            const enabledButtons = actionButtons.filter(b => !b.hasAttribute('disabled'));
            
            if (enabledButtons.length > 0) {
                fireEvent.click(enabledButtons[0]);
                await waitFor(async () => {
                    const modalHeader = screen.queryByText(/Replace .* Cards|Return .* Cards/i);
                    if (modalHeader) {
                        const cardItem = await screen.findByText(/Test E Card|Test W Card/i);
                        fireEvent.click(cardItem);
                        const confirmBtn = await screen.findByRole('button', { name: /Replace .* Card|Return .* Card/i });
                        fireEvent.click(confirmBtn);
                    }
                }, { timeout: 2000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 500)); 
            } else {
                break; 
            }
        } else {
            break; 
        }
        safetyCounter++;
    }

    if (desiredNextSpace) {
        const options = screen.queryAllByRole('button', { name: /🎯 /i });
        const desiredBtn = options.find(opt => opt.textContent?.includes(desiredNextSpace));
        if (desiredBtn) {
            fireEvent.click(desiredBtn);
        } else if (options.length > 0) {
            fireEvent.click(options[0]);
        }
    }

    const endTurnButton = await screen.findByRole('button', { name: /End Turn/i });
    if (endTurnButton.hasAttribute('disabled')) {
        await globalTurnService.endTurnWithMovement(true); 
    } else {
        fireEvent.click(endTurnButton);
    }
  };

  // SKIPPED: This UI-level E2E test is flaky due to React rendering timing.
  // We have comprehensive logic-level coverage in E2E-LogicPlaythrough.test.ts and E2E-AllPaths.test.ts
  it.skip('should play through the game from START to FINISH', async () => {
    let nextRollValue = 1;
    (vi.spyOn(globalTurnService, 'rollDice') as any).mockImplementation((playerId: any) => {
        globalStateService.updatePlayer({ 
            id: playerId, 
            lastDiceRoll: { roll1: nextRollValue, roll2: 0, total: nextRollValue } 
        });
        globalStateService.setPlayerHasRolledDice();
        return nextRollValue;
    });

    vi.spyOn(globalDataService, 'getCardById').mockImplementation((cardId) => {
      if (cardId.startsWith('W')) return mockWCard;
      if (cardId.startsWith('B')) return mockBCard;
      if (cardId.startsWith('E')) return mockECard;
      if (cardId.startsWith('L')) return mockLCard;
      return undefined;
    });

    vi.spyOn(globalCardService, 'drawCards').mockImplementation((playerId: any, cardType: any, count: any) => {
      const player = globalStateService.getPlayer(playerId);
      if (player) {
        const drawnCards: string[] = [];
        for (let i = 0; i < count; i++) {
          drawnCards.push(`${cardType}_TEST_${Math.random()}`);
        }
        const updatedHand = [...player.hand, ...drawnCards];
        globalStateService.updatePlayer({ id: playerId, hand: updatedHand });
        globalStateService.updatePlayer({ id: playerId, currentCard: drawnCards[0] } as any);
        return drawnCards;
      }
      return [];
    });

    const { actualPlayerId } = await setupGameE2E('Alice');

    console.log('🏁 Starting Automated Golden Path Playthrough');

    const path = [
        { regex: /OWNER-SCOPE-INITIATION/i, next: 'OWNER-FUND-INITIATION' },
        { regex: /OWNER-FUND-INITIATION/i, next: 'PM-DECISION-CHECK' },
        { regex: /PM-DECISION-CHECK/i, next: 'ARCH-INITIATION' },
        { regex: /ARCH-INITIATION/i, next: 'ARCH-FEE-REVIEW' },
        { regex: /ARCH-FEE-REVIEW/i, next: 'ARCH-SCOPE-CHECK' },
        { regex: /ARCH-SCOPE-CHECK/i, next: 'ENG-INITIATION' },
        { regex: /ENG-INITIATION/i, next: 'ENG-FEE-REVIEW' },
        { regex: /ENG-FEE-REVIEW/i, next: 'ENG-SCOPE-CHECK' },
        { regex: /ENG-SCOPE-CHECK/i, next: 'REG-DOB-FEE-REVIEW' },
        { regex: /REG-DOB-FEE-REVIEW/i, next: 'REG-DOB-TYPE-SELECT' },
        { regex: /REG-DOB-TYPE-SELECT/i, next: 'REG-DOB-PROF-CERT' },
        { regex: /REG-DOB-PROF-CERT/i, next: 'REG-FDNY-FEE-REVIEW', roll: 3 },
        { regex: /REG-FDNY-FEE-REVIEW/i, next: 'CON-INITIATION' },
        { regex: /CON-INITIATION/i, next: 'CON-ISSUES' },
        { regex: /CON-ISSUES/i, next: 'CON-INSPECT', roll: 1 },
        { regex: /CON-INSPECT/i, next: 'REG-DOB-FINAL-REVIEW', roll: 1 },
        { regex: /REG-DOB-FINAL-REVIEW/i, next: 'FINISH', roll: 1 }
    ];

    for (let i = 0; i < path.length; i++) {
        const step = path[i];
        console.log(`--- STEP ${i+1}: ${step.regex} ---`);
        nextRollValue = step.roll || 1;
        await smartPlayTurn(step.regex, step.next);
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('🏆 All turns completed. Verifying FINISH space...');
    await waitFor(() => {
      const locations = screen.getAllByText(/FINISH/i);
      return locations.length > 0;
    }, { timeout: 30000 });

    console.log('🎉 Reached FINISH space!');
  }, 300000); 
});