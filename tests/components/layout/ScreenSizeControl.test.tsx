// tests/components/layout/ScreenSizeControl.test.tsx
//
// Three TV reports from Tom's real-TV test (2026-09-27):
//  - fb:54b1056b  the Bigger/Smaller panel opened at the BOTTOM of the screen, not where
//                 he pressed the button that opened it
//  - fb:ceb1e67c / fb:780c1c73  no way to resize before the game starts
// The control is one component now, used by the TV header and the setup screen, and the
// panel opens under its own button.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenSizeControl } from '../../../src/components/layout/ScreenSizeControl';
import { placePanelUnderAnchor } from '../../../src/components/layout/TvScaleCalibration';

function mockDevice(screenWidth: number, dpr: number) {
  vi.stubGlobal('screen', { width: screenWidth, height: 540 });
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';
});
afterEach(() => vi.unstubAllGlobals());

describe('ScreenSizeControl', () => {
  it('offers the button on a TV (960px layout on a 4x panel) and opens the Bigger/Smaller panel', () => {
    mockDevice(960, 4);
    render(<ScreenSizeControl />);
    fireEvent.click(screen.getByText('🔍 Adjust screen size'));
    expect(screen.getByRole('dialog', { name: 'Adjust screen size' })).toBeTruthy();
    expect(screen.getByText('+ Smaller')).toBeTruthy();
  });

  it('renders nothing on a laptop or a phone — no headroom to gain, setup screen unchanged', () => {
    mockDevice(1920, 1);
    const laptop = render(<ScreenSizeControl />);
    expect(laptop.container.innerHTML).toBe('');
    laptop.unmount();
    mockDevice(390, 3);
    const phone = render(<ScreenSizeControl />);
    expect(phone.container.innerHTML).toBe('');
  });

  it('tells the host screen when it is opened (the TV lobby stops its first-use pulse on this)', () => {
    mockDevice(960, 4);
    const onOpen = vi.fn();
    render(<ScreenSizeControl onOpen={onOpen} />);
    fireEvent.click(screen.getByText('🔍 Adjust screen size'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('placePanelUnderAnchor', () => {
  const panel = { width: 400, height: 150 };
  const viewport = { width: 1600, height: 900 };

  it('opens just under the button, left edges lined up', () => {
    expect(placePanelUnderAnchor({ left: 760, top: 20, bottom: 52 }, panel, viewport)).toEqual({ top: 60, left: 760 });
  });

  it('is pulled back inside the screen when the button is near the right edge', () => {
    const p = placePanelUnderAnchor({ left: 1500, top: 20, bottom: 52 }, panel, viewport);
    expect(p.left + panel.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it('never goes off the left edge', () => {
    expect(placePanelUnderAnchor({ left: -30, top: 20, bottom: 52 }, panel, viewport).left).toBeGreaterThanOrEqual(8);
  });

  it('goes ABOVE a button that is low on the page when there is no room below (setup screen)', () => {
    const p = placePanelUnderAnchor({ left: 100, top: 800, bottom: 832 }, panel, viewport);
    expect(p.top + panel.height).toBeLessThanOrEqual(800);
  });
});
