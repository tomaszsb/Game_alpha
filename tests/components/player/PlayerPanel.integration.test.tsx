import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerPanel } from '../../../src/components/player/PlayerPanel';
import { IServiceContainer } from '../../../src/types/ServiceContracts';
import { createMockStateService, createMockTurnService, createMockCardService, createMockChoiceService, createMockDataService, createMockMovementService, createMockGameRulesService } from '../../mocks/mockServices';
import { GameState, Player } from '../../../src/types/StateTypes';
import { Card } from '../../../src/types/DataTypes';

const PLAYER_ID = 'player1';
const PLAYER_NAME = 'Alice';

// Helper function to set up a test game state with mocked services
const setupTestGame = (initialGameState?: Partial<GameState>, initialPlayer?: Partial<Player>): { gameServices: IServiceContainer, mockCard: Card } => {

  const mockPlayer: Player = {
    id: PLAYER_ID,
    shortId: 'P1',
    name: PLAYER_NAME,
    currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First',
    visitedSpaces: [],
    spaceVisitLog: [],
    money: 1000,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    hand: ['card1', 'card2'],
    activeCards: [],
    lastDiceRoll: undefined,
    spaceEntrySnapshot: undefined,
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: [],
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    expenditures: { design: 0, fees: 0, construction: 0 },
    costHistory: [],
    avatar: 'A',
    currentCard: undefined,
    pathChoiceMemory: undefined,
    ...initialPlayer
  };

  const mockCard: Card = {
    card_id: 'card1',
    card_name: 'Test Card',
    card_type: 'W',
    description: 'A test card for choices',
    effect: {
      type: 'choice',
      choices: [
        { id: 'accept', label: 'Accept' },
        { id: 'negotiate', label: 'Negotiate' },
        { id: 'reject', label: 'Reject' },
      ],
      // Adding necessary properties to satisfy Effect interface if it has them
      effectType: 'CHOICE',
      payload: {
        id: 'choiceId',
        playerId: PLAYER_ID,
        type: 'GENERIC',
        prompt: 'Make a choice'
      }
    },
  };

  const mockGameState: GameState = {
    players: [mockPlayer],
    currentPlayerId: PLAYER_ID,
    gamePhase: 'PLAY',
    turn: 1,
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnCount: 1,
    playerTurnCounts: { [PLAYER_ID]: 1 },
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    awaitingChoice: null,
    isGameOver: false,
    isMoving: false,
    isProcessingArrival: false,
    isInitialized: true,
    activeNegotiation: null,
    selectedDestination: null,
    globalActionLog: [],
    playerSnapshots: {},
    decks: { W: [], B: [], E: [], L: [], I: [] },
    discardPiles: { W: [], B: [], E: [], L: [], I: [] },
    ...initialGameState
  };

  const mockStateService = createMockStateService();
  mockStateService.getGameState.mockReturnValue(mockGameState);
  mockStateService.getPlayer.mockReturnValue(mockPlayer);
  mockStateService.getAllPlayers.mockReturnValue([mockPlayer]);
  mockStateService.updatePlayer.mockImplementation((updates) => {
    // Simulate updating the player and returning a new game state
    const updatedPlayer = { ...mockPlayer, ...updates };
    const newGameState = { ...mockGameState, players: [updatedPlayer] };
    mockStateService.getGameState.mockReturnValue(newGameState); // Update state for next call
    mockStateService.getPlayer.mockReturnValue(updatedPlayer);
    return newGameState;
  });
  mockStateService.subscribe.mockReturnValue(vi.fn()); // Mock subscription

  const mockTurnService = createMockTurnService();
  mockTurnService.isCurrentPlayer.mockReturnValue(true);
  mockTurnService.hasPendingChoice.mockReturnValue(false);
  mockTurnService.getAvailableActions.mockReturnValue([]);
  mockTurnService.canEndTurn.mockReturnValue(true);

  const mockCardService = createMockCardService();
  mockCardService.getCardById.mockReturnValue(mockCard); // Mock for currentCard
  
  const mockChoiceService = createMockChoiceService();
  mockChoiceService.resolveChoice.mockResolvedValue(undefined);

  const mockDataService = createMockDataService();
  mockDataService.getCardById.mockReturnValue(mockCard); // Ensure dataService can find the card

  const mockMovementService = createMockMovementService();
  mockMovementService.getValidMoves.mockReturnValue(['SPACE-A', 'SPACE-B']);

  const mockGameRulesService = createMockGameRulesService(); // Create the mock
  mockGameRulesService.calculateProjectScope.mockReturnValue(0); // Set default return value

  const gameServices: IServiceContainer = {
    dataService: mockDataService,
    stateService: mockStateService,
    turnService: mockTurnService,
    cardService: mockCardService,
    choiceService: mockChoiceService,
    movementService: mockMovementService,
    gameRulesService: mockGameRulesService, // Use the created mock
    // Add other services if they are used by PlayerPanel and its children
    loggingService: {} as any,
    resourceService: {} as any,
    negotiationService: {} as any,
    effectEngineService: {} as any,
    playerActionService: {} as any,
    notificationService: {} as any,
  };

  return { gameServices, mockCard };
};

describe('PlayerPanel Integration Tests - Phase 5 Edge Cases & Polish', () => {
  // Task 1: Verify Try Again state reset behavior
  it('should reset UI to pre-action state after "Try Again"', async () => {
    const { gameServices, mockCard } = setupTestGame();

    // Setup initial state: player on space with a choice, and a snapshot exists
    const initialPlayerState = {
      ...gameServices.stateService.getPlayer(PLAYER_ID),
      currentSpace: 'SPACE-WITH-CHOICE',
      spaceEntrySnapshot: {
        space: 'SPACE-WITH-CHOICE',
        visitType: 'First',
        money: 1000,
        timeSpent: 5,
        hand: [],
        activeCards: [],
      },
      currentCard: 'card1' // Player has a card that triggers a choice
    };
    gameServices.stateService.getPlayer.mockReturnValue(initialPlayerState);

    const initialGameState = {
      ...gameServices.stateService.getGameState(),
      currentPlayerId: PLAYER_ID,
      awaitingChoice: mockCard.effect?.payload, // Simulate awaiting a choice from the card
      playerSnapshots: {
        [PLAYER_ID]: {
          spaceName: 'SPACE-WITH-CHOICE',
          gameState: { // Minimal game state for snapshot
            players: [initialPlayerState],
            currentPlayerId: PLAYER_ID,
            awaitingChoice: null,
            isMoving: false,
          } as any,
        },
      },
    };
    gameServices.stateService.getGameState.mockReturnValue(initialGameState);
    gameServices.turnService.tryAgainOnSpace = vi.fn().mockResolvedValue(undefined);
    gameServices.stateService.restorePlayerSnapshot.mockImplementation((id: string) => {
      // Simulate state restoration
      gameServices.stateService.getGameState.mockReturnValue({
        ...initialGameState,
        awaitingChoice: mockCard.effect?.payload, // Choice should reappear
      });
      gameServices.stateService.getPlayer.mockReturnValue({
        ...initialPlayerState,
        currentCard: 'card1', // Card should reappear
      });
      return undefined;
    });


    render(<PlayerPanel gameServices={gameServices} playerId={PLAYER_ID} onTryAgain={gameServices.turnService.tryAgainOnSpace} />);

    // Initially, choices should be visible
    const acceptButton = screen.getByText('Accept');
    expect(acceptButton).toBeInTheDocument();
    const negotiateButton = screen.getByText('Negotiate');
    expect(negotiateButton).toBeInTheDocument();

    // Simulate making a choice
    fireEvent.click(acceptButton);
    await waitFor(() => {
      // After making a choice, choices should disappear (or be replaced by loading state)
      // and then disappear once resolved, indicating action was taken.
      // Assuming choice resolution clears awaitingChoice and thus removes the buttons
      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
      expect(screen.queryByText('Negotiate')).not.toBeInTheDocument();
    });

    // Click "Try Again" button
    const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(tryAgainButton);

    await waitFor(() => {
      // After "Try Again", original choices should reappear
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Negotiate')).toBeInTheDocument();
      expect(gameServices.turnService.tryAgainOnSpace).toHaveBeenCalledTimes(1);
      expect(gameServices.turnService.tryAgainOnSpace).toHaveBeenCalledWith(PLAYER_ID);
    });
  });
});