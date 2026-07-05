// src/playtest/PlaytesterLandingPage.tsx
//
// Landing page for the "playtester acquisition" funnel: QR code -> here ->
// (on a phone) set a reminder -> return later on a bigger screen -> play.
// Rendered as its own React root from main.tsx when the pathname is
// /challenge — this never touches App.tsx or any game code.
//
// Two views, chosen by physical screen size (isPhoneScreen), NOT device brand:
//   - Phone  -> too small to play well. The reminder is the hero; "Play
//              anyway" is a quiet fallback with a plain warning.
//   - Bigger -> tablet / laptop / desktop / TV. A real screen to play on, so
//              "Quick game" + "Play now" lead; a reminder is offered quietly.
// See src/utils/deviceDetection.ts for why size (not user-agent) is the line —
// iPads disguise as Macs and Android tablets look like Android phones.

import React, { useEffect, useState } from 'react';
import { ReminderHub } from './ReminderHub';
import { GameTour } from './GameTour';
import { trackPlaytestEvent } from './playtestAnalytics';
import { hasVisitedPlaytest, markPlaytestVisited } from './playtestStorage';
import { isPhoneScreen } from '../utils/deviceDetection';
import { isIOSSafari, isPwaInstallable, isPwaInstalled, promptPwaInstall } from './pwaInstall';

function landingCopy(returning: boolean, isPhone: boolean): { heading: string; body: string } {
  if (returning) {
    return isPhone
      ? {
          heading: 'Welcome back!',
          body: "Still on your phone? Unravel Codes needs a bigger screen — a PC, TV, or tablet, with your phone as the controller, like Jackbox Games. Near one now? Set another reminder below, or play anyway.",
        }
      : {
          heading: 'Welcome back!',
          body: "You're on a screen big enough to play — hit Play now below whenever you're ready.",
        };
  }
  return isPhone
    ? {
        heading: 'You found Unravel Codes',
        body: "You're on your phone — and that's the catch. Unravel Codes needs a bigger screen: a PC, TV, or tablet, with your phone as the controller, like Jackbox Games. Pick a time below and we'll bring you back once you're near one.",
      }
    : {
        heading: 'You found Unravel Codes',
        body: "It's a board game about getting a building built in New York City — permits, contractors, money, all of it. You're already on a screen big enough to play — hit Play now below, or grab a reminder if you'd rather come back later.",
      };
}

// One shared button size so the action row never looks ragged.
const actionBtn: React.CSSProperties = {
  height: 48,
  borderRadius: 8,
  fontSize: '0.9rem',
  cursor: 'pointer',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.15rem',
  width: '100%',
  boxSizing: 'border-box',
  padding: '0 0.5rem',
};

// The universally recognized "share" glyph (three linked nodes), not an
// outbox-tray emoji — matches what people expect on iOS/Android share.
function ShareIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ComingSoonButton({ label }: { label: string }): JSX.Element {
  const [tapped, setTapped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setTapped(true)}
      style={{ ...actionBtn, opacity: 0.55, border: '1px dashed #999', background: 'transparent', color: '#666' }}
    >
      <span>🎬 {label}</span>
      {tapped && <span style={{ fontSize: '0.7rem' }}>Coming soon!</span>}
    </button>
  );
}

// Sharing is its own referral channel — the shared link is always tagged
// "friend" (a friend-to-friend pass-along), regardless of the campaign source
// that brought THIS visitor here. Web Share API opens the native share sheet
// on phones; desktop/unsupported browsers fall back to copy-to-clipboard.
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
        /* user cancelled the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={() => { void handleShare(); }}
      style={{ ...actionBtn, border: '1px solid #333', background: '#fff', color: '#333' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><ShareIcon /> Share</span>
      {copied && <span style={{ fontSize: '0.7rem', color: '#1a7f37' }}>Link copied!</span>}
    </button>
  );
}

// Secondary "keep it handy" action, below the reminder card. Replaces the old
// standalone Bookmark button (browsers block a page from bookmarking itself,
// so on a phone it could only ever show text). Device-aware:
//   - Android / installable -> a real install prompt
//   - iOS Safari            -> Add-to-Home-Screen steps (no programmatic install)
//   - desktop               -> Ctrl/Cmd+D bookmark hint
function KeepHandy({ isPhone }: { isPhone: boolean }): JSX.Element | null {
  const [installable, setInstallable] = useState(isPwaInstallable());
  const [installed, setInstalled] = useState(isPwaInstalled());
  const [hint, setHint] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => {
      setInstallable(isPwaInstallable());
      setInstalled(isPwaInstalled());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const linkStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', color: '#007bff',
    cursor: 'pointer', fontSize: '0.85rem', padding: 0,
  };

  if (installed) {
    return <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>📲 Installed as an app ✓</p>;
  }
  if (installable) {
    return (
      <button type="button" onClick={() => { void promptPwaInstall(); }} style={linkStyle}>
        📲 Install as an app
      </button>
    );
  }

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
  const onClick = (): void => {
    setHint(
      isIOSSafari()
        ? 'Tap the Share button, then "Add to Home Screen."'
        : isPhone
          ? "Open your browser's menu (⋮ or •••) and choose \"Add to Home Screen\" or \"Add bookmark.\""
          : `Press ${isMac ? 'Cmd' : 'Ctrl'}+D to bookmark this page.`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <button type="button" onClick={onClick} style={linkStyle}>
        {isPhone ? '📲 Add to Home Screen' : `🔖 Bookmark (${isMac ? 'Cmd' : 'Ctrl'}+D)`}
      </button>
      {hint && <span style={{ fontSize: '0.78rem', color: '#666' }}>{hint}</span>}
    </div>
  );
}

export function PlaytesterLandingPage(): JSX.Element {
  const [returning, setReturning] = useState(false);
  const isPhone = typeof navigator !== 'undefined' && isPhoneScreen();
  const { heading, body } = landingCopy(returning, isPhone);

  useEffect(() => {
    const seenBefore = hasVisitedPlaytest();
    setReturning(seenBefore);
    trackPlaytestEvent(seenBefore ? 'return_visit' : 'landing_view');
    markPlaytestVisited();
  }, []);

  const goToGame = (): void => { window.location.href = '/'; };
  const handlePreview = (): void => { trackPlaytestEvent('preview_click'); goToGame(); };
  const handlePlayNow = (): void => { trackPlaytestEvent('play_click'); goToGame(); };

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
      <img src="/images/logo.png" alt="Unravel Codes" style={{ width: 88, height: 88, marginBottom: '0.75rem' }} />

      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>{heading}</h1>
      <p style={{ maxWidth: 420, lineHeight: 1.5, marginBottom: '1.25rem' }}>{body}</p>

      <GameTour />

      {/* Top action row — uniform buttons. "Quick game" only on a big screen. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isPhone ? '1fr 1fr' : '1fr 1fr 1fr',
          gap: '0.6rem',
          width: '100%',
          maxWidth: 460,
          marginBottom: '1.25rem',
        }}
      >
        {!isPhone && (
          <button
            type="button"
            onClick={handlePreview}
            style={{ ...actionBtn, border: '1px solid #007bff', background: '#fff', color: '#007bff' }}
          >
            ▶ Quick game
          </button>
        )}
        <ComingSoonButton label="Watch demo" />
        <ShareButton />
      </div>

      {/* Reminder card — the hero on a phone (blue outline), quiet elsewhere. */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '1.25rem',
          maxWidth: 460,
          width: '100%',
          border: isPhone ? '2px solid #007bff' : '1px solid #e3e3e3',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          marginBottom: '1rem',
          textAlign: 'left',
        }}
      >
        <ReminderHub isPhone={isPhone} />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <KeepHandy isPhone={isPhone} />
      </div>

      {/* Play call-to-action. Big and green on a real screen; a quiet fallback
          with a plain warning on a phone. */}
      {isPhone ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', maxWidth: 420 }}>
          <button
            type="button"
            onClick={handlePlayNow}
            style={{ border: '1px solid #bbb', background: 'transparent', color: '#777', borderRadius: 8, padding: '0.6rem 1.5rem', fontSize: '0.95rem', cursor: 'pointer' }}
          >
            Play anyway
          </button>
          <span style={{ fontSize: '0.8rem', color: '#b0432f', lineHeight: 1.4 }}>
            Not recommended on a screen this small — you'll have a hard time.
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePlayNow}
          style={{ border: 'none', background: '#28a745', color: 'white', borderRadius: 10, padding: '0.9rem 2rem', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Play now
        </button>
      )}

      <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666', maxWidth: 420 }}>
        Once you're playing, look for the bug icon in the corner of the screen — that's how you tell
        us if something's wrong or confusing.
      </p>
    </div>
  );
}
