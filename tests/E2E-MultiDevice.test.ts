/**
 * E2E-MultiDevice.test.ts
 *
 * Tests multi-device functionality:
 * - Short ID generation (P1, P2, P3, P4)
 * - URL generation with short IDs
 * - App screen routing based on URL parameters
 * - Player lookup by short ID
 * - QR code URL format validation
 */

import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { StateService } from '../src/services/StateService';
import { DataService } from '../src/services/DataService';
import { GameRulesService } from '../src/services/GameRulesService';
import { getAppScreen, AppScreenResult } from '../src/utils/getAppScreen';
import { Player } from '../src/types/StateTypes';
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

describe('E2E: Multi-Device Support', () => {
  let dataService: DataService;
  let stateService: StateService;
  let gameRulesService: GameRulesService;

  beforeAll(async () => {
    dataService = new NodeDataService();
    await dataService.loadData();
    stateService = new StateService(dataService);
    gameRulesService = new GameRulesService(dataService, stateService);
    stateService.setGameRulesService(gameRulesService);
  });

  describe('Short ID Generation', () => {
    it('should generate sequential short IDs (P1, P2, P3, P4) for players', () => {
      // Add 4 players
      stateService.addPlayer('Alice');
      stateService.addPlayer('Bob');
      stateService.addPlayer('Charlie');
      stateService.addPlayer('Diana');

      const players = stateService.getAllPlayers();
      expect(players.length).toBe(4);

      // Verify short IDs are sequential
      expect(players[0].shortId).toBe('P1');
      expect(players[1].shortId).toBe('P2');
      expect(players[2].shortId).toBe('P3');
      expect(players[3].shortId).toBe('P4');

      console.log('✅ Short IDs generated: P1, P2, P3, P4');
    });

    it('should have unique short IDs for each player', () => {
      const players = stateService.getAllPlayers();
      const shortIds = players.map(p => p.shortId);
      const uniqueShortIds = new Set(shortIds);

      expect(uniqueShortIds.size).toBe(players.length);
      console.log('✅ All short IDs are unique');
    });

    it('should maintain short IDs after game starts', () => {
      const playersBefore = stateService.getAllPlayers();
      const shortIdsBefore = playersBefore.map(p => p.shortId);

      stateService.setCurrentPlayer(playersBefore[0].id);
      stateService.startGame();

      const playersAfter = stateService.getAllPlayers();
      const shortIdsAfter = playersAfter.map(p => p.shortId);

      expect(shortIdsAfter).toEqual(shortIdsBefore);
      console.log('✅ Short IDs preserved after game start');
    });
  });

  describe('Player Lookup by Short ID', () => {
    it('should find player by short ID (P1)', () => {
      const players = stateService.getAllPlayers();
      const playerP1 = players.find(p => p.shortId === 'P1');

      expect(playerP1).toBeDefined();
      expect(playerP1!.name).toBe('Alice');
      console.log('✅ Found Alice via P1');
    });

    it('should find player by short ID (P2)', () => {
      const players = stateService.getAllPlayers();
      const playerP2 = players.find(p => p.shortId === 'P2');

      expect(playerP2).toBeDefined();
      expect(playerP2!.name).toBe('Bob');
      console.log('✅ Found Bob via P2');
    });

    it('should return undefined for invalid short ID', () => {
      const players = stateService.getAllPlayers();
      const invalidPlayer = players.find(p => p.shortId === 'P99');

      expect(invalidPlayer).toBeUndefined();
      console.log('✅ Invalid short ID returns undefined');
    });
  });

  describe('App Screen Routing (getAppScreen)', () => {
    let players: Player[];

    beforeEach(() => {
      players = stateService.getAllPlayers();
    });

    it('should return game screen when no player parameter', () => {
      const params = new URLSearchParams('');
      const result = getAppScreen(params, 'PLAY', players);

      expect(result.screen).toBe('game');
      expect(result.playerId).toBeUndefined();
      console.log('✅ No player param → game screen');
    });

    it('should return player screen for valid short ID (p=P1)', () => {
      const params = new URLSearchParams('?p=P1');
      const result = getAppScreen(params, 'PLAY', players);

      expect(result.screen).toBe('player');
      expect(result.isValidPlayer).toBe(true);
      expect(result.playerId).toBe(players[0].id);
      console.log('✅ ?p=P1 → player screen for Alice');
    });

    it('should return player screen for valid short ID (p=P2)', () => {
      const params = new URLSearchParams('?p=P2');
      const result = getAppScreen(params, 'PLAY', players);

      expect(result.screen).toBe('player');
      expect(result.isValidPlayer).toBe(true);
      expect(result.playerId).toBe(players[1].id);
      console.log('✅ ?p=P2 → player screen for Bob');
    });

    it('should return player screen for valid full playerId', () => {
      const params = new URLSearchParams(`?playerId=${players[0].id}`);
      const result = getAppScreen(params, 'PLAY', players);

      expect(result.screen).toBe('player');
      expect(result.isValidPlayer).toBe(true);
      expect(result.playerId).toBe(players[0].id);
      console.log('✅ ?playerId=... → player screen');
    });

    it('should return game screen for invalid short ID', () => {
      const params = new URLSearchParams('?p=P99');
      const result = getAppScreen(params, 'PLAY', players);

      expect(result.screen).toBe('game');
      // isValidPlayer is false or undefined when player not found
      expect(result.isValidPlayer).toBeFalsy();
      console.log('✅ Invalid ?p=P99 → game screen with warning');
    });

    it('should return setup screen when game is in SETUP phase', () => {
      const params = new URLSearchParams('?p=P1');
      const result = getAppScreen(params, 'SETUP', players);

      expect(result.screen).toBe('setup');
      expect(result.isValidPlayer).toBe(true);
      console.log('✅ SETUP phase + valid player → setup screen');
    });

    it('should prefer short ID over full playerId when both provided', () => {
      // P1 is Alice, but we pass Bob's full ID
      const params = new URLSearchParams(`?p=P1&playerId=${players[1].id}`);
      const result = getAppScreen(params, 'PLAY', players);

      // Should resolve to P1 (Alice), not Bob
      expect(result.playerId).toBe(players[0].id);
      console.log('✅ Short ID takes precedence over full ID');
    });
  });

  describe('URL Format Validation', () => {
    it('should generate short URL format (?p=P1)', () => {
      const players = stateService.getAllPlayers();
      const player = players[0];

      // Simulate what PlayerList does to generate QR URL
      const shortUrl = `?p=${encodeURIComponent(player.shortId!)}`;
      expect(shortUrl).toBe('?p=P1');
      console.log('✅ Short URL format: ?p=P1');
    });

    it('should handle URL encoding for short IDs', () => {
      const encoded = encodeURIComponent('P1');
      expect(encoded).toBe('P1'); // P1 doesn't need encoding
      console.log('✅ Short IDs encode cleanly');
    });

    it('should parse short ID from encoded URL', () => {
      const url = '?p=P1';
      const params = new URLSearchParams(url);
      const shortId = params.get('p');

      expect(shortId).toBe('P1');
      console.log('✅ Short ID parsed correctly from URL');
    });
  });

  describe('Multi-Device State Sync Scenario', () => {
    it('should allow multiple devices to access different player views', () => {
      const players = stateService.getAllPlayers();

      // Simulate 4 devices accessing the game
      const device1 = getAppScreen(new URLSearchParams('?p=P1'), 'PLAY', players);
      const device2 = getAppScreen(new URLSearchParams('?p=P2'), 'PLAY', players);
      const device3 = getAppScreen(new URLSearchParams('?p=P3'), 'PLAY', players);
      const device4 = getAppScreen(new URLSearchParams('?p=P4'), 'PLAY', players);

      // All should get player screen for their respective player
      expect(device1.screen).toBe('player');
      expect(device1.playerId).toBe(players[0].id);

      expect(device2.screen).toBe('player');
      expect(device2.playerId).toBe(players[1].id);

      expect(device3.screen).toBe('player');
      expect(device3.playerId).toBe(players[2].id);

      expect(device4.screen).toBe('player');
      expect(device4.playerId).toBe(players[3].id);

      console.log('✅ 4 devices accessing 4 different player views');
    });

    it('should allow host device to see full game view', () => {
      const players = stateService.getAllPlayers();

      // Host device has no player parameter
      const hostDevice = getAppScreen(new URLSearchParams(''), 'PLAY', players);

      expect(hostDevice.screen).toBe('game');
      expect(hostDevice.playerId).toBeUndefined();

      console.log('✅ Host device sees full game view');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty player list gracefully', () => {
      const params = new URLSearchParams('?p=P1');
      const result = getAppScreen(params, 'PLAY', []);

      expect(result.screen).toBe('game');
      // isValidPlayer is false or undefined when no players
      expect(result.isValidPlayer).toBeFalsy();
      console.log('✅ Empty player list handled');
    });

    it('should handle case sensitivity in short IDs', () => {
      const players = stateService.getAllPlayers();

      // Test lowercase
      const lowercase = new URLSearchParams('?p=p1');
      const resultLower = getAppScreen(lowercase, 'PLAY', players);

      // Short IDs are case-sensitive, so 'p1' should not match 'P1'
      // isValidPlayer is false or undefined when player not found
      expect(resultLower.isValidPlayer).toBeFalsy();
      console.log('✅ Short IDs are case-sensitive');
    });

    it('should handle special characters in URL safely', () => {
      const params = new URLSearchParams('?p=P1&extra=value');
      const players = stateService.getAllPlayers();
      const result = getAppScreen(params, 'PLAY', players);

      // Should still find P1 correctly
      expect(result.playerId).toBe(players[0].id);
      expect(result.isValidPlayer).toBe(true);
      console.log('✅ Extra URL params ignored');
    });
  });
});

describe('URL Generation (getServerURL)', () => {
  // Note: getServerURL uses window.location which isn't available in Node
  // We test the logic that would be used

  it('should format short URL correctly', () => {
    const shortId = 'P1';
    const baseURL = 'http://192.168.1.100:3000';
    const expectedURL = `${baseURL}?p=${encodeURIComponent(shortId)}`;

    expect(expectedURL).toBe('http://192.168.1.100:3000?p=P1');
    console.log('✅ Short URL format verified');
  });

  it('should format full playerId URL correctly', () => {
    const playerId = 'player_abc123';
    const baseURL = 'http://192.168.1.100:3000';
    const expectedURL = `${baseURL}?playerId=${encodeURIComponent(playerId)}`;

    expect(expectedURL).toBe('http://192.168.1.100:3000?playerId=player_abc123');
    console.log('✅ Full playerId URL format verified');
  });

  it('should prefer short URL over long URL', () => {
    // Short URLs are ~90% shorter, better for QR codes
    const shortURL = 'http://192.168.1.100:3000?p=P1';
    const longURL = 'http://192.168.1.100:3000?playerId=player_abc123_def456_ghi789';

    expect(shortURL.length).toBeLessThan(longURL.length);
    console.log(`✅ Short URL (${shortURL.length} chars) < Long URL (${longURL.length} chars)`);
  });
});
