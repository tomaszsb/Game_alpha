/**
 * ShareGameButton.test.tsx
 *
 * Test suite for the game-setup screen's Share button
 * (fb:feedback-1783230681607-5e05dc1f). Covers the navigator.share path,
 * the clipboard fallback, and the "no game in the URL yet" guard.
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareGameButton } from '../../../src/components/setup/ShareGameButton';

describe('ShareGameButton', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/?g=G418&token=tok-abc123');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders a Share button when a game is in the URL', () => {
    render(<ShareGameButton />);
    expect(screen.getByRole('button', { name: /share game link/i })).toBeInTheDocument();
  });

  it('renders nothing when there is no game in the URL', () => {
    window.history.pushState({}, '', '/');
    render(<ShareGameButton />);
    expect(screen.queryByRole('button', { name: /share game link/i })).not.toBeInTheDocument();
  });

  it('calls navigator.share with the join URL when the Web Share API is available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } });

    render(<ShareGameButton />);
    fireEvent.click(screen.getByRole('button', { name: /share game link/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    const callArg = shareMock.mock.calls[0][0];
    expect(callArg.url).toContain('g=G418');
    expect(callArg.url).toContain('token=tok-abc123');
  });

  it('falls back to copying the join URL to the clipboard and shows "Copied!" when navigator.share is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: writeTextMock } });

    render(<ShareGameButton />);
    fireEvent.click(screen.getByRole('button', { name: /share game link/i }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain('g=G418');
    expect(copiedUrl).toContain('token=tok-abc123');

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });
});
