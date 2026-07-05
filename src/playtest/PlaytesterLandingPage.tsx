// src/playtest/PlaytesterLandingPage.tsx
//
// Landing page for the "playtester acquisition" funnel: QR code -> here ->
// reminder -> return later on PC/TV/tablet -> play. Rendered as its own
// React root from main.tsx when the pathname is /challenge — this never
// touches App.tsx or any game code (see the approved plan).
//
// "Preview" and "Play Now" are a deliberate placebo test: both navigate to
// the exact same game ("/"), tracked under different event names, to see
// whether visitors prefer the "quick preview" framing or "play now" outright
// — no separate mini-game to build for it.

import React, { useEffect, useState } from 'react';
import { ReminderHub } from './ReminderHub';
import { trackPlaytestEvent } from './playtestAnalytics';
import { hasVisitedPlaytest, markPlaytestVisited } from './playtestStorage';

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

export function PlaytesterLandingPage(): JSX.Element {
  const [returning, setReturning] = useState(false);

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

      {returning ? (
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Welcome back!</h1>
      ) : (
        <>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>You found Unravel Codes</h1>
          <p style={{ maxWidth: 420, lineHeight: 1.5 }}>
            It's a board game about getting a building built in New York City — permits, contractors,
            money, all of it. It plays best on a bigger screen, so grab a PC, TV, or tablet later
            tonight or this weekend.
          </p>
        </>
      )}

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
          ▶ Quick preview
        </button>
        <ComingSoonButton label="🎬 Watch the demo" />
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
