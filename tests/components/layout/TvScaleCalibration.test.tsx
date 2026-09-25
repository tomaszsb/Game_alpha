// tests/components/layout/TvScaleCalibration.test.tsx
//
// Job 3A (Tom, 2026-09-25, after testing the real 4K TV: "yes to live
// buttons"). Bigger/Smaller apply to the REAL screen at once, Keep this size
// is the only thing that writes the choice, and an ~10s snap-back returns to
// whatever was showing before if Keep is never pressed. Replaces the earlier
// four-sample picker (fb:93449bf2) this same file used to cover.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TvScaleCalibration', () => {
  it('starts at Biggest text when this TV was never asked before', () => {
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.getByText('Biggest text')).toBeTruthy();
  });

  it('starts at the stored size when this TV has one', () => {
    localStorage.setItem(TV_SCALE_STORAGE_KEY, '1280');
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.getByText('Medium text')).toBeTruthy();
  });

  it('tags Medium — and only Medium — as Recommended', () => {
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.queryByText('Recommended')).toBeNull();
    fireEvent.click(screen.getByText('+ Smaller')); // -> Big text
    expect(screen.queryByText('Recommended')).toBeNull();
    fireEvent.click(screen.getByText('+ Smaller')); // -> Medium text
    expect(screen.getByText('Medium text')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('disables Bigger at the biggest step and Smaller at the smallest step', () => {
    render(<TvScaleCalibration onClose={() => {}} />);
    expect(screen.getByText('− Bigger').closest('button')).toBeDisabled();

    fireEvent.click(screen.getByText('+ Smaller'));
    fireEvent.click(screen.getByText('+ Smaller'));
    fireEvent.click(screen.getByText('+ Smaller')); // now at Small text, the last step
    expect(screen.getByText('+ Smaller').closest('button')).toBeDisabled();
  });

  it('Smaller applies the REAL screen live, without writing anything yet', () => {
    render(<TvScaleCalibration onClose={() => {}} />);
    fireEvent.click(screen.getByText('+ Smaller'));
    expect(viewportContent()).toContain('width=1152');
    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBeNull();
  });

  it('Bigger applies the REAL screen live, back toward native', () => {
    localStorage.setItem(TV_SCALE_STORAGE_KEY, '1280'); // starts at Medium text
    render(<TvScaleCalibration onClose={() => {}} />);
    fireEvent.click(screen.getByText('− Bigger')); // one step back toward native
    expect(viewportContent()).toContain('width=1152');
  });

  it('"Keep this size" writes the CURRENT step only, not whatever was previewed earlier', () => {
    const onClose = vi.fn();
    const onApplied = vi.fn();
    render(<TvScaleCalibration onClose={onClose} onApplied={onApplied} />);

    fireEvent.click(screen.getByText('+ Smaller')); // Big text, 1152
    fireEvent.click(screen.getByText('+ Smaller')); // Medium text, 1280
    fireEvent.click(screen.getByText('Keep this size'));

    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBe('1280');
    expect(viewportContent()).toContain('width=1280');
    expect(onApplied).toHaveBeenCalledWith(1280);
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel reverts the real screen to what it was before opening, writes nothing', () => {
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);
    fireEvent.click(screen.getByText('+ Smaller'));
    fireEvent.click(screen.getByText('+ Smaller'));
    expect(viewportContent()).toContain('width=1280');

    fireEvent.click(screen.getByText('Cancel'));

    expect(viewportContent()).toContain('width=device-width');
    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel reverts to a previously-KEPT size, not to native, when reopened on top of one', () => {
    localStorage.setItem(TV_SCALE_STORAGE_KEY, '1280');
    document.querySelector('meta[name="viewport"]')!.setAttribute('content', 'width=1280, viewport-fit=cover');
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);

    fireEvent.click(screen.getByText('− Bigger')); // preview Big text, 1152
    expect(viewportContent()).toContain('width=1152');

    fireEvent.click(screen.getByText('Cancel'));
    expect(viewportContent()).toContain('width=1280'); // back to the kept size, not native
  });

  it('snaps back to the previous size ~10s after the last press if Keep is never pressed', () => {
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);
    fireEvent.click(screen.getByText('+ Smaller'));
    expect(viewportContent()).toContain('width=1152');

    act(() => { vi.advanceTimersByTime(10_000); });

    expect(viewportContent()).toContain('width=device-width');
    expect(localStorage.getItem(TV_SCALE_STORAGE_KEY)).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT snap back before ~10s have passed', () => {
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);
    fireEvent.click(screen.getByText('+ Smaller'));

    act(() => { vi.advanceTimersByTime(9_000); });

    expect(viewportContent()).toContain('width=1152');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restarts the countdown on every Bigger/Smaller press, so an active viewer is never rushed', () => {
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);
    fireEvent.click(screen.getByText('+ Smaller'));

    act(() => { vi.advanceTimersByTime(9_000); }); // 9s on the first press's clock
    fireEvent.click(screen.getByText('+ Smaller')); // a second press resets it
    act(() => { vi.advanceTimersByTime(9_000); }); // only 9s on the NEW clock

    expect(onClose).not.toHaveBeenCalled(); // would have fired at 9s+9s=18s on the old clock
    expect(viewportContent()).toContain('width=1280');
  });

  it('Keep before the countdown expires cancels the snap-back for good', () => {
    const onClose = vi.fn();
    render(<TvScaleCalibration onClose={onClose} />);
    fireEvent.click(screen.getByText('+ Smaller'));
    fireEvent.click(screen.getByText('Keep this size'));
    onClose.mockClear();

    act(() => { vi.advanceTimersByTime(20_000); });

    expect(onClose).not.toHaveBeenCalled();
    expect(viewportContent()).toContain('width=1152'); // the kept size, untouched
  });

  it('reverts on unmount if neither Keep nor Cancel nor the timer settled it first', () => {
    const { unmount } = render(<TvScaleCalibration onClose={() => {}} />);
    fireEvent.click(screen.getByText('+ Smaller'));
    expect(viewportContent()).toContain('width=1152');

    unmount();

    expect(viewportContent()).toContain('width=device-width');
  });
});
