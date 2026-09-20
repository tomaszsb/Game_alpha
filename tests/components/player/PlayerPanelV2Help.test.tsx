/**
 * PlayerPanelV2 — "one ? everywhere" (Onboarding Phase C, v3.2.71).
 *
 * Tom, 2026-09-19: "we built all the helpful wording in already… maybe we just
 * have to unify the help ui / feel." Explaining used to have five looks: a boxed
 * "?" beside actions, a plain-text "▸ What to do & why" link, underlined glossary
 * words, a header Rules button, and hover-only tooltips. Of 37 real outside games
 * only 8 opened ANY help. The space's own explanation now wears the same "?" the
 * action rows do, and there is ONE open card across the whole panel.
 *
 * Wording is deliberately untouched by this change; these pin the behaviour.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerPanelV2 } from '../../../src/components/player/PlayerPanelV2';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';
import { trackPlaytestEvent } from '../../../src/playtest/playtestAnalytics';
import { getCurrentGameId } from '../../../src/utils/networkDetection';

vi.mock('../../../src/playtest/playtestAnalytics', () => ({ trackPlaytestEvent: vi.fn() }));
vi.mock('../../../src/utils/networkDetection', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/utils/networkDetection')>()),
  getCurrentGameId: vi.fn(() => 'G-TEST-0001'),
}));

describe('PlayerPanelV2 — one "?" everywhere', () => {
  let services: ReturnType<typeof createAllMockServices>;
  let panelPlayer: any;

  const ACTION = 'Lock the scope as offered, or push back and revisit tomorrow.';
  const OUTCOME = 'Scope is locked. Funding next.';

  const drawEffect: any = {
    effect_type: 'cards', effect_action: 'draw_e', trigger_type: 'manual',
    condition: '', effect_value: 1, description: 'Expeditors speed up approvals.',
    button_label: 'Bring in extra help',
  };
  // Every dice row shares the effect key `dice:dice_outcome`, on every space —
  // which is exactly how a help card once followed a player to the next space.
  const diceEffect: any = {
    effect_type: 'dice', effect_action: 'dice_outcome', trigger_type: 'manual',
    condition: '', effect_value: 'W Cards', description: 'See what he wants built',
    button_label: 'See what he wants built',
  };

  const guidance = { title: 'Meet the Owner', story: 'Sit down.', action_description: ACTION, outcome_description: OUTCOME };

  const setup = (opts: { effects?: any[]; content?: any } = {}) => {
    vi.clearAllMocks();
    vi.mocked(getCurrentGameId).mockReturnValue('G-TEST-0001');
    const effects = opts.effects ?? [drawEffect];
    services = createAllMockServices();
    panelPlayer = {
      id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
      hand: ['E001'], activeCards: [], activeEffects: [], loans: [],
      dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
    };
    services.stateService.getPlayer.mockReturnValue(panelPlayer);
    services.stateService.getGameState.mockReturnValue({
      players: [panelPlayer], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 1, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue(opts.content === undefined ? guidance : opts.content);
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue(effects);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue(effects);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockImplementation((id: string) =>
      id.startsWith('E') ? { card_id: id, card_type: 'E', card_name: 'Filing Rep' } : null);
  };

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  // Re-render the way the real StateService does: change what the mocks return,
  // then fire the panel's own subscription.
  const pushState = (changes: Record<string, unknown> = {}) => {
    services.stateService.getGameState.mockReturnValue({ ...services.stateService.getGameState(), ...changes });
    act(() => {
      services.stateService.subscribe.mock.calls.forEach(([cb]: any) => cb());
    });
  };

  const stepHelp = () => screen.getByRole('button', { name: /What's this\? Meet the Owner/ });
  const actionHelp = (label: RegExp) => screen.getByRole('button', { name: label });
  const openCards = () => screen.queryAllByTestId('help-card');

  afterEach(() => cleanup());
  beforeEach(() => setup());

  describe("the space's own \"?\"", () => {
    it('sits beside the space title, shut until asked', () => {
      renderPanel();
      const help = stepHelp();
      expect(help).toHaveAttribute('data-help-kind', 'step');
      expect(help).toHaveAttribute('aria-expanded', 'false');
      expect(openCards()).toHaveLength(0);
      // The words are not on screen until it is pressed.
      expect(screen.queryByText(ACTION)).not.toBeInTheDocument();
    });

    it('opens the same two lines the old "What to do & why" link opened', () => {
      renderPanel();
      fireEvent.click(stepHelp());

      const card = screen.getByTestId('help-card');
      expect(card).toHaveAttribute('data-help-kind', 'step');
      expect(card).toHaveTextContent(`What to do: ${ACTION}`);
      expect(card).toHaveTextContent(`Why: ${OUTCOME}`);
      expect(stepHelp()).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes again when pressed again', () => {
      renderPanel();
      fireEvent.click(stepHelp());
      fireEvent.click(stepHelp());
      expect(openCards()).toHaveLength(0);
      expect(stepHelp()).toHaveAttribute('aria-expanded', 'false');
    });

    it('replaces the old plain-text link rather than sitting beside it', () => {
      // Two ways to ask the same question is precisely the problem being fixed.
      renderPanel();
      expect(screen.queryByText(/What to do & why/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /What to do & why/i })).not.toBeInTheDocument();
    });

    it('is absent when the space has nothing authored — never a "?" onto an empty card', () => {
      setup({ content: { title: 'Meet the Owner', story: 'Sit down.' } });
      renderPanel();
      expect(screen.queryByRole('button', { name: /What's this\? Meet the Owner/ })).not.toBeInTheDocument();
      // The action's own "?" is unaffected.
      expect(actionHelp(/What's this\? Bring in extra help/)).toBeInTheDocument();
    });

    it('still shows when only one of the two lines is authored', () => {
      setup({ content: { title: 'Meet the Owner', story: 'Sit down.', action_description: ACTION } });
      renderPanel();
      fireEvent.click(stepHelp());
      const card = screen.getByTestId('help-card');
      expect(card).toHaveTextContent(`What to do: ${ACTION}`);
      expect(card).not.toHaveTextContent('Why:');
    });
  });

  describe('one open card across the whole panel', () => {
    it('opening an action\'s "?" closes the space\'s, and the other way round', () => {
      renderPanel();
      fireEvent.click(stepHelp());
      expect(screen.getByTestId('help-card')).toHaveAttribute('data-help-kind', 'step');

      fireEvent.click(actionHelp(/What's this\? Bring in extra help/));
      expect(openCards()).toHaveLength(1);
      expect(screen.getByTestId('help-card')).toHaveAttribute('data-help-kind', 'action');
      expect(stepHelp()).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(stepHelp());
      expect(openCards()).toHaveLength(1);
      expect(screen.getByTestId('help-card')).toHaveAttribute('data-help-kind', 'step');
    });

    it('two actions share the one slot too', () => {
      setup({ effects: [drawEffect, diceEffect] });
      renderPanel();
      fireEvent.click(actionHelp(/What's this\? Bring in extra help/));
      fireEvent.click(actionHelp(/What's this\? See what he wants built/));
      expect(openCards()).toHaveLength(1);
      expect(actionHelp(/What's this\? Bring in extra help/)).toHaveAttribute('aria-expanded', 'false');
    });

    it('every "?" wears the same structural hooks', () => {
      setup({ effects: [drawEffect, diceEffect] });
      renderPanel();
      const all = screen.getAllByTestId('help-button');
      // The space's own, plus one per action.
      expect(all).toHaveLength(3);
      expect(all.map((b) => b.getAttribute('data-help-kind')).sort()).toEqual(['action', 'action', 'step']);
    });
  });

  describe('a new space starts fresh', () => {
    it('forgets an open card when the player moves on', () => {
      renderPanel();
      fireEvent.click(stepHelp());
      expect(openCards()).toHaveLength(1);

      panelPlayer.currentSpace = 'OWNER-FUND-INITIATION';
      pushState({ globalTurnCount: 2 });

      expect(openCards()).toHaveLength(0);
    });

    it('does not carry a dice row\'s card to the next space, though every dice row shares one key', () => {
      // The bug this fixes: an action's card was keyed by its effect key, and
      // every dice row is `dice:dice_outcome` — so a card left open on one space
      // was still open on the next, showing the NEW space's text unasked.
      setup({ effects: [diceEffect] });
      renderPanel();
      fireEvent.click(actionHelp(/What's this\? See what he wants built/));
      expect(openCards()).toHaveLength(1);

      panelPlayer.currentSpace = 'ARCH-FEE-REVIEW';
      pushState({ globalTurnCount: 3 });

      expect(openCards()).toHaveLength(0);
    });
  });

  describe('counting help opens', () => {
    it('labels a space\'s "?" help:step and an action\'s help:action', () => {
      renderPanel();
      fireEvent.click(stepHelp());
      expect(trackPlaytestEvent).toHaveBeenLastCalledWith('panel_opened', {
        gameId: 'G-TEST-0001', playerId: 'player1', panel: 'help:step',
      });

      fireEvent.click(actionHelp(/What's this\? Bring in extra help/));
      expect(trackPlaytestEvent).toHaveBeenLastCalledWith('panel_opened', {
        gameId: 'G-TEST-0001', playerId: 'player1', panel: 'help:action',
      });
      expect(trackPlaytestEvent).toHaveBeenCalledTimes(2);
    });

    it('counts OPENS only — closing is not a second open', () => {
      renderPanel();
      fireEvent.click(stepHelp());
      fireEvent.click(stepHelp());
      expect(trackPlaytestEvent).toHaveBeenCalledTimes(1);
    });

    it('counts nothing outside a real game (no game id in the URL)', () => {
      vi.mocked(getCurrentGameId).mockReturnValue(null as any);
      renderPanel();
      fireEvent.click(stepHelp());
      expect(openCards()).toHaveLength(1);          // it still works…
      expect(trackPlaytestEvent).not.toHaveBeenCalled(); // …it just is not counted
    });
  });
});
