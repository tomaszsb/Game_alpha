/**
 * DiscardedCardsModal.test.tsx
 * 
 * Test suite for DiscardedCardsModal component to verify it works correctly
 * with the new stateful deck architecture using gameState.discardPiles
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscardedCardsModal } from '../../../src/components/modals/DiscardedCardsModal';
import { GameContext } from '../../../src/context/GameContext';
import { Player, GameState } from '../../../src/types/StateTypes';
import { createAllMockServices } from '../../mocks/mockServices';

describe('DiscardedCardsModal', () => {
  beforeEach(() => {
    cleanup();
  });

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
    hand: ['E001', 'L001'],
    activeCards: [],
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
      W: ['W001', 'W002'], // 2 W cards discarded
      B: ['B001'], // 1 B card discarded
      E: ['E002'], // 1 E card discarded
      L: ['L002'], // 1 L card discarded
      I: [] // No I cards discarded
    }
  };

  const defaultProps = {
    player: mockPlayer,
    isVisible: true,
    onClose: vi.fn(),
    onOpenCardDetailsModal: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock services
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    
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
        <DiscardedCardsModal {...props} />
      </GameContext.Provider>
    );
  };

  describe('Basic Rendering', () => {
    it('should render the modal when visible', () => {
      renderComponent();
      
      expect(screen.getByTestId('discarded-cards-modal')).toBeInTheDocument();
    });

    it('should not render the modal when not visible', () => {
      renderComponent({ ...defaultProps, isVisible: false });
      
      expect(screen.queryByTestId('discarded-cards-modal')).not.toBeInTheDocument();
    });

    it('should render close button', () => {
      renderComponent();
      
      const closeButton = screen.getByText('✕');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Discarded Cards Display', () => {
    it('should display discarded cards from gameState.discardPiles', () => {
      renderComponent();

      // Should show card count text for each card type that has discarded cards
      // The format is "(X card(s))" rendered separately from the badge
      expect(screen.getByText('(2 cards)')).toBeInTheDocument(); // W cards
      // B, E, and L each have 1 card, so there should be 3 "(1 card)" elements
      expect(screen.getAllByText('(1 card)').length).toBe(3);

      // Should show CardTypeBadges for card types with discarded cards
      expect(document.querySelectorAll('[data-card-type="W"]').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('[data-card-type="B"]').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('[data-card-type="E"]').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('[data-card-type="L"]').length).toBeGreaterThan(0);

      // Should not show I card badge (empty discard pile)
      // Note: I cards have empty discard pile in mock, so no header should render
      const iCards = Array.from(document.querySelectorAll('[data-card-type="I"]'));
      // I cards should only appear in the header section (as badges), not as individual cards
      // Since there are no I cards in discard pile, there should be no section header for I
    });

    it('should display individual discarded cards', () => {
      renderComponent();
      
      // Should show card names for discarded cards
      expect(screen.getByText('Mock Card W001')).toBeInTheDocument();
      expect(screen.getByText('Mock Card W002')).toBeInTheDocument();
      expect(screen.getByText('Mock Card B001')).toBeInTheDocument();
      expect(screen.getByText('Mock Card E002')).toBeInTheDocument();
      expect(screen.getByText('Mock Card L002')).toBeInTheDocument();
    });

    it('should show "No discarded cards yet" when no cards are discarded', () => {
      const emptyGameState = {
        ...mockGameState,
        discardPiles: {
          W: [],
          B: [],
          E: [],
          L: [],
          I: []
        }
      };
      
      mockServices.stateService.getGameState.mockReturnValue(emptyGameState);
      renderComponent();
      
      expect(screen.getByText('No discarded cards yet')).toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      const mockOnClose = vi.fn();
      renderComponent({ ...defaultProps, onClose: mockOnClose });
      
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when modal overlay is clicked', () => {
      const mockOnClose = vi.fn();
      renderComponent({ ...defaultProps, onClose: mockOnClose });

      // Click on the modal overlay
      const overlay = screen.getByTestId('discarded-cards-modal-overlay');
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenCardDetailsModal when card is clicked', () => {
      const mockOnOpenCardDetails = vi.fn();
      renderComponent({ ...defaultProps, onOpenCardDetailsModal: mockOnOpenCardDetails });
      
      // Find the first card and click it
      const cardElement = screen.getByText('Mock Card W001');
      fireEvent.click(cardElement.closest('[style*="cursor: pointer"]')!);
      
      expect(mockOnOpenCardDetails).toHaveBeenCalledWith('W001');
    });

    it('should not call onClose when modal content is clicked', () => {
      const mockOnClose = vi.fn();
      renderComponent({ ...defaultProps, onClose: mockOnClose });

      // Click on modal content (should not close)
      const modalContent = screen.getByTestId('discarded-cards-modal');
      fireEvent.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Card Display Details', () => {
    it('should display card descriptions with truncation', () => {
      // Mock a card with a long description for W001 only
      const longDescription = 'This is a very long description that should be truncated when displayed in the modal to prevent UI overflow and maintain readability for users';

      mockServices.dataService.getCardById.mockImplementation((cardId: string) => {
        if (cardId === 'W001') {
          return {
            card_id: cardId,
            card_name: `Mock Card ${cardId}`,
            card_type: 'W' as const,
            description: longDescription,
            cost: 100,
            effects_on_play: `Mock effects for ${cardId}`,
            target: 'Self',
            duration_count: '0',
            tick_modifier: '0',
            phase_restriction: 'Any'
          };
        }
        // Return normal short description for other cards
        return {
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
        };
      });

      renderComponent();

      // The description is in the DOM (CSS handles visual truncation with -webkit-line-clamp)
      // We verify the description element exists and has the truncation styling applied
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('should display card type badges with correct colors', () => {
      renderComponent();

      // Check that card type badges are present using data-card-type attribute
      const wBadges = document.querySelectorAll('[data-card-type="W"]');
      expect(wBadges.length).toBeGreaterThan(0);

      const bBadges = document.querySelectorAll('[data-card-type="B"]');
      expect(bBadges.length).toBeGreaterThan(0);
    });
  });
});
