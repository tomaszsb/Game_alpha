import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VersionBadge } from '../../../src/components/common/VersionBadge';

// __APP_SEMVER__ / __APP_VERSION__ are injected by Vite's `define` at real build
// time (from package.json + git). That define is NOT applied under Vitest, so we
// stub the globals to simulate a built bundle.
describe('VersionBadge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
