/**
 * ModePhoneHint.test.tsx
 *
 * Farmingdale class, 2026-10-20: students on a phone kept picking the middle "TV" button,
 * thinking a phone alone can play, and then could not start (TV mode waits for every player
 * to scan in). On a phone-sized screen the mode picker now says to pick PC, and says why
 * TV will not work. On a bigger screen the hint does not appear.
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { ModeToggle } from '../../../src/components/setup/ModeToggle';

function setScreenSize(width: number, height: number): void {
  Object.defineProperty(window, 'screen', { configurable: true, value: { ...window.screen, width, height } });
}

describe('ModeToggle phone hint', () => {
  const originalScreen = window.screen;
  afterEach(() => { cleanup(); Object.defineProperty(window, 'screen', { configurable: true, value: originalScreen }); });

  it('on a phone with PC picked: says to pick PC to play right here', () => {
    setScreenSize(390, 844);
    render(<ModeToggle selectedMode="pc" onSelectMode={() => {}} />);
    expect(screen.getByTestId('mode-phone-hint')).toHaveTextContent(/On a phone\? Pick PC/);
  });

  it('on a phone with TV picked: says a TV AND phones are needed and this phone cannot be the TV', () => {
    setScreenSize(390, 844);
    render(<ModeToggle selectedMode="tv" onSelectMode={() => {}} />);
    const hint = screen.getByTestId('mode-phone-hint');
    expect(hint).toHaveAttribute('role', 'alert');
    expect(hint).toHaveTextContent(/TV showing the board and a phone for every player/);
    expect(hint).toHaveTextContent(/pick PC/);
  });

  it('on a big screen: no hint', () => {
    setScreenSize(1920, 1080);
    render(<ModeToggle selectedMode="tv" onSelectMode={() => {}} />);
    expect(screen.queryByTestId('mode-phone-hint')).toBeNull();
  });

  it('the TV button says plainly that both a TV and phones are needed', () => {
    setScreenSize(1920, 1080);
    render(<ModeToggle selectedMode="pc" onSelectMode={() => {}} />);
    expect(screen.getByRole('button', { name: /TV/ })).toHaveTextContent(/You need a TV and phones/);
  });
});
