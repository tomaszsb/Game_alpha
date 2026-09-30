import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VersionBadge } from '../../../src/components/common/VersionBadge';

// __APP_SEMVER__ / __APP_VERSION__ are injected by Vite's `define` at real build
// time (from package.json + git). That define is NOT applied under Vitest, so we
// stub the globals to simulate a built bundle.
describe('VersionBadge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
    cleanup();
  });

  it('renders the semver as a v#.#.# chip that stays above the modal layer', () => {
    vi.stubGlobal('__APP_SEMVER__', '9.9.9');
    vi.stubGlobal('__APP_VERSION__', 'abc1234');
    render(<VersionBadge />);
    const badge = screen.getByTestId('version-badge');
    expect(badge).toHaveTextContent('v9.9.9');
    // Must sit above the modal overlay (z-index 1000) so it shows over modals,
    // and never intercept clicks.
    expect(Number(badge.style.zIndex)).toBeGreaterThan(1000);
    expect(badge.style.pointerEvents).toBe('none');
    expect(badge.style.position).toBe('fixed');
  });

  it('renders nothing when no build version is available', () => {
    vi.stubGlobal('__APP_SEMVER__', '');
    vi.stubGlobal('__APP_VERSION__', '');
    render(<VersionBadge />);
    expect(screen.queryByTestId('version-badge')).not.toBeInTheDocument();
  });

  // fb:4c7a3628 (2026-09-27) — a report never said which of PC/TV/Remote it
  // happened on, and the screenshot alone couldn't tell either. Tom: "add
  // visual indicators on bottom of page to show game type ... right next to
  // the game version." Read from `?mode=`, the same URL contract App.tsx's
  // isTVMode and GameLayout's isRemoteMode already key off.
  describe('play-mode label (2026-09-28, fb:4c7a3628)', () => {
    beforeEach(() => {
      vi.stubGlobal('__APP_SEMVER__', '9.9.9');
      vi.stubGlobal('__APP_VERSION__', 'abc1234');
    });

    it('shows TV for ?mode=tv', () => {
      window.history.pushState({}, '', '/?mode=tv');
      render(<VersionBadge />);
      expect(screen.getByTestId('version-badge-mode')).toHaveTextContent('TV');
    });

    it('shows Remote for ?mode=remote', () => {
      window.history.pushState({}, '', '/?mode=remote');
      render(<VersionBadge />);
      expect(screen.getByTestId('version-badge-mode')).toHaveTextContent('Remote');
    });

    it('defaults to PC with no ?mode= param', () => {
      window.history.pushState({}, '', '/');
      render(<VersionBadge />);
      expect(screen.getByTestId('version-badge-mode')).toHaveTextContent('PC');
    });

    it('defaults to PC for an explicit ?mode=pc', () => {
      window.history.pushState({}, '', '/?mode=pc');
      render(<VersionBadge />);
      expect(screen.getByTestId('version-badge-mode')).toHaveTextContent('PC');
    });
  });
});
