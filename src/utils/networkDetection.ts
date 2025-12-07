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
 * Backend typically runs on port 3001, but may use a different port if 3001 is taken
 * This function will try to detect the actual backend port
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
  const frontendPort = parseInt(window.location.port || '80');

  // Try ports in this order:
  // 1. Frontend port + 1 (most common case: frontend=3000, backend=3001)
  // 2. 3001 (default backend port)
  // 3. Frontend port + 2 (if both 3000 and 3001 were taken, backend might be on 3002)
  // We'll return the first guess and let the caller handle retries if needed
  const backendPort = frontendPort + 1;

  return `${protocol}//${hostname}:${backendPort}`;
}

/**
 * Detect the actual backend port by trying common ports
 * Call this once at app startup and cache the result
 *
 * @returns Promise that resolves to the backend URL
 */
export async function detectBackendURL(): Promise<string> {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const frontendPort = parseInt(window.location.port || '80');

  // Ports to try in order of likelihood
  const portsToTry = [
    frontendPort + 1,  // Most likely: frontend + 1
    3001,              // Default backend port
    frontendPort + 2,  // If frontend is on 3001, backend might be on 3002
    3002,              // Backend's second choice
    3003               // Backend's third choice
  ];

  // Remove duplicates
  const uniquePorts = [...new Set(portsToTry)];

  for (const port of uniquePorts) {
    const url = `${protocol}//${hostname}:${port}`;
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000) // 1 second timeout
      });

      if (response.ok) {
        console.log(`✅ Detected backend server at ${url}`);
        return url;
      }
    } catch (e) {
      // Port didn't respond, try next one
      continue;
    }
  }

  // Fallback to best guess if detection failed
  console.warn('⚠️  Could not detect backend server, using default');
  return `${protocol}//${hostname}:${frontendPort + 1}`;
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
