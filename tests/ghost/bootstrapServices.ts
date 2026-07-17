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
import { ApprovalService } from '../../src/services/ApprovalService';
import { LogWriter } from '../../src/services/LogWriter';
import { ToastWriter } from '../../src/services/ToastWriter';

class NodeDataService extends DataService {
  private readonly cleanFilesDir: string;
  // Defaults to the stock CLEAN_FILES, but accepts an explicit dir so a test
  // can point the ghost at a baked classroom instance (e.g. one carrying a
  // teacher-authored insertion) instead of stock.
  constructor(cleanFilesDir?: string) {
    super();
    this.cleanFilesDir = cleanFilesDir ?? join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
  }
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;
    const dataDir = this.cleanFilesDir;
    const read = (file: string) => readFileSync(join(dataDir, file), 'utf-8');
    (this as any).gameConfigs = (this as any).parseGameConfigCsv(read('GAME_CONFIG.csv'));
    (this as any).movements = (this as any).parseMovementCsv(read('MOVEMENT.csv'));
    (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(read('DICE_OUTCOMES.csv'));
    (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(read('SPACE_EFFECTS.csv'));
    (this as any).diceEffects = (this as any).parseDiceEffectsCsv(read('DICE_EFFECTS.csv'));
    (this as any).spaceContents = (this as any).parseSpaceContentCsv(read('SPACE_CONTENT.csv'));
    (this as any).cards = (this as any).parseCardsCsv(read('CARDS_EXPANDED.csv'));
    // LOGIC_QUESTIONS.csv drives the yes/no decision chain at logic-typed
    // movement spaces (e.g. REG-FDNY-FEE-REVIEW). Without this, handleLogicMovement
    // falls back to auto-selecting destination_1, leaving downstream logic-only
    // destinations (REG-FDNY-PLAN-EXAM) unreachable in headless ghost runs.
    (this as any).logicQuestions = (this as any).parseLogicQuestionsCsv(read('LOGIC_QUESTIONS.csv'));
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

export async function bootstrapHeadlessServices(cleanFilesDir?: string): Promise<HeadlessServices> {
  const dataService = new NodeDataService(cleanFilesDir);
  await dataService.loadData();

  const stateService = new StateService(dataService);
  const loggingService = new LoggingService(stateService);
  // Domain-event stage 3: mirrors ServiceProvider.tsx's always-on GameEvent
  // bus subscribers, so headless turn flows produce the same log/toast
  // output real play does.
  new LogWriter(stateService, loggingService);
  const resourceService = new ResourceService(stateService);
  const gameRulesService = new GameRulesService(dataService, stateService);
  stateService.setGameRulesService(gameRulesService);
  const choiceService = new ChoiceService(stateService);
  // Workstream 7 — wire ApprovalService so the gate at REG-DOB-FINAL-REVIEW
  // actually fires and the bot exercises the approval mechanic end-to-end.
  // Mirrors ServiceProvider.tsx wiring. (TODO L64.)
  const approvalService = new ApprovalService();
  const cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService, choiceService, approvalService);
  const movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService, approvalService);
  const notificationService = new NotificationService(stateService, loggingService);
  new ToastWriter(stateService, notificationService);
  const targetingService = new TargetingService(stateService, choiceService);
  const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService, dataService, notificationService);
  const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingService, dataService, notificationService);
  // Kid E — bot can't click discard-choice modals (L003 / L048 forced-discard
  // fan-out). Flipping this to true makes the handler auto-pick oldest cards
  // instead of awaiting a choice that would hang the headless turn loop.
  cardEffectHandler.autoPickForcedDiscards = true;
  const effectEngineService = new EffectEngineService(
    resourceService,
    cardService,
    choiceService,
    stateService,
    movementService,
    {} as any,
    gameRulesService,
    targetingService,
    loggingService,
    dataService,
    notificationService,
    financialEffectHandler,
    cardEffectHandler
  );
  const negotiationService = new NegotiationService(stateService, effectEngineService);
  const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);
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
    notificationService,
    undefined, // effectEngineService — wired via setter for genuine cycle below
    undefined, // diceService — TurnService creates a default
    undefined, // spaceEffectService — TurnService creates a default
    cardEffectService,
    approvalService
  );
  turnService.setEffectEngineService(effectEngineService);
  effectEngineService.setTurnService(turnService);
  cardService.setEffectEngineService(effectEngineService);

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
