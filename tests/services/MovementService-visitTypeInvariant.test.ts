// Parallel-systems audit follow-up (2026-06-04) — Phase 1.1.
//
// The audit at TODO `### Parallel-systems audit — additional candidates` flagged
// visitType-vs-visitedSpaces as a possible drift trap. On inspection, line 248 of
// MovementService is computing the visit type for the DESTINATION the player is
// moving to (not the current space), which can only be derived from
// `visitedSpaces.includes(destination)` — there is no parallel system to delete.
//
// What does exist is a small data-integrity invariant that the move pipeline
// upholds today but that a future caller of `updatePlayer` could break:
//
//   For every player after initialization, the following hold:
//     1. visitedSpaces is non-empty.
//     2. visitedSpaces.includes(currentSpace).
//     3. visitedSpaces has no duplicates.
//     4. visitType is exactly 'First' or 'Subsequent'.
//     5. If visitType === 'First', currentSpace is the most recent addition
//        to visitedSpaces (i.e., the last entry).
//
// This file pins those invariants by exercising a multi-hop move sequence
// through the public MovementService API and asserting them after each move.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementService } from '../../src/services/MovementService';
import { ApprovalService } from '../../src/services/ApprovalService';
import { GameState, Player } from '../../src/types/StateTypes';
import { Movement } from '../../src/types/DataTypes';
import {
  createMockDataService,
  createMockStateService,
  createMockChoiceService,
  createMockLoggingService,
  createMockGameRulesService,
} from '../mocks/mockServices';

function assertVisitTypeInvariant(player: Player, contextLabel: string): void {
  const { currentSpace, visitType, visitedSpaces } = player;

  expect(visitedSpaces.length, `${contextLabel}: visitedSpaces must be non-empty`).toBeGreaterThan(0);
  expect(visitedSpaces.includes(currentSpace), `${contextLabel}: visitedSpaces must include currentSpace=${currentSpace}`).toBe(true);
  expect(
    visitedSpaces.length === new Set(visitedSpaces).size,
    `${contextLabel}: visitedSpaces must have no duplicates, got ${JSON.stringify(visitedSpaces)}`
  ).toBe(true);
  expect(visitType === 'First' || visitType === 'Subsequent', `${contextLabel}: visitType must be 'First' or 'Subsequent', got ${visitType}`).toBe(true);

  if (visitType === 'First') {
    expect(
      visitedSpaces[visitedSpaces.length - 1],
      `${contextLabel}: when visitType='First', currentSpace must be the last entry in visitedSpaces`
    ).toBe(currentSpace);
  }
}

describe('MovementService — visitType / visitedSpaces invariant', () => {
  let movementService: MovementService;
  let mockDataService: any;
  let mockStateService: any;
  let mockChoiceService: any;
  let mockLoggingService: any;
  let mockGameRulesService: any;
  let player: Player;

  function applyCapturedUpdate(): Player {
    const lastCall = mockStateService.updatePlayer.mock.calls[mockStateService.updatePlayer.mock.calls.length - 1];
    const update = lastCall[0];
    player = {
      ...player,
      ...update,
      visitedSpaces: update.visitedSpaces ?? player.visitedSpaces,
    };
    mockStateService.getPlayer.mockReturnValue(player);
    return player;
  }

  beforeEach(() => {
    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    mockChoiceService = createMockChoiceService();
    mockLoggingService = createMockLoggingService();
    mockGameRulesService = createMockGameRulesService();

    movementService = new MovementService(
      mockDataService,
      mockStateService,
      mockChoiceService,
      mockLoggingService,
      mockGameRulesService,
      new ApprovalService()
    );

    player = {
      id: 'p1',
      name: 'Test',
      currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First',
      visitedSpaces: ['OWNER-SCOPE-INITIATION'],
      money: 0,
      timeSpent: 0,
      projectScope: 0,
      score: 0,
      color: '#000',
      avatar: '',
      hand: [],
      activeCards: [],
      activeEffects: [],
      loans: [],
    } as unknown as Player;

    mockStateService.getPlayer.mockReturnValue(player);
    mockStateService.updatePlayer.mockImplementation(() => ({ players: [player] } as GameState));
    mockDataService.getAllSpaces.mockReturnValue([]);
  });

  it('holds on freshly created player (post-init)', () => {
    assertVisitTypeInvariant(player, 'post-init');
  });

  it('holds after a First-visit move to a new space', () => {
    mockDataService.getMovement.mockReturnValue({
      space_name: 'OWNER-SCOPE-INITIATION',
      visit_type: 'First',
      movement_type: 'fixed',
      destination_1: 'OWNER-FUND-INITIATION',
    } as Movement);

    return movementService.movePlayer('p1', 'OWNER-FUND-INITIATION').then(() => {
      applyCapturedUpdate();
      assertVisitTypeInvariant(player, 'after First-visit move');
      expect(player.currentSpace).toBe('OWNER-FUND-INITIATION');
      expect(player.visitType).toBe('First');
      expect(player.visitedSpaces).toEqual(['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION']);
    });
  });

  it('holds after a Subsequent-visit move (revisit)', async () => {
    // Pre-populate visitedSpaces so the move to OWNER-FUND-INITIATION is a revisit.
    player = {
      ...player,
      currentSpace: 'PM-DECISION-CHECK',
      visitedSpaces: ['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION', 'PM-DECISION-CHECK'],
      visitType: 'First',
    };
    mockStateService.getPlayer.mockReturnValue(player);

    mockDataService.getMovement.mockReturnValue({
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      movement_type: 'fixed',
      destination_1: 'OWNER-FUND-INITIATION',
    } as Movement);

    await movementService.movePlayer('p1', 'OWNER-FUND-INITIATION');
    applyCapturedUpdate();

    assertVisitTypeInvariant(player, 'after Subsequent-visit move');
    expect(player.currentSpace).toBe('OWNER-FUND-INITIATION');
    expect(player.visitType).toBe('Subsequent');
    // visitedSpaces unchanged because the space was already visited.
    expect(player.visitedSpaces).toEqual(['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION', 'PM-DECISION-CHECK']);
  });

  it('holds across a multi-hop sequence: First → First → Subsequent', async () => {
    // Hop 1: OWNER-SCOPE-INITIATION → OWNER-FUND-INITIATION (First)
    mockDataService.getMovement.mockReturnValueOnce({
      space_name: 'OWNER-SCOPE-INITIATION',
      visit_type: 'First',
      movement_type: 'fixed',
      destination_1: 'OWNER-FUND-INITIATION',
    } as Movement);
    await movementService.movePlayer('p1', 'OWNER-FUND-INITIATION');
    applyCapturedUpdate();
    assertVisitTypeInvariant(player, 'hop 1 (First)');
    expect(player.visitType).toBe('First');

    // Hop 2: OWNER-FUND-INITIATION → PM-DECISION-CHECK (First)
    mockDataService.getMovement.mockReturnValueOnce({
      space_name: 'OWNER-FUND-INITIATION',
      visit_type: 'First',
      movement_type: 'fixed',
      destination_1: 'PM-DECISION-CHECK',
    } as Movement);
    await movementService.movePlayer('p1', 'PM-DECISION-CHECK');
    applyCapturedUpdate();
    assertVisitTypeInvariant(player, 'hop 2 (First)');
    expect(player.visitType).toBe('First');

    // Hop 3: PM-DECISION-CHECK → OWNER-FUND-INITIATION (Subsequent — revisit)
    mockDataService.getMovement.mockReturnValueOnce({
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      movement_type: 'fixed',
      destination_1: 'OWNER-FUND-INITIATION',
    } as Movement);
    await movementService.movePlayer('p1', 'OWNER-FUND-INITIATION');
    applyCapturedUpdate();
    assertVisitTypeInvariant(player, 'hop 3 (Subsequent)');
    expect(player.visitType).toBe('Subsequent');
    expect(player.visitedSpaces).toEqual(['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION', 'PM-DECISION-CHECK']);
  });

  it('catches a contrived violation (sanity-check the assertion helper)', () => {
    const brokenPlayer = {
      ...player,
      currentSpace: 'GHOST-SPACE-NEVER-VISITED',
      visitedSpaces: ['OWNER-SCOPE-INITIATION'],
      visitType: 'First',
    } as Player;

    expect(() => assertVisitTypeInvariant(brokenPlayer, 'contrived')).toThrow(/must include currentSpace/);
  });
});
