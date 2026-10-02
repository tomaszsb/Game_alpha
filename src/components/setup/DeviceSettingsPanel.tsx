// src/components/setup/DeviceSettingsPanel.tsx
//
// "This device" section of the settings drawer (Tom, 2026-10-02). Unlike Game Settings
// these belong to the screen you are holding, not to the game: today just whether it
// remembers what this screen IS (PC / TV / phone) between visits - and, once remembered,
// which one, with a way to forget it if it was picked by accident.

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { styles } from './PlayerSetup.styles';
import { getRememberMode, setRememberMode } from '../../utils/modePreference';
import { clearStoredDeviceRole, getStoredDeviceRole } from '../../utils/deviceRole';
import { DEVICE_ROLE } from '../../constants/uiStrings';

export function DeviceSettingsPanel(): JSX.Element {
  const [remember, setRemember] = useState<boolean>(() => getRememberMode());
  const [role, setRole] = useState(() => getStoredDeviceRole());

  return (
    <div style={styles.settingsBlock} data-testid="device-settings">
      <h3 style={styles.sectionTitleSmall}>This device</h3>
      <label style={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
            setRememberMode(e.target.checked);
            if (!e.target.checked) {
              clearStoredDeviceRole();
              setRole(null);
            }
          }}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        <span style={{ fontWeight: 'bold', color: colors.secondary.dark }}>
          Remember what this screen is
        </span>
      </label>
      <p style={{ margin: '0.25rem 0 0 1.6rem', color: colors.text.secondary, fontSize: '0.8rem', lineHeight: 1.4 }}>
        Keeps your answer (PC, TV or phone) for next time on this device, so it doesn't ask
        again. Turn it off and it asks each time. Whether a game is played together or in
        different places is chosen for each game and is never remembered.
      </p>
      {role && (
        <p data-testid="device-role-current" style={{ margin: '0.4rem 0 0 1.6rem', fontSize: '0.85rem', color: colors.text.primary }}>
          Remembered for this screen: <strong>{DEVICE_ROLE.label(role)}</strong>{' '}
          <button
            type="button"
            onClick={() => { clearStoredDeviceRole(); setRole(null); }}
            style={{ marginLeft: 6, cursor: 'pointer', background: 'none', border: 'none', color: colors.primary.main, textDecoration: 'underline', font: 'inherit' }}
          >
            Forget it
          </button>
        </p>
      )}
    </div>
  );
}
