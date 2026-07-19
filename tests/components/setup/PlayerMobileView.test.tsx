/**
 * PlayerMobileView.test.tsx
 *
 * Covers the "Invite a Friend" affordance added to the per-player mobile
 * setup screen (fb:2c848b47 — "Share icon" / "Not seen on phone"). Before
 * this fix, a player who joined via their own phone (?p=<shortId>) had no
 * way at all to invite anyone else from this screen — PlayerMobileView had
 * zero share-related code. This reuses the same navigator.share ->
 * clipboard-fallback mechanism as ShareGameButton.tsx (now extracted into
 * useShareGameLink), just with its own styling suited to this screen's
 * white-card mobile layout.
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerMobileView } from '../../../src/components/setup/PlayerMobileView';
import { createTestPlayer } from '../../fixtures/testData';

describe('PlayerMobileView — invite affordance', () => {
  const player = createTestPlayer({ id: 'p1', name: 'Alice', color: '#007bff', avatar: '👤' });

  const renderView = (overrides: Partial<React.ComponentProps<typeof PlayerMobileView>> = {}) =>
    render(
      <PlayerMobileView
        player={player}
        onUpdatePlayer={vi.fn()}
        onCycleAvatar={vi.fn()}
        appSemver="1.2.3"
        appCommit="abc1234"
        syncStatus={{ status: 'checking' }}
        {...overrides}
      />
    );

  beforeEach(() => {
    window.history.pushState({}, '', '/?g=G418&token=tok-abc123&p=P1');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders an Invite a Friend button when a game is in the URL', () => {
    renderView();
    expect(screen.getByRole('button', { name: /invite a friend/i })).toBeInTheDocument();
  });

  it('renders no invite button when there is no game in the URL', () => {
    window.history.pushState({}, '', '/');
    renderView();
    expect(screen.queryByRole('button', { name: /invite a friend/i })).not.toBeInTheDocument();
  });

  it('calls navigator.share with the join URL (not the current player-specific URL) when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } });

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /invite a friend/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    const callArg = shareMock.mock.calls[0][0];
    expect(callArg.url).toContain('g=G418');
    expect(callArg.url).toContain('token=tok-abc123');
    // The shared link must be the generic join link, not this device's own
    // ?p=P1 identity — otherwise whoever opens it would be hijacking Alice's
    // player slot instead of landing on the setup screen to add themselves.
    expect(callArg.url).not.toContain('p=P1');
  });

  it('falls back to copying the join URL to the clipboard and shows "Copied!" when navigator.share is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: writeTextMock } });

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /invite a friend/i }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain('g=G418');
    expect(copiedUrl).not.toContain('p=P1');

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('still renders the waiting-for-host message and player card alongside the invite button', () => {
    renderView();
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });
});
