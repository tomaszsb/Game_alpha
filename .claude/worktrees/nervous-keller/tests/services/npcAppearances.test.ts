// tests/services/npcAppearances.test.ts
// Tests for NPC appearance randomization in StateService.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { createMockDataService } from '../mocks/mockServices';
import { ALL_IMAGE_ROLES, ALL_ETHNICITIES, ALL_GENDERS, NpcAppearances } from '../../src/constants/characters';

describe('NPC Appearances in StateService', () => {
  let stateService: StateService;
  let mockDataService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataService = createMockDataService();
    mockDataService.isLoaded.mockReturnValue(true);
    mockDataService.getGameConfig.mockReturnValue([
      { space_name: 'OWNER-SCOPE-INITIATION', is_starting_space: true, min_players: 1, max_players: 4 }
    ] as any);
    mockDataService.getMovement.mockReturnValue(undefined);
    mockDataService.getCardsByType.mockReturnValue([]);

    stateService = new StateService(mockDataService);
    stateService.addPlayer('Alice');
    stateService.addPlayer('Bob');
  });

  describe('Battle Royale mode', () => {
    it('should set npcAppearances when starting game', () => {
      const state = stateService.startGame();
      expect(state.npcAppearances).toBeDefined();
    });

    it('should assign an appearance to every image role', () => {
      const state = stateService.startGame();
      const appearances = state.npcAppearances!;

      for (const role of ALL_IMAGE_ROLES) {
        expect(appearances[role]).toBeDefined();
        expect(ALL_ETHNICITIES).toContain(appearances[role].ethnicity);
        expect(ALL_GENDERS).toContain(appearances[role].gender);
      }
    });

    it('should use valid ethnicity/gender combinations', () => {
      const state = stateService.startGame();
      const appearances = state.npcAppearances!;

      for (const role of ALL_IMAGE_ROLES) {
        const { ethnicity, gender } = appearances[role];
        expect(typeof ethnicity).toBe('string');
        expect(typeof gender).toBe('string');
        expect(['asian', 'black', 'hispanic', 'white']).toContain(ethnicity);
        expect(['male', 'female']).toContain(gender);
      }
    });

    it('should use at least 7 distinct appearances across 9 roles', () => {
      // 8 possible combos assigned to 9 roles — at most 1 repeat
      const state = stateService.startGame();
      const appearances = state.npcAppearances!;

      const unique = new Set<string>();
      for (const role of ALL_IMAGE_ROLES) {
        const { ethnicity, gender } = appearances[role];
        unique.add(`${ethnicity}_${gender}`);
      }
      // With 9 roles and 8 combos, we expect 8 unique (one wraps around)
      // But randomization could theoretically produce fewer, so check at least 7
      expect(unique.size).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Same Start mode', () => {
    it('should set npcAppearances when starting in SAME_START mode', () => {
      const state = stateService.startGame({ gameMode: 'SAME_START', startingMode: 'QUICK_START' });
      expect(state.npcAppearances).toBeDefined();

      for (const role of ALL_IMAGE_ROLES) {
        expect(state.npcAppearances![role]).toBeDefined();
      }
    });
  });

  describe('randomization', () => {
    it('should produce different results across multiple game starts', () => {
      // Run multiple starts and check that at least one differs
      const results: NpcAppearances[] = [];
      for (let i = 0; i < 5; i++) {
        const fresh = new StateService(mockDataService);
        fresh.addPlayer('Alice');
        fresh.addPlayer('Bob');
        const state = fresh.startGame();
        results.push(state.npcAppearances!);
      }

      // Serialize each result and check not all identical
      const serialized = results.map(r => JSON.stringify(r));
      const unique = new Set(serialized);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('backward compatibility', () => {
    it('should not have npcAppearances in initial state before game start', () => {
      const state = stateService.getGameState();
      expect(state.npcAppearances).toBeUndefined();
    });
  });
});
