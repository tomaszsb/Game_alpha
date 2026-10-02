import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DeviceSettingsPanel } from '../../../src/components/setup/DeviceSettingsPanel';
import { getRememberMode, getStoredPreferredMode, setStoredPreferredMode } from '../../../src/utils/modePreference';
import { getStoredDeviceRole, setStoredDeviceRole } from '../../../src/utils/deviceRole';

describe('DeviceSettingsPanel', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('shows "Remember what this screen is" ON by default', () => {
    render(<DeviceSettingsPanel />);
    expect(screen.getByRole('checkbox', { name: /Remember what this screen is/i })).toBeChecked();
  });

  it('unticking it turns remembering off and forgets both the remembered mode and the remembered role', () => {
    setStoredPreferredMode('tv');
    setStoredDeviceRole('phone');
    render(<DeviceSettingsPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Remember what this screen is/i }));
    expect(getRememberMode()).toBe(false);
    expect(getStoredPreferredMode()).toBeNull();
    expect(getStoredDeviceRole()).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Remember what this screen is/i })).not.toBeChecked();
  });

  it('starts unticked on a device that already turned it off', () => {
    localStorage.setItem('unravelcodes:remember-mode', 'off');
    render(<DeviceSettingsPanel />);
    expect(screen.getByRole('checkbox', { name: /Remember what this screen is/i })).not.toBeChecked();
  });

  it('shows what is remembered, with a way to forget it if it was picked by accident', () => {
    setStoredDeviceRole('tv');
    render(<DeviceSettingsPanel />);
    expect(screen.getByTestId('device-role-current').textContent).toContain('just the board');
    fireEvent.click(screen.getByRole('button', { name: /Forget it/i }));
    expect(getStoredDeviceRole()).toBeNull();
    expect(screen.queryByTestId('device-role-current')).toBeNull();
  });
});
