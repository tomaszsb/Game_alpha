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

  it('never exposes game-machinery language (rolled / raw space-id) — v3.0.23 fb:1aad6035', () => {
    // With diceValue + spaceName fully populated, the rendered modal must NOT
    // contain "rolled" or the raw space-id. The card body explains severity
    // in character; meta details stay out of the player view.
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.queryByText(/rolled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ARCH-INITIATION/)).not.toBeInTheDocument();
    // Severity banner still shows.
    expect(screen.getByText(/major disturbance/i)).toBeInTheDocument();
  });

  it('also renders cleanly when diceValue / spaceName are absent (no-op props)', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ card: mockCard }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText(/major disturbance/i)).toBeInTheDocument();
    expect(screen.getByTestId('life-event-modal-card-name')).toBeInTheDocument();
  });

  // v3.0.40 — effects-applied block. Playtest signal (2026-05-29): Kids A–E
  // worked but were invisible. The modal now shows a receipts block under the
  // card narrative when effectsSummary is non-empty.

  it('omits the effects block when effectsSummary is absent (legacy narrative-only card)', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.queryByTestId('life-event-modal-effects')).not.toBeInTheDocument();
  });

  it('omits the effects block when effectsSummary is empty', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ ...mockData, effectsSummary: [] }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByTestId('life-event-modal-effects')).not.toBeInTheDocument();
  });

  it('renders a money receipt with sign + comma formatting', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{
          ...mockData,
          effectsSummary: [
            { kind: 'money', amount: -5000, label: '-$5,000' },
          ],
        }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-effects')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-effect-money')).toHaveTextContent('-$5,000');
  });

  it('renders multiple receipts in order: money, time, approval, card, duration', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{
          ...mockData,
          effectsSummary: [
            { kind: 'money', amount: -2000, label: '-$2,000' },
            { kind: 'time', amount: 5, label: '+5 days' },
            { kind: 'approval_revoke', label: 'DOB approval revoked — you will need to re-apply' },
            { kind: 'card_lost', amount: -1, label: 'lost 1 resource' },
            { kind: 'duration_start', amount: 3, label: 'this will keep affecting you over the next few turns' },
          ],
        }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-effect-money')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-effect-time')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-effect-approval_revoke')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-effect-card_lost')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-effect-duration_start')).toBeInTheDocument();
  });

  it('voice rule: the effects block uses "What just happened" — no "machinery" wording', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{
          ...mockData,
          effectsSummary: [{ kind: 'money', amount: -1000, label: '-$1,000' }],
        }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText(/what just happened/i)).toBeInTheDocument();
    // No engine/processor jargon should leak into player view.
    expect(screen.queryByText(/effect type|process|applyCardEffects|RESOURCE_CHANGE/i)).not.toBeInTheDocument();
  });
});
