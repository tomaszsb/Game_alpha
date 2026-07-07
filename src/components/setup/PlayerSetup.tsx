// src/components/setup/PlayerSetup.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { PlayerForm } from './PlayerForm';
import { PlayerList } from './PlayerList';
import { usePlayerValidation, GameSettings, AVAILABLE_COLORS, ColorOption } from './usePlayerValidation';
import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/StateTypes';
import { getCurrentGameId, getBackendURL } from '../../utils/networkDetection';
import { isSmartTV } from '../../utils/deviceDetection';
import { isAdminAuthenticated, verifyAdminPassword, clearAdminAuth, getAdminPassword } from '../../utils/adminAuth';
import { teacherLogin, getTeacherAccount, getTeacherSession, type TeacherAccount } from '../../utils/teacherAuth';
import { DataEditor } from '../editor/DataEditor';
import { BoardLayoutEditor } from '../board/BoardLayoutEditor';
import { ClassroomSetup } from '../classroom/ClassroomSetup';
import { TeacherClassroomPanel } from '../classroom/TeacherClassroomPanel';
import { ClassroomAdminPanel } from '../classroom/ClassroomAdminPanel';
import { ClassroomBadge } from '../classroom/ClassroomBadge';
import { BugReportsPanel } from '../editor/BugReportsPanel';
import { EducationalCardSelectionModal } from '../modals/EducationalCardSelectionModal';
import { debugLog } from '../../utils/debugLog';
import { useGitHubSyncStatus } from './useGitHubSyncStatus';

interface PlayerSetupProps {
  onStartGame?: (players: Player[], settings: GameSettings) => void;
  /** When set, show a simplified mobile view for this player only */
  viewPlayerId?: string;
}

/**
 * PlayerSetup is the main container component that orchestrates player management
 * This replaces the legacy EnhancedPlayerSetup with a clean, composable structure
 */
export function PlayerSetup({
  onStartGame = (players, settings) => console.log('Start game:', players, settings),
  viewPlayerId
}: PlayerSetupProps): JSX.Element {

  // Get services from context
  const { stateService, gameRulesService, dataService } = useGameContext();

  // Get players from StateService instead of local state
  const [players, setPlayers] = useState<Player[]>([]);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setPlayers(gameState.players);
    });

    // Initialize with current state
    setPlayers(stateService.getGameState().players);

    return unsubscribe;
  }, [stateService]);

  // GitHub sync status — restored from pre-v2.69.0 GameLobby. Tells the user
  // at a glance whether the loaded client matches the latest master commit.
  const syncStatus = useGitHubSyncStatus();
  const appSemver = typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : '';
  const appCommit = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

  // Game settings state
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    maxPlayers: 4,
    winCondition: 'FIRST_TO_FINISH',
    difficulty: 'normal',
    sameStartingPoint: false,
    startingMode: 'QUICK_START'
  });

  const [isStarting, setIsStarting] = useState(false);
  const [isDataEditorOpen, setIsDataEditorOpen] = useState(false);
  const [isBugReportsOpen, setIsBugReportsOpen] = useState(false);
  const [isBoardLayoutEditorOpen, setIsBoardLayoutEditorOpen] = useState(false);
  const [isClassroomSetupOpen, setIsClassroomSetupOpen] = useState(false);
  const [showCardSelection, setShowCardSelection] = useState(false);

  // Lobby controls — merged from the retired GameLobby screen so setup
  // happens on a single page. PC/TV mode is local state until the user
  // clicks Start Game; on start, TV mode appends ?mode=tv to the URL.
  // Precedence (v3.0.25):
  //   1. Explicit ?mode= in the URL wins (preserves a TV-mode reload).
  //   2. Otherwise auto-preselect TV when the browser is a real smart TV
  //      (Tizen/webOS/Android TV/Fire TV/Chromecast/etc). A laptop-into-TV
  //      reports a desktop UA and falls through to PC — the prominent toggle
  //      is the manual fallback for that case.
  const [selectedMode, setSelectedMode] = useState<'pc' | 'tv'>(() => {
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    if (urlMode === 'tv') return 'tv';
    if (urlMode === 'pc') return 'pc';
    return isSmartTV() ? 'tv' : 'pc';
  });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  // Settings drawer: the right-column "game setup window" only appears when
  // the gear icon (top-right of header) is clicked. PC/TV toggle and Start
  // Game live in the main column so common actions stay one click away.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSettingsOpen]);

  // Game Manager state (for admin)
  interface GameInfo {
    gameId: string;
    playerCount: number;
    playerNames: string[];
    gamePhase: string;
  }
  const [activeGames, setActiveGames] = useState<GameInfo[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Admin auth state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => isAdminAuthenticated());
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminVerifying, setAdminVerifying] = useState(false);
  // Combined login (Phase 3c): a username makes it a teacher login; blank
  // username = the admin master password (today's behavior).
  const [loginUsername, setLoginUsername] = useState('');
  const [teacherAccount, setTeacherAccount] = useState<TeacherAccount | null>(() => getTeacherAccount());
  const [isClassroomAdminOpen, setIsClassroomAdminOpen] = useState(false);

  // Use validation hook with services
  const validation = usePlayerValidation(players, gameSettings, stateService, gameRulesService, selectedMode === 'tv');

  /**
   * Add a new player
   */
  const handleAddPlayer = () => {
    const addValidation = validation.validateAddPlayer();
    if (!addValidation.isValid) {
      if (addValidation.errorMessage) {
        alert(addValidation.errorMessage);
      }
      return;
    }

    try {
      const playerName = `Player ${players.length + 1}`;
      stateService.addPlayer(playerName);
    } catch (error: any) {
      alert(`Failed to add player: ${error.message}`);
    }
  };

  /**
   * Remove a player
   */
  const handleRemovePlayer = (playerId: string) => {
    if (!validation.canRemovePlayer) {
      alert('Cannot remove player: Must have at least one player');
      return;
    }

    try {
      stateService.removePlayer(playerId);
    } catch (error: any) {
      alert(`Failed to remove player: ${error.message}`);
    }
  };

  /**
   * Update a player property
   */
  const handleUpdatePlayer = (playerId: string, property: string, value: string) => {
    // Remove validation - let StateService handle conflicts gracefully
    // Users should be able to select any color/avatar without getting errors

    try {
      stateService.updatePlayer({ id: playerId, [property]: value });
    } catch (error: any) {
      alert(`Failed to update player: ${error.message}`);
    }
  };

  /**
   * Cycle through avatars for a player
   */
  const handleCycleAvatar = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const nextAvatar = validation.getNextAvatar(player.avatar || '', playerId);
    handleUpdatePlayer(playerId, 'avatar', nextAvatar);
  };

  /**
   * Combined login (Phase 3c). A username present → teacher account login;
   * a blank username → the admin master password (today's behavior).
   */
  const handleLogin = async () => {
    if (!adminPassword.trim()) return;
    setAdminVerifying(true);
    setAdminError('');
    try {
      if (loginUsername.trim()) {
        const account = await teacherLogin(loginUsername.trim(), adminPassword);
        if (account) {
          setTeacherAccount(account);
          setShowAdminPrompt(false);
          setAdminPassword('');
          setLoginUsername('');
        } else {
          setAdminError('Incorrect username or password');
        }
      } else {
        const success = await verifyAdminPassword(adminPassword);
        if (success) {
          setIsAdminUnlocked(true);
          setShowAdminPrompt(false);
          setAdminPassword('');
        } else {
          setAdminError('Incorrect password');
        }
      }
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setAdminVerifying(false);
    }
  };

  /**
   * Start a new game bound to a teacher's classroom: create it with the
   * instanceId (server authorizes via the teacher session), then navigate to
   * it carrying ?i= so the client loads that classroom's board.
   */
  const handleStartClassroomGame = async (instanceId: string) => {
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getTeacherSession() ? { 'x-teacher-session': getTeacherSession() as string } : {}),
        },
        body: JSON.stringify({ instanceId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        alert(`Could not start a game: ${data.error || `server returned ${response.status}`}`);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('g', data.gameId);
      url.searchParams.set('token', data.token);
      if (instanceId && instanceId !== 'classroom-1') url.searchParams.set('i', instanceId);
      else url.searchParams.delete('i');
      if (selectedMode === 'tv') url.searchParams.set('mode', 'tv');
      window.location.href = url.toString();
    } catch (err) {
      alert(`Could not start a game: ${err instanceof Error ? err.message : 'network error'}`);
    }
  };

  // Fetch active games when admin is unlocked
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
    if (!isAdminUnlocked) return;
    fetchActiveGames();
    const interval = setInterval(fetchActiveGames, 5000);
    return () => clearInterval(interval);
  }, [isAdminUnlocked]);

  // Auto-create is handled at the App.tsx level (before ServiceProvider
  // mounts) so that ServerSyncService.loadFromServer can never fall through
  // to the legacy /api/gamestate endpoint with no gameId. By the time
  // PlayerSetup mounts, the URL always has a ?g= and a fresh game.
  // autoCreatingGame / autoCreateError state below is kept for the
  // (rare) "POST /api/games failed" path — App leaves a banner in place
  // and lets the UI mount so the user isn't stuck on a blank loading
  // screen forever.

  /**
   * Join an existing game by typed code. Mirrors the retired GameLobby's
   * handleJoinGame — fetches the target game's token, then navigates with a
   * full reload so AppContent picks up the new gameId on mount.
   */
  const handleJoinByCode = async () => {
    setJoinError('');
    const normalized = joinCode.trim().toUpperCase();
    if (!normalized) {
      setJoinError('Enter a game code first.');
      return;
    }
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games/${normalized}/join-info`);
      if (response.status === 404) {
        // Non-technical reporters have described this as the game being
        // "unavailable" (fb:7bede788) — the actual cause is almost always a
        // mistyped or expired code (games auto-expire after ~24-41h idle),
        // not a permissions problem. Anyone with a valid code can join —
        // there's no separate admin-only path — so say that plainly.
        setJoinError(`No game found with code ${normalized}. It may be mistyped, or the game may have ended — ask whoever's hosting for the current code.`);
        return;
      }
      if (!response.ok) {
        setJoinError(`Couldn't reach game ${normalized} right now (server returned ${response.status}). Try again in a moment.`);
        return;
      }
      const data: { token: string; instanceId?: string } = await response.json();
      const url = new URL(window.location.href);
      url.searchParams.set('g', normalized);
      if (data.token) url.searchParams.set('token', data.token);
      // Carry the game's classroom so its board loads (Phase 3c); the default
      // classroom needs no param (plain /data).
      if (data.instanceId && data.instanceId !== 'classroom-1') url.searchParams.set('i', data.instanceId);
      else url.searchParams.delete('i');
      if (selectedMode === 'tv') {
        url.searchParams.set('mode', 'tv');
      } else {
        url.searchParams.delete('mode');
      }
      window.location.href = url.toString();
    } catch (err) {
      // A real network failure (offline, DNS, CORS) throws something like
      // "Failed to fetch" — technical and alarming to a non-technical
      // reporter. Log the real error for debugging; show something actionable.
      console.error('Join by code failed:', err);
      setJoinError('Could not connect to the server. Check your connection and try again.');
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
      window.location.href = url.toString();
    } catch (err) {
      alert('Cannot connect to server.');
    }
  };

  /**
   * Start the game
   */
  const handleStartGame = async () => {
    const gameStartValidation = validation.validateGameStart();
    if (!gameStartValidation.isValid && gameStartValidation.errorMessage) {
      alert(gameStartValidation.errorMessage);
      return;
    }

    // Commit the PC/TV mode choice to the URL before starting. Joining an
    // existing game already wrote the URL; this branch handles the
    // newly-auto-created-game path. Use history.replaceState to avoid a
    // reload — the rest of the start flow runs in-process.
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    const currentlyTV = urlMode === 'tv';
    if (selectedMode === 'tv' && !currentlyTV) {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'tv');
      window.history.replaceState({}, '', url.toString());
    } else if (selectedMode === 'pc' && currentlyTV) {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    }

    setIsStarting(true);

    try {
      // Filter out players with empty names for the callback
      const validPlayers = players.filter(p => p.name.trim());
      await onStartGame(validPlayers, gameSettings);
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const addPlayerValidation = validation.validateAddPlayer();

  // Mobile player view: show only their own player card + waiting message
  if (viewPlayerId) {
    const viewPlayer = players.find(p => p.id === viewPlayerId);
    if (!viewPlayer) {
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
        <style>{`.us-setup-fullheight { height: 100vh; height: 100dvh; }`}</style>
        <div style={styles.background} />

        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <img src="/images/logo.png" alt="Unravel Codes" style={styles.logo} />
            <div>
              <h1 style={styles.title}>Unravel Codes: The Game</h1>
              <p style={styles.subtitle}>Setting up your player</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                {syncStatus.status === 'in-sync' && <span style={styles.versionInSync}> ✓</span>}
                {syncStatus.status === 'out-of-sync' && (
                  <span style={styles.versionBehind}>
                    {' '}⚠ {syncStatus.commitsBehind ? `${syncStatus.commitsBehind} ` : ''}behind
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
            border: `4px solid ${viewPlayer.color}`,
          }}>
            {/* Avatar */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div
                style={{ fontSize: '3.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleCycleAvatar(viewPlayer.id)}
                title="Tap to change avatar"
              >
                {viewPlayer.avatar}
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
                value={viewPlayer.name}
                onChange={(e) => handleUpdatePlayer(viewPlayer.id, 'name', e.target.value)}
                maxLength={20}
                style={{
                  padding: '0.75rem',
                  border: `2px solid ${viewPlayer.color}`,
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
                  const isSelected = viewPlayer.color === colorOption.color;
                  return (
                    <button
                      key={colorOption.color}
                      onClick={() => handleUpdatePlayer(viewPlayer.id, 'color', colorOption.color)}
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
          <strong>Beta Version</strong> · Bug? Use the 🐞 button (bottom-right) · <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
        </footer>
      </div>
    );
  }

  return (
    <div className="us-setup-fullheight" style={styles.container}>
      <style>{`.us-setup-fullheight { height: 100vh; height: 100dvh; }`}</style>
      {/* Background gradient */}
      <div style={styles.background} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img
            src="/images/logo.png"
            alt="Unravel Codes"
            style={styles.logo}
          />
          <div>
            <h1 style={styles.title}>Unravel Codes: The Game</h1>
            <p style={styles.subtitle}>Navigate from project initiation to completion!</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
              {syncStatus.status === 'in-sync' && <span style={styles.versionInSync}> ✓</span>}
              {syncStatus.status === 'out-of-sync' && (
                <span style={styles.versionBehind}>
                  {' '}⚠ {syncStatus.commitsBehind ? `${syncStatus.commitsBehind} ` : ''}behind
                </span>
              )}
            </div>
          )}
          <ClassroomBadge />
          {getCurrentGameId() && (
            <div style={styles.gameCodeBadge}>
              <span style={styles.gameCodeLabel}>Game Code: </span>
              <span style={styles.gameCodeValue}>{getCurrentGameId()}</span>
            </div>
          )}
          {/* Gear icon — opens the right-column drawer (Join by Code, Game
              Settings, Admin Tools). Visible in both PC and TV mode in
              v3.0.16+; the mode toggle only forks the in-game UI, not the
              setup screen. <!-- v3.0.16 setup unification --> */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(o => !o)}
            aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
            title={isSettingsOpen ? 'Close settings' : 'Open settings'}
            style={{
              background: isSettingsOpen ? colors.primary.main : 'rgba(255,255,255,0.85)',
              color: isSettingsOpen ? 'white' : colors.text.secondary,
              border: `1px solid ${isSettingsOpen ? colors.primary.main : colors.secondary.border}`,
              borderRadius: 8,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              transition: 'background 0.15s ease',
            }}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main content — center column (player setup) + optional right
          drawer. QR codes used to live in a dedicated left column, but
          now render inline per-player inside PlayerList (hideQR=false)
          since the main panel has plenty of room with the right drawer
          collapsed by default. */}
      <main style={styles.main}>
        {/* Center column: Player edit cards */}
        <div style={styles.panel}>
          {/* PC/TV mode toggle — always visible in v3.0.16+. The mode
              choice only forks the in-game UI (TVDisplay vs GameLayout);
              the setup screen is identical either way. The ?mode= URL
              param is written on Start Game or Join by Code. */}
          {/* PC/TV toggle — enlarged in v3.0.25 (fb: setup-screen visibility).
              Big segmented control with a heading so it can't be missed; the
              two options carry a one-line description of what each means. */}
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem 0.85rem',
            background: '#f8f9fa',
            borderRadius: 10,
            border: `2px solid ${colors.secondary.border}`,
          }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: colors.text.primary,
              marginBottom: '0.6rem',
            }}>
              How are you playing?
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setSelectedMode('pc')}
                aria-pressed={selectedMode === 'pc'}
                style={{
                  flex: 1,
                  padding: '0.7rem 0.9rem',
                  borderRadius: 8,
                  border: `2px solid ${selectedMode === 'pc' ? colors.primary.main : colors.secondary.border}`,
                  background: selectedMode === 'pc' ? colors.primary.main : 'white',
                  color: selectedMode === 'pc' ? 'white' : colors.text.secondary,
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
                title="All players share one screen, taking turns."
              >
                🖥️ PC
                <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
                  Shared screen
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('tv')}
                aria-pressed={selectedMode === 'tv'}
                style={{
                  flex: 1,
                  padding: '0.7rem 0.9rem',
                  borderRadius: 8,
                  border: `2px solid ${selectedMode === 'tv' ? '#9c27b0' : colors.secondary.border}`,
                  background: selectedMode === 'tv' ? '#9c27b0' : 'white',
                  color: selectedMode === 'tv' ? 'white' : colors.text.secondary,
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
                title="Board on the TV; each player on their own phone or tablet."
              >
                📺 TV
                <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
                  Phones + TV
                </div>
              </button>
            </div>
            {selectedMode === 'tv' && (
              <div style={{
                fontSize: '0.74rem',
                color: colors.text.secondary,
                marginTop: '0.55rem',
              }}>
                Every player joins from their phone by scanning their QR code below — the game won't start until all have connected.
              </div>
            )}
          </div>

          <h3 style={styles.sectionTitle}>
            👥 Players
          </h3>

          <p style={styles.playerCount}>
            {validation.getPlayerCountSummary()}
          </p>

          <div style={styles.playerListWrapper}>
            <PlayerList
              players={players}
              onUpdatePlayer={handleUpdatePlayer}
              onRemovePlayer={handleRemovePlayer}
              onCycleAvatar={handleCycleAvatar}
              canRemovePlayer={validation.canRemovePlayer}
              hideQR={false}
              qrRequired={selectedMode === 'tv'}
            />
          </div>

          {/* Add Player + Start Game side-by-side at the bottom. Both stay
              visible whether or not the settings drawer is open, and in
              both PC and TV mode (v3.0.16 unified the setup screen). Start
              Game moved here from the right column so it doesn't disappear
              when the drawer is closed. Win Condition + other game
              settings live behind the gear icon for both modes. */}
          <div style={{
            display: 'flex',
            gap: '0.6rem',
            marginTop: 'auto',
            alignItems: 'stretch',
            flexWrap: 'wrap',
          }}>
            {validation.canAddPlayer && (
              <div style={{ flex: '1 1 auto', minWidth: '180px' }}>
                <PlayerForm
                  onAddPlayer={handleAddPlayer}
                  canAddPlayer={validation.canAddPlayer}
                  validationResult={addPlayerValidation}
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleStartGame}
              disabled={isStarting || !validation.validateGameStart().isValid}
              style={{
                flex: '0 0 auto',
                background: (isStarting || !validation.validateGameStart().isValid)
                  ? colors.secondary.main
                  : `linear-gradient(45deg, ${colors.success.text}, ${colors.success.main})`,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: (isStarting || !validation.validateGameStart().isValid) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(44, 85, 48, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title={!validation.validateGameStart().isValid
                ? validation.validateGameStart().errorMessage || 'Add at least one player to start.'
                : undefined}
            >
              {isStarting ? '⏳ Starting…' : '🚀 Start Game'}
            </button>
          </div>
        </div>

        {/* Settings drawer: the "game setup window" — Join by Code, Game
            Settings, Admin Tools (Space Data Editor, Board Layout Editor,
            Browse Games). Visibility is gated on the gear icon in the
            header (isSettingsOpen). v3.0.16+: visible in both PC and TV
            mode since the setup screen no longer forks by mode. */}
        {isSettingsOpen && <div style={{
          ...styles.settingsColumn,
          position: 'relative',
        }}>
          {/* Close button — gear icon also toggles, but a close X inside
              the panel is the conventional drawer affordance. */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="Close settings"
            title="Close settings (Esc)"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${colors.secondary.border}`,
              background: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text.secondary,
              zIndex: 1,
            }}
          >
            ✕
          </button>
          {/* Game Setup section — Join by Code only. (PC/TV mode toggle
              lives at the top of the center column now.) */}
          <div style={styles.settingsBlock}>
            <h3 style={styles.sectionTitleSmall}>
              🎮 Game Setup
            </h3>

            {/* Join an existing game by code. Navigates with a full reload
                so AppContent picks up the new gameId in the URL the same
                way the retired GameLobby did. */}
            <div style={{ marginTop: '0.85rem' }}>
              <label style={styles.label}>Join existing game</label>
              <p style={{ fontSize: '0.72rem', color: colors.text.secondary, margin: '0 0 0.4rem' }}>
                Anyone with the code can join — no login needed. This is also how to watch a game in progress without playing.
              </p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="e.g., G7"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoinByCode(); }}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.6rem',
                    border: `1px solid ${joinError ? '#dc3545' : colors.secondary.border}`,
                    borderRadius: 6,
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                  maxLength={10}
                  autoComplete="off"
                  name="gamecode"
                  data-lpignore="true"
                  data-1p-ignore
                />
                <button
                  type="button"
                  onClick={handleJoinByCode}
                  style={{
                    padding: '0.5rem 0.85rem',
                    background: colors.primary.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                  title="Joining will navigate away from this empty game."
                >
                  Join
                </button>
              </div>
              {joinError && (
                <p style={{ fontSize: '0.75rem', color: '#dc3545', margin: '0.35rem 0 0' }}>
                  {joinError}
                </p>
              )}
            </div>
          </div>

          {/* Game settings section */}
          <div style={styles.settingsBlock}>
            <h3 style={styles.sectionTitleSmall}>
              ⚙️ Game Settings
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem'
            }}>
              <div>
                <label style={styles.label}>Win Condition</label>
                <select
                  value={gameSettings.winCondition}
                  onChange={(e) => setGameSettings({
                    ...gameSettings,
                    winCondition: e.target.value
                  })}
                  style={styles.select}
                >
                  <option value="FIRST_TO_FINISH">First to Finish</option>
                  <option value="HIGHEST_SCORE">Highest Score</option>
                </select>
              </div>
            </div>

            {/* Same Starting Point Mode */}
            <div style={{ marginTop: '1rem' }}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={gameSettings.sameStartingPoint}
                  onChange={(e) => setGameSettings({
                    ...gameSettings,
                    sameStartingPoint: e.target.checked
                  })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', color: colors.secondary.dark }}>
                  Same Starting Point
                </span>
                <span style={{ color: colors.text.secondary, fontSize: 'clamp(0.75rem, 1.5vh, 0.9rem)' }}>
                  All players start with identical cards
                </span>
              </label>

              {gameSettings.sameStartingPoint && (
                <div style={styles.subOptions}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={styles.radioLabel}>
                      <input
                        type="radio"
                        name="startingMode"
                        value="QUICK_START"
                        checked={gameSettings.startingMode === 'QUICK_START'}
                        onChange={() => setGameSettings({
                          ...gameSettings,
                          startingMode: 'QUICK_START'
                        })}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>Quick Start</span>
                      <span style={{ color: colors.text.secondary, fontSize: '0.8rem' }}>
                        - P1's natural draws become starting hand for all
                      </span>
                    </label>
                  </div>
                  <div>
                    <label style={styles.radioLabel}>
                      <input
                        type="radio"
                        name="startingMode"
                        value="EDUCATIONAL"
                        checked={gameSettings.startingMode === 'EDUCATIONAL'}
                        onChange={() => setGameSettings({
                          ...gameSettings,
                          startingMode: 'EDUCATIONAL'
                        })}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>Educational</span>
                      <span style={{ color: colors.text.secondary, fontSize: '0.8rem' }}>
                        - Select specific starting cards
                      </span>
                    </label>

                    {gameSettings.startingMode === 'EDUCATIONAL' && (
                      <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowCardSelection(true)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            backgroundColor: colors.primary.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          Select Starting Cards...
                        </button>
                        {gameSettings.preSelectedHand && gameSettings.preSelectedHand.length > 0 && (
                          <div style={{
                            marginTop: '0.4rem',
                            fontSize: '0.8rem',
                            color: colors.success.text
                          }}>
                            {gameSettings.preSelectedHand.length} card{gameSettings.preSelectedHand.length !== 1 ? 's' : ''} selected:
                            {' '}
                            <span style={{ color: colors.text.secondary }}>
                              {gameSettings.preSelectedHand.filter(id => id.startsWith('W')).length} W,
                              {' '}
                              {gameSettings.preSelectedHand.filter(id => id.startsWith('E')).length} E
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin Tools / Teacher login section */}
          <div style={styles.settingsBlock}>
            <h3 style={styles.sectionTitleSmall}>
              {teacherAccount ? '👩‍🏫 My Classrooms' : '🛠️ Admin Tools'}
            </h3>

            {teacherAccount ? (
              <TeacherClassroomPanel
                onStartGame={handleStartClassroomGame}
                onLoggedOut={() => setTeacherAccount(null)}
              />
            ) : isAdminUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setIsDataEditorOpen(true)}
                    style={{
                      padding: '0.6rem 1rem',
                      backgroundColor: colors.secondary.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    ⚙️ Space Data Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBoardLayoutEditorOpen(true)}
                    style={{
                      padding: '0.6rem 1rem',
                      backgroundColor: colors.secondary.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                    title="Drag tiles to set their positions on the board. Applies to every future game."
                  >
                    🗺️ Edit Board Layout
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClassroomSetupOpen(true)}
                    style={{
                      padding: '0.6rem 1rem',
                      backgroundColor: colors.secondary.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                    title="Browse the deck of spaces: switch cards on/off, make your own copies. Applies to every future game."
                  >
                    🏫 Classroom Setup
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClassroomAdminOpen(true)}
                    style={{
                      padding: '0.6rem 1rem',
                      backgroundColor: colors.secondary.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                    title="Create teacher accounts and classrooms, and assign owners."
                  >
                    👥 Manage Classrooms &amp; Teachers
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBugReportsOpen(true)}
                    style={{
                      padding: '0.6rem 1rem',
                      backgroundColor: colors.secondary.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    🐛 Bug Reports
                  </button>
                  <button
                    type="button"
                    onClick={() => { clearAdminAuth(); setIsAdminUnlocked(false); }}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: 'transparent',
                      color: colors.secondary.main,
                      border: `1px solid ${colors.secondary.light}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    🔓 Lock
                  </button>
                </div>

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
              </div>
            ) : showAdminPrompt ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Teacher username (blank = admin)"
                  value={loginUsername}
                  onChange={(e) => { setLoginUsername(e.target.value); setAdminError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  autoFocus
                  autoComplete="username"
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: `2px solid ${adminError ? '#dc3545' : colors.secondary.light}`,
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '220px'
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: `2px solid ${adminError ? '#dc3545' : colors.secondary.light}`,
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '160px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={adminVerifying}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: colors.primary.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: adminVerifying ? 'wait' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '500'
                  }}
                >
                  {adminVerifying ? '...' : 'Log in'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdminPrompt(false); setAdminPassword(''); setLoginUsername(''); setAdminError(''); }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'transparent',
                    color: colors.secondary.main,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                {adminError && (
                  <span style={{ color: '#dc3545', fontSize: '0.8rem', width: '100%' }}>{adminError}</span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminPrompt(true)}
                style={{
                  padding: '0.6rem 1rem',
                  backgroundColor: colors.secondary.light,
                  color: colors.secondary.main,
                  border: `1px solid ${colors.secondary.main}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                🔑 Log in (admin or teacher)
              </button>
            )}
          </div>

          {/* Start Game button moved to next to Add Player in the center
              column — see the Add Player + Start Game block above. */}
        </div>}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <strong>Beta Version</strong> - We're improving daily.
        {' '}Bug? Use the 🐞 button (bottom-right), or email <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
      </footer>

      {/* Data Editor Modal */}
      {isDataEditorOpen && <DataEditor onClose={() => setIsDataEditorOpen(false)} />}

      {/* Bug Reports Modal */}
      {isBugReportsOpen && <BugReportsPanel onClose={() => setIsBugReportsOpen(false)} />}

      {/* Board Layout Editor Modal */}
      {isBoardLayoutEditorOpen && <BoardLayoutEditor onClose={() => setIsBoardLayoutEditorOpen(false)} />}

      {/* Classroom Setup (teacher catalog) Modal */}
      {isClassroomSetupOpen && <ClassroomSetup onClose={() => setIsClassroomSetupOpen(false)} />}

      {/* Manage Classrooms & Teachers (admin) Modal */}
      {isClassroomAdminOpen && <ClassroomAdminPanel onClose={() => setIsClassroomAdminOpen(false)} />}

      {/* Educational Card Selection Modal */}
      <EducationalCardSelectionModal
        isOpen={showCardSelection}
        onClose={() => setShowCardSelection(false)}
        onConfirm={(selectedCardIds) => {
          setGameSettings({
            ...gameSettings,
            preSelectedHand: selectedCardIds
          });
          setShowCardSelection(false);
        }}
        initialSelection={gameSettings.preSelectedHand}
        dataService={dataService}
      />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    // height set via .us-setup-fullheight CSS class: 100vh fallback + 100dvh.
    // Dynamic viewport height (dvh) shrinks when the iOS keyboard appears so
    // input fields stay reachable inside the inner overflow:auto wrapper.
    // Pure inline styles can't express the fallback (only one value per key),
    // hence the className. <!-- fb:feedback-1779567253915-4b07b80a -->
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.purple.main} 100%)`,
    zIndex: -1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'clamp(0.5rem, 1.5vh, 1rem) clamp(1rem, 3vw, 2rem)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(0.5rem, 1.5vw, 1rem)',
  },
  logo: {
    width: 'clamp(40px, 6vh, 70px)',
    height: 'auto',
  },
  title: {
    color: 'white',
    fontSize: 'clamp(1rem, 2.5vh, 1.75rem)',
    margin: 0,
    fontWeight: 'bold',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 'clamp(0.7rem, 1.5vh, 1rem)',
    margin: 0,
  },
  versionInfo: {
    fontSize: 'clamp(0.65rem, 1.2vh, 0.78rem)',
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.85)',
    padding: '0.3rem 0.6rem',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: '6px',
    whiteSpace: 'nowrap' as const,
  },
  versionCommit: {
    color: 'rgba(255,255,255,0.55)',
  },
  versionInSync: {
    color: '#22c55e',
    fontWeight: 'bold' as const,
  },
  versionBehind: {
    color: '#f59e0b',
    fontWeight: 'bold' as const,
  },
  gameCodeBadge: {
    padding: 'clamp(0.4rem, 1vh, 0.75rem) clamp(0.8rem, 2vw, 1.5rem)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '8px',
  },
  gameCodeLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 'clamp(0.7rem, 1.5vh, 0.9rem)',
  },
  gameCodeValue: {
    color: 'white',
    fontSize: 'clamp(0.9rem, 2vh, 1.2rem)',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: '2px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    gap: 'clamp(0.75rem, 2vw, 1.5rem)',
    padding: '0 clamp(1rem, 3vw, 2rem) clamp(0.5rem, 1vh, 1rem)',
    minHeight: 0,
    overflow: 'hidden',
  },
  qrColumn: {
    flex: '0 0 200px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    minWidth: 0,
  },
  panel: {
    flex: 1,
    background: 'white',
    borderRadius: '16px',
    padding: 'clamp(1rem, 2vh, 1.5rem)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    // minHeight: 0 is the missing piece that lets the flex:1 `playerListWrapper`
    // child shrink below its natural content height — without it, taller player
    // cards (4 players on TV, internal flex-wrap of QR section) push the panel
    // past its allotted flex height and the wrapper's `overflow: auto` never
    // kicks in. The Start Game block scrolls out of view at the bottom and the
    // user sees no scrollbar. v3.0.18 — fb:ffdddd29.
    minHeight: 0,
    // Panel itself no longer needs overflow:auto since the inner wrapper now
    // properly scrolls. Keep `hidden` so the rounded-corners + boxShadow stay
    // clean if anything inside misbehaves.
    overflow: 'hidden',
    minWidth: 0,
  },
  settingsColumn: {
    flex: '0 0 280px',
    background: 'white',
    borderRadius: '16px',
    padding: 'clamp(1rem, 2vh, 1.5rem)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.success.text,
    fontSize: 'clamp(1rem, 2.5vh, 1.5rem)',
    marginTop: 0,
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sectionTitleSmall: {
    color: colors.success.text,
    fontSize: 'clamp(0.9rem, 2vh, 1.2rem)',
    marginTop: 0,
    marginBottom: 'clamp(0.4rem, 1vh, 0.75rem)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  playerCount: {
    color: colors.text.primary,
    fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
    fontWeight: '500',
    margin: '0 0 clamp(0.5rem, 1vh, 1rem) 0',
  },
  playerListWrapper: {
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
    flex: 1,
    minHeight: 0,
    // fb:fc65c217 — TV browsers (and Comet, and many Chromium variants) hide
    // scrollbars when `overflow: auto`; they only appear on hover, which a
    // user with a TV remote can't trigger. `scroll` forces always-visible.
    // `scrollbarGutter: stable` reserves the gutter so toggling content
    // doesn't shift the layout. On TVs at 4 players the player cards form a
    // 2×2 grid that exceeds wrapper height; without a visible scrollbar the
    // user can't tell to scroll for the bottom row.
    overflow: 'scroll',
    scrollbarGutter: 'stable',
  },
  settingsBlock: {
    background: colors.secondary.bg,
    borderRadius: '12px',
    padding: 'clamp(0.75rem, 1.5vh, 1.25rem)',
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
  },
  label: {
    display: 'block',
    marginBottom: '0.4rem',
    fontWeight: 'bold',
    color: colors.secondary.dark,
    fontSize: 'clamp(0.8rem, 1.5vh, 0.95rem)',
  },
  select: {
    width: '100%',
    padding: 'clamp(0.5rem, 1vh, 0.75rem)',
    border: `2px solid ${colors.secondary.light}`,
    borderRadius: '8px',
    fontSize: 'clamp(0.85rem, 1.5vh, 1rem)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  subOptions: {
    marginTop: '0.75rem',
    marginLeft: '1.5rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '8px',
    border: `1px solid ${colors.secondary.light}`,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
  },
  footer: {
    textAlign: 'center' as const,
    padding: 'clamp(0.4rem, 1vh, 0.75rem) 1rem',
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 'clamp(0.7rem, 1.3vh, 0.85rem)',
    flexShrink: 0,
  },
};
