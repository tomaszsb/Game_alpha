// src/components/setup/ModeToggle.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { IconDesktop, IconTV, IconGlobe } from '../icons/SetupIcons';
import { setStoredPreferredMode, PlayMode } from '../../utils/modePreference';

interface ModeToggleProps {
  selectedMode: PlayMode;
  onSelectMode: (mode: PlayMode) => void;
}

/**
 * PC/TV mode toggle — always visible in v3.0.16+. The mode choice only forks
 * the in-game UI (TVDisplay vs GameLayout); the setup screen is identical
 * either way. The ?mode= URL param is written on Start Game or Join by Code.
 *
 * PC/TV toggle — enlarged in v3.0.25 (fb: setup-screen visibility). Big
 * segmented control with a heading so it can't be missed; the two options
 * carry a one-line description of what each means.
 *
 * TV mode: this box's own sizing was already fixed-rem (not vh-based, so it
 * wasn't part of the vh/zoom mismatch), but it's still a sizable chunk of a
 * screen that must fit 4 player tiles with zero scrolling — tightened for TV
 * specifically so the player list below gets the room. fb: TV real-hardware
 * feedback, 2026-07-15.
 */
export function ModeToggle({ selectedMode, onSelectMode }: ModeToggleProps): JSX.Element {
  // Remember an explicit tap so a reload (e.g. Fire TV Silk's "Request
  // Desktop Site" toggle) doesn't lose the player's mode choice — see
  // modePreference.ts. Only fires on an actual click here, never on the
  // ?mode= URL param or the isSmartTV() auto-detect fallback in PlayerSetup.
  const handleSelectMode = (mode: PlayMode): void => {
    setStoredPreferredMode(mode);
    onSelectMode(mode);
  };

  return (
    <div style={{
      marginBottom: selectedMode === 'tv' ? '0.3rem' : '1rem',
      padding: selectedMode === 'tv' ? '0.3rem 0.6rem' : '0.75rem 0.85rem',
      background: '#f8f9fa',
      borderRadius: 10,
      border: `2px solid ${colors.secondary.border}`,
    }}>
      <div style={{
        fontSize: '0.85rem',
        fontWeight: 700,
        color: colors.text.primary,
        marginBottom: selectedMode === 'tv' ? '0.25rem' : '0.6rem',
      }}>
        How are you playing?
      </div>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button
          type="button"
          onClick={() => handleSelectMode('pc')}
          aria-pressed={selectedMode === 'pc'}
          style={{
            flex: 1,
            padding: selectedMode === 'tv' ? '0.3rem 0.6rem' : '0.7rem 0.9rem',
            borderRadius: 8,
            border: `2px solid ${selectedMode === 'pc' ? colors.primary.main : colors.secondary.border}`,
            background: selectedMode === 'pc' ? colors.primary.main : 'white',
            color: selectedMode === 'pc' ? 'white' : colors.text.secondary,
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
          title="All players share one screen, taking turns."
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
            <IconDesktop size="1em" /> PC
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            Shared screen
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleSelectMode('tv')}
          aria-pressed={selectedMode === 'tv'}
          style={{
            flex: 1,
            padding: selectedMode === 'tv' ? '0.3rem 0.6rem' : '0.7rem 0.9rem',
            borderRadius: 8,
            border: `2px solid ${selectedMode === 'tv' ? '#9c27b0' : colors.secondary.border}`,
            background: selectedMode === 'tv' ? '#9c27b0' : 'white',
            color: selectedMode === 'tv' ? 'white' : colors.text.secondary,
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
          title="Board on the TV; each player on their own phone or tablet."
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
            <IconTV size="1em" /> TV
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            Phones + TV
          </div>
        </button>
        {/* Remote (maintainer request 2026-07-14, built 2026-09-25): a third
            option for players in genuinely separate locations — no shared
            screen at all. Every player, including whoever starts the game,
            ends up on their own device with their own board + panel. */}
        <button
          type="button"
          onClick={() => handleSelectMode('remote')}
          aria-pressed={selectedMode === 'remote'}
          style={{
            flex: 1,
            padding: selectedMode === 'tv' ? '0.3rem 0.6rem' : '0.7rem 0.9rem',
            borderRadius: 8,
            border: `2px solid ${selectedMode === 'remote' ? colors.success.main : colors.secondary.border}`,
            background: selectedMode === 'remote' ? colors.success.main : 'white',
            color: selectedMode === 'remote' ? 'white' : colors.text.secondary,
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
          title="Play with everyone in a different location — no shared screen needed."
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
            <IconGlobe size="1em" /> Remote
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            Different places
          </div>
        </button>
      </div>
      {/* The general "every player joins from their phone" instruction
          was dropped from TV mode — vertical room is scarce on TV, and
          each tile's own "⚠ Required: scan to join" label already says
          the same thing per-player. Removed 2026-07-15 to help fit 4
          tiles on lower-resolution TV browsers without scrolling. */}
    </div>
  );
}
