/**
 * ConnectionStatus.test.tsx
 *
 * Tests for ConnectionStatus component that displays server connection status
 * Focus on the HTTPS fix where empty string serverUrl should work correctly
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionStatus } from '../../../src/components/common/ConnectionStatus';

// Mock AbortSignal.timeout which may not be available in jsdom
const mockAbortSignal = { aborted: false };

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    // Mock AbortSignal.timeout
    vi.stubGlobal('AbortSignal', {
      ...AbortSignal,
      timeout: vi.fn().mockReturnValue(mockAbortSignal)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Offline State when serverUrl is invalid', () => {
    it('should show offline when serverUrl is undefined', async () => {
      render(<ConnectionStatus serverUrl={undefined as unknown as string} checkInterval={300000} />);

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should show offline when serverUrl is null', async () => {
      render(<ConnectionStatus serverUrl={null as unknown as string} checkInterval={300000} />);

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Empty ServerUrl Handling (HTTPS Fix)', () => {
    it('should NOT show offline when serverUrl is empty string (same-origin production mode)', async () => {
      // This is the key test for the HTTPS fix:
      // Empty string serverUrl should be treated as valid (same-origin)
      // and should NOT immediately go to offline state

      // Mock fetch to resolve successfully - must be done before render
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      render(<ConnectionStatus serverUrl="" checkInterval={300000} />);

      // Wait for the component to check connection
      // In production with empty serverUrl, it should fetch '/health'
      // and show connected (or checking) but NOT offline immediately
      await waitFor(() => {
        // Fetch should have been called with relative URL
        expect(mockFetch).toHaveBeenCalledWith('/health', expect.any(Object));
      }, { timeout: 2000 });
    });

    it('should call fetch with relative URL when serverUrl is empty string', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      render(<ConnectionStatus serverUrl="" checkInterval={300000} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Verify the URL is relative (no protocol/host)
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('/health');
    });

    it('should NOT call fetch when serverUrl is undefined', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      render(<ConnectionStatus serverUrl={undefined as unknown as string} checkInterval={300000} />);

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Fetch should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT call fetch when serverUrl is null', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      render(<ConnectionStatus serverUrl={null as unknown as string} checkInterval={300000} />);

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Fetch should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have retry button with aria-label when offline', async () => {
      render(<ConnectionStatus serverUrl={undefined as unknown as string} checkInterval={300000} />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button');
        expect(retryButton).toHaveAttribute('aria-label', 'Retry connection');
      }, { timeout: 2000 });
    });
  });
});
