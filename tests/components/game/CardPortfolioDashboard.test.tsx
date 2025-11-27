/**
 * CardPortfolioDashboard.test.tsx
 * 
 * Test suite for CardPortfolioDashboard component to verify it works correctly
 * with the new stateful deck architecture using player.hand and gameState.discardPiles
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CardPortfolioDashboard } from '../../../src/components/game/CardPortfolioDashboard';
import { GameContext } from '../../../src/context/GameContext';
import { Player, GameState } from '../../../src/types/StateTypes';
import { createAllMockServices } from '../../mocks/mockServices';

describe('CardPortfolioDashboard', () => {
  const mockServices = createAllMockServices();
  
  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    money: 1000,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    color: '#007bff',
    avatar: '👤',
    hand: ['E001', 'L001', 'E002'], // Player has 2 E cards and 1 L card
    activeCards: [
      {
        cardId: 'E001',
        expirationTurn: 5
      }
    ],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: []
  };

  const mockGameState: GameState = {
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 2,
    activeModal: null,
    awaitingChoice: null,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    isGameOver: false,
    requiredActions: 1,
    completedActions: 0,
    availableActionTypes: [],
    hasCompletedManualActions: false,
    activeNegotiation: null,
    globalActionLog: [],
    preSpaceEffectState: null,
    decks: {
      W: ['W003', 'W004'],
      B: ['B003', 'B004'],
      E: ['E003', 'E004'],
      L: ['L003', 'L004'],
      I: ['I003', 'I004']
    },
    discardPiles: {
      W: ['W001', 'W002'],
      B: ['B001'],
      E: ['E003'], // 1 E card discarded
      L: ['L002'], // 1 L card discarded
      I: []
    }
  };

  const defaultProps = {
    player: mockPlayer,
    isCurrentPlayer: true,
    onOpenCardDetailsModal: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup(); // Clean up any previous renders

    // Setup mock services
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);

    // CRITICAL: Mock dataService.isLoaded() to return true so component renders properly
    mockServices.dataService.isLoaded.mockReturnValue(true);

    // Setup cardService.getCardType to return appropriate types
    mockServices.cardService.getCardType.mockImplementation((cardId: string) => {
      if (cardId.startsWith('W')) return 'W';
      if (cardId.startsWith('B')) return 'B';
      if (cardId.startsWith('E')) return 'E';
      if (cardId.startsWith('L')) return 'L';
      if (cardId.startsWith('I')) return 'I';
      return null;
    });

    // Setup dataService.getCardById to return mock card data
    mockServices.dataService.getCardById.mockImplementation((cardId: string) => ({
      card_id: cardId,
      card_name: `Mock Card ${cardId}`,
      card_type: cardId.charAt(0) as 'W' | 'B' | 'E' | 'L' | 'I',
      description: `Test description for ${cardId}`,
      cost: 100,
      effects_on_play: `Mock effects for ${cardId}`,
      target: 'Self',
      duration_count: '0',
      tick_modifier: '0',
      phase_restriction: 'Any'
    }));
  });

  const renderComponent = (props = defaultProps) => {
    return render(
      <GameContext.Provider value={mockServices}>
        <CardPortfolioDashboard {...props} />
      </GameContext.Provider>
    );
  };

  describe('Basic Rendering', () => {
    it('should render the component without crashing', () => {
      renderComponent();
      
      expect(screen.getByText('🎯 Card Portfolio')).toBeInTheDocument();
    });

    it('should render Available Cards section', () => {
      renderComponent();

      expect(screen.getAllByText('Available Cards')[0]).toBeInTheDocument();
    });

    it('should render Active Cards section', () => {
      renderComponent();
      
      expect(screen.getByText(/Active Cards \(\d+\)/)).toBeInTheDocument();
    });
  });

  describe('Card Counts Display', () => {
    it('should display correct card counts from player.hand', () => {
      renderComponent();
      
      // Should show E Cards (2) and L Cards (1) based on mockPlayer.hand
      expect(screen.getByText('E Cards (2)')).toBeInTheDocument();
      expect(screen.getByText('L Cards (1)')).toBeInTheDocument();
    });

    it('should display correct active card count', () => {
      renderComponent();
      
      // Should show 1 active card based on mockPlayer.activeCards
      expect(screen.getByText('Active Cards (1)')).toBeInTheDocument();
    });

    it('should display total available + active cards count', () => {
      renderComponent();
      
      // 2 E cards + 1 L card + 1 active card = 4 total
      expect(screen.getByText('Available + Active: 4 cards')).toBeInTheDocument();
    });

    it('should show "No cards available" when player has no E/L cards', () => {
      const playerWithNoCards = {
        ...mockPlayer,
        hand: ['W001', 'B001', 'I001'] // Only W, B, I cards which are filtered out
      };
      
      renderComponent({ ...defaultProps, player: playerWithNoCards });
      
      expect(screen.getByText('No cards available to play')).toBeInTheDocument();
    });
  });

  describe('Card Interactions', () => {
    it('should call onOpenCardDetailsModal when card is clicked', () => {
      const mockOpenModal = vi.fn();
      renderComponent({ ...defaultProps, onOpenCardDetailsModal: mockOpenModal });
      
      // Find the first card button (Mock Card E001) in Available Cards section
      const cardButton = screen.getByTitle('View details: Mock Card E001 • Transferable');
      fireEvent.click(cardButton);
      
      expect(mockOpenModal).toHaveBeenCalledWith('E001');
    });

    it('should call cardService.playCard when Play button is clicked', () => {
      renderComponent();
      
      // Find and click the first Play button
      const playButtons = screen.getAllByText('Play');
      fireEvent.click(playButtons[0]);
      
      expect(mockServices.cardService.playCard).toHaveBeenCalledWith('player1', 'E001');
    });

    it('should disable Play button when not current player', () => {
      renderComponent({ ...defaultProps, isCurrentPlayer: false });
      
      const playButtons = screen.getAllByText('Play');
      expect(playButtons[0]).toBeDisabled();
    });

    it('should show success feedback after playing a card', async () => {
      mockServices.cardService.playCard.mockReturnValue(mockGameState);
      
      renderComponent();
      
      const playButtons = screen.getAllByText('Play');
      fireEvent.click(playButtons[0]);
      
      // Wait for success message to appear
      expect(await screen.findByText(/✅.*Successfully played.*Mock Card E001/)).toBeInTheDocument();
    });

    it('should show error feedback when card play fails', async () => {
      mockServices.cardService.playCard.mockImplementation(() => {
        throw new Error('Cannot play card');
      });
      
      renderComponent();
      
      const playButtons = screen.getAllByText('Play');
      fireEvent.click(playButtons[0]);
      
      // Wait for error message to appear
      expect(await screen.findByText(/❌.*Cannot play card/)).toBeInTheDocument();
    });
  });

  describe('Active Cards Display', () => {
    it('should display active card with remaining turns', () => {
      renderComponent();
      
      // mockGameState.turn = 2, activeCard.expirationTurn = 5, so 3 turns remaining
      expect(screen.getByText('⏳ 3 turns left')).toBeInTheDocument();
    });

    it('should show "No active cards" when player has no active cards', () => {
      const playerWithNoActiveCards = {
        ...mockPlayer,
        activeCards: []
      };
      
      renderComponent({ ...defaultProps, player: playerWithNoActiveCards });
      
      expect(screen.getByText('No active cards')).toBeInTheDocument();
    });
  });

  describe('W, B, I Cards Information', () => {
    it('should show info message when player has W, B, or I cards', () => {
      // Mock cardService to return W, B, I types for some cards
      mockServices.cardService.getCardType.mockImplementation((cardId: string) => {
        if (cardId === 'W001') return 'W' as const;
        if (cardId === 'B001') return 'B' as const;
        return cardId.charAt(0) as 'W' | 'B' | 'E' | 'L' | 'I';
      });
      
      const playerWithWBI = {
        ...mockPlayer,
        hand: ['W001', 'B001', 'E001', 'L001']
      };
      
      renderComponent({ ...defaultProps, player: playerWithWBI });
      
      expect(screen.getByText(/💡.*Work scope.*Bank loans.*Investor loans.*Financial Status/)).toBeInTheDocument();
    });

    it('should not show W, B, I info message when player has none', () => {
      renderComponent(); // mockPlayer has only E and L cards
      
      expect(screen.queryByText(/💡.*Work scope.*Bank loans.*Investor loans/)).not.toBeInTheDocument();
    });
  });
});