// src/components/setup/PlayerSetup.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { PlayerForm } from './PlayerForm';
import { PlayerList } from './PlayerList';
import { usePlayerValidation, GameSettings, AVAILABLE_COLORS, ColorOption } from './usePlayerValidation';
import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/StateTypes';
import { getCurrentGameId, getServerURL, getNetworkInfo, getBackendURL } from '../../utils/networkDetection';
import { QRCodeSVG } from 'qrcode.react';
import { isAdminAuthenticated, verifyAdminPassword, clearAdminAuth } from '../../utils/adminAuth';
import { DataEditor } from '../editor/DataEditor';
import { EducationalCardSelectionModal } from '../modals/EducationalCardSelectionModal';

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

  // Track wide screen for QR column visibility
  const [isWideScreen, setIsWideScreen] = useState(() => window.innerWidth > 900);
  useEffect(() => {
    const handleResize = () => setIsWideScreen(window.innerWidth > 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const [showCardSelection, setShowCardSelection] = useState(false);

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

  // Use validation hook with services
  const validation = usePlayerValidation(players, gameSettings, stateService, gameRulesService);

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
   * Verify admin password
   */
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

  const handleClearGame = async (gameId: string) => {
    if (!window.confirm(`Clear all data for game ${gameId}? This cannot be undone.`)) return;
    try {
      const backendURL = getBackendURL();
      const resp = await fetch(`${backendURL}/api/games/${gameId}/state`, { method: 'DELETE' });
      if (resp.ok) {
        fetchActiveGames();
      } else {
        alert('Failed to clear game. Server returned ' + resp.status);
      }
    } catch (err) {
      alert('Failed to clear game: ' + (err instanceof Error ? err.message : 'Network error'));
    }
  };

  const handleJoinGame = (gameId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('g', gameId);
    window.location.href = url.toString();
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
      <div style={styles.container}>
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
          {getCurrentGameId() && (
            <div style={styles.gameCodeBadge}>
              <span style={styles.gameCodeLabel}>Game: </span>
              <span style={styles.gameCodeValue}>{getCurrentGameId()}</span>
            </div>
          )}
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
          <strong>Alpha Version</strong> - Feedback? <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
        </footer>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Background gradient */}
      <div style={styles.background} />

      {/* Responsive: hide QR column on narrow screens */}
      <style>{`
        @media (max-width: 900px) {
          .qr-column { display: none !important; }
        }
      `}</style>

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
        {getCurrentGameId() && (
          <div style={styles.gameCodeBadge}>
            <span style={styles.gameCodeLabel}>Game Code: </span>
            <span style={styles.gameCodeValue}>{getCurrentGameId()}</span>
          </div>
        )}
      </header>

      {/* Main content - 3-column layout on wide screens */}
      <main style={styles.main}>
        {/* Left column: QR codes for scanning (hidden on narrow screens via .qr-column) */}
        <div className="qr-column" style={styles.qrColumn}>
          <h3 style={{ ...styles.sectionTitleSmall, color: 'white', textAlign: 'center' as const }}>
            📱 Scan to Join
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            {players.map(player => {
              const playerURL = getServerURL(player.id, player.shortId);
              const networkInfo = getNetworkInfo();
              return (
                <div key={player.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  {player.deviceType === 'mobile' ? (
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '10px',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>{player.avatar}</span>
                      <div style={{
                        background: colors.success.light,
                        color: colors.success.text,
                        borderRadius: '6px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                      }}>
                        ✅ Connected
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {player.name || 'Unnamed'}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>{player.avatar}</span>
                      {networkInfo.isLocalhost && (
                        <div style={{ fontSize: '0.6rem', color: '#ffb3b3' }}>localhost only</div>
                      )}
                      <div style={{
                        padding: '4px',
                        background: 'white',
                        borderRadius: '8px',
                        border: `3px solid ${player.color}`,
                        lineHeight: 0,
                      }}>
                        <QRCodeSVG
                          value={playerURL}
                          size={120}
                          level="M"
                          includeMargin={false}
                          fgColor={player.color || colors.primary.main}
                        />
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {player.name || 'Unnamed'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center column: Player edit cards */}
        <div style={styles.panel}>
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
              hideQR={isWideScreen}
            />
          </div>

          {validation.canAddPlayer && (
            <PlayerForm
              onAddPlayer={handleAddPlayer}
              canAddPlayer={validation.canAddPlayer}
              validationResult={addPlayerValidation}
            />
          )}
        </div>

        {/* Right column: Settings + Admin + Start */}
        <div style={styles.settingsColumn}>
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

          {/* Admin Tools section */}
          <div style={styles.settingsBlock}>
            <h3 style={styles.sectionTitleSmall}>
              🛠️ Admin Tools
            </h3>

            {isAdminUnlocked ? (
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
                  type="password"
                  placeholder="Admin password"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminVerify()}
                  autoFocus
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
                  onClick={handleAdminVerify}
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
                  {adminVerifying ? '...' : 'Unlock'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdminPrompt(false); setAdminPassword(''); setAdminError(''); }}
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
                🔒 Unlock Admin Tools
              </button>
            )}
          </div>

          {/* Start game button */}
          <button
            type="button"
            onClick={handleStartGame}
            disabled={isStarting}
            style={{
              background: isStarting ? colors.secondary.main : `linear-gradient(45deg, ${colors.success.text}, ${colors.success.main})`,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: 'clamp(0.8rem, 2vh, 1.5rem) 2rem',
              fontSize: 'clamp(1rem, 2.5vh, 1.3rem)',
              fontWeight: 'bold',
              cursor: isStarting ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'all 0.3s ease',
              boxShadow: '0 6px 20px rgba(44, 85, 48, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: 'auto'
            }}
          >
            {isStarting ? '🎲 Starting Game...' : '🚀 Start Game'}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <strong>Alpha Version</strong> - We're improving daily.
        {' '}Feedback? <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
      </footer>

      {/* Data Editor Modal */}
      {isDataEditorOpen && <DataEditor onClose={() => setIsDataEditorOpen(false)} />}

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
    height: '100vh',
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
    overflow: 'auto',
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
    overflow: 'auto',
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
