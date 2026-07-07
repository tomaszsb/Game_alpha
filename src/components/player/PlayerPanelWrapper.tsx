// src/components/player/PlayerPanelWrapper.tsx
//
// Wrapper that renders the player panel for all screen sizes. Hosts the
// classic ↔ new design toggle (see docs/design/player-panel-redesign.md §7):
// 'new' (default) renders the redesigned PlayerPanelV2 with its own
// light/dark switch; 'classic' renders the legacy ActionCenterPanel. The
// toggle now exists to compare against the old behavior, not to gate rollout.

import React, { useEffect } from 'react';
import { ActionCenterPanel, ActionCenterPanelProps } from './ActionCenterPanel';
import { PlayerPanelV2 } from './PlayerPanelV2';
import { usePanelMode, usePanelVersion } from './panelTheme';

export interface PlayerPanelWrapperProps extends ActionCenterPanelProps {
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
  const [version, toggleVersion] = usePanelVersion();
  const [mode, toggleMode] = usePanelMode();

  // Tell the (global) dictionary side panel to go dark when the new panel is
  // in dark mode — see docs/design §6 (the dictionary module already runs on
  // CSS variables, so this is just a variable override gated on this attribute).
  useEffect(() => {
    const dark = version === 'new' && mode === 'dark';
    try {
      document.documentElement.setAttribute('data-uc-dark', dark ? 'true' : 'false');
    } catch {
      /* SSR / no document — ignore */
    }
  }, [version, mode]);

  const toggleBtn: React.CSSProperties = {
    border: '1px solid #8d9bb0',
    background: 'transparent',
    color: 'inherit',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
  };

  return (
    <div className="player-panel-wrapper" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '4px 6px' }}>
        <button style={toggleBtn} onClick={toggleVersion} title="Switch between the classic and redesigned panel">
          {version === 'classic' ? 'Try new design' : 'Back to classic'}
        </button>
        {version === 'new' && (
          <button style={toggleBtn} onClick={toggleMode} title="Light / dark mode">
            {mode === 'light' ? 'Dark' : 'Light'}
          </button>
        )}
      </div>

      {version === 'new' ? (
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
      ) : (
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
      )}
    </div>
  );
};
