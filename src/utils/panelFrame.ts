// The frame around the player panel's four number boxes (Money, Time, Helpers, Scope).
//
// A look only: the numbers come from the game exactly as before. Which frame is drawn is
// picked in the data (TOWN.csv `setting,panel_frame,...,<name>`), so another version of the game
// (a D&D scroll, say) can swap it without code. The default is the clipboard; `plain` is the
// older bare outline. A frame may only paint (colour, shadow, an absolutely placed clip): no
// padding, border width or gap changes, because the phone panel may not grow by one pixel.

import type React from 'react';
import type { TownCsvRow } from '../types/DataTypes';
import { panelPalettes, type PanelPalette, type PanelMode } from '../components/player/panelTheme';

export type PanelFrameName = 'clipboard' | 'plain';

/** The frame named by TOWN.csv's `panel_frame` setting; missing or unknown = clipboard. */
export function panelFrameName(rows: TownCsvRow[] | undefined): PanelFrameName {
  const row = (rows ?? []).find(r => r.kind === 'setting' && r.id === 'panel_frame');
  const v = (row?.value ?? '').trim().toLowerCase();
  return v === 'plain' || v === 'none' ? 'plain' : 'clipboard';
}

export interface PanelFrameStyles {
  /** The outline around the boxes and their "?" (paint only; keeps its own padding). */
  frame: React.CSSProperties;
  /** The grid holding the four boxes: the sheet of paper. */
  sheet: React.CSSProperties;
  /** Added to each box. */
  tile: React.CSSProperties;
  /** A decoration placed over the frame's top edge, or null for none. Never takes layout space. */
  clip: React.CSSProperties | null;
}

const BOARD = { light: '#c9a46a', dark: '#6b4f2e' } as const;
const BOARD_EDGE = { light: '#8a6a3a', dark: '#3f2e18' } as const;
const PAPER = { light: '#fffdf6', dark: '#2a2822' } as const;
const RULE = { light: '#c9d3e3', dark: '#454a55' } as const;

/** The clipboard's board in the player's colour: the wood with a good share of their colour mixed in, so the players can be told apart at a glance. */
const tinted = (wood: string, playerColor: string | undefined): string => {
  if (!playerColor) return wood;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', 'color-mix(in srgb, red, blue)')) {
    return mixHex(playerColor, wood, 0.55);
  }
  return `color-mix(in srgb, ${playerColor} 55%, ${wood})`;
};

/** color-mix worked out by hand, for a browser too old to have it (Chrome before 111 drops the whole background). A colour that is not hex: the wood. */
export function mixHex(a: string, b: string, shareOfA: number): string {
  const rgb = (hex: string): number[] | null => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const full = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  };
  const [from, to] = [rgb(a), rgb(b)];
  if (!from || !to) return b;
  return `rgb(${from.map((v, i) => Math.round(v * shareOfA + to[i] * (1 - shareOfA))).join(', ')})`;
}

export function panelFrameStyles(name: PanelFrameName, p: PanelPalette, mode: PanelMode, playerColor?: string): PanelFrameStyles {
  if (name === 'plain') {
    return { frame: { border: `1px solid ${p.border}` }, sheet: {}, tile: {}, clip: null };
  }
  return {
    frame: {
      position: 'relative',
      background: tinted(BOARD[mode], playerColor),
      border: `1px solid ${BOARD_EDGE[mode]}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.18)`,
    },
    sheet: {
      background: PAPER[mode],
      borderRadius: 6,
      boxShadow: `0 0 0 1px ${RULE[mode]}`,
    },
    tile: {
      background: 'transparent',
      border: `1px dashed ${RULE[mode]}`,
      borderRadius: 6,
    },
    clip: {
      position: 'absolute',
      top: -6,
      left: '50%',
      width: 46,
      height: 13,
      marginLeft: -23,
      borderRadius: 3,
      background: 'linear-gradient(#e5e9ef, #98a2b3)',
      border: '1px solid #5b6472',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
    },
  };
}

/**
 * The clipboard as a page you flip to: the same wooden board (in the player's colour) and clip the panel wears, for
 * a pop-up drawn as a page of the player's clipboard (ModalBase `clipboard`; Tom, 2026-10-13: "build the flip and the popups").
 */
export function clipboardBoard(mode: PanelMode, playerColor?: string): { board: React.CSSProperties; clip: React.CSSProperties } {
  const look = panelFrameStyles('clipboard', panelPalettes[mode], mode, playerColor);
  return { board: look.frame, clip: look.clip as React.CSSProperties };
}
