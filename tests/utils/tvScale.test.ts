/**
 * tvScale.test.ts
 *
 * The TV layout-width choice behind fb:93449bf2 — a 75" 4K television that
 * hands the app a 960x540 layout viewport at devicePixelRatio 4, so the
 * picture is sharp but there is only a phone's worth of room to lay things
 * out in. These cover the two things that are easy to get wrong: WHO the
 * override is offered to (a phone or a plain laptop must never be widened),
 * and whether the preview samples are drawn at the size they are promising.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TV_SCALE_STORAGE_KEY,
  TV_SCALE_NATIVE,
  TV_SCALE_OPTIONS,
  getNativeLayoutWidth,
  getDevicePixelRatio,
  getPanelPixelWidth,
  tvScaleIsAvailable,
  readTvLayoutWidth,
  writeTvLayoutWidth,
  applyTvLayoutWidth,
  previewFontPx,
  applyStoredTvLayoutWidth,
} from '../../src/utils/tvScale';

/** Stand in for a device: what `screen.width` and `devicePixelRatio` say. */
function mockDevice(screenWidth: number, dpr: number, screenHeight = 540) {
  vi.stubGlobal('screen', { width: screenWidth, height: screenHeight });
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading the device', () => {
  it('reports the reporter’s TV as a 4K panel behind a 960px layout', () => {
    mockDevice(960, 4);
    expect(getNativeLayoutWidth()).toBe(960);
    expect(getDevicePixelRatio()).toBe(4);
    // The number the TV never says out loud, and the whole point of the file.
    expect(getPanelPixelWidth()).toBe(3840);
  });

  it('falls back to a ratio of 1 when the browser reports something absurd', () => {
    mockDevice(960, 0);
    expect(getDevicePixelRatio()).toBe(1);
  });
});

describe('tvScaleIsAvailable — who gets offered the override', () => {
  it('offers it to the 4K TV that reports a cramped layout', () => {
    mockDevice(960, 4);
    expect(tvScaleIsAvailable()).toBe(true);
  });

  it('does NOT offer it to a plain 1080p laptop (no unspent pixels)', () => {
    mockDevice(1920, 1);
    expect(tvScaleIsAvailable()).toBe(false);
  });

  it('does NOT offer it to a retina laptop that already has a wide layout', () => {
    mockDevice(1440, 2);
    expect(tvScaleIsAvailable()).toBe(false);
  });

  it('does NOT offer it to a phone — widening a 390px screen to 1280 is unusable', () => {
    mockDevice(390, 3);
    expect(tvScaleIsAvailable()).toBe(false);
  });

  it('does NOT offer it to a small tablet below the 600px floor', () => {
    mockDevice(540, 2);
    expect(tvScaleIsAvailable()).toBe(false);
  });
});

describe('previewFontPx — the samples must be honest', () => {
  it('shrinks a 16px sample to 12px to preview layout 1280 on a 960 device', () => {
    // 16 * (960/1280) = 12. If this were wrong the samples would all look
    // the same size and the question would be unanswerable.
    expect(previewFontPx(16, 1280, 960)).toBe(12);
  });

  it('leaves the sample alone for the native option', () => {
    expect(previewFontPx(16, TV_SCALE_NATIVE, 960)).toBe(16);
  });

  it('draws a smaller sample for a wider layout, monotonically', () => {
    const sizes = [1152, 1280, 1600].map(w => previewFontPx(16, w, 960));
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
  });

  it('never divides by zero on a device that reports nothing', () => {
    expect(previewFontPx(16, 1280, 0)).toBe(16);
  });
});

describe('storing the choice', () => {
  it('round-trips a chosen width', () => {
    writeTvLayoutWidth(1280);
    expect(readTvLayoutWidth()).toBe(1280);
  });

  it('treats "biggest text" as a real stored choice, not as unset', () => {
    writeTvLayoutWidth(TV_SCALE_NATIVE);
    expect(readTvLayoutWidth()).toBe(TV_SCALE_NATIVE);
    expect(readTvLayoutWidth()).not.toBeNull();
  });

  it('returns null when never asked', () => {
    expect(readTvLayoutWidth()).toBeNull();
  });

  it('returns null rather than NaN on a corrupt value', () => {
    localStorage.setItem(TV_SCALE_STORAGE_KEY, 'not-a-number');
    expect(readTvLayoutWidth()).toBeNull();
  });
});

describe('applyTvLayoutWidth — the whole mechanism is one meta tag', () => {
  const content = () => document.querySelector('meta[name="viewport"]')?.getAttribute('content');

  it('widens the layout viewport to the chosen width', () => {
    applyTvLayoutWidth(1280);
    expect(content()).toContain('width=1280');
  });

  it('restores device-width for the native option', () => {
    applyTvLayoutWidth(1280);
    applyTvLayoutWidth(TV_SCALE_NATIVE);
    expect(content()).toContain('width=device-width');
    expect(content()).not.toContain('width=1280');
  });

  it('does not throw when the page has no viewport meta at all', () => {
    document.head.innerHTML = '';
    expect(() => applyTvLayoutWidth(1280)).not.toThrow();
  });
});

describe('applyStoredTvLayoutWidth — safe to call on every TV mount', () => {
  const content = () => document.querySelector('meta[name="viewport"]')?.getAttribute('content');

  it('applies a stored choice on a device with headroom', () => {
    mockDevice(960, 4);
    writeTvLayoutWidth(1280);
    expect(applyStoredTvLayoutWidth()).toBe(1280);
    expect(content()).toContain('width=1280');
  });

  it('changes nothing when the device was never asked', () => {
    mockDevice(960, 4);
    expect(applyStoredTvLayoutWidth()).toBeNull();
    expect(content()).toContain('width=device-width');
  });

  it('ignores a stored choice carried onto a device with no headroom', () => {
    // Same browser profile, different screen — a laptop must not inherit the
    // TV's width just because localStorage travelled with the account.
    mockDevice(1920, 1);
    writeTvLayoutWidth(1280);
    expect(applyStoredTvLayoutWidth()).toBeNull();
    expect(content()).toContain('width=device-width');
  });
});

describe('the offered options', () => {
  it('leads with the largest text, so a viewer who cannot read small samples sees theirs first', () => {
    expect(TV_SCALE_OPTIONS[0].layoutWidth).toBe(TV_SCALE_NATIVE);
  });

  it('gets progressively wider (and so progressively smaller on screen)', () => {
    const widths = TV_SCALE_OPTIONS.slice(1).map(o => o.layoutWidth);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });

  it('never offers true 4K, which measures 0.13 degrees and is unreadable at 10ft', () => {
    expect(TV_SCALE_OPTIONS.every(o => o.layoutWidth < 1920)).toBe(true);
  });
});
