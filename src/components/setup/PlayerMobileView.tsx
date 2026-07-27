// src/components/setup/PlayerMobileView.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { AVAILABLE_COLORS, ColorOption } from './usePlayerValidation';
import { Player } from '../../types/StateTypes';
import { getCurrentGameId } from '../../utils/networkDetection';
import { GitHubSyncStatus } from './useGitHubSyncStatus';
import { styles } from './PlayerSetup.styles';
import { ShareIcon, useShareGameLink } from './ShareGameButton';
import { IconCheck, IconWarning, IconBug } from '../icons/SetupIcons';
import { LogoTransform } from '../icons/LogoTransform';

interface PlayerMobileViewProps {
  /** The player this device is controlling, or undefined if not found yet. */
  player: Player | undefined;
  onUpdatePlayer: (playerId: string, property: string, value: string) => void;
  onCycleAvatar: (playerId: string) => void;
  appSemver: string;
  appCommit: string;
  syncStatus: GitHubSyncStatus;
}

/**
 * Simplified mobile view shown to a single player during setup: just their
 * own avatar/name/color card plus a "waiting for host" message. Split out of
 * PlayerSetup.tsx's `viewPlayerId` branch — a self-contained render path that
 * shares almost no JSX with the host/setup screen.
 */
export function PlayerMobileView({
  player,
  onUpdatePlayer,
  onCycleAvatar,
  appSemver,
  appCommit,
  syncStatus,
}: PlayerMobileViewProps): JSX.Element {
  // Same invite mechanism as the host/PC screen's ShareGameButton (navigator.share
  // -> clipboard fallback) — called unconditionally so hook order stays stable
  // even on the "player not found" early return below. fb:2c848b47 ("Share
  // icon" / "Not seen on phone") — this screen previously had no way at all
  // for a player to invite someone else from their own phone.
  const { hasGame, copied, handleShare } = useShareGameLink();

  if (!player) {
    return (
      <div style={styles.container}>
        <div style={styles.background} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem' }}>
          Player not found. The host may not have added you yet.
        </div>
      </div>
    );
  }

  return (
    <div className="us-setup-fullheight" style={styles.container}>
      <style>{`
        .us-setup-fullheight { height: 100vh; height: 100dvh; }
        .us-hero-logo-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .us-hero-glow {
          position: absolute; inset: -28%; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 72%);
          filter: blur(5px); pointer-events: none;
          animation: usHeroGlow 4.5s ease-in-out infinite;
        }
        .us-hero-logo-img { position: relative; transform-origin: 50% 82%; animation: usHeroWobble 6.5s ease-in-out infinite; }
        @keyframes usHeroGlow { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
        @keyframes usHeroWobble { 0%, 100% { transform: rotate(-3.5deg); } 50% { transform: rotate(3.5deg); } }
        @media (prefers-reduced-motion: reduce) {
          .us-hero-glow, .us-hero-logo-img { animation: none; }
        }
      `}</style>
      <div style={styles.background} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div className="us-hero-logo-wrap">
            <div className="us-hero-glow" aria-hidden="true" />
            <LogoTransform className="us-hero-logo-img" style={styles.logo} />
          </div>
          <div>
            <h1 style={styles.title}>Unravel Codes: The Game</h1>
            <p style={styles.subtitle}>Setting up your player</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {appSemver && (
            <div
              style={styles.versionInfo}
              title={
                appCommit
                  ? `Build ${appCommit}${syncStatus.latestCommit ? ` · latest on master: ${syncStatus.latestCommit}` : ''}`
                  : 'Build commit hash unavailable'
              }
            >
              <span>v{appSemver}</span>
              {appCommit && <span style={styles.versionCommit}> · {appCommit}</span>}
              {syncStatus.status === 'in-sync' && (
                <span style={{ ...styles.versionInSync, display: 'inline-flex', alignItems: 'center', gap: '0.2em' }}>
                  {' '}<IconCheck size="0.85em" />
                </span>
              )}
              {syncStatus.status === 'out-of-sync' && (
                <span style={{ ...styles.versionBehind, display: 'inline-flex', alignItems: 'center', gap: '0.25em' }}>
                  {' '}<IconWarning size="0.85em" /> {syncStatus.commitsBehind ? `${syncStatus.commitsBehind} ` : ''}behind
                </span>
              )}
            </div>
          )}
          {getCurrentGameId() && (
            <div style={styles.gameCodeBadge}>
              <span style={styles.gameCodeLabel}>Game: </span>
              <span style={styles.gameCodeValue}>{getCurrentGameId()}</span>
            </div>
          )}
        </div>
      </header>

      {/* Player card */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 1rem', gap: '1.5rem' }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: '400px',
          border: `4px solid ${player.color}`,
        }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div
              style={{ fontSize: '3.5rem', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => onCycleAvatar(player.id)}
              title="Tap to change avatar"
            >
              {player.avatar}
            </div>
            <div style={{ fontSize: '0.8rem', color: colors.secondary.main, marginTop: '0.25rem' }}>
              Tap to change
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', color: colors.secondary.dark, fontSize: '0.9rem' }}>
              Your Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={player.name}
              onChange={(e) => onUpdatePlayer(player.id, 'name', e.target.value)}
              maxLength={20}
              style={{
                padding: '0.75rem',
                border: `2px solid ${player.color}`,
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Color picker */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', color: colors.secondary.dark, fontSize: '0.9rem' }}>
              Your Color
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {AVAILABLE_COLORS.map((colorOption: ColorOption) => {
                const isSelected = player.color === colorOption.color;
                return (
                  <button
                    key={colorOption.color}
                    onClick={() => onUpdatePlayer(player.id, 'color', colorOption.color)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: colorOption.color,
                      border: isSelected ? `3px solid ${colors.success.text}` : `2px solid ${colors.secondary.light}`,
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                    }}
                    title={colorOption.name}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Invite a friend — same navigator.share/clipboard-fallback mechanism
            as the host screen's Share button (see ShareGameButton.tsx), sized
            for a thumb tap and styled to match this screen's white-card look
            instead of the PC header's small translucent pill. */}
        {hasGame && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Invite a friend to this game"
              title="Share a link so others can join this game"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'rgba(255,255,255,0.9)',
                color: colors.text.secondary,
                border: 'none',
                borderRadius: '999px',
                padding: '0.7rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
              }}
            >
              <ShareIcon /> Invite a Friend
            </button>
            {copied && (
              <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600 }}>
                Copied!
              </span>
            )}
          </div>
        )}

        {/* Waiting message */}
        <div style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.9)',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          ⏳ Waiting for the host to start the game...
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </main>

      <footer style={styles.footer}>
        <strong>Beta Version</strong> · Bug? Use the <IconBug size="0.95em" style={{ margin: '0 0.15em' }} /> button (bottom-right) · <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
      </footer>
    </div>
  );
}
