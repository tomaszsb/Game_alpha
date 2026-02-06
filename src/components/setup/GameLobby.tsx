// src/components/setup/GameLobby.tsx
// Landing page for creating or joining a game session
// Redesigned for TV/wide screens - horizontal layout, no scrolling

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { getBackendURL } from '../../utils/networkDetection';

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
  createdAt: string;
}

interface GameLobbyProps {
  onJoinGame: (gameId: string) => void;
  mode?: 'tv';
}

export function GameLobby({ onJoinGame, mode }: GameLobbyProps): JSX.Element {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState<GitHubSyncStatus>({ status: 'checking' });

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
            // Fetch commit count difference
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

  // Fetch available games on mount
  useEffect(() => {
    fetchGames();
    // Refresh every 5 seconds
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games`);
      if (response.ok) {
        const data = await response.json();
        // Filter out legacy G0 game and empty games
        const activeGames = data.games.filter(
          (g: GameInfo) => g.gameId !== 'G0' && g.playerCount > 0
        );
        setGames(activeGames);
      }
    } catch (err) {
      console.log('Could not fetch games:', err);
    } finally {
      setLoading(false);
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
        onJoinGame(data.gameId);
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
    // Normalize to uppercase
    const normalizedId = gameId.trim().toUpperCase();
    onJoinGame(normalizedId);
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

      {/* Main content - horizontal layout */}
      <main style={styles.main}>
        {/* Left panel - Create New Game (hidden in TV mode) */}
        {mode !== 'tv' && (
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>🎮 New Game</h2>
          <p style={styles.panelDescription}>
            Start a fresh game session and invite friends to play
          </p>
          <button
            onClick={handleCreateGame}
            disabled={creating}
            style={{
              ...styles.primaryButton,
              backgroundColor: creating ? colors.neutral.gray[400] : colors.primary.main,
              cursor: creating ? 'wait' : 'pointer',
            }}
          >
            {creating ? 'Creating...' : 'Create Game'}
          </button>
        </section>
        )}

        {/* Center panel - Join by Code (hidden in TV mode) */}
        {mode !== 'tv' && (
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
        )}

        {/* Right panel - Active Games (only panel in TV mode) */}
        <section style={mode === 'tv' ? { ...styles.panel, maxWidth: '600px' } : styles.panel}>
          <h2 style={styles.panelTitle}>
            {mode === 'tv' ? '📺 Select Game to Display on TV' : '📋 Active Games'}
            {loading && <span style={styles.loadingDot}>...</span>}
          </h2>
          <div style={styles.gamesList}>
            {games.length === 0 ? (
              <p style={styles.noGames}>
                {loading ? 'Checking...' : 'No active games. Create one!'}
              </p>
            ) : (
              games.slice(0, 4).map((game) => (
                <button
                  key={game.gameId}
                  onClick={() => onJoinGame(game.gameId)}
                  style={styles.gameCard}
                >
                  <span style={styles.gameId}>{game.gameId}</span>
                  <span style={styles.gameInfo}>
                    {game.playerCount} player{game.playerCount !== 1 ? 's' : ''}
                  </span>
                  {game.playerNames.length > 0 && (
                    <span style={styles.playerNames}>
                      {game.playerNames.slice(0, 3).join(', ')}
                      {game.playerNames.length > 3 && '...'}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
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
    gap: 'clamp(1rem, 3vw, 2rem)',
    padding: 'clamp(1rem, 2vh, 2rem) clamp(1rem, 3vw, 2rem)',
    minHeight: 0,
  },
  panel: {
    flex: '1 1 0',
    maxWidth: '350px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: 'clamp(1rem, 2vh, 1.5rem)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  panelTitle: {
    fontSize: 'clamp(1rem, 2.5vh, 1.3rem)',
    fontWeight: 'bold',
    margin: '0 0 0.5rem 0',
    color: colors.neutral.black,
  },
  panelDescription: {
    fontSize: 'clamp(0.75rem, 1.5vh, 0.9rem)',
    color: colors.text.secondary,
    margin: '0 0 1rem 0',
    lineHeight: 1.4,
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
    marginTop: 'auto',
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
  gamesList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflow: 'auto',
    minHeight: 0,
  },
  noGames: {
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    fontSize: 'clamp(0.8rem, 1.5vh, 0.9rem)',
  },
  gameCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 'clamp(0.5rem, 1vh, 0.75rem)',
    backgroundColor: colors.background.light,
    border: `1px solid ${colors.secondary.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  gameId: {
    fontWeight: 'bold',
    fontSize: 'clamp(0.9rem, 1.8vh, 1.1rem)',
    color: colors.primary.main,
  },
  gameInfo: {
    fontSize: 'clamp(0.7rem, 1.3vh, 0.85rem)',
    color: colors.text.secondary,
  },
  playerNames: {
    fontSize: 'clamp(0.65rem, 1.2vh, 0.75rem)',
    color: colors.text.muted,
    marginTop: '0.25rem',
  },
  loadingDot: {
    marginLeft: '0.5rem',
    color: colors.text.secondary,
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
