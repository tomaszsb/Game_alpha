// src/components/settings/GameDisplaySettings.tsx

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { getServerURL, getNetworkInfo } from '../../utils/networkDetection';

interface GameDisplaySettingsProps {
  players: Player[];
  visiblePanels: Record<string, boolean>;
  onTogglePanel: (playerId: string) => void;
  onClose: () => void;
}

export function GameDisplaySettings({
  players,
  visiblePanels,
  onTogglePanel,
  onClose
}: GameDisplaySettingsProps): JSX.Element {

  // Track QR code visibility for each player (Dec 29, 2025)
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

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Player Panels</h3>

            {players.length === 0 ? (
              <p style={styles.emptyState}>No players in game yet.</p>
            ) : (
              <div style={styles.playerList}>
                {players.map(player => {
                  const isConnected = !!player.deviceType; // Connected if deviceType is set (mobile OR desktop)
                  const isMobile = player.deviceType === 'mobile';
                  const isDesktop = player.deviceType === 'desktop';

                  // Compute actual visibility (matching GameLayout's shouldShowPlayerPanel logic)
                  let isVisible: boolean;
                  if (visiblePanels[player.id] === false) {
                    isVisible = false; // Explicitly hidden
                  } else if (visiblePanels[player.id] === true) {
                    isVisible = true; // Explicitly shown
                  } else {
                    // Default behavior: hide if connected, show if not connected
                    isVisible = !isConnected;
                  }

                  return (
                    <div key={player.id} style={styles.playerRow}>
                      {/* Checkbox */}
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => onTogglePanel(player.id)}
                          style={styles.checkbox}
                        />

                        {/* Player info */}
                        <span style={{
                          ...styles.playerName,
                          color: player.color || colors.primary.main
                        }}>
                          {player.avatar} {player.name}
                        </span>

                        {/* Connection status badge */}
                        {isMobile && (
                          <span style={styles.connectedBadge}>
                            ✅ Connected on mobile
                          </span>
                        )}

                        {isDesktop && (
                          <span style={styles.connectedBadge}>
                            ✅ Connected on desktop
                          </span>
                        )}

                        {!isConnected && (
                          <span style={styles.notConnectedBadge}>
                            💻 Not connected
                          </span>
                        )}
                      </label>

                      {/* Suggestion */}
                      {isMobile && isVisible && (
                        <span style={styles.suggestion}>
                          💡 Can hide (they're viewing on their phone)
                        </span>
                      )}

                      {isDesktop && isVisible && (
                        <span style={styles.suggestion}>
                          💡 Can hide (they're viewing on their computer)
                        </span>
                      )}

                      {!isConnected && !isVisible && (
                        <span style={styles.warning}>
                          ⚠️ Hidden (player can't see their panel!)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick preset buttons */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Quick Presets</h3>
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
                    const isConnected = !!p.deviceType; // Connected if deviceType is set
                    const isCurrentlyVisible = visiblePanels[p.id] !== false;

                    // Hide connected players, show disconnected players
                    if (isConnected && isCurrentlyVisible) {
                      onTogglePanel(p.id); // Hide it
                    } else if (!isConnected && !isCurrentlyVisible) {
                      onTogglePanel(p.id); // Show it
                    }
                  });
                }}
                style={styles.presetButton}
              >
                🎯 Hide Connected Only
              </button>
            </div>
          </div>

          {/* Connect Mobile Device - QR Codes (Dec 29, 2025) */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📱 Connect Mobile Device</h3>
            <p style={{ ...styles.description, marginBottom: '1rem' }}>
              Scan a QR code to play on your phone. Each player gets their own code.
            </p>

            {/* Network warning if on localhost */}
            {networkInfo.isLocalhost && (
              <div style={styles.networkWarning}>
                ⚠️ <strong>Warning:</strong> Running on localhost. QR codes will only work on this device.
              </div>
            )}

            <div style={styles.qrGrid}>
              {players.map(player => {
                const showQR = qrVisibility[player.id] || false;
                const playerURL = getServerURL(player.id, player.shortId);
                const isConnected = player.deviceType === 'mobile';

                return (
                  <div key={player.id} style={styles.qrCard}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>{player.avatar}</span>
                      <span style={{
                        fontWeight: 'bold',
                        color: player.color || colors.primary.main
                      }}>
                        {player.name}
                      </span>
                      {isConnected && (
                        <span style={styles.connectedBadgeSmall}>✅ Mobile</span>
                      )}
                    </div>

                    {isConnected ? (
                      <div style={styles.alreadyConnected}>
                        Already connected on mobile
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
                );
              })}
            </div>
          </div>
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
    marginBottom: '1.5rem',
    lineHeight: '1.5'
  },
  section: {
    marginBottom: '2rem'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem',
    color: colors.secondary.darker,
    fontWeight: 'bold'
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
  playerRow: {
    background: 'white',
    padding: '1rem',
    borderRadius: '8px',
    border: `2px solid ${colors.secondary.border}`
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
  presetButtons: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
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
  },
  // QR Code section styles (Dec 29, 2025)
  networkWarning: {
    background: colors.danger.light,
    color: colors.danger.text,
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '0.85rem'
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem'
  },
  qrCard: {
    background: 'white',
    padding: '1rem',
    borderRadius: '8px',
    border: `2px solid ${colors.secondary.border}`
  },
  connectedBadgeSmall: {
    fontSize: '0.75rem',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    background: colors.success.light,
    color: colors.success.text,
    marginLeft: 'auto'
  },
  alreadyConnected: {
    fontSize: '0.85rem',
    color: colors.success.main,
    fontStyle: 'italic',
    textAlign: 'center' as const,
    padding: '0.5rem'
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
  }
};
