import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiceResultModal, DiceRollResult } from '../../../src/components/modals/DiceResultModal';
import { GameContext } from '../../../src/context/GameContext';
import { createAllMockServices } from '../../mocks/mockServices';

describe('DiceResultModal', () => {
  let mockServices: any;

  beforeEach(() => {
    mockServices = createAllMockServices();
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

    expect(screen.getByText('🎲 Roll: 4')).toBeInTheDocument();
    expect(screen.getByText('Effects Applied:')).toBeInTheDocument();
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

    expect(screen.getByText('+2 B cards')).toBeInTheDocument();
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

    expect(screen.getByText('Summary:')).toBeInTheDocument();
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

    const backdrop = screen.getByRole('dialog');
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
});