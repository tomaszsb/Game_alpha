import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelMode, setPanelMode, getStoredPanelMode } from '../../../src/components/player/panelTheme';

// fb:b6963218 — each caller used to hold its own copy of the mode, so flipping
// it in one place did not reach the board, the tracker or a second panel.
describe('usePanelMode — one shared light/dark setting', () => {
  afterEach(() => act(() => setPanelMode('light')));

  it('a toggle from one caller reaches every other caller', () => {
    act(() => setPanelMode('light'));
    const a = renderHook(() => usePanelMode());
    const b = renderHook(() => usePanelMode());
    expect(a.result.current[0]).toBe('light');

    act(() => a.result.current[1]());

    expect(a.result.current[0]).toBe('dark');
    expect(b.result.current[0]).toBe('dark');
    expect(getStoredPanelMode()).toBe('dark');
  });
});
