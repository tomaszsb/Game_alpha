// src/playtest/PlaytesterLandingPage.tsx
//
// Landing page for the "playtester acquisition" funnel: QR code -> here ->
// reminder -> return later on PC/TV/tablet -> play. Rendered as its own
// React root from main.tsx when the pathname is /challenge — this never
// touches App.tsx or any game code (see the approved plan).
//
// "Quick game" and "Play Now" are a deliberate placebo test: both navigate
// to the exact same game ("/"), tracked under different event names
// (preview_click / play_click), to see whether visitors prefer the "quick
// game" framing or "play now" outright — no separate mini-game to build for
// it.

import React, { useEffect, useState } from 'react';
import { ReminderHub } from './ReminderHub';
import { trackPlaytestEvent } from './playtestAnalytics';
import { hasVisitedPlaytest, markPlaytestVisited } from './playtestStorage';
import { detectDeviceType } from '../utils/deviceDetection';

// Most visitors here are on the phone that just scanned a car-window sticker
// — the copy has to say that outright, not just imply "bigger screen." The
// Jackbox Games comparison is doing real work: it's the one mental model a
// stranger already has for "phone is the controller, TV/PC is the screen."
function landingCopy(returning: boolean, isMobile: boolean): { heading: string; body: string } {
  if (returning) {
    return isMobile
      ? {
          heading: 'Welcome back!',
          body: "Still on your phone? Unravel Codes needs a bigger screen — a PC, TV, or tablet, with your phone as the controller, like Jackbox Games. Got one of those in front of you now? Hit Play Now. If not, grab another reminder below.",
        }
      : {
          heading: 'Welcome back!',
          body: "You're on a screen big enough to play — hit Play Now below whenever you're ready.",
        };
  }
  return isMobile
    ? {
        heading: 'You found Unravel Codes',
        body: "You're on your phone right now — and that's exactly the problem. Unravel Codes needs a bigger screen: a PC, TV, or tablet, with your phone as the controller, like Jackbox Games. That's exactly why we want to remind you — pick a time below and we'll bring you back once you're near one.",
      }
    : {
        heading: 'You found Unravel Codes',
        body: "It's a board game about getting a building built in New York City — permits, contractors, money, all of it. Looks like you're already on a screen big enough to play — hit Play Now below, or grab a reminder if you'd rather come back later.",
      };
}

function ComingSoonButton({ label }: { label: string }): JSX.Element {
  const [tapped, setTapped] = useState(false);
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setTapped(true)}
        style={{
          opacity: 0.5,
          border: '1px dashed #999',
          background: 'transparent',
          borderRadius: 8,
          padding: '0.7rem 1.2rem',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
      {tapped && (
        <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
          Coming soon — check back soon!
        </span>
      )}
    </div>
  );
}

// Sharing is its own referral channel — tag the shared link "friend"
// regardless of whatever campaign source brought *this* visitor here (the
// QR scan tags are vehicle/conference/businesscard/friend/reddit; a share
// is always a friend-to-friend pass-along). Web Share API opens the native
// share sheet (Messages, WhatsApp, email, social apps) on supported
// browsers; desktop/unsupported browsers fall back to copy-to-clipboard.
function ShareButton(): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleShare = async (): Promise<void> => {
    trackPlaytestEvent('share_click');
    const shareUrl = 'https://game.unravelcodes.com/challenge?src=friend';
    const shareData = {
      title: 'Unravel Codes',
      text: "Check out this NYC construction-permit board game — needs a PC, TV, or tablet to play.",
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable — nothing else we can do */
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => { void handleShare(); }}
        style={{
          border: '1px solid #333',
          background: 'transparent',
          borderRadius: 8,
          padding: '0.7rem 1.2rem',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        📤 Share
      </button>
      {copied && (
        <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
          Link copied!
        </span>
      )}
    </div>
  );
}

export function PlaytesterLandingPage(): JSX.Element {
  const [returning, setReturning] = useState(false);
  const isMobile = typeof navigator !== 'undefined' && detectDeviceType() === 'mobile';
  const { heading, body } = landingCopy(returning, isMobile);

  useEffect(() => {
    const seenBefore = hasVisitedPlaytest();
    setReturning(seenBefore);
    trackPlaytestEvent(seenBefore ? 'return_visit' : 'landing_view');
    markPlaytestVisited();
  }, []);

  const goToGame = (): void => {
    window.location.href = '/';
  };

  const handlePreview = (): void => {
    trackPlaytestEvent('preview_click');
    goToGame();
  };

  const handlePlayNow = (): void => {
    trackPlaytestEvent('play_click');
    goToGame();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 1.25rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#f5f5f5',
        color: '#222',
        textAlign: 'center',
      }}
    >
      <img
        src="/images/logo.png"
        alt="Unravel Codes"
        style={{ width: 96, height: 96, marginBottom: '1rem' }}
      />

      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>{heading}</h1>
      <p style={{ maxWidth: 420, lineHeight: 1.5 }}>{body}</p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          justifyContent: 'center',
          margin: '1.25rem 0',
        }}
      >
        <button
          type="button"
          onClick={handlePreview}
          style={{
            border: '1px solid #007bff',
            background: 'white',
            color: '#007bff',
            borderRadius: 8,
            padding: '0.7rem 1.2rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          ▶ Quick game
        </button>
        <ComingSoonButton label="🎬 Watch the demo" />
        <ShareButton />
      </div>

      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: '1.25rem',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          marginBottom: '1.5rem',
        }}
      >
        <ReminderHub />
      </div>

      <button
        type="button"
        onClick={handlePlayNow}
        style={{
          border: 'none',
          background: '#28a745',
          color: 'white',
          borderRadius: 10,
          padding: '0.9rem 2rem',
          fontSize: '1.1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Play Now
      </button>

      <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666', maxWidth: 420 }}>
        Once you're playing, look for the bug icon in the corner of the screen — that's how you tell
        us if something's wrong or confusing.
      </p>
    </div>
  );
}
