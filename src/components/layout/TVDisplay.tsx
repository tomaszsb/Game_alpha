// src/components/layout/TVDisplay.tsx
// TV Display mode for Jackbox-style party gameplay
// Shows game board prominently with QR codes for players to join
// No interactive controls - just display

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { colors } from '../../styles/theme';
import { BoardCanvas } from '../board/BoardCanvas';
import { ProjectProgress } from '../game/ProjectProgress';
import { ScoreboardV2 } from '../player/ScoreboardV2';
import { RulesModal } from '../modals/RulesModal';
import { useGameContext } from '../../context/GameContext';
import { Player, GamePhase } from '../../types/StateTypes';
import { getServerURL, getCurrentGameId } from '../../utils/networkDetection';
import { ClassroomBadge } from '../classroom/ClassroomBadge';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { ShutdownNotice } from '../common/ShutdownNotice';

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
  const gameServices = useGameContext();
  const { stateService, dataService, gameRulesService } = gameServices;
  const [gamePhase, setGamePhase] = useState<GamePhase>('SETUP');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  // Shared TV theme (GameState.tvDarkMode) — unlike PlayerPanelV2's per-device
  // dark-mode toggle, this is ONE value for the whole shared screen, flipped
  // remotely from any connected player's own device (ProjectProgress's "TV
  // theme" button) and pushed here live via the normal state-broadcast path
  // (same pipeline as a dice roll or move). Defaults to light when absent so
  // existing saved games don't need migration.
  const [tvDarkMode, setTvDarkMode] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showActionOverlay, setShowActionOverlay] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  // Opt-in "who's where" standings overlay (redesign §2 scoreboard). Default
  // hidden so the live TV layout is unchanged until the host chooses to show it.
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [isProgressExpanded, setIsProgressExpanded] = useState(false);
  const [showQRPanel, setShowQRPanel] = useState(false);
  // fb:608bb670 follow-up — the "Look at your phone" pill grabs attention when
  // the turn changes, then auto-dismisses after 2s so the chip's pulsing
  // colored border carries the steady-state "whose turn" signal.
  const [showTurnPill, setShowTurnPill] = useState(true);

  const gameId = getCurrentGameId();

  // Subscribe to game state
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setGamePhase(gameState.gamePhase);
      setPlayers(gameState.players);
      setCurrentPlayerId(gameState.currentPlayerId);
      setTvDarkMode(gameState.tvDarkMode ?? false);
    });

    // Initialize
    const currentState = stateService.getGameState();
    setGamePhase(currentState.gamePhase);
    setPlayers(currentState.players);
    setCurrentPlayerId(currentState.currentPlayerId);
    setTvDarkMode(currentState.tvDarkMode ?? false);

    return unsubscribe;
  }, [stateService]);

  // Resolved PanelMode for the shared TV screen — passed to both ScoreboardV2
  // and BoardCanvas so the whole TV chrome/board reflects the same synced
  // value. 'light'/'dark' string literals match PanelMode without importing
  // the type just for this.
  const tvMode: 'light' | 'dark' = tvDarkMode ? 'dark' : 'light';

  // Subscribe to game events for dramatic reveals
  useEffect(() => {
    const unsubscribe = stateService.subscribeToGameEvents((event) => {
      // Show overlay for significant events. 'game_ended' replaces the old
      // 'life_event' repurposing for bankruptcy/design-fee-cap/win — kept
      // in this same OR-chain so the TV overlay (which already worked
      // correctly for those via 'life_event') doesn't regress.
      if (event.type === 'dice_conditional_card' || event.type === 'life_event' || event.type === 'movement' || event.type === 'routing_explanation' || event.type === 'game_ended') {
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

  // fb:608bb670 follow-up — re-show the "Look at your phone" pill for 2s
  // every time the active player changes (turn handoff), then auto-dismiss.
  useEffect(() => {
    if (!currentPlayerId) return;
    setShowTurnPill(true);
    const t = window.setTimeout(() => setShowTurnPill(false), 2000);
    return () => window.clearTimeout(t);
  }, [currentPlayerId]);

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  // Get current space info for the current player
  const getCurrentSpaceInfo = () => {
    if (!currentPlayer) return null;
    const space = dataService.getSpaceByName(currentPlayer.currentSpace);
    return space;
  };

  const currentSpace = getCurrentSpaceInfo();

  // During PLAY the right sidebar disappears (QR codes only matter at SETUP);
  // its per-player info migrates into the top player strip below the header
  // so the board reclaims the 220px right column.
  // <!-- fb:feedback-1779568265597-9bedb559 -->
  const showSidebar = gamePhase !== 'PLAY';

  return (
    <div style={{
      ...styles.container,
      // fb:608bb670 — the player strip moved INTO the blue header (see below),
      // so the dedicated white strip row is gone and the board reclaims it.
      gridTemplateAreas: showSidebar
        ? `"header header sidebar" "main main sidebar" "footer footer footer"`
        : `"header header" "main main" "footer footer"`,
      gridTemplateColumns: showSidebar ? '1fr auto 220px' : '1fr auto',
      gridTemplateRows: 'auto 1fr auto',
    }}>
      {/* Deploy-update warning — fixed-position, self-subscribing. */}
      <ShutdownNotice />

      {/* Header with game info. fb:608bb670 — during PLAY the header is a two-
          line blue band: top line = logo + phone-controller indicator, bottom
          line = the player strip (moved off its own white row into the blue
          area so the board reclaims the height). */}
      <header style={styles.header}>
        <div style={styles.headerTopRow}>
        <div style={styles.logoSection}>
          <h1 style={styles.title}>Unravel Codes</h1>
          {gameId && (
            <span style={styles.gameCode}>Game: {gameId}</span>
          )}
          <ClassroomBadge style={{ fontSize: '1rem', padding: '0.35rem 0.9rem' }} />
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
            onClick={() => setShowScoreboard(s => !s)}
            style={{
              padding: '8px 16px',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: showScoreboard ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            📊 Standings
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
          {/* Mid-game phone QR — hidden during SETUP (sidebar already shows QR).
              A player whose phone died mid-game can scan and rejoin without
              stopping the host. fb:TODO-253a */}
          {gamePhase === 'PLAY' && (
            <button
              onClick={() => setShowQRPanel(v => !v)}
              style={{
                padding: '8px 16px',
                fontSize: '1rem',
                fontWeight: 'bold',
                backgroundColor: showQRPanel ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: `2px solid ${showQRPanel ? 'white' : 'rgba(255,255,255,0.5)'}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              📱 Connect Phone
            </button>
          )}
        </div>

        {/* Phone-controller indicator — at 10ft viewing distance the
            playerStrip's color ring is too subtle to read. This banner
            spells out "📱 Look at your phone, [Name]" so first-time players
            don't sit waiting for the TV to do something. fb:608bb670
            follow-up: auto-dismiss 2s after each turn handoff so it
            attention-grabs once, then makes room — the player chip's
            pulsing colored border carries the steady-state signal.
            <!-- fb:feedback-1779567746328-5ca98777 --> */}
        {gamePhase === 'PLAY' && currentPlayer && showTurnPill && (
          <div
            style={{
              ...styles.controlIndicator,
              backgroundColor: currentPlayer.deviceType === 'mobile'
                ? 'rgba(34, 197, 94, 0.25)'
                : 'rgba(251, 191, 36, 0.25)',
              border: `2px solid ${currentPlayer.deviceType === 'mobile' ? '#22c55e' : '#fbbf24'}`,
            }}
          >
            <span style={styles.controlIndicatorIcon}>
              {currentPlayer.deviceType === 'mobile' ? '📱' : '🖥️'}
            </span>
            <span style={styles.controlIndicatorText}>
              {currentPlayer.deviceType === 'mobile'
                ? <>Look at your phone, <strong>{currentPlayer.name}</strong></>
                : <><strong>{currentPlayer.name}</strong> — take your turn on the host device</>}
            </span>
          </div>
        )}

        {/* Player strip — moved into the top row (fb:608bb670 follow-up)
            so the chip lives next to the buttons + auto-dismissing turn
            pill instead of stranding on a second row. Renders during PLAY
            only. Chips show name + money + resources; current player gets
            a 3px colored pulsing border carrying the "whose turn" signal
            once the pill auto-dismisses. */}
        {gamePhase === 'PLAY' && (
          <div style={styles.headerPlayerStrip}>
            {players.map(player => {
              const isCurrentPlayer = player.id === currentPlayerId;
              const isConnected = !!player.deviceType;
              return (
                <div
                  key={player.id}
                  style={{
                    ...styles.playerStripChip,
                    borderColor: isCurrentPlayer ? (player.color || 'white') : 'rgba(255,255,255,0.4)',
                    borderWidth: isCurrentPlayer ? '3px' : '2px',
                    backgroundColor: isCurrentPlayer ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                    animation: isCurrentPlayer ? 'pulse 2s ease-in-out infinite' : undefined,
                  }}
                >
                  <PlayerAvatar avatar={player.avatar} color={player.color} size={34} title={player.name} />
                  <div style={styles.playerStripText}>
                    <div style={{
                      ...styles.playerStripName,
                      color: 'white',
                    }}>
                      {player.name}
                    </div>
                    <div style={styles.playerStripStats}>
                      <span>${(player.money / 1000).toFixed(0)}K</span>
                      <span>·</span>
                      <span>{player.hand?.length || 0} resources</span>
                      {isConnected && <span style={styles.playerStripConnected}>📱</span>}
                    </div>
                  </div>
                </div>
              );
            })}
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
        </div>
        {/* v3.0.59 (fb:608bb670 follow-up) — the second-row playerStrip
            previously here was moved INTO headerTopRow above so the chip
            shares space with the buttons + auto-dismissing turn pill,
            instead of stranding under the logo. */}
      </header>

      {/* Main content area */}
      <main style={styles.main}>
        {/* Collapsed progress bar — one-line summary so the board gets the space */}
        {gamePhase === 'PLAY' && (
          <div onClick={() => setIsProgressExpanded(!isProgressExpanded)} style={{ cursor: 'pointer' }}>
            <ProjectProgress
              players={players}
              currentPlayerId={currentPlayerId}
              dataService={dataService}
              gameRulesService={gameRulesService}
              onToggleGameLog={() => {}}
              onOpenRulesModal={() => {}}
              hideButtons
              compact
              collapsed={!isProgressExpanded}
            />
          </div>
        )}

        {/* Game board - takes most of the screen */}
        <div style={styles.boardSection}>
          {gamePhase === 'PLAY' ? (
            // v3.0.0 — BoardV3 retired; BoardCanvas is the only renderer.
            // TV display is read-only: no admin edit, edges always visible,
            // no per-edge hides.
            <BoardCanvas
              currentPlayerId={currentPlayerId}
              players={players}
              isAdmin={false}
              edgesVisible={true}
              centerOnCurrent={true}
              mode={tvMode}
            />
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

      {/* QR Codes sidebar — only during SETUP/END. v3.0.15 dropped it during
          PLAY so the board reclaims 220px of width; per-player info migrated
          to the horizontal playerStrip above. <!-- fb:feedback-1779568265597-9bedb559 --> */}
      {showSidebar && <aside style={styles.sidebar}>
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
                    <PlayerAvatar avatar={player.avatar} color={player.color} size={30} title={player.name} />
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

                  {/* QR Code — scales to fit sidebar */}
                  {!isConnected && (
                    <div style={styles.qrWrapper}>
                      <QRCodeSVG
                        value={playerURL}
                        size={80}
                        level="M"
                        includeMargin={false}
                        fgColor={player.color || colors.primary.main}
                        style={{ width: '100%', maxWidth: '80px', height: 'auto' }}
                      />
                    </div>
                  )}

                  {/* Stats during gameplay used to live here; moved to the
                      horizontal player strip in v3.0.15 since the sidebar no
                      longer renders during PLAY. <!-- fb:feedback-1779568265597-9bedb559 --> */}
                </div>
              );
            })
          )}
        </div>
      </aside>}

      {/* Mid-game QR panel — shown when "Connect Phone" is toggled during PLAY.
          Lets a player whose phone died scan and rejoin without pausing the
          game. Shows all players' QR codes; already-connected ones get a
          green "Connected" badge instead. fb:TODO-253a */}
      {showQRPanel && gamePhase === 'PLAY' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowQRPanel(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px',
            padding: '24px', maxWidth: '90vw',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📱 Connect Your Phone</h2>
              <button onClick={() => setShowQRPanel(false)} style={{
                background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666'
              }}>✕</button>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Scan your QR code to join or rejoin the game on your phone.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {players.map(player => {
                const playerURL = getServerURL(player.id, player.shortId);
                const isConnected = !!player.deviceType;
                return (
                  <div key={player.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    padding: '12px', borderRadius: '8px',
                    border: `2px solid ${isConnected ? '#22c55e' : player.color || '#dee2e6'}`,
                    backgroundColor: isConnected ? '#f0fdf4' : 'white',
                    minWidth: '120px',
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{player.avatar}</span>
                    <span style={{ fontWeight: 700, color: player.color }}>{player.name}</span>
                    {isConnected ? (
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Connected</span>
                    ) : (
                      <QRCodeSVG value={playerURL} size={100} level="M" includeMargin={false}
                        fgColor={player.color || '#007bff'} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      {/* Standings overlay (opt-in, redesign §2 scoreboard) */}
      {showScoreboard && (
        <div
          onClick={() => setShowScoreboard(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '48px 16px',
            overflow: 'auto',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, position: 'relative' }}>
            <button
              onClick={() => setShowScoreboard(false)}
              aria-label="Close standings"
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                padding: '6px 14px',
                fontSize: '1rem',
                fontWeight: 'bold',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
            <ScoreboardV2 gameServices={gameServices} mode={tvMode} />
          </div>
        </div>
      )}

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
    // gridTemplateAreas + columns + rows are set inline based on `showSidebar`
    // so the layout collapses cleanly when the sidebar disappears during PLAY.
    // <!-- fb:feedback-1779568265597-9bedb559 -->
    display: 'grid',
    height: '100vh',
    width: '100vw',
    backgroundColor: colors.background.secondary,
    overflow: 'hidden',
  },
  // fb:608bb670 — header is a two-line blue band during PLAY: top row (logo +
  // phone-controller indicator) and the player strip below, both on blue.
  header: {
    gridArea: 'header',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.6rem 2rem',
    backgroundColor: colors.primary.main,
    color: 'white',
  },
  headerTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  // Horizontal player strip — replaces the legacy currentPlayerBanner +
  // sidebar per-player cards in PLAY mode. fb:608bb670 — now sits inside the
  // blue header (no white row / border of its own) so the board reclaims the
  // height. <!-- fb:feedback-1779568265597-9bedb559 -->
  headerPlayerStrip: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    // v3.0.60 (fb:608bb670 follow-up) — `overflowX: 'auto'` from v3.0.59
    // caused phantom scrollbars on both axes even when the chip clearly
    // fit. With 4 max players sharing the top row alongside the buttons,
    // there's enough horizontal room — let flex size naturally.
    // v3.0.59 (fb:608bb670 follow-up) — now lives INSIDE headerTopRow next
    // to the action buttons and the auto-dismissing turn pill. flex-end
    // alignment isn't needed here; the parent space-between handles
    // overall placement.
  },
  playerStripChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.75rem',
    borderRadius: '10px',
    border: '2px solid',
    flex: '0 0 auto',
  },
  playerStripAvatar: {
    fontSize: '1.75rem',
    flexShrink: 0,
  },
  playerStripText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
    minWidth: 0,
  },
  playerStripName: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  playerStripStats: {
    display: 'flex',
    gap: '0.35rem',
    alignItems: 'center',
    fontSize: '0.8rem',
    // fb:608bb670 follow-up — slightly muted white so the stats read as
    // secondary to the player name above without disappearing on blue.
    color: 'rgba(255,255,255,0.85)',
    fontWeight: 600,
  },
  playerStripConnected: {
    fontSize: '0.7rem',
    marginLeft: '0.2rem',
  },
  setupBanner: {
    fontSize: '1.25rem',
    padding: '0.75rem 2rem',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '8px',
  },
  // Phone-controller indicator — sized for 10ft viewing. Pulses to draw
  // attention on turn-change. <!-- fb:feedback-1779567746328-5ca98777 -->
  controlIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '50px',
    animation: 'pulse 2s ease-in-out infinite',
    color: 'white',
  },
  controlIndicatorIcon: {
    fontSize: '2.25rem',
    lineHeight: 1,
  },
  controlIndicatorText: {
    fontSize: '1.25rem',
    fontWeight: 600,
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
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
    padding: '0.5rem',
    overflow: 'hidden',
    gap: '0.25rem',
    minHeight: 0,
  },
  boardSection: {
    flex: 1,
    minHeight: 0,
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
  // fb:608bb670 — "the message on the bottom of the board should be smaller."
  // Trimmed padding + font so the board (above) gets more of the column.
  spaceInfo: {
    padding: '0.3rem',
    textAlign: 'center',
  },
  spaceTitle: {
    fontSize: '1.05rem',
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  sidebar: {
    gridArea: 'sidebar',
    backgroundColor: 'white',
    borderLeft: `2px solid ${colors.secondary.border}`,
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
    gap: '0.5rem',
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'space-evenly',
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
    padding: '0.4rem',
    borderRadius: '8px',
    border: '2px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: '0 1 auto',
    minHeight: 0,
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
