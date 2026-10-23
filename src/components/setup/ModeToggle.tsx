// src/components/setup/ModeToggle.tsx

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { IconDesktop, IconTV, IconGlobe } from '../icons/SetupIcons';
import { setStoredPreferredMode, PlayMode } from '../../utils/modePreference';
import { isPhoneScreen } from '../../utils/deviceDetection';
import { BigScreenGuide } from './BigScreenGuide';

interface ModeToggleProps {
  selectedMode: PlayMode;
  onSelectMode: (mode: PlayMode) => void;
  /** Phone only: the TV button opens the picture guide; its "Play alone" and "I see the code" links call these. */
  onPlayAlone?: () => void;
  onReady?: () => void;
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
export function ModeToggle({ selectedMode, onSelectMode, onPlayAlone, onReady }: ModeToggleProps): JSX.Element {
  // v3.8.49 (Tom, 10-23): on a phone the middle button IS "Step 1: put the game on a big screen" - tapping it
  // opens the picture guide right under the buttons instead of picking TV mode (a phone is never the TV).
  const [guideOpen, setGuideOpen] = useState(false);
  // Remember an explicit tap so a reload (e.g. Fire TV Silk's "Request
  // Desktop Site" toggle) doesn't lose the player's mode choice — see
  // modePreference.ts. Only fires on an actual click here, never on the
  // ?mode= URL param or the isSmartTV() auto-detect fallback in PlayerSetup.
  const handleSelectMode = (mode: PlayMode): void => {
    if (mode === 'tv' && isPhoneScreen()) { setGuideOpen((v) => !v); return; }
    setGuideOpen(false);
    // Not on a phone-sized screen: a phone is never the shared TV, so a 'tv'
    // tapped there must not be remembered for later visits.
    if (!(mode === 'tv' && isPhoneScreen())) setStoredPreferredMode(mode);
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
          title="Play on this one screen. One player alone, or everyone taking turns."
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
            <IconDesktop size="1em" /> PC
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            Play on this screen
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
          title="You need BOTH: the board on a TV, and each player on their own phone or tablet."
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
            <IconTV size="1em" /> TV
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            You need a TV and phones
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
          title="Everyone plays on their own device, in different places. Each player opens an invite link."
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
            <IconGlobe size="1em" /> Remote
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            Each on their own device
          </div>
        </button>
      </div>
      {/* Added 2026-10-21 (Farmingdale class): students on a phone kept picking the middle
          button, thinking a phone alone can play it. TV mode needs a TV (the board) AND each
          player's phone, and the game will not start until the others scan in. A phone screen
          is never the TV, so on a phone the way to play alone is PC. */}
      {isPhoneScreen() && guideOpen && (
        <div style={{ marginTop: '0.6rem' }}>
          <BigScreenGuide onClose={() => setGuideOpen(false)} onPlayAlone={() => { setGuideOpen(false); (onPlayAlone ?? (() => onSelectMode('pc')))(); }} onReady={onReady} />
        </div>
      )}
      {isPhoneScreen() && !guideOpen && (
        <div role={selectedMode === 'tv' ? 'alert' : undefined} data-testid="mode-phone-hint" style={{
          marginTop: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: 8, fontSize: '0.8rem', lineHeight: 1.35,
          background: selectedMode === 'tv' ? '#fdecea' : '#eef5ff',
          border: `1px solid ${selectedMode === 'tv' ? '#f5a6a0' : '#bcd4f6'}`, color: colors.text.primary,
        }}>
          {selectedMode === 'tv'
            ? <>TV needs a TV showing the board <b>and</b> a phone for every player. This phone can&apos;t be the TV, so the game would never start. <b>To play on this phone, pick PC.</b></>
            : <>On a phone? Pick <b>PC</b> to play right here. TV and Remote need other screens or phones to join too.</>}
        </div>
      )}
      {/* The general "every player joins from their phone" instruction
          was dropped from TV mode — vertical room is scarce on TV, and
          each tile's own "⚠ Required: scan to join" label already says
          the same thing per-player. Removed 2026-07-15 to help fit 4
          tiles on lower-resolution TV browsers without scrolling. */}
    </div>
  );
}
