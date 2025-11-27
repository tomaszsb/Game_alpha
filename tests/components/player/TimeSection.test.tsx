/**
 * TimeSection.test.tsx
 * 
 * Test suite for TimeSection component
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeSection } from '../../../src/components/player/sections/TimeSection';
import { createAllMockServices } from '../../mocks/mockServices';
import { Player, GameState } from '../../../types/StateTypes';

describe('TimeSection', () => {
  const mockServices = createAllMockServices();
  
  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    money: 500,
    timeSpent: 10,
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

  const mockGameState: GameState = {
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 1,
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnCount: 1,
    playerTurnCounts: { 'player1': 1 },
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
    discardPiles: { W: [], B: [], E: [], L: [], I: [] }
  };

  const defaultProps = {
    gameServices: mockServices,
    playerId: 'player1',
    isExpanded: true,
    onToggle: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    // Setup default mock returns
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]); // Fix: Return empty array by default
  });

  describe('Basic Rendering', () => {
    it('should render the component without crashing', () => {
      render(<TimeSection {...defaultProps} />);
      expect(screen.getByText('TIME')).toBeInTheDocument();
    });

    it('should display elapsed time', () => {
      render(<TimeSection {...defaultProps} />);
      expect(screen.getByText('Elapsed: 10d')).toBeInTheDocument();
    });

    it('should return null if player not found', () => {
      mockServices.stateService.getPlayer.mockReturnValue(undefined);
      const { container } = render(<TimeSection {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Action Detection', () => {
    it('should show action indicator when time manual effect available', () => {
      const timeEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'time',
        value: 5,
        description: 'Roll for Time'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([timeEffect]);

      render(<TimeSection {...defaultProps} />);
      const indicator = screen.getByRole('status', { name: /action available/i });
      expect(indicator).toBeInTheDocument();
    });

    it('should show Roll for Time button when action available', () => {
      const timeEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'time',
        value: 5,
        description: 'Roll for Time'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([timeEffect]);

      render(<TimeSection {...defaultProps} />);
      expect(screen.getByText('Roll for Time')).toBeInTheDocument();
    });
  });

  describe('Roll for Time Action', () => {
    it('should call triggerManualEffectWithFeedback when button clicked', async () => {
      const timeEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'time',
        value: 5,
        description: 'Roll for Time'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([timeEffect]);
      mockServices.turnService.triggerManualEffectWithFeedback.mockResolvedValue({});

      render(<TimeSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Time');
      fireEvent.click(rollButton);

      expect(mockServices.turnService.triggerManualEffectWithFeedback).toHaveBeenCalledWith(
        'player1',
        'time'
      );
    });

    it('should handle roll errors', async () => {
      const timeEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'time',
        value: 5,
        description: 'Roll for Time'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([timeEffect]);
      mockServices.turnService.triggerManualEffectWithFeedback.mockRejectedValue(
        new Error('Roll failed')
      );

      render(<TimeSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Time');
      fireEvent.click(rollButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to perform time action. Please try again.')).toBeInTheDocument();
      });
    });
  });
});
