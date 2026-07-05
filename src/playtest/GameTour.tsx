// src/playtest/GameTour.tsx
//
// A small image carousel for the /challenge landing page — a visual tour of
// the game (board, glossary, a modal, end-game screen, player panels, …).
//
// HOW TO ADD / CHANGE / REORDER PHOTOS (no code editing needed):
//   Drop a PNG/JPG into src/playtest/tour/. That's it — it appears in the
//   carousel automatically, built into the app at compile time.
//     • Order  = filename order, so prefix with a number: 01-…, 02-…, 03-…
//     • Caption = the filename, cleaned up. "03-end-game-screen.png" shows as
//                 "End game screen". Use dashes for spaces.
//   To replace one, overwrite the file. To remove one, delete the file.
//
// If the folder is empty the whole carousel renders nothing (the page just
// skips it), so it's always safe.

import React, { useState } from 'react';

// Eager glob: every image in ./tour/ is bundled and its URL returned. Vite
// resolves this at build time — the folder is the single source of truth.
const modules = import.meta.glob('./tour/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function captionFromPath(path: string): string {
  const base = path.split('/').pop() || '';
  const name = base.replace(/\.[^.]+$/, '');       // drop extension
  const noOrder = name.replace(/^\d+[-_\s]*/, '');  // drop leading "01-" order prefix
  const words = noOrder.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Unravel Codes';
}

const SLIDES = Object.keys(modules)
  .sort((a, b) => a.localeCompare(b))
  .map((path) => ({ url: modules[path], caption: captionFromPath(path) }));

export function GameTour(): JSX.Element | null {
  const [i, setI] = useState(0);
  if (SLIDES.length === 0) return null;

  const many = SLIDES.length > 1;
  const go = (delta: number): void => setI((prev) => (prev + delta + SLIDES.length) % SLIDES.length);

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: '1.1rem',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ width: '100%', maxWidth: 460, marginBottom: '1.25rem' }}>
      <div style={{ position: 'relative' }}>
        <img
          src={SLIDES[i].url}
          alt={SLIDES[i].caption}
          style={{ width: '100%', borderRadius: 12, display: 'block', boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
        />
        {many && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(-1)} style={{ ...arrowStyle, left: 8 }}>‹</button>
            <button type="button" aria-label="Next photo" onClick={() => go(1)} style={{ ...arrowStyle, right: 8 }}>›</button>
          </>
        )}
      </div>

      <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#555', fontWeight: 500 }}>{SLIDES[i].caption}</p>

      {many && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: '0.4rem' }}>
          {SLIDES.map((s, idx) => (
            <button
              key={s.url}
              type="button"
              aria-label={`Go to ${s.caption}`}
              onClick={() => setI(idx)}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                background: idx === i ? '#007bff' : '#ccc',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
