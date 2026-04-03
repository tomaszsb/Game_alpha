// src/components/setup/GameLobby.tsx
// Merged landing + lobby screen: New Game (with mode toggle), Join by Code, Browse Games (admin)

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { getBackendURL } from '../../utils/networkDetection';
import { verifyAdminPassword, isAdminAuthenticated } from '../../utils/adminAuth';

interface GitHubSyncStatus {
  status: 'checking' | 'in-sync' | 'out-of-sync' | 'error';
  latestCommit?: string;
  commitsBehind?: number;
}

interface GameInfo {
  gameId: string;
  playerCount: number;
  playerNames: string[];
  gamePhase: string;
}

interface GameLobbyProps {
  onJoinGame: (gameId: string, mode?: 'tv') => void;
}

export function GameLobby({ onJoinGame }: GameLobbyProps): JSX.Element {
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState<GitHubSyncStatus>({ status: 'checking' });

  // Mode toggle state — default PC
  const [selectedMode, setSelectedMode] = useState<'pc' | 'tv'>('pc');

  // Admin / Browse Games state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(isAdminAuthenticated());
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [activeGames, setActiveGames] = useState<GameInfo[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

  // Check GitHub sync status on mount
  useEffect(() => {
    const checkGitHubSync = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/tomaszsb/Game_alpha/commits/master',
          { headers: { 'Accept': 'application/vnd.github.v3+json' } }
        );

        if (response.ok) {
          const data = await response.json();
          const latestCommit = data.sha.substring(0, 7);
          const currentCommit = __APP_VERSION__;

          if (latestCommit === currentCommit) {
            setSyncStatus({ status: 'in-sync', latestCommit });
          } else {
            const compareResponse = await fetch(
              `https://api.github.com/repos/tomaszsb/Game_alpha/compare/${currentCommit}...master`,
              { headers: { 'Accept': 'application/vnd.github.v3+json' } }
            );

            if (compareResponse.ok) {
              const compareData = await compareResponse.json();
              setSyncStatus({
                status: 'out-of-sync',
                latestCommit,
                commitsBehind: compareData.ahead_by || 0
              });
            } else {
              setSyncStatus({ status: 'out-of-sync', latestCommit });
            }
          }
        } else {
          setSyncStatus({ status: 'error' });
        }
      } catch (err) {
        console.log('Could not check GitHub sync:', err);
        setSyncStatus({ status: 'error' });
      }
    };

    checkGitHubSync();
  }, []);

  // Fetch active games when admin is unlocked
  const fetchActiveGames = async () => {
    try {
      setGamesLoading(true);
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games`);
      if (response.ok) {
        const data = await response.json();
        const games = data.games.filter(
          (g: GameInfo) => g.gameId !== 'G0' && g.playerCount > 0
        );
        setActiveGames(games);
      }
    } catch (err) {
      console.log('Could not fetch games:', err);
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminUnlocked) return;
    fetchActiveGames();
    const interval = setInterval(fetchActiveGames, 5000);
    return () => clearInterval(interval);
  }, [isAdminUnlocked]);

  const handleAdminVerify = async () => {
    if (!adminPassword.trim()) return;
    setAdminVerifying(true);
    setAdminError('');
    const success = await verifyAdminPassword(adminPassword);
    setAdminVerifying(false);
    if (success) {
      setIsAdminUnlocked(true);
      setShowAdminPrompt(false);
      setAdminPassword('');
    } else {
      setAdminError('Incorrect password');
    }
  };

  const handleCreateGame = async () => {
    setCreating(true);
    setError('');

    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        onJoinGame(data.gameId, selectedMode === 'tv' ? 'tv' : undefined);
      } else {
        setError('Failed to create game. Try again.');
      }
    } catch (err) {
      setError('Cannot connect to server. Is it running?');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGame = (gameId: string) => {
    if (!gameId.trim()) {
      setError('Please enter a game code');
      return;
    }
    const normalizedId = gameId.trim().toUpperCase();
    onJoinGame(normalizedId, selectedMode === 'tv' ? 'tv' : undefined);
  };

  const handleDeleteGame = async (gameId: string) => {
    if (deletingGameId) return;
    if (!window.confirm(`Delete game ${gameId}? This cannot be undone.`)) return;
    setDeletingGameId(gameId);
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games/${gameId}`, { method: 'DELETE' });
      if (response.ok) {
        setActiveGames(prev => prev.filter(g => g.gameId !== gameId));
      } else {
        setError(`Failed to delete ${gameId}`);
      }
    } catch (err) {
      setError(`Cannot connect to server`);
    } finally {
      setDeletingGameId(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background */}
      <div style={styles.background} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <img
            src="/images/logo.png"
            alt="Unravel Codes"
            style={styles.logo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div style={styles.headerText}>
            <h1 style={styles.title}>Unravel Codes: The Game</h1>
            <p style={styles.subtitle}>A multiplayer project management adventure</p>
          </div>
        </div>
        <div style={styles.versionInfo}>
          <span>v{__APP_VERSION__}</span>
          {syncStatus.status === 'in-sync' && <span style={{ color: '#22c55e' }}> ✓</span>}
          {syncStatus.status === 'out-of-sync' && (
            <span style={{ color: '#f59e0b' }}> ⚠ {syncStatus.commitsBehind || ''} behind</span>
          )}
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={() => setError('')} style={styles.errorClose}>×</button>
        </div>
      )}

      {/* Main content - 3 panels */}
      <main style={styles.main}>
        {/* Panel 1 - New Game with mode toggle */}
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>🎮 New Game</h2>
          <p style={styles.panelDescription}>
            Start a fresh game session and invite friends to play
          </p>

          {/* Mode toggle */}
          <div style={styles.modeToggle}>
            <button
              onClick={() => setSelectedMode('pc')}
              style={{
                ...styles.modeButton,
                backgroundColor: selectedMode === 'pc' ? colors.primary.main : 'transparent',
                color: selectedMode === 'pc' ? 'white' : colors.text.secondary,
                borderColor: selectedMode === 'pc' ? colors.primary.main : colors.secondary.border,
              }}
            >
              🖥️ PC
            </button>
            <button
              onClick={() => setSelectedMode('tv')}
              style={{
                ...styles.modeButton,
                backgroundColor: selectedMode === 'tv' ? '#9c27b0' : 'transparent',
                color: selectedMode === 'tv' ? 'white' : colors.text.secondary,
                borderColor: selectedMode === 'tv' ? '#9c27b0' : colors.secondary.border,
              }}
            >
              📺 TV
            </button>
          </div>
          <p style={styles.modeDescription}>
            {selectedMode === 'pc'
              ? 'All players share one screen, taking turns. Mobile devices are optional \u2014 players can scan QR codes to join from their phones.'
              : 'Display the game board on a TV or large screen. Each player needs their own phone or tablet to play.'}
          </p>

          <button
            onClick={handleCreateGame}
            disabled={creating}
            style={{
              ...styles.primaryButton,
              backgroundColor: creating ? colors.neutral.gray[400] : (selectedMode === 'tv' ? '#9c27b0' : colors.primary.main),
              cursor: creating ? 'wait' : 'pointer',
            }}
          >
            {creating ? 'Creating...' : 'Create Game'}
          </button>
        </section>

        {/* Panel 2 - Join by Code */}
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>🔗 Join by Code</h2>
          <p style={styles.panelDescription}>
            Enter a game code to join an existing session
          </p>
          <div style={styles.joinForm}>
            <input
              type="text"
              placeholder="e.g., G1"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGame(joinCode)}
              style={styles.codeInput}
              maxLength={10}
              autoComplete="off"
              name="gamecode"
              data-lpignore="true"
              data-1p-ignore
            />
            <button
              onClick={() => handleJoinGame(joinCode)}
              style={styles.joinButton}
            >
              Join
            </button>
          </div>
        </section>

        {/* Panel 3 - Browse Games (admin-locked) */}
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>📋 Browse Games</h2>

          {isAdminUnlocked ? (
            <>
              <div style={styles.gameListHeader}>
                <span style={{ fontSize: '0.8rem', color: colors.text.secondary }}>
                  Active games {gamesLoading && '...'}
                </span>
              </div>
              <div style={styles.gameList}>
                {activeGames.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: colors.text.secondary, fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>
                    No active games
                  </div>
                ) : (
                  activeGames.map(game => (
                    <div key={game.gameId} style={styles.gameRow}>
                      <span style={{ fontWeight: 'bold', color: colors.primary.main, minWidth: '2.5rem' }}>
                        {game.gameId}
                      </span>
                      <span style={{ color: colors.text.secondary, flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {game.playerCount}p{game.playerNames.length > 0 && `: ${game.playerNames.slice(0, 3).join(', ')}`}
                        {game.playerNames.length > 3 && '...'}
                      </span>
                      <button
                        onClick={() => handleJoinGame(game.gameId)}
                        style={styles.gameActionButton}
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game.gameId)}
                        disabled={deletingGameId === game.gameId}
                        style={styles.gameDeleteButton}
                      >
                        {deletingGameId === game.gameId ? '...' : '✕'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : showAdminPrompt ? (
            <div style={styles.adminPrompt}>
              <p style={{ fontSize: '0.85rem', color: colors.text.secondary, margin: '0 0 0.75rem 0' }}>
                Enter admin password to browse games
              </p>
              <div style={styles.joinForm}>
                <input
                  type="password"
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminVerify()}
                  style={{ ...styles.codeInput, textAlign: 'left', letterSpacing: 'normal' }}
                  autoComplete="off"
                />
                <button
                  onClick={handleAdminVerify}
                  disabled={adminVerifying}
                  style={styles.joinButton}
                >
                  {adminVerifying ? '...' : 'OK'}
                </button>
              </div>
              {adminError && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: '0.5rem 0 0 0' }}>{adminError}</p>
              )}
              <button
                onClick={() => { setShowAdminPrompt(false); setAdminError(''); setAdminPassword(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: colors.text.muted, marginTop: '0.5rem' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={styles.lockedContent}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
              <p style={{ fontSize: '0.85rem', color: colors.text.secondary, margin: '0 0 1rem 0' }}>
                Admin access required to browse games
              </p>
              <button
                onClick={() => setShowAdminPrompt(true)}
                style={styles.adminButton}
              >
                Unlock
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>Alpha Version</span>
        <span style={styles.footerDot}>•</span>
        <a href="mailto:game@unravelcodes.com" style={styles.footerLink}>
          game@unravelcodes.com
        </a>
      </footer>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    position: 'relative',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(135deg, ${colors.primary.light} 0%, ${colors.background.secondary} 50%, ${colors.secondary.light} 100%)`,
    zIndex: -1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'clamp(0.5rem, 1.5vh, 1rem) clamp(1rem, 3vw, 2rem)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottom: `1px solid ${colors.secondary.border}`,
    flexShrink: 0,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  logo: {
    height: 'clamp(30px, 5vh, 50px)',
    width: 'auto',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: 'clamp(1rem, 2.5vh, 1.5rem)',
    fontWeight: 'bold',
    margin: 0,
    color: colors.neutral.black,
  },
  subtitle: {
    fontSize: 'clamp(0.7rem, 1.5vh, 0.9rem)',
    margin: 0,
    color: colors.text.secondary,
  },
  versionInfo: {
    fontSize: 'clamp(0.6rem, 1.2vh, 0.75rem)',
    fontFamily: 'monospace',
    color: colors.text.secondary,
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: 'clamp(0.8rem, 1.5vh, 1rem)',
    flexShrink: 0,
  },
  errorClose: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: '#dc2626',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 'clamp(1rem, 2vw, 2rem)',
    padding: 'clamp(1rem, 2vh, 2rem) clamp(1rem, 3vw, 2rem)',
    minHeight: 0,
  },
  panel: {
    flex: '1 1 0',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: 'clamp(1.25rem, 2.5vh, 1.75rem)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    minHeight: '220px',
  },
  panelTitle: {
    fontSize: 'clamp(1.1rem, 2.5vh, 1.4rem)',
    fontWeight: 'bold',
    margin: '0 0 0.75rem 0',
    color: colors.neutral.black,
  },
  panelDescription: {
    fontSize: 'clamp(0.8rem, 1.5vh, 0.95rem)',
    color: colors.text.secondary,
    margin: '0 0 1rem 0',
    lineHeight: 1.5,
  },
  modeToggle: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  modeButton: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: 'clamp(0.8rem, 1.5vh, 0.95rem)',
    fontWeight: 'bold',
    border: '2px solid',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeDescription: {
    fontSize: 'clamp(0.75rem, 1.3vh, 0.85rem)',
    color: colors.text.secondary,
    margin: '0 0 1rem 0',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: colors.primary.main,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: 'clamp(0.75rem, 2vh, 1rem) 1.5rem',
    fontSize: 'clamp(0.9rem, 2vh, 1.1rem)',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 'auto',
  },
  joinForm: {
    display: 'flex',
    gap: '0.5rem',
  },
  codeInput: {
    flex: 1,
    padding: 'clamp(0.5rem, 1.5vh, 0.75rem)',
    fontSize: 'clamp(1rem, 2vh, 1.25rem)',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    border: `2px solid ${colors.secondary.border}`,
    borderRadius: '8px',
    letterSpacing: '0.1em',
  },
  joinButton: {
    backgroundColor: colors.success.main,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: 'clamp(0.5rem, 1.5vh, 0.75rem) clamp(1rem, 2vw, 1.5rem)',
    fontSize: 'clamp(0.9rem, 2vh, 1rem)',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  // Browse Games panel styles
  gameListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  gameList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  gameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.6rem',
    backgroundColor: colors.background.secondary,
    borderRadius: '6px',
    border: `1px solid ${colors.secondary.border}`,
    fontSize: '0.85rem',
  },
  gameActionButton: {
    padding: '0.25rem 0.6rem',
    backgroundColor: colors.primary.main,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  gameDeleteButton: {
    padding: '0.25rem 0.45rem',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  lockedContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: colors.secondary.dark,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  adminPrompt: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem',
    color: colors.text.muted,
    fontSize: 'clamp(0.65rem, 1.2vh, 0.8rem)',
    flexShrink: 0,
  },
  footerDot: {
    opacity: 0.5,
  },
  footerLink: {
    color: colors.primary.main,
    textDecoration: 'none',
  },
};
