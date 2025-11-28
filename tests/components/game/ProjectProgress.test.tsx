import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectProgress } from '../../../src/components/game/ProjectProgress';
import { IDataService } from '../../../../src/types/ServiceContracts';
import { Player } from '../../../../src/types/StateTypes';

describe('ProjectProgress', () => {
  let mockDataService: IDataService;
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

    mockOnToggleGameLog = vi.fn();
    mockOnOpenRulesModal = vi.fn();
  });

  it('should render the Rules button and call onOpenRulesModal when clicked', () => {
    render(
      <ProjectProgress
        players={mockPlayers}
        currentPlayerId="player1"
        dataService={mockDataService}
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
});
