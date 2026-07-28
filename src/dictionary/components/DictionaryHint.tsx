// src/dictionary/components/DictionaryHint.tsx
//
// One-time onboarding nudge that tells players the highlighted/underlined
// terms in the game text are clickable definitions. The dictionary system
// has 264 glossary terms wired through TextWithTerms in 20+ places, but
// playtesters reported they didn't notice the cue (fb:0aa9660c, fb:8ad42b52).
// v2.70.5 (Phase A) bulks up the term styling AND surfaces this dismissible
// toast on the first session per browser.
//
// Implementation notes:
// - Persists "seen" state in localStorage under a versioned key so a future
//   redesign can bump the version and re-show the hint to existing players.
// - Renders a small fixed-position card in the bottom-right corner. Dismisses
//   on click OR after 12 seconds, whichever first.
// - No game-state coupling — safe to mount anywhere that's only present
//   during gameplay (GameLayout's PLAY-phase tree).

import React, { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'unravel.dictionaryHint.v1';
const AUTO_DISMISS_MS = 12_000;

export function DictionaryHint(): JSX.Element | null {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    // Read localStorage on mount. Guard against SSR / sandboxed environments.
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch {
      // localStorage blocked (Safari private mode, etc.) — fail closed.
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, '1');
      }
    } catch {
      // ignore
    }
  }, []);

  // Declared after dismiss so the auto-dismiss timer closes over a value that
  // already exists at render time rather than relying on the effect running late.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Glossary tip"
      onClick={dismiss}
      style={{
        position: 'fixed',
        bottom: 80,        // sits above the FeedbackButton (bottom-right ~24px)
        right: 24,
        zIndex: 9999,
        maxWidth: 320,
        background: '#ffffff',
        color: '#1a1a1a',
        border: '2px solid #007bff',
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontSize: 14,
        lineHeight: 1.4,
        cursor: 'pointer',
        animation: 'dictionaryHintFadeIn 0.4s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">💡</span>
        <div>
          <strong style={{ display: 'block', marginBottom: 4 }}>Tip: tap to learn</strong>
          <span>
            Words with a <span style={{
              color: '#0056b3',
              textDecoration: 'underline',
              textDecorationThickness: 2,
              backgroundColor: 'rgba(0,123,255,0.07)',
              padding: '0 2px',
              borderRadius: 2,
            }}>blue underline ⓘ</span> open a quick definition.
          </span>
        </div>
      </div>
      <div style={{
        marginTop: 8,
        fontSize: 12,
        color: '#666',
        textAlign: 'right',
      }}>
        Click to dismiss
      </div>
      <style>{`
        @keyframes dictionaryHintFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
