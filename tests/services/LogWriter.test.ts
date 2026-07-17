// Domain-event stage 3 — one case per GameEvent type LogWriter reacts to.
// Strings here were copied verbatim from each call site being migrated,
// before that call site's old loggingService.info() was deleted — this
// file is the safety net for the 4 moments with no other dedicated test
// file (TurnCommitted, RoutedBackToReview[no-op], ManualActionCompleted,
// DiceRolled).
import { describe, it, expect, vi } from 'vitest';
import { LogWriter } from '../../src/services/LogWriter';
import { GameEvent } from '../../src/types/GameEvents';

function createLogWriter() {
  const stateService: any = {
    subscribeToGameEvents: vi.fn(),
  };
  const loggingService: any = { info: vi.fn() };
  new LogWriter(stateService, loggingService);
  const handleEvent = stateService.subscribeToGameEvents.mock.calls[0][0] as (e: GameEvent) => void;
  return { handleEvent, loggingService };
}

describe('LogWriter', () => {
  it('subscribes to the GameEvent bus on construction', () => {
    const stateService: any = { subscribeToGameEvents: vi.fn() };
    new LogWriter(stateService, {} as any);
    expect(stateService.subscribeToGameEvents).toHaveBeenCalledTimes(1);
  });

  it('turn_committed writes "Turn N ended"', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'turn_committed', playerId: 'p1', playerName: 'Alice', turn: 5, spaceName: 'OWNER-SCOPE-INITIATION' });

    expect(loggingService.info).toHaveBeenCalledWith('Turn 5 ended', {
      playerId: 'p1', playerName: 'Alice', action: 'turn_end', turn: 5, space: 'OWNER-SCOPE-INITIATION',
    });
  });

  it('turn_discarded writes "Used Try Again" forcing isCommitted:true (must survive discardCurrentSession)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'turn_discarded', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-PLAN-EXAM', timePenalty: 2, tryAgainCount: 1 });

    expect(loggingService.info).toHaveBeenCalledWith('Used Try Again: 2 day penalty applied', {
      playerId: 'p1', playerName: 'Alice', action: 'try_again', spaceName: 'REG-DOB-PLAN-EXAM',
      timePenalty: 2, tryAgainCount: 1, isCommitted: true,
    });
  });

  it('dice_rolled (manual trigger) writes the emitter-composed logMessage verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'dice_rolled', playerId: 'p1', playerName: 'Alice', spaceName: 'CHEAT-BYPASS', diceValue: 4, trigger: 'manual', logMessage: 'Outcome determined' });

    expect(loggingService.info).toHaveBeenCalledWith('Outcome determined', {
      playerId: 'p1', playerName: 'Alice', action: 'dice_roll', diceValue: 4, space: 'CHEAT-BYPASS',
    });
  });

  it('dice_rolled (arrival trigger) writes the emitter-composed logMessage verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'dice_rolled', playerId: 'p1', playerName: 'Alice', spaceName: 'PM-DECISION-CHECK', diceValue: 2, trigger: 'arrival', logMessage: "Alice's outcome came back at PM Decision Check" });

    expect(loggingService.info).toHaveBeenCalledWith("Alice's outcome came back at PM Decision Check", {
      playerId: 'p1', playerName: 'Alice', action: 'dice_roll', diceValue: 2, space: 'PM-DECISION-CHECK',
    });
  });

  it('movement with success:false writes a log entry (the genuine new-coverage gap)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'movement', playerId: 'p1', playerName: 'Alice', spaceName: 'PM-DECISION-CHECK', fromSpace: 'PM-DECISION-CHECK', toSpace: undefined, success: false, message: '⚠️ Movement failed: could not determine destination.' });

    expect(loggingService.info).toHaveBeenCalledWith('⚠️ Movement failed: could not determine destination.', {
      playerId: 'p1', playerName: 'Alice', action: 'player_movement', fromSpace: 'PM-DECISION-CHECK', toSpace: undefined, success: false,
    });
  });

  it('movement with success:true does NOT write a log entry (MovementService.movePlayer already logs it — would duplicate)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'movement', playerId: 'p1', playerName: 'Alice', spaceName: 'PM-DECISION-CHECK', fromSpace: 'PM-DECISION-CHECK', toSpace: 'ARCH-INITIATION', success: true, message: 'Alice moved from PM-DECISION-CHECK to ARCH-INITIATION' });

    expect(loggingService.info).not.toHaveBeenCalled();
  });

  it('manual_action_completed writes the summary verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'manual_action_completed', playerId: 'p1', playerName: 'Alice', effectType: 'draw_W', summary: 'Took on 3 Work Packages' });

    expect(loggingService.info).toHaveBeenCalledWith('Took on 3 Work Packages', {
      playerId: 'p1', playerName: 'Alice', action: 'manual_action', effectType: 'draw_W',
    });
  });

  it('recurring_card_effect_applied writes the headline verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({
      type: 'recurring_card_effect_applied', playerId: 'p1', playerName: 'Alice',
      sourceCardId: 'L002', cardName: 'Sick Kid', moneyDelta: -2000, timeDelta: 0, turnsLeftAfterThis: 2,
      headline: '🔁 Sick Kid still affecting you: -$2,000 — 2 more turns to go', delta: '-$2,000', tail: ' — 2 more turns to go',
    });

    expect(loggingService.info).toHaveBeenCalledWith('🔁 Sick Kid still affecting you: -$2,000 — 2 more turns to go', {
      playerId: 'p1', playerName: 'Alice', action: 'life_event_recurring',
      sourceCardId: 'L002', moneyDelta: -2000, timeDelta: 0, turnsLeftAfterThis: 2,
    });
  });

  it('does not log routed_back_to_review (toast-only, scope decision this stage)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'routed_back_to_review', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-FINAL-REVIEW', toSpace: 'REG-DOB-PLAN-EXAM', toSpaceTitle: 'DOB Plan Exam', reason: 'Missing DOB approval.', kind: 'gate_bounce' });

    expect(loggingService.info).not.toHaveBeenCalled();
  });

  it('does not throw or log for event types it has no case for', () => {
    const { handleEvent, loggingService } = createLogWriter();
    expect(() => handleEvent({ type: 'approval_revoked', playerId: 'p1', playerName: 'Alice', spaceName: 'X', message: 'y' })).not.toThrow();
    expect(loggingService.info).not.toHaveBeenCalled();
  });
});
