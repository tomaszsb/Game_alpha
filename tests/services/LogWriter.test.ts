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

  // Domain-event stage 4: the maintainer approved log coverage for
  // routed_back_to_review/approval_revoked/approval_outcome_determined —
  // this stage-3 test's premise (toast-only, no log) is now stage 4's
  // to override; see the stage-4 cases below.
  it('routed_back_to_review writes the reason to the log', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'routed_back_to_review', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-FINAL-REVIEW', toSpace: 'REG-DOB-PLAN-EXAM', toSpaceTitle: 'DOB Plan Exam', reason: 'Missing DOB approval.', kind: 'gate_bounce' });

    expect(loggingService.info).toHaveBeenCalledWith('Missing DOB approval.', {
      playerId: 'p1', playerName: 'Alice', action: 'routed_back_to_review',
      spaceName: 'REG-DOB-FINAL-REVIEW', toSpace: 'REG-DOB-PLAN-EXAM', kind: 'gate_bounce',
    });
  });

  it('approval_revoked writes the message to the log', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'approval_revoked', playerId: 'p1', playerName: 'Alice', spaceName: 'X', message: 'y' });

    expect(loggingService.info).toHaveBeenCalledWith('y', {
      playerId: 'p1', playerName: 'Alice', action: 'approval_revoked', spaceName: 'X', cardName: undefined,
    });
  });

  it('approval_outcome_determined writes the message to the log', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'approval_outcome_determined', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-PLAN-EXAM', approval: 'dob', kind: 'approved', source: 'examiner_roll', message: 'Approved.' });

    expect(loggingService.info).toHaveBeenCalledWith('Approved.', {
      playerId: 'p1', playerName: 'Alice', action: 'approval_outcome_determined',
      spaceName: 'REG-DOB-PLAN-EXAM', approval: 'dob', kind: 'approved', source: 'examiner_roll',
    });
  });

  it('game_ended writes the message using the already-registered game_end tag', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'game_ended', reason: 'win', playerId: 'p1', playerName: 'Alice', spaceName: 'FINISH', message: '🏆 Alice won!' });

    expect(loggingService.info).toHaveBeenCalledWith('🏆 Alice won!', {
      playerId: 'p1', playerName: 'Alice', action: 'game_end', reason: 'win', spaceName: 'FINISH',
    });
  });

  it('does not throw or log for event types it has no case for', () => {
    const { handleEvent, loggingService } = createLogWriter();
    expect(() => handleEvent({ type: 'auto_dice_roll', playerId: 'p1', playerName: 'Alice', spaceName: 'X', message: 'y' })).not.toThrow();
    expect(loggingService.info).not.toHaveBeenCalled();
  });

  // --- Domain-event stage 4: CardService lifecycle promotions ---

  it('card_drawn writes the message verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_drawn', playerId: 'p1', cardType: 'W', count: 2, cards: ['W001', 'W002'], source: 'educational_mode', message: 'Drew 2 Work Packages: Foo, Bar' });

    expect(loggingService.info).toHaveBeenCalledWith('Drew 2 Work Packages: Foo, Bar', {
      playerId: 'p1', action: 'card_draw', cardType: 'W', count: 2, cards: ['W001', 'W002'], source: 'educational_mode',
    });
  });

  it('deck_reshuffled writes the message verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'deck_reshuffled', playerId: 'p1', cardType: 'W', message: 'Ran low on new Work Packages — recycled earlier ones back into the pool.' });

    expect(loggingService.info).toHaveBeenCalledWith('Ran low on new Work Packages — recycled earlier ones back into the pool.', {
      playerId: 'p1', action: 'deck_reshuffle', cardType: 'W',
    });
  });

  it('card_transferred writes the message verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_transferred', sourcePlayerId: 'p1', targetPlayerId: 'p2', cardId: 'E001', cardName: 'Extra Expeditor', message: 'Transferred Extra Expeditor to Bob' });

    expect(loggingService.info).toHaveBeenCalledWith('Transferred Extra Expeditor to Bob', {
      playerId: 'p1', action: 'card_transfer', cardId: 'E001', cardName: 'Extra Expeditor', targetPlayerId: 'p2',
    });
  });

  it('card_expired writes the message verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_expired', playerId: 'p1', cardId: 'L002', cardName: 'Sick Kid', message: '"Sick Kid" expired.' });

    expect(loggingService.info).toHaveBeenCalledWith('"Sick Kid" expired.', {
      playerId: 'p1', action: 'card_expire', cardId: 'L002',
    });
  });

  it('card_discarded writes the message verbatim', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_discarded', playerId: 'p1', cardIds: ['W001', 'W002'], message: 'Discarded 2 cards' });

    expect(loggingService.info).toHaveBeenCalledWith('Discarded 2 cards', {
      playerId: 'p1', action: 'card_discard', cardIds: ['W001', 'W002'],
    });
  });

  it('card_replaced reuses the card_discard tag verbatim (matches today\'s tag exactly)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_replaced', playerId: 'p1', oldCardId: 'W001', newCardId: 'W002', newCardType: 'W', message: 'Replaced "Old" with "New".' });

    expect(loggingService.info).toHaveBeenCalledWith('Replaced "Old" with "New".', {
      playerId: 'p1', action: 'card_discard', oldCardId: 'W001', newCardId: 'W002', newCardType: 'W',
    });
  });

  it('card_played writes "Played X" and carries activated/durationTurns', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_played', playerId: 'p1', cardId: 'L002', cardName: 'Economic Downturn', activated: true, durationTurns: 3 });

    expect(loggingService.info).toHaveBeenCalledWith('Played Economic Downturn', {
      playerId: 'p1', action: 'card_play', cardId: 'L002', cardName: 'Economic Downturn', activated: true, durationTurns: 3,
    });
  });

  it('card_played with activated:false carries no durationTurns', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_played', playerId: 'p1', cardId: 'E001', cardName: 'Extra Expeditor', activated: false });

    expect(loggingService.info).toHaveBeenCalledWith('Played Extra Expeditor', {
      playerId: 'p1', action: 'card_play', cardId: 'E001', cardName: 'Extra Expeditor', activated: false, durationTurns: undefined,
    });
  });

  it('card_activated writes "Activated X for N turns" (standalone case — e.g. CardEffectHandler\'s CARD_ACTIVATION effect)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_activated', playerId: 'p1', cardId: 'L002', cardName: 'Economic Downturn', durationTurns: 3 });

    expect(loggingService.info).toHaveBeenCalledWith('Activated "Economic Downturn" for 3 turns.', {
      playerId: 'p1', action: 'card_activate', cardId: 'L002', durationTurns: 3,
    });
  });

  it('card_effect_target_resolved (return_to_sender, resolved) uses the card_return_to_hand tag', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_effect_target_resolved', playerId: 'p1', mechanic: 'return_to_sender', resolved: true, targetPlayerName: 'Bob', cardName: 'Extra Expeditor', message: 'Alice returned Extra Expeditor to Bob\'s hand' });

    expect(loggingService.info).toHaveBeenCalledWith("Alice returned Extra Expeditor to Bob's hand", {
      playerId: 'p1', action: 'card_return_to_hand', targetPlayerName: 'Bob', cardName: 'Extra Expeditor',
    });
  });

  it('card_effect_target_resolved (return_to_sender, no target) uses the card_no_target tag', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_effect_target_resolved', playerId: 'p1', mechanic: 'return_to_sender', resolved: false, cardName: 'Extra Expeditor', message: 'Extra Expeditor played but no active E cards to target' });

    expect(loggingService.info).toHaveBeenCalledWith('Extra Expeditor played but no active E cards to target', {
      playerId: 'p1', action: 'card_no_target', targetPlayerName: undefined, cardName: 'Extra Expeditor',
    });
  });

  it('card_effect_target_resolved (favor_called_in, resolved) uses the favor_called_in tag (accidentally different from return_to_sender\'s tag — preserved as-is)', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_effect_target_resolved', playerId: 'p1', mechanic: 'favor_called_in', resolved: true, targetPlayerName: 'Bob', cardName: 'Call in a Favor', message: 'Alice called in a favor: Bob slowed down' });

    expect(loggingService.info).toHaveBeenCalledWith('Alice called in a favor: Bob slowed down', {
      playerId: 'p1', action: 'favor_called_in', targetPlayerName: 'Bob', cardName: 'Call in a Favor',
    });
  });

  it('card_effect_target_resolved (favor_called_in, no target) uses the shared card_no_target tag', () => {
    const { handleEvent, loggingService } = createLogWriter();
    handleEvent({ type: 'card_effect_target_resolved', playerId: 'p1', mechanic: 'favor_called_in', resolved: false, cardName: 'Call in a Favor', message: 'Call in a Favor played - no opponents, self benefit only' });

    expect(loggingService.info).toHaveBeenCalledWith('Call in a Favor played - no opponents, self benefit only', {
      playerId: 'p1', action: 'card_no_target', targetPlayerName: undefined, cardName: 'Call in a Favor',
    });
  });
});
