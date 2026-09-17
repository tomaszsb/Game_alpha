/**
 * PlayerNumbersV2.test.tsx
 *
 * The new panel's "recall my numbers" reference (Pile 3 / change-legibility;
 * fb:f028e262, fb:cea108fb). Confirms it surfaces the scope total + each work
 * package with its cost, the money figures, and time — reusing the same W-card
 * cost basis as the classic ProjectLedger so the two can't drift.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

  const renderModal = (p: any = player, page: 'money' | 'scope' | 'expeditors' = 'money', extra: any = {}) => {
    services.stateService.getPlayer.mockReturnValue(p);
    return render(
      <DictionaryProvider>
        <PlayerNumbersV2 isOpen onClose={vi.fn()} playerId="player1" gameServices={services as any} mode="light" page={page} {...extra} />
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

  // The scope list is collapsed behind the "Total scope" header; tap it open.
  const openScope = () => fireEvent.click(screen.getByRole('button', { name: /Total scope/i }));

  it('lists each work package by name (recall what they were) and the money section', () => {
    renderModal(player, 'scope');
    expect(screen.getByText(/What you're building/i)).toBeInTheDocument();
    // Collapsed by default — packages appear once the scope header is opened.
    expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
    openScope();
    // Each work package is recallable by name (only the W cards, not the E card).
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Steel Frame')).toBeInTheDocument();
    expect(screen.queryByText('Rush Rep')).not.toBeInTheDocument();
    // The money figures live on their own page now (fb:adad1561).
    expect(screen.queryByText('Cash on hand')).not.toBeInTheDocument();
    cleanup();
    renderModal(player, 'money');
    expect(screen.getByText('Cash on hand')).toBeInTheDocument();
    expect(screen.getByText('Funding raised')).toBeInTheDocument();
    expect(screen.getByText('Spent so far')).toBeInTheDocument();
    expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
  });

  // fb:adad1561 — loans/investments and ongoing effects moved here from
  // "What's affecting you"; which family goes where is CARD_TYPES data.
  it('money page lists money-family cards and what is still affecting you', () => {
    const onOpenCard = vi.fn();
    services.dataService.getCardById.mockImplementation((id: string) => {
      if (id === 'B1') return { card_id: 'B1', card_type: 'B', card_name: 'Bridge Loan' } as any;
      if (id === 'L1') return { card_id: 'L1', card_type: 'L', card_name: 'Fee Hike' } as any;
      return null;
    });
    renderModal(
      { ...player, hand: ['B1', 'L1'], activeEffects: [{ effectId: 'x', description: 'Fee Hike still costing you', sourceCardId: 'L1' }] },
      'money',
      { onOpenCard },
    );
    expect(screen.getByText('Bridge Loan')).toBeInTheDocument();
    expect(screen.getByTestId('numbers-ongoing')).toHaveTextContent('Fee Hike still costing you');
    fireEvent.click(screen.getByRole('button', { name: /Details for Bridge Loan/i }));
    expect(onOpenCard).toHaveBeenCalledWith('B1');
    // A life event itself is History's, not Money's.
    expect(screen.queryByRole('button', { name: /Details for Fee Hike$/i })).not.toBeInTheDocument();
  });

  it('expeditors page lists every expeditor and offers Activate only on playable ones', () => {
    const onActivate = vi.fn();
    services.dataService.getCardById.mockImplementation((id: string) => {
      if (id === 'E1') return { card_id: 'E1', card_type: 'E', card_name: 'Rush Rep', phase_restriction: 'Any' } as any;
      if (id === 'E2') return { card_id: 'E2', card_type: 'E', card_name: 'Late Rep', phase_restriction: 'CONSTRUCTION' } as any;
      return null;
    });
    renderModal({ ...player, hand: ['E1', 'E2'] }, 'expeditors', { playableCardIds: ['E1'], onActivate });
    const page = screen.getByTestId('numbers-expeditors');
    expect(page).toHaveTextContent('Rush Rep');
    expect(page).toHaveTextContent('Late Rep');
    expect(screen.queryByRole('button', { name: /Activate Late Rep/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Activate Rush Rep/i }));
    expect(onActivate).toHaveBeenCalledWith('E1');
  });

  it('collapses the work packages behind the Total scope drill-down', () => {
    renderModal(player, 'scope');
    const scope = screen.getByRole('button', { name: /Total scope/i });
    expect(scope).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
    fireEvent.click(scope);
    expect(scope).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    fireEvent.click(scope); // tap again → collapses
    expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
  });

  it('groups work packages under their trade and drops the redundant days row', () => {
    renderModal(player, 'scope');
    openScope();
    const modal = screen.getByTestId('player-numbers-v2');
    // Both W cards are Structural → grouped under that trade heading.
    expect(modal).toHaveTextContent(/Structural/i);
    // Days spent moved out (it's already always-visible in the panel status zone).
    expect(screen.queryByText('Days spent')).not.toBeInTheDocument();
  });

  it('shows an empty-state when no work packages are held yet', () => {
    renderModal({ ...player, hand: ['E1'] }, 'scope'); // only a non-W card
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

  it('drills a work package open to show where its full cost goes', () => {
    renderModal(player, 'scope');
    openScope();
    // Collapsed: the breakdown lines are not in the DOM yet.
    expect(screen.queryByText(/The build itself/i)).not.toBeInTheDocument();
    const row = screen.getByRole('button', { name: /Foundation/i });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    // Tap it open → the soft-cost components + a full cost appear.
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    // Drill-down-unique lines (the area-budget section also says "Design…", so
    // assert on labels that only the breakdown shows).
    expect(screen.getByText(/The build itself/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety buffer \(contingency\)/i)).toBeInTheDocument();
    expect(screen.getByText('Full cost')).toBeInTheDocument();
    // Tap again → collapses.
    fireEvent.click(row);
    expect(screen.queryByText(/The build itself/i)).not.toBeInTheDocument();
  });

  it('shows the full project budget that "Still to raise" is measured against', () => {
    renderModal(player, 'scope');
    const modal = screen.getByTestId('player-numbers-v2');
    expect(modal).toHaveTextContent('Full project budget');
    // The plain-language reconciliation explaining why it exceeds the scope.
    expect(modal).toHaveTextContent(/fold in design/i);
  });

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
