// src/App.tsx

import React, { useState, useEffect } from 'react';
import { ServiceProvider } from './context/ServiceProvider';
import { GameLayout } from './components/layout/GameLayout';
import { TVDisplay } from './components/layout/TVDisplay';
import { LandingPage } from './components/layout/LandingPage';
import { useGameContext } from './context/GameContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { colors } from './styles/theme';
import { getAppScreen, getURLParams } from './utils/getAppScreen';
import { getGameStateAPIPath, getCurrentGameId } from './utils/networkDetection';
import { detectDeviceType } from './utils/deviceDetection';
import { GameLobby } from './components/setup/GameLobby';
import { DictionaryProvider, DictionaryPanel, useDictionaryPanel } from './dictionary';
import { getTooltipService } from './services/TooltipService';
import { getPreviewParams, clearPreviewParams } from './utils/dictionaryBridge';

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
      <div style={{ marginBottom: '20px', fontSize: '48px' }}>🎲</div>
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
      console.log('🔍 Detected inbound preview request:', preview);
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

        // Try to load state from server first (multi-device sync)
        console.log('🌐 Attempting to load state from server...');
        const stateLoaded = await stateService.loadStateFromServer();

        if (!stateLoaded) {
          console.log('📱 No server state found, using local state');

          // Fix any existing players who might have incorrect starting spaces
          // This addresses the caching bug where players were created before data loaded
          console.log('🔧 Attempting to fix player starting spaces after data load...');
          stateService.fixPlayerStartingSpaces();

          // If that didn't work, use the aggressive fix
          console.log('🚨 Using aggressive fix to ensure all players are on correct starting space...');
          stateService.forceResetAllPlayersToCorrectStartingSpace();
        } else {
          console.log('✅ State loaded from server successfully');
        }

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

    // Connect WebSocket for real-time updates
    // ServerSyncService handles state updates via its WebSocket callback
    console.log('🔌 Connecting WebSocket for real-time sync...');
    stateService.connectWebSocket();

    // Cleanup on unmount
    return () => {
      stateService.disconnectWebSocket();
    };
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

    console.log(`📱 Device detection triggered for playerId: ${urlPlayerId}`);
    console.log(`📱 Detected device type: ${deviceType}`);
    console.log(`📱 Current players in state:`, gameState.players.map(p => p.id));
    console.log(`📱 Player found:`, player ? 'YES' : 'NO');
    if (player) {
      console.log(`📱 Player existing deviceType:`, player.deviceType);
    }

    // Only update if player exists and doesn't already have deviceType set
    if (player && !player.deviceType) {
      console.log(`📱 Setting device type for ${urlPlayerId}: ${deviceType}`);
      stateService.updatePlayer({ id: urlPlayerId, deviceType });
    }
  }, [gameState?.players?.length, stateService]); // Only re-run when players array length changes

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Read URL parameters to determine routing
  const urlParams = getURLParams();
  const routeInfo = getAppScreen(urlParams, gameState.gamePhase, gameState.players);

  console.log('🔍 Routing info:', routeInfo);

  // Check for TV mode
  const isTVMode = urlParams.get('mode') === 'tv';

  // TV Display Mode - shows game board prominently with QR codes
  if (isTVMode) {
    console.log('📺 TV Display Mode enabled');
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
    console.warn(`Invalid player ID in URL: ${routeInfo.playerId}`);
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
 * Multi-Game Support:
 * - If no parameters at all: Show LandingPage for mode selection (TV-remote friendly)
 * - If mode selected but no game: Show GameLobby to select/create game
 * - If game ID in URL: Show the game
 */
export function App(): JSX.Element {
  const gameId = getCurrentGameId();
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  // Track if user has selected a mode from landing page
  const [selectedMode, setSelectedMode] = useState<'pc' | 'tv' | null>(
    // If URL already has mode param, use it
    mode === 'tv' ? 'tv' : (gameId ? 'pc' : null)
  );

  // Handle mode selection from landing page
  const handleModeSelect = (newMode: 'pc' | 'tv') => {
    setSelectedMode(newMode);

    // For TV mode, add it to URL so refreshing maintains mode
    if (newMode === 'tv') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'tv');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // If no game ID and no mode selected, show landing page
  if (!gameId && !selectedMode) {
    return (
      <ErrorBoundary>
        <LandingPage onSelectMode={handleModeSelect} />
      </ErrorBoundary>
    );
  }

  // If no game ID but mode selected, show lobby to pick/create game
  if (!gameId) {
    const handleJoinGame = (selectedGameId: string) => {
      // Redirect to the game with appropriate mode
      const url = new URL(window.location.href);
      url.searchParams.set('g', selectedGameId);

      // Keep TV mode if selected
      if (selectedMode === 'tv') {
        url.searchParams.set('mode', 'tv');
      }

      window.location.href = url.toString();
    };

    return (
      <ErrorBoundary>
        <GameLobby
          onJoinGame={handleJoinGame}
          mode={selectedMode === 'tv' ? 'tv' : undefined}
        />
      </ErrorBoundary>
    );
  }

  // Game ID present - show the game
  return (
    <ErrorBoundary>
      <ServiceProvider>
        <DictionaryProvider>
          <ErrorBoundary>
            <AppContent />
            <DictionaryPanelWrapper />
          </ErrorBoundary>
        </DictionaryProvider>
      </ServiceProvider>
    </ErrorBoundary>
  );
}
