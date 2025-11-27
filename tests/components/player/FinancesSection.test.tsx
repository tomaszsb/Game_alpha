/**
 * FinancesSection.test.tsx
 * 
 * Test suite for FinancesSection component
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinancesSection } from '../../../src/components/player/sections/FinancesSection';
import { createAllMockServices } from '../../mocks/mockServices';
import { Player, GameState } from '../../../types/StateTypes';

describe('FinancesSection', () => {
  const mockServices = createAllMockServices();
  
  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    money: 500,
    timeSpent: 0,
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

  const mockGameState: GameState = {
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 1,
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnCount: 1,
    playerTurnCounts: { 'player1': 1 },
    activeModal: null,
    awaitingChoice: null,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    isGameOver: false,
    isMoving: false,
    isProcessingArrival: false,
    isInitialized: true,
    currentExplorationSessionId: null,
    requiredActions: 0,
    completedActionCount: 0,
    availableActionTypes: [],
    completedActions: {
      diceRoll: undefined,
      manualActions: {}
    },
    activeNegotiation: null,
    selectedDestination: null,
    globalActionLog: [],
    playerSnapshots: {},
    decks: { W: [], B: [], E: [], L: [], I: [] },
    discardPiles: { W: [], B: [], E: [], L: [], I: [] }
  };

  const defaultProps = {
    gameServices: mockServices,
    playerId: 'player1',
    isExpanded: true,
    onToggle: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    // Setup default mock returns
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]); // Fix: Return empty array by default

    // Mock filterSpaceEffectsByCondition to pass-through effects
    mockServices.turnService.filterSpaceEffectsByCondition.mockImplementation((effects: any[]) => effects);
  });

  describe('Basic Rendering', () => {
    it('should render the component without crashing', () => {
      render(<FinancesSection {...defaultProps} />);
      expect(screen.getByText('FINANCES')).toBeInTheDocument();
    });

    it('should render the finances icon', () => {
      render(<FinancesSection {...defaultProps} />);
      expect(screen.getByText('💰')).toBeInTheDocument();
    });

    it('should display current balance', () => {
      render(<FinancesSection {...defaultProps} />);
      expect(screen.getByText('$500')).toBeInTheDocument();
    });

    it('should return null if player not found', () => {
      mockServices.stateService.getPlayer.mockReturnValue(undefined);
      const { container } = render(<FinancesSection {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Action Detection', () => {
    it('should show action indicator when money manual effect available', () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);

      render(<FinancesSection {...defaultProps} />);
      const indicator = screen.getByRole('status', { name: /action available/i });
      expect(indicator).toBeInTheDocument();
    });

    it('should not show action indicator when no actions available', () => {
      render(<FinancesSection {...defaultProps} />);
      const indicator = screen.queryByRole('status', { name: /action available/i });
      expect(indicator).not.toBeInTheDocument();
    });

    it('should show Roll for Money button when action available', () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);

      render(<FinancesSection {...defaultProps} />);
      expect(screen.getByText('Roll for Money')).toBeInTheDocument();
    });

    it('should not show Roll for Money button when action unavailable', () => {
      render(<FinancesSection {...defaultProps} />);
      expect(screen.queryByText('Roll for Money')).not.toBeInTheDocument();
    });
  });

  describe('Roll for Money Action', () => {
    it('should call triggerManualEffectWithFeedback when button clicked', async () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);
      mockServices.turnService.triggerManualEffectWithFeedback.mockResolvedValue({});

      render(<FinancesSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Money');
      fireEvent.click(rollButton);

      expect(mockServices.turnService.triggerManualEffectWithFeedback).toHaveBeenCalledWith(
        'player1',
        'money'
      );
    });

    it('should show loading state during roll', async () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);

      let resolveRoll: any;
      mockServices.turnService.triggerManualEffectWithFeedback.mockReturnValue(
        new Promise(resolve => { resolveRoll = resolve; })
      );

      const { container } = render(<FinancesSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Money');
      fireEvent.click(rollButton);

      // Should show skeleton loader during loading
      await waitFor(() => {
        expect(container.querySelector('.expandable-section__content--loading')).toBeInTheDocument();
      });

      // Resolve the promise
      resolveRoll({});
    });

    it('should handle roll errors', async () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);
      mockServices.turnService.triggerManualEffectWithFeedback.mockRejectedValue(
        new Error('Roll failed')
      );

      render(<FinancesSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Money');
      fireEvent.click(rollButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to perform money action. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);
      mockServices.turnService.triggerManualEffectWithFeedback.mockRejectedValue(
        new Error('Roll failed')
      );

      render(<FinancesSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Money');
      fireEvent.click(rollButton);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should clear error when retry clicked', async () => {
      const moneyEffect = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        trigger_type: 'manual',
        effect_type: 'money',
        value: 100,
        description: 'Roll for Money'
      };
      mockServices.dataService.getSpaceEffects.mockReturnValue([moneyEffect]);

      // First call fails
      mockServices.turnService.triggerManualEffectWithFeedback.mockRejectedValueOnce(
        new Error('Roll failed')
      );

      render(<FinancesSection {...defaultProps} />);

      const rollButton = screen.getByText('Roll for Money');
      fireEvent.click(rollButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to perform money action. Please try again.')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Error message should be cleared
      expect(screen.queryByText('Failed to perform money action. Please try again.')).not.toBeInTheDocument();
    });
  });

  describe('Expansion State', () => {
    it('should respect isExpanded prop', () => {
      const { container } = render(<FinancesSection {...defaultProps} isExpanded={false} />);
      // Find the content div by ID since hidden regions are not queryable
      const content = container.querySelector('#finances-content');
      expect(content).toHaveAttribute('hidden');
    });

    it('should call onToggle when section header clicked', () => {
      const onToggle = vi.fn();
      render(<FinancesSection {...defaultProps} onToggle={onToggle} />);

      const header = screen.getByRole('button', { name: /FINANCES/i });
      fireEvent.click(header);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cost Tracking Display', () => {
    const playerWithCosts: Player = {
      ...mockPlayer,
      money: 5000,
      projectScope: 100000,
      costHistory: [
        {
          id: 'cost1',
          category: 'bank',
          amount: 500,
          description: 'Bank processing fee',
          turn: 5,
          timestamp: new Date('2024-01-01'),
          spaceName: 'BANK-FEE-SPACE'
        },
        {
          id: 'cost2',
          category: 'architectural',
          amount: 15000,
          description: 'Architect review',
          turn: 8,
          timestamp: new Date('2024-01-02'),
          spaceName: 'ARCH-FEE-REVIEW'
        },
        {
          id: 'cost3',
          category: 'engineering',
          amount: 10000,
          description: 'Engineer review',
          turn: 10,
          timestamp: new Date('2024-01-03'),
          spaceName: 'ENG-FEE-REVIEW'
        }
      ],
      costs: {
        bank: 500,
        investor: 0,
        expeditor: 0,
        architectural: 15000,
        engineering: 10000,
        regulatory: 0,
        miscellaneous: 0,
        total: 25500
      },
      expenditures: {
        design: 25000, // architectural + engineering
        fees: 500,     // bank
        construction: 0
      },
      moneySources: {
        ownerFunding: 50000,
        bankLoans: 0,
        investmentDeals: 0,
        other: 0
      }
    };

    beforeEach(() => {
      mockServices.stateService.getPlayer.mockReturnValue(playerWithCosts);
    });

    it('should display total costs when player has cost history', () => {
      const { container } = render(<FinancesSection {...defaultProps} />);

      expect(screen.getByText('Total Costs')).toBeInTheDocument();
      // Look for the Total Costs stat item specifically
      const totalCostsElements = container.querySelectorAll('.stat-total');
      expect(totalCostsElements.length).toBeGreaterThan(0);
      const hasTotalCosts = Array.from(totalCostsElements).some(el =>
        el.textContent?.includes('Total Costs') && el.textContent?.includes('$25,500')
      );
      expect(hasTotalCosts).toBe(true);
    });

    it('should display bank fees category when costs exist', () => {
      render(<FinancesSection {...defaultProps} />);

      expect(screen.getByText('Bank Fees')).toBeInTheDocument();
      // Use getByRole with name pattern to find the specific button
      expect(screen.getByRole('button', { name: /Bank Fees.*500/i })).toBeInTheDocument();
    });

    it('should display architectural fees category', () => {
      render(<FinancesSection {...defaultProps} />);

      expect(screen.getByText('Architectural Fees')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Architectural Fees.*15,000/i })).toBeInTheDocument();
    });

    it('should display engineering fees category', () => {
      render(<FinancesSection {...defaultProps} />);

      expect(screen.getByText('Engineering Fees')).toBeInTheDocument();
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });

    it('should expand cost category to show transaction details when clicked', () => {
      render(<FinancesSection {...defaultProps} />);

      // Find and click the Bank Fees category header
      const bankFeesHeader = screen.getByRole('button', { name: /Bank Fees.*\$500/i });
      fireEvent.click(bankFeesHeader);

      // Should now show the transaction detail
      expect(screen.getByText('Bank processing fee')).toBeInTheDocument();
    });

    it('should display financial health metrics when budget exists', () => {
      render(<FinancesSection {...defaultProps} />);

      expect(screen.getByText('📈 Financial Health')).toBeInTheDocument();
      expect(screen.getByText('Design Cost %')).toBeInTheDocument();
      expect(screen.getByText('Budget Variance')).toBeInTheDocument();
    });

    it('should show design cost percentage', () => {
      render(<FinancesSection {...defaultProps} />);

      // Design costs ($25,000) / Project scope ($100,000) = 25%
      expect(screen.getByText(/25\.0%/)).toBeInTheDocument();
    });

    it('should display warning when design costs exceed 20% threshold', () => {
      render(<FinancesSection {...defaultProps} />);

      // Design cost is 25%, which exceeds 20% threshold
      expect(screen.getByText(/Design costs exceed 20% threshold - project at risk/)).toBeInTheDocument();
    });

    it('should display budget variance', () => {
      render(<FinancesSection {...defaultProps} />);

      // Total budget ($50,000) - Total expenditures ($25,500) = $24,500 under
      expect(screen.getByText(/\$24,500/)).toBeInTheDocument();
      expect(screen.getByText(/under/)).toBeInTheDocument();
    });

    it('should not display cost categories with zero costs', () => {
      render(<FinancesSection {...defaultProps} />);

      // Should not show investor fees (zero)
      expect(screen.queryByText('Investor Fees')).not.toBeInTheDocument();

      // Should not show expeditor fees (zero)
      expect(screen.queryByText('Expeditor Fees')).not.toBeInTheDocument();
    });

    it('should handle backward compatibility (player without cost structures)', () => {
      const legacyPlayer = {
        ...mockPlayer,
        money: 1000
        // No costHistory, costs, or expenditures
      };
      mockServices.stateService.getPlayer.mockReturnValue(legacyPlayer);

      render(<FinancesSection {...defaultProps} />);

      // Should render without crashing
      expect(screen.getByText('FINANCES')).toBeInTheDocument();
      expect(screen.getByText('$1,000')).toBeInTheDocument();

      // Should not show cost sections
      expect(screen.queryByText('Total Costs')).not.toBeInTheDocument();
    });

    it('should display funding mix when money sources exist', () => {
      render(<FinancesSection {...defaultProps} />);

      expect(screen.getByText('Funding Mix')).toBeInTheDocument();
      // 100% owner funding in this case
      expect(screen.getByText(/100% owner \/ 0% external/)).toBeInTheDocument();
    });

    it('should collapse cost category details when header clicked twice', () => {
      render(<FinancesSection {...defaultProps} />);

      const archFeesHeader = screen.getByRole('button', { name: /Architectural Fees.*\$15,000/i });

      // First click - expand
      fireEvent.click(archFeesHeader);
      expect(screen.getByText('Architect review')).toBeInTheDocument();

      // Second click - collapse
      fireEvent.click(archFeesHeader);
      expect(screen.queryByText('Architect review')).not.toBeInTheDocument();
    });

    it('should display all cost entries for a category when expanded', () => {
      const playerWithMultipleCosts: Player = {
        ...playerWithCosts,
        costHistory: [
          {
            id: 'cost1',
            category: 'bank',
            amount: 300,
            description: 'Bank fee 1',
            turn: 5,
            timestamp: new Date(),
            spaceName: 'BANK-FEE'
          },
          {
            id: 'cost2',
            category: 'bank',
            amount: 200,
            description: 'Bank fee 2',
            turn: 6,
            timestamp: new Date(),
            spaceName: 'BANK-FEE'
          }
        ],
        costs: {
          ...playerWithCosts.costs,
          bank: 500
        }
      };
      mockServices.stateService.getPlayer.mockReturnValue(playerWithMultipleCosts);

      render(<FinancesSection {...defaultProps} />);

      const bankFeesHeader = screen.getByRole('button', { name: /Bank Fees.*500/i });
      fireEvent.click(bankFeesHeader);

      // Should show both entries
      expect(screen.getByText('Bank fee 1')).toBeInTheDocument();
      expect(screen.getByText('Bank fee 2')).toBeInTheDocument();
      // Use getAllByText for amounts that might appear multiple times
      const amounts = screen.getAllByText(/\$[0-9,]+/);
      expect(amounts.length).toBeGreaterThan(0);
    });
  });
});