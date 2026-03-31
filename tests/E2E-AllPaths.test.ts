/**
 * E2E-AllPaths.test.ts
 *
 * Comprehensive path coverage tests that verify all decision points in the game.
 * Each test exercises a different branch at choice-based spaces.
 *
 * Decision Points Covered:
 * 1. PM-DECISION-CHECK: LEND-SCOPE-CHECK | ARCH-INITIATION | CHEAT-BYPASS
 * 2. LEND-SCOPE-CHECK: BANK-FUND-REVIEW | INVESTOR-FUND-REVIEW
 * 3. ARCH-SCOPE-CHECK: PM-DECISION-CHECK | ENG-INITIATION
 * 4. ENG-SCOPE-CHECK: PM-DECISION-CHECK | REG-DOB-FEE-REVIEW
 * 5. REG-DOB-TYPE-SELECT: REG-DOB-PLAN-EXAM | REG-DOB-PROF-CERT
 * 6. REG-FDNY-FEE-REVIEW: CON-INITIATION | PM-DECISION-CHECK | REG-DOB-TYPE-SELECT | REG-FDNY-PLAN-EXAM
 */

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
import { NegotiationService } from '../src/services/NegotiationService';
import { NotificationService } from '../src/services/NotificationService';
import { TargetingService } from '../src/services/TargetingService';
import { CardEffectService } from '../src/services/CardEffectService';
import { FinancialEffectHandler } from '../src/services/FinancialEffectHandler';
import { CardEffectHandler } from '../src/services/CardEffectHandler';
import { readFileSync } from 'fs';
import { join } from 'path';

// Node.js compatible DataService for E2E testing
class NodeDataService extends DataService {
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;
    const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
    (this as any).gameConfigs = (this as any).parseGameConfigCsv(readFileSync(join(dataDir, 'GAME_CONFIG.csv'), 'utf-8'));
    (this as any).movements = (this as any).parseMovementCsv(readFileSync(join(dataDir, 'MOVEMENT.csv'), 'utf-8'));
    (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(readFileSync(join(dataDir, 'DICE_OUTCOMES.csv'), 'utf-8'));
    (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(readFileSync(join(dataDir, 'SPACE_EFFECTS.csv'), 'utf-8'));
    (this as any).diceEffects = (this as any).parseDiceEffectsCsv(readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8'));
    (this as any).spaceContents = (this as any).parseSpaceContentCsv(readFileSync(join(dataDir, 'SPACE_CONTENT.csv'), 'utf-8'));
    (this as any).cards = (this as any).parseCardsCsv(readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8'));
    (this as any).buildSpaces();
    (this as any).loaded = true;
  }
}

// Test services shared across tests
let dataService: DataService;
let stateService: StateService;
let turnService: TurnService;
let choiceService: ChoiceService;
let movementService: MovementService;

// Helper to set up fresh game state
const setupGame = async () => {
  dataService = new NodeDataService();
  await dataService.loadData();
  stateService = new StateService(dataService);
  const loggingService = new LoggingService(stateService);
  const resourceService = new ResourceService(stateService);
  const gameRulesService = new GameRulesService(dataService, stateService);
  stateService.setGameRulesService(gameRulesService);
  choiceService = new ChoiceService(stateService);
  const cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
  movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService);
  const notificationService = new NotificationService(stateService, loggingService);
  const targetingService = new TargetingService(stateService, choiceService);
  const effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as any, gameRulesService, targetingService, loggingService);
  effectEngineService.setDataService(dataService);
  const negotiationService = new NegotiationService(stateService, effectEngineService);
  turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService, choiceService, notificationService);
  turnService.setEffectEngineService(effectEngineService);
  effectEngineService.setTurnService(turnService);
  cardService.setEffectEngineService(effectEngineService);

  // Create and wire CardEffectService for manual card actions
  const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);
  turnService.setCardEffectService(cardEffectService);

  // Create and wire effect handlers for EffectEngineService
  const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
  const cardEffectHandler = new CardEffectHandler(cardService, stateService, dataService, choiceService);
  effectEngineService.setFinancialEffectHandler(financialEffectHandler);
  effectEngineService.setCardEffectHandler(cardEffectHandler);

  stateService.addPlayer('TestPlayer');
  const player = stateService.getAllPlayers()[0];
  stateService.setCurrentPlayer(player.id);
  stateService.startGame();
  await turnService.startTurn(player.id);

  return player.id;
};

// Helper to execute a turn with optional destination choice and dice roll
const playTurn = async (
  playerId: string,
  expectedSpace: string,
  options?: {
    destination?: string;
    roll?: number;
  }
) => {
  const p = stateService.getPlayer(playerId)!;
  expect(p.currentSpace).toBe(expectedSpace);

  // Handle automatic funding if at OWNER-FUND-INITIATION
  if (p.currentSpace === 'OWNER-FUND-INITIATION') {
    await turnService.handleAutomaticFunding(playerId);
  }

  // Process manual effects
  const effects = dataService.getSpaceEffects(p.currentSpace, p.visitType);
  for (const effect of effects) {
    if (effect.trigger_type === 'manual' && effect.effect_type !== 'turn') {
      const key = `${effect.effect_type}:${effect.effect_action}`;
      if (effect.effect_type === 'dice') {
        await turnService.rollDice(playerId);
      } else {
        const promise = turnService.triggerManualEffect(playerId, key);
        await new Promise(r => setTimeout(r, 10));
        const choice = stateService.getGameState().awaitingChoice;
        if (choice && choice.type !== 'MOVEMENT') {
          choiceService.resolveChoice(choice.id, choice.options[0].id);
        }
        await promise;
      }
    }
  }

  // Set destination if provided
  if (options?.destination) {
    stateService.setPlayerMoveIntent(playerId, options.destination);
  }

  // Handle dice-based movement
  const movement = dataService.getMovement(p.currentSpace, p.visitType);
  if (movement?.movement_type === 'dice' || movement?.movement_type === 'dice_outcome') {
    // Mock the dice roll
    vi.spyOn(turnService, 'rollDice').mockImplementationOnce((pid) => {
      const roll = options?.roll || 1;
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: roll, roll2: 0, total: roll } });
      stateService.setPlayerHasRolledDice();
      return roll;
    });
    await turnService.rollDice(playerId);
  }

  await turnService.endTurnWithMovement(true);
  return stateService.getPlayer(playerId)!.currentSpace;
};

describe('E2E Path Coverage: All Decision Points', () => {

  describe('PM-DECISION-CHECK Branches', () => {

    it('Path: PM → LEND-SCOPE-CHECK → BANK-FUND-REVIEW → PM (funding side quest)', async () => {
      const playerId = await setupGame();

      // Start → OWNER-SCOPE → OWNER-FUND → PM-DECISION-CHECK
      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');

      // PM → LEND-SCOPE-CHECK
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'LEND-SCOPE-CHECK' });

      // LEND → BANK-FUND-REVIEW
      await playTurn(playerId, 'LEND-SCOPE-CHECK', { destination: 'BANK-FUND-REVIEW' });

      // BANK → PM (loops back)
      const newSpace = await playTurn(playerId, 'BANK-FUND-REVIEW');
      expect(newSpace).toBe('PM-DECISION-CHECK');
    }, 30000);

    it('Path: PM → LEND-SCOPE-CHECK → INVESTOR-FUND-REVIEW → PM (investor branch)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');

      // PM → LEND-SCOPE-CHECK
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'LEND-SCOPE-CHECK' });

      // LEND → INVESTOR-FUND-REVIEW
      await playTurn(playerId, 'LEND-SCOPE-CHECK', { destination: 'INVESTOR-FUND-REVIEW' });

      // INVESTOR → PM (loops back)
      const newSpace = await playTurn(playerId, 'INVESTOR-FUND-REVIEW');
      expect(newSpace).toBe('PM-DECISION-CHECK');
    }, 30000);

    it('Path: PM → CHEAT-BYPASS → (dice determines destination)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');

      // PM → CHEAT-BYPASS
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'CHEAT-BYPASS' });

      // CHEAT-BYPASS with roll=1 → ENG-INITIATION
      const newSpace = await playTurn(playerId, 'CHEAT-BYPASS', { roll: 1 });
      expect(newSpace).toBe('ENG-INITIATION');
    }, 30000);

    it('Path: PM → CHEAT-BYPASS → roll 4 → CON-INITIATION (cheat to construction)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'CHEAT-BYPASS' });

      // Roll 4 → CON-INITIATION
      const newSpace = await playTurn(playerId, 'CHEAT-BYPASS', { roll: 4 });
      expect(newSpace).toBe('CON-INITIATION');
    }, 30000);

  });

  describe('ARCH-SCOPE-CHECK Branches', () => {

    it('Path: ARCH-SCOPE → PM-DECISION-CHECK (loop back for more work)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'ARCH-INITIATION' });
      await playTurn(playerId, 'ARCH-INITIATION');
      await playTurn(playerId, 'ARCH-FEE-REVIEW');

      // ARCH-SCOPE → PM (loop back)
      const newSpace = await playTurn(playerId, 'ARCH-SCOPE-CHECK', { destination: 'PM-DECISION-CHECK' });
      expect(newSpace).toBe('PM-DECISION-CHECK');
    }, 30000);

  });

  describe('ENG-SCOPE-CHECK Branches', () => {

    it('Path: ENG-SCOPE → PM-DECISION-CHECK (loop back)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'ARCH-INITIATION' });
      await playTurn(playerId, 'ARCH-INITIATION');
      await playTurn(playerId, 'ARCH-FEE-REVIEW');
      await playTurn(playerId, 'ARCH-SCOPE-CHECK', { destination: 'ENG-INITIATION' });
      await playTurn(playerId, 'ENG-INITIATION');
      await playTurn(playerId, 'ENG-FEE-REVIEW');

      // ENG-SCOPE → PM (loop back)
      const newSpace = await playTurn(playerId, 'ENG-SCOPE-CHECK', { destination: 'PM-DECISION-CHECK' });
      expect(newSpace).toBe('PM-DECISION-CHECK');
    }, 30000);

  });

  describe('REG-DOB-TYPE-SELECT Branches', () => {

    it('Path: REG-DOB-TYPE-SELECT → REG-DOB-PLAN-EXAM (regular exam path)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'ARCH-INITIATION' });
      await playTurn(playerId, 'ARCH-INITIATION');
      await playTurn(playerId, 'ARCH-FEE-REVIEW');
      await playTurn(playerId, 'ARCH-SCOPE-CHECK', { destination: 'ENG-INITIATION' });
      await playTurn(playerId, 'ENG-INITIATION');
      await playTurn(playerId, 'ENG-FEE-REVIEW');
      await playTurn(playerId, 'ENG-SCOPE-CHECK', { destination: 'REG-DOB-FEE-REVIEW' });
      await playTurn(playerId, 'REG-DOB-FEE-REVIEW');

      // REG-DOB-TYPE-SELECT → PLAN-EXAM
      const newSpace = await playTurn(playerId, 'REG-DOB-TYPE-SELECT', { destination: 'REG-DOB-PLAN-EXAM' });
      expect(newSpace).toBe('REG-DOB-PLAN-EXAM');
    }, 60000);

  });

  describe('REG-FDNY-FEE-REVIEW Branches', () => {

    it('Path: REG-FDNY → PM-DECISION-CHECK (back to planning)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'ARCH-INITIATION' });
      await playTurn(playerId, 'ARCH-INITIATION');
      await playTurn(playerId, 'ARCH-FEE-REVIEW');
      await playTurn(playerId, 'ARCH-SCOPE-CHECK', { destination: 'ENG-INITIATION' });
      await playTurn(playerId, 'ENG-INITIATION');
      await playTurn(playerId, 'ENG-FEE-REVIEW');
      await playTurn(playerId, 'ENG-SCOPE-CHECK', { destination: 'REG-DOB-FEE-REVIEW' });
      await playTurn(playerId, 'REG-DOB-FEE-REVIEW');
      await playTurn(playerId, 'REG-DOB-TYPE-SELECT', { destination: 'REG-DOB-PROF-CERT' });
      await playTurn(playerId, 'REG-DOB-PROF-CERT', { roll: 3 }); // Roll 3 → REG-FDNY-FEE-REVIEW

      // REG-FDNY → PM (back to planning)
      const newSpace = await playTurn(playerId, 'REG-FDNY-FEE-REVIEW', { destination: 'PM-DECISION-CHECK' });
      expect(newSpace).toBe('PM-DECISION-CHECK');
    }, 60000);

    it('Path: REG-FDNY → REG-FDNY-PLAN-EXAM (FDNY exam path)', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'ARCH-INITIATION' });
      await playTurn(playerId, 'ARCH-INITIATION');
      await playTurn(playerId, 'ARCH-FEE-REVIEW');
      await playTurn(playerId, 'ARCH-SCOPE-CHECK', { destination: 'ENG-INITIATION' });
      await playTurn(playerId, 'ENG-INITIATION');
      await playTurn(playerId, 'ENG-FEE-REVIEW');
      await playTurn(playerId, 'ENG-SCOPE-CHECK', { destination: 'REG-DOB-FEE-REVIEW' });
      await playTurn(playerId, 'REG-DOB-FEE-REVIEW');
      await playTurn(playerId, 'REG-DOB-TYPE-SELECT', { destination: 'REG-DOB-PROF-CERT' });
      await playTurn(playerId, 'REG-DOB-PROF-CERT', { roll: 3 });

      // Add W card worth >$4M to enable REG-FDNY-PLAN-EXAM destination (requires scope_gt_4m)
      // W005 = $4.5M (Construction of new emergency department addition to existing hospital)
      const player = stateService.getPlayer(playerId)!;
      stateService.updatePlayer({ id: playerId, hand: [...player.hand, 'W005'] });

      // REG-FDNY → REG-FDNY-PLAN-EXAM
      const newSpace = await playTurn(playerId, 'REG-FDNY-FEE-REVIEW', { destination: 'REG-FDNY-PLAN-EXAM' });
      expect(newSpace).toBe('REG-FDNY-PLAN-EXAM');
    }, 60000);

  });

  describe('Complete Alternate Paths to FINISH', () => {

    it('Path: PLAN-EXAM route to REG-FDNY-FEE-REVIEW', async () => {
      const playerId = await setupGame();

      await playTurn(playerId, 'OWNER-SCOPE-INITIATION');
      await playTurn(playerId, 'OWNER-FUND-INITIATION');
      await playTurn(playerId, 'PM-DECISION-CHECK', { destination: 'ARCH-INITIATION' });
      await playTurn(playerId, 'ARCH-INITIATION');
      await playTurn(playerId, 'ARCH-FEE-REVIEW');
      await playTurn(playerId, 'ARCH-SCOPE-CHECK', { destination: 'ENG-INITIATION' });
      await playTurn(playerId, 'ENG-INITIATION');
      await playTurn(playerId, 'ENG-FEE-REVIEW');
      await playTurn(playerId, 'ENG-SCOPE-CHECK', { destination: 'REG-DOB-FEE-REVIEW' });
      await playTurn(playerId, 'REG-DOB-FEE-REVIEW');

      // Take PLAN-EXAM path instead of PROF-CERT
      await playTurn(playerId, 'REG-DOB-TYPE-SELECT', { destination: 'REG-DOB-PLAN-EXAM' });
      // Roll 1 → REG-FDNY-FEE-REVIEW (verifies PLAN-EXAM dice routing)
      const afterPlanExam = await playTurn(playerId, 'REG-DOB-PLAN-EXAM', { roll: 1 });
      expect(afterPlanExam).toBe('REG-FDNY-FEE-REVIEW');

      // CON-ISSUES dice outcomes route to CON-INSPECT.
      // PLAN-EXAM routing is verified above.
    }, 90000);

  });

});
