import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextStepButton } from '../../../src/components/player/NextStepButton';
import { IServiceContainer, IStateService, ITurnService, IMovementService } from '../../../../src/types/ServiceContracts';
import { createMockStateService, createMockTurnService, createMockMovementService } from '../../mocks/mockServices'; // Assuming mock services exist

describe('NextStepButton', () => {
  let mockStateService: IStateService;
  let mockTurnService: ITurnService;
  let mockMovementService: IMovementService;
  let mockGameServices: IServiceContainer;

  const PLAYER_ID = 'player1';
  const OTHER_PLAYER_ID = 'player2';

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateService = createMockStateService();
    mockTurnService = createMockTurnService();
    mockMovementService = createMockMovementService();

    mockGameServices = {
      stateService: mockStateService,
      turnService: mockTurnService,
      movementService: mockMovementService,
      // Add other services as needed by getNextStepState or handleNextStep
      cardService: {} as any, // Placeholder
      choiceService: {} as any, // Placeholder
      dataService: {} as any, // Placeholder
      effectEngineService: {} as any, // Placeholder
      gameRulesService: {} as any, // Placeholder
      loggingService: {} as any, // Placeholder
      negotiationService: {} as any, // Placeholder
      notificationService: {} as any, // Placeholder
      playerActionService: {} as any, // Placeholder
      resourceService: {} as any,
      targetingService: {} as any,
    };

    // Default mocks for common scenarios
    mockStateService.getGameState.mockReturnValue({
      players: [{ id: PLAYER_ID, name: 'Player 1' }, { id: OTHER_PLAYER_ID, name: 'Player 2' }],
      currentPlayerId: PLAYER_ID,
      awaitingChoice: null,
    } as any);
    mockStateService.getPlayer.mockImplementation((id) => {
      if (id === PLAYER_ID) return { id: PLAYER_ID, name: 'Player 1' } as any;
      if (id === OTHER_PLAYER_ID) return { id: OTHER_PLAYER_ID, name: 'Player 2' } as any;
      return undefined;
    });
    mockStateService.subscribe.mockReturnValue(vi.fn()); // Mock subscription

    mockTurnService.isCurrentPlayer.mockReturnValue(true);
    mockTurnService.getAvailableActions.mockReturnValue([]);
    mockTurnService.canEndTurn.mockReturnValue(true);
    mockTurnService.endTurn.mockResolvedValue(undefined); // Mock successful endTurn

    mockMovementService.rollAndMove.mockResolvedValue(undefined); // Mock successful rollAndMove
  });

  test('is hidden on other players turn', () => {
    mockTurnService.isCurrentPlayer.mockReturnValue(false);
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('shows "Roll to Move" when movement needed', () => {
    mockTurnService.getAvailableActions.mockReturnValue(['ROLL_TO_MOVE']);
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    expect(screen.getByText('Roll to Move')).toBeInTheDocument();
  });

  test('calls movementService.rollAndMove when "Roll to Move" is clicked', async () => {
    mockTurnService.getAvailableActions.mockReturnValue(['ROLL_TO_MOVE']);
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);

    fireEvent.click(screen.getByText('Roll to Move'));

    await waitFor(() => {
      expect(mockMovementService.rollAndMove).toHaveBeenCalledWith(PLAYER_ID);
    });
  });

  test('shows "End Turn" when actions complete', () => {
    mockTurnService.getAvailableActions.mockReturnValue([]); // No movement needed
    mockTurnService.canEndTurn.mockReturnValue(true);
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    expect(screen.getByText('End Turn')).toBeInTheDocument();
  });

  test('calls turnService.endTurn when "End Turn" is clicked', async () => {
    mockTurnService.getAvailableActions.mockReturnValue([]); // No movement needed
    mockTurnService.canEndTurn.mockReturnValue(true);
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);

    fireEvent.click(screen.getByText('End Turn'));

    await waitFor(() => {
      expect(mockTurnService.endTurn).toHaveBeenCalledWith(PLAYER_ID);
    });
  });

  test('is disabled when choice pending', () => {
    mockStateService.getGameState.mockReturnValue({
      players: [{ id: PLAYER_ID, name: 'Player 1' }],
      currentPlayerId: PLAYER_ID,
      awaitingChoice: { id: 'choice1', type: 'MOVEMENT', prompt: 'Choose' }
    } as any);
    mockTurnService.getAvailableActions.mockReturnValue(['ROLL_TO_MOVE']); // Even if movement available, choice takes precedence

    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('End Turn'); // Default label when disabled due to choice
    expect(button).toHaveAttribute('title', 'Complete current action first');
  });

  test('shows "Processing..." when an action is loading', async () => {
    mockTurnService.getAvailableActions.mockReturnValue(['ROLL_TO_MOVE']);
    mockMovementService.rollAndMove.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))); // Simulate loading

    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    const button = screen.getByText('Roll to Move');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('Processing...');
    });

    // After loading, it should revert to original label
    await waitFor(() => {
      expect(button).toHaveTextContent('Roll to Move');
    });
  });

  test('handles errors during action execution gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error

    mockTurnService.getAvailableActions.mockReturnValue(['ROLL_TO_MOVE']);
    mockMovementService.rollAndMove.mockRejectedValue(new Error('Movement failed'));

    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    const button = screen.getByText('Roll to Move');
    fireEvent.click(button);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Next step error:', expect.any(Error));
      expect(button).not.toBeDisabled(); // Button should be re-enabled
      expect(button).toHaveTextContent('Roll to Move'); // Label should revert
    });

    consoleErrorSpy.mockRestore();
  });

  // New test case for "Ensure End Turn never hidden"
  test('shows "End Turn" button when canEndTurn is true and no other actions', () => {
    mockTurnService.getAvailableActions.mockReturnValue([]); // No other actions
    mockTurnService.canEndTurn.mockReturnValue(true); // Can end turn
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    const endTurnButton = screen.getByText('End Turn');
    expect(endTurnButton).toBeInTheDocument();
    expect(endTurnButton).not.toBeDisabled();
  });

  test('hides button when canEndTurn is false and no other actions', () => {
    mockTurnService.getAvailableActions.mockReturnValue([]); // No other actions
    mockTurnService.canEndTurn.mockReturnValue(false); // Cannot end turn
    render(<NextStepButton gameServices={mockGameServices} playerId={PLAYER_ID} />);
    expect(screen.queryByText('End Turn')).not.toBeInTheDocument();
    expect(screen.queryByText('Roll to Move')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});