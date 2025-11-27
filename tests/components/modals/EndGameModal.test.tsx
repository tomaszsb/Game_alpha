import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { EndGameModal } from '../../../src/components/modals/EndGameModal';
import { IStateService } from '../../../src/types/ServiceContracts';
import { GameState } from '../../../src/types/StateTypes';
import { Player } from '../../../src/types/DataTypes';
import { createMockStateService } from '../../mocks/mockServices';

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(vi.fn());
});

// Create mock outside of describe block
const mockStateService: any = createMockStateService();

// Mock the useGameContext hook
vi.mock('../../../src/context/GameContext', () => ({
  useGameContext: () => ({
    stateService: mockStateService,
  }),
}));

describe('EndGameModal', () => {
  let mockPlayer: Player;
  let mockGameState: GameState;

  beforeEach(() => {
    cleanup(); // Clean up any previous renders
    vi.clearAllMocks();

    mockPlayer = {
      id: 'player1',
      name: 'Test Winner',
      currentSpace: 'END-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 100,
      projectScope: 0,
      score: 0,
      color: '#007bff',
      avatar: '👤',
      hand: ['W_001', 'W_002', 'B_001', 'L_001'],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    // Default state - game not over
    mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      turn: 5,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      awaitingChoice: null,
      isGameOver: false,
      activeModal: null,
      requiredActions: 1,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      decks: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      },
      discardPiles: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      }
    };

    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.subscribe.mockImplementation((callback) => {
      // Return unsubscribe function
      return vi.fn();
    });
  });

  describe('Modal Visibility', () => {
    it('should not render when game is not over', () => {
      render(<EndGameModal />);
      
      // Modal should not be visible
      expect(screen.queryByText('Game Complete!')).not.toBeInTheDocument();
      expect(screen.queryByText('🏆 Congratulations Test Winner!')).not.toBeInTheDocument();
    });

    it('should render when game is over with a winner', () => {
      // Set up game over state
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: new Date('2024-12-20T10:30:00Z')
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      // Modal should be visible with correct content
      expect(screen.getAllByText('Game Complete!')[0]).toBeInTheDocument();
      expect(screen.getAllByText('🏆 Congratulations Test Winner!')[0]).toBeInTheDocument();
      expect(screen.getByText('You have successfully reached an ending space and won the game!')).toBeInTheDocument();
    });

    it('should display unknown player when winner player is not found', () => {
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'nonexistent-player',
        gamePhase: 'END' as const,
        gameEndTime: new Date('2024-12-20T10:30:00Z')
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      expect(screen.getByText('🏆 Congratulations Unknown Player!')).toBeInTheDocument();
    });
  });

  describe('State Subscription', () => {
    it('should subscribe to state changes on mount', () => {
      render(<EndGameModal />);
      
      expect(mockStateService.subscribe).toHaveBeenCalledTimes(1);
      expect(mockStateService.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should initialize with current game state', () => {
      render(<EndGameModal />);
      
      expect(mockStateService.getGameState).toHaveBeenCalledTimes(1);
    });

    it('should update display when state changes to game over', async () => {
      let stateChangeCallback: (state: GameState) => void = vi.fn();
      
      mockStateService.subscribe.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return vi.fn();
      });

      render(<EndGameModal />);
      
      // Initially not visible
      expect(screen.queryByText('Game Complete!')).not.toBeInTheDocument();

      // Trigger state change to game over
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: new Date('2024-12-20T10:30:00Z')
      };

      stateChangeCallback(gameOverState);

      await waitFor(() => {
        expect(screen.getAllByText('Game Complete!')[0]).toBeInTheDocument();
        expect(screen.getAllByText('🏆 Congratulations Test Winner!')[0]).toBeInTheDocument();
      });
    });

    it('should return unsubscribe function when component unmounts', () => {
      const mockUnsubscribe = vi.fn();
      mockStateService.subscribe.mockReturnValue(mockUnsubscribe);

      const { unmount } = render(<EndGameModal />);
      
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Game Statistics Display', () => {
    it('should display game end time when available', () => {
      const testDate = new Date('2024-12-20T15:45:30Z');
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: testDate
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      expect(screen.getByText('📊 Game Statistics')).toBeInTheDocument();
      expect(screen.getByText(`Game completed at: ${testDate.toLocaleString()}`)).toBeInTheDocument();
    });

    it('should not display game statistics when game end time is not available', () => {
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: undefined
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      expect(screen.queryByText('📊 Game Statistics')).not.toBeInTheDocument();
    });
  });

  describe('Play Again Functionality', () => {
    it('should call stateService.resetGame when Play Again button is clicked', () => {
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: new Date()
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      const playAgainButton = screen.getByRole('button', { name: /play again/i });
      fireEvent.click(playAgainButton);

      expect(mockStateService.resetGame).toHaveBeenCalledTimes(1);
    });

    it('should handle resetGame errors gracefully', () => {
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: new Date()
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);
      mockStateService.resetGame.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      render(<EndGameModal />);
      
      const playAgainButton = screen.getByRole('button', { name: /play again/i });
      fireEvent.click(playAgainButton);

      expect(mockStateService.resetGame).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('Error resetting game:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Modal Styling and Interaction', () => {
    it('should render modal with proper overlay and content structure', () => {
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: new Date()
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      // Check for key elements
      expect(screen.getByText('🎉')).toBeInTheDocument(); // Celebration icon
      expect(screen.getAllByText('Game Complete!')[0]).toBeInTheDocument();
      expect(screen.getByText('🎮 Play Again')).toBeInTheDocument();
      expect(screen.getByText(/Well played! You've mastered the game/)).toBeInTheDocument();
    });

  });

  describe('Edge Cases', () => {
    it('should handle missing winner in game over state', () => {
      const gameOverState = {
        ...mockGameState,
        isGameOver: true,
        winner: undefined,
        gamePhase: 'END' as const,
        gameEndTime: new Date()
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      // Modal should not be visible without a winner
      expect(screen.queryByText('Game Complete!')).not.toBeInTheDocument();
    });

    it('should handle empty players array', () => {
      const gameOverState = {
        ...mockGameState,
        players: [],
        isGameOver: true,
        winner: 'player1',
        gamePhase: 'END' as const,
        gameEndTime: new Date()
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      expect(screen.getByText('🏆 Congratulations Unknown Player!')).toBeInTheDocument();
    });

    it('should handle multiple players with correct winner identification', () => {
      const player2: Player = {
        ...mockPlayer,
        id: 'player2',
        name: 'Second Player'
      };

      const gameOverState = {
        ...mockGameState,
        players: [mockPlayer, player2],
        isGameOver: true,
        winner: 'player2',
        gamePhase: 'END' as const,
        gameEndTime: new Date()
      };

      mockStateService.getGameState.mockReturnValue(gameOverState);

      render(<EndGameModal />);
      
      expect(screen.getByText('🏆 Congratulations Second Player!')).toBeInTheDocument();
    });
  });
});