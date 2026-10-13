import { describe, it, expect, beforeEach } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { ChoiceService } from '../../src/services/ChoiceService';
import { createMockDataService } from '../mocks/mockServices';

// fb:feedback-1791903091089-f9ab4c3a (Tom, live v3.7.23, a PC with a mouse): at Lender Review
// "Lock the scope" did nothing on a long press. It was gated on "Pick where you're going
// first" and no destination list was on screen. The turn's destination choice is created when
// the turn starts, and the space's own "See what the plan covers" roll can raise a card
// question (replace / discard). There is ONE choice slot, so that question overwrote the list
// and clearing it left the slot empty. In a seeded sweep of 25 games at LEND-SCOPE-CHECK, 9
// raised such a question and all 9 lost the list. Now the list is set aside and comes back.
describe('the destination list survives a card question (fb:f9ab4c3a)', () => {
  let state: StateService;
  let choices: ChoiceService;
  const dest = [
    { id: 'BANK-FUND-REVIEW', label: 'Bank' },
    { id: 'INVESTOR-FUND-REVIEW', label: 'Investor' },
  ];
  const cards = [{ id: 'W001', label: 'A card' }];

  beforeEach(() => {
    const data: any = createMockDataService();
    data.isLoaded.mockReturnValue(true);
    state = new StateService(data);
    choices = new ChoiceService(state);
  });

  it('answering the question puts the destination list back, and the list can still be answered', async () => {
    const move = choices.createChoice('p1', 'MOVEMENT', 'Where to?', dest);
    const moveChoice = state.getGameState().awaitingChoice!;

    const question = choices.createChoice('p1', 'CARD_REPLACEMENT', 'Replace one:', cards);
    const questionChoice = state.getGameState().awaitingChoice!;
    expect(questionChoice.type).toBe('CARD_REPLACEMENT');

    choices.resolveChoice(questionChoice.id, 'W001');
    await expect(question).resolves.toBe('W001');

    const after = state.getGameState().awaitingChoice;
    expect(after?.id).toBe(moveChoice.id);
    expect(after?.options.map(o => o.id)).toEqual(dest.map(o => o.id));

    expect(choices.resolveChoice(moveChoice.id, 'BANK-FUND-REVIEW')).toBe(true);
    await expect(move).resolves.toBe('BANK-FUND-REVIEW');
    expect(state.getGameState().awaitingChoice).toBeNull();
  });

  it('a card service that tidies up after its own question does not wipe the restored list', async () => {
    choices.createChoice('p1', 'MOVEMENT', 'Where to?', dest).catch(() => undefined);
    const question = choices.createChoice('p1', 'CARD_DISCARD', 'Remove one:', cards);
    choices.resolveChoice(state.getGameState().awaitingChoice!.id, 'W001');
    await question;
    // CardEffectService / CardEffectHandler call this right after their question resolves.
    state.clearAwaitingChoice({ keepMovement: true });
    expect(state.getGameState().awaitingChoice?.type).toBe('MOVEMENT');
  });

  it('skipping the question also gives the list back', async () => {
    choices.createChoice('p1', 'MOVEMENT', 'Where to?', dest).catch(() => undefined);
    const question = choices.createChoice('p1', 'CARD_DISCARD', 'Remove one:', cards);
    choices.skipChoice(state.getGameState().awaitingChoice!.id);
    await expect(question).resolves.toBe('');
    expect(state.getGameState().awaitingChoice?.type).toBe('MOVEMENT');
  });

  it('two questions in a row still end with the list back', async () => {
    choices.createChoice('p1', 'MOVEMENT', 'Where to?', dest).catch(() => undefined);
    const q1 = choices.createChoice('p1', 'CARD_REPLACEMENT', 'One:', cards);
    choices.resolveChoice(state.getGameState().awaitingChoice!.id, 'W001');
    await q1;
    const q2 = choices.createChoice('p1', 'CARD_DISCARD', 'Two:', cards);
    choices.resolveChoice(state.getGameState().awaitingChoice!.id, 'W001');
    await q2;
    expect(state.getGameState().awaitingChoice?.type).toBe('MOVEMENT');
  });

  it('ending the turn throws the set-aside list away instead of bringing it back', async () => {
    const move = choices.createChoice('p1', 'MOVEMENT', 'Where to?', dest);
    choices.createChoice('p1', 'CARD_DISCARD', 'Remove one:', cards).catch(() => undefined);
    choices.cancelAllPendingChoices('turn ended');
    await expect(move).resolves.toBe('');
    expect(state.getGameState().awaitingChoice).toBeNull();
  });

  it('a new turn\'s fresh destination list replaces a stale set-aside one', () => {
    choices.createChoice('p1', 'MOVEMENT', 'Old?', dest).catch(() => undefined);
    choices.createChoice('p1', 'CARD_DISCARD', 'Remove one:', cards).catch(() => undefined);
    state.clearAwaitingChoice({ discardSuspended: true }); // what TurnService.startTurn does
    choices.createChoice('p2', 'MOVEMENT', 'New?', dest).catch(() => undefined);
    expect(state.getGameState().awaitingChoice?.prompt).toBe('New?');
    state.clearAwaitingChoice(); // nothing set aside any more
    expect(state.getGameState().awaitingChoice).toBeNull();
  });

  it('with no destination list involved, clearing still just clears', () => {
    choices.createChoice('p1', 'CARD_DISCARD', 'Remove one:', cards).catch(() => undefined);
    state.clearAwaitingChoice();
    expect(state.getGameState().awaitingChoice).toBeNull();
  });
});
