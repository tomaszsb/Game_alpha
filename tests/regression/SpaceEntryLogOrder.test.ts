// tests/regression/SpaceEntryLogOrder.test.ts

/**
 * Regression Test: "outcome came back" logged BEFORE "entered <space>"
 *
 * Bug (Playwright playtest of game.unravelcodes.com, HIGH priority):
 * Landing on a space with a dice-dependent condition produced the log lines
 * in the wrong chronological order:
 *   "🎯 <player>'s outcome came back at <space>"   (dice roll for condition eval)
 *   "⚡ <player> entered <space> (<visit>)"          (space-entry log)
 * when "entered" should always log first, since the dice roll only happens
 * because the player already arrived — the game checks dice-dependent
 * conditions AFTER arrival, not before.
 *
 * Root cause: SpaceArrivalProcessor.processSpaceEffectsAfterMovement rolled
 * the arrival dice (when the space has any dice-dependent condition) and
 * immediately called stateService.emitGameEvent({ type: 'dice_rolled', ... }),
 * which LogWriter turns into a log entry synchronously, via
 * loggingService.info() -> stateService.logToActionHistory() (an immediate
 * array push). This happened near the top of the method — BEFORE the
 * "entered <space> (<visit>)" LOG effect was even built (via
 * EffectFactory.createEffectsFromSpaceEntry, further down) let alone applied
 * (via the awaited effectEngineService.processEffects call, later still). So
 * in every case where the space needed a dice roll, "outcome came back" beat
 * "entered" into the log by construction, not by chance.
 *
 * Fix: SpaceArrivalProcessor still rolls the dice VALUE where it always did
 * (the value is needed immediately to filter dice-dependent conditions), but
 * defers the dice_rolled emitGameEvent call (the actual log WRITE) via a
 * closure invoked only after the "entered" LOG effect has been processed (or,
 * on the no-automatic-effects branches, after we've determined "entered"
 * won't be written this arrival at all — see SpaceEntryLogDedup.test.ts for
 * why "entered" is conditional on a surviving automatic effect).
 *
 * This test exercises the REAL TurnService -> SpaceArrivalProcessor ->
 * EffectFactory -> EffectEngineService -> LoggingService pipeline (via the
 * same headless DI bootstrap the ghost regression gate uses) rather than
 * asserting against a hand-built log array, so it actually catches a
 * regression in the call sequence.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

describe('Space entry log ordering regression (PM-DECISION-CHECK)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs "entered ... (visit)" BEFORE the dice roll\'s "outcome came back" line for the same arrival', async () => {
    const { stateService, turnService } = await bootstrapHeadlessServices();

    stateService.addPlayer('OrderTester');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();

    // Place the player directly on PM-DECISION-CHECK, First visit. This
    // space has an auto 'cards' effect gated on `dice_roll_1` (SPACE_EFFECTS.csv:
    // "PM-DECISION-CHECK,First,cards,draw_L,1,dice_roll_1,..."), which is
    // exactly the combination that triggers both log lines for one arrival:
    // the "entered" line (because at least one automatic effect survives
    // condition filtering) and the "outcome came back" line (because the
    // space needs a dice roll to evaluate that condition).
    stateService.updatePlayer({
      id: playerId,
      currentSpace: 'PM-DECISION-CHECK',
      visitType: 'First',
    });

    // Pin Math.random so DiceService.rollDice() always returns 1, matching
    // PM-DECISION-CHECK's First-visit `dice_roll_1` condition. This makes
    // both log lines fire deterministically instead of ~1-in-6 flaky.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await turnService.startTurn(playerId);

    const log = stateService.getGameState().globalActionLog;

    const enteredIndex = log.findIndex(
      (e) =>
        e.details?.action === 'space_effect' &&
        /entered .*PM Check.*\(first visit\)/i.test(e.description)
    );
    const outcomeIndex = log.findIndex(
      (e) =>
        e.details?.action === 'dice_roll' &&
        /outcome came back at .*PM Check/i.test(e.description)
    );

    // Both lines must actually be present (sanity check that this arrival
    // really exercised both code paths, not just one).
    expect(enteredIndex).toBeGreaterThanOrEqual(0);
    expect(outcomeIndex).toBeGreaterThanOrEqual(0);

    // The actual regression assertion: "entered" must have a lower index
    // (i.e. was appended to globalActionLog earlier) than "outcome came back".
    expect(enteredIndex).toBeLessThan(outcomeIndex);

    expect(log[enteredIndex].description).toBe('OrderTester entered PM Check (first visit)');
    expect(log[outcomeIndex].description).toBe("OrderTester's outcome came back at PM Check");
  });
});
