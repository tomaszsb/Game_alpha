import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectProgress } from '../../../src/components/game/ProjectProgress';
import { IDataService, IGameRulesService } from '../../../src/types/ServiceContracts';
import { Player } from '../../../src/types/StateTypes';
import { setPanelMode, getStoredPanelMode } from '../../../src/components/player/panelTheme';
import { buildLiveBoard } from '../../../src/utils/liveTrophies';
import type { MeasureInput } from '../../../src/utils/trophyScoring';

const boardRow = (id: string, name: string, over: Partial<MeasureInput> = {}): MeasureInput => ({
  playerId: id, name, finished: false, out: false, finishOrder: 99, daysUsed: 5, daysPlanned: 110,
  moneySpent: 0, moneyPlanned: 100000, problemPoints: 0, reviews: 0, ...over,
});

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
  // What the live trophy board is built from (a test sets its own rows).
  let boardInputs: MeasureInput[];

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

    boardInputs = [boardRow('player1', 'Alice')];
    mockGameRulesService = {
      computeLiveBoard: vi.fn(() => buildLiveBoard(boardInputs)),
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

    // v3.2.72: renamed "Rules" → "How to play" (Onboarding Phase C Slice 3).
    const rulesButton = screen.getByText('How to play');
    expect(rulesButton).toBeInTheDocument();

    fireEvent.click(rulesButton);
    expect(mockOnOpenRulesModal).toHaveBeenCalledTimes(1);
  });

  // fb:b6963218 — the light/dark toggle lives in this toolbar, and the tracker
  // itself follows the shared setting.
  it('has a light/dark toggle that flips the shared mode and darkens the tracker', () => {
    setPanelMode('light');
    const { container } = render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );
    const toggle = screen.getByTitle('Light / dark mode');
    expect(toggle).toHaveTextContent('Dark');
    fireEvent.click(toggle);
    expect(getStoredPanelMode()).toBe('dark');
    expect(screen.getByTitle('Light / dark mode')).toHaveTextContent('Light');
    expect((container.firstChild as HTMLElement).style.background).toContain('rgb(15, 23, 42)');
    setPanelMode('light');
  });

  it('shows no toggle when buttons are hidden (the TV follows the shared TV theme)', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
        hideButtons
        mode="dark"
      />
    );
    expect(screen.queryByTitle('Light / dark mode')).not.toBeInTheDocument();
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

  it('should show the live trophy board with a row for the player', () => {
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

    expect(screen.getByTestId('live-trophy-board')).toBeInTheDocument();
    const card = screen.getByTestId('player-progress-card');
    expect(card.getAttribute('data-player-name')).toBe('Alice');
    expect(screen.getByTitle('Alice').querySelector('img')).toBeInTheDocument();
    // Alone at the table there is no race: no "1st", no trophy, no "leading" (fb:67a9c44b).
    expect(screen.queryByText('leading')).toBeNull();
    expect(screen.getAllByText('no race yet')).toHaveLength(3);
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

  it('should show each player their place in the three races, and say places are for now until others catch up', () => {
    const twoPlayers: any[] = [
      { ...mockPlayers[0], id: 'player1', name: 'Alice', timeSpent: 30 },
      { ...mockPlayers[0], id: 'player2', name: 'Bob', avatar: '🧔', timeSpent: 60 },
    ];
    boardInputs = [
      boardRow('player1', 'Alice', { daysUsed: 30 }),
      boardRow('player2', 'Bob', { daysUsed: 60 }),
    ];

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

    const cards = screen.getAllByTestId('player-progress-card');
    expect(cards).toHaveLength(2);
    // Alice (30 days) leads the time race and is solid: Bob has passed her day. Bob (60 days) is behind her
    // and Alice has not reached his day yet, so his place is only for now.
    expect(cards[0].getAttribute('data-provisional')).toBe('false');
    expect(cards[1].getAttribute('data-provisional')).toBe('true');
    expect(cards[1].querySelector('[data-testid="trophy-race-time"]')?.getAttribute('data-place')).toBe('2');
    expect(screen.getByTestId('live-trophy-note')).toBeInTheDocument();
  });

  // Stable hooks for the playtest robot (Manager brief 2026-10-06): the visible
  // wording is untouched; these ids are what the robot finds controls by.
  it('exposes stable test ids for whose turn it is and for finished players', () => {
    const finisher = { ...mockPlayers[0], id: 'player2', name: 'Bob', currentSpace: 'FINISH' };
    boardInputs = [boardRow('player1', 'Alice'), boardRow('player2', 'Bob', { finished: true })];
    (mockDataService.getGameConfigBySpace as any).mockImplementation((spaceName: string) =>
      spaceName === 'FINISH'
        ? { space_name: 'FINISH', phase: 'FINISH', is_ending_space: true }
        : { space_name: spaceName, phase: 'CONSTRUCTION', is_ending_space: false });
    render(
      <ProjectProgress
        players={[mockPlayers[0], finisher]}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
      />
    );
    // Expanded view: the current-player chip carries the id.
    expect(screen.getByTestId('current-player-turn').getAttribute('data-player-name')).toBe('Alice');
    const cards = screen.getAllByTestId('player-progress-card');
    expect(cards.map(c => [c.getAttribute('data-player-name'), c.getAttribute('data-finished')]))
      .toEqual([['Alice', 'false'], ['Bob', 'true']]);
  });

  it('puts the same test id on the Turn line of the collapsed bar', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
        gameRulesService={mockGameRulesService}
        onToggleGameLog={mockOnToggleGameLog}
        onOpenRulesModal={mockOnOpenRulesModal}
        collapsed
      />
    );
    const turn = screen.getByTestId('current-player-turn');
    expect(turn.getAttribute('data-player-name')).toBe('Alice');
    expect(turn).toHaveTextContent('Alice’s Turn');
  });
});
