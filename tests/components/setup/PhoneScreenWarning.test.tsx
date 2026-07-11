/**
 * PhoneScreenWarning.test.tsx
 *
 * Test suite for the game-setup screen's phone-size warning banner
 * (fb:feedback-1782833653490-5470235b). Confirms the banner only shows on a
 * phone-sized physical screen, per the same isPhoneScreen() short-side check
 * used on the /challenge playtester funnel.
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { PhoneScreenWarning } from '../../../src/components/setup/PhoneScreenWarning';

function setScreenSize(width: number, height: number): void {
  Object.defineProperty(window, 'screen', {
    configurable: true,
    value: { ...window.screen, width, height },
  });
}

describe('PhoneScreenWarning', () => {
  const originalScreen = window.screen;

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'screen', { configurable: true, value: originalScreen });
  });

  it('renders the warning when the physical screen is phone-sized', () => {
    setScreenSize(390, 844); // short side 390 < 600
    render(<PhoneScreenWarning />);
    expect(screen.getByRole('status')).toHaveTextContent(/bigger screen/i);
  });

  it('renders nothing on a tablet-sized screen', () => {
    setScreenSize(810, 1080); // short side 810 >= 600
    render(<PhoneScreenWarning />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders nothing on a desktop-sized screen', () => {
    setScreenSize(1920, 1080);
    render(<PhoneScreenWarning />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
