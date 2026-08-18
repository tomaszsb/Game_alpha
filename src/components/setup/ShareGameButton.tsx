// src/components/setup/ShareGameButton.tsx
//
// "Share" button for the game-setup screen header, next to the Game Code
// badge. Filed as fb:feedback-1783230681607-5e05dc1f ("looking to get more
// players" / "add share button to pages where it makes sense") from a
// screenshot of exactly this screen.
//
// Reuses the navigator.share -> clipboard-fallback pattern already proven
// in the /challenge playtester funnel (src/playtest/PlaytesterLandingPage.tsx
// ShareButton), but shares the real join link for THIS game instead of the
// generic marketing URL. The join link is built with the same getServerURL()
// helper PlayerList.tsx uses for per-player QR codes — same format
// (<origin>?g=<gameId>&token=<token>) — just without a player param, so
// anyone who opens it lands on this setup screen and can add themselves.
//
// The share mechanism (useShareGameLink) and glyph (ShareIcon) are exported
// so other screens can offer the same "invite someone" action with their own
// styling instead of forking the navigator.share/clipboard logic. See
// PlayerMobileView.tsx, which reuses both for its own per-player invite
// button — fb:2c848b47 ("Share icon" / "Not seen on phone").

import React, { useState } from 'react';
import { getServerURL } from '../../utils/networkDetection';

export function ShareIcon(): JSX.Element {
  // The universally recognized "share" glyph (three linked nodes) — matches
  // ShareIcon in PlaytesterLandingPage.tsx.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

interface UseShareGameLinkResult {
  /** Join link for this game, built the same way as PlayerList.tsx's QR codes. */
  joinUrl: string;
  /** True once getServerURL() has resolved a real game (has a ?g= param). */
  hasGame: boolean;
  /** True for ~2s after a clipboard-fallback copy, to show "Copied!" feedback. */
  copied: boolean;
  /** Opens the native share sheet, falling back to clipboard-copy. */
  handleShare: () => void;
}

/**
 * Shared navigator.share -> clipboard-fallback logic for inviting someone to
 * the current game. Both ShareGameButton (PC/TV setup header) and
 * PlayerMobileView (per-player phone screen) use this so the actual share
 * mechanism only lives in one place; each renders its own styled trigger.
 */
export function useShareGameLink(): UseShareGameLinkResult {
  const [copied, setCopied] = useState(false);
  const joinUrl = getServerURL();
  // getServerURL() falls back to just the origin when there's no game in
  // the URL yet. Both callers only mount once a game has been auto-created
  // (see App.tsx), so this is just a defensive guard, not the normal path.
  const hasGame = joinUrl.includes('?g=');

  const handleShare = (): void => {
    void (async () => {
      const shareData = {
        title: 'Unravel Codes',
        text: 'Join my Unravel Codes game:',
        url: joinUrl,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          /* user cancelled the share sheet */
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(joinUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard unavailable */
      }
    })();
  };

  return { joinUrl, hasGame, copied, handleShare };
}

export function ShareGameButton(): JSX.Element | null {
  const { hasGame, copied, handleShare } = useShareGameLink();

  if (!hasGame) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share game link"
        title="Share a link so others can join this game"
        style={{
          // Matches the version/Game Code header chips (PlayerSetup.styles.ts)
          // — a frosted pill on the dark header, not the light form-control
          // look this button used to have on its own. Explicit height +
          // border-box (not padding-derived sizing) so it's pixel-identical
          // to the other three header chips regardless of font/line-height
          // quirks — see the comment above versionInfo in PlayerSetup.styles.ts.
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          height: 36,
          boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: 8,
          padding: '0 0.75rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <ShareIcon /> Share
      </button>
      {copied && (
        <span style={{ fontSize: '0.7rem', color: 'white', marginTop: '0.2rem' }}>
          Copied!
        </span>
      )}
    </div>
  );
}
