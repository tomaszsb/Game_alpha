/**
 * E2E-Multiplayer2P.test.ts
 *
 * Tests 2-player multiplayer functionality:
 * - Turn switching between players
 * - State isolation (each player has separate cards, money, position)
 * - Both players can complete turns
 * - Game correctly tracks current player
 * - Player order is maintained
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

describe('E2E: 2-Player Multiplayer Game', () => {
  let dataService: DataService;
  let stateService: StateService;
  let turnService: TurnService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let choiceService: ChoiceService;
  let aliceId: string;
  let bobId: string;

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
    const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
    const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingService);
    const effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as any, gameRulesService, targetingService, loggingService, dataService, notificationService, financialEffectHandler, cardEffectHandler);
    const negotiationService = new NegotiationService(stateService, effectEngineService);
    turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService, choiceService, notificationService);
    turnService.setEffectEngineService(effectEngineService);
    effectEngineService.setTurnService(turnService);
    cardService.setEffectEngineService(effectEngineService);

    // Create and wire CardEffectService for manual card actions
    const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);
    turnService.setCardEffectService(cardEffectService);
  });

  it('should initialize a 2-player game correctly', () => {
    // Add two players
    stateService.addPlayer('Alice');
    stateService.addPlayer('Bob');

    const players = stateService.getAllPlayers();
    expect(players.length).toBe(2);

    aliceId = players.find(p => p.name === 'Alice')!.id;
    bobId = players.find(p => p.name === 'Bob')!.id;

    expect(aliceId).toBeDefined();
    expect(bobId).toBeDefined();
    expect(aliceId).not.toBe(bobId);

    console.log(`✅ Players created: Alice (${aliceId}), Bob (${bobId})`);
  });

  it('should start game with first player as current', () => {
    stateService.setCurrentPlayer(aliceId);
    stateService.startGame();

    const gameState = stateService.getGameState();
    expect(gameState.currentPlayerId).toBe(aliceId);
    expect(gameState.gamePhase).toBe('PLAY');

    console.log('✅ Game started with Alice as first player');
  });

  it('should have both players at starting space', () => {
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;

    expect(alice.currentSpace).toBe('OWNER-SCOPE-INITIATION');
    expect(bob.currentSpace).toBe('OWNER-SCOPE-INITIATION');

    console.log('✅ Both players at starting space');
  });

  it('should maintain separate state for each player', () => {
    // Give Alice some money and a card
    stateService.updatePlayer({ id: aliceId, money: 5000 });
    stateService.updatePlayer({ id: aliceId, hand: ['W001'] });

    // Give Bob different money and card
    stateService.updatePlayer({ id: bobId, money: 3000 });
    stateService.updatePlayer({ id: bobId, hand: ['E001', 'E002'] });

    // Verify state isolation
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;

    expect(alice.money).toBe(5000);
    expect(alice.hand).toEqual(['W001']);

    expect(bob.money).toBe(3000);
    expect(bob.hand).toEqual(['E001', 'E002']);

    console.log('✅ Player state is isolated: Alice $5000/1 card, Bob $3000/2 cards');
  });

  it('should allow Alice to complete first turn and switch to Bob', async () => {
    let nextRoll = 1;
    (vi.spyOn(turnService, 'rollDice') as any).mockImplementation((pid: any) => {
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
      stateService.setPlayerHasRolledDice();
      return nextRoll;
    });

    // Start Alice's turn
    await turnService.startTurn(aliceId);
    expect(stateService.getGameState().currentPlayerId).toBe(aliceId);

    // Alice's first space is OWNER-SCOPE-INITIATION (auto movement)
    const alice = stateService.getPlayer(aliceId)!;
    expect(alice.currentSpace).toBe('OWNER-SCOPE-INITIATION');

    // Process manual effects if any
    const effects = dataService.getSpaceEffects(alice.currentSpace, alice.visitType);
    for (const effect of effects) {
      if (effect.trigger_type === 'manual' && effect.effect_type !== 'turn') {
        const key = `${effect.effect_type}:${effect.effect_action}`;
        if (effect.effect_type === 'dice') {
          await turnService.rollDiceWithFeedback(aliceId);
          stateService.updateGameState({ hasPlayerMovedThisTurn: false });
        } else {
          const promise = turnService.triggerManualEffect(aliceId, key);
          await new Promise(r => setTimeout(r, 10));
          const choice = stateService.getGameState().awaitingChoice;
          if (choice && choice.type !== 'MOVEMENT') {
            choiceService.resolveChoice(choice.id, choice.options[0].id);
          }
          await promise;
        }
      }
    }

    // End Alice's turn
    await turnService.endTurnWithMovement(true);

    // Verify turn switched to Bob
    expect(stateService.getGameState().currentPlayerId).toBe(bobId);
    console.log('✅ Alice completed turn, switched to Bob');
  });

  it('should allow Bob to complete turn and switch back to Alice', async () => {
    let nextRoll = 1;
    (vi.spyOn(turnService, 'rollDice') as any).mockImplementation((pid: any) => {
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
      stateService.setPlayerHasRolledDice();
      return nextRoll;
    });

    // Bob's turn should have started
    expect(stateService.getGameState().currentPlayerId).toBe(bobId);
    await turnService.startTurn(bobId);

    const bob = stateService.getPlayer(bobId)!;
    console.log(`📍 Bob at: ${bob.currentSpace}`);

    // Process Bob's turn
    const effects = dataService.getSpaceEffects(bob.currentSpace, bob.visitType);
    for (const effect of effects) {
      if (effect.trigger_type === 'manual' && effect.effect_type !== 'turn') {
        const key = `${effect.effect_type}:${effect.effect_action}`;
        if (effect.effect_type === 'dice') {
          await turnService.rollDiceWithFeedback(bobId);
          stateService.updateGameState({ hasPlayerMovedThisTurn: false });
        } else {
          const promise = turnService.triggerManualEffect(bobId, key);
          await new Promise(r => setTimeout(r, 10));
          const choice = stateService.getGameState().awaitingChoice;
          if (choice && choice.type !== 'MOVEMENT') {
            choiceService.resolveChoice(choice.id, choice.options[0].id);
          }
          await promise;
        }
      }
    }

    // End Bob's turn
    await turnService.endTurnWithMovement(true);

    // Verify turn switched back to Alice
    expect(stateService.getGameState().currentPlayerId).toBe(aliceId);
    console.log('✅ Bob completed turn, switched back to Alice');
  });

  it('should track different positions as players progress', async () => {
    let nextRoll = 1;
    (vi.spyOn(turnService, 'rollDice') as any).mockImplementation((pid: any) => {
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
      stateService.setPlayerHasRolledDice();
      return nextRoll;
    });

    // Play a few more turns to get players to different positions
    const playTurn = async (playerId: string, desiredNext?: string) => {
      expect(stateService.getGameState().currentPlayerId).toBe(playerId);
      await turnService.startTurn(playerId);

      const player = stateService.getPlayer(playerId)!;

      // Handle automatic funding at OWNER-FUND-INITIATION
      if (player.currentSpace === 'OWNER-FUND-INITIATION') {
        await turnService.handleAutomaticFunding(playerId);
      }

      const effects = dataService.getSpaceEffects(player.currentSpace, player.visitType);
      for (const effect of effects) {
        if (effect.trigger_type === 'manual' && effect.effect_type !== 'turn') {
          const key = `${effect.effect_type}:${effect.effect_action}`;
          if (effect.effect_type === 'dice') {
            await turnService.rollDiceWithFeedback(playerId);
            stateService.updateGameState({ hasPlayerMovedThisTurn: false });
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

      await turnService.endTurnWithMovement(true);
    };

    // Alice's turn 2 (at OWNER-FUND-INITIATION)
    await playTurn(aliceId);

    // Bob's turn 2 (at OWNER-FUND-INITIATION)
    await playTurn(bobId);

    // Alice's turn 3 (at PM-DECISION-CHECK)
    await playTurn(aliceId, 'ARCH-INITIATION');

    // Bob's turn 3 (at PM-DECISION-CHECK) - Bob goes different path
    await playTurn(bobId, 'LEND-SCOPE-CHECK');

    // Now they should be at different positions
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;

    console.log(`📍 Final positions - Alice: ${alice.currentSpace}, Bob: ${bob.currentSpace}`);

    expect(alice.currentSpace).not.toBe(bob.currentSpace);
    expect(alice.currentSpace).toBe('ARCH-INITIATION');
    expect(bob.currentSpace).toBe('LEND-SCOPE-CHECK');

    console.log('✅ Players are on different paths as expected');
  });

  it('should maintain game turn tracking', () => {
    const gameState = stateService.getGameState();

    // The turn counter exists and is a number
    expect(typeof gameState.turn).toBe('number');

    // Game is still in PLAY phase (not ended prematurely)
    expect(gameState.gamePhase).toBe('PLAY');

    console.log(`✅ Game turn tracking active, phase: ${gameState.gamePhase}`);
  });

  it('should track time spent independently for each player', () => {
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;

    // Both players have spent some time progressing
    expect(alice.timeSpent).toBeGreaterThanOrEqual(0);
    expect(bob.timeSpent).toBeGreaterThanOrEqual(0);

    console.log(`✅ Time tracking - Alice: ${alice.timeSpent} days, Bob: ${bob.timeSpent} days`);
  });

  it('should preserve player order throughout the game', () => {
    const players = stateService.getAllPlayers();

    // Player order should be preserved
    expect(players[0].name).toBe('Alice');
    expect(players[1].name).toBe('Bob');

    console.log('✅ Player order preserved: Alice, Bob');
  });
});
