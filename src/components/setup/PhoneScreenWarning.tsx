// src/components/setup/PhoneScreenWarning.tsx
//
// Non-blocking "this screen is small" card for the game-setup screen.
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
//
// v3.8.47: the card became "Step 1: put the game on a big screen" (BigScreenGuide) - same
// slot, same phone-only trigger - so a phone-first student is told HOW to get the board onto
// a TV, not just that a bigger screen is better.

import React from 'react';
import { isPhoneScreen } from '../../utils/deviceDetection';
import { BigScreenGuide } from './BigScreenGuide';

export function PhoneScreenWarning({ onPlayAlone, onReady }: { onPlayAlone?: () => void; onReady?: () => void }): JSX.Element | null {
  if (typeof window === 'undefined' || !isPhoneScreen()) return null;
  return <BigScreenGuide onPlayAlone={onPlayAlone} onReady={onReady} />;
}
