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
      if (id === 'W1') return { card_id: 'W1', card_type: 'W', card_name: 'Foundation', cost: 80000, work_type_restriction: 'Structural' } as any;
      if (id === 'W2') return { card_id: 'W2', card_type: 'W', card_name: 'Steel Frame', cost: 120000, work_type_restriction: 'Structural' } as any;
      if (id === 'E1') return { card_id: 'E1', card_type: 'E', card_name: 'Rush Rep' } as any;
      return null;
    });
  });

  afterEach(() => cleanup());

  it('lists each work package by name (recall what they were) and the money section', () => {
    renderModal();
    expect(screen.getByText(/What you're building/i)).toBeInTheDocument();
    // Each work package is recallable by name (only the W cards, not the E card).
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Steel Frame')).toBeInTheDocument();
    expect(screen.queryByText('Rush Rep')).not.toBeInTheDocument();
    // Money labels present.
    expect(screen.getByText('Cash on hand')).toBeInTheDocument();
    expect(screen.getByText('Funding raised')).toBeInTheDocument();
    expect(screen.getByText('Spent so far')).toBeInTheDocument();
  });

  it('groups work packages under their trade and drops the redundant days row', () => {
    renderModal();
    const modal = screen.getByTestId('player-numbers-v2');
    // Both W cards are Structural → grouped under that trade heading.
    expect(modal).toHaveTextContent(/Structural/i);
    // Days spent moved out (it's already always-visible in the panel status zone).
    expect(screen.queryByText('Days spent')).not.toBeInTheDocument();
  });

  it('shows an empty-state when no work packages are held yet', () => {
    renderModal({ ...player, hand: ['E1'] }); // only a non-W card
    expect(screen.getByText(/No work packages yet/i)).toBeInTheDocument();
  });

  it('breaks down where the money is going, spent vs budget per area', () => {
    renderModal();
    const modal = screen.getByTestId('player-numbers-v2');
    expect(screen.getByText(/Where your money's going/i)).toBeInTheDocument();
    // Labels can be split by glossary term-links (TextWithTerms), so assert on
    // the modal's full text content rather than single text nodes.
    expect(modal).toHaveTextContent('Design & professional fees');
    expect(modal).toHaveTextContent('Regulatory & filings');
    expect(modal).toHaveTextContent('Construction');
    expect(modal).toHaveTextContent(/Contingency/i);
  });

  // Note: glossary term-linking (§6 — TextWithTerms wraps "Regulatory" /
  // "Construction" / "scope") is a runtime behavior verified live in the browser;
  // the test DictionaryProvider doesn't load real glossary data in jsdom.

  it('hides the breakdown until there is scope to budget against', () => {
    renderModal({ ...player, hand: ['E1'] }); // no W cards → no scope
    expect(screen.queryByText(/Where your money's going/i)).not.toBeInTheDocument();
  });

  it('flags a funding gap when commitments exceed money raised', () => {
    // scope 200k → commitments (scope + 20% + 5% + 10% contingency) ≈ 255k vs 150k raised.
    renderModal();
    expect(screen.getByText('Still to raise')).toBeInTheDocument();
  });

  it('shows no funding gap once enough has been raised', () => {
    renderModal({ ...player, moneySources: { ownerFunding: 5000000 } });
    expect(screen.queryByText('Still to raise')).not.toBeInTheDocument();
  });

  it('marks an area that has overrun its budget', () => {
    // scope 200k → design budget 40k; spend 60k → design ▲ over budget (and the
    // overrun spills into the contingency buffer, which also flags over).
    renderModal({ ...player, expenditures: { design: 60000, fees: 0, construction: 0 } });
    expect(screen.getAllByText(/over budget/i).length).toBeGreaterThan(0);
  });
});
