// src/components/setup/AdminGameManager.tsx

import React, { useEffect, useState } from 'react';
import { colors } from '../../styles/theme';
import { getBackendURL } from '../../utils/networkDetection';
import { getAdminPassword } from '../../utils/adminAuth';
import { getAdminSettings, setForeignGameAlertsEnabled as apiSetForeignGameAlertsEnabled } from '../../utils/adminSettingsApi';
import { debugLog } from '../../utils/debugLog';

interface GameInfo {
  gameId: string;
  playerCount: number;
  playerNames: string[];
  gamePhase: string;
}

/**
 * Admin-only "Game Manager": the list of live games (join/spectate/clear)
 * plus the foreign-game text-alert kill switch. Only ever mounted while
 * admin is unlocked (see AdminToolsPanel), so its polling/load effects run
 * unconditionally on mount rather than gating on an `isAdminUnlocked` flag —
 * mount/unmount is the gate now.
 */
export function AdminGameManager(): JSX.Element {
  const [activeGames, setActiveGames] = useState<GameInfo[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Foreign-game text alert kill switch (null = not loaded yet)
  const [foreignGameAlertsEnabled, setForeignGameAlertsEnabledState] = useState<boolean | null>(null);
  const [alertSettingBusy, setAlertSettingBusy] = useState(false);

  const fetchActiveGames = async () => {
    try {
      setGamesLoading(true);
      const backendURL = getBackendURL();
      // Game list is admin-gated server-side (game codes are the join
      // secret); this only runs after the admin unlock, so the session
      // password is available.
      const response = await fetch(`${backendURL}/api/games`, {
        headers: { 'x-admin-password': getAdminPassword() || '' },
      });
      if (response.ok) {
        const data = await response.json();
        const games = data.games.filter(
          (g: GameInfo) => g.gameId !== 'G0' && g.playerCount > 0
        );
        setActiveGames(games);
      }
    } catch (err) {
      debugLog('Could not fetch games:', err);
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveGames();
    const interval = setInterval(fetchActiveGames, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAdminSettings()
      .then((s) => { if (!cancelled) setForeignGameAlertsEnabledState(s.foreignGameAlertsEnabled); })
      .catch((err) => debugLog('Could not load admin settings:', err));
    return () => { cancelled = true; };
  }, []);

  const handleToggleForeignGameAlerts = async (next: boolean) => {
    setAlertSettingBusy(true);
    try {
      const s = await apiSetForeignGameAlertsEnabled(next);
      setForeignGameAlertsEnabledState(s.foreignGameAlertsEnabled);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update the setting.');
    } finally {
      setAlertSettingBusy(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    // Fetch the target game's token before navigating, otherwise the
    // game UI loads blank (X-Game-Token required for state endpoints
    // since the April 2026 audit). Same fix as GameLobby.handleJoinGame.
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games/${gameId}/join-info`);
      if (!response.ok) {
        alert(`Cannot join ${gameId}: server returned ${response.status}`);
        return;
      }
      const data: { token: string; instanceId?: string } = await response.json();
      const url = new URL(window.location.href);
      url.searchParams.set('g', gameId);
      url.searchParams.set('token', data.token);
      if (data.instanceId && data.instanceId !== 'classroom-1') url.searchParams.set('i', data.instanceId);
      else url.searchParams.delete('i');
      // assign() rather than `location.href = …` — same navigation, but a method
      // call instead of an assignment to a global (react-hooks/immutability).
      window.location.assign(url.toString());
    } catch (_err) {
      alert('Cannot connect to server.');
    }
  };

  /**
   * Open a read-only view of a live game in a new tab (the TV display —
   * board + scoreboard, no action controls) so you can watch a game in
   * progress without disturbing your own Admin Tools screen. Same
   * join-info + token fetch as handleJoinGame, since game state reads
   * still require the game's token; this just opens in a new tab instead
   * of navigating away, and forces mode=tv for the display-only view.
   */
  const handleSpectateGame = async (gameId: string) => {
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games/${gameId}/join-info`);
      if (!response.ok) {
        alert(`Cannot spectate ${gameId}: server returned ${response.status}`);
        return;
      }
      const data: { token: string; instanceId?: string } = await response.json();
      const url = new URL(window.location.href);
      url.searchParams.set('g', gameId);
      url.searchParams.set('token', data.token);
      url.searchParams.set('mode', 'tv');
      if (data.instanceId && data.instanceId !== 'classroom-1') url.searchParams.set('i', data.instanceId);
      else url.searchParams.delete('i');
      window.open(url.toString(), '_blank', 'noopener');
    } catch (_err) {
      alert('Cannot connect to server.');
    }
  };

  const handleClearGame = async (gameId: string) => {
    if (!window.confirm(`Clear all data for game ${gameId}? This cannot be undone.`)) return;
    try {
      const backendURL = getBackendURL();
      // Reset is admin-or-game-token server-side; the Game Manager only
      // renders behind the admin unlock, so send the admin password.
      const resp = await fetch(`${backendURL}/api/games/${gameId}/state`, {
        method: 'DELETE',
        headers: { 'x-admin-password': getAdminPassword() || '' },
      });
      if (resp.ok) {
        fetchActiveGames();
      } else {
        alert('Failed to clear game. Server returned ' + resp.status);
      }
    } catch (err) {
      alert('Failed to clear game: ' + (err instanceof Error ? err.message : 'Network error'));
    }
  };

  return (
    <>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.85rem',
        color: colors.secondary.dark,
        cursor: foreignGameAlertsEnabled === null || alertSettingBusy ? 'default' : 'pointer',
        opacity: alertSettingBusy ? 0.6 : 1,
      }}>
        <input
          type="checkbox"
          checked={foreignGameAlertsEnabled ?? false}
          disabled={foreignGameAlertsEnabled === null || alertSettingBusy}
          onChange={(e) => handleToggleForeignGameAlerts(e.target.checked)}
        />
        📱 Text me when a game starts from an unrecognized IP
        {foreignGameAlertsEnabled === null && <span style={{ color: colors.text.secondary }}> (loading…)</span>}
      </label>

      {/* Game Manager */}
      <div style={{
        marginTop: '0.25rem',
        padding: '0.75rem',
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: '8px',
        border: `1px solid ${colors.secondary.light}`,
      }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: colors.secondary.dark, marginBottom: '0.5rem' }}>
          📋 Active Games {gamesLoading && <span style={{ fontWeight: 'normal', color: colors.text.secondary }}>...</span>}
        </div>
        {activeGames.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: colors.text.secondary, fontStyle: 'italic' }}>
            No active games
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {activeGames.map(game => (
              <div key={game.gameId} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.5rem',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: `1px solid ${colors.secondary.border}`,
                fontSize: '0.8rem',
              }}>
                <span style={{ fontWeight: 'bold', color: colors.primary.main, minWidth: '2rem' }}>
                  {game.gameId}
                </span>
                <span style={{ color: colors.text.secondary, flex: 1, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {game.playerCount}p{game.playerNames.length > 0 && `: ${game.playerNames.slice(0, 3).join(', ')}`}
                  {game.playerNames.length > 3 && '...'}
                </span>
                <button
                  type="button"
                  onClick={() => handleJoinGame(game.gameId)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: colors.primary.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                  }}
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={() => handleSpectateGame(game.gameId)}
                  title="Open a read-only view of this game in a new tab"
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: colors.secondary.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                  }}
                >
                  👁️ Spectate
                </button>
                <button
                  type="button"
                  onClick={() => handleClearGame(game.gameId)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                  }}
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
