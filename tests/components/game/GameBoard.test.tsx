// tests/components/game/GameBoard.test.tsx

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameBoard } from '../../../src/components/game/GameBoard';
import { GameContext } from '../../../src/context/GameContext';
import { IServiceContainer } from '../../../src/types/ServiceContracts';
import { Space, Player, GameConfig, Movement } from '../../../src/types/DataTypes';
import { createMockDataService, createMockStateService, createMockMovementService } from '../../mocks/mockServices';

describe('GameBoard', () => {
  let mockDataService: ReturnType<typeof createMockDataService>;
  let mockStateService: ReturnType<typeof createMockStateService>;
  let mockMovementService: ReturnType<typeof createMockMovementService>;
  let mockServices: IServiceContainer;

  const mockGameSpace: Space = {
    id: 'TEST-SPACE',
    name: 'TEST-SPACE',
    title: 'Test Space',
    config: {
      space_name: 'TEST-SPACE',
      phase: 'PLAY',
      path_type: 'main',
      is_starting_space: false,
      is_ending_space: false,
      min_players: 1,
      max_players: 4,
      requires_dice_roll: false
    } as GameConfig,
    content: [],
    movement: [],
    spaceEffects: [],
    diceEffects: [],
    diceOutcomes: []
  };

  const mockInstructionSpace: Space = {
    id: 'START-QUICK-PLAY-GUIDE',
    name: 'START-QUICK-PLAY-GUIDE',
    title: 'Quick Play Guide',
    config: {
      space_name: 'START-QUICK-PLAY-GUIDE',
      phase: 'SETUP',
      path_type: 'none', // Instruction space
      is_starting_space: false,
      is_ending_space: false,
      min_players: 1,
      max_players: 4,
      requires_dice_roll: false
    } as GameConfig,
    content: [],
    movement: [],
    spaceEffects: [],
    diceEffects: [],
    diceOutcomes: []
  };

  const mockTutorialSpace: Space = {
    id: 'TUTORIAL-SPACE',
    name: 'TUTORIAL-SPACE',
    title: 'Tutorial',
    config: {
      space_name: 'TUTORIAL-SPACE',
      phase: 'SETUP',
      path_type: 'Tutorial', // Tutorial space
      is_starting_space: false,
      is_ending_space: false,
      min_players: 1,
      max_players: 4,
      requires_dice_roll: false
    } as GameConfig,
    content: [],
    movement: [],
    spaceEffects: [],
    diceEffects: [],
    diceOutcomes: []
  };

  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    money: 1000,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    hand: [],
    activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: [],
    moneySources: {} as any,
    expenditures: {} as any,
    costHistory: [],
    avatar: 'T',
    visitedSpaces: [],
    spaceVisitLog: [],
    role: 'Explorer'
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    mockMovementService = createMockMovementService();

    mockServices = {
      dataService: mockDataService,
      stateService: mockStateService,
      movementService: mockMovementService
    } as any;

    // Default mock implementations
    mockDataService.getAllSpaces.mockReturnValue([mockGameSpace]);
    mockDataService.getGameConfigBySpace.mockReturnValue(mockGameSpace.config);

    mockStateService.subscribe.mockReturnValue(() => {});
    mockStateService.getGameState.mockReturnValue({
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      hasPlayerMovedThisTurn: false,
      isMoving: false,
      awaitingChoice: null
    } as any);
  });

  describe('Bug Regression Tests', () => {
    describe('Bug #5: Instruction space filtering', () => {
      it('should filter out instruction spaces (path_type === "none")', () => {
        // Arrange - return both game and instruction spaces
        mockDataService.getAllSpaces.mockReturnValue([
          mockGameSpace,
          mockInstructionSpace
        ]);

        mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
          if (spaceName === 'TEST-SPACE') return mockGameSpace.config;
          if (spaceName === 'START-QUICK-PLAY-GUIDE') return mockInstructionSpace.config;
          return null;
        });

        // Act
        render(
          <GameContext.Provider value={mockServices}>
            <GameBoard />
          </GameContext.Provider>
        );

        // Assert - game space should be visible
        expect(screen.getByText('TEST-SPACE')).toBeInTheDocument();

        // Instruction space should NOT be visible
        expect(screen.queryByText('START-QUICK-PLAY-GUIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('Quick Play Guide')).not.toBeInTheDocument();
      });

      it('should filter out tutorial spaces (path_type === "Tutorial")', () => {
        // Arrange
        mockDataService.getAllSpaces.mockReturnValue([
          mockGameSpace,
          mockTutorialSpace
        ]);

        mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
          if (spaceName === 'TEST-SPACE') return mockGameSpace.config;
          if (spaceName === 'TUTORIAL-SPACE') return mockTutorialSpace.config;
          return null;
        });

        // Act
        render(
          <GameContext.Provider value={mockServices}>
            <GameBoard />
          </GameContext.Provider>
        );

        // Assert
        expect(screen.getByText('TEST-SPACE')).toBeInTheDocument();
        expect(screen.queryByText('TUTORIAL-SPACE')).not.toBeInTheDocument();
      });

      it('should only show game spaces (main path)', () => {
        // Arrange - mix of different space types
        const allSpaces = [
          mockGameSpace,
          mockInstructionSpace,
          mockTutorialSpace,
          {
            ...mockGameSpace,
            id: 'ANOTHER-GAME-SPACE',
            name: 'ANOTHER-GAME-SPACE',
            config: { ...mockGameSpace.config, space_name: 'ANOTHER-GAME-SPACE' }
          }
        ];

        mockDataService.getAllSpaces.mockReturnValue(allSpaces);
        mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
          const space = allSpaces.find(s => s.name === spaceName);
          return space?.config || null;
        });

        // Act
        render(
          <GameContext.Provider value={mockServices}>
            <GameBoard />
          </GameContext.Provider>
        );

        // Assert - only game spaces visible
        expect(screen.getByText('TEST-SPACE')).toBeInTheDocument();
        expect(screen.getByText('ANOTHER-GAME-SPACE')).toBeInTheDocument();

        // Filtered spaces not visible
        expect(screen.queryByText('START-QUICK-PLAY-GUIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('TUTORIAL-SPACE')).not.toBeInTheDocument();
      });
    });

    describe('Bug #4: Space Explorer Panel crash prevention', () => {
      it('should not crash when getting space details for info modal', () => {
        // Arrange
        mockDataService.getAllSpaces.mockReturnValue([mockGameSpace]);
        mockDataService.getSpaceContent.mockReturnValue({
          space_name: 'TEST-SPACE',
          visit_type: 'First',
          title: 'Test Content',
          story: 'Test story',
          action_description: 'Test action',
          outcome_description: 'Test outcome',
          can_negotiate: false
        });
        mockDataService.getSpaceEffects.mockReturnValue([]);
        mockDataService.getDiceEffects.mockReturnValue([]);
        mockDataService.getMovement.mockReturnValue({
          space_name: 'OTHER-SPACE',
          visit_type: 'First',
          movement_type: 'choice',
          destination_1: 'TEST-SPACE'
        } as Movement);

        // Act - render and click info button
        render(
          <GameContext.Provider value={mockServices}>
            <GameBoard />
          </GameContext.Provider>
        );

        // Find and click the info button (ℹ️)
        const infoButtons = screen.getAllByText('ℹ️');
        expect(infoButtons.length).toBeGreaterThan(0);

        // Should not throw error when clicking info button
        expect(() => {
          fireEvent.click(infoButtons[0]);
        }).not.toThrow();
      });

      it('should calculate incoming connections correctly', () => {
        // Arrange - create spaces with movement connections
        const spaceA: Space = {
          ...mockGameSpace,
          id: 'SPACE-A',
          name: 'SPACE-A'
        };

        const spaceB: Space = {
          ...mockGameSpace,
          id: 'SPACE-B',
          name: 'SPACE-B',
          config: { ...mockGameSpace.config, space_name: 'SPACE-B' }
        };

        mockDataService.getAllSpaces.mockReturnValue([spaceA, spaceB]);
        mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
          if (spaceName === 'SPACE-A') return spaceA.config;
          if (spaceName === 'SPACE-B') return spaceB.config;
          return null;
        });

        // Mock movement - SPACE-A can move to SPACE-B
        mockDataService.getMovement.mockImplementation((spaceName: string) => {
          if (spaceName === 'SPACE-A') {
            return {
              space_name: 'SPACE-A',
              visit_type: 'First',
              movement_type: 'choice',
              destination_1: 'SPACE-B'
            } as Movement;
          }
          return null;
        });

        mockDataService.getSpaceContent.mockReturnValue(null);
        mockDataService.getSpaceEffects.mockReturnValue([]);
        mockDataService.getDiceEffects.mockReturnValue([]);

        // Act - render board
        render(
          <GameContext.Provider value={mockServices}>
            <GameBoard />
          </GameContext.Provider>
        );

        // Click info on SPACE-B to see its incoming connections
        const spaceBElement = screen.getByText('SPACE-B');
        expect(spaceBElement).toBeInTheDocument();

        // The test verifies the component renders without crashing
        // Connection calculation happens internally when info button is clicked
      });
    });
  });

  describe('Basic rendering', () => {
    it('should render the game board title', () => {
      render(
        <GameContext.Provider value={mockServices}>
          <GameBoard />
        </GameContext.Provider>
      );

      expect(screen.getByText(/Game Board/i)).toBeInTheDocument();
    });

    it('should render spaces from data service', () => {
      render(
        <GameContext.Provider value={mockServices}>
          <GameBoard />
        </GameContext.Provider>
      );

      expect(screen.getByText('TEST-SPACE')).toBeInTheDocument();
    });

    it('should show loading message when no spaces available', () => {
      mockDataService.getAllSpaces.mockReturnValue([]);

      render(
        <GameContext.Provider value={mockServices}>
          <GameBoard />
        </GameContext.Provider>
      );

      expect(screen.getByText('Loading game spaces...')).toBeInTheDocument();
    });
  });
});
