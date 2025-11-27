// src/utils/networkDetection.ts

/**
 * Network detection utilities for multi-device support
 * Handles URL generation for QR codes and server communication
 */

/**
 * Get the current server URL using the actual network address
 * This ensures QR codes work from other devices on the same network
 *
 * @param playerId Optional player ID or short ID to include in URL
 * @param shortId Optional short ID to use for URL (e.g., "P1" instead of full ID)
 * @returns Full URL to access the app (with optional player parameter)
 *
 * @example
 * getServerURL()
 * // => "http://192.168.1.100:3000"
 *
 * getServerURL("player_123", "P1")
 * // => "http://192.168.1.100:3000?p=P1"
 */
export function getServerURL(playerId?: string, shortId?: string): string {
  // Use window.location to get the actual hostname and port
  // This will be the network IP when running with `npm run dev -- --host`
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // 192.168.x.x or localhost
  const port = window.location.port; // 3000 (or empty for default ports)

  // Build base URL
  const baseURL = port
    ? `${protocol}//${hostname}:${port}`
    : `${protocol}//${hostname}`;

  // Add player parameter if provided (prefer shortId if available)
  if (shortId) {
    return `${baseURL}?p=${encodeURIComponent(shortId)}`;
  } else if (playerId) {
    return `${baseURL}?playerId=${encodeURIComponent(playerId)}`;
  }

  return baseURL;
}

/**
 * Get the backend server URL for API calls
 * Backend runs on port 3001, frontend on port 3000
 *
 * @returns Backend server URL
 *
 * @example
 * getBackendURL()
 * // => "http://192.168.1.100:3001"
 */
export function getBackendURL(): string {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  // Backend always runs on port 3001
  return `${protocol}//${hostname}:3001`;
}

/**
 * Check if the app is running on localhost vs network
 * Useful for debugging and showing warnings
 *
 * @returns true if running on localhost, false if on network IP
 */
export function isLocalhost(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Get a user-friendly network address for display
 * Shows a warning if running on localhost (QR codes won't work from other devices)
 *
 * @returns Object with address and warning message
 */
export function getNetworkInfo(): { address: string; isLocalhost: boolean; warning?: string } {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const address = port ? `${hostname}:${port}` : hostname;
  const localhost = isLocalhost();

  return {
    address,
    isLocalhost: localhost,
    warning: localhost
      ? 'Running on localhost - QR codes will only work on this device. Run with `npm run dev -- --host` to enable network access.'
      : undefined
  };
}
