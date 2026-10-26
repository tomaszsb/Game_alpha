/**
 * ChoiceModal.test.tsx
 *
 * Test suite for ChoiceModal component to verify NotificationService integration
 * for generic choice actions and notification behavior.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChoiceModal } from '../../src/components/modals/ChoiceModal';
import { GameContext } from '../../src/context/GameContext';
import { GamePhase, Player } from '../../src/types/StateTypes';
import { Choice } from '../../src/types/CommonTypes';
import { createAllMockServices } from '../mocks/mockServices';
import { DictionaryProvider } from '../../src/dictionary';

describe('ChoiceModal', () => {
  beforeEach(() => {
    cleanup();
  });

  let mockServices: any;
  let mockPlayer: any;
  let mockGameState: any;

  beforeEach(() => {
    mockServices = createAllMockServices();

    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
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

    // Mock game state with a non-movement choice active
    mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as GamePhase,
      turn: 1,
      awaitingChoice: {
        id: 'card-choice-456',
        type: 'CARD_EFFECT',
        playerId: 'player1',
        prompt: 'Choose your card effect',
        options: [
          { id: 'option1', label: 'Draw 2 Work Cards' },
          { id: 'option2', label: 'Gain $1000' },
          { id: 'option3', label: 'Skip Time Penalty' }
        ]
      } as any,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: true,
      hasCompletedManualActions: false,
      requiredActions: 1,
      completedActions: 0
    };

    // Configure mock stateService to return our game state
    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(mockGameState);
      return vi.fn(); // Return unsubscribe function
    });
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
  });

  it('should call notificationService.notify when choice button is clicked', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal is displayed with the correct content
    expect(screen.getByTestId('choice-modal')).toBeInTheDocument();
    expect(screen.getByText(/Choose your card effect/)).toBeInTheDocument();

    // Find and verify choice buttons are displayed
    const drawCardsButton = screen.getByText('Draw 2 Work Cards');
    const gainMoneyButton = screen.getByText('Gain $1000');
    const skipPenaltyButton = screen.getByText('Skip Time Penalty');

    expect(drawCardsButton).toBeInTheDocument();
    expect(gainMoneyButton).toBeInTheDocument();
    expect(skipPenaltyButton).toBeInTheDocument();

    // Click the first choice button
    fireEvent.click(drawCardsButton);

    // Assert that notificationService.notify was called
    expect(mockServices.notificationService.notify).toHaveBeenCalledTimes(1);

    // Assert that it was called with the correct arguments
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: '✓',
        medium: '✅ Choice Made complete',
        detailed: 'Test Player successfully completed Choice Made: Selected: Draw 2 Work Cards'
      },
      {
        playerId: 'player1',
        playerName: 'Test Player',
        actionType: 'choice_card-choice-456'
      }
    );

    // Verify choiceService.resolveChoice was also called
    expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
      'card-choice-456',
      'option1'
    );
  });

  it('should not render modal when no choice is awaiting', () => {
    // Update mock state to have no awaiting choice
    const stateWithoutChoice = {
      ...mockGameState,
      awaitingChoice: null
    };

    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(stateWithoutChoice);
      return vi.fn();
    });
    mockServices.stateService.getGameState.mockReturnValue(stateWithoutChoice);

    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal is not rendered
    expect(screen.queryByText('🎯 Make Your Choice')).not.toBeInTheDocument();
  });

  it('should not render modal for MOVEMENT type choices', () => {
    // Update mock state to have a MOVEMENT choice (should be handled by TurnControls)
    const stateWithMovementChoice = {
      ...mockGameState,
      awaitingChoice: {
        id: 'movement-choice-789',
        type: 'MOVEMENT',
        playerId: 'player1',
        prompt: 'Choose your destination',
        options: [
          { id: 'MARKET-RESEARCH', label: 'Market Research' },
          { id: 'CUSTOMER-DISCOVERY', label: 'Customer Discovery' }
        ]
      } as any
    };

    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(stateWithMovementChoice);
      return vi.fn();
    });
    mockServices.stateService.getGameState.mockReturnValue(stateWithMovementChoice);

    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal is not rendered for movement choices
    expect(screen.queryByText('🎯 Make Your Choice')).not.toBeInTheDocument();
  });

  it('should display correct player name and prompt in modal header', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Verify the modal header displays the correct player name and prompt
    expect(screen.getByTestId('choice-modal')).toBeInTheDocument();
    expect(screen.getByText(/Choose your card effect/)).toBeInTheDocument();
  });

  it('should apply ModalConfig overrides for title, help text, and first button label', () => {
    // Arrange: dataService returns a modal config for this space/action
    mockServices.dataService.getModalConfig.mockImplementation(
      (spaceName: string, visitType: string, effectAction: string) => {
        if (spaceName === 'TEST-SPACE' && visitType === 'First' && effectAction === 'choice') {
          return {
            modal_title: 'Decide, {playerName}!',
            modal_description: 'Weigh your options carefully at {spaceName}.',
            modal_button_label: 'Commit',
            modal_summary: undefined
          };
        }
        return undefined;
      }
    );

    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Custom title is interpolated with playerName
    expect(screen.getByText('Decide, Test Player!')).toBeInTheDocument();
    // Custom help text is interpolated with spaceName
    expect(screen.getByText(/Weigh your options carefully at TEST-SPACE/)).toBeInTheDocument();
    // First button uses the custom label; later buttons retain their original labels
    expect(screen.getByText('Commit')).toBeInTheDocument();
    expect(screen.getByText('Gain $1000')).toBeInTheDocument();
    // Default help text is replaced
    expect(screen.queryByText(/Make your selection to continue/)).not.toBeInTheDocument();
  });

  it('should fall back to hardcoded defaults when no ModalConfig is configured', () => {
    mockServices.dataService.getModalConfig.mockReturnValue(undefined);

    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Default title and help text are present
    expect(screen.getByText(/Make Your Choice/)).toBeInTheDocument();
    expect(screen.getByText(/Make your selection to continue/)).toBeInTheDocument();
    // Original option label unchanged
    expect(screen.getByText('Draw 2 Work Cards')).toBeInTheDocument();
  });

  it('should call notification for different choice options with correct labels', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <ChoiceModal />
      </GameContext.Provider>
    );

    // Click the second choice button (Gain $1000)
    const gainMoneyButton = screen.getByText('Gain $1000');
    fireEvent.click(gainMoneyButton);

    // Assert that notificationService.notify was called with the correct label
    expect(mockServices.notificationService.notify).toHaveBeenCalledWith(
      {
        short: '✓',
        medium: '✅ Choice Made complete',
        detailed: 'Test Player successfully completed Choice Made: Selected: Gain $1000'
      },
      {
        playerId: 'player1',
        playerName: 'Test Player',
        actionType: 'choice_card-choice-456'
      }
    );

    // Verify choiceService.resolveChoice was called with the correct option ID
    expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
      'card-choice-456',
      'option2'
    );
  });

  // fb:44751a06 — a card-replacement/selection/give choice shows the acting
  // player's exact hand contents (private). A shared/host view (viewerId
  // undefined) must not leak that picker when the acting player has their
  // own phone (deviceType 'mobile') to answer on — but must still show it
  // there for a pass-and-play player with no separate device.
  describe('card-choice privacy gating', () => {
    const buildCardChoiceState = (playerDeviceType: 'mobile' | 'desktop' | undefined) => ({
      ...mockGameState,
      players: [{ ...mockPlayer, deviceType: playerDeviceType }],
      awaitingChoice: {
        id: 'card-replace-1',
        type: 'CARD_REPLACEMENT',
        playerId: 'player1',
        prompt: 'Choose a card to replace',
        options: [{ id: 'E001', label: 'Expeditor Card' }],
        metadata: { replaceCount: 1 },
      } as any,
    });

    const renderWithState = (state: any, viewerId?: string) => {
      mockServices.stateService.subscribe.mockImplementation((callback: any) => {
        callback(state);
        return vi.fn();
      });
      mockServices.stateService.getGameState.mockReturnValue(state);
      render(
        <GameContext.Provider value={mockServices}>
          <ChoiceModal viewerId={viewerId} />
        </GameContext.Provider>
      );
    };

    it('suppresses the card picker on a shared/host view (no viewerId) when the acting player has their own phone', () => {
      renderWithState(buildCardChoiceState('mobile'));

      expect(screen.queryByTestId('card-replacement-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('choice-modal')).not.toBeInTheDocument();
    });

    it('still shows the card picker on a shared view when the acting player has no separate device (pass-and-play)', () => {
      renderWithState(buildCardChoiceState(undefined));

      expect(screen.getByTestId('card-replacement-modal')).toBeInTheDocument();
    });

    it('still shows the card picker on a shared view when the acting player is a desktop-only participant', () => {
      renderWithState(buildCardChoiceState('desktop'));

      expect(screen.getByTestId('card-replacement-modal')).toBeInTheDocument();
    });

    it('still shows the card picker on the acting player\'s own phone (viewerId matches)', () => {
      renderWithState(buildCardChoiceState('mobile'), 'player1');

      expect(screen.getByTestId('card-replacement-modal')).toBeInTheDocument();
    });

    it('suppresses the card picker on a different player\'s phone (pre-existing L003/L048 fan-out gate)', () => {
      renderWithState(buildCardChoiceState('mobile'), 'someOtherPlayerId');

      expect(screen.queryByTestId('card-replacement-modal')).not.toBeInTheDocument();
    });
  });
});

describe("ChoiceModal - the filing rep's pop-ups", () => {
  function renderChoice(choice: any) {
    cleanup();
    const services: any = createAllMockServices();
    const player = { id: "player1", name: "Test Player", currentSpace: "ARCH-INITIATION", visitType: "Subsequent", money: 1000, timeSpent: 5, projectScope: 0, score: 0, color: "#007bff", avatar: "P", hand: [], activeCards: [], turnModifiers: { skipTurns: 0 }, activeEffects: [], loans: [] };
    const state: any = { players: [player], currentPlayerId: "player1", gamePhase: "PLAY", turn: 1, awaitingChoice: choice, hasPlayerMovedThisTurn: false, hasPlayerRolledDice: true, hasCompletedManualActions: false, requiredActions: 1, completedActions: 0 };
    services.stateService.subscribe.mockImplementation((callback: any) => { callback(state); return vi.fn(); });
    services.stateService.getGameState.mockReturnValue(state);
    render(
      <DictionaryProvider>
        <GameContext.Provider value={services}>
          <ChoiceModal />
        </GameContext.Provider>
      </DictionaryProvider>
    );
    return services;
  }

  it("shows a greyed option with its hint, and a click on it does nothing", () => {
    const services = renderChoice({
      id: "offer-1", type: "GENERAL", playerId: "player1", prompt: "Go round again?",
      metadata: { kind: "autorun_offer", title: "Go round again?" },
      options: [
        { id: "hand", label: "Play it yourself" },
        { id: "rep", label: "Send your filing rep", disabled: true, hint: "Needs a filing rep" },
      ],
    });
    expect(screen.getByText("Needs a filing rep")).toBeInTheDocument();
    const grey = screen.getByText("Send your filing rep").closest("button") as HTMLButtonElement;
    expect(grey.disabled).toBe(true);
    fireEvent.click(grey);
    expect(services.choiceService.resolveChoice).not.toHaveBeenCalled();
    const live = screen.getByText("Play it yourself").closest("button") as HTMLButtonElement;
    expect(live.disabled).toBe(false);
    fireEvent.click(live);
    expect(services.choiceService.resolveChoice).toHaveBeenCalledWith("offer-1", "hand");
  });

  it("the run's report is one scrolling box of lines with an OK button, and no other buttons", () => {
    renderChoice({
      id: "report-1", type: "GENERAL", playerId: "player1", prompt: "Your rep went round.",
      metadata: { kind: "autorun_report", title: "The round, done", lines: [
        { label: "Find an Architect", text: "rolled 2 and 5, kept the 2, +2 days" },
        { label: "Total so far", text: "+215 days, -$60,900" },
      ] },
      options: [{ id: "ok", label: "OK" }],
    });
    const box = screen.getByTestId("autorun-report");
    expect(box).toHaveTextContent("Find an Architect");
    expect(box).toHaveTextContent("+215 days, -$60,900");
    expect(getComputedStyle(box).overflowY).toBe("auto");
    expect(screen.getByText("The round, done")).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter(b => b.textContent === "OK").length).toBe(1);
  });

  // fb:52afd411: the architect's "remove one" used the plain choice pop-up while the bank's swap used
  // the card pop-up. A removal now opens the card pop-up too, listing only the cards the game offers.
  it('opens the card pop-up for a forced removal, with only the offered cards', () => {
    const services: any = createAllMockServices();
    const removalState = {
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as GamePhase,
      turn: 1,
      players: [{ id: 'player1', name: 'Test Player', currentSpace: 'TEST-SPACE', visitType: 'First', money: 1000, timeSpent: 5,
        hand: ['W001', 'W002', 'W003', 'E001'], activeCards: [], activeEffects: [], loans: [] }],
      awaitingChoice: {
        id: 'discard-1',
        type: 'CARD_DISCARD',
        playerId: 'player1',
        prompt: 'Choose 1 Work Package to remove:',
        options: [
          { id: 'W001', label: 'Smart grid ($500K)' },
          { id: 'W002', label: 'Green roof ($750K)' },
        ],
      },
    };
    services.stateService.subscribe.mockImplementation((callback: any) => {
      callback(removalState);
      return vi.fn();
    });
    services.stateService.getGameState.mockReturnValue(removalState);
    services.dataService.getCardById.mockImplementation((id: string) => ({ card_id: id, card_name: `Card ${id}`, card_type: id.charAt(0), cost: 0 }));

    render(
      <DictionaryProvider>
        <GameContext.Provider value={services}>
          <ChoiceModal />
        </GameContext.Provider>
      </DictionaryProvider>
    );

    expect(screen.getByTestId('card-replacement-modal')).toBeInTheDocument();
    expect(screen.queryByText('Make Your Choice')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('card-replacement-pick')).toHaveLength(2);
  });
});
