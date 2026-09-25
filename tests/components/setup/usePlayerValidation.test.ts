/**
 * usePlayerValidation.test.ts
 *
 * Covers the requireJoin gate (v3.0.25 as `requirePhones: boolean`, widened
 * 2026-09-25 for Remote mode to `false | 'mobile' | 'any'`): TV mode still
 * requires deviceType === 'mobile' specifically, but a Remote player may
 * join from a laptop, not only a phone, so Remote's gate ('any') only
 * requires SOME deviceType to be set. False (PC mode) requires nothing.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlayerValidation, GameSettings } from '../../../src/components/setup/usePlayerValidation';
import { createTestPlayer } from '../../fixtures/testData';
import { createMockStateService, createMockGameRulesService } from '../../mocks/mockServices';

const gameSettings: GameSettings = { maxPlayers: 4, winCondition: 'default', difficulty: 'normal' };

function setup(players: ReturnType<typeof createTestPlayer>[], requireJoin: false | 'mobile' | 'any') {
  const stateService = createMockStateService();
  stateService.canStartGame.mockReturnValue(true);
  const gameRulesService = createMockGameRulesService();
  return renderHook(() =>
    usePlayerValidation(players, gameSettings, stateService, gameRulesService, requireJoin)
  ).result;
}

describe('usePlayerValidation — requireJoin gate', () => {
  describe('false (PC mode) — no join required', () => {
    it('lets the game start with nobody connected', () => {
      const result = setup([createTestPlayer({ name: 'Alice', deviceType: undefined })], false);
      expect(result.current.validateGameStart().isValid).toBe(true);
      expect(result.current.waitingOnPhoneNames).toEqual([]);
    });
  });

  describe("'mobile' (TV mode) — requires deviceType === 'mobile' specifically", () => {
    it('blocks start while a named player has no deviceType', () => {
      const result = setup([createTestPlayer({ name: 'Alice', deviceType: undefined })], 'mobile');
      const v = result.current.validateGameStart();
      expect(v.isValid).toBe(false);
      expect(v.errorMessage).toContain('Alice');
      expect(result.current.waitingOnPhoneNames).toEqual(['Alice']);
    });

    it('blocks start even for a connected desktop — TV mode wants a phone specifically', () => {
      const result = setup([createTestPlayer({ name: 'Alice', deviceType: 'desktop' })], 'mobile');
      expect(result.current.validateGameStart().isValid).toBe(false);
      expect(result.current.waitingOnPhoneNames).toEqual(['Alice']);
    });

    it('allows start once every named player has deviceType mobile', () => {
      const result = setup([createTestPlayer({ name: 'Alice', deviceType: 'mobile' })], 'mobile');
      expect(result.current.validateGameStart().isValid).toBe(true);
      expect(result.current.waitingOnPhoneNames).toEqual([]);
    });

    it('names every straggler when several players have not connected', () => {
      const result = setup([
        createTestPlayer({ id: 'p1', name: 'Alice', deviceType: 'mobile' }),
        createTestPlayer({ id: 'p2', name: 'Bob', deviceType: undefined }),
        createTestPlayer({ id: 'p3', name: 'Cara', deviceType: undefined }),
      ], 'mobile');
      expect(result.current.waitingOnPhoneNames).toEqual(['Bob', 'Cara']);
    });
  });

  describe("'any' (Remote mode) — requires SOME deviceType, mobile or desktop", () => {
    it('blocks start while a second (non-host) named player has no deviceType at all', () => {
      const result = setup([
        createTestPlayer({ id: 'p1', name: 'Alice', deviceType: 'desktop' }), // host — exempt anyway
        createTestPlayer({ id: 'p2', name: 'Bob', deviceType: undefined }),
      ], 'any');
      const v = result.current.validateGameStart();
      expect(v.isValid).toBe(false);
      expect(v.errorMessage).toContain('own invite link');
      expect(result.current.waitingOnPhoneNames).toEqual(['Bob']);
    });

    it('allows start once a player has joined from a DESKTOP — unlike TV, this counts for Remote', () => {
      const result = setup([createTestPlayer({ name: 'Alice', deviceType: 'desktop' })], 'any');
      expect(result.current.validateGameStart().isValid).toBe(true);
      expect(result.current.waitingOnPhoneNames).toEqual([]);
    });

    it('allows start once a player has joined from a phone too', () => {
      const result = setup([createTestPlayer({ name: 'Alice', deviceType: 'mobile' })], 'any');
      expect(result.current.validateGameStart().isValid).toBe(true);
    });

    it('exempts the FIRST named player from the join check — "this device," about to click Start, cannot have a deviceType yet', () => {
      const result = setup([createTestPlayer({ id: 'p1', name: 'Alice', deviceType: undefined })], 'any');
      expect(result.current.validateGameStart().isValid).toBe(true);
      expect(result.current.waitingOnPhoneNames).toEqual([]);
    });

    it('still blocks on a SECOND, non-host player who has not connected', () => {
      const result = setup([
        createTestPlayer({ id: 'p1', name: 'Alice', deviceType: undefined }), // host — exempt
        createTestPlayer({ id: 'p2', name: 'Bob', deviceType: undefined }),   // not exempt
      ], 'any');
      const v = result.current.validateGameStart();
      expect(v.isValid).toBe(false);
      expect(result.current.waitingOnPhoneNames).toEqual(['Bob']);
    });
  });

  describe('ignores players with an empty/untyped name regardless of requireJoin', () => {
    it('does not list a blank-named player as a straggler', () => {
      const result = setup([
        createTestPlayer({ id: 'p1', name: 'Alice', deviceType: 'mobile' }),
        createTestPlayer({ id: 'p2', name: '  ', deviceType: undefined }),
      ], 'mobile');
      expect(result.current.waitingOnPhoneNames).toEqual([]);
    });
  });
});
