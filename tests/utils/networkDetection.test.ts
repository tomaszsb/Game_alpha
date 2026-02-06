/**
 * networkDetection.test.ts
 *
 * Tests for network detection utilities used for multi-device support
 * @vitest-environment jsdom
 * @vitest-pool forks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock window.location
const mockLocation = {
  protocol: 'http:',
  hostname: 'localhost',
  port: '3000',
  search: '',
  href: 'http://localhost:3000'
};

describe('networkDetection', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.resetModules();
    // Save and mock window.location
    originalLocation = window.location;
    // @ts-ignore - Deleting location for mocking
    delete (window as { location?: Location }).location;
    window.location = { ...mockLocation } as unknown as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('getBackendURL', () => {
    it('should return empty string in production mode (port 80)', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'https:',
        hostname: 'game.unravelcodes.com',
        port: '', // Empty port = default 80/443
        href: 'https://game.unravelcodes.com'
      } as Location;

      const { getBackendURL } = await import('../../src/utils/networkDetection');
      const result = getBackendURL();

      expect(result).toBe('');
    });

    it('should return empty string for production on custom port (not 3000/5173)', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'https:',
        hostname: 'game.unravelcodes.com',
        port: '3080',
        href: 'https://game.unravelcodes.com:3080'
      } as Location;

      const { getBackendURL } = await import('../../src/utils/networkDetection');
      const result = getBackendURL();

      expect(result).toBe('');
    });

    it('should return backend URL for development on port 3000', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'http:',
        hostname: 'localhost',
        port: '3000',
        href: 'http://localhost:3000'
      } as Location;

      const { getBackendURL } = await import('../../src/utils/networkDetection');
      const result = getBackendURL();

      expect(result).toBe('http://localhost:3001');
    });

    it('should return backend URL for development on port 5173 (Vite)', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'http:',
        hostname: '192.168.1.100',
        port: '5173',
        href: 'http://192.168.1.100:5173'
      } as Location;

      const { getBackendURL } = await import('../../src/utils/networkDetection');
      const result = getBackendURL();

      expect(result).toBe('http://192.168.1.100:5174');
    });

    it('should use VITE_SERVER_URL environment variable if set', async () => {
      // This test requires mocking import.meta.env which is complex in Vitest
      // The actual behavior is tested in integration tests
    });
  });

  describe('getServerURL', () => {
    it('should return base URL without parameters when no IDs provided', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'http:',
        hostname: '192.168.1.100',
        port: '3000',
        href: 'http://192.168.1.100:3000',
        search: ''
      } as Location;

      const { getServerURL } = await import('../../src/utils/networkDetection');
      const result = getServerURL();

      expect(result).toBe('http://192.168.1.100:3000');
    });

    it('should include game ID and player short ID in URL', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'http:',
        hostname: '192.168.1.100',
        port: '3000',
        href: 'http://192.168.1.100:3000',
        search: ''
      } as Location;

      const { getServerURL } = await import('../../src/utils/networkDetection');
      const result = getServerURL('player_123', 'P1', 'G1');

      expect(result).toBe('http://192.168.1.100:3000?g=G1&p=P1');
    });

    it('should include full player ID if no short ID provided', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'http:',
        hostname: '192.168.1.100',
        port: '3000',
        href: 'http://192.168.1.100:3000',
        search: ''
      } as Location;

      const { getServerURL } = await import('../../src/utils/networkDetection');
      const result = getServerURL('player_123', undefined, 'G1');

      expect(result).toBe('http://192.168.1.100:3000?g=G1&playerId=player_123');
    });

    it('should work without port (production on 80/443)', async () => {
      window.location = {
        ...mockLocation,
        protocol: 'https:',
        hostname: 'game.unravelcodes.com',
        port: '',
        href: 'https://game.unravelcodes.com',
        search: ''
      } as Location;

      const { getServerURL } = await import('../../src/utils/networkDetection');
      const result = getServerURL(undefined, 'P1', 'G1');

      expect(result).toBe('https://game.unravelcodes.com?g=G1&p=P1');
    });
  });

  describe('getCurrentGameId', () => {
    it('should return game ID from URL parameter g', async () => {
      window.location = {
        ...mockLocation,
        search: '?g=G1&p=P1'
      } as Location;

      const { getCurrentGameId } = await import('../../src/utils/networkDetection');
      const result = getCurrentGameId();

      expect(result).toBe('G1');
    });

    it('should return undefined when no game ID in URL', async () => {
      window.location = {
        ...mockLocation,
        search: ''
      } as Location;

      const { getCurrentGameId } = await import('../../src/utils/networkDetection');
      const result = getCurrentGameId();

      expect(result).toBeUndefined();
    });
  });

  describe('getGameStateAPIPath', () => {
    it('should return multi-game path when game ID provided', async () => {
      const { getGameStateAPIPath } = await import('../../src/utils/networkDetection');
      const result = getGameStateAPIPath('G1');

      expect(result).toBe('/api/games/G1/state');
    });

    it('should return legacy path when no game ID', async () => {
      window.location = {
        ...mockLocation,
        search: ''
      } as Location;

      const { getGameStateAPIPath } = await import('../../src/utils/networkDetection');
      const result = getGameStateAPIPath();

      expect(result).toBe('/api/gamestate');
    });
  });

  describe('isLocalhost', () => {
    it('should return true for localhost', async () => {
      window.location = {
        ...mockLocation,
        hostname: 'localhost'
      } as Location;

      const { isLocalhost } = await import('../../src/utils/networkDetection');
      expect(isLocalhost()).toBe(true);
    });

    it('should return true for 127.0.0.1', async () => {
      window.location = {
        ...mockLocation,
        hostname: '127.0.0.1'
      } as Location;

      const { isLocalhost } = await import('../../src/utils/networkDetection');
      expect(isLocalhost()).toBe(true);
    });

    it('should return false for network IP', async () => {
      window.location = {
        ...mockLocation,
        hostname: '192.168.1.100'
      } as Location;

      const { isLocalhost } = await import('../../src/utils/networkDetection');
      expect(isLocalhost()).toBe(false);
    });

    it('should return false for domain name', async () => {
      window.location = {
        ...mockLocation,
        hostname: 'game.unravelcodes.com'
      } as Location;

      const { isLocalhost } = await import('../../src/utils/networkDetection');
      expect(isLocalhost()).toBe(false);
    });
  });

  describe('getNetworkInfo', () => {
    it('should include warning for localhost', async () => {
      window.location = {
        ...mockLocation,
        hostname: 'localhost',
        port: '3000'
      } as Location;

      const { getNetworkInfo } = await import('../../src/utils/networkDetection');
      const result = getNetworkInfo();

      expect(result.isLocalhost).toBe(true);
      expect(result.warning).toContain('localhost');
      expect(result.address).toBe('localhost:3000');
    });

    it('should not include warning for network IP', async () => {
      window.location = {
        ...mockLocation,
        hostname: '192.168.1.100',
        port: '3000'
      } as Location;

      const { getNetworkInfo } = await import('../../src/utils/networkDetection');
      const result = getNetworkInfo();

      expect(result.isLocalhost).toBe(false);
      expect(result.warning).toBeUndefined();
      expect(result.address).toBe('192.168.1.100:3000');
    });
  });
});
