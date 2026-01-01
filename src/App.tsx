// src/App.tsx

import React, { useState, useEffect } from 'react';
import { ServiceProvider } from './context/ServiceProvider';
import { GameLayout } from './components/layout/GameLayout';
import { useGameContext } from './context/GameContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { colors } from './styles/theme';
import { getAppScreen, getURLParams } from './utils/getAppScreen';
import { getBackendURL, getGameStateAPIPath, getCurrentGameId } from './utils/networkDetection';
import { detectDeviceType } from './utils/deviceDetection';
import { GameLobby } from './components/setup/GameLobby';
import { DictionaryProvider, DictionaryPanel, useDictionaryPanel } from './dictionary';

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
 */
function DictionaryPanelWrapper(): JSX.Element {
  const { isOpen, closePanel, selectedTerm } = useDictionaryPanel();
  return (
    <DictionaryPanel
      isOpen={isOpen}
      onClose={closePanel}
      initialTermId={selectedTerm?.id}
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

  // Subscribe to game state changes
  useEffect(() => {
    const unsubscribe = stateService.subscribe((newState) => {
      setGameState(newState);
    });
    return unsubscribe;
  }, [stateService]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await dataService.loadData();

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

  // Poll server for state updates every 2 seconds (multi-device sync)
  useEffect(() => {
    // Track client's current state version to avoid unnecessary updates
    let clientStateVersion = 0;
    const gameId = getCurrentGameId();

    const pollInterval = setInterval(async () => {
      try {
        const backendURL = getBackendURL();
        const apiPath = getGameStateAPIPath(gameId);
        const response = await fetch(`${backendURL}${apiPath}`);

        if (response.ok) {
          const { state, stateVersion } = await response.json();

          // Only update if server has newer state (prevents unnecessary re-renders)
          // This reduces re-renders by ~95% since state only changes when user takes action
          if (state && stateVersion > clientStateVersion) {
            // Pass serverVersion to prevent stale state overwrites (Dec 29, 2025 fix)
            stateService.replaceState(state, stateVersion);
            clientStateVersion = stateVersion;
            console.log(`📥 Updated from server (v${stateVersion})${gameId ? ` [${gameId}]` : ''}`);
          }
          // else: Server state unchanged, skip update
        }
      } catch (error) {
        // Server not available - continue with local state
        // Silently fail to avoid console spam
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [stateService]);

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

  // Render based on routing logic
  // If playerId is specified in URL and valid, show player-specific view
  if (routeInfo.playerId && routeInfo.isValidPlayer) {
    return (
      <>
        <GameLayout viewPlayerId={routeInfo.playerId} />
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
      <GameLayout />
    </>
  );
}

/**
 * App component serves as the composition root for the entire application.
 * It wraps the main layout with the ServiceProvider to provide dependency injection
 * throughout the component tree. ErrorBoundary catches and handles any unexpected errors.
 *
 * Multi-Game Support:
 * - If no game ID in URL: Show GameLobby for create/join
 * - If game ID in URL: Show the game
 */
export function App(): JSX.Element {
  const gameId = getCurrentGameId();

  // If no game ID in URL, show the lobby to create or join a game
  if (!gameId) {
    const handleJoinGame = (selectedGameId: string) => {
      // Redirect to the game by updating the URL
      const url = new URL(window.location.href);
      url.searchParams.set('g', selectedGameId);
      window.location.href = url.toString();
    };

    return (
      <ErrorBoundary>
        <GameLobby onJoinGame={handleJoinGame} />
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
