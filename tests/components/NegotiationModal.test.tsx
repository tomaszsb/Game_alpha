/**
 * NegotiationModal.test.tsx
 *
 * Test suite for NegotiationModal component to verify NotificationService integration
 * for all major negotiation actions: make offer, accept offer, and decline offer.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NegotiationModal } from '../../src/components/modals/NegotiationModal';
import { GameContext } from '../../src/context/GameContext';
import { Player } from '../../src/types/StateTypes';
import { Card } from '../../src/types/DataTypes';
import { createAllMockServices } from '../mocks/mockServices';

describe('NegotiationModal', () => {
  beforeEach(() => {
    cleanup();
  });

  let mockServices: any;
  let mockCurrentPlayer: any;
  let mockOtherPlayers: any[];
  let mockCards: Card[];
  let mockGameState: any;

  beforeEach(() => {
    mockServices = createAllMockServices();

    mockCurrentPlayer = {
      id: 'player1',
      name: 'Current Player',
      currentSpace: 'TEST-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
      projectScope: 0,
      score: 0,
      color: '#007bff',
      avatar: '👤',
      hand: ['W001', 'E001'], // Player has some cards
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    mockOtherPlayers = [
      {
        id: 'player2',
        name: 'Other Player 1',
        currentSpace: 'OTHER-SPACE',
        visitType: 'First',
        money: 500,
        timeSpent: 3,
        projectScope: 0,
        score: 0,
        color: '#28a745',
        avatar: '🎭',
        hand: ['W002'],
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      },
      {
        id: 'player3',
        name: 'Other Player 2',
        currentSpace: 'ANOTHER-SPACE',
        visitType: 'First',
        money: 750,
        timeSpent: 2,
        projectScope: 0,
        score: 0,
        color: '#dc3545',
        avatar: '🎨',
        hand: ['E002'],
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      }
    ];

    mockCards = [
      {
        card_id: 'W001',
        card_name: 'Basic Work Card',
        card_type: 'W',
        description: 'A basic work card',
        effects_on_play: 'money:+100',
        cost: 50
      },
      {
        card_id: 'E001',
        card_name: 'Expert Card',
        card_type: 'E',
        description: 'An expert card',
        effects_on_play: 'time:-1',
        cost: 200
      }
    ];

    mockGameState = {
      players: [mockCurrentPlayer, ...mockOtherPlayers],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      turn: 1,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      hasCompletedManualActions: false,
      requiredActions: 0,
      completedActions: 0
    };

    // Configure mock services with proper game state
    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      // Immediately call callback with initial state
      callback(mockGameState);
      return vi.fn(); // Return unsubscribe function
    });
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.dataService.getCards.mockReturnValue(mockCards);
    mockServices.cardService.getCardType.mockImplementation((cardId: string) => {
      const card = mockCards.find(c => c.card_id === cardId);
      return card?.card_type || 'W';
    });

    // Mock negotiation service methods
    mockServices.negotiationService.initiateNegotiation.mockResolvedValue({
      success: true,
      message: 'Negotiation started successfully',
      negotiationId: 'neg-1',
      effects: [],
    });
    mockServices.negotiationService.makeOffer.mockResolvedValue({
      success: true,
      message: 'Negotiation completed - offer accepted',
      negotiationId: 'neg-1',
      data: { accepted: true },
      effects: [],
    });
  });

  it('skips partner-selection and goes straight to making an offer when initialPartnerId is given', () => {
    const mockProps = { isOpen: true, onClose: vi.fn(), initialPartnerId: 'player2' };

    render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    expect(screen.getByText(/Making offer to: Other Player 1/)).toBeInTheDocument();
    expect(mockServices.negotiationService.initiateNegotiation).toHaveBeenCalledWith('player1', 'player2');
  });

  it('falls back to the partner-selection screen when initialPartnerId is missing or invalid', () => {
    const mockProps = { isOpen: true, onClose: vi.fn(), initialPartnerId: 'not-a-real-player' };

    render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    expect(screen.getByText('Select a player to negotiate with:')).toBeInTheDocument();
    expect(mockServices.negotiationService.initiateNegotiation).not.toHaveBeenCalled();
  });

  it('sends money + cards via makeOffer, awaits the result, and shows a success notification when the partner accepts', async () => {
    const mockProps = { isOpen: true, onClose: vi.fn(), initialPartnerId: 'player2' };

    const { container } = render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    const moneyInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(moneyInput, { target: { value: '100' } });

    const makeOfferButton = screen.getByText(/Make Offer/);
    fireEvent.click(makeOfferButton);

    await waitFor(() => {
      expect(mockServices.negotiationService.makeOffer).toHaveBeenCalledWith(
        'player1',
        expect.objectContaining({ money: 100, cards: [] })
      );
    });

    await waitFor(() => {
      expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ detailed: expect.stringContaining('Offer Accepted') }),
        expect.objectContaining({ actionType: 'negotiation_accept' })
      );
    });

    await waitFor(() => expect(mockProps.onClose).toHaveBeenCalled());
  });

  it('shows a decline notification and closes when the partner declines', async () => {
    mockServices.negotiationService.makeOffer.mockResolvedValue({
      success: true,
      message: 'Negotiation declined - offer withdrawn',
      negotiationId: 'neg-1',
      data: { accepted: false },
      effects: [],
    });

    const mockProps = { isOpen: true, onClose: vi.fn(), initialPartnerId: 'player2' };

    const { container } = render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    const moneyInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(moneyInput, { target: { value: '50' } });
    fireEvent.click(screen.getByText(/Make Offer/));

    await waitFor(() => {
      expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ detailed: expect.stringContaining('declined') }),
        expect.objectContaining({ actionType: 'negotiation_decline' })
      );
    });

    await waitFor(() => expect(mockProps.onClose).toHaveBeenCalled());
  });

  it('should render modal when open', () => {
    const mockProps = {
      isOpen: true,
      onClose: vi.fn()
    };

    render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    // Verify the modal renders by checking for the modal container
    expect(screen.getByTestId('negotiation-modal')).toBeInTheDocument();
  });

  it('should not render modal when closed', () => {
    const mockProps = {
      isOpen: false,
      onClose: vi.fn()
    };

    render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    // Verify modal is not rendered when closed
    expect(screen.queryByTestId('negotiation-modal')).not.toBeInTheDocument();
  });

  it('should apply ModalConfig overrides for title, partner-selection prompt, and make-offer button', () => {
    mockServices.dataService.getModalConfig.mockReturnValue({
      modal_title: 'Haggle with {partnerName}',
      modal_description: 'Pick someone to barter with, {playerName}.',
      modal_button_label: 'Send Bribe',
    });

    const mockProps = { isOpen: true, onClose: vi.fn() };
    render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    // Lookup invoked with current player's space + visit type + 'negotiate'
    expect(mockServices.dataService.getModalConfig).toHaveBeenCalledWith(
      'TEST-SPACE',
      'First',
      'negotiate'
    );

    // Partner-selection prompt should use the override, interpolated with {playerName}
    expect(screen.getByText('Pick someone to barter with, Current Player.')).toBeInTheDocument();

    // Title is rendered by ModalBase — partnerName is empty in selecting_partner state
    // so we match just the leading substring of the override.
    expect(screen.getByText(/Haggle with/)).toBeInTheDocument();
  });

  it('should fall back to hardcoded defaults when no ModalConfig is configured', () => {
    mockServices.dataService.getModalConfig.mockReturnValue(undefined);

    const mockProps = { isOpen: true, onClose: vi.fn() };
    render(
      <GameContext.Provider value={mockServices}>
        <NegotiationModal {...mockProps} />
      </GameContext.Provider>
    );

    expect(screen.getByText('Select a player to negotiate with:')).toBeInTheDocument();
  });

});
