/**
 * E2E-Multiplayer4P.test.ts
 *
 * Tests 3-4 player multiplayer functionality:
 * - Turn order with 3+ players
 * - State isolation across all players
 * - All players can take different paths
 * - Correct player rotation
 * - Game handles max player count (4)
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

describe('E2E: 4-Player Multiplayer Game', () => {
  let dataService: DataService;
  let stateService: StateService;
  let turnService: TurnService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let choiceService: ChoiceService;
  let aliceId: string;
  let bobId: string;
  let charlieId: string;
  let dianaId: string;

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

  it('should initialize a 4-player game correctly', () => {
    // Add four players
    stateService.addPlayer('Alice');
    stateService.addPlayer('Bob');
    stateService.addPlayer('Charlie');
    stateService.addPlayer('Diana');

    const players = stateService.getAllPlayers();
    expect(players.length).toBe(4);

    aliceId = players.find(p => p.name === 'Alice')!.id;
    bobId = players.find(p => p.name === 'Bob')!.id;
    charlieId = players.find(p => p.name === 'Charlie')!.id;
    dianaId = players.find(p => p.name === 'Diana')!.id;

    expect(aliceId).toBeDefined();
    expect(bobId).toBeDefined();
    expect(charlieId).toBeDefined();
    expect(dianaId).toBeDefined();

    // All IDs should be unique
    const ids = [aliceId, bobId, charlieId, dianaId];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);

    console.log(`✅ 4 Players created: Alice, Bob, Charlie, Diana`);
  });

  it('should start game with first player as current', () => {
    stateService.setCurrentPlayer(aliceId);
    stateService.startGame();

    const gameState = stateService.getGameState();
    expect(gameState.currentPlayerId).toBe(aliceId);
    expect(gameState.gamePhase).toBe('PLAY');

    console.log('✅ Game started with Alice as first player');
  });

  it('should have all 4 players at starting space', () => {
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;
    const charlie = stateService.getPlayer(charlieId)!;
    const diana = stateService.getPlayer(dianaId)!;

    expect(alice.currentSpace).toBe('OWNER-SCOPE-INITIATION');
    expect(bob.currentSpace).toBe('OWNER-SCOPE-INITIATION');
    expect(charlie.currentSpace).toBe('OWNER-SCOPE-INITIATION');
    expect(diana.currentSpace).toBe('OWNER-SCOPE-INITIATION');

    console.log('✅ All 4 players at starting space');
  });

  it('should maintain separate state for each of 4 players', () => {
    // Give each player different resources
    stateService.updatePlayer({ id: aliceId, money: 1000, hand: ['W001'] });
    stateService.updatePlayer({ id: bobId, money: 2000, hand: ['E001', 'E002'] });
    stateService.updatePlayer({ id: charlieId, money: 3000, hand: ['B001'] });
    stateService.updatePlayer({ id: dianaId, money: 4000, hand: ['L001', 'L002', 'L003'] });

    // Verify state isolation
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;
    const charlie = stateService.getPlayer(charlieId)!;
    const diana = stateService.getPlayer(dianaId)!;

    expect(alice.money).toBe(1000);
    expect(alice.hand.length).toBe(1);

    expect(bob.money).toBe(2000);
    expect(bob.hand.length).toBe(2);

    expect(charlie.money).toBe(3000);
    expect(charlie.hand.length).toBe(1);

    expect(diana.money).toBe(4000);
    expect(diana.hand.length).toBe(3);

    console.log('✅ All 4 players have isolated state');
  });

  it('should rotate through all 4 players in correct order', async () => {
    let nextRoll = 1;
    vi.spyOn(turnService, 'rollDice').mockImplementation((pid) => {
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
      stateService.setPlayerHasRolledDice();
      return nextRoll;
    });

    const playTurn = async (expectedPlayerId: string, playerName: string) => {
      expect(stateService.getGameState().currentPlayerId).toBe(expectedPlayerId);
      await turnService.startTurn(expectedPlayerId);

      const player = stateService.getPlayer(expectedPlayerId)!;

      // Process manual effects
      const effects = dataService.getSpaceEffects(player.currentSpace, player.visitType);
      for (const effect of effects) {
        if (effect.trigger_type === 'manual' && effect.effect_type !== 'turn') {
          const key = `${effect.effect_type}:${effect.effect_action}`;
          if (effect.effect_type === 'dice') {
            await turnService.rollDice(expectedPlayerId);
          } else {
            const promise = turnService.triggerManualEffect(expectedPlayerId, key);
            await new Promise(r => setTimeout(r, 10));
            const choice = stateService.getGameState().awaitingChoice;
            if (choice && choice.type !== 'MOVEMENT') {
              choiceService.resolveChoice(choice.id, choice.options[0].id);
            }
            await promise;
          }
        }
      }

      await turnService.endTurnWithMovement(true);
      console.log(`✅ ${playerName}'s turn completed`);
    };

    // Round 1: All 4 players take their first turn
    await playTurn(aliceId, 'Alice');
    expect(stateService.getGameState().currentPlayerId).toBe(bobId);

    await playTurn(bobId, 'Bob');
    expect(stateService.getGameState().currentPlayerId).toBe(charlieId);

    await playTurn(charlieId, 'Charlie');
    expect(stateService.getGameState().currentPlayerId).toBe(dianaId);

    await playTurn(dianaId, 'Diana');
    // Should cycle back to Alice
    expect(stateService.getGameState().currentPlayerId).toBe(aliceId);

    console.log('✅ Full rotation completed: Alice → Bob → Charlie → Diana → Alice');
  });

  it('should allow all 4 players to take different paths', async () => {
    let nextRoll = 1;
    vi.spyOn(turnService, 'rollDice').mockImplementation((pid) => {
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
      stateService.setPlayerHasRolledDice();
      return nextRoll;
    });

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

      await turnService.endTurnWithMovement(true);
    };

    // Round 2: All at OWNER-FUND-INITIATION
    await playTurn(aliceId);
    await playTurn(bobId);
    await playTurn(charlieId);
    await playTurn(dianaId);

    // Round 3: At PM-DECISION-CHECK, each player chooses a different path
    // PM-DECISION-CHECK has 3 destinations: LEND-SCOPE-CHECK, ARCH-INITIATION, CHEAT-BYPASS
    await playTurn(aliceId, 'ARCH-INITIATION');      // Alice goes ARCH path
    await playTurn(bobId, 'LEND-SCOPE-CHECK');       // Bob goes LEND path
    await playTurn(charlieId, 'CHEAT-BYPASS');       // Charlie goes CHEAT path
    await playTurn(dianaId, 'ARCH-INITIATION');      // Diana also goes ARCH path

    // Verify all players are at different or expected positions
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;
    const charlie = stateService.getPlayer(charlieId)!;
    const diana = stateService.getPlayer(dianaId)!;

    console.log(`📍 Positions - Alice: ${alice.currentSpace}, Bob: ${bob.currentSpace}, Charlie: ${charlie.currentSpace}, Diana: ${diana.currentSpace}`);

    expect(alice.currentSpace).toBe('ARCH-INITIATION');
    expect(bob.currentSpace).toBe('LEND-SCOPE-CHECK');
    expect(charlie.currentSpace).toBe('CHEAT-BYPASS');
    expect(diana.currentSpace).toBe('ARCH-INITIATION');

    // Bob and Charlie should be on unique paths
    expect(bob.currentSpace).not.toBe(alice.currentSpace);
    expect(charlie.currentSpace).not.toBe(alice.currentSpace);
    expect(charlie.currentSpace).not.toBe(bob.currentSpace);

    console.log('✅ All 4 players on their chosen paths');
  });

  it('should track time spent independently for all 4 players', () => {
    const alice = stateService.getPlayer(aliceId)!;
    const bob = stateService.getPlayer(bobId)!;
    const charlie = stateService.getPlayer(charlieId)!;
    const diana = stateService.getPlayer(dianaId)!;

    // All players have time tracking
    expect(typeof alice.timeSpent).toBe('number');
    expect(typeof bob.timeSpent).toBe('number');
    expect(typeof charlie.timeSpent).toBe('number');
    expect(typeof diana.timeSpent).toBe('number');

    console.log(`✅ Time tracking - Alice: ${alice.timeSpent}, Bob: ${bob.timeSpent}, Charlie: ${charlie.timeSpent}, Diana: ${diana.timeSpent}`);
  });

  it('should preserve player order throughout the game', () => {
    const players = stateService.getAllPlayers();

    expect(players[0].name).toBe('Alice');
    expect(players[1].name).toBe('Bob');
    expect(players[2].name).toBe('Charlie');
    expect(players[3].name).toBe('Diana');

    console.log('✅ Player order preserved: Alice, Bob, Charlie, Diana');
  });

  it('should correctly identify all players in the game', () => {
    const gameState = stateService.getGameState();

    expect(gameState.players.length).toBe(4);

    // Verify each player has essential properties
    for (const player of gameState.players) {
      expect(player.id).toBeDefined();
      expect(player.name).toBeDefined();
      expect(player.currentSpace).toBeDefined();
      expect(typeof player.money).toBe('number');
      expect(Array.isArray(player.hand)).toBe(true);
    }

    console.log('✅ All 4 players have valid game state');
  });
});

describe('E2E: 3-Player Multiplayer Game', () => {
  let dataService: DataService;
  let stateService: StateService;
  let turnService: TurnService;
  let gameRulesService: GameRulesService;
  let choiceService: ChoiceService;
  let player1Id: string;
  let player2Id: string;
  let player3Id: string;

  beforeAll(async () => {
    dataService = new NodeDataService();
    await dataService.loadData();
    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    const resourceService = new ResourceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    stateService.setGameRulesService(gameRulesService);
    choiceService = new ChoiceService(stateService);
    const cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
    const movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService);
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

  it('should initialize a 3-player game correctly', () => {
    stateService.addPlayer('Player1');
    stateService.addPlayer('Player2');
    stateService.addPlayer('Player3');

    const players = stateService.getAllPlayers();
    expect(players.length).toBe(3);

    player1Id = players[0].id;
    player2Id = players[1].id;
    player3Id = players[2].id;

    console.log('✅ 3 Players created');
  });

  it('should rotate through 3 players correctly', async () => {
    stateService.setCurrentPlayer(player1Id);
    stateService.startGame();

    let nextRoll = 1;
    vi.spyOn(turnService, 'rollDice').mockImplementation((pid) => {
      stateService.updatePlayer({ id: pid, lastDiceRoll: { roll1: nextRoll, roll2: 0, total: nextRoll } });
      stateService.setPlayerHasRolledDice();
      return nextRoll;
    });

    const playTurn = async (expectedPlayerId: string) => {
      expect(stateService.getGameState().currentPlayerId).toBe(expectedPlayerId);
      await turnService.startTurn(expectedPlayerId);

      const player = stateService.getPlayer(expectedPlayerId)!;
      const effects = dataService.getSpaceEffects(player.currentSpace, player.visitType);
      for (const effect of effects) {
        if (effect.trigger_type === 'manual' && effect.effect_type !== 'turn') {
          const key = `${effect.effect_type}:${effect.effect_action}`;
          if (effect.effect_type === 'dice') {
            await turnService.rollDice(expectedPlayerId);
          } else {
            const promise = turnService.triggerManualEffect(expectedPlayerId, key);
            await new Promise(r => setTimeout(r, 10));
            const choice = stateService.getGameState().awaitingChoice;
            if (choice && choice.type !== 'MOVEMENT') {
              choiceService.resolveChoice(choice.id, choice.options[0].id);
            }
            await promise;
          }
        }
      }

      await turnService.endTurnWithMovement(true);
    };

    // Full rotation
    await playTurn(player1Id);
    expect(stateService.getGameState().currentPlayerId).toBe(player2Id);

    await playTurn(player2Id);
    expect(stateService.getGameState().currentPlayerId).toBe(player3Id);

    await playTurn(player3Id);
    expect(stateService.getGameState().currentPlayerId).toBe(player1Id);

    console.log('✅ 3-player rotation: P1 → P2 → P3 → P1');
  });

  it('should handle odd number of players correctly', () => {
    const players = stateService.getAllPlayers();
    expect(players.length).toBe(3);

    // Game phase should still be PLAY
    expect(stateService.getGameState().gamePhase).toBe('PLAY');

    console.log('✅ 3-player game handles odd player count correctly');
  });
});
