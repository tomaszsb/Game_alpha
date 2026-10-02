// src/components/setup/DeviceSettingsPanel.tsx
//
// "This device" section of the settings drawer (Tom, 2026-10-02). Unlike Game Settings
// these belong to the screen you are holding, not to the game: today just whether it
// remembers how you play (PC / TV / Remote) between games.

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { styles } from './PlayerSetup.styles';
import { getRememberMode, setRememberMode } from '../../utils/modePreference';

export function DeviceSettingsPanel(): JSX.Element {
  const [remember, setRemember] = useState<boolean>(() => getRememberMode());

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
          }}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        <span style={{ fontWeight: 'bold', color: colors.secondary.dark }}>
          Remember how I play
        </span>
      </label>
      <p style={{ margin: '0.25rem 0 0 1.6rem', color: colors.text.secondary, fontSize: '0.8rem', lineHeight: 1.4 }}>
        Keeps your PC / TV / Remote choice for next time on this device. Turn it off if the
        setup screen keeps opening in the wrong mode — you can still pick a mode each game.
      </p>
    </div>
  );
}
