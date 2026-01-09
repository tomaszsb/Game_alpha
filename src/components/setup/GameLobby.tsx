// src/components/setup/GameLobby.tsx
// Landing page for creating or joining a game session

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
}

export function GameLobby({ onJoinGame }: GameLobbyProps): JSX.Element {
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
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background.secondary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <img
          src="/images/logo.png"
          alt="Unravel Codes"
          style={{
            width: '150px',
            height: 'auto',
            marginBottom: '1rem'
          }}
        />

        {/* Header */}
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          color: colors.neutral.black
        }}>
          Unravel Codes: The Game
        </h1>
        <p style={{
          fontSize: '1rem',
          color: colors.text.secondary,
          marginBottom: '1.5rem',
          lineHeight: '1.5'
        }}>
          A multiplayer project management adventure!
          <br />
          <span style={{ fontSize: '0.9rem' }}>
            Create a new game or join an existing one to play with friends.
          </span>
        </p>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* Create New Game */}
        <div style={{
          backgroundColor: colors.secondary.bg,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '1.3rem',
            marginBottom: '1rem',
            color: colors.neutral.black
          }}>
            Start New Game
          </h2>
          <button
            onClick={handleCreateGame}
            disabled={creating}
            style={{
              backgroundColor: creating ? colors.neutral.gray[400] : colors.primary.main,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              cursor: creating ? 'wait' : 'pointer',
              width: '100%',
              fontWeight: 'bold'
            }}
          >
            {creating ? 'Creating...' : 'Create Game'}
          </button>
        </div>

        {/* Join Existing Game */}
        <div style={{
          backgroundColor: colors.secondary.bg,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '1.3rem',
            marginBottom: '1rem',
            color: colors.neutral.black
          }}>
            Join Game
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter code (e.g., G1)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGame(joinCode)}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1.1rem',
                border: `1px solid ${colors.neutral.gray[300]}`,
                borderRadius: '8px',
                textAlign: 'center',
                textTransform: 'uppercase'
              }}
            />
            <button
              onClick={() => handleJoinGame(joinCode)}
              style={{
                backgroundColor: colors.success.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '1rem 1.5rem',
                fontSize: '1.1rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Join
            </button>
          </div>
        </div>

        {/* Active Games List */}
        {games.length > 0 && (
          <div style={{
            backgroundColor: colors.secondary.bg,
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '1.3rem',
              marginBottom: '1rem',
              color: colors.neutral.black
            }}>
              Active Games
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {games.map((game) => (
                <button
                  key={game.gameId}
                  onClick={() => onJoinGame(game.gameId)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    border: `1px solid ${colors.neutral.gray[300]}`,
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{game.gameId}</span>
                  <span style={{ color: colors.text.secondary }}>
                    {game.playerCount} player{game.playerCount !== 1 ? 's' : ''}
                    {game.playerNames.length > 0 && ` (${game.playerNames.join(', ')})`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <p style={{ color: colors.text.secondary, marginTop: '1rem' }}>
            Checking for active games...
          </p>
        )}

        {/* Alpha notice */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: colors.primary.light,
          borderRadius: '8px',
          fontSize: '0.9rem',
          color: colors.text.secondary,
          lineHeight: '1.5'
        }}>
          <strong>Alpha Version</strong>
          <br />
          We're working on improving the game daily.
          <br />
          Comments or suggestions? Email us at:{' '}
          <a
            href="mailto:game@unravelcodes.com"
            style={{ color: colors.primary.main }}
          >
            game@unravelcodes.com
          </a>
          <div style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: colors.text.tertiary || colors.text.secondary
          }}>
            <div style={{ marginBottom: '0.25rem' }}>
              Build: {__APP_VERSION__} • {new Date(__BUILD_TIME__).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {syncStatus.status === 'checking' && (
                <span style={{ color: colors.text.secondary }}>Checking sync...</span>
              )}
              {syncStatus.status === 'in-sync' && (
                <span style={{ color: '#22c55e' }}>✓ In sync with GitHub</span>
              )}
              {syncStatus.status === 'out-of-sync' && (
                <span style={{ color: '#f59e0b' }}>
                  ⚠ {syncStatus.commitsBehind
                    ? `${syncStatus.commitsBehind} commit${syncStatus.commitsBehind > 1 ? 's' : ''} behind`
                    : 'Out of sync'
                  } (latest: {syncStatus.latestCommit})
                </span>
              )}
              {syncStatus.status === 'error' && (
                <span style={{ color: colors.text.secondary }}>Could not check sync</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
