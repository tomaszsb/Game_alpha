import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceArrivalProcessor } from '../../src/services/SpaceArrivalProcessor';
import {
  createMockDataService,
  createMockStateService,
  createMockCardService,
  createMockLoggingService,
  createMockGameRulesService,
} from '../mocks/mockServices';

// fb:f3f89f0d — "The player with the most completed projects reduces their
// current filing time by 4 days. How is this determined? How do I know which
// player got the bonus?" L046 "Expeditor Awards" (card_mechanic
// 'leader_phase_conditional') is drawn via TWO separate code paths that are
// supposed to share the same receipt-building logic (per the comment in
// SpaceArrivalProcessor.ts): CardEffectHandler (direct/manual draws) and this
// class (auto dice-conditional draws on space arrival — the "draw_L on
// dice_roll_N" effect present on nearly every space). CardEffectHandler had
// the buildLeaderReveal/buildCompetingWorktypeReveal branches; this class did
// not, so an L046 drawn by landing on a space (the common path) showed the
// bare "-4 days" line with no name attached.
describe('SpaceArrivalProcessor — life-event leader/competing reveals (fb:f3f89f0d)', () => {
  let dataService: ReturnType<typeof createMockDataService>;
  let stateService: ReturnType<typeof createMockStateService>;
  let cardService: ReturnType<typeof createMockCardService>;
  let loggingService: ReturnType<typeof createMockLoggingService>;
  let gameRulesService: ReturnType<typeof createMockGameRulesService>;
  let processor: SpaceArrivalProcessor;

  const player = { id: 'player1', name: 'Alice', hand: [], money: 100000, timeSpent: 50 };

  beforeEach(() => {
    dataService = createMockDataService();
    stateService = createMockStateService();
    cardService = createMockCardService();
    loggingService = createMockLoggingService();
    gameRulesService = createMockGameRulesService();

    stateService.getPlayer.mockReturnValue(player);
    stateService.getGameState.mockReturnValue({ isCapturingStartingHand: false });
    gameRulesService.evaluateCondition.mockReturnValue(true);

    processor = new SpaceArrivalProcessor(
      dataService,
      stateService,
      cardService,
      loggingService,
      gameRulesService,
    );
  });

  const L046_CARD = {
    card_id: 'L046',
    card_name: 'Expeditor Awards',
    card_type: 'L',
    tick_modifier: '-4',
    card_mechanic: 'leader_phase_conditional',
  };

  it('includes the leader_reveal receipt when an auto-drawn L card is leader_phase_conditional', async () => {
    cardService.drawCards.mockReturnValue(['L046']);
    dataService.getCardById.mockReturnValue(L046_CARD);
    cardService.buildLeaderReveal.mockReturnValue([
      { kind: 'leader_reveal', label: 'Bob is the leader (CONSTRUCTION) — saves 4 days' },
    ]);

    const effects = [
      { trigger_type: 'auto', effect_type: 'cards', effect_action: 'draw_L', condition: 'dice_roll_1' },
    ] as any;

    // Private method — called directly to isolate the receipt-building logic
    // from the (unrelated) EffectFactory/effectEngine space-arrival pipeline.
    await (processor as any).processDiceConditionalCardEffects(effects, player, 'ARCH-INITIATION', 1, true);

    expect(cardService.buildLeaderReveal).toHaveBeenCalledWith('player1', -4);
    expect(stateService.emitAutoAction).toHaveBeenCalledTimes(1);
    const event = stateService.emitAutoAction.mock.calls[0][0];
    expect(event.effectsSummary).toContainEqual({
      kind: 'leader_reveal',
      label: 'Bob is the leader (CONSTRUCTION) — saves 4 days',
    });
  });

  it('includes the competing_reveal receipt when an auto-drawn L card is competing_worktype_conditional', async () => {
    const L041_CARD = {
      card_id: 'L041',
      card_name: 'Trade Overlap',
      card_type: 'L',
      card_mechanic: 'competing_worktype_conditional',
    };
    cardService.drawCards.mockReturnValue(['L041']);
    dataService.getCardById.mockReturnValue(L041_CARD);
    cardService.buildCompetingWorktypeReveal.mockReturnValue([
      { kind: 'competing_reveal', label: 'You and Bob both work Plumbing' },
    ]);

    const effects = [
      { trigger_type: 'auto', effect_type: 'cards', effect_action: 'draw_L', condition: 'dice_roll_2' },
    ] as any;

    await (processor as any).processDiceConditionalCardEffects(effects, player, 'ARCH-INITIATION', 2, true);

    expect(cardService.buildCompetingWorktypeReveal).toHaveBeenCalledWith('player1');
    const event = stateService.emitAutoAction.mock.calls[0][0];
    expect(event.effectsSummary).toContainEqual({
      kind: 'competing_reveal',
      label: 'You and Bob both work Plumbing',
    });
  });

  it('does not call the reveal builders for an ordinary life event card', async () => {
    const L001_CARD = { card_id: 'L001', card_name: 'Ordinary Event', card_type: 'L', tick_modifier: '-1' };
    cardService.drawCards.mockReturnValue(['L001']);
    dataService.getCardById.mockReturnValue(L001_CARD);

    const effects = [
      { trigger_type: 'auto', effect_type: 'cards', effect_action: 'draw_L', condition: 'dice_roll_3' },
    ] as any;

    await (processor as any).processDiceConditionalCardEffects(effects, player, 'ARCH-INITIATION', 3, true);

    expect(cardService.buildLeaderReveal).not.toHaveBeenCalled();
    expect(cardService.buildCompetingWorktypeReveal).not.toHaveBeenCalled();
  });
});
