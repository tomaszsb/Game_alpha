// src/components/player/PlayerPanelWrapper.tsx
//
// Wrapper that renders the unified ActionCenterPanel for all screen sizes.

import React from 'react';
import { ActionCenterPanel, ActionCenterPanelProps } from './ActionCenterPanel';

export interface PlayerPanelWrapperProps extends ActionCenterPanelProps {
  /** Force mobile view regardless of screen size (for testing) */
  forceMobile?: boolean;

  /** Force desktop view regardless of screen size (for testing) */
  forceDesktop?: boolean;
}

/**
 * PlayerPanelWrapper - Renders ActionCenterPanel for all screen sizes.
 * The ActionCenterPanel handles its own responsive behavior internally.
 */
export const PlayerPanelWrapper: React.FC<PlayerPanelWrapperProps> = ({
  gameServices,
  playerId,
  forceMobile,
  forceDesktop,
  onTryAgain,
  playerNotification,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions,
  tabRequest,
  ...rest
}) => {
  return (
    <div className="player-panel-wrapper">
      <ActionCenterPanel
        gameServices={gameServices}
        playerId={playerId}
        onTryAgain={onTryAgain}
        playerNotification={playerNotification}
        onRollDice={onRollDice}
        onAutomaticFunding={onAutomaticFunding}
        onManualEffectResult={onManualEffectResult}
        completedActions={completedActions}
        tabRequest={tabRequest}
      />
    </div>
  );
};
