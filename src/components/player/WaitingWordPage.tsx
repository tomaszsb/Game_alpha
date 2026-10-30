// WaitingWordPage - while a player waits, a glossary word and its meaning fill their phone, large and with nothing to
// tap to open it (Tom's TV test, 2026-10-30). It goes back by itself when their turn comes. One small button shows their
// numbers. It sits under every pop-up (the pop-ups' own layer is 1000), so it never covers anything they must answer, and
// it lies over the panel rather than in it, so the panel is no taller. A personal link with the board on it (Remote) keeps
// its board: only the panel's part of the page is taken, since that board is how they watch the game.

import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PanelPalette } from './panelTheme';

interface Props {
  term: string;
  definition: string;
  waitingLine: string;
  numbersLabel: string;
  onNumbers: () => void;
  palette: PanelPalette;
}

/** Which ground the page takes: the part of the page marked for the panel when there is one (Remote), else all of it. */
const panelArea = (): Element | null => document.querySelector('[data-panel-area]');

export function WaitingWordPage({ term, definition, waitingLine, numbersLabel, onNumbers, palette: p }: Props): JSX.Element {
  // The panel renders before the part of the page around it is on screen, so look again once it is (before anything is painted).
  const [area, setArea] = useState<Element | null>(panelArea);
  useLayoutEffect(() => setArea(panelArea()), []);
  return createPortal(
    <div
      data-testid="waiting-word-page"
      style={{
        position: area ? 'absolute' : 'fixed', inset: 0, zIndex: 900, boxSizing: 'border-box', padding: '24px 22px 18px',
        display: 'flex', flexDirection: 'column', background: `linear-gradient(170deg, ${p.surf}, ${p.bg})`, color: p.text,
      }}
    >
      {/* A long meaning scrolls here; the button below always stays on the page. */}
      <div style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', display: 'flex' }}>
      <div style={{ margin: 'auto 0', width: '100%', textAlign: 'center', padding: '12px 0' }}>
        <div aria-hidden style={{ fontSize: 44, lineHeight: 1 }}>📖</div>
        <div data-testid="waiting-word" style={{ fontSize: 'clamp(30px, 10vw, 54px)', fontWeight: 800, lineHeight: 1.1, marginTop: 14, color: p.accent, overflowWrap: 'anywhere' }}>{term}</div>
        <div style={{ fontSize: 'clamp(19px, 5.4vw, 28px)', lineHeight: 1.4, marginTop: 18 }}>{definition}</div>
      </div>
      </div>
      {/* The button on the left: the bug report button sits at the bottom right of every page. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, paddingRight: 64 }}>
        <button
          type="button"
          data-testid="waiting-my-numbers"
          onClick={onNumbers}
          style={{ flex: 'none', minHeight: 44, padding: '0 14px', fontSize: 15, fontWeight: 700, borderRadius: 10, background: p.bg, color: p.text, border: `2px solid ${p.accent}`, cursor: 'pointer' }}
        >
          {numbersLabel}
        </button>
        <span style={{ fontSize: 14, opacity: 0.75 }}>{waitingLine}</span>
      </div>
    </div>,
    area ?? document.body,
  );
}
