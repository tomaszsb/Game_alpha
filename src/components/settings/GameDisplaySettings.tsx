// src/components/settings/GameDisplaySettings.tsx

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { getServerURL, getNetworkInfo } from '../../utils/networkDetection';
import { AvatarIcon } from '../icons/AvatarIcons';
import { IconCheck } from '../icons/SetupIcons';

interface GameDisplaySettingsProps {
  players: Player[];
  visiblePanels: Record<string, boolean>;
  onTogglePanel: (playerId: string) => void;
  onClose: () => void;
  /** Callback to clear a player's device connection status */
  onClearDeviceType?: (playerId: string) => void;
}

export function GameDisplaySettings({
  players,
  visiblePanels,
  onTogglePanel,
  onClose,
  onClearDeviceType
}: GameDisplaySettingsProps): JSX.Element {

  const [qrVisibility, setQrVisibility] = useState<Record<string, boolean>>({});
  const networkInfo = getNetworkInfo();

  const toggleQR = (playerId: string) => {
    setQrVisibility(prev => ({
      ...prev,
      [playerId]: !prev[playerId]
    }));
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>👁️ Display Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>&times;</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <p style={styles.description}>
            Choose which player panels to show on this screen.
            Players connected on their own devices can be hidden to save space.
          </p>

          {/* Quick Presets */}
          {players.length > 0 && (
            <div style={styles.presetButtons}>
              <button
                onClick={() => players.forEach(p => onTogglePanel(p.id))}
                style={styles.presetButton}
              >
                👥 Show All Panels
              </button>
              <button
                onClick={() => {
                  players.forEach(p => {
                    const isConnected = !!p.deviceType;
                    const isCurrentlyVisible = visiblePanels[p.id] !== false;
                    if (isConnected && isCurrentlyVisible) {
                      onTogglePanel(p.id);
                    } else if (!isConnected && !isCurrentlyVisible) {
                      onTogglePanel(p.id);
                    }
                  });
                }}
                style={styles.presetButton}
              >
                🎯 Hide Connected Only
              </button>
            </div>
          )}

          {/* Localhost warning */}
          {networkInfo.isLocalhost && (
            <div style={styles.networkWarning}>
              ⚠️ <strong>Warning:</strong> Running on localhost. QR codes will only work on this device.
            </div>
          )}

          {/* Per-player cards */}
          {players.length === 0 ? (
            <p style={styles.emptyState}>No players in game yet.</p>
          ) : (
            <div style={styles.playerList}>
              {players.map(player => {
                const isConnected = !!player.deviceType;
                const isMobile = player.deviceType === 'mobile';
                const isDesktop = player.deviceType === 'desktop';
                const showQR = qrVisibility[player.id] || false;
                const playerURL = getServerURL(player.id, player.shortId);

                let isVisible: boolean;
                if (visiblePanels[player.id] === false) {
                  isVisible = false;
                } else if (visiblePanels[player.id] === true) {
                  isVisible = true;
                } else {
                  isVisible = !isConnected;
                }

                return (
                  <div key={player.id} style={{
                    ...styles.playerCard,
                    borderColor: player.color || colors.primary.main
                  }}>
                    {/* Row 1: Checkbox + avatar/name + connection badge */}
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => onTogglePanel(player.id)}
                        style={styles.checkbox}
                      />
                      <span style={{
                        ...styles.playerName,
                        color: player.color || colors.primary.main
                      }}>
                        <AvatarIcon avatar={player.avatar} size="1em" /> {player.name}
                      </span>

                      {isMobile && (
                        <span style={{ ...styles.connectedBadge, display: 'inline-flex', alignItems: 'center', gap: '0.3em' }}>
                          <IconCheck size="0.9em" /> Connected on mobile
                        </span>
                      )}
                      {isDesktop && (
                        <span style={styles.connectedBadge}>✅ Connected on desktop</span>
                      )}
                      {!isConnected && (
                        <span style={styles.notConnectedBadge}>💻 Not connected</span>
                      )}
                    </label>

                    {/* Row 2: Suggestion/warning text */}
                    {isMobile && isVisible && (
                      <span style={styles.suggestion}>
                        💡 Can hide (they’re viewing on their phone)
                      </span>
                    )}
                    {isDesktop && isVisible && (
                      <span style={styles.suggestion}>
                        💡 Can hide (they’re viewing on their computer)
                      </span>
                    )}
                    {!isConnected && !isVisible && (
                      <span style={styles.warning}>
                        ⚠️ Hidden (player can’t see their panel!)
                      </span>
                    )}

                    {/* Row 3: QR / mobile connection */}
                    <div style={styles.qrSection}>
                      {isMobile ? (
                        <div style={styles.alreadyConnected}>
                          <span>Already connected on mobile</span>
                          {onClearDeviceType && (
                            <button
                              onClick={() => onClearDeviceType(player.id)}
                              style={styles.resetButton}
                              title="Clear connection status to show QR code again"
                            >
                              🔄 Reset
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => toggleQR(player.id)}
                            style={{
                              ...styles.qrToggleButton,
                              background: showQR ? colors.primary.main : colors.primary.light,
                              color: showQR ? 'white' : colors.primary.text
                            }}
                          >
                            {showQR ? '🔽 Hide QR' : '📱 Show QR'}
                          </button>

                          {showQR && (
                            <div style={styles.qrDisplay}>
                              <div style={{
                                ...styles.qrCodeWrapper,
                                borderColor: player.color || colors.primary.main
                              }}>
                                <QRCodeSVG
                                  value={playerURL}
                                  size={140}
                                  level="M"
                                  includeMargin={true}
                                  fgColor={player.color || colors.primary.main}
                                />
                              </div>
                              <div style={styles.qrUrl}>
                                {playerURL}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.doneButton}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modal: {
    background: colors.secondary.bg,
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
  },
  header: {
    padding: '1.5rem',
    borderBottom: `2px solid ${colors.secondary.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    color: colors.primary.main
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    cursor: 'pointer',
    color: colors.secondary.main,
    padding: '0',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    padding: '1.5rem',
    overflowY: 'auto',
    flex: 1
  },
  description: {
    color: colors.secondary.dark,
    marginBottom: '1rem',
    lineHeight: '1.5'
  },
  presetButtons: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '1rem'
  },
  presetButton: {
    padding: '0.75rem 1rem',
    background: colors.primary.light,
    color: colors.primary.text,
    border: `2px solid ${colors.primary.main}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  },
  networkWarning: {
    background: colors.danger.light,
    color: colors.danger.text,
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '0.85rem'
  },
  emptyState: {
    color: colors.secondary.main,
    fontStyle: 'italic',
    padding: '1rem',
    textAlign: 'center'
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  playerCard: {
    background: 'white',
    padding: '1rem',
    borderRadius: '8px',
    border: '2px solid'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  playerName: {
    fontWeight: 'bold',
    fontSize: '1.1rem'
  },
  connectedBadge: {
    marginLeft: 'auto',
    fontSize: '0.85rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    background: colors.success.light,
    color: colors.success.text
  },
  notConnectedBadge: {
    marginLeft: 'auto',
    fontSize: '0.85rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    background: colors.secondary.light,
    color: colors.secondary.dark
  },
  suggestion: {
    display: 'block',
    marginTop: '0.5rem',
    fontSize: '0.85rem',
    color: colors.secondary.main,
    fontStyle: 'italic'
  },
  warning: {
    display: 'block',
    marginTop: '0.5rem',
    fontSize: '0.85rem',
    color: colors.danger.main,
    fontWeight: 'bold'
  },
  qrSection: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: `1px solid ${colors.secondary.border}`
  },
  alreadyConnected: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.85rem',
    color: colors.success.main,
    fontStyle: 'italic'
  },
  resetButton: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.75rem',
    background: colors.secondary.light,
    color: colors.secondary.dark,
    border: `1px solid ${colors.secondary.border}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontStyle: 'normal',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  },
  qrToggleButton: {
    width: '100%',
    padding: '0.5rem',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  },
  qrDisplay: {
    marginTop: '0.75rem',
    textAlign: 'center' as const
  },
  qrCodeWrapper: {
    display: 'inline-block',
    padding: '0.5rem',
    background: 'white',
    borderRadius: '8px',
    border: '2px solid'
  },
  qrUrl: {
    marginTop: '0.5rem',
    fontSize: '0.65rem',
    color: colors.secondary.main,
    wordBreak: 'break-all' as const,
    fontFamily: 'monospace',
    background: colors.secondary.bg,
    padding: '0.25rem',
    borderRadius: '4px'
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: `2px solid ${colors.secondary.border}`,
    display: 'flex',
    justifyContent: 'flex-end'
  },
  doneButton: {
    padding: '0.75rem 2rem',
    background: colors.primary.main,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold'
  }
};
