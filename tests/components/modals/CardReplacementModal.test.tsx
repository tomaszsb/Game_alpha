import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { CardReplacementModal } from '../../../src/components/modals/CardReplacementModal';
import { Player, Card } from '../../../src/types/DataTypes';
import { DataService } from '../../../src/services/DataService';

// Mock GameContext
const mockDataService = {
  getCardById: vi.fn()
} as unknown as DataService;

vi.mock('../../../src/context/GameContext', () => ({
  useGameContext: () => ({
    dataService: mockDataService
  })
}));

describe('CardReplacementModal', () => {
  const mockCard1: Card = {
    card_id: 'W1',
    card_name: 'Foundation Work',
    card_type: 'W',
    cost: 0,
    description: 'Essential foundation repairs and improvements'
  };

  const mockCard2: Card = {
    card_id: 'W2', 
    card_name: 'Electrical Upgrade',
    card_type: 'W',
    cost: 25000,
    description: 'Complete electrical system upgrade for safety compliance'
  };

  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    color: '#ff0000',
    avatar: '👤',
    money: 100000,
    timeSpent: 45,
    projectScope: 0,
    score: 0,
    currentSpace: 'START',
    visitType: 'First',
    hand: ['W1', 'W2'],
    activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: []
  };

  const mockOnReplace = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (mockDataService.getCardById as Mock).mockImplementation((id: string) => {
      if (id === 'W1') return mockCard1;
      if (id === 'W2') return mockCard2;
      return null;
    });
  });

  it('should render when open with valid player and cards', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Replace Work Cards')).toBeInTheDocument();
    expect(screen.getByText(/Select up to 2 cards to replace/)).toBeInTheDocument();
    expect(screen.getByText('Foundation Work')).toBeInTheDocument();
    expect(screen.getByText('Electrical Upgrade')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <CardReplacementModal
        isOpen={false}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText('Replace Work Cards')).not.toBeInTheDocument();
  });

  it('should not render when player is null', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={null}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText('Replace Work Cards')).not.toBeInTheDocument();
  });

  it('should display message when no cards available', () => {
    const emptyPlayer: Player = {
      ...mockPlayer,
      hand: []
    };

    render(
      <CardReplacementModal
        isOpen={true}
        player={emptyPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('No Work cards available to replace')).toBeInTheDocument();
  });

  it('should handle card selection and deselection', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const foundationCard = screen.getByText('Foundation Work').closest('div');
    const electricalCard = screen.getByText('Electrical Upgrade').closest('div');

    // Initially no cards selected
    expect(screen.getByText('0 of 2 cards selected')).toBeInTheDocument();

    // Select first card
    fireEvent.click(foundationCard!);
    expect(screen.getByText('1 of 2 cards selected')).toBeInTheDocument();

    // Select second card
    fireEvent.click(electricalCard!);
    expect(screen.getByText('2 of 2 cards selected')).toBeInTheDocument();

    // Deselect first card
    fireEvent.click(foundationCard!);
    expect(screen.getByText('1 of 2 cards selected')).toBeInTheDocument();
  });

  it('should prevent selecting more cards than maxReplacements', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={1}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const foundationCard = screen.getByText('Foundation Work').closest('div');
    const electricalCard = screen.getByText('Electrical Upgrade').closest('div');

    // Select first card
    fireEvent.click(foundationCard!);
    expect(screen.getByText('1 of 1 cards selected')).toBeInTheDocument();

    // Try to select second card - should not work
    fireEvent.click(electricalCard!);
    expect(screen.getByText('1 of 1 cards selected')).toBeInTheDocument();
  });

  it('should display card details with proper formatting', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Foundation Work')).toBeInTheDocument();
    expect(screen.getByText('Cost: Free')).toBeInTheDocument();
    expect(screen.getByText('Cost: $25K')).toBeInTheDocument();
    expect(screen.getByText(/Essential foundation repairs/)).toBeInTheDocument();
  });

  it('should handle replacement card type selection', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Default replacement type should be Work
    expect(screen.getByText('Replace with:')).toBeInTheDocument();

    // Click on Bank Loan card type
    const businessButton = screen.getByText(/💼 Bank Loan/);
    fireEvent.click(businessButton);

    // Should update the replacement type selection
    expect(businessButton).toHaveAttribute('aria-selected', 'true');
  });

  it('should enable Replace button when cards are selected', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const replaceButton = screen.getByText(/Replace \d+ Card/);
    
    // Initially disabled
    expect(replaceButton).toBeDisabled();

    // Select a card
    const foundationCard = screen.getByText('Foundation Work').closest('div');
    fireEvent.click(foundationCard!);

    // Should now be enabled
    expect(replaceButton).not.toBeDisabled();
    expect(screen.getByText('Replace 1 Card')).toBeInTheDocument();
  });

  it('should call onReplace with selected cards and replacement type', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Select cards
    const foundationCard = screen.getByText('Foundation Work').closest('div');
    fireEvent.click(foundationCard!);

    // Select Business replacement type
    const businessButton = screen.getByText(/💼 Bank Loan/);
    fireEvent.click(businessButton);

    // Click replace
    const replaceButton = screen.getByText('Replace 1 Card');
    fireEvent.click(replaceButton);

    expect(mockOnReplace).toHaveBeenCalledWith(['W1'], 'B');
  });

  it('should call onCancel when Cancel button is clicked', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when backdrop is clicked', () => {
    render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const backdrop = screen.getByText('Replace Work Cards').closest('div')?.parentElement?.parentElement;
    fireEvent.click(backdrop!);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should reset selection state when cancelled', () => {
    const { rerender } = render(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Select a card
    const foundationCard = screen.getByText('Foundation Work').closest('div');
    fireEvent.click(foundationCard!);
    expect(screen.getByText('1 of 2 cards selected')).toBeInTheDocument();

    // Cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Re-render the same component to check if its internal state was reset
    rerender(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('0 of 2 cards selected')).toBeInTheDocument();
  });

  it('should handle different card types correctly', () => {
    const businessPlayer: Player = {
      ...mockPlayer,
      hand: ['B1']
    };

    (mockDataService.getCardById as Mock).mockReturnValue({
      id: 'B1',
      card_name: 'Marketing Campaign',
      card_type: 'B',
      cost: 15000,
      description: 'Launch comprehensive marketing campaign'
    });

    render(
      <CardReplacementModal
        isOpen={true}
        player={businessPlayer}
        cardType="B"
        maxReplacements={1}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Replace Bank Loan Cards')).toBeInTheDocument();
    expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
  });

  it('should handle cards with long descriptions by truncating', () => {
    const longDescCard: Card = {
      card_id: 'W3',
      card_name: 'Complex Project',
      card_type: 'W',
      cost: 50000,
      description: 'This is a very long description that should be truncated when displayed in the card replacement modal because it exceeds the 80 character limit and would make the UI look bad'
    };

    (mockDataService.getCardById as Mock).mockReturnValue(longDescCard);

    const playerWithLongCard: Player = {
      ...mockPlayer,
      hand: ['W3']
    };

    render(
      <CardReplacementModal
        isOpen={true}
        player={playerWithLongCard}
        cardType="W"
        maxReplacements={1}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/This is a very long description that should be truncated when displayed/)).toBeInTheDocument();
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });
});