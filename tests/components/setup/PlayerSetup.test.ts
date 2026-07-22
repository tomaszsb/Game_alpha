// tests/components/setup/PlayerSetup.test.ts
// Covers getTvModeZoom() — the setup screen's TV-mode magnification used to be
// a flat 1.3x (see the "10-foot UI" comment in PlayerSetup.tsx) applied to
// every TV. That backfired on TVs that already report a small logical
// resolution (a TCL confirmed 2026-07-22 at 960x540, same shape of bug as the
// Hisense 960x540 case in deviceDetection.test.ts): magnifying an
// already-small canvas made it look coarser, not crisper. The zoom is now
// gated on window.screen.width.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { getTvModeZoom } from '../../../src/components/setup/PlayerSetup';

function withScreenWidth(width: number, fn: () => void): void {
  const spy = vi.spyOn(window.screen, 'width', 'get').mockReturnValue(width);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

describe('getTvModeZoom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 1 (no zoom) for a small logical-resolution TV (2026-07-22 TCL vacation-TV bug, 960x540)', () => {
    withScreenWidth(960, () => expect(getTvModeZoom()).toBe(1));
  });

  it('returns 1.3 for a large logical-resolution 4K TV', () => {
    withScreenWidth(3840, () => expect(getTvModeZoom()).toBe(1.3));
  });

  it('returns 1 right at the boundary (1279px)', () => {
    withScreenWidth(1279, () => expect(getTvModeZoom()).toBe(1));
  });

  it('returns 1.3 right at the boundary (1280px)', () => {
    withScreenWidth(1280, () => expect(getTvModeZoom()).toBe(1.3));
  });
});
