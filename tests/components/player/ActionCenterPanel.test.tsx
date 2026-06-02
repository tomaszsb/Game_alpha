/**
 * ActionCenterPanel.test.tsx
 *
 * Tests for the ActionCenterPanel component — the live game UI panel.
 * Focuses on negotiate/try-again button visibility logic.
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionCenterPanel } from '../../../src/components/player/ActionCenterPanel';
import { GamePhase, Player } from '../../../src/types/StateTypes';
import { createAllMockServices } from '../../mocks/mockServices';
import { renderWithProviders } from '../../utils/test-utils';

describe('ActionCenterPanel - Negotiate Button', () => {
  let mockServices: any;
  let mockPlayer: any;
  let mockGameState: any;
  let onTryAgain: any;

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

  // Sentinel strings — clearly test-only, decouple tests from production copy.
  // Voice rewrites in Spaces.csv can flow through to production without
  // breaking these tests, because the tests never assert on production strings.
  const FIXTURE_END_TURN = 'FIXTURE_END_TURN_LABEL';
  const FIXTURE_TRY_AGAIN = 'FIXTURE_TRY_AGAIN_LABEL';
  // Component's hard-coded fallback when can_negotiate=true but try_again_label is empty.
  // This one IS production copy by design — it's the component default, not CSV-driven.
  const DEFAULT_NEGOTIATE_LABEL = '🔄 Negotiate';

  it('should show negotiate button on negotiable space even with 0 completed actions', () => {
    // Space has can_negotiate = true
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Owner Funding Initiation',
      story: 'Owner funding story',
      action_description: 'Review funding',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: FIXTURE_END_TURN,
      try_again_label: FIXTURE_TRY_AGAIN
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // End turn button renders the CSV-provided custom label
    expect(screen.getByText(FIXTURE_END_TURN)).toBeInTheDocument();
    // Negotiate button visible even with 0 completed actions, using CSV label
    expect(screen.getByText(FIXTURE_TRY_AGAIN)).toBeInTheDocument();
  });

  it('should NOT show try-again button on non-negotiable space with 0 completed actions', () => {
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'PM Decision Check',
      story: 'Decision story',
      action_description: 'Make decision',
      outcome_description: '',
      can_negotiate: false,
      end_turn_label: FIXTURE_END_TURN,
      try_again_label: FIXTURE_TRY_AGAIN
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // End turn button renders
    expect(screen.getByText(FIXTURE_END_TURN)).toBeInTheDocument();
    // Try Again should NOT render — no completed actions and not negotiable
    expect(screen.queryByText(FIXTURE_TRY_AGAIN)).not.toBeInTheDocument();
  });

  it('should NOT show try-again button on non-negotiable space even when actions are completed', () => {
    mockGameState.completedActionCount = 1;

    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'PM Decision Check',
      story: 'Decision story',
      action_description: 'Make decision',
      outcome_description: '',
      can_negotiate: false,
      end_turn_label: FIXTURE_END_TURN,
      try_again_label: FIXTURE_TRY_AGAIN
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
    expect(screen.queryByText(FIXTURE_TRY_AGAIN)).not.toBeInTheDocument();
  });

  it('should use component default label when can_negotiate is true but no custom label', () => {
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Some Negotiable Space',
      story: 'Story',
      action_description: 'Action',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: FIXTURE_END_TURN,
      try_again_label: '' // No custom label — should fall back to component default
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        onTryAgain={onTryAgain}
      />,
      { gameServices: mockServices }
    );

    // The fallback IS production copy (component default, not CSV-driven), so
    // we assert on it directly. If this default ever changes, this assertion
    // is the one place that needs updating — by design.
    expect(screen.getByText(DEFAULT_NEGOTIATE_LABEL)).toBeInTheDocument();
  });

  it('should NOT show negotiate button when onTryAgain is not provided', () => {
    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Owner Funding Initiation',
      story: 'Story',
      action_description: 'Action',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: FIXTURE_END_TURN,
      try_again_label: FIXTURE_TRY_AGAIN
    });

    renderWithProviders(
      <ActionCenterPanel
        gameServices={mockServices}
        playerId="player1"
        // No onTryAgain prop
      />,
      { gameServices: mockServices }
    );

    expect(screen.queryByText(FIXTURE_TRY_AGAIN)).not.toBeInTheDocument();
  });

  it('should NOT show negotiate button when it is not the players turn', () => {
    mockGameState.currentPlayerId = 'player2'; // Different player's turn

    mockServices.dataService.getSpaceContent.mockReturnValue({
      title: 'Owner Funding Initiation',
      story: 'Story',
      action_description: 'Action',
      outcome_description: '',
      can_negotiate: true,
      end_turn_label: FIXTURE_END_TURN,
      try_again_label: FIXTURE_TRY_AGAIN
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
    expect(screen.queryByText(FIXTURE_TRY_AGAIN)).not.toBeInTheDocument();
  });
});

// ── Ledger pill (v2.63.3 / fb:fae27391) ────────────────────────────────────
//
// The ledger pill is a vertical button anchored to the right edge of the
// player panel. It is always visible EXCEPT when the Ledger tab is already
// active (no point surfacing a shortcut to a panel already open).
// A status dot changes CSS class based on funding state:
//   action-center__ledger-side--gap      → player funding < project scope
//   action-center__ledger-side--surplus  → player funding > project scope
//   (no modifier)                        → neutral (scope=0 or fully funded)
describe('ActionCenterPanel - Ledger pill', () => {
  let mockServices: any;
  let mockGameState: any;

  // totalScope is derived from W-card costs in the hand, not projectScope.
  // We use a single W card costing $500k to set scope, then vary moneySources.
  const W_CARD_ID = 'W-TEST-001';
  const W_CARD_COST = 500000;

  const setupRender = (moneySources: { ownerFunding: number; bankLoans: number; investmentDeals: number; other?: number }, hasWCard = false) => {
    mockServices = createAllMockServices();
    const mockPlayer = {
      id: 'player1', name: 'Test Player',
      currentSpace: 'ARCH-INITIATION', visitType: 'First',
      money: 50000, timeSpent: 0, projectScope: 0,
      score: 0, color: '#ff0000', avatar: '🚀',
      hand: hasWCard ? [W_CARD_ID] : [],
      activeCards: [], turnModifiers: { skipTurns: 0 },
      activeEffects: [], loans: [], moneySources,
    };
    mockGameState = {
      players: [mockPlayer], currentPlayerId: 'player1',
      gamePhase: 'PLAY' as GamePhase, awaitingChoice: null,
      hasPlayerRolledDice: false, requiredActions: 0, completedActionCount: 0,
    };
    mockServices.stateService.subscribe.mockImplementation((cb: any) => { cb(mockGameState); return vi.fn(); });
    mockServices.stateService.subscribeToAutoActions.mockReturnValue(vi.fn());
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceEffects.mockReturnValue([]);
    mockServices.dataService.getMovement.mockReturnValue(null);
    mockServices.dataService.getSpaceByName.mockReturnValue({ name: 'ARCH-INITIATION', content: [] });
    mockServices.dataService.getSpaceContent.mockReturnValue({ title: 'Arch Init', story: '', action_description: '', outcome_description: '', can_negotiate: false, end_turn_label: 'End Turn', try_again_label: '' });
    mockServices.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    mockServices.dataService.getCardById.mockImplementation((id: string) =>
      id === W_CARD_ID ? { card_id: W_CARD_ID, card_type: 'W', card_name: 'Test W', cost: W_CARD_COST } : undefined
    );
    mockServices.gameRulesService.calculateProjectScope.mockReturnValue(0);
    mockServices.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    return renderWithProviders(
      <ActionCenterPanel gameServices={mockServices} playerId="player1" />,
      { gameServices: mockServices }
    );
  };

  it('renders the pill when ledger tab is not active (default state, neutral)', () => {
    setupRender({ ownerFunding: 0, bankLoans: 0, investmentDeals: 0 });
    // No W cards → totalScope = 0 → neutral
    expect(screen.getByTitle('Open ledger')).toBeInTheDocument();
  });

  it('pill disappears when ledger tab is clicked (no shortcut needed to open open panel)', () => {
    setupRender({ ownerFunding: 0, bankLoans: 0, investmentDeals: 0 });
    // Pill is present before clicking ledger
    expect(screen.getByTitle('Open ledger')).toBeInTheDocument();
    // Click the pill itself — this sets activeTab to 'ledger', hiding the pill
    fireEvent.click(screen.getByTitle('Open ledger'));
    // Pill is now gone (hidden when ledger tab is already active)
    expect(screen.queryByTitle('Open ledger')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Funding gap — open ledger')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Funded — open ledger')).not.toBeInTheDocument();
  });

  it('pill has a status dot element (dot class exists for CSS color control)', () => {
    const { container } = setupRender({ ownerFunding: 0, bankLoans: 0, investmentDeals: 0 });
    // The dot element is always rendered inside the pill — its CSS class
    // changes to --gap or --surplus when funding state changes.
    const dot = container.querySelector('.action-center__ledger-side-dot');
    expect(dot).toBeInTheDocument();
  });
});
