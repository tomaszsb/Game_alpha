// tests/components/layout/TvScaleCalibration.test.tsx
//
// The screen that asks the one question no browser API can answer: how big
// is this screen and how far away is the viewer sitting? (fb:93449bf2 — a 4K
// TV that lays out at 960x540, so the picture is sharp but there is only a
// phone's worth of room to arrange things in.)
//
// These exist because this screen cannot be checked by clicking it in the
// session's browser: it is deliberately hidden on any device without unspent
// pixels, and a desktop browser reports devicePixelRatio 1, so it never
// renders there at all. The property that matters most is the one that is
// easiest to get silently wrong — that the four samples are drawn at four
// DIFFERENT sizes, descending. If they all rendered the same, the screen
// would look fine and the question would be unanswerable.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TvScaleCalibration } from '../../../src/components/layout/TvScaleCalibration';
import { TV_SCALE_STORAGE_KEY, TV_SCALE_NATIVE } from '../../../src/utils/tvScale';

/** The reporter's television: a 4K panel behind a 960px layout. */
function mockTv() {
  vi.stubGlobal('screen', { width: 960, height: 540 });
  Object.defineProperty(window, 'devicePixelRatio', { value: 4, configurable: true });
}

const viewportContent = () =>
  document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML =
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';
  mockTv();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TvScaleCalibration', () => {
  it('offers every size choice', () => {
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.getByText('Biggest text')).toBeTruthy();
    expect(screen.getByText('Big text')).toBeTruthy();
    expect(screen.getByText('Medium text')).toBeTruthy();
    expect(screen.getByText('Small text')).toBeTruthy();
  });

  it('draws the four samples at four DIFFERENT, descending sizes', () => {
    // The whole screen is unanswerable if this fails, and it would still
    // look perfectly fine on screen.
    const { container } = render(<TvScaleCalibration onClose={() => {}} />);
    const samples = [...container.querySelectorAll('button')]
      .map(b => b.querySelector('div[style*="font-size"]'))
      .filter(Boolean) as HTMLElement[];

    const sizes = samples.map(s => parseFloat(s.style.fontSize));
    expect(sizes.length).toBe(4);
    expect(new Set(sizes).size).toBe(4);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('previews the recommended option at the size it actually promises', () => {
    // 16px body text at layout 1280, previewed on a 960 device, is 12px.
    const { container } = render(<TvScaleCalibration onClose={() => {}} />);
    const medium = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Medium text'));
    const sample = medium?.querySelector('div[style*="font-size"]') as HTMLElement;
    expect(parseFloat(sample.style.fontSize)).toBeCloseTo(12, 1);
  });

  it('stores the choice and widens the layout when one is picked', () => {
    const onClose = vi.fn();
    const { container } = render(<TvScaleCalibration onClose={onClose} />);
    const medium = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Medium text'))!;

    fireEvent.click(medium);

    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBe('1280');
    expect(viewportContent()).toContain('width=1280');
    expect(onClose).toHaveBeenCalled();
  });

  it('restores device-width when the viewer picks the biggest text', () => {
    const { container } = render(<TvScaleCalibration onClose={() => {}} />);
    const biggest = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('Biggest text'))!;

    fireEvent.click(biggest);

    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBe(String(TV_SCALE_NATIVE));
    expect(viewportContent()).toContain('width=device-width');
  });

  it('tells the viewer the panel is not the problem', () => {
    // The fact that makes the screen make sense: 960 layout px at ratio 4 is
    // a 3840px panel. Reading "low resolution" off this TV is the mistake
    // this line exists to prevent.
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.getByText(/3840px wide panel/)).toBeTruthy();
  });

  it('marks the current choice so a re-open is not a blind guess', () => {
    localStorage.setItem(TV_SCALE_STORAGE_KEY, '1280');
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.getByText('current')).toBeTruthy();
  });

  it('closes without changing anything when cancelled', () => {
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBeNull();
    expect(viewportContent()).toContain('width=device-width');
  });
});
