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

  it('Test #2: Try Again → exploratory entries stay uncommitted, try_again entry is committed', async () => {
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

    // The exploratory entries from this attempt should still be uncommitted —
    // the session is still open, no commit has happened yet, and tryAgain
    // itself doesn't commit the session.
    const exploratory = getLog().filter(
      e => e.details?.action === 'integration_test_attempt_card'
        || e.details?.action === 'integration_test_attempt_move'
    );
    expect(exploratory).toHaveLength(2);
    for (const entry of exploratory) {
      expect(
        entry.isCommitted,
        `Exploratory entry "${entry.description}" should be uncommitted after tryAgainOnSpace`,
      ).toBe(false);
      expect(entry.explorationSessionId).toBe(sessionId);
    }

    // The try_again log entry itself is written with an explicit
    // isCommitted: true flag by TurnService.tryAgainOnSpace — it's the
    // sentinel that marks the attempt as abandoned, so it must survive
    // any future session rotation.
    const tryAgainEntries = getLog().filter(e => e.details?.action === 'try_again');
    expect(tryAgainEntries).toHaveLength(1);
    expect(tryAgainEntries[0].isCommitted).toBe(true);
  });

  // KNOWN GAP — the architecture currently commits ALL entries with the active
  // session ID when commitCurrentSession runs, regardless of whether they came
  // from an abandoned try-again attempt. The spec at TESTING_GUIDE.md says
  // abandoned attempts' exploratory entries should stay uncommitted forever.
  // To make this pass, TurnService.tryAgainOnSpace would need to rotate the
  // session (e.g. start a new exploration session whose ID won't match the
  // abandoned entries) before returning. Until that fix lands:
  //   - `it.fails` enforces the documented limitation: this test SHOULD fail.
  //   - If the architecture is fixed, the assertions will pass and vitest will
  //     report `.fails` as an error, prompting removal of `.fails` and the
  //     associated UI reminder banner in PostGameLogViewer.
  // The PostGameLogViewer carries a "REMOVE BEFORE RELEASE" banner pointing
  // here so users know abandoned-attempt entries currently look committed.
  it.fails(
    'Test #3 (known gap): Multiple Try Again then commit — only final attempt should be committed',
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

      expect(cycle1, 'cycle 1 entry should exist').toBeDefined();
      expect(cycle2, 'cycle 2 entry should exist').toBeDefined();
      expect(cycle3, 'cycle 3 entry should exist').toBeDefined();

      // Spec assertions — these are what SHOULD be true after the architecture
      // gap is closed. Currently fails: all three cycles get committed because
      // each cycle's endTurnWithMovement commits its own session entirely.
      expect(cycle1!.isCommitted, 'abandoned cycle 1 should stay uncommitted').toBe(false);
      expect(cycle2!.isCommitted, 'abandoned cycle 2 should stay uncommitted').toBe(false);
      expect(cycle3!.isCommitted, 'final cycle 3 should be committed').toBe(true);
    },
  );
});
