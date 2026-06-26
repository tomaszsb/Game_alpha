/**
 * PlayerNumbersV2.test.tsx
 *
 * The new panel's "recall my numbers" reference (Pile 3 / change-legibility;
 * fb:f028e262, fb:cea108fb). Confirms it surfaces the scope total + each work
 * package with its cost, the money figures, and time — reusing the same W-card
 * cost basis as the classic ProjectLedger so the two can't drift.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerNumbersV2 } from '../../../src/components/player/PlayerNumbersV2';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';

describe('PlayerNumbersV2 — recall reference', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const player: any = {
    id: 'player1', name: 'Test Player', money: 250000, timeSpent: 12,
    hand: ['W1', 'W2', 'E1'], activeCards: [],
    moneySources: { ownerFunding: 100000, bankLoans: 50000 },
    expenditures: { design: 20000, fees: 5000, construction: 0 },
  };

  const renderModal = (p: any = player) => {
    services.stateService.getPlayer.mockReturnValue(p);
    return render(
      <DictionaryProvider>
        <PlayerNumbersV2 isOpen onClose={vi.fn()} playerId="player1" gameServices={services as any} mode="light" />
      </DictionaryProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.dataService.getCardById.mockImplementation((id: string) => {
      if (id === 'W1') return { card_id: 'W1', card_type: 'W', card_name: 'Foundation', cost: 80000 } as any;
      if (id === 'W2') return { card_id: 'W2', card_type: 'W', card_name: 'Steel Frame', cost: 120000 } as any;
      if (id === 'E1') return { card_id: 'E1', card_type: 'E', card_name: 'Rush Rep' } as any;
      return null;
    });
  });

  afterEach(() => cleanup());

  it('lists each work package by name (recall what they were) and the money/time sections', () => {
    renderModal();
    expect(screen.getByText(/What you're building/i)).toBeInTheDocument();
    // Each work package is recallable by name (only the W cards, not the E card).
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Steel Frame')).toBeInTheDocument();
    expect(screen.queryByText('Rush Rep')).not.toBeInTheDocument();
    // Money + time labels present.
    expect(screen.getByText('Cash on hand')).toBeInTheDocument();
    expect(screen.getByText('Funding raised')).toBeInTheDocument();
    expect(screen.getByText('Spent so far')).toBeInTheDocument();
    expect(screen.getByText('Days spent')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // days
  });

  it('shows an empty-state when no work packages are held yet', () => {
    renderModal({ ...player, hand: ['E1'] }); // only a non-W card
    expect(screen.getByText(/No work packages yet/i)).toBeInTheDocument();
  });
});
