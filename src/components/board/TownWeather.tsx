// The town's weather layer (TIME_ON_BOARD_DESIGN.md 2.8, 2.9): sun glow, clouds, rain and falling snow over each player's
// band of the town. Only the band of the player whose turn it is moves; every other band shows still hints. The layer sits
// just above the ground and under every building, so it can never hide a name sign, a clock, a bubble or a walker.

import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { AreaSegment } from '../../utils/townAreas';
import { isoPoint, type TownLayout } from '../../utils/townLayout';
import type { SeasonLook } from '../../utils/townSeasons';
import {
  hash01, weatherBits, weatherFor, weatherPlan,
  type SceneLevel, type WeatherKind, type WeatherPlan,
} from '../../utils/townWeather';

export interface WeatherBand {
  seat: number;
  kind: WeatherKind;
  plan: WeatherPlan;
  /** The band's outline, in the layer's own pixels. */
  points: string;
  box: { x: number; y: number; w: number; h: number };
  seed: string;
}

export interface WeatherData extends Record<string, unknown> {
  w: number;
  h: number;
  bands: WeatherBand[];
  mode: 'light' | 'dark';
}

/** The weather of every band: pure, from who owns which ground, each owner's days, and the scene settings. */
export function buildWeatherBands(o: {
  layout: Pick<TownLayout, 'bounds'>;
  segments: AreaSegment[];
  looks: SeasonLook[];
  /** Each seat's own day count. */
  days: number[];
  seed: string;
  /** The seat whose turn it is (-1 for nobody). */
  activeSeat: number;
  level: SceneLevel;
  light: boolean;
  reducedMotion: boolean;
  tile: number;
  originX: number;
  originY: number;
}): WeatherBand[] {
  const { minCol, maxCol, minRow, maxRow } = o.layout.bounds;
  const c0 = minCol - 1, c1 = maxCol + 1;
  return o.segments.map(seg => {
    const r0 = Math.max(seg.from, minRow - 1), r1 = Math.min(seg.to, maxRow + 1);
    const look = o.looks[seg.seat];
    const kind = weatherFor(o.seed, seg.seat, o.days[seg.seat] ?? 0, look?.weather ?? { sun: 100, cloud: 0, rain: 0, snow: 0 });
    const plan = weatherPlan(kind, { active: seg.seat === o.activeSeat, level: o.level, light: o.light, reducedMotion: o.reducedMotion });
    const pts = [isoPoint(c0, r0, 0, o.tile), isoPoint(c1, r0, 0, o.tile), isoPoint(c1, r1, 0, o.tile), isoPoint(c0, r1, 0, o.tile)]
      .map(p => ({ x: p.x - o.originX, y: p.y - o.originY }));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return {
      seat: seg.seat, kind, plan,
      points: pts.map(p => `${p.x},${p.y}`).join(' '),
      box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
      seed: `${o.seed}|${seg.seat}`,
    };
  });
}

const CSS = `
@keyframes uc-fall-rain { from { transform: translate(0, -60px); } to { transform: translate(-14px, 70px); } }
@keyframes uc-fall-snow { from { transform: translate(0, -60px); } to { transform: translate(18px, 70px); } }
@keyframes uc-drift { from { transform: translateX(-30px); } to { transform: translateX(50px); } }
`;

/** One band's sky. */
function Sky({ band, uid, dark }: { band: WeatherBand; uid: string; dark: boolean }) {
  const { plan, box, seed } = band;
  const bits = weatherBits(seed, plan.bits);
  const clipId = `${uid}-clip`;
  const glowId = `${uid}-glow`;
  const wet = band.kind === 'rain';
  return (
    <g clipPath={`url(#${clipId})`} data-testid={`town-weather-${band.seat}-${band.kind}`}>
      <defs>
        <clipPath id={clipId}><polygon points={band.points} /></clipPath>
        <radialGradient id={glowId} cx="0.22" cy="0.2" r="0.6">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity={dark ? 0.16 : 0.34} />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {plan.glow && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${glowId})`} />}
      {band.kind === 'rain' && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#5d7388" opacity={dark ? 0.2 : 0.12} />}
      {band.kind === 'cloud' && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#8c97a3" opacity={dark ? 0.16 : 0.08} />}
      {Array.from({ length: plan.clouds }, (_, i) => {
        const w = 128 + Math.round(hash01(`${seed}|cw${i}`) * 56);
        const x = box.x + hash01(`${seed}|cx${i}`) * Math.max(1, box.w - w);
        const y = box.y + (0.15 + 0.7 * hash01(`${seed}|cy${i}`)) * Math.max(1, box.h - w / 2);
        const pic = 1 + Math.floor(hash01(`${seed}|cp${i}`) * 3);
        return (
          <image
            key={`c${i}`} href={`/images/weather/cloud_${pic}.png`} x={x} y={y} width={w} height={w / 2}
            opacity={dark ? 0.35 : 0.6} style={{ imageRendering: 'pixelated', ...(plan.moving ? { animation: `uc-drift ${30 + i * 9}s ease-in-out infinite alternate` } : {}) }}
          />
        );
      })}
      {bits.map((b, i) => {
        const x = box.x + b.x * box.w;
        const y = box.y + b.y * box.h;
        const style: React.CSSProperties = plan.moving
          ? { animation: `${wet ? 'uc-fall-rain 0.9s' : 'uc-fall-snow 5s'} linear ${-b.phase * (wet ? 0.9 : 5)}s infinite` }
          : {};
        return wet
          ? <line key={`b${i}`} x1={x} y1={y} x2={x - 2} y2={y + 9} stroke={dark ? '#a9c4dc' : '#4f7396'} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} style={style} />
          : <circle key={`b${i}`} cx={x} cy={y} r={2 + b.r * 2} fill="#ffffff" opacity={0.9} style={style} />;
      })}
    </g>
  );
}

export function TownWeatherNode({ data }: NodeProps<Node<WeatherData>>) {
  const { w, h, bands, mode } = data;
  const uid = React.useId().replace(/:/g, '');
  const anyMoving = bands.some(b => b.plan.moving);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }} data-testid="town-weather">
      {anyMoving && <style>{CSS}</style>}
      {bands.map(b => <Sky key={b.seat} band={b} uid={`${uid}-${b.seat}`} dark={mode === 'dark'} />)}
    </svg>
  );
}
