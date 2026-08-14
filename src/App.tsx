// src/App.tsx

import React, { useState, useEffect } from 'react';
import { ServiceProvider } from './context/ServiceProvider';
import { GameLayout } from './components/layout/GameLayout';
import { TVDisplay } from './components/layout/TVDisplay';
import { useGameContext } from './context/GameContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { colors } from './styles/theme';
import { getAppScreen, getURLParams } from './utils/getAppScreen';
import { getCurrentGameId, getBackendURL } from './utils/networkDetection';
import { detectDeviceType } from './utils/deviceDetection';
import { DictionaryProvider, DictionaryPanel, useDictionaryPanel } from './dictionary';
import { getTooltipService } from './services/TooltipService';
import { getPreviewParams, clearPreviewParams } from './utils/dictionaryBridge';
import { FeedbackButton } from './components/feedback/FeedbackButton';
import { configureApprovalSpaces } from './services/ApprovalService';
import { configureNpcSpeakers, configureCharacterMap } from './constants/characters';
import { configureCardTypeLabels } from './utils/cardTypeNames';
import { configureViolationRules } from './utils/violationRules';
import { configureUIStrings } from './constants/uiStrings';
import { VersionBadge } from './components/common/VersionBadge';
import { debugWarn } from './utils/debugLog';

/**
 * LoadingScreen component displays while the application initializes
 */
function LoadingScreen({ message }: { message?: string }): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background.secondary,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: colors.neutral.black
      }}
    >
      <div style={{ marginBottom: '20px', fontSize: '48px' }}>🏗️</div>
      <div>{message || 'Loading Game Data...'}</div>
      <div style={{ fontSize: '16px', color: colors.text.secondary, marginTop: '10px' }}>
        Please wait while we initialize the game
      </div>
    </div>
  );
}

/**
 * DictionaryPanelWrapper manages the dictionary panel state via context
 *
 * When useEmbeddedDashboard is enabled, the panel will render an iframe
 * pointing to dashboard.unravelcodes.com with the term ID.
 * This requires the dashboard to support the `embedded=true` parameter.
 *
 * Set ENABLE_EMBEDDED_DICTIONARY to true once the dashboard is ready.
 */
const ENABLE_EMBEDDED_DICTIONARY = true; // Enabled after dashboard updates supporting embedded=true

function DictionaryPanelWrapper(): JSX.Element {
  const { isOpen, closePanel, selectedTerm, pendingTermId } = useDictionaryPanel();

  // Use pendingTermId for embedded mode (works even when term isn't in local cache)
  // Use selectedTerm?.id for local mode (requires term to be loaded)
  const termId = pendingTermId || selectedTerm?.id;

  return (
    <DictionaryPanel
      isOpen={isOpen}
      onClose={closePanel}
      initialTermId={termId}
      useEmbeddedDashboard={ENABLE_EMBEDDED_DICTIONARY}
    />
  );
}

/**
 * AppContent component handles the loading state and renders the game when ready
 */
function AppContent(): JSX.Element {
  const { dataService, stateService } = useGameContext();
  const [isLoading, setIsLoading] = useState(true);
  const [gameState, setGameState] = useState(stateService.getGameState());
  const [initialPreview, setInitialPreview] = useState<{action: string; id: string} | null>(null);

  // Subscribe to game state changes
  useEffect(() => {
    const unsubscribe = stateService.subscribe((newState) => {
      setGameState(newState);
    });
    return unsubscribe;
  }, [stateService]);

  // Detect and clear preview params on load
  useEffect(() => {
    if (isLoading) return;

    const preview = getPreviewParams();
    if (preview.action && preview.id) {
      setInitialPreview({ action: preview.action, id: preview.id });
      clearPreviewParams();
    }
  }, [isLoading]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load game data and tooltips in parallel
        await Promise.all([
          dataService.loadData(),
          getTooltipService().loadTooltips()
        ]);

        // 2026-07-16: CSV-portability lift — let a reskin CSV reassign the
        // DOB/FDNY approval-gate roles (see ApprovalService.configureApprovalSpaces).
        // Must run after loadData() resolves; a no-op for the stock game, where
        // no space claims these roles and the built-in defaults stand.
        configureApprovalSpaces({
          dobExam: dataService.getSpaceForApprovalRole('dob_exam'),
          fdnyExam: dataService.getSpaceForApprovalRole('fdny_exam'),
          dobAudit: dataService.getSpaceForApprovalRole('dob_audit'),
        });
        // 2026-08-09: reskin item 4 — let a reskin CSV replace/extend the
        // built-in NPC roster itself (not just reassign spaces to existing
        // NPCs). Must run BEFORE configureNpcSpeakers below: that function
        // only registers a space override when the npc_speaker value already
        // matches a CHARACTER_MAP key, so a brand-new reskin NPC (e.g.
        // "Dungeon Master") has to land in CHARACTER_MAP first.
        configureCharacterMap(dataService.getCharacterRows());
        // Same reskin hook for which NPC "speaks" at each space (see
        // ApprovalService.configureApprovalSpaces above for the pattern).
        configureNpcSpeakers(dataService.getNpcSpeakerAssignments());
        // Same reskin hook for card-type display labels ("Work Package" etc).
        configureCardTypeLabels(dataService.getCardTypeLabels());
        // 2026-08-14: reskin item 2 — let a reskin CSV replace the Homeowner
        // Violation tier threshold, filing deadline, and fee/daily-accrual
        // rates. No ordering dependency on the other configure calls above.
        configureViolationRules(dataService.getViolationRuleRows());
        // Same reskin hook for button/notification text vocabulary
        // ("Hire Expeditors" etc). No ordering dependency on the other
        // configure calls above.
        configureUIStrings(dataService.getUIStringRows());

        // Try to load state from server first (multi-device sync)
        await stateService.loadStateFromServer();

        // v3.0.41: removed `fixPlayerStartingSpaces` + `forceResetAllPlayersToCorrectStartingSpace`
        // calls. They migrated players stuck on the old 'START-QUICK-PLAY-GUIDE'
        // starting space (a legacy bug from when players were created before
        // data loaded). At app init the players array is empty either way
        // (createInitialState() default or freshly-loaded-from-server state),
        // so both calls were no-ops in current flow. If a real player-state
        // migration is ever needed again, do it server-side at the storage
        // layer rather than on every client init.

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize application:', error);
        // Keep loading state to prevent rendering with invalid data
      }
    };

    initializeApp();
  }, [dataService, stateService]);

  // WebSocket connection for real-time state updates (replaces 2s polling)
  // Connects after initial load and provides sub-100ms state sync
  useEffect(() => {
    if (isLoading) return;

    const gameId = getCurrentGameId();
    if (!gameId) return;

    // Resolve which player this device is (same lookup as the device-detection
    // effect below) so the connection carries a playerId — the server uses it
    // to track per-player presence for the "which player are you?" picker's
    // takeover warning. Spectator/TV connections resolve to no player, which
    // is fine: connect() just omits playerId from the WS URL.
    const urlParams = new URLSearchParams(window.location.search);
    const shortId = urlParams.get('p');
    const fullPlayerId = urlParams.get('playerId');
    const player = shortId
      ? gameState?.players?.find(p => p.shortId === shortId)
      : fullPlayerId
        ? gameState?.players?.find(p => p.id === fullPlayerId)
        : undefined;

    // Connect WebSocket for real-time updates
    // ServerSyncService handles state updates via its WebSocket callback
    stateService.connectWebSocket(player?.id);

    // Cleanup on unmount
    return () => {
      stateService.disconnectWebSocket();
    };
    // exhaustive-deps wants `gameState?.players` here because the lookup above
    // reads it. Deliberately omitted: this effect opens a WebSocket, and
    // `gameState.players` is a fresh array reference on essentially every state
    // update (StateService rebuilds it in updatePlayer), so depending on it
    // would tear down and reopen the socket continuously.
    // Reading it stale is safe here: initializeApp() awaits
    // loadStateFromServer() BEFORE setIsLoading(false), so by the time this
    // effect runs the roster is already populated and the player resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateService, isLoading]);

  // Detect and store device type when player connects via URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shortId = urlParams.get('p');
    const fullPlayerId = urlParams.get('playerId');

    if (!shortId && !fullPlayerId) return; // No player ID in URL, skip
    if (!gameState || !gameState.players) return; // State not ready yet

    const deviceType = detectDeviceType();

    // Look up player by short ID or full ID
    const player = shortId
      ? gameState.players.find(p => p.shortId === shortId)
      : gameState.players.find(p => p.id === fullPlayerId);

    const urlPlayerId = player?.id;

    // Only update if player exists and doesn't already have deviceType set
    if (player && !player.deviceType) {
      stateService.updatePlayer({ id: urlPlayerId, deviceType });
    }
    // Deliberately keyed on the players array LENGTH, not on `gameState`.
    // exhaustive-deps wants the whole object; that would re-run this on every
    // state change (money, position, every dice roll) to re-check a device type
    // that only matters when a player joins. The length is the join signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.players?.length, stateService]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Read URL parameters to determine routing
  const urlParams = getURLParams();
  const routeInfo = getAppScreen(urlParams, gameState.gamePhase, gameState.players);


  // Check for TV mode
  const isTVMode = urlParams.get('mode') === 'tv';

  // TV Display Mode - during SETUP show normal GameLayout (with PlayerSetup),
  // during PLAY/END show the TV-optimized display
  if (isTVMode && gameState.gamePhase !== 'SETUP') {
    return <TVDisplay />;
  }

  // Render based on routing logic
  // If playerId is specified in URL and valid, show player-specific view
  if (routeInfo.playerId && routeInfo.isValidPlayer) {
    return (
      <>
        <GameLayout
          viewPlayerId={routeInfo.playerId}
          initialPreview={initialPreview}
          onPreviewConsumed={() => setInitialPreview(null)}
        />
      </>
    );
  }

  // Show warning if invalid player ID in URL
  if (routeInfo.playerId && !routeInfo.isValidPlayer) {
    debugWarn(`Invalid player ID in URL: ${routeInfo.playerId}`);
  }

  // Default: show normal game view (no player locking)
  return (
    <>
      <GameLayout
        initialPreview={initialPreview}
        onPreviewConsumed={() => setInitialPreview(null)}
      />
    </>
  );
}

/**
 * App component serves as the composition root for the entire application.
 * It wraps the main layout with the ServiceProvider to provide dependency injection
 * throughout the component tree. ErrorBoundary catches and handles any unexpected errors.
 *
 * Single-screen setup (v2.69.x): when there's no game ID in the URL, App
 * auto-creates a backend game BEFORE ServiceProvider mounts. This has to
 * happen at the App level — not inside PlayerSetup — because if it ran any
 * later, ServiceProvider's state load would fall through to the legacy
 * /api/gamestate endpoint and could pick up a stale PLAY-phase game from
 * the single-game era, which would skip PlayerSetup entirely.
 */
export function App(): JSX.Element {
  // True only on the initial render when there's no game id yet. The effect
  // below either redirects (full reload with the new game id in the URL) or
  // — on POST failure — clears this flag so the rest of the app can mount
  // anyway. `useState(() => ...)` runs the check once; it doesn't react to
  // URL changes after mount (a redirect would unmount everything anyway).
  const [autoCreating, setAutoCreating] = useState(() => !getCurrentGameId());
  const [autoCreateError, setAutoCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoCreating) return;
    let cancelled = false;
    (async () => {
      try {
        const backendURL = getBackendURL();
        const response = await fetch(`${backendURL}/api/games`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const data: { gameId: string; token: string } = await response.json();
        if (cancelled) return;
        const url = new URL(window.location.href);
        url.searchParams.set('g', data.gameId);
        if (data.token) url.searchParams.set('token', data.token);
        // Full reload — the rest of the app re-initializes with the new
        // gameId in the URL, so state loading targets the right game.
        window.location.href = url.toString();
      } catch (err) {
        if (cancelled) return;
        // POST failed (server down, network, etc). Surface a message and
        // let the rest of the app mount anyway so the user at least sees
        // the UI rather than a blank loading screen forever.
        setAutoCreateError(
          err instanceof Error ? err.message : 'Could not reach the game server.'
        );
        setAutoCreating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [autoCreating]);

  if (autoCreating) {
    return <LoadingScreen message="Setting up a new game…" />;
  }

  return (
    <ErrorBoundary>
      {autoCreateError && (
        <div
          role="alert"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#fee2e2', color: '#991b1b',
            padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem',
            borderBottom: '1px solid #fca5a5'
          }}
        >
          Couldn’t start a new game ({autoCreateError}). Try refreshing.
        </div>
      )}
      <ServiceProvider>
        <DictionaryProvider>
          <ErrorBoundary>
            <AppContent />
            <DictionaryPanelWrapper />
            <FeedbackButton />
            <VersionBadge />
          </ErrorBoundary>
        </DictionaryProvider>
      </ServiceProvider>
    </ErrorBoundary>
  );
}
