// src/components/layout/TVDisplay.tsx
// TV Display mode for Jackbox-style party gameplay
// Shows game board prominently with QR codes for players to join
// No interactive controls - just display

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { colors } from '../../styles/theme';
import { GameBoard } from '../game/GameBoard';
import { ProjectProgress } from '../game/ProjectProgress';
import { RulesModal } from '../modals/RulesModal';
import { useGameContext } from '../../context/GameContext';
import { Player, GamePhase } from '../../types/StateTypes';
import { getServerURL, getCurrentGameId } from '../../utils/networkDetection';

interface TVDisplayProps {
  /** Callback when setup should start (optional - for showing setup on TV) */
  onShowSetup?: () => void;
}

/**
 * TVDisplay - Dedicated display for TV/monitor in party game setup
 *
 * Features:
 * - Large, readable game board (10ft viewing distance)
 * - Current player indicator with animation
 * - QR codes for all players to join on mobile
 * - Turn notifications and game events
 * - No interactive controls (players use their phones)
 */
export function TVDisplay({ onShowSetup }: TVDisplayProps): JSX.Element {
  const { stateService, dataService, gameRulesService } = useGameContext();
  const [gamePhase, setGamePhase] = useState<GamePhase>('SETUP');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showActionOverlay, setShowActionOverlay] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const gameId = getCurrentGameId();

  // Subscribe to game state
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setGamePhase(gameState.gamePhase);
      setPlayers(gameState.players);
      setCurrentPlayerId(gameState.currentPlayerId);
    });

    // Initialize
    const currentState = stateService.getGameState();
    setGamePhase(currentState.gamePhase);
    setPlayers(currentState.players);
    setCurrentPlayerId(currentState.currentPlayerId);

    return unsubscribe;
  }, [stateService]);

  // Subscribe to auto-action events for dramatic reveals
  useEffect(() => {
    const unsubscribe = stateService.subscribeToAutoActions((event) => {
      // Show overlay for significant events
      if (event.type === 'dice_conditional_card' || event.type === 'life_event' || event.type === 'movement') {
        setLastAction(event.message);
        setShowActionOverlay(true);

        // Hide overlay after 3 seconds
        setTimeout(() => {
          setShowActionOverlay(false);
        }, 3000);
      }
    });

    return unsubscribe;
  }, [stateService]);

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  // Get current space info for the current player
  const getCurrentSpaceInfo = () => {
    if (!currentPlayer) return null;
    const space = dataService.getSpaceByName(currentPlayer.currentSpace);
    return space;
  };

  const currentSpace = getCurrentSpaceInfo();

  return (
    <div style={styles.container}>
      {/* Header with game info */}
      <header style={styles.header}>
        <div style={styles.logoSection}>
          <h1 style={styles.title}>Unravel Codes</h1>
          {gameId && (
            <span style={styles.gameCode}>Game: {gameId}</span>
          )}
          <button
            onClick={() => setIsRulesOpen(true)}
            style={{
              padding: '8px 16px',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            📋 Rules
          </button>
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('mode');
              window.location.href = url.toString();
            }}
            style={{
              padding: '8px 16px',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🖥️ Back to PC
          </button>
        </div>

        {/* Current player indicator */}
        {gamePhase === 'PLAY' && currentPlayer && (
          <div
            style={{
              ...styles.currentPlayerBanner,
              backgroundColor: currentPlayer.color || colors.primary.main,
            }}
          >
            <span style={styles.playerAvatar}>{currentPlayer.avatar}</span>
            <span style={styles.playerTurnText}>
              {currentPlayer.name}'s Turn
            </span>
          </div>
        )}

        {gamePhase === 'SETUP' && (
          <div style={styles.setupBanner}>
            Waiting for players to join...
          </div>
        )}

        {gamePhase === 'END' && (
          <div style={styles.gameOverBanner}>
            Game Over!
          </div>
        )}
      </header>

      {/* Main content area */}
      <main style={styles.main}>
        {/* Full Project Progress panel - reuses the same component as main game view */}
        {gamePhase === 'PLAY' && (
          <ProjectProgress
            players={players}
            currentPlayerId={currentPlayerId}
            dataService={dataService}
            gameRulesService={gameRulesService}
            onToggleGameLog={() => {}}
            onOpenRulesModal={() => {}}
            hideButtons
            compact
          />
        )}

        {/* Game board - takes most of the screen */}
        <div style={styles.boardSection}>
          {gamePhase === 'PLAY' ? (
            <GameBoard disableZoom />
          ) : gamePhase === 'SETUP' ? (
            <div style={styles.setupMessage}>
              <h2 style={styles.setupTitle}>Scan to Join!</h2>
              <p style={styles.setupSubtitle}>
                Use your phone to play. Scan any QR code below.
              </p>
            </div>
          ) : (
            <div style={styles.gameOverMessage}>
              {players.length > 0 && (
                <>
                  <span style={{ fontSize: '4rem' }}>
                    {players[0].avatar}
                  </span>
                  <h2 style={styles.winnerText}>
                    {players[0].name} Wins!
                  </h2>
                </>
              )}
            </div>
          )}
        </div>

        {/* Current space info (during gameplay) */}
        {gamePhase === 'PLAY' && currentSpace && (
          <div style={styles.spaceInfo}>
            <div style={styles.spaceTitle}>
              {currentSpace.title || currentSpace.name}
            </div>
          </div>
        )}
      </main>

      {/* QR Codes sidebar */}
      <aside style={styles.sidebar}>
        <h3 style={styles.sidebarTitle}>
          {gamePhase === 'SETUP' ? 'Join Game' : 'Players'}
        </h3>

        <div style={styles.playerList}>
          {players.length === 0 ? (
            <div style={styles.waitingForPlayers}>
              <div style={styles.waitingDots}>...</div>
              <span>Add players on the host device</span>
            </div>
          ) : (
            players.map(player => {
              const playerURL = getServerURL(player.id, player.shortId);
              const isCurrentPlayer = player.id === currentPlayerId;
              const isConnected = !!player.deviceType;

              return (
                <div
                  key={player.id}
                  style={{
                    ...styles.playerCard,
                    borderColor: isCurrentPlayer ? player.color : colors.secondary.border,
                    borderWidth: isCurrentPlayer ? '3px' : '2px',
                    backgroundColor: isCurrentPlayer ? `${player.color}15` : 'white',
                  }}
                >
                  {/* Player info */}
                  <div style={styles.playerInfo}>
                    <span style={styles.playerCardAvatar}>{player.avatar}</span>
                    <span style={{
                      ...styles.playerCardName,
                      color: player.color || colors.text.primary
                    }}>
                      {player.name}
                    </span>
                    {isConnected && (
                      <span style={styles.connectedBadge}>Connected</span>
                    )}
                  </div>

                  {/* QR Code */}
                  {!isConnected && (
                    <div style={styles.qrWrapper}>
                      <QRCodeSVG
                        value={playerURL}
                        size={100}
                        level="M"
                        includeMargin={false}
                        fgColor={player.color || colors.primary.main}
                      />
                    </div>
                  )}

                  {/* Stats during gameplay */}
                  {gamePhase === 'PLAY' && (
                    <div style={styles.playerStats}>
                      <span style={styles.statItem}>
                        ${(player.money / 1000).toFixed(0)}K
                      </span>
                      <span style={styles.statItem}>
                        {player.hand?.length || 0} cards
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Action overlay for dramatic reveals */}
      {showActionOverlay && lastAction && (
        <div style={styles.actionOverlay}>
          <div style={styles.actionContent}>
            {lastAction}
          </div>
        </div>
      )}

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Footer */}
      <footer style={styles.footer}>
        <span>TV Display Mode</span>
        <span style={styles.footerDot}>•</span>
        <span>Players use their phones to play</span>
        {gameId && (
          <>
            <span style={styles.footerDot}>•</span>
            <span>game.unravelcodes.com?g={gameId}</span>
          </>
        )}
      </footer>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'grid',
    gridTemplateAreas: `
      "header header sidebar"
      "main main sidebar"
      "footer footer footer"
    `,
    gridTemplateColumns: '1fr auto 280px',
    gridTemplateRows: 'auto 1fr auto',
    height: '100vh',
    width: '100vw',
    backgroundColor: colors.background.secondary,
    overflow: 'hidden',
  },
  header: {
    gridArea: 'header',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: colors.primary.main,
    color: 'white',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  gameCode: {
    fontSize: '1.25rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '8px',
  },
  currentPlayerBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 2rem',
    borderRadius: '50px',
    animation: 'pulse 2s ease-in-out infinite',
  },
  playerAvatar: {
    fontSize: '2.5rem',
  },
  playerTurnText: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'white',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  setupBanner: {
    fontSize: '1.25rem',
    padding: '0.75rem 2rem',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '8px',
  },
  gameOverBanner: {
    fontSize: '1.5rem',
    padding: '0.75rem 2rem',
    backgroundColor: colors.success.main,
    borderRadius: '8px',
    fontWeight: 'bold',
  },
  main: {
    gridArea: 'main',
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    overflow: 'hidden',
    gap: '1rem',
  },
  boardSection: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  setupMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
  },
  setupTitle: {
    fontSize: '4rem',
    margin: '0 0 1rem 0',
    color: colors.primary.main,
  },
  setupSubtitle: {
    fontSize: '1.5rem',
    color: colors.text.secondary,
  },
  gameOverMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
  },
  winnerText: {
    fontSize: '3rem',
    color: colors.success.main,
    margin: '1rem 0 0 0',
  },
  spaceInfo: {
    padding: '1rem',
    textAlign: 'center',
  },
  spaceTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  sidebar: {
    gridArea: 'sidebar',
    backgroundColor: 'white',
    borderLeft: `2px solid ${colors.secondary.border}`,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  sidebarTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: colors.primary.main,
    margin: '0 0 1rem 0',
    textAlign: 'center',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
  },
  waitingForPlayers: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: colors.text.secondary,
    fontStyle: 'italic',
    padding: '2rem',
  },
  waitingDots: {
    fontSize: '2rem',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  playerCard: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '2px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  playerCardAvatar: {
    fontSize: '1.5rem',
  },
  playerCardName: {
    fontSize: '1rem',
    fontWeight: 'bold',
    flex: 1,
  },
  connectedBadge: {
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    backgroundColor: colors.success.light,
    color: colors.success.text,
    borderRadius: '4px',
  },
  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0.5rem',
    backgroundColor: colors.background.light,
    borderRadius: '8px',
  },
  playerStats: {
    display: 'flex',
    justifyContent: 'space-around',
    fontSize: '0.85rem',
    color: colors.text.secondary,
    paddingTop: '0.5rem',
    borderTop: `1px solid ${colors.secondary.border}`,
  },
  statItem: {
    fontWeight: 'bold',
  },
  actionOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.3s ease-out',
  },
  actionContent: {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: colors.primary.main,
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    maxWidth: '80%',
    animation: 'scaleIn 0.3s ease-out',
  },
  footer: {
    gridArea: 'footer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '0.75rem',
    backgroundColor: colors.primary.light,
    color: colors.text.secondary,
    fontSize: '0.9rem',
  },
  footerDot: {
    opacity: 0.5,
  },
};

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.02); opacity: 0.9; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`;
if (!document.getElementById('tv-display-animations')) {
  styleSheet.id = 'tv-display-animations';
  document.head.appendChild(styleSheet);
}
