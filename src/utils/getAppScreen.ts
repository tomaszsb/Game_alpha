// src/utils/getAppScreen.ts

/**
 * Routing logic for determining which screen to show based on URL parameters
 * Supports multi-device play via QR codes with player-specific views
 */

import { Player } from '../types/StateTypes';

export type AppScreen = 'setup' | 'player' | 'game';

export interface AppScreenResult {
  /** Which screen/view to display */
  screen: AppScreen;
  /** Player ID from URL (if accessing player-specific view) */
  playerId?: string;
  /** Whether this is a valid player ID (checked against game state) */
  isValidPlayer?: boolean;
}

/**
 * Determine which screen to show based on URL parameters and game state
 *
 * Routing logic:
 * - No player parameter → show normal game view (desktop experience)
 * - Player parameter (short or full) + valid ID → show player-specific panel (mobile experience)
 * - Player parameter + invalid ID → show game view with warning
 *
 * @param urlSearchParams URL search parameters (e.g., from window.location.search)
 * @param gamePhase Current game phase from state ('SETUP' | 'PLAY' | 'END')
 * @param players List of players from game state (for resolving short IDs)
 * @returns Object with screen type and full playerId (if applicable)
 *
 * @example
 * // Desktop: http://192.168.1.100:3000
 * getAppScreen(new URLSearchParams(''), 'PLAY', players)
 * // => { screen: 'game', playerId: undefined }
 *
 * @example
 * // Phone scans QR (short URL): http://192.168.1.100:3000?p=P1
 * getAppScreen(new URLSearchParams('?p=P1'), 'PLAY', players)
 * // => { screen: 'player', playerId: 'player_123_abc', isValidPlayer: true }
 *
 * @example
 * // Phone scans QR (old URL): http://192.168.1.100:3000?playerId=player_123_abc
 * getAppScreen(new URLSearchParams('?playerId=player_123_abc'), 'PLAY', players)
 * // => { screen: 'player', playerId: 'player_123_abc', isValidPlayer: true }
 */
export function getAppScreen(
  urlSearchParams: URLSearchParams,
  gamePhase: 'SETUP' | 'PLAY' | 'END',
  players: Player[]
): AppScreenResult {
  // Check for both short format (?p=P1) and old format (?playerId=...)
  const shortId = urlSearchParams.get('p');
  const fullPlayerId = urlSearchParams.get('playerId');

  // Resolve player ID (prefer short format if both are provided)
  let playerId: string | undefined;
  let player: Player | undefined;

  if (shortId) {
    // Look up player by short ID
    player = players.find(p => p.shortId === shortId);
    playerId = player?.id;
  } else if (fullPlayerId) {
    // Look up player by full ID
    player = players.find(p => p.id === fullPlayerId);
    playerId = player?.id;
  }

  // No player parameter → show normal game view
  if (!playerId) {
    return {
      screen: 'game',
      playerId: undefined
    };
  }

  // Player parameter provided → check if it's valid
  const isValidPlayer = !!player;

  // Valid player ID + game in PLAY phase → show player-specific panel
  if (isValidPlayer && gamePhase === 'PLAY') {
    return {
      screen: 'player',
      playerId,
      isValidPlayer: true
    };
  }

  // Valid player ID but game in SETUP → show setup screen
  // (This handles the case where QR is scanned before game starts)
  if (isValidPlayer && gamePhase === 'SETUP') {
    return {
      screen: 'setup',
      playerId,
      isValidPlayer: true
    };
  }

  // Invalid player ID → show game view (default fallback)
  if (!isValidPlayer) {
    const requestedId = shortId || fullPlayerId;
    console.warn(`Invalid player ID in URL: ${requestedId}. Available players:`, players.map(p => ({ id: p.id, shortId: p.shortId })));
    return {
      screen: 'game',
      playerId: requestedId,
      isValidPlayer: false
    };
  }

  // Fallback: show game view
  return {
    screen: 'game',
    playerId
  };
}

/**
 * Read URL parameters from current window location
 * Convenience wrapper around URLSearchParams
 *
 * @returns URLSearchParams object from current URL
 */
export function getURLParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
