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
import { IconMoon, IconSun, IconBookOpen } from '../icons/SetupIcons';

export interface PlayerPanelWrapperProps extends PlayerPanelProps {
  /** Force mobile view regardless of screen size (for testing) */
  forceMobile?: boolean;

  /** Force desktop view regardless of screen size (for testing) */
  forceDesktop?: boolean;

  /** Opens the shared glossary panel (GameLayout's handleToggleGlossary).
   *  Only passed on the per-player phone/controller view (GameLayout's
   *  effectiveViewPlayerId branch) — TV mode's phone is the only surface
   *  that had no glossary entry point at all (bug report 2026-07-22,
   *  "no way to access glossary words in tv mode"). Omitted on the desktop
   *  player-panel list so that view keeps its single entry point
   *  (ProjectProgress's toolbar) instead of one button per player card. */
  onOpenGlossary?: () => void;
}

export const PlayerPanelWrapper: React.FC<PlayerPanelWrapperProps> = ({
  gameServices,
  playerId,
  onTryAgain,
  playerNotification,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions,
  tabRequest,
  onOpenGlossary,
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
        {/* Phone/controller glossary entry point ("no way to access
            glossary words in tv mode", bug report 2026-07-22) — same icon + label as the desktop
            toolbar's Glossary button (ProjectProgress.tsx), reusing the
            existing DictionaryPanel/useDictionaryPanel rather than any new
            state. Only rendered here when GameLayout passes onOpenGlossary,
            i.e. on this player's own phone view — the desktop panel list
            already has one Glossary button up in ProjectProgress and doesn't
            need a second copy per player card. */}
        {onOpenGlossary && (
          <button style={toggleBtn} onClick={onOpenGlossary} title="Look up a term">
            <IconBookOpen size="1em" />
            Glossary
          </button>
        )}
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
