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

  const mockPlayers: any[] = [
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
      getSpaceContent: vi.fn((spaceName: string, visitType: string) => ({
        title: `${spaceName} Title`,
        story: 'Test story content',
        hint: 'Test hint'
      })),
      getDisplayLabelOverride: vi.fn(() => ''),
      // computeProjectFinances (used by the 2026-07-26 funding-chip redesign)
      // calls this for every card in a player's hand/activeCards; test
      // players carry no cards, so it's never actually invoked, but a
      // real IDataService always has it — keep the mock honest.
      getCardById: vi.fn(() => undefined),
    } as unknown as IDataService;

    mockGameRulesService = {
      calculateProjectScope: vi.fn().mockReturnValue(1000000),
      calculateEstimatedProjectLength: vi.fn().mockReturnValue({ estimatedDays: 110, contingencyDays: 10, uniqueWorkTypes: [] }),
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

    // Compact format: "50% | CONSTRUCTION" — may appear in both summary and player detail
    expect(screen.getAllByText(/50%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText((content) => content.includes('1 Player'))).toBeInTheDocument();
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

    // More specific query for Alice's name within the individual player progress item.
    // Avatar is now a real generated portrait image (AvatarIcons.tsx, via
    // PlayerAvatar's title={player.name}), not the raw emoji character, so
    // it's located by that title rather than by matching the '👤' glyph in
    // textContent.
    const avatarEl = screen.getByTitle('Alice');
    expect(avatarEl.querySelector('img')).toBeInTheDocument();
    const nameContainer = avatarEl.closest('div');
    expect(nameContainer?.textContent).toContain('Alice');
    expect((nameContainer as HTMLElement)?.style.fontWeight).toBe('bold');
    expect(screen.getAllByText((content) => content === 'CONSTRUCTION').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.queryByText((content) => content.includes('Alice'))).not.toBeInTheDocument();

    // Compact format: "0% | SETUP"
    expect(screen.getByText(/0%/)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('0 Players'))).toBeInTheDocument();
  });

  it('should display design fee ratio for each player', () => {
    const playerWithDesignFees: any[] = [
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

    // Compact chip format (redesigned 2026-07-26): "📐 10%"
    expect(screen.getByText(/📐 10%/)).toBeInTheDocument();
  });

  it('should display project timeline for each player', () => {
    const playerWithTime: any[] = [
      {
        ...mockPlayers[0],
        timeSpent: 50,
      },
    ];

    (mockGameRulesService.calculateEstimatedProjectLength as ReturnType<typeof vi.fn>).mockReturnValue({
      estimatedDays: 110,
      contingencyDays: 10,
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

    // Compact chip format (redesigned 2026-07-26): "⏱️ 50/110d"
    expect(screen.getByText(/⏱️ 50\/110d/)).toBeInTheDocument();
  });

  it('should show timeline color based on progress percentage', () => {
    const playerNearDeadline: any[] = [
      {
        ...mockPlayers[0],
        timeSpent: 90,
      },
    ];

    (mockGameRulesService.calculateEstimatedProjectLength as ReturnType<typeof vi.fn>).mockReturnValue({
      estimatedDays: 100,
      contingencyDays: 10,
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

    // Compact chip format (redesigned 2026-07-26): "⏱️ 90/100d"
    expect(screen.getByText(/⏱️ 90\/100d/)).toBeInTheDocument();
  });

  it('should not render the TV theme button when onToggleTVDarkMode is not provided', () => {
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

    expect(screen.queryByText('TV theme')).not.toBeInTheDocument();
  });

  it('should render the TV theme button and call onToggleTVDarkMode when clicked', () => {
    const mockOnToggleTVDarkMode = vi.fn();

    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
        tvDarkMode={false}
        onToggleTVDarkMode={mockOnToggleTVDarkMode}
      />
    );

    const tvThemeButton = screen.getByText('TV theme');
    expect(tvThemeButton).toBeInTheDocument();

    fireEvent.click(tvThemeButton);
    expect(mockOnToggleTVDarkMode).toHaveBeenCalledTimes(1);
  });

  it('should display multiple players with individual timelines', () => {
    const twoPlayers: any[] = [
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
      estimatedDays: 110,
      contingencyDays: 10,
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

    // Both players should have timeline entries (compact inline "⏱️")
    const timelineLabels = screen.getAllByText((content) => content.includes('⏱️'));
    expect(timelineLabels).toHaveLength(2);
  });
});
