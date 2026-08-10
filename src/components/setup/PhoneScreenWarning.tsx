// src/components/setup/PhoneScreenWarning.tsx
//
// Non-blocking "this screen is small" banner for the game-setup screen.
// Filed as part of fb:feedback-1782833653490-5470235b: "if someone opens
// this up on a phone there should be a warning message that this game is
// designed to play on a large screen such as at minimum a tablet and best
// on a TV."
//
// Reuses the isPhoneScreen() device check and informational (not blocking)
// tone already proven on the /challenge playtester funnel
// (src/playtest/PlaytesterLandingPage.tsx) rather than inventing a new
// screen-size check. isPhoneScreen() measures the physical screen's SHORT
// side (window.screen), not the browser viewport, so it isn't fooled by a
// narrowed desktop window and correctly treats tablets as "big enough."

import React from 'react';
import { colors } from '../../styles/theme';
import { isPhoneScreen } from '../../utils/deviceDetection';
import { IconPhone } from '../icons/SetupIcons';

export function PhoneScreenWarning(): JSX.Element | null {
  if (typeof window === 'undefined' || !isPhoneScreen()) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: colors.warning.bg,
        border: `1px solid ${colors.warning.border}`,
        color: colors.warning.text,
        borderRadius: 10,
        padding: '0.6rem 0.85rem',
        marginBottom: '0.85rem',
        fontSize: '0.82rem',
        lineHeight: 1.4,
        textAlign: 'left',
      }}
    >
      <span style={{ flexShrink: 0, display: 'inline-flex' }} aria-hidden="true"><IconPhone size="1.1rem" /></span>
      <span>
        <span>
          This game works best on a bigger screen — a tablet at minimum, ideally a TV.
          You can keep going, but things may feel cramped on a phone this small.
        </span>
        <span style={{ display: 'block', marginTop: '0.35rem', opacity: 0.85 }}>
          On a TV but seeing this? Check your browser's menu for "Request desktop site" and turn it off, or just tap TV above.
        </span>
      </span>
    </div>
  );
}
