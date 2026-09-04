// tests/regression/SpaceEntryLogDedup.test.ts

/**
 * Regression Test: Duplicate "entered <space> (visit)" space-entry log line
 *
 * Bug (Playwright playtest of game.unravelcodes.com, HIGH priority):
 * Landing on PM-DECISION-CHECK produced TWO "⚡ <player> entered PM Check
 * (first visit)" log lines with two different timestamps, instead of one.
 * (That space's tile label became "Pick Your Path" in v3.2.50 — the
 * assertions below track the label, the bug above is quoted as it was seen.)
 *
 * Root cause: EffectFactory.createEffectsFromSpaceEntry() always pushes a
 * space-entry LOG effect unless its `skipLogging` argument is true. Two
 * independent call sites were both invoking it with skipLogging effectively
 * false for the SAME arrival:
 *   1. SpaceArrivalProcessor.processSpaceEffectsAfterMovement — called once
 *      from TurnService.startTurn() at the top of the turn (the real
 *      "arrival" event). This call is correct and should keep logging. It
 *      only reaches the log line at all if at least one non-manual,
 *      non-time space effect survives condition filtering (PM-DECISION-CHECK
 *      First visit: an auto "draw 1 L card" gated on `dice_roll_1`) — so the
 *      test pins the internal arrival dice roll to 1 to make this
 *      deterministic instead of ~1-in-6 flaky.
 *   2. TurnEffectsOrchestrator.processLeavingSpaceEffects — called from
 *      TurnService.endTurnWithMovement() BEFORE movement executes, to apply
 *      a space's auto 'time' effects (e.g. PM-DECISION-CHECK's "Spend 5
 *      days") for the space the player is about to LEAVE. This reused the
 *      same factory method — which unconditionally logs an "entered ..."
 *      line — for a space the player is leaving, not entering. Because
 *      PM-DECISION-CHECK has an unconditional auto 'time' effect, this path
 *      ran every time, producing a second, later-timestamped duplicate of
 *      the arrival log regardless of dice luck.
 *
 * Fix: processLeavingSpaceEffects now passes skipLogging: true. The
 * legitimate "time spent" effect still logs its own line independently via
 * FinancialEffectHandler (action: 'time_effect'), so nothing is lost.
 *
 * This test exercises the REAL TurnService → SpaceArrivalProcessor →
 * TurnEffectsOrchestrator → EffectFactory → EffectEngineService →
 * LoggingService pipeline (via the same headless DI bootstrap the ghost
 * regression gate uses) rather than asserting against a hand-built log
 * array, so it actually catches a regression in the call sequence.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

describe('Space entry log dedup regression (PM-DECISION-CHECK)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs exactly one "entered ... (visit)" line for a single arrival, even when the space has an auto time effect applied on leaving', async () => {
    const { stateService, turnService } = await bootstrapHeadlessServices();

    stateService.addPlayer('LogTester');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();

    // Place the player directly on PM-DECISION-CHECK. This space has both a
    // 'choice' movement type AND an auto 'time' space effect ("Spend 5
    // days") on First visit — the exact combination that triggered the bug.
    stateService.updatePlayer({
      id: playerId,
      currentSpace: 'PM-DECISION-CHECK',
      visitType: 'First',
    });

    // Pin Math.random so DiceService.rollDice() always returns 1. This makes
    // SpaceArrivalProcessor's internal arrival dice roll deterministically
    // match PM-DECISION-CHECK's First-visit `dice_roll_1` card-draw
    // condition, so the arrival path's "entered" log fires every run instead
    // of only ~1-in-6 times.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    // ARRIVAL: startTurn() runs SpaceArrivalProcessor's arrival pipeline,
    // which is the one legitimate place this log line should be written.
    await turnService.startTurn(playerId);

    // Give the player a legal destination so End Turn can execute real
    // movement. PM-DECISION-CHECK's First-visit choice options are
    // LEND-SCOPE-CHECK, ARCH-INITIATION, CHEAT-BYPASS (MOVEMENT.csv).
    stateService.setPlayerMoveIntent(playerId, 'ARCH-INITIATION');

    // LEAVING: endTurnWithMovement() calls processLeavingSpaceEffects() for
    // the CURRENT space (still PM-DECISION-CHECK) BEFORE movement executes —
    // this is the call site that used to re-emit the arrival log.
    // force=true bypasses the required-actions gate (no dice/manual action
    // was needed to reproduce this bug); skipAutoMove=false so the leaving
    // path actually runs (skipAutoMove=true would skip it entirely).
    await turnService.endTurnWithMovement(true, false);

    const log = stateService.getGameState().globalActionLog;
    const enteredPmCheckLogs = log.filter(
      (e) =>
        e.details?.action === 'space_effect' &&
        /entered .*Pick Your Path.*\(first visit\)/i.test(e.description)
    );

    expect(enteredPmCheckLogs.map((e) => e.description)).toEqual([
      'LogTester entered Pick Your Path (first visit)',
    ]);
    expect(enteredPmCheckLogs).toHaveLength(1);

    // Player did in fact move off PM-DECISION-CHECK, confirming the leaving
    // pipeline (and thus processLeavingSpaceEffects) really ran.
    expect(stateService.getPlayer(playerId)?.currentSpace).toBe('ARCH-INITIATION');
  });

  it('still logs the auto time-spent effect when leaving the space (fix does not remove real space effects)', async () => {
    const { stateService, turnService } = await bootstrapHeadlessServices();

    stateService.addPlayer('LogTester2');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();

    stateService.updatePlayer({
      id: playerId,
      currentSpace: 'PM-DECISION-CHECK',
      visitType: 'First',
    });

    await turnService.startTurn(playerId);
    stateService.setPlayerMoveIntent(playerId, 'ARCH-INITIATION');
    await turnService.endTurnWithMovement(true, false);

    const log = stateService.getGameState().globalActionLog;

    // PM-DECISION-CHECK First visit: SPACE_EFFECTS.csv row `time,add,5` ->
    // "Spend 5 days" logs independently as a time_effect entry (+5 days),
    // driven by FinancialEffectHandler — unaffected by suppressing the
    // (wrong, duplicate) "entered" LOG effect on the leaving call site.
    const timeEffectLogs = log.filter((e) => e.details?.action === 'time_effect');
    expect(timeEffectLogs.length).toBeGreaterThanOrEqual(1);
    expect(timeEffectLogs.some((e) => /\+5 days/.test(e.description))).toBe(true);
  });
});
