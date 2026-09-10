// tests/regression/AutoRollDiceFlag.test.ts
//
// Workstream 6 audit II, B1 (v3.2.56). TurnService.startTurn auto-rolls the
// dice at review spaces where the authority decides the outcome. The gate was
// `phase === 'REGULATORY'` — phase names are free text in GAME_CONFIG, so
// renaming the phase silently stopped every automatic roll, with no error.
// The gate is now the per-space `auto_roll_dice` flag.
//
// Real services + the real shipped CSVs, so this also proves the flag
// reproduces the old rule exactly on today's board.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
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
import { NotificationService } from '../../src/services/NotificationService';
import { TargetingService } from '../../src/services/TargetingService';
import { CardEffectService } from '../../src/services/CardEffectService';
import { FinancialEffectHandler } from '../../src/services/FinancialEffectHandler';
import { CardEffectHandler } from '../../src/services/CardEffectHandler';
import type { GameConfig } from '../../src/types/DataTypes';

const DATA_DIR = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
const read = (f: string) => readFileSync(join(DATA_DIR, f), 'utf-8');

class NodeDataService extends DataService {
  async loadData(): Promise<void> {
    const self = this as any;
    self.gameConfigs = self.parseGameConfigCsv(read('GAME_CONFIG.csv'));
    self.movements = self.parseMovementCsv(read('MOVEMENT.csv'));
    self.diceOutcomes = self.parseDiceOutcomesCsv(read('DICE_OUTCOMES.csv'));
    self.spaceEffects = self.parseSpaceEffectsCsv(read('SPACE_EFFECTS.csv'));
    self.diceEffects = self.parseDiceEffectsCsv(read('DICE_EFFECTS.csv'));
    self.spaceContents = self.parseSpaceContentCsv(read('SPACE_CONTENT.csv'));
    self.cards = self.parseCardsCsv(read('CARDS_EXPANDED.csv'));
    self.buildSpaces();
    self.loaded = true;
  }
  /** Test seam: edit the loaded board in place (simulates a reskin CSV). */
  editConfig(edit: (c: GameConfig) => void): void {
    // The by-space index holds the same objects, so in-place edits show through.
    (this as any).gameConfigs.forEach(edit);
  }
}

async function buildGame() {
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
  const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
  const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingService);
  const effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as any, gameRulesService, targetingService, loggingService, dataService, financialEffectHandler, cardEffectHandler);
  const negotiationService = new NegotiationService(stateService, effectEngineService, resourceService, choiceService);
  const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);
  const turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService, choiceService, notificationService, undefined, undefined, undefined, cardEffectService);
  turnService.setEffectEngineService(effectEngineService);
  effectEngineService.setTurnService(turnService);
  cardService.setEffectEngineService(effectEngineService);
  return { dataService, stateService, turnService };
}

/** Put one player on `space` and start their turn; report whether the dice rolled themselves. */
async function arriveAt(game: Awaited<ReturnType<typeof buildGame>>, space: string): Promise<boolean> {
  const { stateService, turnService } = game;
  stateService.addPlayer('Alice');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({ id: playerId, currentSpace: space, visitType: 'First' });
  const autoRoll = vi.spyOn(turnService, 'rollDiceWithFeedback')
    .mockResolvedValue({ diceValue: 3, summary: '', effects: [] } as any);
  await turnService.startTurn(playerId);
  return autoRoll.mock.calls.length > 0;
}

describe('auto-roll on arrival is driven by the auto_roll_dice flag, not the phase name (B1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('stock board: the flag reproduces the old phase rule exactly', async () => {
    const { dataService } = await buildGame();
    const flagged: string[] = [];
    const oldRule: string[] = [];
    for (const c of dataService.getGameConfig()) {
      const dice = dataService.getMovement(c.space_name, 'First')?.movement_type === 'dice';
      if (dice && dataService.shouldAutoRollDice(c.space_name)) flagged.push(c.space_name);
      if (dice && c.phase === 'REGULATORY') oldRule.push(c.space_name);
    }
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.sort()).toEqual(oldRule.sort());
  });

  it('a flagged review space auto-rolls', async () => {
    expect(await arriveAt(await buildGame(), 'REG-DOB-PLAN-EXAM')).toBe(true);
  }, 20000);

  it('still auto-rolls after the phase is RENAMED (the old gate went silent here)', async () => {
    const game = await buildGame();
    game.dataService.editConfig(c => { if (c.phase === 'REGULATORY') c.phase = 'PERMITS'; });
    expect(await arriveAt(game, 'REG-DOB-PLAN-EXAM')).toBe(true);
  }, 20000);

  it('does NOT auto-roll when the flag is off, even with phase "REGULATORY"', async () => {
    const game = await buildGame();
    game.dataService.editConfig(c => { if (c.space_name === 'REG-DOB-PLAN-EXAM') c.auto_roll_dice = false; });
    expect(await arriveAt(game, 'REG-DOB-PLAN-EXAM')).toBe(false);
  }, 20000);

  it('a dice space without the flag (CHEAT-BYPASS — the player rolls) does not auto-roll', async () => {
    expect(await arriveAt(await buildGame(), 'CHEAT-BYPASS')).toBe(false);
  }, 20000);
});
