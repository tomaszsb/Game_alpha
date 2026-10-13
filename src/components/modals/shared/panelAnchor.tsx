// Where the player panel is on a PC screen, so the pop-ups you PLAY (dice result, life event, routing
// explanation, choice, card replacement, negotiation, card selection) can open over the panel with the
// dark cover only over the panel; the board, the walk and the result bubbles stay bright. Pop-ups you
// READ (rules, end game, card details, discard pile) never use this and stay centred.
//
// GameLayout's PC branch provides the panel column through PanelAnchorContext; the phone and remote
// layouts do not, so their pop-ups are exactly as before. A pop-up asks for the rect with
// `usePanelAnchorRect`; no provider, a narrow window or a hidden panel gives null = centred.

import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

/** Whose clipboard a pop-up over the panel is a page of: the current player's colour (GameLayout provides it beside the panel). */
export const ClipboardLookContext = createContext<{ color?: string } | null>(null);

export const PanelAnchorContext = createContext<React.RefObject<HTMLElement | null> | null>(null);

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Below this window width the layout is one column (the panel is not beside a board). */
export const PANEL_ANCHOR_MIN_WINDOW = 769;
/** A panel smaller than this is not a place to read a pop-up. */
const MIN_PANEL_WIDTH = 240;
const MIN_PANEL_HEIGHT = 240;

export function usePanelAnchorRect(wanted: boolean, isOpen: boolean): AnchorRect | null {
  const anchor = useContext(PanelAnchorContext);
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    // Keep the last rect while a pop-up fades out, so it does not jump to the centre on close.
    if (!wanted || !isOpen || !anchor) return undefined;
    const measure = () => {
      const el = anchor.current;
      if (!el || window.innerWidth < PANEL_ANCHOR_MIN_WINDOW) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width < MIN_PANEL_WIDTH || r.height < MIN_PANEL_HEIGHT) { setRect(null); return; }
      const next = { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      setRect(prev => (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    let ro: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== 'undefined' && anchor.current) {
        ro = new ResizeObserver(measure);
        ro.observe(anchor.current);
      }
    } catch {
      ro = null; // a window resize still re-measures
    }
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [wanted, isOpen, anchor]);

  return wanted ? rect : null;
}

/** Overlay position that covers only the panel (replaces the full-screen top/left/right/bottom 0). */
export function anchoredOverlayStyle(rect: AnchorRect): React.CSSProperties {
  return { top: rect.top, left: rect.left, right: 'auto', bottom: 'auto', width: rect.width, height: rect.height, boxSizing: 'border-box' };
}
