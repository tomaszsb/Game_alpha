import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { NextStepButton, getNextStepState } from '../../../src/components/player/NextStepButton';
import { createAllMockServices } from '../../mocks/mockServices';
import { GameState, Player } from '../../../src/types/StateTypes';

describe('NextStepButton', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockServices = createAllMockServices();
  const playerId = 'player-1';

  const createMockPlayer = (overrides?: Partial<Player>): Player => ({
    id: playerId,
    name: 'Test Player',
    color: '#ff0000',
    avatar: '👤',
    currentSpace: 'START',
    money: 1000,
    timeSpent: 12,
    projectScope: 0,
    hand: [],
    visitType: 'First',
    visitedSpaces: [],
    activeCards: [],
    activeEffects: [],
    loans: [],
    score: 0,
    ...overrides
  });

  const createMockGameState = (overrides?: Partial<GameState>): GameState => ({
    players: [createMockPlayer()],
    currentPlayerId: playerId,
    gamePhase: 'PLAY',
    turn: 1,
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnCount: 1,
    playerTurnCounts: { [playerId]: 1 },
    activeModal: null,
    awaitingChoice: null,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    isGameOver: false,
    isMoving: false,
    isProcessingArrival: false,
    isInitialized: true,
    currentExplorationSessionId: null,
    requiredActions: 0,
    completedActionCount: 0,
    availableActionTypes: [],
    completedActions: {
      diceRoll: undefined,
      manualActions: {}
    },
    activeNegotiation: null,
    selectedDestination: null,
    globalActionLog: [],
    playerSnapshots: {},
    decks: { W: [], B: [], E: [], L: [], I: [] },
    discardPiles: { W: [], B: [], E: [], L: [], I: [] },
    ...overrides
  });

  describe('Button Visibility', () => {
    it('should be hidden when not current player', () => {
      const gameState = createMockGameState({ currentPlayerId: 'other-player' });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      expect(screen.queryByRole('button')).toBeNull();
    });

    it('should be visible when current player (always visible on turn)', () => {
      const gameState = createMockGameState();
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('End Turn')).toBeInTheDocument();
    });

    it('should be visible when player can end turn', () => {
      const gameState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 2,
        completedActionCount: 2
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('End Turn')).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should show enabled End Turn button when turn is complete', () => {
      const gameState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 1,
        completedActionCount: 1,
        availableActionTypes: []
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('End Turn');
      expect(button).not.toBeDisabled();
    });

    it('should show disabled End Turn button when player has pending choice', () => {
      const gameState = createMockGameState({
        awaitingChoice: {
          id: 'choice-1',
          playerId: playerId,
          type: 'CHOICE',
          prompt: 'Choose an option',
          options: [
            { id: 'opt1', label: 'Option 1' },
            { id: 'opt2', label: 'Option 2' }
          ]
        }
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('End Turn');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Complete current action first');
    });

    it('should show disabled End Turn with action count when actions are incomplete', () => {
      const gameState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 3,
        completedActionCount: 1,
        availableActionTypes: []
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('End Turn (2 actions remaining)');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Complete 2 more actions before ending turn');
    });

    it('should show singular "action" when one action remaining', () => {
      const gameState = createMockGameState({
        requiredActions: 2,
        completedActionCount: 1
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('End Turn (1 action remaining)');
      expect(button).toHaveAttribute('title', 'Complete 1 more action before ending turn');
    });
  });

  describe('Button Actions', () => {
    it('should call endTurn when End Turn is clicked', async () => {
      const gameState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 1,
        completedActionCount: 1
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);
      mockServices.turnService.endTurnWithMovement.mockResolvedValue(undefined);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(mockServices.turnService.endTurnWithMovement).toHaveBeenCalled();
    });

    it('should not call actions when button is disabled', async () => {
      const gameState = createMockGameState({
        awaitingChoice: {
          id: 'choice-1',
          playerId: playerId,
          type: 'CHOICE',
          prompt: 'Choose',
          options: [{ id: 'opt1', label: 'Option 1' }]
        }
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(mockServices.turnService.endTurnWithMovement).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading text while processing End Turn', async () => {
      const gameState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 1,
        completedActionCount: 1
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      let resolveEndTurn: () => void;
      const endTurnPromise = new Promise<void>((resolve) => {
        resolveEndTurn = resolve;
      });
      mockServices.turnService.endTurnWithMovement.mockReturnValue(endTurnPromise);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Should show loading text
      await waitFor(() => {
        expect(button).toHaveTextContent('Processing...');
        expect(button).toBeDisabled();
      });

      // Resolve and check it returns to normal
      resolveEndTurn!();
      await waitFor(() => {
        expect(button).toHaveTextContent('End Turn');
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors from endTurn gracefully', async () => {
      const gameState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 1,
        completedActionCount: 1
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);
      mockServices.turnService.endTurnWithMovement.mockRejectedValue(new Error('End turn failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('🔘 NextStepButton: Error in handleNextStep:', expect.any(Error));
        expect(button).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('State Subscription', () => {
    it('should update button state when game state changes', async () => {
      const initialState = createMockGameState({
        requiredActions: 2,
        completedActionCount: 0
      });
      mockServices.stateService.getGameState.mockReturnValue(initialState);

      let stateListener: ((state: GameState) => void) | null = null;
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        stateListener = callback;
        return () => {};
      });

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      expect(screen.getByText('End Turn (2 actions remaining)')).toBeInTheDocument();

      // Update state to all actions complete
      const updatedState = createMockGameState({
        hasPlayerRolledDice: true,
        requiredActions: 2,
        completedActionCount: 2,
        availableActionTypes: []
      });
      mockServices.stateService.getGameState.mockReturnValue(updatedState);

      // Trigger state change
      if (stateListener) {
        stateListener(updatedState);
      }

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveTextContent('End Turn');
        expect(button).not.toHaveTextContent('actions remaining');
        expect(button).not.toBeDisabled();
      });
    });

    it('should hide button when player is no longer current', async () => {
      const initialState = createMockGameState();
      mockServices.stateService.getGameState.mockReturnValue(initialState);

      let stateListener: ((state: GameState) => void) | null = null;
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        stateListener = callback;
        return () => {};
      });

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      expect(screen.getByText('End Turn')).toBeInTheDocument();

      // Change current player
      const updatedState = createMockGameState({
        currentPlayerId: 'other-player'
      });
      mockServices.stateService.getGameState.mockReturnValue(updatedState);

      // Trigger state change
      if (stateListener) {
        stateListener(updatedState);
      }

      await waitFor(() => {
        expect(screen.queryByRole('button')).toBeNull();
      });
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribe = vi.fn();
      mockServices.stateService.subscribe.mockReturnValue(unsubscribe);

      const gameState = createMockGameState();
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      const { unmount } = render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for enabled button', () => {
      const gameState = createMockGameState({
        requiredActions: 1,
        completedActionCount: 1
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'End Turn');
    });

    it('should have proper aria-label when actions remaining', () => {
      const gameState = createMockGameState({
        requiredActions: 2,
        completedActionCount: 0
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'End Turn (2 actions remaining)');
    });

    it('should have tooltip for disabled state', () => {
      const gameState = createMockGameState({
        awaitingChoice: {
          id: 'choice-1',
          playerId: playerId,
          type: 'CHOICE',
          prompt: 'Choose',
          options: [{ id: 'opt1', label: 'Option 1' }]
        }
      });
      mockServices.stateService.getGameState.mockReturnValue(gameState);

      render(
        <NextStepButton gameServices={mockServices} playerId={playerId} />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Complete current action first');
    });
  });
});

describe('getNextStepState helper', () => {
  const mockServices = createAllMockServices();
  const playerId = 'player-1';

  const createMockGameState = (overrides?: Partial<GameState>): GameState => ({
    players: [],
    currentPlayerId: playerId,
    gamePhase: 'PLAY',
    turn: 1,
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnCount: 1,
    playerTurnCounts: { [playerId]: 1 },
    activeModal: null,
    awaitingChoice: null,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    isGameOver: false,
    isMoving: false,
    isProcessingArrival: false,
    isInitialized: true,
    currentExplorationSessionId: null,
    requiredActions: 0,
    completedActionCount: 0,
    availableActionTypes: [],
    completedActions: {
      diceRoll: undefined,
      manualActions: {}
    },
    activeNegotiation: null,
    selectedDestination: null,
    globalActionLog: [],
    playerSnapshots: {},
    decks: { W: [], B: [], E: [], L: [], I: [] },
    discardPiles: { W: [], B: [], E: [], L: [], I: [] },
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hidden state when not current player', () => {
    const gameState = createMockGameState({ currentPlayerId: 'other-player' });
    mockServices.stateService.getGameState.mockReturnValue(gameState);

    const state = getNextStepState(mockServices, playerId);

    expect(state.visible).toBe(false);
  });

  it('should return disabled End Turn state when awaiting choice', () => {
    const gameState = createMockGameState({
      awaitingChoice: {
        id: 'choice-1',
        playerId: playerId,
        type: 'CHOICE',
        prompt: 'Choose',
        options: [{ id: 'opt1', label: 'Option 1' }]
      }
    });
    mockServices.stateService.getGameState.mockReturnValue(gameState);

    const state = getNextStepState(mockServices, playerId);

    expect(state.visible).toBe(true);
    expect(state.label).toBe('End Turn');
    expect(state.disabled).toBe(true);
    expect(state.tooltip).toBe('Complete current action first');
  });

  it('should return disabled End Turn with action count when actions incomplete', () => {
    const gameState = createMockGameState({
      requiredActions: 3,
      completedActionCount: 1
    });
    mockServices.stateService.getGameState.mockReturnValue(gameState);

    const state = getNextStepState(mockServices, playerId);

    expect(state.visible).toBe(true);
    expect(state.label).toBe('End Turn (2 actions remaining)');
    expect(state.disabled).toBe(true);
    expect(state.tooltip).toBe('Complete 2 more actions before ending turn');
  });

  it('should return End Turn state when all actions complete', () => {
    const gameState = createMockGameState({
      hasPlayerRolledDice: true,
      requiredActions: 2,
      completedActionCount: 2
    });
    mockServices.stateService.getGameState.mockReturnValue(gameState);

    const state = getNextStepState(mockServices, playerId);

    expect(state.visible).toBe(true);
    expect(state.label).toBe('End Turn');
    expect(state.disabled).toBe(false);
    expect(state.action).toBe('end-turn');
  });

  it('should return enabled End Turn state when no actions required', () => {
    const gameState = createMockGameState({
      requiredActions: 0,
      completedActionCount: 0
    });
    mockServices.stateService.getGameState.mockReturnValue(gameState);

    const state = getNextStepState(mockServices, playerId);

    expect(state.visible).toBe(true);
    expect(state.label).toBe('End Turn');
    expect(state.disabled).toBe(false);
    expect(state.action).toBe('end-turn');
  });
});
