// src/components/setup/PlayerSetup.tsx

import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../../styles/theme';
import { PlayerForm } from './PlayerForm';
import { PlayerList } from './PlayerList';
import { usePlayerValidation, GameSettings } from './usePlayerValidation';
import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/StateTypes';
import { getCurrentGameId } from '../../utils/networkDetection';
import { useSyncedGameState } from '../../hooks/useSyncedGameState';
import { isSmartTV, isPhoneScreen } from '../../utils/deviceDetection';
import { getStoredPreferredMode, resolveInitialMode } from '../../utils/modePreference';
import { consumeResumeHint } from '../../utils/lastGameMemory';
import { fetchJoinInfo, buildJoinGameUrl, JoinPickerPlayer } from '../../utils/joinGameFlow';
import { AvatarIcon } from '../icons/AvatarIcons';
import { SpaceDeckScreen } from '../classroom/SpaceDeckScreen';
import { BoardLayoutEditor } from '../board/BoardLayoutEditor';
import { ClassroomAdminPanel } from '../classroom/ClassroomAdminPanel';
import { ClassroomBadge } from '../classroom/ClassroomBadge';
import { BugReportsPanel } from '../editor/BugReportsPanel';
import { EducationalCardSelectionModal } from '../modals/EducationalCardSelectionModal';
import { useGitHubSyncStatus } from './useGitHubSyncStatus';
import { debugLog } from '../../utils/debugLog';
import { ShareGameButton } from './ShareGameButton';
import { PhoneScreenWarning } from './PhoneScreenWarning';
import { styles } from './PlayerSetup.styles';
import { PlayerMobileView } from './PlayerMobileView';
import { ModeToggle } from './ModeToggle';
import { GameSettingsPanel } from './GameSettingsPanel';
import { AdminToolsPanel } from './AdminToolsPanel';
import { IconCheck, IconWarning, IconGear, IconPeople, IconPhone, IconPlay, IconClose, IconBug, IconHourglass, IconEye } from '../icons/SetupIcons';

interface PlayerSetupProps {
  onStartGame?: (players: Player[], settings: GameSettings) => void;
  /** When set, show a simplified mobile view for this player only */
  viewPlayerId?: string;
}

interface JoinPickerState {
  gameId: string;
  token: string;
  instanceId?: string;
  players: JoinPickerPlayer[];
}

/**
 * "10-foot UI" legibility scale for TV mode (fb:feedback-1783998607682-3f9f2831
 * / fb:feedback-1783997840419-e121c34e — "Too low resolution on TV" / "this TV
 * is 4k but resolution is crap"). This screen's sizing is entirely
 * clamp(rem, vh/vw, rem) — tuned for a laptop viewed ~50cm away, not a TV
 * across a room. A 4K TV has plenty of PIXELS but the same CSS pixel sizes
 * read tiny at couch distance. `zoom` scales the whole rendered box (fonts,
 * padding, QR codes) uniformly without needing to touch every clamp() value —
 * safe here specifically because TV mode is already confirmed Chromium-only
 * (Tizen/webOS/Android TV/Fire TV/Chromecast, see isSmartTV()). Zoom also
 * scales the box's OWN declared width/height, so those are pre-shrunk by the
 * inverse factor (see styles.container's TV override) to land back at the
 * real 100vw/100dvh — the standard compensation pattern for using `zoom` as a
 * uniform scale on a viewport-sized element.
 */
/**
 * The 1.3x zoom above was tuned for TVs that report a large logical
 * resolution (e.g. a 4K TV whose browser reports ~3840px wide) with tiny
 * text at couch distance — see the comment block above. But not every TV
 * reports a large logical resolution: some (e.g. a Hisense confirmed live
 * 2026-07-15, see isPhoneScreen() in deviceDetection.ts, and a TCL reported
 * by a user 2026-07-22 at 960x540) report an already-small logical screen.
 * Applying the same flat 1.3x to those magnifies an already-small canvas,
 * making it look coarser rather than crisper (fb:feedback-1784733214858-
 * 6c05e9d3 and siblings, "vacation TV" bug reports). Gate the zoom on
 * `window.screen.width` — consistent with how isPhoneScreen() keys off
 * `window.screen` rather than `innerWidth` for TV-related size decisions —
 * so small-logical-resolution TVs render unmagnified.
 */
export function getTvModeZoom(): number {
  if (typeof window === 'undefined' || !window.screen || !window.screen.width) return 1;
  return window.screen.width < 1280 ? 1 : 1.3;
}

/**
 * PlayerSetup is the main container component that orchestrates player management
 * This replaces the legacy EnhancedPlayerSetup with a clean, composable structure
 */
export function PlayerSetup({
  onStartGame = (players, settings) => debugLog('Start game:', players, settings),
  viewPlayerId
}: PlayerSetupProps): JSX.Element {

  // Get services from context
  const { stateService, gameRulesService, dataService } = useGameContext();

  // Get players from StateService instead of local state
  const { players } = useSyncedGameState(stateService);

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
  const [isSpaceDeckOpen, setIsSpaceDeckOpen] = useState(false);
  const [isBugReportsOpen, setIsBugReportsOpen] = useState(false);
  const [isBoardLayoutEditorOpen, setIsBoardLayoutEditorOpen] = useState(false);
  const [showCardSelection, setShowCardSelection] = useState(false);

  // Lobby controls — merged from the retired GameLobby screen so setup
  // happens on a single page. PC/TV mode is local state until the user
  // clicks Start Game; on start, TV mode appends ?mode=tv to the URL.
  // Precedence (v3.0.25, localStorage added for the Fire TV Silk-UA-spoof
  // report — a "Request Desktop Site" reload used to lose the TV choice):
  //   1. Explicit ?mode= in the URL wins (preserves a TV-mode reload/join
  //      link). This is a one-shot override — it is never written back to
  //      localStorage, so it can't stick around and override a later visit.
  //   2. Otherwise the last mode the user explicitly picked via the PC/TV
  //      toggle (see modePreference.ts / ModeToggle.tsx).
  //   3. Otherwise auto-preselect TV when the browser is a real smart TV
  //      (Tizen/webOS/Android TV/Fire TV/Chromecast/etc). A laptop-into-TV
  //      reports a desktop UA and falls through to PC — the prominent toggle
  //      is the manual fallback for that case.
  const [selectedMode, setSelectedMode] = useState<'pc' | 'tv'>(() => {
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    return resolveInitialMode(urlMode, getStoredPreferredMode(), isSmartTV);
  });

  // TV-remote scroll (fb:feedback-1783997840419-e121c34e — "Can't go back up
  // ... this TV is 4k but resolution is crap"). fb:fc65c217 already forced
  // the scrollbar always-visible in TV mode so the user can SEE there's more
  // content, but a TV remote has no wheel/hover/touch — there was never an
  // actual way to move it. Focusing this container + handling the D-pad's
  // arrow/page keys directly (native focused-div arrow-scroll isn't reliable
  // across smart-TV browser engines) makes the visible scrollbar usable.
  const playerListScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedMode === 'tv') playerListScrollRef.current?.focus();
  }, [selectedMode]);
  const handlePlayerListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const el = playerListScrollRef.current;
    if (!el) return;
    const line = 60; // px per Up/Down press — a bit more than one card row's worth
    const page = el.clientHeight * 0.85;
    switch (e.key) {
      case 'ArrowDown': el.scrollBy({ top: line }); break;
      case 'ArrowUp': el.scrollBy({ top: -line }); break;
      case 'PageDown': el.scrollBy({ top: page }); break;
      case 'PageUp': el.scrollBy({ top: -page }); break;
      case 'Home': el.scrollTo({ top: 0 }); break;
      case 'End': el.scrollTo({ top: el.scrollHeight }); break;
      default: return; // let anything else (Tab, Enter on a child, etc.) pass through
    }
    e.preventDefault();
  };

  // Resume-your-last-game hint (App.tsx's bare-URL bootstrap): if this
  // browser had a real game going before landing on this freshly
  // auto-created blank one, consumeResumeHint() returns it exactly once.
  // Read via a lazy useState initializer so the one-shot sessionStorage
  // read/clear only happens on the very first render, not every re-render.
  const [resumeHint] = useState(() => consumeResumeHint());

  // "New game" / "Join" selector — a real segmented control (like the PC/TV
  // toggle below), not two side-by-side boxes: exactly one side is ever the
  // active choice. Defaults to Join when this device remembers a game
  // (there's something to resume), New game otherwise. This — not a
  // separate settings-drawer panel — is now the one and only way to join or
  // resume a game on this screen.
  const [entryMode, setEntryMode] = useState<'new' | 'join'>(() => resumeHint ? 'join' : 'new');
  const [joinCode, setJoinCode] = useState(() => resumeHint?.gameId ?? '');
  const [joinError, setJoinError] = useState('');
  const [joinPicker, setJoinPicker] = useState<JoinPickerState | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // True while the field still shows the untouched last-game code — drives
  // the small "prefilled" checkmark and the Resume/Join label on the
  // bottom action button. Any edit (including the clear-prefill checkmark)
  // turns this off for good, same as typing a code from scratch.
  const isPrefilled = !!resumeHint && joinCode === resumeHint.gameId;

  const clearPrefill = (): void => {
    setJoinCode('');
    setJoinError('');
    setJoinPicker(null);
  };

  /**
   * Build the join URL and navigate (full reload so AppContent picks up the
   * new gameId/playerId on mount). Shared by direct-join and the "which
   * player are you?" picker below — `playerShortId` omitted means the
   * shared/spectator view, same as today's behavior. URL-building itself is
   * the pure buildJoinGameUrl() (joinGameFlow.ts), so its ?p=/?mode=/?i=
   * logic is unit-tested directly rather than only through a full mount.
   */
  const navigateToGame = (gameId: string, token: string, instanceId?: string, playerShortId?: string, spectate?: boolean) => {
    // assign() rather than `location.href = …` — same navigation, same history
    // entry, but a method call instead of an assignment to a global, which is
    // what react-hooks/immutability (correctly) objects to.
    window.location.assign(buildJoinGameUrl({
      currentUrl: window.location.href,
      gameId,
      token,
      instanceId,
      playerShortId,
      tvMode: selectedMode === 'tv',
      isPhoneScreen: isPhoneScreen(),
      spectate,
    }));
  };

  /**
   * Fetch a code's join-info and either show the "which player are you?"
   * picker (fb:feedback-1783819148816-bb72760f / fb:feedback-1783819238489-
   * aaae63c0) or navigate straight in. Takes the code as a parameter rather
   * than reading joinCode from closure so the same function serves both a
   * manual Join click and the automatic hint lookup below. The fetch/parse
   * itself is the pure fetchJoinInfo() (joinGameFlow.ts) — this is just the
   * setState wiring around it.
   */
  const performJoinByCode = async (rawCode: string): Promise<void> => {
    setJoinError('');
    if (!rawCode.trim()) {
      setJoinError('Enter a game code first.');
      return;
    }
    setIsJoining(true);
    try {
      const result = await fetchJoinInfo(rawCode);
      switch (result.status) {
        case 'not-found':
          setJoinError(`No game found with code ${result.gameId}. It may be mistyped, or the game may have ended — ask whoever's hosting for the current code.`);
          break;
        case 'server-error':
          setJoinError(`Couldn't reach game ${result.gameId} right now (server returned ${result.httpStatus}). Try again in a moment.`);
          break;
        case 'network-error':
          setJoinError('Could not connect to the server. Check your connection and try again.');
          break;
        case 'picker':
          setJoinPicker({ gameId: result.gameId, token: result.token, instanceId: result.instanceId, players: result.players });
          break;
        case 'direct':
          navigateToGame(result.gameId, result.token, result.instanceId);
          break;
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinByCode = (): void => { void performJoinByCode(joinCode); };

  /**
   * Picker choice: a specific player → their own actionable panel.
   *
   * Takeover warning (fb takeover-warning follow-up, 2026-07-12/13): if the
   * picked player already has a live WebSocket connection elsewhere (another
   * device actively playing as them), confirm before navigating — otherwise
   * this silently boots them off their own seat. Not a hard block: accepting
   * still proceeds, since a stale/zombie connection from a crashed tab is a
   * common false positive and we don't want to lock a player out of their
   * own seat.
   *
   * Only relevant on an actual phone screen: that's the only case where
   * navigateToGame above assumes the player's ?p= identity (fb:3a5280d8).
   * On PC/TV, picking a player doesn't take over their WebSocket
   * connection, so there's nothing to warn about.
   */
  const handlePickPlayer = (player: { shortId?: string; name: string; connected?: boolean }): void => {
    if (!joinPicker) return;
    if (!player.shortId) return;
    if (player.connected && isPhoneScreen()) {
      const confirmed = window.confirm(
        `${player.name} is currently connected on another device. Taking over may disrupt their game — continue anyway?`
      );
      if (!confirmed) return;
    }
    navigateToGame(joinPicker.gameId, joinPicker.token, joinPicker.instanceId, player.shortId);
  };

  /**
   * Picker choice: spectate. Marked with ?spectate=1 (maintainer report
   * 2026-08-18: a spectator landed on the exact same editable setup screen
   * as the host, could rename/remove/re-color players, even press Start
   * Game) — GameLayout shows a read-only SpectatorWaitingScreen instead of
   * PlayerSetup while the target game is still in SETUP phase; once it
   * starts, the flag is inert and the normal shared/spectator PLAY view
   * takes over, same as today's behavior for an already-started game.
   */
  const handleJoinAsSpectator = (): void => {
    if (!joinPicker) return;
    navigateToGame(joinPicker.gameId, joinPicker.token, joinPicker.instanceId, undefined, true);
  };

  // Smart auto-lookup: when this device remembers a game (Join starts
  // active), fetch its join-info immediately instead of waiting for a
  // button click — so the "which player are you?" picker (or a ready-to-go
  // Resume) is already there the moment the screen renders. Guarded to
  // fire once: switching tabs back and forth afterward must not re-fetch.
  const hasAutoFetchedJoinInfoRef = useRef(false);
  useEffect(() => {
    if (hasAutoFetchedJoinInfoRef.current) return;
    if (!resumeHint) return;
    hasAutoFetchedJoinInfoRef.current = true;
    void performJoinByCode(resumeHint.gameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeHint]);

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
      // Find the lowest unused "Player N" name instead of players.length + 1.
      // Deriving the default name from the current count breaks once a
      // player is removed from the middle of the list: e.g. add Player 1 and
      // Player 2, remove Player 1, then Add Player computes length(1) + 1 =
      // "Player 2" again — already taken by the remaining player — and
      // stateService.addPlayer throws "already exists", silently blocking
      // the add (fb:75101be7, "Can't add player"). Same fix pattern already
      // used for shortId generation, see StateService.generateShortPlayerId().
      const usedNames = new Set(players.map(p => p.name));
      let playerNumber = players.length + 1;
      while (usedNames.has(`Player ${playerNumber}`)) {
        playerNumber++;
      }
      const playerName = `Player ${playerNumber}`;
      stateService.addPlayer(playerName);
    } catch (error) {
      alert(`Failed to add player: ${error instanceof Error ? error.message : 'unexpected error'}`);
    }
  };

  // Auto-add a first player so nobody has to click "+ Add Player" just to
  // play solo — that button is only needed for player 2+. Safe to gate on
  // players.length === 0 alone: AppContent's isLoading gate (App.tsx) means
  // real server state has already loaded by the time PlayerSetup ever
  // mounts, so this can't misfire on a resumed/joined game's still-loading
  // roster — and canRemovePlayer's players.length > 1 floor means a game
  // that already had one player can never drop back to zero through normal
  // use, so this only ever fires once, on a genuinely brand-new game.
  const hasAutoAddedFirstPlayerRef = useRef(false);
  useEffect(() => {
    if (hasAutoAddedFirstPlayerRef.current) return;
    if (players.length > 0) return;
    hasAutoAddedFirstPlayerRef.current = true;
    try {
      stateService.addPlayer('Player 1');
    } catch (error) {
      debugLog('Auto-add first player failed (non-fatal — "+ Add Player" still works):', error);
    }
  }, [players.length, stateService]);

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
    } catch (error) {
      alert(`Failed to remove player: ${error instanceof Error ? error.message : 'unexpected error'}`);
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
    } catch (error) {
      alert(`Failed to update player: ${error instanceof Error ? error.message : 'unexpected error'}`);
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

  // Auto-create is handled at the App.tsx level (before ServiceProvider
  // mounts) so that ServerSyncService.loadFromServer can never fall through
  // to the legacy /api/gamestate endpoint with no gameId. By the time
  // PlayerSetup mounts, the URL always has a ?g= and a fresh game.
  // autoCreatingGame / autoCreateError state below is kept for the
  // (rare) "POST /api/games failed" path — App leaves a banner in place
  // and lets the UI mount so the user isn't stuck on a blank loading
  // screen forever.

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
    return (
      <PlayerMobileView
        player={players.find(p => p.id === viewPlayerId)}
        onUpdatePlayer={handleUpdatePlayer}
        onCycleAvatar={handleCycleAvatar}
        appSemver={appSemver}
        appCommit={appCommit}
        syncStatus={syncStatus}
      />
    );
  }

  const tvModeZoom = selectedMode === 'tv' ? getTvModeZoom() : 1;

  return (
    <div
      className="us-setup-fullheight"
      style={{
        ...styles.container,
        ...(selectedMode === 'tv'
          ? {
              zoom: tvModeZoom,
              width: `${100 / tvModeZoom}vw`,
            }
          : {}),
      }}
    >
      <style>{`
        .us-setup-fullheight { height: 100vh; height: 100dvh; }
        ${selectedMode === 'tv' ? `.us-setup-fullheight { height: ${100 / tvModeZoom}vh; height: ${100 / tvModeZoom}dvh; }` : ''}
        /* Landing-header hero treatment (fb:7dbc2fcc, "feels naked") — the
           brand mark (yarn ball unraveling into the "NYC Codes" book) gets a
           soft breathing glow and a gentle wobble instead of sitting there
           static and small. Kept subtle: this is a functional setup screen,
           not a marketing page, so motion must not distract from Add Player /
           Start Game. Respects prefers-reduced-motion. */
        .us-hero-logo-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .us-hero-glow {
          position: absolute; inset: -28%; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 72%);
          filter: blur(5px); pointer-events: none;
          animation: usHeroGlow 4.5s ease-in-out infinite;
        }
        .us-hero-logo-img { position: relative; transform-origin: 50% 82%; animation: usHeroWobble 6.5s ease-in-out infinite; }
        @keyframes usHeroGlow { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
        @keyframes usHeroWobble { 0%, 100% { transform: rotate(-3.5deg); } 50% { transform: rotate(3.5deg); } }
        @media (prefers-reduced-motion: reduce) {
          .us-hero-glow, .us-hero-logo-img { animation: none; }
        }
      `}</style>
      {/* Background gradient */}
      <div style={styles.background} />

      {/* Header — the vh-based hero header sizing below (title/subtitle/logo)
          is deliberately overridden with fixed, non-vh values in TV mode.
          `vh` always measures the real screen, not the shrunk box the TV
          zoom trick pre-shrinks the container to, so in TV mode this chrome
          was quietly eating a bigger share of the (already-shrunk) box than
          on PC — squeezing the player tiles below it down to nothing.
          fb: TV real-hardware feedback, 2026-07-15. */}
      <header style={{
        ...styles.header,
        ...(selectedMode === 'tv' ? { padding: '0.2rem clamp(1rem, 3vw, 2rem)' } : {}),
      }}>
        <div style={styles.headerLeft}>
          <div className="us-hero-logo-wrap">
            <div className="us-hero-glow" aria-hidden="true" />
            <img
              src="/images/logo.png"
              alt="Unravel Codes"
              className="us-hero-logo-img"
              style={{
                ...styles.logo,
                ...(selectedMode === 'tv' ? { width: '36px' } : {}),
              }}
            />
          </div>
          <div>
            <h1 style={{
              ...styles.title,
              ...(selectedMode === 'tv' ? { fontSize: '1.1rem' } : {}),
            }}>Unravel Codes: The Game</h1>
            {selectedMode !== 'tv' && (
              <p style={styles.subtitle}>Navigate from project initiation to completion!</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
              {syncStatus.status === 'in-sync' && (
                <span style={{ ...styles.versionInSync, display: 'inline-flex', alignItems: 'center', gap: '0.2em' }}>
                  {' '}<IconCheck size="0.85em" />
                </span>
              )}
              {syncStatus.status === 'out-of-sync' && (
                <span style={{ ...styles.versionBehind, display: 'inline-flex', alignItems: 'center', gap: '0.25em' }}>
                  {' '}<IconWarning size="0.85em" /> {syncStatus.commitsBehind ? `${syncStatus.commitsBehind} ` : ''}behind
                </span>
              )}
            </div>
          )}
          <ClassroomBadge />
          {getCurrentGameId() && (
            <div style={styles.gameCodeBadge}>
              <span style={styles.gameCodeLabel}>Game Code:</span>
              <span style={styles.gameCodeValue}>{getCurrentGameId()}</span>
            </div>
          )}
          {getCurrentGameId() && <ShareGameButton />}
          {/* Gear icon — opens the right-column drawer (Game Settings, Admin
              Tools). Visible in both PC and TV mode in v3.0.16+; the mode
              toggle only forks the in-game UI, not the setup screen.
              Inactive state matches the version/Game Code/Share chips
              (frosted pill, white text, thin white-ish border) so the whole
              header-right cluster reads as one family; active (drawer open)
              switches to a solid primary fill as a clear "this is toggled
              on" state, same pattern GameSettingsPanel's own controls use.
              <!-- v3.0.16 setup unification --> */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(o => !o)}
            aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
            title={isSettingsOpen ? 'Close settings' : 'Open settings'}
            style={{
              background: isSettingsOpen ? colors.primary.main : 'rgba(255,255,255,0.15)',
              color: 'white',
              border: `1px solid ${isSettingsOpen ? colors.primary.main : 'rgba(255,255,255,0.35)'}`,
              borderRadius: 8,
              width: 36,
              height: 36,
              // Without this, the 1px border added on top of a content-box
              // width/height of 36 made this button render at 38x38 —
              // visibly bigger than the other three header chips even
              // though they all "said" the same 36px height.
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.05rem',
              transition: 'background 0.15s ease',
            }}
          >
            <IconGear size="1.05em" />
          </button>
        </div>
      </header>

      {/* Main content — center column (player setup) + optional right
          drawer. QR codes used to live in a dedicated left column, but
          now render inline per-player inside PlayerList (hideQR=false)
          since the main panel has plenty of room with the right drawer
          collapsed by default. */}
      <main style={{
        ...styles.main,
        ...(selectedMode === 'tv' ? { padding: '0 clamp(1rem, 3vw, 2rem) 0.35rem' } : {}),
      }}>
        {/* Center column: Player edit cards */}
        <div style={{
          ...styles.panel,
          ...(selectedMode === 'tv' ? { padding: '0.6rem 0.85rem' } : {}),
        }}>
          {/* Phone-size warning — informational, non-blocking. Only on this
              host/setup view; the viewPlayerId branch above is the per-player
              TV-mode controller view, which is *meant* to run on a phone. */}
          <PhoneScreenWarning />

          {/* "New game" / "Join" — a real segmented selector (same visual
              pattern as the PC/TV toggle below): exactly one side is ever
              active, highlighted; the other reads as inactive/grayed. Join
              starts active when this device remembers a game — see
              entryMode's initializer above — with its join-info already
              fetched (see hasAutoFetchedJoinInfoRef) so the "which player
              are you?" picker or a ready Resume is already sitting there,
              not one more click away. This is the one and only join/resume
              control on the setup screen, always visible (not behind the
              gear icon). The bottom action button (below the Players
              section) does double duty as Start Game / Join depending on
              which side is selected — no separate Join button needed. */}
          <div style={{
            marginBottom: selectedMode === 'tv' ? '0.3rem' : '1rem',
            padding: selectedMode === 'tv' ? '0.3rem 0.6rem' : '0.75rem 0.85rem',
            background: '#f8f9fa',
            borderRadius: 10,
            border: `2px solid ${colors.secondary.border}`,
          }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setEntryMode('new')}
                aria-pressed={entryMode === 'new'}
                style={{
                  flex: 1,
                  padding: '0.7rem 0.9rem',
                  borderRadius: 8,
                  border: `2px solid ${entryMode === 'new' ? colors.primary.main : colors.secondary.border}`,
                  background: entryMode === 'new' ? colors.primary.main : 'white',
                  color: entryMode === 'new' ? 'white' : colors.text.secondary,
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                New game
                <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
                  Add players &amp; start
                </div>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('join')}
                aria-pressed={entryMode === 'join'}
                style={{
                  flex: 1,
                  padding: '0.7rem 0.9rem',
                  borderRadius: 8,
                  border: `2px solid ${entryMode === 'join' ? colors.primary.main : colors.secondary.border}`,
                  background: entryMode === 'join' ? colors.primary.main : 'white',
                  color: entryMode === 'join' ? 'white' : colors.text.secondary,
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                Join
                <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
                  {resumeHint ? 'Resume or enter a code' : 'Have a code?'}
                </div>
              </button>
            </div>

            {entryMode === 'join' && (
              <div style={{ marginTop: '0.75rem' }}>
                {joinPicker ? (
                  <div>
                    <p style={{ fontSize: '0.72rem', color: colors.text.secondary, margin: '0 0 0.5rem' }}>
                      Game {joinPicker.gameId} already has players. Which one are you?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {joinPicker.players.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePickPlayer(p)}
                          title={p.connected ? `${p.name} is currently connected on another device` : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.65rem',
                            background: 'white',
                            border: `2px solid ${p.color || colors.secondary.border}`,
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: colors.text.primary,
                            textAlign: 'left',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: p.color || colors.secondary.main,
                              flexShrink: 0,
                              display: 'inline-block',
                            }}
                          />
                          {p.avatar && <span style={{ display: 'inline-flex' }}><AvatarIcon avatar={p.avatar} size="1.1rem" /></span>}
                          <span>{p.name}</span>
                          {p.connected && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                color: colors.text.secondary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: colors.success.text,
                                  display: 'inline-block',
                                }}
                              />
                              already connected
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={handleJoinAsSpectator}
                        style={{
                          flex: 1,
                          padding: '0.5rem 0.65rem',
                          background: colors.secondary.main,
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                        title="Watch the game without controlling a player."
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
                          <IconEye size="1em" /> Just watching
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinPicker(null)}
                        style={{
                          padding: '0.5rem 0.65rem',
                          background: 'transparent',
                          color: colors.text.secondary,
                          border: `1px solid ${colors.secondary.border}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        aria-label="Game code to join or resume"
                        placeholder="e.g., G-A7F9-K3PX"
                        value={joinCode}
                        onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleJoinByCode(); }}
                        title={isPrefilled
                          ? 'Prefilled with the last game this device had open. Press the button below to resume it, or clear the checkmark to type a different code.'
                          : 'Anyone with the code can join — no login needed. This is also how to watch a game in progress without playing.'}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: isPrefilled ? '0.5rem 1.9rem 0.5rem 0.6rem' : '0.5rem 0.6rem',
                          border: `1px solid ${joinError ? '#dc3545' : isPrefilled ? colors.primary.main : colors.secondary.border}`,
                          borderRadius: 6,
                          fontSize: '0.9rem',
                          fontFamily: 'monospace',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                        maxLength={12}
                        autoComplete="off"
                        name="gamecode"
                        data-lpignore="true"
                        data-1p-ignore
                      />
                      {isPrefilled && (
                        <button
                          type="button"
                          onClick={clearPrefill}
                          aria-label="Clear prefilled code and type a different one"
                          title="Prefilled with your last game — click to clear and type a different code"
                          style={{
                            position: 'absolute',
                            right: 5,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 20,
                            height: 20,
                            padding: 0,
                            border: 'none',
                            borderRadius: '50%',
                            background: colors.primary.main,
                            color: 'white',
                            fontSize: '0.7rem',
                            lineHeight: 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                    {isPrefilled && !joinError && (
                      <p style={{ fontSize: '0.7rem', color: colors.text.secondary, margin: '0.35rem 0 0' }}>
                        Prefilled with your last game on this device — press the button below to resume.
                      </p>
                    )}
                    {joinError && (
                      <p style={{ fontSize: '0.75rem', color: '#dc3545', margin: '0.35rem 0 0' }}>
                        {joinError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <ModeToggle selectedMode={selectedMode} onSelectMode={setSelectedMode} />

          {/* This "Players" section is about THIS blank game — while Join is
              selected, we have no data yet on which game the player is
              actually joining (the picker above shows the target game's
              real roster once a code resolves), so showing this game's own
              "Player 1" here would be showing the wrong game's data. Hidden
              for the whole Join side, not just while the code field is
              empty — a typed-but-not-yet-submitted code doesn't change what
              we know either. */}
          {entryMode === 'new' && (
            <>
              {/* TV mode: "👥 Players" heading + the count summary merged into
                  one compact line (instead of styles.sectionTitle's vh-based
                  heading + styles.playerCount's own vh-based paragraph below
                  it) — same information, one line of screen instead of two,
                  so 4 player tiles fit without scrolling. fb: TV real-hardware
                  feedback, 2026-07-15. */}
              {selectedMode === 'tv' ? (
                <p style={{
                  color: colors.success.text,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  margin: '0 0 0.35rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4em',
                }}>
                  <IconPeople size="1em" /> Players — {validation.getPlayerCountSummary()}
                </p>
              ) : (
                <>
                  <h3 style={{ ...styles.sectionTitle, display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                    <IconPeople size="1em" /> Players
                  </h3>
                  <p style={styles.playerCount}>
                    {validation.getPlayerCountSummary()}
                  </p>
                </>
              )}

              {/* Scrollbar is forced always-visible ('scroll') only in TV mode —
                  fb:fc65c217, a TV remote can't hover to reveal an 'auto'
                  scrollbar. In PC mode 'auto' avoids showing a scrollbar/gutter
                  when there's nothing to scroll (fb:feedback-1782833653490-5470235b
                  — "why are there scroll bars? there is not much stuff here"). */}
              <div
                ref={playerListScrollRef}
                tabIndex={selectedMode === 'tv' ? 0 : undefined}
                onKeyDown={selectedMode === 'tv' ? handlePlayerListKeyDown : undefined}
                aria-label={selectedMode === 'tv' ? 'Player list — use the arrow/page keys to scroll' : undefined}
                style={{
                  ...styles.playerListWrapper,
                  ...(selectedMode === 'tv' ? { marginBottom: '0.35rem' } : {}),
                  overflow: selectedMode === 'tv' ? 'scroll' : 'auto',
                  scrollbarGutter: selectedMode === 'tv' ? 'stable' : 'auto',
                }}
              >
                <PlayerList
                  players={players}
                  onUpdatePlayer={handleUpdatePlayer}
                  onRemovePlayer={handleRemovePlayer}
                  onCycleAvatar={handleCycleAvatar}
                  canRemovePlayer={validation.canRemovePlayer}
                  hideQR={false}
                  qrRequired={selectedMode === 'tv'}
                  compact={selectedMode === 'tv'}
                />
              </div>
            </>
          )}

          {/* TV mode: the start blocker must be VISIBLE, not a hover
              tooltip — real players stood at the TV complaining they
              couldn't start, because nothing on screen said their phones
              hadn't scanned in yet (maintainer report 2026-07-16). Lists
              the actual stragglers by name; aria-live so it's announced
              as phones connect. */}
          {entryMode === 'new' && selectedMode === 'tv' && validation.waitingOnPhoneNames.length > 0 && (
            <div
              aria-live="polite"
              style={{
                background: colors.warning.bg,
                border: `2px solid ${colors.warning.main}`,
                borderRadius: '10px',
                padding: '0.5rem 0.9rem',
                marginBottom: '0.4rem',
                fontSize: '1.05rem',
                fontWeight: 'bold',
                color: colors.warning.text,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4em',
              }}
            >
              <IconPhone size="1em" /> Waiting for {validation.waitingOnPhoneNames.join(', ')} to scan their QR code — the game starts once every phone is in.
            </div>
          )}

          {/* Add Player + the primary action button, side-by-side at the
              bottom. Both stay visible whether or not the settings drawer
              is open, and in both PC and TV mode (v3.0.16 unified the setup
              screen). Win Condition + other game settings live behind the
              gear icon for both modes.

              The primary button does double duty as Start Game (New game
              selected) or Join/Resume (Join selected) — one button, no
              separate Join button to keep in sync with it. Hidden entirely
              while the "which player are you?" picker is showing: the
              picker's own per-player buttons are the actions at that point,
              there's nothing generic left for this button to do. Add Player
              only makes sense for the New game side (adding a player to
              THIS blank game while about to abandon it for a different one
              would be confusing), so it's hidden on the Join side too. */}
          {!(entryMode === 'join' && joinPicker) && (
            <div style={{
              display: 'flex',
              gap: '0.6rem',
              marginTop: 'auto',
              alignItems: 'stretch',
              flexWrap: 'wrap',
            }}>
              {entryMode === 'new' && validation.canAddPlayer && (
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
                onClick={entryMode === 'new' ? handleStartGame : handleJoinByCode}
                disabled={entryMode === 'new'
                  ? (isStarting || !validation.validateGameStart().isValid)
                  : (isJoining || !joinCode.trim())}
                style={{
                  flex: '0 0 auto',
                  background: (entryMode === 'new'
                    ? (isStarting || !validation.validateGameStart().isValid)
                    : (isJoining || !joinCode.trim()))
                    ? colors.secondary.main
                    : `linear-gradient(45deg, ${colors.success.text}, ${colors.success.main})`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  // TV mode: bigger tap/read target — this button is read from
                  // a couch, and while phones are missing it doubles as the
                  // status line (same maintainer report as the banner above).
                  padding: selectedMode === 'tv' ? '0.9rem 1.9rem' : '0.75rem 1.5rem',
                  fontSize: selectedMode === 'tv' ? '1.2rem' : '1rem',
                  fontWeight: 'bold',
                  cursor: (entryMode === 'new'
                    ? (isStarting || !validation.validateGameStart().isValid)
                    : (isJoining || !joinCode.trim())) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(44, 85, 48, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
                title={entryMode === 'new'
                  ? (!validation.validateGameStart().isValid
                    ? validation.validateGameStart().errorMessage || 'Add at least one player to start.'
                    : undefined)
                  : (!joinCode.trim()
                    ? 'Enter a game code first.'
                    : (isPrefilled ? 'Resume the last game this device had open.' : 'Joining will navigate away from this empty game.'))}
              >
                {entryMode === 'new' ? (
                  isStarting ? (
                    <><IconHourglass size="1em" /> Starting…</>
                  ) : (selectedMode === 'tv' && validation.waitingOnPhoneNames.length > 0) ? (
                    <><IconPhone size="1em" /> Waiting for phones…</>
                  ) : (
                    <><IconPlay size="1em" /> Start Game</>
                  )
                ) : (
                  isJoining ? (
                    <><IconHourglass size="1em" /> Joining…</>
                  ) : (
                    <><IconPlay size="1em" /> {isPrefilled ? 'Resume' : 'Join'}</>
                  )
                )}
              </button>
            </div>
          )}
        </div>

        {/* Settings drawer: the "game setup window" — Game Settings, Admin
            Tools (Space Data Editor, Board Layout Editor, Browse Games).
            Join by Code lives in the main column's New game/Join selector
            instead (always visible, not worth hiding behind a click).
            Visibility is gated on the gear icon in the header
            (isSettingsOpen). v3.0.16+: visible in both PC and TV mode since
            the setup screen no longer forks by mode. */}
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
            <IconClose size="0.9em" />
          </button>
          <GameSettingsPanel
            gameSettings={gameSettings}
            onChangeGameSettings={setGameSettings}
            onOpenCardSelection={() => setShowCardSelection(true)}
          />

          <AdminToolsPanel
            selectedMode={selectedMode}
            onOpenSpaceDeck={() => setIsSpaceDeckOpen(true)}
            onOpenBugReports={() => setIsBugReportsOpen(true)}
            onOpenBoardLayoutEditor={() => setIsBoardLayoutEditorOpen(true)}
            onOpenClassroomAdmin={() => setIsClassroomAdminOpen(true)}
          />

          {/* Start Game button moved to next to Add Player in the center
              column — see the Add Player + Start Game block above. */}
        </div>}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <strong>Beta Version</strong> - We’re improving daily.
        {' '}Bug? Use the <IconBug size="0.95em" style={{ margin: '0 0.15em' }} /> button (bottom-right), or email <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
      </footer>

      {/* Your deck of spaces — browse, then change (CARD_LIBRARY_DESIGN.md stage 3) */}
      {isSpaceDeckOpen && <SpaceDeckScreen onClose={() => setIsSpaceDeckOpen(false)} />}

      {/* Bug Reports Modal */}
      {isBugReportsOpen && <BugReportsPanel onClose={() => setIsBugReportsOpen(false)} />}

      {/* Board Layout Editor Modal */}
      {isBoardLayoutEditorOpen && <BoardLayoutEditor onClose={() => setIsBoardLayoutEditorOpen(false)} />}

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
