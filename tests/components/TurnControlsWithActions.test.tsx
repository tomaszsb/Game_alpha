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
    expect(screen.getByText('📍 Select ONE Destination to Continue')).toBeInTheDocument();

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

  describe('Dice Movement Spaces', () => {
    it('should show dice roll button on dice-movement spaces like CHEAT-BYPASS', () => {
      // Set up player on a dice-movement space
      const diceMovementPlayer = {
        ...mockCurrentPlayer,
        currentSpace: 'CHEAT-BYPASS',
        visitType: 'First' as const
      };

      // Override mock game state for this test - NO awaiting choice
      const diceSpaceGameState = {
        ...mockGameState,
        awaitingChoice: null,  // No choice pending for dice roll
        hasPlayerMovedThisTurn: false,
        hasPlayerRolledDice: false
      };
      mockServices.stateService.subscribe.mockImplementation((callback: any) => {
        callback(diceSpaceGameState);
        return vi.fn();
      });
      mockServices.stateService.getGameState.mockReturnValue(diceSpaceGameState);

      // Mock the data service to return dice-movement configuration
      mockServices.dataService.getSpaceByName.mockReturnValue({
        name: 'CHEAT-BYPASS',
        config: {
          space_name: 'CHEAT-BYPASS',
          phase: 'OWNER',
          path_type: 'side quest cheat',
          is_starting_space: false,
          is_ending_space: false,
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true  // Key config for dice button
        },
        movement: {
          space_name: 'CHEAT-BYPASS',
          visit_type: 'First',
          movement_type: 'dice',  // Dice-based movement
          destinations: []  // Determined by dice roll
        }
      });

      // Mock movement data
      mockServices.dataService.getMovement.mockReturnValue({
        space_name: 'CHEAT-BYPASS',
        visit_type: 'First',
        movement_type: 'dice',
        destinations: []
      });

      const mockProps = {
        currentPlayer: diceMovementPlayer,
        gamePhase: 'PLAY' as GamePhase,
        isProcessingTurn: false,
        isProcessingArrival: false,
        hasPlayerMovedThisTurn: false,  // Start of turn, hasn't moved yet
        hasPlayerRolledDice: false,      // Hasn't rolled dice yet
        hasCompletedManualActions: false,
        awaitingChoice: false,           // No choice pending
        actionCounts: { required: 1, completed: 0 },
        completedActions: { diceRoll: undefined, manualActions: {} },
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

      // Verify dice roll button is displayed - look for the button with "Roll Dice" text
      const buttons = screen.getAllByRole('button');
      const diceRollButton = buttons.find(button =>
        button.textContent?.includes('🎲') && button.textContent?.includes('Roll Dice')
      );
      expect(diceRollButton).toBeDefined();
      expect(diceRollButton).not.toBeDisabled();
    });

    it('should NOT show dice button after dice has been rolled', () => {
      const diceMovementPlayer = {
        ...mockCurrentPlayer,
        currentSpace: 'CHEAT-BYPASS',
        visitType: 'First' as const
      };

      // Override mock game state - dice has been rolled
      const rolledDiceGameState = {
        ...mockGameState,
        awaitingChoice: null,
        hasPlayerMovedThisTurn: false,
        hasPlayerRolledDice: true
      };
      mockServices.stateService.subscribe.mockImplementation((callback: any) => {
        callback(rolledDiceGameState);
        return vi.fn();
      });
      mockServices.stateService.getGameState.mockReturnValue(rolledDiceGameState);

      mockServices.dataService.getSpaceByName.mockReturnValue({
        name: 'CHEAT-BYPASS',
        config: { requires_dice_roll: true }
      });

      const mockProps = {
        currentPlayer: diceMovementPlayer,
        gamePhase: 'PLAY' as GamePhase,
        isProcessingTurn: false,
        isProcessingArrival: false,
        hasPlayerMovedThisTurn: false,
        hasPlayerRolledDice: true,        // Already rolled
        hasCompletedManualActions: false,
        awaitingChoice: false,
        actionCounts: { required: 1, completed: 1 },
        completedActions: { diceRoll: '🎲 Rolled 4', manualActions: {} },
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

      // Verify dice completion message is shown instead of button
      expect(screen.getByText('✅ 🎲 Rolled 4')).toBeInTheDocument();

      // Verify no clickable dice button exists
      const buttons = screen.queryAllByRole('button');
      const diceRollButton = buttons.find(button =>
        button.textContent?.includes('Roll') && button.textContent?.includes('🎲')
      );
      expect(diceRollButton).toBeUndefined();
    });
  });
});