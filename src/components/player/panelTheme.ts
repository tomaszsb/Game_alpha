// Panel theme (light/dark) for the player panel.
//
// Scoped to the player panel for now (see docs/design/player-panel-redesign.md
// §4): the rest of the board/app stays light until a later app-wide dark-mode
// pass (tracked in TODO.md). Light/dark palettes are built from the slate
// scale already in styles/theme.ts so they stay consistent with the existing
// design tokens.
//
// The classic ↔ new panel version toggle (PanelVersion/usePanelVersion) was
// removed 2026-07-14 along with the classic ActionCenterPanel itself —
// PlayerPanelV2 is now the only panel.

import { useSyncExternalStore } from 'react';

export type PanelMode = 'light' | 'dark';

export interface PanelPalette {
  bg: string;
  surf: string;
  surf2: string;
  text: string;
  muted: string;
  border: string;
  /** Border + text strong enough to stay visible in light mode (no ghost buttons). */
  borderStrong: string;
  accent: string;
  /** Good/bad value tints readable on this mode's surfaces (never the sole cue — a11y). */
  good: string;
  bad: string;
  /** Soft alert surface + border for "needs attention" rows (e.g. Still to raise). */
  badSurf: string;
  badBorder: string;
  /** Soft positive surface + border — the approved/success counterpart to badSurf/badBorder
   *  (e.g. an approval verdict banner). */
  goodSurf: string;
  goodBorder: string;
  /** Soft warning surface for "not yet / hold on" hints. */
  warnSurf: string;
}

export const panelPalettes: Record<PanelMode, PanelPalette> = {
  light: {
    bg: '#ffffff',
    surf: '#f1f4f8',
    surf2: '#e1e7f0',
    text: '#1a202c',
    muted: '#566076',
    border: '#d7dde6',
    borderStrong: '#8d9bb0',
    accent: '#3b82f6',
    good: '#1e7e34',
    bad: '#c0392b',
    badSurf: '#fdecea',
    badBorder: '#f5c6cb',
    goodSurf: '#d4edda',
    goodBorder: '#c3e6cb',
    warnSurf: '#fff7ed',
  },
  dark: {
    bg: '#0f172a',
    surf: '#1e293b',
    surf2: '#2a3950',
    text: '#f1f5f9',
    muted: '#a3b3c7',
    border: '#334155',
    borderStrong: '#52627a',
    accent: '#3b82f6',
    good: '#4ade80',
    bad: '#f87171',
    badSurf: 'rgba(248, 113, 113, 0.14)',
    badBorder: 'rgba(248, 113, 113, 0.4)',
    goodSurf: 'rgba(74, 222, 128, 0.14)',
    goodBorder: 'rgba(74, 222, 128, 0.4)',
    warnSurf: 'rgba(245, 158, 11, 0.14)',
  },
};

const MODE_KEY = 'ucPanelMode';

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable — ignore (toggle still works in-session) */
  }
}

/**
 * Non-hook reader for the persisted panel light/dark mode. DiceResultModal is
 * a SHARED, short-lived modal rendered outside the panel tree, so it can't use
 * the `usePanelMode` hook cleanly — it reads the flag once at render instead.
 */
export function getStoredPanelMode(): PanelMode {
  return readStored(MODE_KEY, sessionMode) === 'dark' ? 'dark' : 'light';
}

// In-session fallback so the toggle still works when localStorage is blocked.
let sessionMode: PanelMode = 'light';

// One shared mode for the whole screen (fb:feedback-1788865148274-b6963218).
// `usePanelMode` used to keep its own useState per caller, so each player card,
// the board and the progress bar read localStorage on their own schedule: a
// toggle in one panel did not reach a second panel, and surfaces that did not
// happen to re-render stayed light. Every hook caller now subscribes to the
// same value and re-renders the moment it flips.
const modeListeners = new Set<() => void>();

function subscribeMode(listener: () => void): () => void {
  modeListeners.add(listener);
  return () => {
    modeListeners.delete(listener);
  };
}

export function setPanelMode(next: PanelMode): void {
  if (getStoredPanelMode() === next) return;
  sessionMode = next;
  writeStored(MODE_KEY, next);
  modeListeners.forEach((l) => l());
}

export function togglePanelMode(): void {
  setPanelMode(getStoredPanelMode() === 'light' ? 'dark' : 'light');
}

/** Light/dark for the whole game screen. Persisted in localStorage, shared by every caller. */
export function usePanelMode(): [PanelMode, () => void] {
  const mode = useSyncExternalStore(subscribeMode, getStoredPanelMode, getStoredPanelMode);
  return [mode, togglePanelMode];
}
