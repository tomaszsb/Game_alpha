import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscardPileModal } from '../../../src/components/modals/DiscardPileModal';
import { GameContext } from '../../../src/context/GameContext';
import { IServiceContainer, IDataService, IStateService } from '../../../src/types/ServiceContracts';
import { Card } from '../../../src/types/DataTypes';
import { DISCARD_PILE } from '../../../src/constants/uiStrings';
import { DictionaryProvider } from '../../../src/dictionary';

describe('DiscardPileModal', () => {
  beforeEach(() => {
    cleanup();
  });

  let mockDataService: IDataService;
  let mockStateService: IStateService;
  let mockGameServices: IServiceContainer;
  let mockOnClose: () => void;

  const PLAYER_ID = 'player1';
  const PLAYER_NAME = 'Alice';

  const mockDiscardedCards: Card[] = [
    { card_id: 'W001', card_name: 'Work Card', card_type: 'W', description: 'desc W001' },
    { card_id: 'E001', card_name: 'Expeditor Card', card_type: 'E', description: 'desc E001' },
    { card_id: 'B001', card_name: 'Bank Loan Card', card_type: 'B', description: 'desc B001' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataService = {
      getCardById: vi.fn((cardId: string) => mockDiscardedCards.find(card => card.card_id === cardId)),
    } as unknown as IDataService;

    mockStateService = {
      getGameState: vi.fn(() => ({
        players: [{ id: PLAYER_ID, name: PLAYER_NAME }],
        currentPlayerId: PLAYER_ID,
        discardPiles: {
          W: ['W001'],
          B: ['B001'],
          E: ['E001'],
          L: [],
          I: [],
        },
      } as any)),
      getPlayer: vi.fn((id: string) => (id === PLAYER_ID ? { id: PLAYER_ID, name: PLAYER_NAME } : undefined)),
      subscribe: vi.fn(() => vi.fn()),
    } as unknown as IStateService;

    mockGameServices = {
      dataService: mockDataService,
      stateService: mockStateService,
    } as IServiceContainer;

    mockOnClose = vi.fn();
  });

  const renderWithContext = (props: { isOpen: boolean; onClose: () => void; onOpenCardDetailsModal?: (cardId: string) => void }) => {
    return render(
      <DictionaryProvider>
        <GameContext.Provider value={mockGameServices}>
          <DiscardPileModal {...props} />
        </GameContext.Provider>
      </DictionaryProvider>
    );
  };

  it('should not render when isOpen is false', () => {
    renderWithContext({ isOpen: false, onClose: mockOnClose });
    expect(screen.queryByText(/Discard Pile/i)).not.toBeInTheDocument();
  });

  it('should render the modal title and cards when isOpen is true', () => {
    renderWithContext({ isOpen: true, onClose: mockOnClose });
    expect(screen.getByText('Work Card')).toBeInTheDocument();
    expect(screen.getByText('Expeditor Card')).toBeInTheDocument();
    expect(screen.getByText('Bank Loan Card')).toBeInTheDocument();
  });

  it('should filter cards by type', () => {
    renderWithContext({ isOpen: true, onClose: mockOnClose });

    fireEvent.change(screen.getByLabelText(DISCARD_PILE.FILTER_LABEL), { target: { value: 'W' } });
    expect(screen.getByText('Work Card')).toBeInTheDocument();
    expect(screen.queryByText('Expeditor Card')).not.toBeInTheDocument();
  });

  it('should call onClose when the close button is clicked', () => {
    renderWithContext({ isOpen: true, onClose: mockOnClose });
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should display empty state when there are no cards', () => {
    (mockStateService.getGameState as any).mockReturnValue({
      players: [{ id: PLAYER_ID, name: PLAYER_NAME }],
      currentPlayerId: PLAYER_ID,
      discardPiles: { W: [], B: [], E: [], L: [], I: [] },
    } as any);

    renderWithContext({ isOpen: true, onClose: mockOnClose });
    expect(screen.getByText(new RegExp(DISCARD_PILE.EMPTY_STATE, 'i'))).toBeInTheDocument();
  });
});
