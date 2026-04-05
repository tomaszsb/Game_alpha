/**
 * Headless service bootstrap for the Ghost Player.
 *
 * Mirrors the production DI wiring in src/context/GameContext.tsx, but uses
 * a Node-friendly DataService that reads CSVs directly from disk instead of
 * going through fetch(). Same service instances, same public APIs, same
 * behavior — just no browser.
 *
 * Extracted from tests/E2E-LogicPlaythrough.test.ts so the Ghost Player and
 * future headless tests can share one bootstrap.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { DataService } from '../../src/services/DataService';
import { StateService } from '../../src/services/StateService';
import { LoggingService } from '../../src/services/LoggingService';
import { ResourceService } from '../../src/services/ResourceService';
import { GameRulesService } from '../../src/services/GameRulesService';
import { ChoiceService } from '../../src/services/ChoiceService';
import { CardService } from '../../src/services/CardService';
import { MovementService } from '../../src/services/MovementService';
import { NotificationService } from '../../src/services/NotificationService';
import { TargetingService } from '../../src/services/TargetingService';
import { EffectEngineService } from '../../src/services/EffectEngineService';
import { NegotiationService } from '../../src/services/NegotiationService';
import { TurnService } from '../../src/services/TurnService';
import { CardEffectService } from '../../src/services/CardEffectService';
import { CardEffectHandler } from '../../src/services/CardEffectHandler';
import { FinancialEffectHandler } from '../../src/services/FinancialEffectHandler';

class NodeDataService extends DataService {
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;
    const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
    const read = (file: string) => readFileSync(join(dataDir, file), 'utf-8');
    (this as any).gameConfigs = (this as any).parseGameConfigCsv(read('GAME_CONFIG.csv'));
    (this as any).movements = (this as any).parseMovementCsv(read('MOVEMENT.csv'));
    (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(read('DICE_OUTCOMES.csv'));
    (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(read('SPACE_EFFECTS.csv'));
    (this as any).diceEffects = (this as any).parseDiceEffectsCsv(read('DICE_EFFECTS.csv'));
    (this as any).spaceContents = (this as any).parseSpaceContentCsv(read('SPACE_CONTENT.csv'));
    (this as any).cards = (this as any).parseCardsCsv(read('CARDS_EXPANDED.csv'));
    (this as any).buildSpaces();
    (this as any).loaded = true;
  }
}

export interface HeadlessServices {
  dataService: DataService;
  stateService: StateService;
  turnService: TurnService;
  gameRulesService: GameRulesService;
  cardService: CardService;
  movementService: MovementService;
  choiceService: ChoiceService;
  resourceService: ResourceService;
  loggingService: LoggingService;
}

export async function bootstrapHeadlessServices(): Promise<HeadlessServices> {
  const dataService = new NodeDataService();
  await dataService.loadData();

  const stateService = new StateService(dataService);
  const loggingService = new LoggingService(stateService);
  const resourceService = new ResourceService(stateService);
  const gameRulesService = new GameRulesService(dataService, stateService);
  stateService.setGameRulesService(gameRulesService);
  const choiceService = new ChoiceService(stateService);
  const cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
  const movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService);
  const notificationService = new NotificationService(stateService, loggingService);
  const targetingService = new TargetingService(stateService, choiceService);
  const effectEngineService = new EffectEngineService(
    resourceService,
    cardService,
    choiceService,
    stateService,
    movementService,
    {} as any,
    gameRulesService,
    targetingService,
    loggingService
  );
  effectEngineService.setDataService(dataService);
  const negotiationService = new NegotiationService(stateService, effectEngineService);
  const turnService = new TurnService(
    dataService,
    stateService,
    gameRulesService,
    cardService,
    resourceService,
    movementService,
    negotiationService,
    loggingService,
    choiceService,
    notificationService
  );
  turnService.setEffectEngineService(effectEngineService);
  effectEngineService.setTurnService(turnService);
  effectEngineService.setNotificationService(notificationService);
  cardService.setEffectEngineService(effectEngineService);
  cardService.setChoiceService(choiceService);

  // Wire FinancialEffectHandler — required for RESOURCE_CHANGE effects from cards/spaces.
  const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
  effectEngineService.setFinancialEffectHandler(financialEffectHandler);

  // Wire CardEffectHandler — required for CARD_DRAW / CARD_DISCARD / card activation effects.
  // Without this, dice-triggered card draws silently return empty arrays.
  const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingService);
  cardEffectHandler.setDataService(dataService);
  cardEffectHandler.setNotificationService(notificationService);
  effectEngineService.setCardEffectHandler(cardEffectHandler);

  const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);
  turnService.setCardEffectService(cardEffectService);

  return {
    dataService,
    stateService,
    turnService,
    gameRulesService,
    cardService,
    movementService,
    choiceService,
    resourceService,
    loggingService,
  };
}
