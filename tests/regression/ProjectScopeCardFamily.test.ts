// tests/regression/ProjectScopeCardFamily.test.ts
//
// Workstream 6 audit II, leak #14 (v3.2.58). "Which cards make up the project's
// scope" (Work Packages on the stock board) was written as
// `cardId.startsWith('W')` in six places: the leave gate (TurnService, the
// min_w_cards_to_leave column), the scope / work-cost / project-length maths
// (GameRulesService), the bulk-permit check (CardService) and the end-screen
// count (endGameStats). Two problems, not one:
//   - a reskin could not name a different family (the audit's leak);
//   - it read the card's ID, not its card_type. Card IDs have been free text
//     since the August de-literalization (the DND-* tests rename them), so a
//     Work Package with ID `DND-WORK-01` counted for NOTHING — a correctness
//     gap no shipped card triggers yet.
// Now: one definition, CARD_TYPES.csv is_project_scope, read by card_type
// through DataService.isProjectScopeCard. Real services + real shipped data,
// plus one injected Work Package whose ID does not start with W.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StateService } from '../../src/services/StateService';
import { DataService, BUILT_IN_PROJECT_SCOPE_CARD_TYPES } from '../../src/services/DataService';
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
import { buildEndGameStats } from '../../src/utils/endGameStats';
import type { Card } from '../../src/types/DataTypes';

const DATA_DIR = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
const read = (f: string) => readFileSync(join(DATA_DIR, f), 'utf-8');
const RENAMED = 'DND-WORK-01';

class NodeDataService extends DataService {
  template!: Card;
  async loadData(): Promise<void> {
    const self = this as any;
    self.gameConfigs = self.parseGameConfigCsv(read('GAME_CONFIG.csv'));
    self.movements = self.parseMovementCsv(read('MOVEMENT.csv'));
    self.diceOutcomes = self.parseDiceOutcomesCsv(read('DICE_OUTCOMES.csv'));
    self.spaceEffects = self.parseSpaceEffectsCsv(read('SPACE_EFFECTS.csv'));
    self.diceEffects = self.parseDiceEffectsCsv(read('DICE_EFFECTS.csv'));
    self.spaceContents = self.parseSpaceContentCsv(read('SPACE_CONTENT.csv'));
    self.cardTypeLabels = self.parseCardTypeLabelsCsv(read('CARD_TYPES.csv'));
    const cards: Card[] = self.parseCardsCsv(read('CARDS_EXPANDED.csv'));
    // A real Work Package with a cost, a work cost and a trade, cloned under
    // an ID that does not start with W.
    this.template = cards.find(c => c.card_type === 'W' && (c.cost ?? 0) > 0 && !!c.work_cost && !!c.work_type_restriction)!;
    self.cards = [...cards, { ...this.template, card_id: RENAMED }];
    self.buildSpaces();
    self.loaded = true;
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

  stateService.addPlayer('Alice');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  const hold = (hand: string[], space = 'OWNER-SCOPE-INITIATION') =>
    stateService.updatePlayer({ id: playerId, hand, activeCards: [], currentSpace: space, visitType: 'First' });
  return { dataService, stateService, gameRulesService, cardService, turnService, playerId, hold };
}

describe('the project-scope card family is data, read by card_type (leak #14)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shipped CARD_TYPES.csv: Work Packages are the only scope family; the fallback matches it', async () => {
    const { dataService } = await buildGame();
    expect(dataService.getProjectScopeCardTypes()).toEqual(['W']);
    expect([...BUILT_IN_PROJECT_SCOPE_CARD_TYPES]).toEqual(dataService.getProjectScopeCardTypes());
  });

  it('a Work Package counts by its TYPE, whatever its ID — and other families do not', async () => {
    const { dataService } = await buildGame();
    expect(dataService.isProjectScopeCard(RENAMED)).toBe(true);
    expect(dataService.isProjectScopeCard(dataService.template.card_id)).toBe(true);
    expect(dataService.isProjectScopeCard('E001')).toBe(false);
    // Generated instance IDs resolve by their base ID, as before.
    expect(dataService.isProjectScopeCard(`${dataService.template.card_id}_1756274803252_sezfko0rc_0`)).toBe(true);
  });

  it('scope, work cost and project length all include the renamed Work Package', async () => {
    const { gameRulesService, dataService, playerId, hold } = await buildGame();
    hold([RENAMED]);
    const t = dataService.template;
    expect(gameRulesService.calculateProjectScope(playerId)).toBe(t.cost);
    expect(gameRulesService.calculateTotalWorkCost(playerId)).toBe(Number(t.work_cost));
    expect(gameRulesService.calculateEstimatedProjectLength(playerId).uniqueWorkTypes).toEqual([t.work_type_restriction]);
  });

  it('the leave gate at "Meet the Owner" accepts a renamed Work Package and still blocks an empty hand', async () => {
    const empty = await buildGame();
    empty.hold([]);
    await expect(empty.turnService.endTurnWithMovement(true)).rejects.toThrow(/needs scope/);

    const renamed = await buildGame();
    renamed.hold([RENAMED]);
    const outcome = await renamed.turnService.endTurnWithMovement(true).then(() => 'ok', (e: Error) => e.message);
    expect(outcome).not.toMatch(/needs scope/);
  }, 20000);

  it('the bulk-permit check counts renamed Work Packages gained this turn', async () => {
    const { cardService, stateService, playerId, hold } = await buildGame();
    hold([RENAMED, RENAMED, RENAMED]);
    vi.spyOn(stateService, 'getRealPlayerState').mockReturnValue({ hand: [] } as any);
    expect((cardService as any).playerFiledBulkPermitsThisTurn(playerId)).toBe(true);
  });

  it('the end screen counts the renamed Work Package', async () => {
    const { dataService, stateService, playerId, hold } = await buildGame();
    hold([RENAMED, 'E001']);
    const stats = buildEndGameStats(stateService.getPlayer(playerId)!, {
      projectScope: 0,
      isProjectScopeCard: id => dataService.isProjectScopeCard(id),
    });
    expect(stats.construction.workCardCount).toBe(1);
  });

  it('a reskin names a different scope family — no code change', () => {
    const ds = new DataService();
    (ds as any).cardTypeLabels = (ds as any).parseCardTypeLabelsCsv(
      'card_type,label,is_playable_from_hand,is_project_scope\nW,Work Package,No,No\nQ,Quest,No,Yes\n'
    );
    (ds as any).cards = [
      { card_id: 'Q-DRAGON', card_type: 'Q', card_name: 'Slay the dragon' },
      { card_id: 'W001', card_type: 'W', card_name: 'Foundation' },
    ];
    (ds as any).buildSpaces();
    expect(ds.isProjectScopeCard('Q-DRAGON')).toBe(true);
    expect(ds.isProjectScopeCard('W001')).toBe(false);
  });

  it('a CARD_TYPES.csv without the column falls back to Work Packages — loudly, once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ds = new DataService();
    (ds as any).cardTypeLabels = (ds as any).parseCardTypeLabelsCsv('card_type,label\nW,Work Package\nE,Expeditor\n');
    expect(ds.getProjectScopeCardTypes()).toEqual(['W']);
    ds.getProjectScopeCardTypes();
    expect(warn.mock.calls.filter(c => String(c[0]).includes('is_project_scope'))).toHaveLength(1);
  });
});
