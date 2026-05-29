import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { CardReplacementModal } from '../../../src/components/modals/CardReplacementModal';
import { Player, Card } from '../../../src/types/DataTypes';
import { DataService } from '../../../src/services/DataService';
import { CARD_REPLACE } from '../../../src/constants/uiStrings';
import { DictionaryProvider } from '../../../src/dictionary';

const renderWithDictionary = (ui: React.ReactElement) => render(<DictionaryProvider>{ui}</DictionaryProvider>);

// Mock GameContext
const mockDataService = {
  getCardById: vi.fn()
} as unknown as DataService;

const mockStateService = {
  getGameState: vi.fn().mockReturnValue({
    players: []
  })
};

const mockCardService = {};

vi.mock('../../../src/context/GameContext', () => ({
  useGameContext: () => ({
    dataService: mockDataService,
    stateService: mockStateService,
    cardService: mockCardService
  })
}));

describe('CardReplacementModal', () => {
  beforeEach(() => {
    cleanup();
  });

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

  const mockPlayer: any = {
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
    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(CARD_REPLACE.title('Replace', 'Work Package'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CARD_REPLACE.instruction(2)))).toBeInTheDocument();
    expect(screen.getByText('Foundation Work')).toBeInTheDocument();
    expect(screen.getByText('Electrical Upgrade')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithDictionary(
      <CardReplacementModal
        isOpen={false}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText(CARD_REPLACE.title('Replace', 'Work Package'))).not.toBeInTheDocument();
  });

  it('should not render when player is null', () => {
    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={null}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText(CARD_REPLACE.title('Replace', 'Work Package'))).not.toBeInTheDocument();
  });

  it('should display message when no cards available', () => {
    const emptyPlayer: any = {
      ...mockPlayer,
      hand: []
    };

    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={emptyPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(CARD_REPLACE.empty('Work Package', 'replace'))).toBeInTheDocument();
  });

  it('should handle card selection and deselection', () => {
    renderWithDictionary(
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

    // Initially no selected
    expect(screen.getByText(CARD_REPLACE.counter(0, 2))).toBeInTheDocument();

    // Select first card
    fireEvent.click(foundationCard!);
    expect(screen.getByText(CARD_REPLACE.counter(1, 2))).toBeInTheDocument();

    // Select second card
    fireEvent.click(electricalCard!);
    expect(screen.getByText(CARD_REPLACE.counter(2, 2))).toBeInTheDocument();

    // Deselect first card
    fireEvent.click(foundationCard!);
    expect(screen.getByText(CARD_REPLACE.counter(1, 2))).toBeInTheDocument();
  });

  it('should prevent selecting more cards than maxReplacements', () => {
    renderWithDictionary(
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
    expect(screen.getByText(CARD_REPLACE.counter(1, 1))).toBeInTheDocument();

    // Try to select second card - should not work
    fireEvent.click(electricalCard!);
    expect(screen.getByText(CARD_REPLACE.counter(1, 1))).toBeInTheDocument();
  });

  it('should display card details with proper formatting', () => {
    renderWithDictionary(
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
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('$25K')).toBeInTheDocument();
    expect(screen.getByText(/Essential foundation repairs/)).toBeInTheDocument();
  });

  it('should show newCardType notification when specified', () => {
    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        newCardType="B"
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Should show notification about what type of card they'll receive
    expect(screen.getByText(/You will receive a new/)).toBeInTheDocument();
    expect(screen.getByText(/Bank/)).toBeInTheDocument();
  });

  it('should enable Replace button when cards are selected', () => {
    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // At 0 selected the confirm button reads just the verb ("Replace"), no count.
    const replaceButton = screen.getByText(CARD_REPLACE.confirm('Replace', 0));

    // Initially disabled
    expect(replaceButton).toBeDisabled();

    // Select a card
    const foundationCard = screen.getByText('Foundation Work').closest('div');
    fireEvent.click(foundationCard!);

    // Should now be enabled
    expect(replaceButton).not.toBeDisabled();
    expect(screen.getByText(CARD_REPLACE.confirm('Replace', 1))).toBeInTheDocument();
  });

  it('should call onReplace with selected cards and same card type', () => {
    renderWithDictionary(
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

    // Click replace - should use same card type (W)
    const replaceButton = screen.getByText(CARD_REPLACE.confirm('Replace', 1));
    fireEvent.click(replaceButton);

    expect(mockOnReplace).toHaveBeenCalledWith(['W1'], 'W');
  });

  it('should call onCancel when Return to Main Panel button is clicked', () => {
    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText(CARD_REPLACE.RETURN_BUTTON);
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when backdrop is clicked', () => {
    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={mockPlayer}
        cardType="W"
        maxReplacements={2}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    const backdrop = screen.getByText('Replace Work Package').closest('div')?.parentElement?.parentElement;
    fireEvent.click(backdrop!);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should reset selection state when cancelled', () => {
    const { rerender } = renderWithDictionary(
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
    expect(screen.getByText(CARD_REPLACE.counter(1, 2))).toBeInTheDocument();

    // Cancel using Return to Main Panel button
    const cancelButton = screen.getByText(CARD_REPLACE.RETURN_BUTTON);
    fireEvent.click(cancelButton);

    // Re-render the same component to check if its internal state was reset
    rerender(
      <DictionaryProvider>
        <CardReplacementModal
          isOpen={true}
          player={mockPlayer}
          cardType="W"
          maxReplacements={2}
          onReplace={mockOnReplace}
          onCancel={mockOnCancel}
        />
      </DictionaryProvider>
    );

    expect(screen.getByText(CARD_REPLACE.counter(0, 2))).toBeInTheDocument();
  });

  it('should handle different card types correctly', () => {
    const businessPlayer: any = {
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

    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={businessPlayer}
        cardType="B"
        maxReplacements={1}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(CARD_REPLACE.title('Replace', 'Bank Loan'))).toBeInTheDocument();
    expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
  });

  it('should handle cards with long descriptions', () => {
    const longDescCard: Card = {
      card_id: 'W3',
      card_name: 'Complex Project',
      card_type: 'W',
      cost: 50000,
      description: 'This is a very long description that should be displayed in the card replacement modal even if it is lengthy'
    };

    (mockDataService.getCardById as Mock).mockReturnValue(longDescCard);

    const playerWithLongCard: any = {
      ...mockPlayer,
      hand: ['W3']
    };

    renderWithDictionary(
      <CardReplacementModal
        isOpen={true}
        player={playerWithLongCard}
        cardType="W"
        maxReplacements={1}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Full description should be present in the DOM (CSS may visually clip it)
    expect(screen.getByText(/This is a very long description/)).toBeInTheDocument();
    expect(screen.getByText('Complex Project')).toBeInTheDocument();
  });
});
