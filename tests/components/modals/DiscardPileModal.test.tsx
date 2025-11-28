import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscardPileModal } from '../../../src/components/modals/DiscardPileModal';
import { IServiceContainer, IDataService, IStateService } from '../../../../src/types/ServiceContracts';
import { Card } from '../../../../src/types/DataTypes';

describe('DiscardPileModal', () => {
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

  it('should not render when isOpen is false', () => {
    render(<DiscardPileModal gameServices={mockGameServices} playerId={PLAYER_ID} isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText(/Discard Pile/i)).not.toBeInTheDocument();
  });

  it('should render the modal title and cards when isOpen is true', () => {
    render(<DiscardPileModal gameServices={mockGameServices} playerId={PLAYER_ID} isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(`Discard Pile for ${PLAYER_NAME}`)).toBeInTheDocument();
    expect(screen.getByText('Work Card')).toBeInTheDocument();
    expect(screen.getByText('Expeditor Card')).toBeInTheDocument();
    expect(screen.getByText('Bank Loan Card')).toBeInTheDocument();
  });

  it('should filter cards by type', () => {
    render(<DiscardPileModal gameServices={mockGameServices} playerId={PLAYER_ID} isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText('Filter cards by type'), { target: { value: 'W' } });
    expect(screen.getByText('Work Card')).toBeInTheDocument();
    expect(screen.queryByText('Expeditor Card')).not.toBeInTheDocument();
  });

  it('should sort cards by name', () => {
    render(<DiscardPileModal gameServices={mockGameServices} playerId={PLAYER_ID} isOpen={true} onClose={mockOnClose} />);
    
    // Sort by Name (default is already name, so let's re-sort to ensure it works)
    fireEvent.change(screen.getByLabelText('Sort cards by'), { target: { value: 'name' } });
    
    const cardNames = screen.getAllByRole('listitem').map(li => li.querySelector('span:first-child')?.textContent);
    expect(cardNames).toEqual(['Bank Loan Card', 'Expeditor Card', 'Work Card']); // Alphabetical order
  });

  it('should call onClose when the close button is clicked', () => {
    render(<DiscardPileModal gameServices={mockGameServices} playerId={PLAYER_ID} isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should display "Discard pile is empty" when there are no cards', () => {
    mockStateService.getGameState.mockReturnValue({
      players: [{ id: PLAYER_ID, name: PLAYER_NAME }],
      currentPlayerId: PLAYER_ID,
      discardPiles: { W: [], B: [], E: [], L: [], I: [] },
    } as any);

    render(<DiscardPileModal gameServices={mockGameServices} playerId={PLAYER_ID} isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Discard pile is empty.')).toBeInTheDocument();
  });
});
