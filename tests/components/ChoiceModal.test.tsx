/**
 * ChoiceModal.test.tsx
 *
 * Test suite for ChoiceModal component to verify NotificationService integration
 * for generic choice actions and notification behavior.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChoiceModal } from '../../src/components/modals/ChoiceModal';
import { GameContext } from '../../src/context/GameContext';
import { GamePhase, Player } from '../../src/types/StateTypes';
import { Choice } from '../../src/types/CommonTypes';
import { createAllMockServices } from '../mocks/mockServices';

describe('ChoiceModal', () => {
  let mockServices: any;
  let mockPlayer: Player;
  let mockGameState: any;

  beforeEach(() => {
    mockServices = createAllMockServices();

    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
      projectScope: 0,
      score: 0,
      color: '#007bff',
      avatar: '👤',
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    // Mock game state with a non-movement choice active
    mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as GamePhase,
      turn: 1,
      activeModal: null,
      awaitingChoice: {
        id: 'card-choice-456',
        type: 'CARD_EFFECT',
        playerId: 'player1',
        prompt: 'Choose your card effect',
        options: [
          { id: 'option1', label: 'Draw 2 Work Cards' },
          { id: 'option2', label: 'Gain $1000' },
          { id: 'option3', label: 'Skip Time Penalty' }
        ]
      } as Choice,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: true,
      hasCompletedManualActions: false,
      requiredActions: 1,
      completedActions: 0
    };

    // Configure mock stateService to return our game state
    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(mockGameState);
      return vi.fn(); // Return unsubscribe function
    });
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
  });

  it('should call notificationService.notify when choice button is clicked', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal is displayed with the correct content
    expect(screen.getByText('🎯 Make Your Choice')).toBeInTheDocument();
    expect(screen.getByText('Test Player: Choose your card effect')).toBeInTheDocument();

    // Find and verify choice buttons are displayed
    const drawCardsButton = screen.getByText('Draw 2 Work Cards');
    const gainMoneyButton = screen.getByText('Gain $1000');
    const skipPenaltyButton = screen.getByText('Skip Time Penalty');

    expect(drawCardsButton).toBeInTheDocument();
    expect(gainMoneyButton).toBeInTheDocument();
    expect(skipPenaltyButton).toBeInTheDocument();

    // Click the first choice button
    fireEvent.click(drawCardsButton);

    // Assert that notificationService.notify was called
    expect(mockServices.notificationService.notify).toHaveBeenCalledTimes(1);

    // Assert that it was called with the correct arguments
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: '✓',
        medium: '✅ Choice Made complete',
        detailed: 'Test Player successfully completed Choice Made: Selected: Draw 2 Work Cards'
      },
      {
        playerId: 'player1',
        playerName: 'Test Player',
        actionType: 'choice_card-choice-456'
      }
    );

    // Verify choiceService.resolveChoice was also called
    expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
      'card-choice-456',
      'option1'
    );
  });

  it('should not render modal when no choice is awaiting', () => {
    // Update mock state to have no awaiting choice
    const stateWithoutChoice = {
      ...mockGameState,
      awaitingChoice: null
    };

    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(stateWithoutChoice);
      return vi.fn();
    });
    mockServices.stateService.getGameState.mockReturnValue(stateWithoutChoice);

    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal is not rendered
    expect(screen.queryByText('🎯 Make Your Choice')).not.toBeInTheDocument();
  });

  it('should not render modal for MOVEMENT type choices', () => {
    // Update mock state to have a MOVEMENT choice (should be handled by TurnControls)
    const stateWithMovementChoice = {
      ...mockGameState,
      awaitingChoice: {
        id: 'movement-choice-789',
        type: 'MOVEMENT',
        playerId: 'player1',
        prompt: 'Choose your destination',
        options: [
          { id: 'MARKET-RESEARCH', label: 'Market Research' },
          { id: 'CUSTOMER-DISCOVERY', label: 'Customer Discovery' }
        ]
      } as Choice
    };

    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(stateWithMovementChoice);
      return vi.fn();
    });
    mockServices.stateService.getGameState.mockReturnValue(stateWithMovementChoice);

    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal is not rendered for movement choices
    expect(screen.queryByText('🎯 Make Your Choice')).not.toBeInTheDocument();
  });

  it('should display correct player name and prompt in modal header', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal header displays the correct player name and prompt
    expect(screen.getByText('Test Player: Choose your card effect')).toBeInTheDocument();
  });

  it('should call notification for different choice options with correct labels', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Click the second choice button (Gain $1000)
    const gainMoneyButton = screen.getByText('Gain $1000');
    fireEvent.click(gainMoneyButton);

    // Assert that notificationService.notify was called with the correct label
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: '✓',
        medium: '✅ Choice Made complete',
        detailed: 'Test Player successfully completed Choice Made: Selected: Gain $1000'
      },
      {
        playerId: 'player1',
        playerName: 'Test Player',
        actionType: 'choice_card-choice-456'
      }
    );

    // Verify choiceService.resolveChoice was called with the correct option ID
    expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
      'card-choice-456',
      'option2'
    );
  });
});