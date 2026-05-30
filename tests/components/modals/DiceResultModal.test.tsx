import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiceResultModal, DiceRollResult } from '../../../src/components/modals/DiceResultModal';
import { GameContext } from '../../../src/context/GameContext';
import { createAllMockServices } from '../../mocks/mockServices';

describe('DiceResultModal', () => {
  let mockServices: any;

  beforeEach(() => {
    mockServices = createAllMockServices();
  });

  afterEach(() => {
    cleanup();
  });
  const mockResult: DiceRollResult = {
    diceValue: 4,
    spaceName: 'TEST-SPACE',
    effects: [
      {
        type: 'money',
        description: 'Project funding received',
        value: 50000
      },
      {
        type: 'cards',
        description: 'Draw bank loan cards',
        cardType: 'B',
        cardCount: 2
      }
    ],
    summary: 'Good roll! You received funding and business opportunities.',
    hasChoices: false
  };

  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnConfirm.mockClear();
  });

  it('should render when open with valid result', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal
          isOpen={true}
          result={mockResult}
          onClose={mockOnClose}
        />
      </GameContext.Provider>
    );

    // Check modal is rendered with dice result
    expect(screen.getByTestId('dice-result-modal')).toBeInTheDocument();
    // Check for roll value (may be in separate element from emoji)
    expect(screen.getByText(/Roll: 4|4/)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal
          isOpen={false}
          result={mockResult}
          onClose={mockOnClose}
        />
      </GameContext.Provider>
    );

    expect(screen.queryByText('Dice Roll: 4')).not.toBeInTheDocument();
  });

  it('should not render when result is null', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal
          isOpen={true}
          result={null}
          onClose={mockOnClose}
        />
      </GameContext.Provider>
    );

    expect(screen.queryByText('Dice Roll:')).not.toBeInTheDocument();
  });

  it('should display money effects with proper formatting', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal
          isOpen={true}
          result={mockResult}
          onClose={mockOnClose}
        />
      </GameContext.Provider>
    );

    expect(screen.getByText('+$50K')).toBeInTheDocument();
    expect(screen.getByText('Project funding received')).toBeInTheDocument();
  });

  it('should display card effects correctly', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal
          isOpen={true}
          result={mockResult}
          onClose={mockOnClose}
        />
      </GameContext.Provider>
    );

    expect(screen.getByText('+2 Bank Loans')).toBeInTheDocument();
    expect(screen.getByText('Draw bank loan cards')).toBeInTheDocument();
  });

  it('should display summary when provided', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={mockResult}
        onClose={mockOnClose} />
      </GameContext.Provider>
    );

    // Check for summary content
    expect(screen.getByText('Good roll! You received funding and business opportunities.')).toBeInTheDocument();
  });

  it('should call onClose when Continue button is clicked', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={mockResult}
        onClose={mockOnClose} />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('Continue'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={mockResult}
        onClose={mockOnClose} />
      </GameContext.Provider>
    );

    const backdrop = screen.getByTestId('dice-result-modal-overlay');
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should handle results with choices', () => {
    const choiceResult: DiceRollResult = {
      ...mockResult,
      hasChoices: true,
      summary: 'You must choose your next move!'
    };

    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={choiceResult}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm} />
      </GameContext.Provider>
    );

    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Make Choice')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Make Choice'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should display message when no effects', () => {
    const noEffectsResult: DiceRollResult = {
      diceValue: 3,
      spaceName: 'BORING-SPACE',
      effects: [],
      summary: '',
      hasChoices: false
    };

    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={noEffectsResult}
        onClose={mockOnClose} />
      </GameContext.Provider>
    );

    expect(screen.getByText('No special effects this turn')).toBeInTheDocument();
  });

  it('should handle keyboard navigation', () => {
    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={mockResult}
        onClose={mockOnClose} />
      </GameContext.Provider>
    );

    const dialog = screen.getByRole('dialog');
    
    // Test Escape key
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  describe('ModalConfig Overrides (Phase 4)', () => {
    it('should apply dice-specific modal config overrides with template interpolation', () => {
      mockServices.dataService.getModalConfig.mockImplementation(
        (spaceName: string, visit: string, action: string, diceValue?: number) => {
          if (action === 'dice' && diceValue === 4) {
            return {
              modal_title: 'Lucky {diceValue} on {spaceName}!',
              modal_description: 'The dice rolled a {diceValue}.',
              modal_button_label: 'Claim Prize',
              modal_summary: 'Celebrate the {diceValue}',
            };
          }
          return undefined;
        }
      );

      render(
        <GameContext.Provider value={mockServices}>
          <DiceResultModal
            isOpen={true}
            result={mockResult}
            onClose={mockOnClose}
          />
        </GameContext.Provider>
      );

      expect(screen.getByText('Lucky 4 on TEST-SPACE!')).toBeInTheDocument();
      expect(screen.getByText('The dice rolled a 4.')).toBeInTheDocument();
      expect(screen.getByText('Claim Prize')).toBeInTheDocument();
      expect(screen.getByText('Celebrate the 4')).toBeInTheDocument();
    });

    it('should fall back to default labels when no override is configured', () => {
      mockServices.dataService.getModalConfig.mockReturnValue(undefined);

      render(
        <GameContext.Provider value={mockServices}>
          <DiceResultModal
            isOpen={true}
            result={mockResult}
            onClose={mockOnClose}
          />
        </GameContext.Provider>
      );

      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(
        screen.getByText('Good roll! You received funding and business opportunities.')
      ).toBeInTheDocument();
    });

    it('should call getModalConfig with the correct dice value', () => {
      mockServices.dataService.getModalConfig.mockReturnValue(undefined);

      render(
        <GameContext.Provider value={mockServices}>
          <DiceResultModal
            isOpen={true}
            result={mockResult}
            onClose={mockOnClose}
          />
        </GameContext.Provider>
      );

      expect(mockServices.dataService.getModalConfig).toHaveBeenCalledWith(
        'TEST-SPACE',
        'First',
        'dice',
        4
      );
    });
  });

  it('should display time effects with proper formatting', () => {
    const timeResult: DiceRollResult = {
      diceValue: 2,
      spaceName: 'TIME-SPACE',
      effects: [
        {
          type: 'time',
          description: 'Project delayed',
          value: -3
        }
      ],
      summary: '',
      hasChoices: false
    };

    render(
      <GameContext.Provider value={mockServices}>
        <DiceResultModal isOpen={true}
        result={timeResult}
        onClose={mockOnClose} />
      </GameContext.Provider>
    );

    expect(screen.getByText('-3 days')).toBeInTheDocument();
    expect(screen.getByText('Project delayed')).toBeInTheDocument();
  });

  // Visit-indicator part 2 (2026-05-29, fb:0cdd59ba) — "results 2x once in
  // red and once in green". When the BeforeAfterBlock snapshot is present,
  // the numeric value should NOT also render in the Effects-Applied row
  // (the table below already shows the delta). Movement and qualitative
  // effects always render their value because the table doesn't cover them.
  describe('duplicate-render suppression when snapshot is present', () => {
    const snapshotResult: DiceRollResult = {
      diceValue: 4,
      spaceName: 'TEST-SPACE',
      effects: [
        { type: 'money', description: 'Funding received', value: 50000 },
        { type: 'time', description: 'Project delayed', value: -3 },
      ],
      summary: '',
      hasChoices: false,
      before: {
        money: 0,
        projectScope: 0,
        timeSpent: 5,
        handCount: 0,
        cardCountsByType: { W: 0, B: 0, E: 0, I: 0, L: 0 },
      },
      after: {
        money: 50000,
        projectScope: 0,
        timeSpent: 2,
        handCount: 0,
        cardCountsByType: { W: 0, B: 0, E: 0, I: 0, L: 0 },
      },
    };

    it('suppresses Effects-row bold value when BeforeAfterBlock will render it', () => {
      render(
        <GameContext.Provider value={mockServices}>
          <DiceResultModal isOpen={true} result={snapshotResult} onClose={mockOnClose} />
        </GameContext.Provider>
      );

      // Effects-row narrative description still visible.
      expect(screen.getByText('Funding received')).toBeInTheDocument();
      expect(screen.getByText('Project delayed')).toBeInTheDocument();

      // The +$50,000 / -3 days values appear only once each (in the
      // BeforeAfterBlock table), not twice. The table delta column uses
      // the unicode minus '−' (U+2212), the Effects formatter uses ASCII
      // '-' — so a duplicate Effects render would surface a second '-3 days'.
      const allMoneyMatches = screen.queryAllByText(/\+?\$50,000/);
      // BeforeAfterBlock renders: $0 (before), $50,000 (after), +$50,000 (delta)
      // No Effects-row value. Total appearances of "$50,000" = 2 (after + delta).
      expect(allMoneyMatches.length).toBe(2);

      // Time: BeforeAfterBlock renders "5 days" → "2 days" + "−3 days" delta.
      // Effects-row should NOT render an ASCII "-3 days".
      const dashMinusDays = screen.queryAllByText(/^-3 days$/);
      expect(dashMinusDays.length).toBe(0);
    });

    it('still renders the value when snapshot is absent (legacy / partial)', () => {
      const noSnapshot: DiceRollResult = {
        diceValue: 3,
        spaceName: 'TEST-SPACE',
        effects: [{ type: 'time', description: 'Project delayed', value: -3 }],
        summary: '',
        hasChoices: false,
      };
      render(
        <GameContext.Provider value={mockServices}>
          <DiceResultModal isOpen={true} result={noSnapshot} onClose={mockOnClose} />
        </GameContext.Provider>
      );

      // Without before/after, the Effects-row continues to show its value.
      expect(screen.getByText('-3 days')).toBeInTheDocument();
    });
  });
});