// Panel theme + version toggles for the player-panel redesign.
//
// Scoped to the new panel for now (see docs/design/player-panel-redesign.md §4):
// the rest of the app stays light until a later app-wide dark-mode pass.
// Light/dark palettes are built from the slate scale already in styles/theme.ts
// so they stay consistent with the existing design tokens.

import { useCallback, useState } from 'react';

export type PanelMode = 'light' | 'dark';
export type PanelVersion = 'classic' | 'new';

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
    warnSurf: 'rgba(245, 158, 11, 0.14)',
  },
};

const MODE_KEY = 'ucPanelMode';
const VERSION_KEY = 'ucPanelVersion';

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
 * Non-hook reader for the persisted panel version. The new-view outcome modal
 * (DiceResultModal) is a SHARED, short-lived modal rendered outside the panel
 * tree, so it can't use the `usePanelVersion` hook cleanly — it reads the flag
 * once at render instead. Mirrors the hook's fallback ('classic').
 */
export function getStoredPanelVersion(): PanelVersion {
  return readStored(VERSION_KEY, 'classic') === 'new' ? 'new' : 'classic';
}

/** Non-hook reader for the persisted panel light/dark mode (see above). */
export function getStoredPanelMode(): PanelMode {
  return readStored(MODE_KEY, 'light') === 'dark' ? 'dark' : 'light';
}

/** Light/dark for the new panel. Persisted in localStorage. */
export function usePanelMode(): [PanelMode, () => void] {
  const [mode, setMode] = useState<PanelMode>(() =>
    readStored(MODE_KEY, 'light') === 'dark' ? 'dark' : 'light',
  );
  const toggle = useCallback(() => {
    setMode((m) => {
      const next: PanelMode = m === 'light' ? 'dark' : 'light';
      writeStored(MODE_KEY, next);
      return next;
    });
  }, []);
  return [mode, toggle];
}

/**
 * Classic ↔ new panel switch (see docs/design §7). Defaults to 'classic' so
 * normal gameplay is never affected; the maintainer flips to 'new' to verify
 * the redesign includes every piece of information before we commit to it.
 */
export function usePanelVersion(): [PanelVersion, () => void] {
  const [version, setVersion] = useState<PanelVersion>(() =>
    readStored(VERSION_KEY, 'classic') === 'new' ? 'new' : 'classic',
  );
  const toggle = useCallback(() => {
    setVersion((v) => {
      const next: PanelVersion = v === 'classic' ? 'new' : 'classic';
      writeStored(VERSION_KEY, next);
      return next;
    });
  }, []);
  return [version, toggle];
}
