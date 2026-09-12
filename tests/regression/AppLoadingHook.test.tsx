// tests/regression/AppLoadingHook.test.tsx
//
// 2026-09-12: the nightly playtest robot reported "no 'Start Game' button on
// the setup screen" for one of four games. The server log shows that game
// never created a game at all, so the app was still starting up: a bare-URL
// visit renders a button-less LoadingScreen while it loads CSVs, POSTs
// /api/games and then does a FULL page reload — only after that does the
// setup screen with "Start Game" exist. Nothing about the button changed
// (no commit touched src/components/setup or App.tsx since 2026-09-09).
//
// The screen now carries data-testid="app-loading" + data-phase, so a harness
// can wait for it instead of sampling blind, and a failure can be reported as
// "still starting up" rather than as a missing button. This test pins the
// hook to the real bootstrap path: with the create-game request unresolved,
// App must show the loading screen and no Start Game button.

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/App';

describe('the app exposes a structural handle while it is still starting up', () => {
  beforeEach(() => {
    localStorage.clear();
    // Bare URL, nothing remembered: App goes straight to auto-creating a game.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders data-testid="app-loading" (phase auto-creating) and no Start Game button', () => {
    render(<App />);
    const loading = document.querySelector('[data-testid="app-loading"]');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('data-phase')).toBe('auto-creating');
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
  });
});
