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

// Regression: Life Event (L) cards drawn automatically must have their
// money/time effects applied. Before this fix the auto-draw path only added the
// card to hand — tick_modifier / money_effect never ran. Effects are applied
// with onlyResourceEffects so nothing can draw/prompt/loop (which previously
// hung the headless ghost gate).
describe('CardEffectHandler.handleCardDraw — Life Event effect application', () => {
  let handler: CardEffectHandler;
  let mockCardService: any;
  let mockStateService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCardService = createMockCardService();
    mockStateService = createMockStateService();
    handler = new CardEffectHandler(
      mockCardService,
      mockStateService,
      createMockChoiceService(),
      createMockLoggingService(),
      createMockDataService(),
      createMockNotificationService(),
    );
  });

  const drawEffect = (cardType: string): Effect => ({
    effectType: 'CARD_DRAW',
    payload: { playerId: 'player1', cardType: cardType as any, count: 1, source: 'auto', reason: 'test' },
  });

  it('applies an auto-drawn L (Life Event) card with onlyResourceEffects', async () => {
    mockCardService.drawCards.mockReturnValue(['L031']);

    await handler.handleCardDraw(drawEffect('L'), { source: 'space_arrival', playerId: 'player1' } as any);

    expect(mockCardService.applyCardEffects).toHaveBeenCalledWith('player1', 'L031', { onlyResourceEffects: true });
  });

  it('does NOT apply effects for non-L card draws (e.g. E expeditor cards)', async () => {
    mockCardService.drawCards.mockReturnValue(['E001']);

    await handler.handleCardDraw(drawEffect('E'), { source: 'space_arrival', playerId: 'player1' } as any);

    expect(mockCardService.applyCardEffects).not.toHaveBeenCalled();
  });

  it('does NOT apply L effects while capturing the Quick Start starting hand', async () => {
    mockCardService.drawCards.mockReturnValue(['L031']);
    mockStateService.getGameState.mockReturnValue({ isCapturingStartingHand: true, players: [] });

    await handler.handleCardDraw(drawEffect('L'), { source: 'space_arrival', playerId: 'player1' } as any);

    expect(mockCardService.applyCardEffects).not.toHaveBeenCalled();
  });
});

// Kid E (2026-05-29) — autoPickForcedDiscards bypasses the choice modal so
// the headless ghost bot can resolve L003/L048 forced discards without
// hanging on a click it can't make. Human players keep the modal.
describe('CardEffectHandler.handleCardDiscard — autoPickForcedDiscards (Kid E)', () => {
  let handler: CardEffectHandler;
  let mockCardService: any;
  let mockChoiceService: any;
  let mockStateService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCardService = createMockCardService();
    mockChoiceService = createMockChoiceService();
    mockStateService = createMockStateService();
    handler = new CardEffectHandler(
      mockCardService,
      mockStateService,
      mockChoiceService,
      createMockLoggingService(),
      createMockDataService(),
      createMockNotificationService(),
    );
  });

  const flaggedDiscardEffect = (): Effect => ({
    effectType: 'CARD_DISCARD',
    payload: {
      playerId: 'player1',
      cardIds: [],
      cardType: 'E' as any,
      count: 1,
      requiresUserChoice: true,
      source: 'card:L003',
    },
  });

  it('shows the choice modal by default (production / human players)', async () => {
    mockCardService.getPlayerCards.mockReturnValue(['E001', 'E002', 'E003']);
    mockCardService.discardCards.mockResolvedValue(true);
    // Modal returns the first card as the player's pick.
    mockChoiceService.createChoice = vi.fn().mockResolvedValue('E002');

    await handler.handleCardDiscard(flaggedDiscardEffect(), { source: 'card:L003', playerId: 'player1' } as any);

    expect(mockChoiceService.createChoice).toHaveBeenCalled();
  });

  it('auto-picks oldest (skips modal) when autoPickForcedDiscards is true (ghost bot)', async () => {
    handler.autoPickForcedDiscards = true;
    mockCardService.getPlayerCards.mockReturnValue(['E001', 'E002', 'E003']);
    mockCardService.discardCards.mockResolvedValue(true);
    mockChoiceService.createChoice = vi.fn();

    await handler.handleCardDiscard(flaggedDiscardEffect(), { source: 'card:L003', playerId: 'player1' } as any);

    expect(mockChoiceService.createChoice).not.toHaveBeenCalled();
    // Auto-picked the first card (slice).
    expect(mockCardService.discardCards).toHaveBeenCalledWith('player1', ['E001'], expect.anything(), expect.anything());
  });
});
