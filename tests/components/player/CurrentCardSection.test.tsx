/**
 * CurrentCardSection.test.tsx
 * 
 * Test suite for CurrentCardSection component
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrentCardSection } from '../../../src/components/player/sections/CurrentCardSection';
import { createAllMockServices } from '../../mocks/mockServices';
import { Player, GameState } from '../../../src/types/StateTypes';
import { Choice } from '../../../src/types/CommonTypes';

describe('CurrentCardSection', () => {
  const mockServices = createAllMockServices();
  
  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    visitedSpaces: ['START'],
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

  const mockSpaceContent = {
    space_name: 'TEST-SPACE',
    visit_type: 'First' as const,
    title: 'Owner-Scope-Initiation',
    story: 'The owner wants to discuss the project scope.',
    action_description: 'Choose how to respond to the owner.',
    outcome_description: 'Your choice will affect project scope and timeline.',
    can_negotiate: true
  };

  const mockChoice: Choice = {
    id: 'choice_123',
    playerId: 'player1',
    type: 'GENERAL',
    prompt: 'How will you respond?',
    options: [
      { id: 'accept', label: 'Accept' },
      { id: 'negotiate', label: 'Negotiate' },
      { id: 'reject', label: 'Reject' }
    ]
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
    mockServices.dataService.getSpaceContent.mockReturnValue(mockSpaceContent);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]); // Fix: Return empty array by default
    mockServices.stateService.subscribe.mockReturnValue(() => {});

    // Mock filterSpaceEffectsByCondition to pass-through effects
    mockServices.turnService.filterSpaceEffectsByCondition.mockImplementation((effects: any[]) => effects);
  });

  describe('Basic Rendering', () => {
    it('should render the component with space content', () => {
      render(<CurrentCardSection {...defaultProps} />);
      expect(screen.getByText('On this space:')).toBeInTheDocument();
    });

    it('should display consolidated text content', () => {
      render(<CurrentCardSection {...defaultProps} />);
      // Content is consolidated into a single paragraph
      const content = screen.getByText(/The owner wants to discuss the project scope/);
      expect(content).toBeInTheDocument();
    });

    it('should display all content sections', () => {
      render(<CurrentCardSection {...defaultProps} />);
      // All sections are combined: story + action + outcome
      expect(screen.getByText(/Choose how to respond to the owner/)).toBeInTheDocument();
      expect(screen.getByText(/Your choice will affect project scope and timeline/)).toBeInTheDocument();
    });

    it('should return null if no space content', () => {
      mockServices.dataService.getSpaceContent.mockReturnValue(null);
      const { container } = render(<CurrentCardSection {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Choice Display', () => {
    it('should show action indicator when choices available', () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);

      render(<CurrentCardSection {...defaultProps} />);
      const indicator = screen.getByRole('status', { name: /action available/i });
      expect(indicator).toBeInTheDocument();
    });

    it('should not show action indicator when no choices', () => {
      render(<CurrentCardSection {...defaultProps} />);
      const indicator = screen.queryByRole('status', { name: /action available/i });
      expect(indicator).not.toBeInTheDocument();
    });

    it('should render all choice buttons', () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);

      // Mock subscribe to immediately trigger with choice
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });

      render(<CurrentCardSection {...defaultProps} />);
      
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Negotiate')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    it('should not render choices for other players', () => {
      const stateWithOtherPlayerChoice = {
        ...mockGameState,
        awaitingChoice: { ...mockChoice, playerId: 'player2' }
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithOtherPlayerChoice);

      render(<CurrentCardSection {...defaultProps} />);

      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
      expect(screen.queryByText('Negotiate')).not.toBeInTheDocument();
      expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    });

    it('should not render MOVEMENT choice buttons (handled by movement component)', () => {
      const movementChoice: Choice = {
        id: 'move_123',
        playerId: 'player1',
        type: 'MOVEMENT',
        prompt: 'Choose where to move',
        options: [
          { id: 'dest1', label: 'Destination 1' },
          { id: 'dest2', label: 'Destination 2' }
        ]
      };

      const stateWithMovementChoice = {
        ...mockGameState,
        awaitingChoice: movementChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithMovementChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithMovementChoice);
        return () => {};
      });

      render(<CurrentCardSection {...defaultProps} />);

      // Should not render movement choice buttons
      expect(screen.queryByText('Destination 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Destination 2')).not.toBeInTheDocument();
    });

    it('should not show action indicator for MOVEMENT choices', () => {
      const movementChoice: Choice = {
        id: 'move_123',
        playerId: 'player1',
        type: 'MOVEMENT',
        prompt: 'Choose where to move',
        options: [
          { id: 'dest1', label: 'Destination 1' },
          { id: 'dest2', label: 'Destination 2' }
        ]
      };

      const stateWithMovementChoice = {
        ...mockGameState,
        awaitingChoice: movementChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithMovementChoice);

      render(<CurrentCardSection {...defaultProps} />);

      const indicator = screen.queryByRole('status', { name: /action available/i });
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('Choice Variant Logic', () => {
    it('should render Accept button with primary variant', () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });

      const { container } = render(<CurrentCardSection {...defaultProps} />);
      const acceptButton = screen.getByText('Accept').closest('button');
      
      expect(acceptButton).toHaveClass('action-button--primary');
    });

    it('should render Reject button with danger variant', () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });

      const { container } = render(<CurrentCardSection {...defaultProps} />);
      const rejectButton = screen.getByText('Reject').closest('button');
      
      expect(rejectButton).toHaveClass('action-button--danger');
    });

    it('should render Negotiate button with secondary variant', () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });

      const { container } = render(<CurrentCardSection {...defaultProps} />);
      const negotiateButton = screen.getByText('Negotiate').closest('button');
      
      expect(negotiateButton).toHaveClass('action-button--secondary');
    });
  });

  describe('Choice Handling', () => {
    it('should call choiceService.resolveChoice when button clicked', async () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });
      mockServices.choiceService.resolveChoice.mockReturnValue(true);

      render(<CurrentCardSection {...defaultProps} />);
      
      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
          'choice_123',
          'accept'
        );
      });
    });

    it('should handle choice resolution errors', async () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });
      mockServices.choiceService.resolveChoice.mockReturnValue(false);

      render(<CurrentCardSection {...defaultProps} />);
      
      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to process choice. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });
      mockServices.choiceService.resolveChoice.mockReturnValue(false);

      render(<CurrentCardSection {...defaultProps} />);
      
      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should clear error when retry clicked', async () => {
      const stateWithChoice = {
        ...mockGameState,
        awaitingChoice: mockChoice
      };
      mockServices.stateService.getGameState.mockReturnValue(stateWithChoice);
      mockServices.stateService.subscribe.mockImplementation((callback) => {
        callback(stateWithChoice);
        return () => {};
      });
      mockServices.choiceService.resolveChoice.mockReturnValue(false);

      render(<CurrentCardSection {...defaultProps} />);
      
      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to process choice. Please try again.')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(screen.queryByText('Failed to process choice. Please try again.')).not.toBeInTheDocument();
    });
  });

  describe('State Updates', () => {
    it('should update when space changes', async () => {
      const { rerender } = render(<CurrentCardSection {...defaultProps} />);

      expect(screen.getByText(/The owner wants to discuss the project scope/)).toBeInTheDocument();

      // Simulate space change
      const newPlayerState = { ...mockPlayer, currentSpace: 'NEW-SPACE' };
      const newSpaceContent = {
        ...mockSpaceContent,
        title: 'New Space Title',
        story: 'New story content about the changed space',
        action_description: '',
        outcome_description: ''
      };

      mockServices.stateService.getPlayer.mockReturnValue(newPlayerState);
      mockServices.dataService.getSpaceContent.mockReturnValue(newSpaceContent);

      // Trigger subscribe callback
      const subscribeCallback = mockServices.stateService.subscribe.mock.calls[0][0];
      act(() => {
        subscribeCallback({ ...mockGameState, players: [newPlayerState] });
      });

      await waitFor(() => {
        expect(screen.getByText(/New story content about the changed space/)).toBeInTheDocument();
      });
    });
  });

  describe('Expansion State', () => {
    it('should be expanded by default on desktop', () => {
      const { container } = render(<CurrentCardSection {...defaultProps} />);
      const section = container.querySelector('.expandable-section');
      expect(section).toHaveAttribute('data-default-expanded', 'true');
    });

    it('should call onToggle when section header clicked', () => {
      const onToggle = vi.fn();
      render(<CurrentCardSection {...defaultProps} onToggle={onToggle} />);

      const header = screen.getByRole('button', { name: /On this space/i });
      fireEvent.click(header);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
