// TurnBanner - on a TV, round town: when the turn passes, "X's turn" stands over the board for a few seconds (Tom's TV
// test, 2026-10-30). In every Scene setting; only its fade stops when motion is off. The words and the seconds are data
// (`round_turn_banner`, `round_turn_banner_ms` in TOWN.csv), so a teacher can change or reset them in the backroom.
// It is laid over the board and never takes the mouse, so it moves nothing and feeds no measuring.

import React, { useEffect, useRef, useState } from 'react';

const DEFAULT_TEXT = "{name}'s turn";
const DEFAULT_MS = 3000;

/** The words for a player: `{name}` is the player's name. Blank data turns the banner off. */
export function bannerText(template: string | undefined, name: string): string {
  return (template ?? DEFAULT_TEXT).trim().replace(/\{name\}/g, name);
}

/** How long it stands: 0 turns it off; anything that is not a number gives the default. */
export function bannerMs(value: string | undefined): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? Math.max(0, Math.min(30000, n)) : DEFAULT_MS;
}

/** Black or white, whichever reads better on the player's colour. */
export function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
}

interface Props {
  player?: { id: string; name: string; color?: string };
  text?: string;
  ms?: string;
  still: boolean;
}

export function TurnBanner({ player, text, ms, still }: Props): JSX.Element | null {
  const [shown, setShown] = useState<{ id: string; name: string; color?: string; key: number } | null>(null);
  const was = useRef(player?.id);
  const count = useRef(0);
  const lasts = bannerMs(ms);
  useEffect(() => {
    const before = was.current;
    was.current = player?.id;
    // only when the turn PASSES: not when the screen first opens, and not on a one-player game
    if (!player || !before || before === player.id || lasts <= 0) return undefined;
    setShown({ id: player.id, name: player.name, color: player.color, key: ++count.current });
    const t = window.setTimeout(() => setShown(null), lasts);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, lasts]);
  if (!shown) return null;
  const words = bannerText(text, shown.name);
  if (!words) return null;
  const color = shown.color ?? '#1f2937';
  return (
    <div data-testid="turn-banner" aria-live="polite" style={{ position: 'absolute', top: '4%', left: 0, right: 0, zIndex: 3000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      {!still && <style>{'@keyframes uc-turn-banner { 0%, 100% { opacity: 0; } 8%, 92% { opacity: 1; } }'}</style>}
      <div
        key={shown.key}
        style={{
          background: color, color: inkOn(color), border: '4px solid #ffffff', borderRadius: 18, padding: '0.25em 0.9em', maxWidth: '90%',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 7vh, 84px)', lineHeight: 1.15, textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          ...(still ? {} : { animation: `uc-turn-banner ${lasts}ms linear both` }),
        }}
      >
        {words}
      </div>
    </div>
  );
}
