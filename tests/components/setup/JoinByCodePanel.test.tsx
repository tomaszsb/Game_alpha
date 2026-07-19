/**
 * JoinByCodePanel.test.tsx
 *
 * fb:3a5280d8 — picking a player from the "which player are you?" picker set
 * ?p= unconditionally, which GameLayout reads as "show the phone-only
 * stripped panel." That's correct for a rejoining player on their actual
 * phone (fb:feedback-1783819148816-bb72760f), but this panel lives on the
 * PC/TV setup screen (selectedMode is 'pc' | 'tv', never 'phone'), so a
 * maintainer picking a player on an actual PC/TV lost the board and all
 * other chrome. Fix: only set ?p= when the physical screen is phone-sized
 * (isPhoneScreen(), same check PhoneScreenWarning already uses one
 * component up in PlayerSetup).
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JoinByCodePanel } from '../../../src/components/setup/JoinByCodePanel';

vi.mock('../../../src/utils/networkDetection', () => ({
  getBackendURL: () => 'http://test-backend',
}));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body };
}

function setScreenSize(width: number, height: number): void {
  Object.defineProperty(window, 'screen', {
    configurable: true,
    value: { ...window.screen, width, height },
  });
}

const JOIN_INFO_WITH_PLAYERS = {
  token: 'tok-abc123',
  instanceId: 'classroom-1',
  gamePhase: 'PLAY',
  playerCount: 2,
  players: [
    { id: 'player_1', shortId: 'P1', name: 'Alex', color: '#f00', connected: false },
    { id: 'player_2', shortId: 'P2', name: 'Sam', color: '#00f', connected: false },
  ],
};

describe('JoinByCodePanel', () => {
  const fetchMock = vi.fn();
  const originalScreen = window.screen;
  const originalLocation = window.location;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    const mockLocation = { ...originalLocation, href: 'http://localhost/' };
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'screen', { configurable: true, value: originalScreen });
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  async function joinAndOpenPicker(mode: 'pc' | 'tv') {
    fetchMock.mockResolvedValue(jsonResponse(JOIN_INFO_WITH_PLAYERS));
    render(<JoinByCodePanel selectedMode={mode} />);

    fireEvent.change(screen.getByPlaceholderText('e.g., G7'), { target: { value: 'G418' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText(/Which one are you/i)).toBeInTheDocument();
  }

  it('does not set ?p= when picking a player on a desktop-sized screen (fb:3a5280d8)', async () => {
    setScreenSize(1920, 1080);
    await joinAndOpenPicker('pc');

    fireEvent.click(screen.getByRole('button', { name: /Alex/ }));

    await waitFor(() => expect(window.location.href).toContain('g=G418'));
    expect(window.location.href).not.toContain('p=P1');
  });

  it('does not set ?p= when picking a player on a TV-sized screen', async () => {
    setScreenSize(1920, 1080);
    await joinAndOpenPicker('tv');

    fireEvent.click(screen.getByRole('button', { name: /Sam/ }));

    await waitFor(() => expect(window.location.href).toContain('g=G418'));
    expect(window.location.href).not.toContain('p=P2');
    expect(window.location.href).toContain('mode=tv');
  });

  it('still sets ?p= when picking a player on a phone-sized screen', async () => {
    setScreenSize(390, 844);
    await joinAndOpenPicker('pc');

    fireEvent.click(screen.getByRole('button', { name: /Alex/ }));

    await waitFor(() => expect(window.location.href).toContain('p=P1'));
  });

  it('never sets ?p= for the "Just watching" spectator choice, regardless of screen size', async () => {
    setScreenSize(390, 844);
    await joinAndOpenPicker('pc');

    fireEvent.click(screen.getByRole('button', { name: /Just watching/ }));

    await waitFor(() => expect(window.location.href).toContain('g=G418'));
    expect(window.location.href).not.toContain('p=');
  });
});
