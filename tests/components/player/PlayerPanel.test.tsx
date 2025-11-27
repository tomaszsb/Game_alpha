/**
 * PlayerPanel.test.tsx
 *
 * Test suite for the PlayerPanel component, focusing on the movement choice functionality
 * that was previously part of TurnControlsWithActions.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerPanel } from '../../../src/components/player/PlayerPanel';
import { GameContext } from '../../../src/context/GameContext';
import { GamePhase, Player } from '../../../src/types/StateTypes';
import { Choice } from '../../../src/types/CommonTypes';
import { createAllMockServices } from '../../mocks/mockServices';

describe('PlayerPanel', () => {
  let mockServices: any;
  let mockPlayer: Player;
  let mockGameState: any;

  beforeEach(() => {
    mockServices = createAllMockServices();

    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'START',
      visitType: 'First',
      money: 1000,
      timeSpent: 0,
      projectScope: 0,
      score: 0,
      color: '#ff0000',
      avatar: '🚀',
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: [],
    };

    mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as GamePhase,
      awaitingChoice: null,
    };

    // Configure mock stateService to return our game state
    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(mockGameState);
      return vi.fn(); // Return unsubscribe function
    });
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceEffects.mockReturnValue([]);
  });

  it('should display movement choice buttons when a MOVEMENT choice is active', () => {
    // Arrange: Set up a MOVEMENT choice in the game state
    const movementChoice: Choice = {
      id: 'movement-choice-456',
      type: 'MOVEMENT',
      playerId: 'player1',
      prompt: 'Choose your next move!',
      options: [
        { id: 'TECH-INCUBATOR', label: 'Tech Incubator' },
        { id: 'COFFEE-SHOP', label: 'Coffee Shop' },
      ],
    };
    mockGameState.awaitingChoice = movementChoice;

    // Act: Render the PlayerPanel
    render(
      <GameContext.Provider value={mockServices}>
        <PlayerPanel gameServices={mockServices} playerId="player1" />
      </GameContext.Provider>
    );

    // Assert: Verify that the movement choice UI is rendered
    expect(screen.getByText('🚶 Choose Your Destination')).toBeInTheDocument();
    expect(screen.getByText('🎯 Tech Incubator')).toBeInTheDocument();
    expect(screen.getByText('🎯 Coffee Shop')).toBeInTheDocument();
  });

  it('should call choiceService.resolveChoice when a movement button is clicked', () => {
    // Arrange: Set up a MOVEMENT choice
    const movementChoice: Choice = {
      id: 'movement-choice-789',
      type: 'MOVEMENT',
      playerId: 'player1',
      prompt: 'Where to next?',
      options: [{ id: 'UNIVERSITY', label: 'University' }],
    };
    mockGameState.awaitingChoice = movementChoice;

    render(
      <GameContext.Provider value={mockServices}>
        <PlayerPanel gameServices={mockServices} playerId="player1" />
      </GameContext.Provider>
    );

    // Act: Click the movement button
    const universityButton = screen.getByText('🎯 University');
    fireEvent.click(universityButton);

    // Assert: Verify that resolveChoice was called with the correct parameters
    expect(mockServices.choiceService.resolveChoice).toHaveBeenCalledWith(
      'movement-choice-789',
      'UNIVERSITY'
    );
  });

  it('should highlight the selected destination button', () => {
    // Arrange: Set up a MOVEMENT choice and a pre-existing moveIntent
    const movementChoice: Choice = {
        id: 'movement-choice-101',
        type: 'MOVEMENT',
        playerId: 'player1',
        prompt: 'Select your destination',
        options: [
            { id: 'ACCELERATOR', label: 'Accelerator' },
            { id: 'HACKERSPACE', label: 'Hackerspace' },
        ],
    };
    mockGameState.awaitingChoice = movementChoice;
    mockPlayer.moveIntent = 'ACCELERATOR'; // Pre-select a destination

    render(
      <GameContext.Provider value={mockServices}>
        <PlayerPanel gameServices={mockServices} playerId="player1" />
      </GameContext.Provider>
    );

    // Assert: The pre-selected button should be highlighted
    const acceleratorButton = screen.getByText('✅ Accelerator');
    expect(acceleratorButton).toBeInTheDocument();

    // The other button should not be highlighted
    const hackerspaceButton = screen.getByText('🎯 Hackerspace');
    expect(hackerspaceButton).toBeInTheDocument();
  });
});
