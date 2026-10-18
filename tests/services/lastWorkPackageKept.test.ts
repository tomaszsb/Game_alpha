import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardEffectHandler } from '../../src/services/CardEffectHandler';
import { Effect } from '../../src/types/EffectTypes';
import {
  createMockCardService,
  createMockStateService,
  createMockChoiceService,
  createMockLoggingService,
  createMockDataService,
  createMockNotificationService,
} from '../mocks/mockServices';

// PLAYTEST 2026-10-18 (diary spaces 4-11): at Lender Review a 1-in-6
// "Remove 1" roll took the player's ONLY work package. Scope went to $0 and
// the game carried on: a $2.25M loan and $0 architect/engineer fees for an
// empty project. Rule now: a project always keeps at least one work package.
describe('CardEffectHandler.handleCardDiscard: the last work package is never removed', () => {
  let handler: CardEffectHandler;
  let cards: any;

  beforeEach(() => {
    vi.clearAllMocks();
    cards = createMockCardService();
    cards.discardCards.mockResolvedValue(true);
    handler = new CardEffectHandler(
      cards,
      createMockStateService(),
      createMockChoiceService(),
      createMockLoggingService(),
      createMockDataService(),
      createMockNotificationService(),
    );
  });

  const removeW = (count: number, source = 'space:LEND-SCOPE-CHECK:dice_remove'): Effect => ({
    effectType: 'CARD_DISCARD',
    payload: { playerId: 'p1', cardIds: [], cardType: 'W' as any, count, source, reason: 'dice' },
  } as any);

  it('keeps the only work package and says so', async () => {
    cards.getPlayerCards.mockReturnValue(['W001']);
    const result = await handler.handleCardDiscard(removeW(1), { source: 'dice', playerId: 'p1' } as any);
    expect(cards.discardCards).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect((result.data as any).keptLastWorkPackage).toBe(true);
  });

  it('removes down to one, never to zero', async () => {
    cards.getPlayerCards.mockReturnValue(['W001', 'W002']);
    handler.autoPickForcedDiscards = true;
    await handler.handleCardDiscard(removeW(2), { source: 'dice', playerId: 'p1' } as any);
    expect(cards.discardCards).toHaveBeenCalledWith('p1', ['W001'], expect.anything(), expect.anything());
  });

  it('still removes one of two work packages normally', async () => {
    cards.getPlayerCards.mockReturnValue(['W001', 'W002']);
    handler.autoPickForcedDiscards = true;
    await handler.handleCardDiscard(removeW(1), { source: 'dice', playerId: 'p1' } as any);
    expect(cards.discardCards).toHaveBeenCalledWith('p1', ['W001'], expect.anything(), expect.anything());
  });

  it('a replace may take the last one (a new one is drawn right after)', async () => {
    cards.getPlayerCards.mockReturnValue(['W001']);
    await handler.handleCardDiscard(removeW(1, 'space:LEND-SCOPE-CHECK:dice_replace'), { source: 'dice', playerId: 'p1' } as any);
    expect(cards.discardCards).toHaveBeenCalledWith('p1', ['W001'], expect.anything(), expect.anything());
  });

  it('other card types can still go to zero', async () => {
    cards.getPlayerCards.mockReturnValue(['E001']);
    await handler.handleCardDiscard({
      effectType: 'CARD_DISCARD',
      payload: { playerId: 'p1', cardIds: [], cardType: 'E', count: 1, source: 'card:L003', reason: 'x' },
    } as any, { source: 'card', playerId: 'p1' } as any);
    expect(cards.discardCards).toHaveBeenCalledWith('p1', ['E001'], expect.anything(), expect.anything());
  });
});

// PLAYTEST-2 2026-10-18: the lender's "Choose 1 work package to remove" list showed raw
// card names (other buildings) and no prices, unlike the replace list.
describe('the remove-a-package list reads like the rest of the game', () => {
  it("uses the player's project wording and shows the price", async () => {
    const cards = createMockCardService();
    cards.getPlayerCards.mockReturnValue(['W001', 'W002']);
    cards.discardCards.mockResolvedValue(true);
    const state = createMockStateService();
    state.getPlayer.mockReturnValue({ id: 'p1', projectType: 'school' });
    const data = createMockDataService();
    (data.getCardById as any).mockImplementation((id: string) => ({ card_id: id, card_name: 'museum exhibit hall', cost: id === 'W001' ? 2_000_000 : 0, card_type: 'W' }));
    (data as any).getCardScopeTemplate = vi.fn((id: string) => (id === 'W001' ? 'HVAC upgrade for the {project}' : undefined));
    const choice = createMockChoiceService();
    choice.createChoice = vi.fn().mockResolvedValue('W002');
    const handler = new CardEffectHandler(cards, state, choice, createMockLoggingService(), data, createMockNotificationService());

    await handler.handleCardDiscard({
      effectType: 'CARD_DISCARD',
      payload: { playerId: 'p1', cardIds: [], cardType: 'W', count: 1, source: 'space:LEND-SCOPE-CHECK:dice_remove', reason: 'dice' },
    } as any, { source: 'dice', playerId: 'p1' } as any);

    const options = (choice.createChoice as any).mock.calls[0][3];
    expect(options[0].label).toBe('HVAC upgrade for the school ($2M)');
    expect(options[1].label).toBe('museum exhibit hall');
  });
});
