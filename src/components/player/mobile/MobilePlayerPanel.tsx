// src/components/player/mobile/MobilePlayerPanel.tsx
//
// Main mobile container for the player panel.
// Uses PlayerViewStateService for context-aware rendering.
// Created: January 24, 2026

import React, { useState, useEffect, useCallback } from 'react';
import { IServiceContainer } from '../../../types/ServiceContracts';
import {
  PlayerViewStateService,
  ViewStateContext
} from '../../../services/PlayerViewStateService';
import { SpaceHeader } from './SpaceHeader';
import { StatsBar } from './StatsBar';
import { PrimaryAction } from './PrimaryAction';
import { ContextArea } from './ContextArea';
import './MobilePlayerPanel.css';

export interface MobilePlayerPanelProps {
  /** Game services container */
  gameServices: IServiceContainer;

  /** ID of the player whose panel to display */
  playerId: string;

  /** PlayerViewStateService instance (injected) */
  viewStateService: PlayerViewStateService;

  /** Callback to handle dice roll action */
  onRollDice?: () => Promise<void>;

  /** Callback to handle end turn */
  onEndTurn?: () => Promise<void>;

  /** Callback when stat is tapped (opens detail sheet) */
  onStatTap?: (stat: 'money' | 'time' | 'cards' | 'scope') => void;

  /** Callback when player makes a choice selection */
  onChoiceSelect?: (choiceId: string) => void;

  /** Callback when player confirms their choice */
  onChoiceConfirm?: () => void;

  /** Player notification message */
  playerNotification?: string;
}

/**
 * MobilePlayerPanel - Context-aware mobile player panel.
 *
 * Features:
 * - Compact header with space/player info
 * - Context area that changes based on game state
 * - Horizontal stats bar
 * - Sticky primary action button
 *
 * Uses PlayerViewStateService to determine what to display.
 */
export const MobilePlayerPanel: React.FC<MobilePlayerPanelProps> = ({
  gameServices,
  playerId,
  viewStateService,
  onRollDice,
  onEndTurn,
  onStatTap,
  onChoiceSelect,
  onChoiceConfirm,
  playerNotification
}) => {
  const [viewContext, setViewContext] = useState<ViewStateContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to view state changes
  useEffect(() => {
    const unsubscribe = viewStateService.subscribe(playerId, (context) => {
      setViewContext(context);
    });

    return unsubscribe;
  }, [viewStateService, playerId]);

  // Handle story continuation
  const handleContinueStory = useCallback(() => {
    viewStateService.markStoryRead(playerId);
  }, [viewStateService, playerId]);

  // Handle action (dice roll, manual effect, etc.)
  const handlePerformAction = useCallback(async () => {
    if (!onRollDice) return;

    setIsLoading(true);
    try {
      await onRollDice();
    } finally {
      setIsLoading(false);
    }
  }, [onRollDice]);

  // Handle end turn
  const handleEndTurn = useCallback(async () => {
    if (!onEndTurn) return;

    setIsLoading(true);
    try {
      await onEndTurn();
    } finally {
      setIsLoading(false);
    }
  }, [onEndTurn]);

  // Handle choice confirmation
  const handleConfirmChoice = useCallback(() => {
    onChoiceConfirm?.();
  }, [onChoiceConfirm]);

  // Wait for view context
  if (!viewContext) {
    return (
      <div className="mobile-player-panel mobile-player-panel--loading">
        <div className="mobile-player-panel__loader">Loading...</div>
      </div>
    );
  }

  const hasSelectedChoice = !!viewContext.selectedChoiceId;

  return (
    <div className="mobile-player-panel">
      {/* Header */}
      <SpaceHeader
        spaceName={viewContext.spaceName}
        spaceTitle={viewContext.spaceTitle}
        visitType={viewContext.visitType}
        playerName={viewContext.playerName}
        playerAvatar={viewContext.playerAvatar}
        playerColor={viewContext.playerColor}
      />

      {/* Notification banner */}
      {playerNotification && (
        <div className="mobile-player-panel__notification">
          <span className="notification-icon">📢</span>
          <span className="notification-text">{playerNotification}</span>
        </div>
      )}

      {/* Context Area - Content changes based on view state */}
      <div className="mobile-player-panel__context">
        <ContextArea
          viewContext={viewContext}
          onContinueStory={handleContinueStory}
          onChoiceSelect={onChoiceSelect}
        />
      </div>

      {/* Stats Bar */}
      <StatsBar
        money={viewContext.stats.money}
        timeSpent={viewContext.stats.timeSpent}
        cardCount={viewContext.stats.cardCount}
        projectScope={viewContext.stats.projectScope}
        onStatTap={onStatTap}
      />

      {/* Primary Action */}
      <PrimaryAction
        viewState={viewContext.state}
        actionPrompt={viewContext.actionPrompt}
        canEndTurn={viewContext.canEndTurn}
        isMyTurn={viewContext.isMyTurn}
        hasSelectedChoice={hasSelectedChoice}
        isLoading={isLoading}
        onContinueStory={handleContinueStory}
        onPerformAction={handlePerformAction}
        onEndTurn={handleEndTurn}
        onConfirmChoice={handleConfirmChoice}
      />
    </div>
  );
};
