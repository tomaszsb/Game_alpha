// TownClocks - one flip clock per player on the town board (TIME_ON_BOARD_DESIGN.md, step 2). Each clock shows
// that player's own date (start date + THAT player's days, gameClock.ts), in the player's colour, and sits at
// the top of their band of the town, pinned to the top of the part of the band you can see. It is a screen-size
// object: the same readable size at any zoom. A clock never covers a name sign (it is drawn under an open sign, above the buildings).
//   PC: all clocks. TV: all clocks, 1.6 times bigger. Remote strip: one slim clock for the current player. Phone: no board.
// When a player's days change only that player's clock shuffles (about 0.6 s, by timers, so it ends on time even
// on a TV that gives no animation frames); with reduced motion the new date just appears with a short ring.
import React, { useEffect, useRef, useState } from 'react';
import { Panel, ViewportPortal, useStore, useViewport } from '@xyflow/react';
import type { TownLayout } from '../../utils/townLayout';
import { isoPoint } from '../../utils/townLayout';
import { clockDate, clockText, type ClockDate } from '../../utils/gameClock';
import { scaleMs } from '../../utils/gameSpeed';

export type ClockScreen = 'pc' | 'tv' | 'remote';

export interface ClockPlayer { id: string; name: string; color?: string; timeSpent: number }

const SHUFFLE_MS = 600;
const TICK_MS = 70;
const MIN_VISIBLE_PX = 60;
const PIN_GAP = 6;

const prefersReducedMotion = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Where each band starts and ends, in flow coordinates (iso points on the band's centre column). */
export interface BandSpan { x: number; top: number; bottom: number }
export function bandSpans(layout: TownLayout, count: number, tile: number): BandSpan[] {
  const { minCol, maxCol, minRow, maxRow } = layout.bounds;
  const bandRows = parseFloat(layout.settings.seat_drow ?? '') || 16.4;
  const midCol = (minCol + maxCol) / 2;
  const out: BandSpan[] = [];
  for (let k = 0; k < count; k++) {
    const top = minRow - 0.5 + k * bandRows;
    const bottom = k === count - 1 ? maxRow + 1 : minRow - 0.5 + (k + 1) * bandRows;
    out.push({ x: isoPoint(midCol, top, 0, tile).x, top: isoPoint(midCol, top, 0, tile).y, bottom: isoPoint(midCol, bottom, 0, tile).y });
  }
  return out;
}

/**
 * Where one clock goes on the screen, or null when too little of its band is showing. The clock sticks to the
 * top of the visible part of the band; sideways it stays fully on screen.
 */
export function pinClock(span: BandSpan, view: { x: number; y: number; zoom: number }, screen: { w: number; h: number }, clockW: number): { sx: number; sy: number } | null {
  const topPx = span.top * view.zoom + view.y;
  const bottomPx = span.bottom * view.zoom + view.y;
  const visible = Math.min(bottomPx, screen.h) - Math.max(topPx, 0);
  // A band that is small on the whole (four players at fit zoom) still keeps its clock while most of it shows.
  if (visible < Math.min(MIN_VISIBLE_PX, 0.6 * (bottomPx - topPx))) return null;
  const half = clockW / 2 + PIN_GAP;
  const cx = span.x * view.zoom + view.x;
  return { sx: Math.min(Math.max(cx, half), Math.max(half, screen.w - half)), sy: Math.max(topPx + PIN_GAP, PIN_GAP) };
}

const POOL_DIGIT = '0123456789';
const POOL_LETTER = 'ABCDEFGHIJKLMNOPRSTUVWY';
const randomLike = (c: string) => {
  const pool = /\d/.test(c) ? POOL_DIGIT : POOL_LETTER;
  return pool[Math.floor(Math.random() * pool.length)];
};

/** The text to show now: the real text, except for about 0.6 s after it changes, when its flaps cycle and settle left to right. */
export function useShuffledText(text: string, still: boolean): { shown: string; ring: boolean } {
  const [shuffle, setShuffle] = useState<string | null>(null);
  const [ring, setRing] = useState(false);
  const last = useRef(text);
  useEffect(() => {
    if (last.current === text) return;
    last.current = text;
    if (still) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 1200);
      return () => { clearTimeout(t); setRing(false); };
    }
    const total = scaleMs(SHUFFLE_MS);
    const start = Date.now();
    const step = () => {
      const el = Date.now() - start;
      setShuffle(text.split('').map((c, i) => (c === ' ' || el >= (total * (i + 1)) / text.length ? c : randomLike(c))).join(''));
    };
    step();
    const iv = setInterval(step, TICK_MS);
    const end = setTimeout(() => { clearInterval(iv); setShuffle(null); }, total);
    return () => { clearInterval(iv); clearTimeout(end); setShuffle(null); };
  }, [text, still]);
  return { shown: shuffle ?? text, ring };
}

const FLAP_W = 13;
const FLAP_H = 20;
const GAP = 8;

function Flaps({ text }: { text: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {text.split('').map((c, i) => (
        <span key={i} style={{
          width: FLAP_W, height: FLAP_H, borderRadius: 3, background: 'linear-gradient(#2b3340 49%, #0f1319 50%, #1c232d 51%)', color: '#f8fafc',
          font: '700 14px/20px ui-monospace, Menlo, Consolas, monospace', textAlign: 'center', display: 'inline-block',
        }}>{c}</span>
      ))}
    </span>
  );
}

/** Width of the full clock before scaling, so the pin can keep it on screen. */
export const CLOCK_W = 4 * (FLAP_W + 2) + 3 * (FLAP_W + 2) + 2 * (FLAP_W + 2) + 2 * GAP + 10;

export function FlipClock({ player, date, big, current, still }: { player: ClockPlayer; date: ClockDate; big: boolean; current: boolean; still: boolean }) {
  const text = clockText(date);
  const color = player.color ?? '#475569';
  const { shown, ring } = useShuffledText(text, still);
  const [y, m, d] = shown.split(' ');
  return (
    <div role="img" aria-label={`${player.name}: ${text}`} data-testid={`town-clock-${player.id}`} style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 5px 3px', borderRadius: 8,
      background: color, opacity: 0.9, transform: big ? 'scale(1.6)' : undefined, transformOrigin: 'top center',
      boxShadow: current || ring ? `0 0 0 3px ${color}66, 0 0 14px ${color}` : '0 1px 4px rgba(0,0,0,0.3)',
    }}>
      <span style={{ display: 'inline-flex', gap: GAP, alignItems: 'center' }}>
        <Flaps text={y} /><Flaps text={m} /><Flaps text={d} />
      </span>
      <span style={{ font: '600 10px/12px system-ui, sans-serif', color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.5)', maxWidth: CLOCK_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
    </div>
  );
}

function SlimClock({ player, date, still }: { player: ClockPlayer; date: ClockDate; still: boolean }) {
  const text = clockText(date);
  const { shown, ring } = useShuffledText(text, still);
  return (
    <span role="img" aria-label={`${player.name}: ${text}`} data-testid={`town-clock-${player.id}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 10, background: 'rgba(15,23,42,0.85)', color: '#f8fafc',
      font: '700 11px/14px ui-monospace, Menlo, Consolas, monospace', boxShadow: ring ? `0 0 0 2px ${player.color ?? '#475569'}` : undefined,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: player.color ?? '#475569', flex: 'none' }} />{shown}
    </span>
  );
}

export interface TownClocksProps {
  players: ClockPlayer[];
  currentPlayerId: string | null;
  layout: TownLayout;
  tile: number;
  startIso: string;
  screen: ClockScreen;
}

export function TownClocks({ players, currentPlayerId, layout, tile, startIso, screen }: TownClocksProps): JSX.Element | null {
  const view = useViewport();
  const w = useStore(s => s.width);
  const h = useStore(s => s.height);
  const still = prefersReducedMotion();
  if (players.length === 0) return null;

  if (screen === 'remote') {
    const p = players.find(x => x.id === currentPlayerId) ?? players[0];
    return (
      <Panel position="top-right" style={{ margin: 6, pointerEvents: 'none' }}>
        <SlimClock player={p} date={clockDate(startIso, p.timeSpent)} still={still} />
      </Panel>
    );
  }

  const big = screen === 'tv';
  const spans = bandSpans(layout, players.length, tile);
  const clockW = CLOCK_W * (big ? 1.6 : 1);
  return (
    <ViewportPortal>
      {players.map((p, i) => {
        const spot = spans[i] && pinClock(spans[i], view, { w, h }, clockW);
        if (!spot) return null;
        const fx = (spot.sx - view.x) / view.zoom;
        const fy = (spot.sy - view.y) / view.zoom;
        return (
          <div key={p.id} style={{ position: 'absolute', left: 0, top: 0, zIndex: 1800, pointerEvents: 'none', transform: `translate(${fx}px, ${fy}px) scale(${1 / view.zoom})`, transformOrigin: '0 0' }}>
            <div style={{ transform: 'translateX(-50%)' }}>
              <FlipClock player={p} date={clockDate(startIso, p.timeSpent)} big={big} current={p.id === currentPlayerId} still={still} />
            </div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
