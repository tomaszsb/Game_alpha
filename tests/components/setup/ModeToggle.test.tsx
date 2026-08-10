/**
 * ModeToggle.test.tsx
 *
 * Confirms an explicit PC/TV tap writes the choice to localStorage
 * (modePreference.ts) so a Fire TV reload doesn't lose it — see
 * PlayerSetup.tsx's resolveInitialMode() precedence.
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ModeToggle } from '../../../src/components/setup/ModeToggle';

const PREFERRED_MODE_KEY = 'unravelcodes:preferred-mode';

describe('ModeToggle', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('writes "tv" to localStorage and notifies the parent when the TV button is tapped', () => {
    const onSelectMode = vi.fn();
    render(<ModeToggle selectedMode="pc" onSelectMode={onSelectMode} />);

    screen.getByRole('button', { name: /TV/ }).click();

    expect(onSelectMode).toHaveBeenCalledWith('tv');
    expect(localStorage.getItem(PREFERRED_MODE_KEY)).toBe('tv');
  });

  it('writes "pc" to localStorage and notifies the parent when the PC button is tapped', () => {
    const onSelectMode = vi.fn();
    render(<ModeToggle selectedMode="tv" onSelectMode={onSelectMode} />);

    screen.getByRole('button', { name: /PC/ }).click();

    expect(onSelectMode).toHaveBeenCalledWith('pc');
    expect(localStorage.getItem(PREFERRED_MODE_KEY)).toBe('pc');
  });

  it('does not throw and still notifies the parent when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const onSelectMode = vi.fn();
    render(<ModeToggle selectedMode="pc" onSelectMode={onSelectMode} />);

    expect(() => screen.getByRole('button', { name: /TV/ }).click()).not.toThrow();
    expect(onSelectMode).toHaveBeenCalledWith('tv');

    vi.restoreAllMocks();
  });
});
