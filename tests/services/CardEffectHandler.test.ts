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

  // v3.0.40 — effects-applied summary attached to the life_event auto-action
  // event so the LifeEventModal can show a receipts block. Playtest signal:
  // Kids A–E worked but were invisible behind the card narrative.
  describe('effectsSummary on the life_event auto-action event', () => {
    const playerBase = {
      id: 'player1',
      name: 'Player 1',
      currentSpace: 'OWNER-FUND-INITIATION',
      money: 100000,
      timeSpent: 0,
      hand: ['L031'], // the L card itself was just drawn into hand
      activeEffects: [],
      dobApprovalStatus: undefined,
      fdnyApprovalStatus: undefined,
    };

    it('emits a money receipt when the card changed the player money', async () => {
      mockCardService.drawCards.mockReturnValue(['L031']);
      // Before snapshot (called inside handleCardDraw before applyCardEffects),
      // then again after for the diff, plus other internal getPlayer calls in
      // notifyLifeEventDraw. We want money to drop -$5,000 between snapshots.
      mockStateService.getPlayer
        .mockReturnValueOnce({ ...playerBase, money: 100000, hand: [] }) // before
        .mockReturnValueOnce({ ...playerBase, money: 95000, hand: ['L031'] }) // after
        .mockReturnValue({ ...playerBase, money: 95000, hand: ['L031'] }); // notify lookups

      await handler.handleCardDraw(drawEffect('L'), { source: 'space_arrival', playerId: 'player1' } as any);

      expect(mockStateService.emitAutoAction).toHaveBeenCalled();
      const event = mockStateService.emitAutoAction.mock.calls[0][0];
      expect(event.type).toBe('life_event');
      expect(event.effectsSummary).toBeDefined();
      const moneyReceipt = event.effectsSummary.find((e: any) => e.kind === 'money');
      expect(moneyReceipt).toBeDefined();
      expect(moneyReceipt.amount).toBe(-5000);
      expect(moneyReceipt.label).toBe('-$5,000');
    });

    it('emits an approval-revoke receipt when DOB approval flips out of approved (Kid A)', async () => {
      // ApprovalStatus is lowercase ('approved' | 'none' | …). This fixture used
      // uppercase 'APPROVED'/'PENDING' and so masked the v3.0.40 dead-code bug
      // (the diff compared to 'APPROVED' and never fired). v3.0.68 fixed the diff
      // to lowercase; the fixture now uses the real enum values.
      mockCardService.drawCards.mockReturnValue(['L003']);
      mockStateService.getPlayer
        .mockReturnValueOnce({ ...playerBase, dobApprovalStatus: 'approved', hand: [] })
        .mockReturnValueOnce({ ...playerBase, dobApprovalStatus: 'none', hand: ['L003'] })
        .mockReturnValue({ ...playerBase, dobApprovalStatus: 'none', hand: ['L003'] });

      await handler.handleCardDraw(drawEffect('L'), { source: 'space_arrival', playerId: 'player1' } as any);

      const event = mockStateService.emitAutoAction.mock.calls[0][0];
      const revoke = event.effectsSummary.find((e: any) => e.kind === 'approval_revoke');
      expect(revoke).toBeDefined();
      expect(revoke.label).toMatch(/DOB approval revoked/);
    });

    it('emits a duration_start receipt when the card added an active effect (Kid C)', async () => {
      mockCardService.drawCards.mockReturnValue(['L002']);
      mockStateService.getPlayer
        .mockReturnValueOnce({ ...playerBase, activeEffects: [], hand: [] })
        .mockReturnValueOnce({ ...playerBase, activeEffects: [{ effectId: 'a' } as any], hand: ['L002'] })
        .mockReturnValue({ ...playerBase, activeEffects: [{ effectId: 'a' } as any], hand: ['L002'] });

      await handler.handleCardDraw(drawEffect('L'), { source: 'space_arrival', playerId: 'player1' } as any);

      const event = mockStateService.emitAutoAction.mock.calls[0][0];
      const dur = event.effectsSummary.find((e: any) => e.kind === 'duration_start');
      expect(dur).toBeDefined();
      expect(dur.label).toMatch(/keep affecting you/i);
    });

    it('emits an empty effectsSummary when nothing measurable changed (pure narrative card)', async () => {
      mockCardService.drawCards.mockReturnValue(['L999']);
      mockStateService.getPlayer
        .mockReturnValueOnce({ ...playerBase, hand: [] })
        .mockReturnValueOnce({ ...playerBase, hand: ['L999'] })
        .mockReturnValue({ ...playerBase, hand: ['L999'] });

      await handler.handleCardDraw(drawEffect('L'), { source: 'space_arrival', playerId: 'player1' } as any);

      const event = mockStateService.emitAutoAction.mock.calls[0][0];
      // Hand went up by 1 (the L card itself) — that's subtracted in the diff,
      // so handDelta is 0 and the summary stays empty.
      expect(event.effectsSummary).toEqual([]);
    });
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
