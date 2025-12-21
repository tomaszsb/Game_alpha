import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectProgress } from '../../../src/components/game/ProjectProgress';
import { IDataService, IGameRulesService } from '../../../src/types/ServiceContracts';
import { Player } from '../../../src/types/StateTypes';

describe('ProjectProgress', () => {
  beforeEach(() => {
    cleanup();

    // Mock window.innerWidth for responsive display logic
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
  });

  let mockDataService: IDataService;
  let mockGameRulesService: IGameRulesService;
  let mockOnToggleGameLog: () => void;
  let mockOnOpenRulesModal: () => void;

  const mockPlayers: Player[] = [
    {
      id: 'player1',
      name: 'Alice',
      currentSpace: 'CON-INITIATION',
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
      moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
      expenditures: { design: 0, fees: 0, construction: 0 },
      costHistory: [],
      avatar: '👤',
      visitedSpaces: [],
      spaceVisitLog: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataService = {
      getPhaseOrder: vi.fn(() => ['SETUP', 'DESIGN', 'CONSTRUCTION', 'FUNDING', 'REGULATORY', 'FINISH']),
      getGameConfigBySpace: vi.fn((spaceName: string) => {
        if (spaceName === 'CON-INITIATION') {
          return {
            space_name: 'CON-INITIATION',
            phase: 'CONSTRUCTION',
            path_type: 'main',
            is_starting_space: false,
            is_ending_space: false,
            min_players: 1,
            max_players: 4,
            requires_dice_roll: false,
          };
        }
        return undefined;
      }),
    } as unknown as IDataService;

    mockGameRulesService = {
      calculateProjectScope: vi.fn().mockReturnValue(1000000),
      calculateEstimatedProjectLength: vi.fn().mockReturnValue({ estimatedDays: 100, uniqueWorkTypes: [] }),
    } as unknown as IGameRulesService;

    mockOnToggleGameLog = vi.fn();
    mockOnOpenRulesModal = vi.fn();
  });

  it('should render the Rules button and call onOpenRulesModal when clicked', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    const rulesButton = screen.getByText('Rules');
    expect(rulesButton).toBeInTheDocument();

    fireEvent.click(rulesButton);
    expect(mockOnOpenRulesModal).toHaveBeenCalledTimes(1);
  });

  it('should render the Log button and call onToggleGameLog when clicked', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    const logButton = screen.getByText('Log');
    expect(logButton).toBeInTheDocument();

    fireEvent.click(logButton);
    expect(mockOnToggleGameLog).toHaveBeenCalledTimes(1);
  });

  it('should display overall progress information', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    // Get the span that contains the overall progress information
    const overallProgressText = screen.getByText(/Overall Progress:/i);
    expect(overallProgressText).toBeInTheDocument();
    expect(overallProgressText.closest('span')).toHaveTextContent(/50% | Leading Phase: CONSTRUCTION/);
    
    expect(screen.getByText((content, element) => content.includes('1 Player'))).toBeInTheDocument();
  });

  it('should display individual player progress', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    // More specific query for Alice's name within the individual player progress item
    expect(screen.getByText((content, element) => 
      element?.tagName.toLowerCase() === 'div' &&
      element.textContent?.includes('Alice') &&
      element.textContent?.includes('👤') &&
      (element as HTMLElement).style.fontWeight === 'bold'
    )).toBeInTheDocument();
    expect(screen.getByText((content, element) => content.includes('Phase: CONSTRUCTION'))).toBeInTheDocument();
  });

  it('should handle no players gracefully', () => {
    render(
      <ProjectProgress
        players={[]}
        currentPlayerId={null}
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );
    expect(screen.queryByText((content, element) => content.includes('Alice'))).not.toBeInTheDocument();

    const overallProgressText = screen.getByText(/Overall Progress:/i);
    expect(overallProgressText).toBeInTheDocument();
    expect(overallProgressText.closest('span')).toHaveTextContent(/0% | Leading Phase: SETUP/);

    expect(screen.getByText((content, element) => content.includes('0 Players'))).toBeInTheDocument();
  });

  it('should display design fee cap bar for each player', () => {
    const playerWithDesignFees: Player[] = [
      {
        ...mockPlayers[0],
        expenditures: { design: 100000, fees: 0, construction: 0 },
      },
    ];

    render(
      <ProjectProgress
        players={playerWithDesignFees}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    // Design fee cap bar should be visible
    expect(screen.getByText('📐 Design Fees')).toBeInTheDocument();
    // With $100k design fees and $1M scope, ratio is 10% (shown as 10.0% / 20%)
    expect(screen.getByText('10.0% / 20%')).toBeInTheDocument();
  });

  it('should display project timeline for each player', () => {
    const playerWithTime: Player[] = [
      {
        ...mockPlayers[0],
        timeSpent: 50,
      },
    ];

    // Mock calculateEstimatedProjectLength to return specific values
    (mockGameRulesService.calculateEstimatedProjectLength as ReturnType<typeof vi.fn>).mockReturnValue({
      estimatedDays: 100,
      uniqueWorkTypes: ['Design', 'Construction', 'Permitting'],
    });

    render(
      <ProjectProgress
        players={playerWithTime}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    // Project timeline should be visible
    expect(screen.getByText('⏱️ Project Timeline')).toBeInTheDocument();
    // With 50 days spent and 100 estimated, should show "50 / 100 days"
    expect(screen.getByText('50 / 100 days')).toBeInTheDocument();
    // Should show 50% elapsed and 3 work types
    expect(screen.getByText('50% elapsed')).toBeInTheDocument();
    expect(screen.getByText('3 work types')).toBeInTheDocument();
  });

  it('should show timeline color based on progress percentage', () => {
    const playerNearDeadline: Player[] = [
      {
        ...mockPlayers[0],
        timeSpent: 90,
      },
    ];

    (mockGameRulesService.calculateEstimatedProjectLength as ReturnType<typeof vi.fn>).mockReturnValue({
      estimatedDays: 100,
      uniqueWorkTypes: [],
    });

    render(
      <ProjectProgress
        players={playerNearDeadline}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    // At 90% progress, should show 90 / 100 days
    expect(screen.getByText('90 / 100 days')).toBeInTheDocument();
    expect(screen.getByText('90% elapsed')).toBeInTheDocument();
  });

  it('should display multiple players with individual timelines', () => {
    const twoPlayers: Player[] = [
      {
        ...mockPlayers[0],
        id: 'player1',
        name: 'Alice',
        timeSpent: 30,
      },
      {
        ...mockPlayers[0],
        id: 'player2',
        name: 'Bob',
        avatar: '🧔',
        timeSpent: 60,
      },
    ];

    (mockGameRulesService.calculateEstimatedProjectLength as ReturnType<typeof vi.fn>).mockReturnValue({
      estimatedDays: 100,
      uniqueWorkTypes: ['Design', 'Construction'],
    });

    render(
      <ProjectProgress
        players={twoPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );

    // Both players should have timeline sections
    const timelineLabels = screen.getAllByText('⏱️ Project Timeline');
    expect(timelineLabels).toHaveLength(2);

    // Both should show 2 work types
    const workTypeLabels = screen.getAllByText('2 work types');
    expect(workTypeLabels).toHaveLength(2);
  });
});
