/**
 * Transactional Logging — TurnService integration tests (TODO L117 follow-up).
 *
 * The 11 unit tests in tests/services/TransactionalLogging.test.ts already verify
 * LoggingService methods in isolation with mocks. These integration tests close
 * the gap by exercising the real TurnService → LoggingService wiring end-to-end
 * with the same DI bootstrap the ghost regression gate uses.
 *
 * What unit tests catch: the LoggingService methods do the right thing when
 * called. What unit tests MISS: whether TurnService actually calls them in the
 * right places. The ghost gate catches "did things crash?" but doesn't assert
 * on isCommitted flag state — which is the bit the post-game log viewer
 * (v3.0.50) filters and searches on. If a future refactor silently breaks the
 * commit logic, the post-game viewer would show wrong entries and nobody'd
 * notice until a user complained. These three tests close that loophole.
 *
 * Test cases (from docs/technical/TESTING_GUIDE.md "Transactional Logging Test
 * Cases" → "Test Cases for Future Implementation"):
 *   #1 — Standard turn → commit
 *   #2 — Single Try Again → rollback
 *   #3 — Multiple Try Again then commit (currently fails — see note on the test)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrapHeadlessServices, HeadlessServices } from '../ghost/bootstrapServices';

describe('Transactional Logging — TurnService integration', () => {
  let services: HeadlessServices;
  let playerId: string;

  beforeEach(async () => {
    services = await bootstrapHeadlessServices();
    services.stateService.addPlayer('LogTester');
    const player = services.stateService.getAllPlayers()[0];
    playerId = player.id;
    services.stateService.setCurrentPlayer(playerId);
    services.stateService.startGame();
    await services.turnService.startTurn(playerId);
  });

  function getLog() {
    return services.stateService.getGameState().globalActionLog;
  }

  it('Test #1: Standard turn → endTurn commits all session entries', async () => {
    const sessionId = services.stateService.getGameState().currentExplorationSessionId;
    expect(sessionId, 'startTurn should have opened a session').not.toBeNull();

    // Log two exploratory actions during the active session.
    services.loggingService.info('Player drew a card', {
      playerId,
      playerName: 'LogTester',
      action: 'integration_test_explore_1',
    });
    services.loggingService.info('Player paid a fee', {
      playerId,
      playerName: 'LogTester',
      action: 'integration_test_explore_2',
    });

    // Both should be uncommitted while the session is still open.
    const beforeCommit = getLog().filter(
      e => e.details?.action === 'integration_test_explore_1'
        || e.details?.action === 'integration_test_explore_2'
    );
    expect(beforeCommit).toHaveLength(2);
    for (const entry of beforeCommit) {
      expect(entry.isCommitted, `"${entry.description}" should be uncommitted before endTurn`).toBe(false);
      expect(entry.explorationSessionId).toBe(sessionId);
    }

    // End the turn. force=true bypasses required-actions check;
    // skipAutoMove=true keeps the player on OWNER-SCOPE-INITIATION so we don't
    // need a real moveIntent. This matches the ghost gate's tryAgain-path call.
    await services.turnService.endTurnWithMovement(true, true);

    // All entries that belonged to the session should now be committed.
    const afterCommit = getLog().filter(e => e.explorationSessionId === sessionId);
    expect(afterCommit.length).toBeGreaterThanOrEqual(2);
    for (const entry of afterCommit) {
      expect(
        entry.isCommitted,
        `"${entry.description}" (session ${entry.explorationSessionId}) should be committed after endTurn`,
      ).toBe(true);
    }
  });

  it('Test #2: Try Again → exploratory entries are removed, try_again entry is committed', async () => {
    const sessionId = services.stateService.getGameState().currentExplorationSessionId;
    expect(sessionId).not.toBeNull();

    services.loggingService.info('Drew an exploratory card', {
      playerId,
      playerName: 'LogTester',
      action: 'integration_test_attempt_card',
    });
    services.loggingService.info('Picked a movement option', {
      playerId,
      playerName: 'LogTester',
      action: 'integration_test_attempt_move',
    });

    const result = await services.turnService.tryAgainOnSpace(playerId);
    expect(result.success, `Try Again must succeed at OWNER-SCOPE-INITIATION (can_negotiate=YES); got: ${result.message}`).toBe(true);

    // v3.0.63 — tryAgainOnSpace now calls loggingService.discardCurrentSession,
    // which REMOVES every uncommitted pencil entry tagged with the current
    // session ID. Symmetric with discardTempState on the state side.
    const exploratory = getLog().filter(
      e => e.details?.action === 'integration_test_attempt_card'
        || e.details?.action === 'integration_test_attempt_move'
    );
    expect(exploratory, 'pencil entries should be torn out by discardCurrentSession').toHaveLength(0);

    // The try_again log entry itself is written with an explicit
    // isCommitted: true flag by TurnService.tryAgainOnSpace BEFORE the
    // discard runs, so it survives — the audit trail of "Try Again happened"
    // is preserved even though the abandoned actions are not.
    const tryAgainEntries = getLog().filter(e => e.details?.action === 'try_again');
    expect(tryAgainEntries).toHaveLength(1);
    expect(tryAgainEntries[0].isCommitted).toBe(true);

    // The session itself is closed; the next start-of-turn opens a fresh one.
    expect(services.stateService.getGameState().currentExplorationSessionId).toBeNull();
  });

  // v3.0.63 — architecture gap closed. TurnService.tryAgainOnSpace now calls
  // loggingService.discardCurrentSession(), which REMOVES (not just leaves
  // uncommitted) every pencil entry tagged with the current session ID.
  // Committed entries (turn_start, try_again itself) survive. Implementation
  // chose remove-over-leave-uncommitted because it keeps the post-game log
  // free of ghost entries from abandoned attempts — symmetric with
  // discardTempState on the state side.
  it(
    'Test #3: Multiple Try Again then commit — abandoned attempts removed, final attempt committed',
    async () => {
      // Cycle 1: attempt, then Try Again
      services.loggingService.info('Cycle 1 exploration', {
        playerId,
        playerName: 'LogTester',
        action: 'integration_test_cycle_1',
      });
      const try1 = await services.turnService.tryAgainOnSpace(playerId);
      expect(try1.success).toBe(true);
      await services.turnService.endTurnWithMovement(true, true);

      // Cycle 2: another attempt, then Try Again again
      services.loggingService.info('Cycle 2 exploration', {
        playerId,
        playerName: 'LogTester',
        action: 'integration_test_cycle_2',
      });
      const try2 = await services.turnService.tryAgainOnSpace(playerId);
      expect(try2.success).toBe(true);
      await services.turnService.endTurnWithMovement(true, true);

      // Cycle 3: successful attempt, then end turn normally
      services.loggingService.info('Cycle 3 (successful) exploration', {
        playerId,
        playerName: 'LogTester',
        action: 'integration_test_cycle_3',
      });
      await services.turnService.endTurnWithMovement(true, true);

      const cycle1 = getLog().find(e => e.details?.action === 'integration_test_cycle_1');
      const cycle2 = getLog().find(e => e.details?.action === 'integration_test_cycle_2');
      const cycle3 = getLog().find(e => e.details?.action === 'integration_test_cycle_3');

      // Abandoned cycles 1 and 2: pencil entries discarded. They shouldn't
      // appear in the log at all anymore.
      expect(cycle1, 'abandoned cycle 1 entry should be removed').toBeUndefined();
      expect(cycle2, 'abandoned cycle 2 entry should be removed').toBeUndefined();

      // Final cycle 3: entry survives and is committed by endTurnWithMovement.
      expect(cycle3, 'final cycle 3 entry should exist').toBeDefined();
      expect(cycle3!.isCommitted, 'final cycle 3 should be committed').toBe(true);

      // The two `try_again` entries themselves are committed at creation
      // (isCommitted: true) so they survive the discard and serve as the
      // audit trail that two Try Agains happened.
      const tryAgainEntries = getLog().filter(e => e.details?.action === 'try_again');
      expect(tryAgainEntries).toHaveLength(2);
      expect(tryAgainEntries.every(e => e.isCommitted)).toBe(true);
    },
  );
});
