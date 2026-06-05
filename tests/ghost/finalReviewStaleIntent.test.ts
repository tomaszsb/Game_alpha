// Regression — Final Review "Accept doesn't move + error flash" crash.
// Dashboard reports fb:49559c76 ("Accept button does not move me anywhere") and
// fb:dc702660 ("error message showed up and disappeared"), both v3.0.66.
//
// Root cause: v3.0.66 (Phase 2.1) collapsed the dice/intent resolvers into
// getValidMoves and DELETED the inline Stage-1 gate override that v3.0.62 added
// to MovementExecutor. A moveIntent set earlier (DiceRollProcessor routes to the
// Stage-1 gate destination REG-DOB-PLAN-EXAM when DOB is missing) can go stale
// if approval state reads differently at END TURN. The stale intent was handed
// straight to movePlayer → validateMove threw
//   "Invalid move: REG-DOB-PLAN-EXAM is not a valid destination from
//    REG-DOB-FINAL-REVIEW. Valid destinations: FINISH, CON-INSPECT,
//    REG-FDNY-FEE-REVIEW"
// — the exact v3.0.61 crash, reintroduced. The fix reconciles the stored intent
// against the live resolver in MovementExecutor before it can reach validateMove.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';

async function playerAtFinalReview(opts: { dob: string; fdny: string; moveIntent?: string }) {
  const services = await bootstrapHeadlessServices();
  const { stateService } = services;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId,
    currentSpace: 'REG-DOB-FINAL-REVIEW',
    visitType: 'First',
    visitedSpaces: ['REG-DOB-FINAL-REVIEW'],
    dobApprovalStatus: opts.dob as any,
    fdnyApprovalStatus: opts.fdny as any,
  } as any);
  if (opts.moveIntent) stateService.setPlayerMoveIntent(playerId, opts.moveIntent);
  return { ...services, playerId };
}

describe('Final Review — stale gate-reroute intent (fb:49559c76 / fb:dc702660)', () => {
  it('stale REG-DOB-PLAN-EXAM intent with both approvals present does NOT throw "Invalid move"', async () => {
    // Both approvals → gate passes → resolver offers raw Final Review outcomes,
    // which do not include the stale reroute. Pre-fix this threw via movePlayer.
    const { movementService, playerId } = await playerAtFinalReview({
      dob: 'approved', fdny: 'approved', moveIntent: 'REG-DOB-PLAN-EXAM',
    });
    expect(movementService.getValidMoves(playerId)).not.toContain('REG-DOB-PLAN-EXAM');
    // The direct validateMove guard still rejects an outright illegal move...
    await expect(movementService.movePlayer(playerId, 'REG-DOB-PLAN-EXAM')).rejects.toThrow(/Invalid move/);
  });

  it('END TURN with a stale gate-reroute intent does not crash the turn', async () => {
    const { turnService, stateService, playerId } = await playerAtFinalReview({
      dob: 'approved', fdny: 'approved', moveIntent: 'REG-DOB-PLAN-EXAM',
    });
    let threw = '';
    try {
      await turnService.endTurnWithMovement(true);
    } catch (e: any) {
      threw = e?.message ?? String(e);
    }
    // The executor reconciles the stale intent instead of letting validateMove
    // throw. The turn completes without the v3.0.61 "Invalid move" crash.
    expect(threw).toBe('');
    // Player did not get force-moved to the illegal reroute. (Intent-clearing is
    // asserted in the MovementExecutor unit test; after a full end-turn the next
    // turn's startTurn re-enters the space and may set a fresh intent.)
    expect(stateService.getPlayer(playerId)?.currentSpace).not.toBe('REG-DOB-PLAN-EXAM');
  });

  it('END TURN with DOB genuinely missing still routes to the gate (no regression)', async () => {
    const { turnService, stateService, playerId } = await playerAtFinalReview({
      dob: 'none', fdny: 'approved', moveIntent: 'REG-DOB-PLAN-EXAM',
    });
    let threw = '';
    try {
      await turnService.endTurnWithMovement(true);
    } catch (e: any) {
      threw = e?.message ?? String(e);
    }
    expect(threw).toBe('');
    // Gate fires → player is routed back to the DOB plan exam, as intended.
    expect(stateService.getPlayer(playerId)?.currentSpace).toBe('REG-DOB-PLAN-EXAM');
  });
});
