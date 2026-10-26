// TownClocks - one flip clock per player on the town board (TIME_ON_BOARD_DESIGN.md, step 2). Each clock shows
// that player's own date (start date + THAT player's days, gameClock.ts), in the player's colour with their name.
// All clocks sit in ONE ROW along the top of the board view, in player order (Tom, 2026-10-26: "they all should be
// near the top"), fixed on the screen: the row does not move or scale when the board is moved or zoomed. A player who
// has finished or gone out leaves the row. If the row is wider than the screen the clocks shrink evenly to fit.
//   PC: all clocks. TV: all clocks, up to 1.6 times bigger. Remote strip: one slim clock for the current player. Phone: no board.
// When a player's days change only that player's clock shuffles (about 0.6 s, by timers, so it ends on time even
// on a TV that gives no animation frames); with reduced motion the new date just appears with a short ring.
import React, { useEffect, useRef, useState } from 'react';
import { Panel, useStore } from '@xyflow/react';
import { clockDate, clockText, type ClockDate } from '../../utils/gameClock';
import { scaleMs } from '../../utils/gameSpeed';
import { inkOn } from '../../utils/textOnColor';

export type ClockScreen = 'pc' | 'tv' | 'remote';

export interface ClockPlayer { id: string; name: string; color?: string; timeSpent: number; /** Finished or out: the clock leaves the board. */ gone?: boolean }

const SHUFFLE_MS = 600;
const TICK_MS = 70;

const prefersReducedMotion = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Gap between two clocks in the row, and the margin round the row (px). */
export const ROW_GAP = 8;
export const ROW_MARGIN = 8;
/** Height of one clock before scaling (px). */
export const CLOCK_H = 42;
/** The smallest the row's clocks are squeezed to before they would be unreadable. */
export const MIN_ROW_SCALE = 0.45;

/**
 * The size of the clocks in the row: the wanted size (1, or 1.6 on a TV), squeezed evenly so that `count` clocks and
 * the gaps between them fit across `width` px.
 */
export function rowScale(count: number, width: number, wanted: number, height?: number): number {
  if (count <= 0) return wanted;
  const room = width - 2 * ROW_MARGIN - (count - 1) * ROW_GAP;
  const fit = room / (count * CLOCK_W);
  // A short board (a TV under its header) must not lose a fifth of its height to the clocks.
  const tall = height ? (MAX_ROW_SHARE * height) / CLOCK_H : Infinity;
  return Math.max(MIN_ROW_SCALE, Math.min(wanted, fit, tall));
}

/** The most of the board's height the row may take. */
export const MAX_ROW_SHARE = 0.15;

/** How many px the row takes from the top of the board (margin included), so the framing can leave that room. */
export function rowHeightPx(count: number, width: number, height: number, screen: ClockScreen): number {
  if (screen === 'remote' || count <= 0) return 0;
  return Math.ceil(CLOCK_H * rowScale(count, width, screen === 'tv' ? 1.6 : 1, height)) + 2 * ROW_MARGIN;
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

export function FlipClock({ player, date, big, current, still, scale }: { player: ClockPlayer; date: ClockDate; big: boolean; current: boolean; still: boolean; /** Overrides `big`: the exact size to draw at. */ scale?: number }) {
  const text = clockText(date);
  const color = player.color ?? '#475569';
  const { shown, ring } = useShuffledText(text, still);
  const name = inkOn(color);
  const [y, m, d] = shown.split(' ');
  return (
    <div role="img" aria-label={`${player.name}: ${text}`} data-testid={`town-clock-${player.id}`} style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 5px 3px', borderRadius: 8,
      background: color, opacity: 0.9, transform: scale !== undefined ? `scale(${scale})` : big ? 'scale(1.6)' : undefined, transformOrigin: 'top center',
      boxShadow: current || ring ? `0 0 0 3px ${color}66, 0 0 14px ${color}` : '0 1px 4px rgba(0,0,0,0.3)',
    }}>
      <span style={{ display: 'inline-flex', gap: GAP, alignItems: 'center' }}>
        <Flaps text={y} /><Flaps text={m} /><Flaps text={d} />
      </span>
      <span style={{ font: '600 10px/12px system-ui, sans-serif', color: name.ink, textShadow: name.shadow, maxWidth: CLOCK_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
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
  startIso: string;
  screen: ClockScreen;
}

export function TownClocks({ players, currentPlayerId, startIso, screen }: TownClocksProps): JSX.Element | null {
  const w = useStore(st => st.width);
  const h = useStore(st => st.height);
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

  // Everyone who has not left (if all have left, the end screen takes over and everyone shows).
  const allGone = players.every(p => p.gone);
  const shown = players.filter(p => allGone || !p.gone);
  const scale = rowScale(shown.length, w || 800, screen === 'tv' ? 1.6 : 1, h || undefined);
  return (
    <Panel position="top-center" style={{ margin: ROW_MARGIN, pointerEvents: 'none' }}>
      <div data-testid="town-clock-row" data-scale={scale.toFixed(3)} style={{ display: 'flex', gap: ROW_GAP, alignItems: 'flex-start', justifyContent: 'center' }}>
        {shown.map(p => (
          <div key={p.id} style={{ width: CLOCK_W * scale, height: CLOCK_H * scale, display: 'flex', justifyContent: 'center' }}>
            <FlipClock player={p} date={clockDate(startIso, p.timeSpent)} big={false} scale={scale} current={p.id === currentPlayerId} still={still} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
