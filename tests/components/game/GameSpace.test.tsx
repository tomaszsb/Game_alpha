import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSpace } from '../../../src/components/game/GameSpace';
import { Space, Player } from '../../../../src/types/DataTypes';

describe('GameSpace', () => {
  beforeEach(() => {
    cleanup();
  });
  const mockSpace: Space = {
    name: 'Test Space',
    config: {} as any, // Mock as needed
    content: [],
    movement: [],
    spaceEffects: [],
    diceEffects: [],
    diceOutcomes: [],
  };

  const mockPlayer: Player = {
    id: 'player1',
    name: 'Alice',
    currentSpace: 'Test Space',
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
    avatar: 'A',
    visitedSpaces: [],
    spaceVisitLog: [],
    role: 'Explorer',
  };

  it('should render the space name', () => {
    render(<GameSpace space={mockSpace} playersOnSpace={[]} />);
    expect(screen.getByText('Test Space')).toBeInTheDocument();
  });

  it('should render players on the space', () => {
    render(<GameSpace space={mockSpace} playersOnSpace={[mockPlayer]} />);
    expect(screen.getByText('A')).toBeInTheDocument(); // Player avatar
    expect(screen.getByTitle('Alice (Explorer)')).toBeInTheDocument(); // Player name with role in title
  });

  it('should display the player role badge if a role is present', () => {
    render(<GameSpace space={mockSpace} playersOnSpace={[mockPlayer]} />);
    const roleBadge = screen.getByText('Exp'); // Shortened role
    expect(roleBadge).toBeInTheDocument();
  });

  it('should not display the player role badge if no role is present', () => {
    const playerWithoutRole = { ...mockPlayer, role: undefined };
    render(<GameSpace space={mockSpace} playersOnSpace={[playerWithoutRole]} />);
    expect(screen.queryByText('EXP')).not.toBeInTheDocument();
  });

  it('should show movement indicators when specified', () => {
    render(<GameSpace space={mockSpace} playersOnSpace={[]} isValidMoveDestination={true} showMovementIndicators={true} />);
    expect(screen.getByTitle('Valid movement destination')).toBeInTheDocument();
  });

  it('should show current player indicator when specified', () => {
    render(<GameSpace space={mockSpace} playersOnSpace={[]} isCurrentPlayerSpace={true} showMovementIndicators={true} />);
    expect(screen.getByTitle('Current player position')).toBeInTheDocument();
  });
});
