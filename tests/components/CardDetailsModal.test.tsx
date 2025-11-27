/**
 * CardDetailsModal.test.tsx
 *
 * Test suite for CardDetailsModal component to verify NotificationService integration
 * for card transfer actions, including both successful and failed transfers.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardDetailsModal } from '../../src/components/modals/CardDetailsModal';
import { GameContext } from '../../src/context/GameContext';
import { Player } from '../../src/types/StateTypes';
import { Card } from '../../src/types/DataTypes';
import { createAllMockServices } from '../mocks/mockServices';

describe('CardDetailsModal', () => {
  let mockServices: any;
  let mockCurrentPlayer: Player;
  let mockOtherPlayers: Player[];
  let mockTransferableCard: Card;
  let mockProps: any;

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
      hand: ['E001'], // Player has the transferable card in hand
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
        hand: [],
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
        hand: [],
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      }
    ];

    mockTransferableCard = {
      card_id: 'E001',
      card_name: 'Permit Expeditor',
      card_type: 'E',
      description: 'Expedites permit processing',
      effects_on_play: 'time:-2',
      cost: 200,
      is_transferable: true
    };

    mockProps = {
      isOpen: true,
      onClose: vi.fn(),
      card: mockTransferableCard,
      currentPlayer: mockCurrentPlayer,
      otherPlayers: mockOtherPlayers,
      cardService: mockServices.cardService
    };

    // Configure mock cardService to return proper card type
    mockServices.cardService.getCardType.mockReturnValue('E');
  });

  it('should call notificationService.notify on successful card transfer', () => {
    // Configure successful transfer
    mockServices.cardService.transferCard.mockImplementation(() => {
      // Successful transfer - no error thrown
    });

    render(
      <GameContext.Provider value={mockServices}>
        <CardDetailsModal {...mockProps} />
      </GameContext.Provider>
    );

    // Verify the modal is rendered
    expect(screen.getByText('Permit Expeditor')).toBeInTheDocument();

    // Click "Transfer Card" button to show transfer UI
    const transferButton = screen.getByText('🔄 Transfer Card');
    fireEvent.click(transferButton);

    // Verify transfer UI is displayed
    expect(screen.getByText('Select player to transfer card to:')).toBeInTheDocument();

    // Select the first other player
    const targetPlayerRadio = screen.getByDisplayValue('player2');
    fireEvent.click(targetPlayerRadio);

    // Click the final "Transfer Card" confirmation button (it should be enabled after selecting a player)
    const confirmTransferButton = screen.getByRole('button', { name: 'Transfer Card' });
    fireEvent.click(confirmTransferButton);

    // Assert that cardService.transferCard was called with correct arguments
    expect(mockServices.cardService.transferCard).toHaveBeenCalledWith(
      'player1',      // from player
      'player2',      // to player
      'E001'          // card ID
    );

    // Assert that notificationService.notify was called with success notification
    expect(mockServices.notificationService.notify).toHaveBeenCalledTimes(1);
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: '✓',
        medium: '✅ Card Transferred complete',
        detailed: 'Current Player successfully completed Card Transferred: Permit Expeditor transferred to Other Player 1'
      },
      {
        playerId: 'player1',
        playerName: 'Current Player',
        actionType: 'transfer_E001'
      }
    );

    // Verify modal was closed
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('should call notificationService.notify on failed card transfer', () => {
    // Configure transfer to throw an error
    const transferError = new Error('Transfer failed: Player not found');
    mockServices.cardService.transferCard.mockImplementation(() => {
      throw transferError;
    });

    render(
      <GameContext.Provider value={mockServices}>
        <CardDetailsModal {...mockProps} />
      </GameContext.Provider>
    );

    // Click "Transfer Card" button to show transfer UI
    const transferButton = screen.getByText('🔄 Transfer Card');
    fireEvent.click(transferButton);

    // Select a target player
    const targetPlayerRadio = screen.getByDisplayValue('player3');
    fireEvent.click(targetPlayerRadio);

    // Click the final "Transfer Card" confirmation button
    const confirmTransferButton = screen.getByRole('button', { name: 'Transfer Card' });
    fireEvent.click(confirmTransferButton);

    // Assert that cardService.transferCard was called
    expect(mockServices.cardService.transferCard).toHaveBeenCalledWith(
      'player1',
      'player3',
      'E001'
    );

    // Assert that notificationService.notify was called with error notification
    expect(mockServices.notificationService.notify).toHaveBeenCalledTimes(1);
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: 'Error',
        medium: '❌ Card Transfer failed',
        detailed: 'Current Player encountered error during Card Transfer: Transfer failed: Player not found'
      },
      {
        playerId: 'player1',
        playerName: 'Current Player',
        actionType: 'transfer_E001_error'
      }
    );

    // Verify modal was NOT closed on error
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('should display transfer UI for transferable card types', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <CardDetailsModal {...mockProps} />
      </GameContext.Provider>
    );

    // Verify "Transfer Card" button is available for E-type card
    expect(screen.getByText('🔄 Transfer Card')).toBeInTheDocument();
  });

  it('should not display transfer UI for non-transferable card types', () => {
    const nonTransferableCard = {
      ...mockTransferableCard,
      card_type: 'W' as const, // Work cards are not transferable
      card_name: 'Work Card',
      is_transferable: false // W cards are not transferable
    };

    const propsWithWorkCard = {
      ...mockProps,
      card: nonTransferableCard
    };

    // Configure mock to return 'W' for getCardType
    mockServices.cardService.getCardType.mockReturnValue('W');

    render(
      <GameContext.Provider value={mockServices}>
        <CardDetailsModal {...propsWithWorkCard} />
      </GameContext.Provider>
    );

    // Verify "Transfer Card" button is NOT available for W-type card
    expect(screen.queryByText('🔄 Transfer Card')).not.toBeInTheDocument();
  });

  it('should not show transfer UI when modal is closed', () => {
    const propsWithClosedModal = {
      ...mockProps,
      isOpen: false
    };

    render(
      <GameContext.Provider value={mockServices}>
        <CardDetailsModal {...propsWithClosedModal} />
      </GameContext.Provider>
    );

    // Verify modal content is not rendered when closed
    expect(screen.queryByText('Permit Expeditor')).not.toBeInTheDocument();
  });

  it('should handle multiple card transfer attempts', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <CardDetailsModal {...mockProps} />
      </GameContext.Provider>
    );

    // Click "Transfer Card" to show transfer UI
    const transferButton = screen.getByText('🔄 Transfer Card');
    fireEvent.click(transferButton);

    // Verify transfer UI is shown
    expect(screen.getByText('Select player to transfer card to:')).toBeInTheDocument();

    // Select a player and attempt transfer
    const targetPlayerRadio = screen.getByDisplayValue('player2');
    fireEvent.click(targetPlayerRadio);

    // Verify that the transfer card button is now enabled and available
    const confirmButton = screen.getByRole('button', { name: 'Transfer Card' });
    expect(confirmButton).toBeInTheDocument();
    expect(confirmButton).not.toBeDisabled();
  });
});