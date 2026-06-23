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

  it('activates through the service when the player can play it', async () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => {
      expect(services.cardService.playCard).toHaveBeenCalledWith('player1', 'E030');
    });
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
    // Keep (close without playing) is always available.
    expect(screen.getByRole('button', { name: /Keep/i })).toBeInTheDocument();
  });
});
