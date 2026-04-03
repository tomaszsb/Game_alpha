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
import { readFileSync } from 'fs';
import { join } from 'path';

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

describe('Logic E2E: Full Game Playthrough', () => {
  let dataService: DataService;
  let stateService: StateService;
  let turnService: TurnService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let choiceService: ChoiceService;

  beforeAll(async () => {
    dataService = new NodeDataService();
    await dataService.loadData();
    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    const resourceService = new ResourceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    stateService.setGameRulesService(gameRulesService);
    choiceService = new ChoiceService(stateService);
    cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
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
  });

  it('should complete a full game from START to FINISH via services', async () => {
    stateService.addPlayer('Alice');
    const player = stateService.getAllPlayers()[0];
    const playerId = player.id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();
    await turnService.startTurn(playerId);

    console.log('🏁 Starting Logic Playthrough');

    let nextRoll = 1;
    vi.spyOn(turnService, 'rollDice').mockImplementation((pid) => {
        stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
        stateService.setPlayerHasRolledDice();
        return nextRoll;
    });

    const playStep = async (expectedSpace: string, desiredNext?: string, roll?: number) => {
        const p = stateService.getPlayer(playerId)!;
        expect(p.currentSpace).toBe(expectedSpace);
        console.log(`📍 Step: ${p.currentSpace} (${p.visitType})`);

        if (p.currentSpace === 'OWNER-FUND-INITIATION') {
            await turnService.handleAutomaticFunding(playerId);
        }

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

        if (desiredNext) {
            stateService.setPlayerMoveIntent(playerId, desiredNext);
        }

        // FORCE A ROLL if movement is dice-based but no manual action occurred
        const movement = dataService.getMovement(p.currentSpace, p.visitType);
        if (movement?.movement_type === 'dice' || movement?.movement_type === 'dice_outcome') {
            nextRoll = roll || 1;
            await turnService.rollDice(playerId);
        }

        nextRoll = roll || 1;
        await turnService.endTurnWithMovement(true);
        console.log(`✅ Turn Ended. New Space: ${stateService.getPlayer(playerId)?.currentSpace}`);
    };

    await playStep('OWNER-SCOPE-INITIATION');
    await playStep('OWNER-FUND-INITIATION');
    await playStep('PM-DECISION-CHECK', 'ARCH-INITIATION');
    await playStep('ARCH-INITIATION');
    await playStep('ARCH-FEE-REVIEW');
    await playStep('ARCH-SCOPE-CHECK', 'ENG-INITIATION');
    await playStep('ENG-INITIATION');
    await playStep('ENG-FEE-REVIEW');
    await playStep('ENG-SCOPE-CHECK', 'REG-DOB-FEE-REVIEW');
    await playStep('REG-DOB-FEE-REVIEW');
    await playStep('REG-DOB-TYPE-SELECT', 'REG-DOB-PROF-CERT');
    await playStep('REG-DOB-PROF-CERT', undefined, 1);   // roll 1 → REG-DOB-AUDIT
    await playStep('REG-DOB-AUDIT', undefined, 1);       // roll 1 → REG-DOB-FINAL-REVIEW
    await playStep('REG-DOB-FINAL-REVIEW', undefined, 1); // roll 1 → FINISH

    expect(stateService.getPlayer(playerId)!.currentSpace).toBe('FINISH');
    expect(stateService.getGameState().isGameOver).toBe(true);
    expect(stateService.getGameState().winner).toBe(playerId);

    console.log('🏆 LOGIC PLAYTHROUGH SUCCESSFUL!');
  }, 60000);
});