/**
 * ShutdownNotice.test.tsx
 *
 * Tests for the deploy-update banner, focused on the tap-to-copy affordance
 * added for feedback-1785191198601-2948cf19 ("the code number should be
 * added to clipboard"). Covers: rendering the code once a shutdown notice
 * arrives, copying it on click, showing/reverting the "Copied!" confirmation,
 * and swallowing a rejected clipboard write instead of throwing.
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Capture the callback registered via onShutdownNotice so tests can fire it
// directly, the same way the ConnectionStatus/Tooltip suites drive their
// components without a real WebSocket connection.
let shutdownCallback: ((gameId: string) => void) | null = null;
const unsubscribe = vi.fn();

vi.mock('../../../src/services/WebSocketSyncService', () => ({
  getWebSocketService: () => ({
    onShutdownNotice: (cb: (gameId: string) => void) => {
      shutdownCallback = cb;
      return unsubscribe;
    },
  }),
}));

import { ShutdownNotice } from '../../../src/components/common/ShutdownNotice';

describe('ShutdownNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    shutdownCallback = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing before a shutdown notice arrives', () => {
    render(<ShutdownNotice />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the game code once a shutdown notice arrives', () => {
    render(<ShutdownNotice />);

    act(() => {
      shutdownCallback?.('ABC123');
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('copies the game code to the clipboard on click and shows "Copied!"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<ShutdownNotice />);
    act(() => {
      shutdownCallback?.('ABC123');
    });

    const codeButton = screen.getByText('ABC123');
    await act(async () => {
      fireEvent.click(codeButton);
      // let the resolved writeText() promise's .then() flush
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('ABC123');
    expect(screen.getByText(/Copied!/)).toBeInTheDocument();

    // Confirmation reverts after a few seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText(/Copied!/)).not.toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('does not throw and shows no confirmation when the clipboard write is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('insecure context'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<ShutdownNotice />);
    act(() => {
      shutdownCallback?.('ABC123');
    });

    const codeButton = screen.getByText('ABC123');
    await act(async () => {
      fireEvent.click(codeButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('ABC123');
    expect(screen.queryByText(/Copied!/)).not.toBeInTheDocument();
    // Banner is still intact — a rejected write didn't break rendering
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('dismisses the banner when the close button is clicked', () => {
    render(<ShutdownNotice />);
    act(() => {
      shutdownCallback?.('ABC123');
    });

    fireEvent.click(screen.getByLabelText('Dismiss update notice'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
