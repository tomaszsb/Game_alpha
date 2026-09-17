// fb:feedback-1788493844027-c8769e0d — "the modal only refers to one card -
// when swapping it should say what was lost and what was gained". The swap's
// result used to carry only the ids that ARRIVED (cardIds); the card the player
// gave up was never recorded, so no screen could name it.

import { describe, it, expect, vi } from 'vitest';
import { ManualActionProcessor, handDifference } from '../../src/services/ManualActionProcessor';
import {
  createMockDataService,
  createMockStateService,
  createMockCardService,
  createMockLoggingService,
  createMockResourceService,
  createMockMovementService,
} from '../mocks/mockServices';

const SPACE = 'PM-DECISION-CHECK';

function setup(effectAction: string, handBefore: string[], handAfter: string[]) {
  const dataService = createMockDataService();
  const stateService = createMockStateService();
  dataService.getSpaceEffects.mockReturnValue([
    {
      space_name: SPACE, visit_type: 'First', effect_type: 'cards', effect_action: effectAction,
      effect_value: 1, condition: '', description: 'Swap one helper for another', trigger_type: 'manual',
    },
  ]);

  const player = (hand: string[]) => ({
    id: 'p1', name: 'P1', currentSpace: SPACE, visitType: 'First', hand, activeCards: [],
    money: 0, timeSpent: 0, moneySources: {},
  });
  let current = player(handBefore);
  stateService.getPlayer.mockImplementation(() => current);
  stateService.getGameState.mockImplementation(() => ({
    players: [current],
    completedActions: { manualActions: { [`cards:${effectAction}`]: 'done' } },
  }));

  const gameRulesService = {
    calculateProjectScope: vi.fn(() => 0),
    calculateEstimatedProjectLength: vi.fn(() => ({ estimatedDays: 0, uniqueWorkTypes: [] })),
  };
  const processor = new ManualActionProcessor(
    dataService, stateService, gameRulesService as any, createMockCardService(),
    createMockResourceService(), createMockMovementService(), {} as any, {} as any,
    createMockLoggingService()
  );
  // The hand change itself is the card service's job; here only the result
  // built around it is under test.
  vi.spyOn(processor, 'triggerManualEffect').mockImplementation(async () => {
    current = player(handAfter);
    return stateService.getGameState();
  });
  return processor;
}

describe('ManualActionProcessor — a swap records the card that left', () => {
  it('replace: cardIds is what arrived, removedCardIds is what left', async () => {
    const processor = setup('replace_e', ['E-OLD', 'E-KEEP'], ['E-KEEP', 'E-NEW']);
    const result = await processor.triggerManualEffectWithFeedback('p1', 'cards:replace_e');
    const cards = result.effects.find((e) => e.type === 'cards')!;
    expect(cards.cardAction).toBe('replace');
    expect(cards.cardIds).toEqual(['E-NEW']);
    expect(cards.removedCardIds).toEqual(['E-OLD']);
  });

  it('return: names the card let go even though nothing arrived', async () => {
    const processor = setup('return_e', ['E-OLD', 'E-KEEP'], ['E-KEEP']);
    const result = await processor.triggerManualEffectWithFeedback('p1', 'cards:return_e');
    const cards = result.effects.find((e) => e.type === 'cards')!;
    expect(cards.cardIds).toEqual([]);
    expect(cards.removedCardIds).toEqual(['E-OLD']);
  });

  it('draw: carries no removedCardIds', async () => {
    const processor = setup('draw_e', ['E-KEEP'], ['E-KEEP', 'E-NEW']);
    const result = await processor.triggerManualEffectWithFeedback('p1', 'cards:draw_e');
    const cards = result.effects.find((e) => e.type === 'cards')!;
    expect(cards.cardIds).toEqual(['E-NEW']);
    expect(cards.removedCardIds).toBeUndefined();
  });

  it('still names the card out when the hand held two copies of it', async () => {
    const processor = setup('replace_e', ['E-DUP', 'E-DUP', 'E-KEEP'], ['E-DUP', 'E-KEEP', 'E-NEW']);
    const result = await processor.triggerManualEffectWithFeedback('p1', 'cards:replace_e');
    const cards = result.effects.find((e) => e.type === 'cards')!;
    expect(cards.removedCardIds).toEqual(['E-DUP']);
    expect(cards.cardIds).toEqual(['E-NEW']);
  });
});

describe('handDifference', () => {
  it('is a one-for-one (multiset) difference', () => {
    expect(handDifference(['A', 'A', 'B'], ['A', 'B'])).toEqual(['A']);
    expect(handDifference(['A', 'B'], ['A', 'A', 'B'])).toEqual([]);
    expect(handDifference(['A', 'C'], [])).toEqual(['A', 'C']);
  });
});
