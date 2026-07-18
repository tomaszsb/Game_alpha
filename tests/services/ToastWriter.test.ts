// Domain-event stage 3 — one case per GameEvent type ToastWriter reacts to.
// Strings here were copied verbatim from each call site being migrated,
// before that call site's old notificationService.notify() was deleted.
import { describe, it, expect, vi } from 'vitest';
import { ToastWriter } from '../../src/services/ToastWriter';
import { GameEvent } from '../../src/types/GameEvents';

function createToastWriter() {
  const stateService: any = {
    subscribeToGameEvents: vi.fn(),
  };
  const notificationService: any = { notify: vi.fn() };
  new ToastWriter(stateService, notificationService);
  const handleEvent = stateService.subscribeToGameEvents.mock.calls[0][0] as (e: GameEvent) => void;
  return { handleEvent, notificationService };
}

describe('ToastWriter', () => {
  it('subscribes to the GameEvent bus on construction', () => {
    const stateService: any = { subscribeToGameEvents: vi.fn() };
    new ToastWriter(stateService, {} as any);
    expect(stateService.subscribeToGameEvents).toHaveBeenCalledTimes(1);
  });

  it('turn_committed notifies "Turn Ended"', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'turn_committed', playerId: 'p1', playerName: 'Alice', turn: 5, spaceName: 'OWNER-SCOPE-INITIATION' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: 'Turn Ended', medium: '🏁 Turn 5 ended', detailed: 'Alice ended Turn 5 at OWNER-SCOPE-INITIATION' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'endTurn', notificationDuration: 3000 }
    );
  });

  it('turn_discarded notifies "Try Again Used" with correct day/days pluralization', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'turn_discarded', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-PLAN-EXAM', timePenalty: 2, tryAgainCount: 1 });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: 'Try Again Used', medium: '🔄 Try Again: 2 day penalty', detailed: 'Alice used Try Again: 2 days penalty applied.' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'tryAgain', notificationDuration: 3000 }
    );
  });

  it('turn_discarded uses singular "day" for a 1-day penalty', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'turn_discarded', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-PLAN-EXAM', timePenalty: 1, tryAgainCount: 1 });

    const [content] = notificationService.notify.mock.calls[0];
    expect(content.detailed).toBe('Alice used Try Again: 1 day penalty applied.');
  });

  it('routed_back_to_review (gate_bounce) uses the player-directed detailed phrasing', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'routed_back_to_review', playerId: 'p1', playerName: 'Alice', spaceName: 'REG-DOB-FINAL-REVIEW', toSpace: 'REG-DOB-PLAN-EXAM', toSpaceTitle: 'DOB Plan Exam', reason: 'Missing DOB approval.', kind: 'gate_bounce' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: '→ DOB Plan Exam', medium: '📋 Missing DOB approval.', detailed: 'Alice: Missing DOB approval.' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'final_review_gate_bounce' }
    );
  });

  it('routed_back_to_review (single_destination) uses the "being directed to" phrasing', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'routed_back_to_review', playerId: 'p1', playerName: 'Alice', spaceName: 'CON-INITIATION', toSpace: 'REG-DOB-AUDIT', toSpaceTitle: 'DOB Audit', reason: 'A prior scope change triggered an audit.', kind: 'single_destination' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: '→ DOB Audit', medium: '📋 A prior scope change triggered an audit.', detailed: 'Alice is being directed to DOB Audit. A prior scope change triggered an audit.' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'review_loop_explanation' }
    );
  });

  it('routed_back_to_review (chosen_destination) uses the "chose" phrasing', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'routed_back_to_review', playerId: 'p1', playerName: 'Alice', spaceName: 'CON-INITIATION', toSpace: 'REG-DOB-AUDIT', toSpaceTitle: 'DOB Audit', reason: 'A prior scope change triggered an audit.', kind: 'chosen_destination' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: '→ DOB Audit', medium: '📋 A prior scope change triggered an audit.', detailed: 'Alice chose DOB Audit. A prior scope change triggered an audit.' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'review_loop_explanation' }
    );
  });

  it('manual_action_completed notifies "Action Complete"', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'manual_action_completed', playerId: 'p1', playerName: 'Alice', effectType: 'draw_W', summary: 'Took on 3 Work Packages' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: 'Action Complete', medium: '✅ Took on 3 Work Packages', detailed: 'Alice completed manual action: Took on 3 Work Packages' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'manualEffect', notificationDuration: 3000 }
    );
  });

  it('seed_money WITH turnEffectResult notifies "Seed Money" (owner-arrival funding path)', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'seed_money', playerId: 'p1', playerName: 'Alice', spaceName: 'OWNER-FUND-INITIATION', message: 'x', moneyAmount: 50000, turnEffectResult: {} as any });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: 'Seed Money', medium: '💰 Owner invested $50,000', detailed: 'Alice invested personal seed money: $50,000' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'automaticFunding', notificationDuration: 3000 }
    );
  });

  it('seed_money WITHOUT turnEffectResult does NOT notify (OWNER_SEED_MONEY card-effect path never had a toast)', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'seed_money', playerId: 'p1', playerName: 'Alice', spaceName: 'CON-INITIATION', message: 'x', amount: 50000 });

    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  it('recurring_card_effect_applied notifies "Ongoing event"', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({
      type: 'recurring_card_effect_applied', playerId: 'p1', playerName: 'Alice',
      sourceCardId: 'L002', cardName: 'Sick Kid', moneyDelta: -2000, timeDelta: 0, turnsLeftAfterThis: 2,
      headline: '🔁 Sick Kid still affecting you: -$2,000 — 2 more turns to go', delta: '-$2,000', tail: ' — 2 more turns to go',
    });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: 'Ongoing event', medium: '🔁 Sick Kid still affecting you: -$2,000 — 2 more turns to go', detailed: 'Recurring life event from Sick Kid: -$2,000 — 2 more turns to go.' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'life_event_recurring', notificationDuration: 5000 }
    );
  });

  it('life_event (L card) notifies the newspaper-style banner', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'life_event', playerId: 'p1', playerName: 'Alice', spaceName: 'PM-DECISION-CHECK', message: 'x', cardType: 'L', cardName: 'Broken Leg', cardId: 'L001' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: '📰', medium: '📰 Life event: Broken Leg', detailed: 'Alice hit a life event: Broken Leg' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'dice_conditional_card', notificationDuration: 5000 }
    );
  });

  it('dice_conditional_card (non-L card) notifies the "Received" banner', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'dice_conditional_card', playerId: 'p1', playerName: 'Alice', spaceName: 'PM-DECISION-CHECK', message: 'x', cardType: 'E', cardName: 'Extra Expeditor' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: '✓', medium: 'Received: Extra Expeditor', detailed: 'Alice received: Extra Expeditor' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'dice_conditional_card', notificationDuration: 5000 }
    );
  });

  it('does not notify for dice_rolled (neither original call site had a toast)', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'dice_rolled', playerId: 'p1', playerName: 'Alice', spaceName: 'CHEAT-BYPASS', diceValue: 4, trigger: 'manual', logMessage: 'Outcome determined' });

    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  it('does not notify for movement (its failure-toast stays inline in GameLayout, out of scope this stage)', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'movement', playerId: 'p1', playerName: 'Alice', spaceName: 'X', success: true, message: 'x' });

    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  // --- Domain-event stage 4: game_ended replaces the broken 'life_event'
  // repurposing — that case read cardType/cardName (never set by
  // bankruptcy/design_fee_cap/win), so it silently rendered
  // "Received: undefined" instead of the crafted message. ---

  it('game_ended (win) notifies "Victory!" using event.message verbatim', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'game_ended', reason: 'win', playerId: 'p1', playerName: 'Alice', spaceName: 'FINISH', message: '🏆 Alice reached the finish line and won the game!' });

    expect(notificationService.notify).toHaveBeenCalledWith(
      { short: 'Victory!', medium: '🏆 Alice reached the finish line and won the game!', detailed: '🏆 Alice reached the finish line and won the game!' },
      { playerId: 'p1', playerName: 'Alice', actionType: 'game_ended' }
    );
  });

  it('game_ended (bankruptcy) notifies "Game Over" using event.message verbatim (the bug this fixes)', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'game_ended', reason: 'bankruptcy', playerId: 'p1', playerName: 'Alice', spaceName: 'X', message: '💸 BANKRUPTCY: Alice has run out of money and cannot continue the project!' });

    const [content] = notificationService.notify.mock.calls[0];
    expect(content.short).toBe('Game Over');
    expect(content.medium).toBe('💸 BANKRUPTCY: Alice has run out of money and cannot continue the project!');
    expect(content.medium).not.toContain('undefined');
  });

  it('game_ended (design_fee_cap) notifies "Game Over" using event.message verbatim', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'game_ended', reason: 'design_fee_cap', playerId: 'p1', playerName: 'Alice', spaceName: 'X', message: '⛔ GAME OVER: Design fees exceeded 20% of project scope!' });

    const [content] = notificationService.notify.mock.calls[0];
    expect(content.short).toBe('Game Over');
    expect(content.medium).toBe('⛔ GAME OVER: Design fees exceeded 20% of project scope!');
  });

  it('does not notify for CardService lifecycle events (log-only, no companion toasts today)', () => {
    const { handleEvent, notificationService } = createToastWriter();
    handleEvent({ type: 'card_drawn', playerId: 'p1', cardType: 'W', count: 1, cards: ['W001'], source: 'x', message: 'x' });
    handleEvent({ type: 'card_played', playerId: 'p1', cardId: 'W001', cardName: 'x', activated: false });
    handleEvent({ type: 'card_activated', playerId: 'p1', cardId: 'W001', cardName: 'x', durationTurns: 3 });

    expect(notificationService.notify).not.toHaveBeenCalled();
  });
});
