/**
 * TurnControlsWithActions.test.tsx
 *
 * Test suite for TurnControlsWithActions component to verify NotificationService integration
 * for movement choice actions and other notification-related functionality.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurnControlsWithActions } from '../../src/components/game/TurnControlsWithActions';
import { GameContext } from '../../src/context/GameContext';
import { GamePhase, Player } from '../../src/types/StateTypes';
import { Choice } from '../../src/types/CommonTypes';
import { createAllMockServices } from '../mocks/mockServices';

describe('TurnControlsWithActions', () => {
  let mockServices: any;
  let mockCurrentPlayer: Player;
  let mockGameState: any;

  beforeEach(() => {
    cleanup(); // Clean up any previous renders
    mockServices = createAllMockServices();

    mockCurrentPlayer = {
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

    // Mock game state with a MOVEMENT choice active
    mockGameState = {
      players: [mockCurrentPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as GamePhase,
      turn: 1,
      activeModal: null,
      awaitingChoice: {
        id: 'movement-choice-123',
        type: 'MOVEMENT',
        playerId: 'player1',
        prompt: 'Choose your destination',
        options: [
          { id: 'MARKET-RESEARCH', label: 'Market Research' },
          { id: 'CUSTOMER-DISCOVERY', label: 'Customer Discovery' }
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

    // Configure mock dataService to return empty arrays for space effects
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getSpaceContent.mockReturnValue({
      name: 'Test Space',
      can_negotiate: false
    });
    mockServices.dataService.getDiceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceOutcome.mockReturnValue({});
  });

  it('should call notificationService.notify when movement choice button is clicked', async () => {
    const mockProps = {
      currentPlayer: mockCurrentPlayer,
      gamePhase: 'PLAY' as GamePhase,
      isProcessingTurn: false,
      isProcessingArrival: false,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: true,
      hasCompletedManualActions: false,
      awaitingChoice: true,
      actionCounts: { required: 1, completed: 1 },
      completedActions: { diceRoll: '🎲 Rolled 3', manualActions: {} },
      feedbackMessage: '',
      buttonFeedback: {},
      onRollDice: vi.fn(),
      onEndTurn: vi.fn().mockResolvedValue(undefined),
      onManualEffect: vi.fn(),
      onNegotiate: vi.fn(),
      onOpenNegotiationModal: vi.fn(),
      playerId: 'player1',
      playerName: 'Test Player'
    };

    render(
      <GameContext.Provider value={mockServices}>
        <TurnControlsWithActions {...mockProps} />
      </GameContext.Provider>
    );

    // Find the movement choice button by its text (including emoji)
    const movementButton = screen.getByText((content, node) => {
      return node?.textContent === '🎯 Market Research';
    });
    expect(movementButton).toBeInTheDocument();

    // Click the movement choice button to select it
    fireEvent.click(movementButton);

    // Movement is not confirmed until End Turn is clicked
    // Find and click the End Turn button (use getAllByText and filter for button element)
    const endTurnElements = screen.getAllByText((content, node) => {
      return node?.textContent?.includes('End Turn');
    });
    const endTurnButton = endTurnElements.find(el => el.tagName === 'BUTTON');
    if (!endTurnButton) throw new Error('End Turn button not found');
    fireEvent.click(endTurnButton);

    // Wait for notification to be called
    await waitFor(() => {
      expect(mockServices.notificationService.notify).toHaveBeenCalledTimes(1);
    });

    // Assert that it was called with the correct arguments
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: '→ Market Research',
        medium: '🚶 Moving to Market Research',
        detailed: 'Test Player chose to move to Market Research'
      },
      {
        playerId: 'player1',
        playerName: 'Test Player',
        actionType: 'move_MARKET-RESEARCH'
      }
    );

    // Verify choiceService.resolveChoice was also called
    expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
      'movement-choice-123',
      'MARKET-RESEARCH'
    );
  });

  it('should show movement choice buttons when MOVEMENT choice is active', () => {
    const mockProps = {
      currentPlayer: mockCurrentPlayer,
      gamePhase: 'PLAY' as GamePhase,
      isProcessingTurn: false,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: true,
      hasCompletedManualActions: false,
      awaitingChoice: true,
      actionCounts: { required: 1, completed: 0 },
      completedActions: { diceRoll: '🎲 Rolled 3', manualActions: {} },
      feedbackMessage: '',
      buttonFeedback: {},
      onRollDice: vi.fn(),
      onEndTurn: vi.fn(),
      onManualEffect: vi.fn(),
      onNegotiate: vi.fn(),
      onOpenNegotiationModal: vi.fn(),
      playerId: 'player1',
      playerName: 'Test Player'
    };

    render(
      <GameContext.Provider value={mockServices}>
        <TurnControlsWithActions {...mockProps} />
      </GameContext.Provider>
    );

    // Verify movement choice section is displayed
    expect(screen.getAllByText('🚶 Choose Your Destination')[0]).toBeInTheDocument();

    // Verify both movement option buttons are displayed
    expect(screen.getByText((content, node) => {
      return node?.textContent === '🎯 Market Research';
    })).toBeInTheDocument();
    expect(screen.getByText((content, node) => {
      return node?.textContent === '🎯 Customer Discovery';
    })).toBeInTheDocument();
  });

  it('should show feedback message instead of button when buttonFeedback is present', () => {
    const mockProps = {
      currentPlayer: mockCurrentPlayer,
      gamePhase: 'PLAY' as GamePhase,
      isProcessingTurn: false,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: true,
      hasCompletedManualActions: false,
      awaitingChoice: true,
      actionCounts: { required: 1, completed: 0 },
      completedActions: { diceRoll: '🎲 Rolled 3', manualActions: {} },
      feedbackMessage: '',
      buttonFeedback: {
        'move_MARKET-RESEARCH': '→ Market Research'
      },
      onRollDice: vi.fn(),
      onEndTurn: vi.fn(),
      onManualEffect: vi.fn(),
      onNegotiate: vi.fn(),
      onOpenNegotiationModal: vi.fn(),
      playerId: 'player1',
      playerName: 'Test Player'
    };

    render(
      <GameContext.Provider value={mockServices}>
        <TurnControlsWithActions {...mockProps} />
      </GameContext.Provider>
    );

    // Verify feedback message is shown instead of the button
    expect(screen.getByText('✅ → Market Research')).toBeInTheDocument();

    // Verify the original button text is NOT shown as a clickable button
    const buttons = screen.queryAllByRole('button');
    const marketResearchButton = buttons.find(button =>
      button.textContent === 'Market Research'
    );
    expect(marketResearchButton).toBeUndefined();
  });
});