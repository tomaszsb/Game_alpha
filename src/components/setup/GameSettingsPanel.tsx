// src/components/setup/GameSettingsPanel.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { GameSettings } from './usePlayerValidation';
import { styles } from './PlayerSetup.styles';

interface GameSettingsPanelProps {
  gameSettings: GameSettings;
  onChangeGameSettings: (settings: GameSettings) => void;
  /** Parent keeps owning showCardSelection + the EducationalCardSelectionModal itself. */
  onOpenCardSelection: () => void;
}

/**
 * "Game Settings" settings-drawer section: win condition, and the
 * Same-Starting-Point mode with its Quick-Start/Educational sub-options.
 */
export function GameSettingsPanel({
  gameSettings,
  onChangeGameSettings,
  onOpenCardSelection,
}: GameSettingsPanelProps): JSX.Element {
  return (
    <div style={styles.settingsBlock}>
      <h3 style={styles.sectionTitleSmall}>
        ⚙️ Game Settings
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem'
      }}>
        <div>
          <label style={styles.label}>Win Condition</label>
          <select
            value={gameSettings.winCondition}
            onChange={(e) => onChangeGameSettings({
              ...gameSettings,
              winCondition: e.target.value
            })}
            style={styles.select}
          >
            <option value="FIRST_TO_FINISH">First to Finish</option>
            <option value="HIGHEST_SCORE">Highest Score</option>
          </select>
        </div>
      </div>

      {/* Same Starting Point Mode */}
      <div style={{ marginTop: '1rem' }}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={gameSettings.sameStartingPoint}
            onChange={(e) => onChangeGameSettings({
              ...gameSettings,
              sameStartingPoint: e.target.checked
            })}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 'bold', color: colors.secondary.dark }}>
            Same Starting Point
          </span>
          <span style={{ color: colors.text.secondary, fontSize: 'clamp(0.75rem, 1.5vh, 0.9rem)' }}>
            All players start with identical cards
          </span>
        </label>

        {gameSettings.sameStartingPoint && (
          <div style={styles.subOptions}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="startingMode"
                  value="QUICK_START"
                  checked={gameSettings.startingMode === 'QUICK_START'}
                  onChange={() => onChangeGameSettings({
                    ...gameSettings,
                    startingMode: 'QUICK_START'
                  })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '500' }}>Quick Start</span>
                <span style={{ color: colors.text.secondary, fontSize: '0.8rem' }}>
                  - P1's natural draws become starting hand for all
                </span>
              </label>
            </div>
            <div>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="startingMode"
                  value="EDUCATIONAL"
                  checked={gameSettings.startingMode === 'EDUCATIONAL'}
                  onChange={() => onChangeGameSettings({
                    ...gameSettings,
                    startingMode: 'EDUCATIONAL'
                  })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '500' }}>Educational</span>
                <span style={{ color: colors.text.secondary, fontSize: '0.8rem' }}>
                  - Select specific starting cards
                </span>
              </label>

              {gameSettings.startingMode === 'EDUCATIONAL' && (
                <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={onOpenCardSelection}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: colors.primary.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Select Starting Cards...
                  </button>
                  {gameSettings.preSelectedHand && gameSettings.preSelectedHand.length > 0 && (
                    <div style={{
                      marginTop: '0.4rem',
                      fontSize: '0.8rem',
                      color: colors.success.text
                    }}>
                      {gameSettings.preSelectedHand.length} card{gameSettings.preSelectedHand.length !== 1 ? 's' : ''} selected:
                      {' '}
                      <span style={{ color: colors.text.secondary }}>
                        {gameSettings.preSelectedHand.filter(id => id.startsWith('W')).length} W,
                        {' '}
                        {gameSettings.preSelectedHand.filter(id => id.startsWith('E')).length} E
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
