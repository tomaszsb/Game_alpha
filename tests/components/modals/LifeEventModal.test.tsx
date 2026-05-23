import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LifeEventModal, type LifeEventModalData } from '../../../src/components/modals/LifeEventModal';
import { Card } from '../../../src/types/DataTypes';

// fb:dfdeaf1c — life events used to render inside the generic DiceResultModal
// with the originating space's header, so the playtester perceived them as
// "mixed with the Architect modal." LifeEventModal is the dedicated red-themed
// replacement; these tests pin its behavior.

describe('LifeEventModal', () => {
  afterEach(() => {
    cleanup();
  });

  const mockCard: Card = {
    card_id: 'L001',
    card_name: 'Lawsuit Filed',
    card_type: 'L',
    description: 'A neighbor filed a complaint. Project delayed 2 weeks.',
  };

  const mockData: LifeEventModalData = {
    card: mockCard,
    diceValue: 1,
    spaceName: 'ARCH-INITIATION',
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders the dedicated life-event modal when open with data', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByTestId('life-event-modal')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-modal-body')).toBeInTheDocument();
  });

  it('uses its OWN header (not the originating space name) — the key fix for fb:dfdeaf1c', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    // The headline reads "LIFE EVENT" regardless of which space triggered it.
    // Previously DiceResultModal showed e.g. "ARCH-INITIATION" as the header
    // and the player thought the life event was part of the Architect flow.
    expect(screen.getByText(/LIFE EVENT/i)).toBeInTheDocument();
    // The originating space appears only in the parenthetical context line.
    expect(screen.queryByRole('heading', { name: /ARCH-INITIATION/i })).not.toBeInTheDocument();
  });

  it('renders the card name as the headline', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByTestId('life-event-modal-card-name')).toHaveTextContent('Lawsuit Filed');
  });

  it('renders the card description as the narrative body', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByTestId('life-event-modal-card-description'))
      .toHaveTextContent('A neighbor filed a complaint. Project delayed 2 weeks.');
  });

  it('surfaces the triggering roll + space in the sub-banner for transparency', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByText(/rolled 1 at ARCH-INITIATION/i)).toBeInTheDocument();
  });

  it('frames the event as a major disturbance (player-facing severity cue)', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByText(/major disturbance/i)).toBeInTheDocument();
  });

  it('calls onClose when the dismiss button is clicked', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('life-event-modal-dismiss'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing visible when data is null (allows AnimatePresence exit)', () => {
    render(<LifeEventModal isOpen={true} data={null} onClose={mockOnClose} />);
    // The modal mounts in a closed state — body content should not be present.
    expect(screen.queryByTestId('life-event-modal-body')).not.toBeInTheDocument();
  });

  it('handles a card with no description gracefully', () => {
    const noDescCard: Card = { ...mockCard, description: '' };
    render(
      <LifeEventModal
        isOpen={true}
        data={{ ...mockData, card: noDescCard }}
        onClose={mockOnClose}
      />,
    );
    // Headline still renders; description block is omitted.
    expect(screen.getByTestId('life-event-modal-card-name')).toBeInTheDocument();
    expect(screen.queryByTestId('life-event-modal-card-description')).not.toBeInTheDocument();
  });

  it('omits the (rolled X at SPACE) parenthetical when diceValue is absent', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ card: mockCard }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByText(/rolled/i)).not.toBeInTheDocument();
    // Severity banner still shows.
    expect(screen.getByText(/major disturbance/i)).toBeInTheDocument();
  });
});
