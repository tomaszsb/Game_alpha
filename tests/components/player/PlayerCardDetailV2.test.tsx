/**
 * PlayerCardDetailV2.test.tsx
 *
 * The redesigned detailed-card view (spec §5). Confirms the §5 content model
 * renders (key facts as icon rows + "why this matters" callout) and that the
 * Activate action goes through the SERVICE (cardService.playCard) — no
 * component-local play logic.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerCardDetailV2 } from '../../../src/components/player/PlayerCardDetailV2';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';

describe('PlayerCardDetailV2 — detailed-card view (§5)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const card: any = {
    card_id: 'E030',
    card_type: 'E',
    card_name: 'Time Crunch',
    description: 'A fast-track expeditor who shaves days off your filing.',
    effects_on_play: 'Saves 2 days on the current filing.',
    money_effect: '-8000',
    tick_modifier: '-2',
    phase_restriction: 'REGULATORY_REVIEW',
    is_transferable: true,
  };

  const renderDetail = (open = true) =>
    render(
      <DictionaryProvider>
        <PlayerCardDetailV2
          isOpen={open}
          onClose={vi.fn()}
          card={card}
          playerId="player1"
          gameServices={services as any}
          mode="light"
        />
      </DictionaryProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.cardService.canPlayCard.mockReturnValue(true);
    services.cardService.playCard.mockResolvedValue({} as any);
    // Enough elapsed time that a -2 or -3 day card (the ticks used below)
    // always lands its full benefit, so tests unrelated to the partial-
    // savings feature (fb:feedback-1782842888855-aff0e337) aren't affected
    // by it. That feature has its own dedicated test further down.
    services.stateService.getPlayer.mockReturnValue({ id: 'player1', name: 'Player 1', timeSpent: 10 } as any);
  });

  afterEach(() => cleanup());

  it('renders the §5 content model — type, key facts, and the teaching callout', () => {
    renderDetail();
    expect(screen.getByText('Time Crunch')).toBeInTheDocument();
    expect(screen.getByText('⚡ Expeditor')).toBeInTheDocument();      // type chip
    expect(screen.getByText('$8,000')).toBeInTheDocument();           // cost fact
    expect(screen.getByText('2 days')).toBeInTheDocument();           // time fact
    expect(screen.getByText(/REGULATORY_REVIEW only/)).toBeInTheDocument(); // phase fact
    expect(screen.getByText(/Why this matters/i)).toBeInTheDocument(); // teaching callout
  });

  it('colours the day delta — green when it saves days, red when it adds (fb:39fd9f04)', () => {
    renderDetail(); // card saves 2 days (tick_modifier '-2')
    expect(screen.getByText('2 days')).toHaveStyle({ color: '#1e7e34' });
    cleanup();

    const delayCard = { ...card, card_id: 'L001', card_type: 'L', tick_modifier: '3', money_effect: '0' };
    render(
      <DictionaryProvider>
        <PlayerCardDetailV2
          isOpen
          onClose={vi.fn()}
          card={delayCard as any}
          playerId="player1"
          gameServices={services as any}
          mode="light"
        />
      </DictionaryProvider>,
    );
    expect(screen.getByText('3 days')).toHaveStyle({ color: '#c0392b' });
  });

  it('states the real (partial) day count in amber when not enough time has elapsed for the full benefit (fb:feedback-1782842888855-aff0e337)', () => {
    services.stateService.getPlayer.mockReturnValue({ id: 'player1', name: 'Player 1', timeSpent: 1 } as any);
    renderDetail(); // tick_modifier '-2', but only 1 day has elapsed
    expect(screen.getByText('1 of 2 days')).toHaveStyle({ color: '#f59e0b' });
    expect(screen.getByRole('button', { name: /^Activate/ })).toHaveTextContent('-1 of 2 days · -$8,000');
  });

  it('activates through the service when the player can play it', async () => {
    renderDetail();
    // fb:17cc481c — the button now states the effect ("Activate -2 days ·
    // -$8,000"), not a bare "Activate", so match by prefix rather than exact text.
    fireEvent.click(screen.getByRole('button', { name: /^Activate/ }));
    await waitFor(() => {
      expect(services.cardService.playCard).toHaveBeenCalledWith('player1', 'E030');
    });
  });

  it('states the effect on the Activate button instead of a bare label (fb:17cc481c)', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /^Activate/ })).toHaveTextContent('-2 days · -$8,000');
  });

  it('shows "What it does" for authored effect text', () => {
    renderDetail();
    expect(screen.getByText('What it does')).toBeInTheDocument();
    expect(screen.getByText(/Saves 2 days/)).toBeInTheDocument();
  });

  it('hides "What it does" for the generic "Apply Card" placeholder (all E/L cards)', () => {
    render(
      <DictionaryProvider>
        <PlayerCardDetailV2
          isOpen
          onClose={vi.fn()}
          card={{ ...card, effects_on_play: 'Apply Card' }}
          playerId="player1"
          gameServices={services as any}
          mode="light"
        />
      </DictionaryProvider>,
    );
    expect(screen.queryByText('What it does')).not.toBeInTheDocument();
    // The description + key facts still carry the meaning.
    expect(screen.getByText('What this is')).toBeInTheDocument();
    expect(screen.getByText('Key facts')).toBeInTheDocument();
  });

  it('hides Activate when the card is not currently playable', () => {
    services.cardService.canPlayCard.mockReturnValue(false);
    renderDetail();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
    // Review-only (nothing to activate): no footer dismiss button at all —
    // the modal's own X is the single close path (fb:feedback-1782839742726-f036c7aa).
    expect(screen.queryByRole('button', { name: /^Done$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Keep$/i })).not.toBeInTheDocument();
  });

  // The "not yet" phase hint explains the missing Activate (mirrors the classic
  // panel's "Can only be activated during X phase"). E030 is REGULATORY_REVIEW-
  // restricted, so the raw code prettifies to "Regulatory Review".
  it('shows a "not yet" phase hint when a phase-restricted expeditor is blocked', () => {
    services.cardService.canPlayCard.mockReturnValue(false);
    renderDetail();
    const hint = screen.getByTestId('phase-wait-hint');
    expect(hint).toHaveTextContent(/Not yet/i);
    expect(hint).toHaveTextContent(/Regulatory Review phase/i);
  });

  it('shows no phase hint once the expeditor is playable', () => {
    services.cardService.canPlayCard.mockReturnValue(true);
    renderDetail();
    expect(screen.queryByTestId('phase-wait-hint')).not.toBeInTheDocument();
  });

  // With a real choice (Activate now vs. keep for later) the dismiss button reads
  // "Keep" — the meaningful pairing the review-only "Close" case lacks (fb:f4d0e327).
  it('shows only Activate — no separate Keep button (single close via X, fb:f036c7aa)', () => {
    services.cardService.canPlayCard.mockReturnValue(true);
    renderDetail();
    expect(screen.getByRole('button', { name: /Activate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Keep$/i })).not.toBeInTheDocument();
  });

  // fb:8d68ab14 — a Work Package's detail showed an "Activate" button with nothing
  // to activate. Only Expeditors are played from hand; W/B/I/L reach this view for
  // reference, so no Activate even if the shared canPlayCard rule says yes.
  it('shows NO Activate for a non-Expeditor card even when canPlayCard is true', () => {
    services.cardService.canPlayCard.mockReturnValue(true);
    render(
      <DictionaryProvider>
        <PlayerCardDetailV2
          isOpen
          onClose={vi.fn()}
          card={{ card_id: 'W042', card_type: 'W', card_name: 'Foundation Work', description: 'Pour the footings.', cost: 50000 }}
          playerId="player1"
          gameServices={services as any}
          mode="light"
        />
      </DictionaryProvider>,
    );
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
    // No Activate → review-only → no footer dismiss button, X is the single close.
    expect(screen.queryByRole('button', { name: /^Done$/i })).not.toBeInTheDocument();
  });

  // fb:9c110d52 — a Work Package's estimated cost rendered as "Pays $X" (reads like
  // income). `card.cost` is always money spent, so it must label as a cost.
  it('labels a positive card.cost as "Costs", never "Pays"', () => {
    render(
      <DictionaryProvider>
        <PlayerCardDetailV2
          isOpen
          onClose={vi.fn()}
          card={{ card_id: 'W042', card_type: 'W', card_name: 'Foundation Work', description: 'Pour the footings.', cost: 50000 }}
          playerId="player1"
          gameServices={services as any}
          mode="light"
        />
      </DictionaryProvider>,
    );
    expect(screen.getByText('Costs')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.queryByText('Pays')).not.toBeInTheDocument();
  });

  // The "Pays" label is still correct for genuine income (a positive money_effect).
  it('labels a positive money_effect as "Pays" (income)', () => {
    render(
      <DictionaryProvider>
        <PlayerCardDetailV2
          isOpen
          onClose={vi.fn()}
          card={{ card_id: 'L012', card_type: 'L', card_name: 'Grant Awarded', description: 'A surprise grant lands.', money_effect: '5000' }}
          playerId="player1"
          gameServices={services as any}
          mode="light"
        />
      </DictionaryProvider>,
    );
    expect(screen.getByText('Pays')).toBeInTheDocument();
    expect(screen.getByText('$5,000')).toBeInTheDocument();
  });

  // A drawn L021 stays in the player's hand as a record and is "still tappable
  // to review what happened" (PlayerPanelV2's grayed Life Events chip), so this
  // view is a second place — besides LifeEventModal's initial popup — where the
  // 2026-07-24 playtest finding applies: L021's authored description says
  // "...pushing everyone else back a step; all other players' current filing
  // time increases by 1 day," which is nonsensical with no one else playing.
  describe('solo-safe description override (L021 "High-Profile Client")', () => {
    const highProfileClient: any = {
      card_id: 'L021',
      card_type: 'L',
      card_name: 'High-Profile Client',
      description:
        "Your client's name opens doors — the permit office bumps your filing to the front of the line, " +
        "pushing everyone else back a step. The current filing time is reduced by 4 days; all other players' " +
        'current filing time increases by 1 day.',
      effects_on_play: 'Apply Card',
      tick_modifier: '-4',
    };

    it('shows the trimmed solo-safe text when there is exactly 1 player', () => {
      services.stateService.getAllPlayers.mockReturnValue([{ id: 'player1', name: 'Player 1' }]);
      render(
        <DictionaryProvider>
          <PlayerCardDetailV2
            isOpen
            onClose={vi.fn()}
            card={highProfileClient}
            playerId="player1"
            gameServices={services as any}
            mode="light"
          />
        </DictionaryProvider>,
      );
      expect(screen.getByText(/bumps your filing to the front of the line\./)).toBeInTheDocument();
      expect(screen.queryByText(/everyone else/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/other players/i)).not.toBeInTheDocument();
    });

    it('shows the original full text unchanged with 2+ players', () => {
      services.stateService.getAllPlayers.mockReturnValue([
        { id: 'player1', name: 'Player 1' },
        { id: 'player2', name: 'Player 2' },
      ]);
      render(
        <DictionaryProvider>
          <PlayerCardDetailV2
            isOpen
            onClose={vi.fn()}
            card={highProfileClient}
            playerId="player1"
            gameServices={services as any}
            mode="light"
          />
        </DictionaryProvider>,
      );
      expect(screen.getByText(/pushing everyone else back a step/)).toBeInTheDocument();
    });

    it('defaults to the full text when getAllPlayers is unmocked (legacy/undefined return)', () => {
      // services.stateService.getAllPlayers is a bare vi.fn() with no
      // mockReturnValue here — pins the defensive "treat as multiplayer"
      // fallback so this component change can't break other tests/callers
      // that don't stub getAllPlayers.
      render(
        <DictionaryProvider>
          <PlayerCardDetailV2
            isOpen
            onClose={vi.fn()}
            card={highProfileClient}
            playerId="player1"
            gameServices={services as any}
            mode="light"
          />
        </DictionaryProvider>,
      );
      expect(screen.getByText(/pushing everyone else back a step/)).toBeInTheDocument();
    });

    it('renders another L card\'s description untouched even solo (no override for it)', () => {
      services.stateService.getAllPlayers.mockReturnValue([{ id: 'player1', name: 'Player 1' }]);
      render(
        <DictionaryProvider>
          <PlayerCardDetailV2
            isOpen
            onClose={vi.fn()}
            card={{ card_id: 'L012', card_type: 'L', card_name: 'Grant Awarded', description: 'A surprise grant lands.', money_effect: '5000' }}
            playerId="player1"
            gameServices={services as any}
            mode="light"
          />
        </DictionaryProvider>,
      );
      expect(screen.getByText('A surprise grant lands.')).toBeInTheDocument();
    });
  });
});
