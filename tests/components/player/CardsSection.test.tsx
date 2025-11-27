/**
 * CardsSection.test.tsx
 *
 * Test suite for CardsSection component
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardsSection } from '../../../src/components/player/sections/CardsSection';
import { createAllMockServices } from '../../mocks/mockServices';
import { Player, GameState } from '../../../types/StateTypes';
import { GameContext } from '../../../src/context/GameContext';

describe('CardsSection', () => {
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
    hand: ['E001', 'E002', 'W001'],
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

  // Helper to render component with GameContext
  const renderWithContext = (ui: React.ReactElement) => {
    return render(
      <GameContext.Provider value={mockServices}>
        {ui}
      </GameContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    // Setup default mock returns
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]); // Fix: Return empty array by default
    mockServices.dataService.getDiceEffects.mockReturnValue([]); // Fix: Return empty array by default
    mockServices.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'Design' }); // Mock phase for E card validation

    // Mock filterSpaceEffectsByCondition to pass-through effects
    mockServices.turnService.filterSpaceEffectsByCondition.mockImplementation((effects: any[]) => effects);

    // Mock card type detection
    mockServices.cardService.getCardType.mockImplementation((cardId: string) => {
      if (cardId.startsWith('W')) return 'W';
      if (cardId.startsWith('E')) return 'E';
      if (cardId.startsWith('B')) return 'B';
      if (cardId.startsWith('L')) return 'L';
      if (cardId.startsWith('I')) return 'I';
      return null;
    });

    // Mock getCardById to return card data
    mockServices.dataService.getCardById.mockImplementation((cardId: string) => {
      const cardType = cardId.charAt(0);
      return {
        card_id: cardId,
        card_name: `${cardType} Card ${cardId.slice(1)}`,
        card_type: cardType,
        description: `Test card ${cardId}`,
        work_type_restriction: null,
        work_cost: null,
        duration_turns: null,
        phase_restriction: null
      };
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component without crashing', () => {
      renderWithContext(<CardsSection {...defaultProps} />);
      expect(screen.getByText('CARDS')).toBeInTheDocument();
    });

    it('should display total cards in hand', () => {
      renderWithContext(<CardsSection {...defaultProps} />);
      // Check summary contains total
      const summary = screen.getByText((content, element) => {
        return element?.className === 'section-summary' && element?.textContent?.includes('Total: 3') || false;
      });
      expect(summary).toBeInTheDocument();
    });

    it('should display card type counts', () => {
      renderWithContext(<CardsSection {...defaultProps} />);
      // Check for E cards count
      expect(screen.getByText(/E Cards \(2\)/)).toBeInTheDocument();
      // Check for W cards count
      expect(screen.getByText(/W Cards \(1\)/)).toBeInTheDocument();
    });

    it('should return null if player not found', () => {
      mockServices.stateService.getPlayer.mockReturnValue(undefined);
      const { container } = renderWithContext(<CardsSection {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Action Detection', () => {
    it('should show action indicator when B cards dice effect available', () => {
      const bCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'B',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([bCardDiceEffect]);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={vi.fn()} />);
      const indicator = screen.getByRole('status', { name: /action available/i });
      expect(indicator).toBeInTheDocument();
    });

    it('should show action indicator when E cards dice effect available', () => {
      const eCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'E',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([eCardDiceEffect]);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={vi.fn()} />);
      const indicator = screen.getByRole('status', { name: /action available/i });
      expect(indicator).toBeInTheDocument();
    });

    it('should show Roll for B Cards button when dice effect available', () => {
      const bCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'B',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([bCardDiceEffect]);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={vi.fn()} />);
      expect(screen.getByText('Roll for B Cards')).toBeInTheDocument();
    });

    it('should show Roll for E Cards button when dice effect available', () => {
      const eCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'E',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([eCardDiceEffect]);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={vi.fn()} />);
      expect(screen.getByText('Roll for E Cards')).toBeInTheDocument();
    });

    it('should show both card buttons when both dice effects available', () => {
      const bCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'B',
        dice_value: 1,
        value: 1
      };
      const eCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'E',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([bCardDiceEffect, eCardDiceEffect]);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={vi.fn()} />);
      expect(screen.getByText('Roll for B Cards')).toBeInTheDocument();
      expect(screen.getByText('Roll for E Cards')).toBeInTheDocument();
    });
  });

  describe('Roll for Cards Actions', () => {
    it('should call onRollDice callback for B cards', async () => {
      const bCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'B',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([bCardDiceEffect]);
      const onRollDice = vi.fn().mockResolvedValue(undefined);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={onRollDice} />);

      const rollButton = screen.getByText('Roll for B Cards');
      fireEvent.click(rollButton);

      expect(onRollDice).toHaveBeenCalled();
    });

    it('should call onRollDice callback for E cards', async () => {
      const eCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'E',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([eCardDiceEffect]);
      const onRollDice = vi.fn().mockResolvedValue(undefined);

      renderWithContext(<CardsSection {...defaultProps} onRollDice={onRollDice} />);

      const rollButton = screen.getByText('Roll for E Cards');
      fireEvent.click(rollButton);

      expect(onRollDice).toHaveBeenCalled();
    });

    it('should handle roll errors', async () => {
      const bCardDiceEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'B',
        dice_value: 1,
        value: 1
      };
      mockServices.dataService.getDiceEffects.mockReturnValue([bCardDiceEffect]);
      const onRollDice = vi.fn().mockRejectedValue(new Error('Roll failed'));

      renderWithContext(<CardsSection {...defaultProps} onRollDice={onRollDice} />);

      const rollButton = screen.getByText('Roll for B Cards');
      fireEvent.click(rollButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to roll dice. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('View Discarded Button', () => {
    it('should always show View Discarded button', () => {
      renderWithContext(<CardsSection {...defaultProps} />);
      expect(screen.getByText('View Discarded')).toBeInTheDocument();
    });

    it('should open modal when View Discarded clicked', async () => {
      renderWithContext(<CardsSection {...defaultProps} />);

      const viewDiscardedButton = screen.getByText('View Discarded');
      fireEvent.click(viewDiscardedButton);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText(/All Discarded Cards/i)).toBeInTheDocument();
      });
    });
  });
});
