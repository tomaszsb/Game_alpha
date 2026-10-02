import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DeviceSettingsPanel } from '../../../src/components/setup/DeviceSettingsPanel';
import { getRememberMode, getStoredPreferredMode, setStoredPreferredMode } from '../../../src/utils/modePreference';

describe('DeviceSettingsPanel', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('shows "Remember how I play" ON by default', () => {
    render(<DeviceSettingsPanel />);
    expect(screen.getByRole('checkbox', { name: /Remember how I play/i })).toBeChecked();
  });

  it('unticking it turns remembering off and forgets the old choice', () => {
    setStoredPreferredMode('remote');
    render(<DeviceSettingsPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Remember how I play/i }));
    expect(getRememberMode()).toBe(false);
    expect(getStoredPreferredMode()).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Remember how I play/i })).not.toBeChecked();
  });

  it('starts unticked on a device that already turned it off', () => {
    localStorage.setItem('unravelcodes:remember-mode', 'off');
    render(<DeviceSettingsPanel />);
    expect(screen.getByRole('checkbox', { name: /Remember how I play/i })).not.toBeChecked();
  });
});
