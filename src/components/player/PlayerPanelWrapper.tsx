// src/components/player/PlayerPanelWrapper.tsx
//
// Wrapper that renders the player panel for all screen sizes. PlayerPanelV2
// is now the only panel (the classic ActionCenterPanel + its classic/new
// toggle were removed 2026-07-14 — see docs/design/player-panel-redesign.md
// §7 for the redesign history). This wrapper's remaining job is owning the
// light/dark mode toggle and syncing the global dictionary panel's theme to it.

import React, { useEffect } from 'react';
import { PlayerPanelV2 } from './PlayerPanelV2';
import { PlayerPanelProps } from './panelTypes';
import { usePanelMode } from './panelTheme';
import { IconMoon, IconSun } from '../icons/SetupIcons';

export interface PlayerPanelWrapperProps extends PlayerPanelProps {
  /** Force mobile view regardless of screen size (for testing) */
  forceMobile?: boolean;

  /** Force desktop view regardless of screen size (for testing) */
  forceDesktop?: boolean;
}

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
  const [mode, toggleMode] = usePanelMode();

  // Tell the (global) dictionary side panel to go dark when the panel is in
  // dark mode — see docs/design §6 (the dictionary module already runs on
  // CSS variables, so this is just a variable override gated on this attribute).
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-uc-dark', mode === 'dark' ? 'true' : 'false');
    } catch {
      /* SSR / no document — ignore */
    }
  }, [mode]);

  const toggleBtn: React.CSSProperties = {
    border: '1px solid #8d9bb0',
    background: 'transparent',
    color: 'inherit',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3em',
  };

  return (
    <div className="player-panel-wrapper" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '4px 6px' }}>
        <button style={toggleBtn} onClick={toggleMode} title="Light / dark mode">
          {mode === 'light' ? <IconMoon size="1em" /> : <IconSun size="1em" />}
          {mode === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>

      <PlayerPanelV2
        gameServices={gameServices}
        playerId={playerId}
        mode={mode}
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
