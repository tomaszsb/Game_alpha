// VersionBadge — a tiny, always-on build chip pinned to a corner.
//
// It stays visible even when a modal is open, so feedback screenshots always
// capture which build the player is on (requested 2026-06-25). Before this, the
// version showed only on the setup screen and in hidden report metadata, so a
// screenshot taken mid-modal carried no visible version — this session we had to
// pull the report's metadata just to learn it was v3.0.84.
//
// Placement: fixed bottom-LEFT (the feedback button owns bottom-right), z-index
// above the modal overlay (1000) but below the feedback button (2500), and
// pointer-events:none so it can never intercept a click. The dark chip keeps the
// text legible over any background (light modal or dark board alike).
//
// Carries the play mode too (2026-09-28, Tom — investigating fb:4c7a3628 hit a
// dead end because the report didn't say which of PC/TV/Remote it happened on,
// and there was no way to tell from the screenshot alone): "we can add visual
// indicators on bottom of page to show game type so you can always get that
// information from screenshot right next to the game version." Read directly
// from `?mode=` — the same URL contract GameLayout's isRemoteMode and App.tsx's
// isTVMode already key off — not from the pre-game modePreference.ts localStorage
// pick, which reflects a past SETUP-screen choice, not what this specific device
// is rendering right now (a TV-mode controller phone never itself becomes "TV").

import React from 'react';
import { getURLParams } from '../../utils/getAppScreen';
import { ConnectionStatus } from './ConnectionStatus';
import { getBackendURL } from '../../utils/networkDetection';

function currentModeLabel(): 'PC' | 'TV' | 'Remote' | 'Phone' {
  const params = getURLParams();
  const mode = params.get('mode');
  if (mode === 'tv') return 'TV';
  if (mode === 'remote') return 'Remote';
  // A player's own link (?p= / ?playerId=) is a phone controller (2026-10-12: a phone read
  // "v3.7.8 · PC"); `role=phone` is the "What is this screen?" pick saying the same.
  if (params.get('role') === 'phone' || params.get('p') || params.get('playerId')) return 'Phone';
  return 'PC';
}

export const VersionBadge: React.FC = () => {
  const semver = typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : '';
  const commit = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  if (!semver && !commit) return null;

  const modeLabel = currentModeLabel();

  return (
    <div
      data-testid="version-badge"
      // Commit hash on hover for precise debugging; the visible semver is enough
      // to identify the build in a screenshot.
      title={commit ? `build ${commit}` : undefined}
      style={{
        position: 'fixed',
        bottom: 4,
        left: 6,
        zIndex: 2000,
        fontSize: 10,
        lineHeight: 1.2,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: 'rgba(255, 255, 255, 0.85)',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: '2px 6px',
        borderRadius: 6,
        letterSpacing: '0.02em',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Whether this screen can reach the server: a dot, moved down here from the top bar (Tom,
          2026-10-12: "most players will never need to know this information"). */}
      <ConnectionStatus serverUrl={getBackendURL()} compact />{' '}
      {semver ? `v${semver}` : commit}
      {' · '}
      <span data-testid="version-badge-mode">{modeLabel}</span>
    </div>
  );
};
