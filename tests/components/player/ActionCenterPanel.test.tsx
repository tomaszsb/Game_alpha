/**
 * ActionCenterPanel.test.tsx
 *
 * Tests for the ActionCenterPanel component — the live game UI panel.
 * Focuses on negotiate/try-again button visibility logic.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionCenterPanel } from '../../../src/components/player/ActionCenterPanel';
import { GamePhase, Player } from '../../../src/types/StateTypes';
import { createAllMockServices } from '../../mocks/mockServices';
import { renderWithProviders } from '../../utils/test-utils';

describe('ActionCenterPanel - Negotiate Button', () => {
  let mockServices: any;
  let mockPlayer: Player;
  let mockGameState: any;
  let onTryAgain: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockServices = createAllMockServices();
    onTryAgain = vi.fn().mockResolvedValue(undefined);

    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'OWNER-FUND-INITIATION',
      visitType: 'First',
      money: 1000,
      timeSpent: 0,
      projectScope: 6,
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
      hasPlayerRolledDice: false,
      requiredActions: 0,
      completedActionCount: 0,
    };

    // Configure mocks
    mockServices.stateService.subscribe.mockImplementation((callback: any) => {
      callback(mockGameState);
      return vi.fn();
    });
    mockServices.stateService.subscribeToAutoActions.mockReturnValue(vi.fn());
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceEffects.mockReturnValue([]);
    mockServices.dataService.getMovement.mockReturnValue(null);
    mockServices.dataService.getSpaceByName.mockReturnValue({
      name: 'OWNER-FUND-INITIATION',
      content: [{
        visit_type: 'First',
        story: 'Owner funding story',
        action_description: 'Review funding',
        outcome_description: ''
      }]
    });
    mockServices.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'SETUP' });
    mockServices.gameRulesService.calculateProjectScope.mockReturnValue(6);
    mockServices.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
  });

  it('should show negotiate button on negotiable space even with 0 completed actions', () => {
    // Space has can_negotiate = true
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Owner Funding Initiation',
      story: 'Owner funding story',
      action_description: 'Review funding',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: 'Agree with Owner',
      try_again_label: 'Negotiate'
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // End turn button should show custom label
    expect(screen.getByText('Agree with Owner')).toBeInTheDocument();
    // Negotiate button should be visible even with 0 completed actions
    expect(screen.getByText('Negotiate')).toBeInTheDocument();
  });

  it('should NOT show try-again button on non-negotiable space with 0 completed actions', () => {
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'PM Decision Check',
      story: 'Decision story',
      action_description: 'Make decision',
      outcome_description: '',
      can_negotiate: false,
      end_turn_label: 'End Turn',
      try_again_label: 'Try Again'
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // End turn button should show
    expect(screen.getByText('End Turn')).toBeInTheDocument();
    // Try Again should NOT show — no completed actions and not negotiable
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should NOT show try-again button on non-negotiable space even when actions are completed', () => {
    mockGameState.completedActionCount = 1;

    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'PM Decision Check',
      story: 'Decision story',
      action_description: 'Make decision',
      outcome_description: '',
      can_negotiate: false,
      end_turn_label: 'End Turn',
      try_again_label: 'Try Again'
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // Try Again should NOT show on non-negotiable spaces regardless of action count
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should use default "Negotiate" label when can_negotiate is true but no custom label', () => {
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Some Negotiable Space',
      story: 'Story',
      action_description: 'Action',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: 'End Turn',
      try_again_label: '' // No custom label
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // Should fall back to "🔄 Negotiate" default for negotiable spaces
    expect(screen.getByText('🔄 Negotiate')).toBeInTheDocument();
  });

  it('should NOT show negotiate button when onTryAgain is not provided', () => {
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Owner Funding Initiation',
      story: 'Story',
      action_description: 'Action',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: 'Agree with Owner',
      try_again_label: 'Negotiate'
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        // No onTryAgain prop
      />,
      { gameServices: mockServices }
    );

    expect(screen.queryByText('Negotiate')).not.toBeInTheDocument();
  });

  it('should NOT show negotiate button when it is not the players turn', () => {
    mockGameState.currentPlayerId = 'player2'; // Different player's turn

    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Owner Funding Initiation',
      story: 'Story',
      action_description: 'Action',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: 'Agree with Owner',
      try_again_label: 'Negotiate'
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // Turn controls section (including negotiate) should not render when not player's turn
    expect(screen.queryByText('Negotiate')).not.toBeInTheDocument();
  });
});
