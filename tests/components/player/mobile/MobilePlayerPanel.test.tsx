// tests/components/player/mobile/MobilePlayerPanel.test.tsx
//
// Tests for mobile player panel components.
// Created: January 24, 2026

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpaceHeader } from '../../../../src/components/player/mobile/SpaceHeader';
import { StatsBar } from '../../../../src/components/player/mobile/StatsBar';
import { PrimaryAction } from '../../../../src/components/player/mobile/PrimaryAction';

describe('Mobile Components', () => {
  describe('SpaceHeader', () => {
    it('renders space name and title', () => {
      render(
        <SpaceHeader
          spaceName="ARCH-FEE"
          spaceTitle="Architect Fee Review"
          visitType="First"
          playerName="Alice"
          playerAvatar="🎮"
          playerColor="#2196f3"
        />
      );

      expect(screen.getByText('ARCH-FEE')).toBeInTheDocument();
      expect(screen.getByText('Architect Fee Review')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('🎮')).toBeInTheDocument();
    });

    it('shows Return badge for subsequent visits', () => {
      render(
        <SpaceHeader
          spaceName="TEST-SPACE"
          visitType="Subsequent"
          playerName="Bob"
        />
      );

      expect(screen.getByText('Return')).toBeInTheDocument();
    });

    it('does not show Return badge for first visits', () => {
      render(
        <SpaceHeader
          spaceName="TEST-SPACE"
          visitType="First"
          playerName="Bob"
        />
      );

      expect(screen.queryByText('Return')).not.toBeInTheDocument();
    });
  });

  describe('StatsBar', () => {
    it('renders all four stats', () => {
      render(
        <StatsBar
          money={50000}
          timeSpent={30}
          cardCount={5}
          projectScope={100000}
        />
      );

      expect(screen.getByText('$50K')).toBeInTheDocument();
      expect(screen.getByText('30w')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('$100K')).toBeInTheDocument();
    });

    it('formats large money values with M suffix', () => {
      render(
        <StatsBar
          money={2500000}
          timeSpent={0}
          cardCount={0}
          projectScope={0}
        />
      );

      expect(screen.getByText('$2.5M')).toBeInTheDocument();
    });

    it('handles negative money', () => {
      render(
        <StatsBar
          money={-5000}
          timeSpent={0}
          cardCount={0}
          projectScope={0}
        />
      );

      expect(screen.getByText('-$5K')).toBeInTheDocument();
    });

    it('calls onStatTap when stat is clicked', () => {
      const onStatTap = vi.fn();
      render(
        <StatsBar
          money={10000}
          timeSpent={0}
          cardCount={0}
          projectScope={0}
          onStatTap={onStatTap}
        />
      );

      // Click on Money stat (first one)
      const moneyLabel = screen.getByText('Money');
      fireEvent.click(moneyLabel.closest('div')!);

      expect(onStatTap).toHaveBeenCalledWith('money');
    });

    it('renders all stat items with test IDs', () => {
      render(
        <StatsBar
          money={1000}
          timeSpent={10}
          cardCount={3}
          projectScope={50000}
        />
      );

      // Verify all 4 stat items are present via test IDs
      expect(screen.getByTestId('stat-money')).toBeInTheDocument();
      expect(screen.getByTestId('stat-time')).toBeInTheDocument();
      expect(screen.getByTestId('stat-cards')).toBeInTheDocument();
      expect(screen.getByTestId('stat-scope')).toBeInTheDocument();
    });

    it('renders stats bar container with test ID', () => {
      render(
        <StatsBar
          money={0}
          timeSpent={0}
          cardCount={0}
          projectScope={0}
        />
      );

      expect(screen.getByTestId('stats-bar')).toBeInTheDocument();
    });

    it('displays all stat labels', () => {
      render(
        <StatsBar
          money={0}
          timeSpent={0}
          cardCount={0}
          projectScope={0}
        />
      );

      // Verify all 4 labels are visible
      expect(screen.getByText('Money')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Cards')).toBeInTheDocument();
      expect(screen.getByText('Scope')).toBeInTheDocument();
    });
  });

  describe('PrimaryAction', () => {
    it('shows Continue button in STORY_MODE', () => {
      render(
        <PrimaryAction
          viewState="STORY_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(screen.getByText('📖')).toBeInTheDocument();
    });

    it('shows action label in ACTION_MODE', () => {
      render(
        <PrimaryAction
          viewState="ACTION_MODE"
          actionPrompt={{
            type: 'dice_roll',
            label: 'Roll for Money',
            description: 'Roll to determine funding'
          }}
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByText('Roll for Money')).toBeInTheDocument();
      expect(screen.getByText('🎲')).toBeInTheDocument();
    });

    it('shows disabled state in DECISION_MODE without selection', () => {
      render(
        <PrimaryAction
          viewState="DECISION_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByText('Select an Option')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('shows enabled Confirm Choice in DECISION_MODE with selection', () => {
      render(
        <PrimaryAction
          viewState="DECISION_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={true}
        />
      );

      expect(screen.getByText('Confirm Choice')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('shows End Turn in SUMMARY_MODE when can end turn', () => {
      render(
        <PrimaryAction
          viewState="SUMMARY_MODE"
          canEndTurn={true}
          isMyTurn={true}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByText('End Turn')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('shows Waiting in WAITING_MODE', () => {
      render(
        <PrimaryAction
          viewState="WAITING_MODE"
          canEndTurn={false}
          isMyTurn={false}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByText('Waiting...')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('calls onContinueStory when clicked in STORY_MODE', () => {
      const onContinueStory = vi.fn();
      render(
        <PrimaryAction
          viewState="STORY_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
          onContinueStory={onContinueStory}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onContinueStory).toHaveBeenCalled();
    });

    it('calls onPerformAction when clicked in ACTION_MODE', () => {
      const onPerformAction = vi.fn();
      render(
        <PrimaryAction
          viewState="ACTION_MODE"
          actionPrompt={{
            type: 'dice_roll',
            label: 'Roll Dice',
            description: 'Roll'
          }}
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
          onPerformAction={onPerformAction}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onPerformAction).toHaveBeenCalled();
    });

    it('calls onEndTurn when clicked in SUMMARY_MODE', () => {
      const onEndTurn = vi.fn();
      render(
        <PrimaryAction
          viewState="SUMMARY_MODE"
          canEndTurn={true}
          isMyTurn={true}
          hasSelectedChoice={false}
          onEndTurn={onEndTurn}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onEndTurn).toHaveBeenCalled();
    });

    it('shows loading state when isLoading is true', () => {
      render(
        <PrimaryAction
          viewState="ACTION_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
          isLoading={true}
        />
      );

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('shows waiting message when not my turn', () => {
      render(
        <PrimaryAction
          viewState="SUMMARY_MODE"
          canEndTurn={true}
          isMyTurn={false}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByText('Waiting for other player...')).toBeInTheDocument();
    });

    it('renders container with test ID', () => {
      render(
        <PrimaryAction
          viewState="STORY_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={false}
        />
      );

      expect(screen.getByTestId('primary-action-container')).toBeInTheDocument();
      expect(screen.getByTestId('primary-action-button')).toBeInTheDocument();
    });

    it('calls onConfirmChoice when clicked in DECISION_MODE with selection', () => {
      const onConfirmChoice = vi.fn();
      render(
        <PrimaryAction
          viewState="DECISION_MODE"
          canEndTurn={false}
          isMyTurn={true}
          hasSelectedChoice={true}
          onConfirmChoice={onConfirmChoice}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onConfirmChoice).toHaveBeenCalled();
    });

    it('does not call handler when not my turn', () => {
      const onEndTurn = vi.fn();
      render(
        <PrimaryAction
          viewState="SUMMARY_MODE"
          canEndTurn={true}
          isMyTurn={false}
          hasSelectedChoice={false}
          onEndTurn={onEndTurn}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onEndTurn).not.toHaveBeenCalled();
    });
  });
});
