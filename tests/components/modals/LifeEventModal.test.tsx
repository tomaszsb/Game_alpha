import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LifeEventModal, type LifeEventModalData } from '../../../src/components/modals/LifeEventModal';
import { Card } from '../../../src/types/DataTypes';

// fb:dfdeaf1c — life events used to render inside the generic DiceResultModal
// with the originating space's header. LifeEventModal is the dedicated
// replacement.
//
// v3.0.68 (fb:1e76c24c / fb:701b26e3 / fb:7a2a2956) — the dedicated modal was a
// hard red "⚡ A major disturbance just hit the project" banner that framed good
// news as a disaster and showed the card's raw "roll a die" instructions. It is
// now a newspaper bulletin: a parchment "THE DAILY PERMIT" masthead, a
// tone-aware kicker (good news reads as good news), and a "bottom line" receipt
// of what actually changed. These tests pin the new contract.

describe('LifeEventModal', () => {
  afterEach(() => {
    cleanup();
  });

  const mockCard: Card = {
    card_id: 'L001',
    card_name: 'Lawsuit Filed',
    card_type: 'L',
    description: 'A neighbor filed a complaint and the project stalls.',
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

  it('uses a newspaper masthead, not the originating space name — the key fix for fb:dfdeaf1c', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    // The masthead reads "THE DAILY PERMIT" regardless of which space triggered it.
    expect(screen.getByText(/THE DAILY PERMIT/i)).toBeInTheDocument();
    // The originating space is never a heading.
    expect(screen.queryByRole('heading', { name: /ARCH-INITIATION/i })).not.toBeInTheDocument();
  });

  it('renders the card name as the headline', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByTestId('life-event-modal-card-name')).toHaveTextContent('Lawsuit Filed');
  });

  it('renders the card description as the article body', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByTestId('life-event-modal-card-description'))
      .toHaveTextContent('A neighbor filed a complaint and the project stalls.');
  });

  // --- Tone-aware kicker (replaces the old red "major disturbance" banner) ---

  it('shows a neutral "PROJECT BULLETIN" kicker when nothing measurable changed', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.getByTestId('life-event-modal-kicker')).toHaveTextContent(/PROJECT BULLETIN/i);
  });

  it('frames saved time as GOOD NEWS, not a disturbance (fb:1e76c24c)', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ ...mockData, effectsSummary: [{ kind: 'time', amount: -2, label: '-2 days' }] }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-kicker')).toHaveTextContent(/GOOD NEWS/i);
    // The old alarmist wording must be gone.
    expect(screen.queryByText(/major disturbance/i)).not.toBeInTheDocument();
  });

  it('frames lost time / revoked approval as a SETBACK', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{
          ...mockData,
          effectsSummary: [
            { kind: 'time', amount: 5, label: '+5 days' },
            { kind: 'approval_revoke', label: 'DOB approval revoked — you will need to re-apply' },
          ],
        }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-kicker')).toHaveTextContent(/SETBACK/i);
  });

  it('renders the dateline when a dayLabel is provided', () => {
    render(
      <LifeEventModal isOpen={true} data={{ ...mockData, dayLabel: 'Day 146' }} onClose={mockOnClose} />,
    );
    expect(screen.getByText(/Day 146/i)).toBeInTheDocument();
  });

  it('calls onClose when the dismiss button is clicked', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('life-event-modal-dismiss'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing visible when data is null (allows AnimatePresence exit)', () => {
    render(<LifeEventModal isOpen={true} data={null} onClose={mockOnClose} />);
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
    expect(screen.getByTestId('life-event-modal-card-name')).toBeInTheDocument();
    expect(screen.queryByTestId('life-event-modal-card-description')).not.toBeInTheDocument();
  });

  it('never exposes game-machinery language (rolled / raw space-id) — voice rule', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.queryByText(/rolled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ARCH-INITIATION/)).not.toBeInTheDocument();
  });

  it('also renders cleanly when diceValue / spaceName are absent (no-op props)', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ card: mockCard }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-kicker')).toBeInTheDocument();
    expect(screen.getByTestId('life-event-modal-card-name')).toBeInTheDocument();
  });

  // --- "The bottom line" receipts block (the realized outcome) ---

  it('omits the bottom-line block when effectsSummary is absent (legacy narrative-only card)', () => {
    render(<LifeEventModal isOpen={true} data={mockData} onClose={mockOnClose} />);
    expect(screen.queryByTestId('life-event-modal-effects')).not.toBeInTheDocument();
  });

  it('omits the bottom-line block when effectsSummary is empty', () => {
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

  it('shows a realized "no change this time" line for a dice card that landed on no effect', () => {
    // SpaceArrivalProcessor pushes this for dice_conditional cards whose roll hit
    // the 0-effect branch, so the player sees the outcome instead of instructions.
    render(
      <LifeEventModal
        isOpen={true}
        data={{
          ...mockData,
          effectsSummary: [{ kind: 'time', amount: 0, label: 'No change this time' }],
        }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-effect-time')).toHaveTextContent(/no change this time/i);
  });

  // --- Solo-safe description override (2026-07-24 playtest finding, MEDIUM) ---
  // L021 "High-Profile Client" says "...pushing everyone else back a step;
  // all other players' current filing time increases by 1 day" — nonsensical
  // in a 1-player game, where there is no one else. LifeEventModal takes a
  // playerCount prop and swaps in a trimmed variant via
  // getCardDescriptionForPlayerCount (src/utils/templateInterpolation.ts) for
  // just this known card, only when playerCount === 1.

  const highProfileClientCard: Card = {
    card_id: 'L021',
    card_name: 'High-Profile Client',
    card_type: 'L',
    description:
      "Your client's name opens doors — the permit office bumps your filing to the front of the line, " +
      "pushing everyone else back a step. The current filing time is reduced by 4 days; all other players' " +
      'current filing time increases by 1 day.',
  };

  it('shows the trimmed solo-safe text for L021 in a 1-player game', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ card: highProfileClientCard }}
        playerCount={1}
        onClose={mockOnClose}
      />,
    );
    const body = screen.getByTestId('life-event-modal-card-description');
    expect(body).toHaveTextContent(
      "Your client's name opens doors — the permit office bumps your filing to the front of the line. " +
      'The current filing time is reduced by 4 days.',
    );
    expect(body).not.toHaveTextContent(/other player/i);
    expect(body).not.toHaveTextContent(/everyone else/i);
  });

  it('shows the original full L021 text unchanged in a multiplayer (2+) game', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ card: highProfileClientCard }}
        playerCount={2}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-card-description')).toHaveTextContent(
      highProfileClientCard.description!,
    );
  });

  it('defaults to the full L021 text when playerCount is not passed (legacy caller)', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={{ card: highProfileClientCard }}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-card-description')).toHaveTextContent(
      highProfileClientCard.description!,
    );
  });

  it('renders another L card\'s description untouched even in a solo game (no override for it)', () => {
    render(
      <LifeEventModal
        isOpen={true}
        data={mockData} // L001 "Lawsuit Filed" — no override entry
        playerCount={1}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('life-event-modal-card-description'))
      .toHaveTextContent('A neighbor filed a complaint and the project stalls.');
  });

  it('voice rule: the receipts block uses "The bottom line" — no engine jargon', () => {
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
    expect(screen.getByText(/the bottom line/i)).toBeInTheDocument();
    expect(screen.queryByText(/effect type|process|applyCardEffects|RESOURCE_CHANGE/i)).not.toBeInTheDocument();
  });
});
