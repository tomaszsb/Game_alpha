// townLooks - the round town's buildings drawn to say what they do (fb:fefe42f8, stage 1b; Tom 2026-10-30: "i want them
// to be even more expressive of their function ... I would prefer that the sign be incorporated into the facade
// signage"). Which look a building gets is data (TOWN.csv `round_looks`, e.g. "bank:bank investor:tower"), picked from
// the set below; no building names here, so another board can use the same drawings for its own places. Shape, roof
// and details carry the meaning: the colour stays the building's own (shades of it), plus plain white, grey, glass and
// wood, never a new colour that could be mistaken for a player. Plain polygons and lines only (cheap on a TV stick).
//
// Grid: the building's footprint is (c0, r0)..(c1, r1); the two walls the viewer sees are the front (row r1) and the
// right side (col c1). `P(c, r, z)` is a point on the drawing, z = px above the ground.

import React from 'react';

export type SignStyle = 'board' | 'plaque' | 'awning' | 'banner';
export type Pt = (c: number, r: number, z: number) => string;

export interface Foot {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
  /** The building's own height from the town list (px); each look draws in proportion to it. */
  h: number;
  color: string;
}

export interface Look {
  /** How high the drawing reaches (px). */
  top: (f: Foot) => number;
  /** Where the middle of the name sign sits: on the front wall, or on a side wall or fence (`side`), and how many tiles of
   *  wall it spans (default: the whole front). */
  sign: (f: Foot) => { c: number; r: number; z: number; span?: number; side?: boolean };
  signStyle: SignStyle;
  /** The sign's letters against the town's sign size (a small building's sign is a little smaller). Default 1. */
  signSize?: number;
  /** Where the players stand (on the roof, on the stage, on the lot). */
  stand: (f: Foot) => { c: number; r: number; z: number };
  draw: (P: Pt, f: Foot) => React.ReactNode;
}

/** A darker or lighter shade of the building's own colour. */
export function tone(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const EDGE = 'rgba(0,0,0,0.35)';
const GLASS = '#dbeafe';
const WHITE = '#f8fafc';
const STEEL = '#4b5563';
const WOOD = '#6b4f3a';
const STONE = '#d6d3d1';
const DARK = '#374151';
const cm = (f: Foot) => (f.c0 + f.c1) / 2;
const rm = (f: Foot) => (f.r0 + f.r1) / 2;

const poly = (pts: string[], fill: string, stroke = EDGE, sw = 2, key?: string | number) => (
  <polygon key={key} points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
);
/** A patch on the front wall (row r) between two columns and two heights. */
const front = (P: Pt, r: number, ca: number, cb: number, za: number, zb: number, fill: string, key?: string | number, stroke = EDGE, sw = 1.5) =>
  poly([P(ca, r, za), P(cb, r, za), P(cb, r, zb), P(ca, r, zb)], fill, stroke, sw, key);
/** A patch on the right wall (col c) between two rows and two heights. */
const side = (P: Pt, c: number, ra: number, rb: number, za: number, zb: number, fill: string, key?: string | number, stroke = EDGE, sw = 1.5) =>
  poly([P(c, ra, za), P(c, rb, za), P(c, rb, zb), P(c, ra, zb)], fill, stroke, sw, key);
/** A block: front wall, right wall and (unless covered) its flat top. */
function block(P: Pt, c0: number, r0: number, c1: number, r1: number, z0: number, z1: number, color: string, key: string | number, top = true): React.ReactNode {
  return (
    <g key={key}>
      {front(P, r1, c0, c1, z0, z1, tone(color, 0.78), undefined, EDGE, 2)}
      {side(P, c1, r0, r1, z0, z1, tone(color, 0.62), undefined, EDGE, 2)}
      {top && poly([P(c0, r0, z1), P(c1, r0, z1), P(c1, r1, z1), P(c0, r1, z1)], tone(color, 0.9))}
    </g>
  );
}
/** Rows and columns of windows on both walls a viewer sees. */
function windows(P: Pt, f: Foot, z0: number, z1: number, cols: number, rows: number, fill = GLASS, key = 'w'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const W = f.c1 - f.c0, D = f.r1 - f.r0, H = (z1 - z0) / rows;
  for (let j = 0; j < rows; j++) {
    const za = z0 + j * H + H * 0.25, zb = za + H * 0.5;
    for (let i = 0; i < cols; i++) {
      const ca = f.c0 + (i + 0.25) * (W / cols);
      out.push(front(P, f.r1, ca, ca + 0.5 * (W / cols), za, zb, fill, `${key}f${i}-${j}`, 'rgba(0,0,0,0.25)', 1));
    }
    const sideCols = Math.max(1, Math.round(cols * D / W));
    for (let i = 0; i < sideCols; i++) {
      const ra = f.r0 + (i + 0.25) * (D / sideCols);
      out.push(side(P, f.c1, ra, ra + 0.5 * (D / sideCols), za, zb, tone(fill, 0.92), `${key}s${i}-${j}`, 'rgba(0,0,0,0.25)', 1));
    }
  }
  return out;
}
/** A fence of boards along the front and right edges of a lot. */
function fence(P: Pt, f: Foot): React.ReactNode {
  const out: React.ReactNode[] = [];
  out.push(front(P, f.r1, f.c0, f.c1, 0, 16, tone(WHITE, 0.94), 'ff', 'rgba(0,0,0,0.3)', 1.5));
  out.push(side(P, f.c1, f.r0, f.r1, 0, 16, tone(WHITE, 0.85), 'fs', 'rgba(0,0,0,0.3)', 1.5));
  out.push(side(P, f.c0, f.r0, f.r1, 0, 16, tone(WHITE, 0.85), 'fl', 'rgba(0,0,0,0.3)', 1.5));
  for (let c = f.c0; c <= f.c1 + 0.01; c += 0.8) out.push(<polyline key={`fp${c}`} points={`${P(c, f.r1, 0)} ${P(c, f.r1, 20)}`} stroke={STEEL} strokeWidth={2} />);
  return <g key="fence">{out}</g>;
}
/** A gear standing on a roof, facing the viewer (an engineer's sign of the trade). */
function gear(cx: number, cy: number, r: number, fill: string): React.ReactNode {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    return <circle key={i} cx={x} cy={y} r={r * 0.28} fill={fill} />;
  });
  return <g key="gear">{teeth}<circle cx={cx} cy={cy} r={r} fill={fill} stroke={EDGE} strokeWidth={1.5} /><circle cx={cx} cy={cy} r={r * 0.38} fill={WHITE} /></g>;
}
const pt = (s: string) => s.split(',').map(Number) as [number, number];

export const LOOKS: Record<string, Look> = {
  /** A plain block (anything the data does not give a look). */
  box: {
    top: f => Math.max(f.h, 0),
    sign: f => ({ c: cm(f), r: f.r1, z: Math.max(f.h * 0.6, 24) }),
    signStyle: 'board',
    stand: f => ({ c: cm(f), r: rm(f), z: f.h }),
    draw: (P, f) => (f.h === 0
      ? poly([P(f.c0, f.r0, 0), P(f.c1, f.r0, 0), P(f.c1, f.r1, 0), P(f.c0, f.r1, 0)], f.color, tone(f.color, 0.6), 3)
      : [block(P, f.c0, f.r0, f.c1, f.r1, 0, f.h, f.color, 'b'), ...windows(P, f, 0, f.h, 3, 1)]),
  },
  /** A house with a pitched roof, a door and a chimney. */
  house: {
    top: f => f.h * 1.9,
    sign: f => ({ c: cm(f), r: f.r1, z: f.h * 1.25 * 0.66 }),
    signStyle: 'awning',
    stand: f => ({ c: cm(f), r: rm(f), z: f.h * 1.9 }),
    draw: (P, f) => {
      const zw = f.h * 1.25, zt = f.h * 1.9, mid = rm(f);
      return [
        block(P, f.c0, f.r0, f.c1, f.r1, 0, zw, f.color, 'walls', false),
        block(P, f.c0 + 0.6, mid - 0.9, f.c0 + 1.3, mid - 0.3, zw, zt + 8, tone(f.color, 0.7), 'chimney'),
        poly([P(f.c0, f.r1, zw), P(f.c1, f.r1, zw), P(f.c1, mid, zt), P(f.c0, mid, zt)], tone(f.color, 0.5), EDGE, 2, 'roof'),
        poly([P(f.c1, f.r0, zw), P(f.c1, f.r1, zw), P(f.c1, mid, zt)], tone(f.color, 0.62), EDGE, 2, 'gable'),
        front(P, f.r1, cm(f) - 0.35, cm(f) + 0.35, 0, zw * 0.5, WOOD, 'door'),
        front(P, f.r1, f.c0 + 0.5, f.c0 + 1.2, zw * 0.22, zw * 0.5, GLASS, 'wl'),
        front(P, f.r1, f.c1 - 1.2, f.c1 - 0.5, zw * 0.22, zw * 0.5, GLASS, 'wr'),
        side(P, f.c1, f.r0 + 0.8, f.r0 + 1.6, zw * 0.22, zw * 0.55, tone(GLASS, 0.92), 'ws'),
      ];
    },
  },
  /** An office block: rows of windows and an entrance canopy. */
  office: {
    top: f => f.h * 1.6,
    sign: f => ({ c: cm(f), r: f.r1, z: f.h * 1.6 * 0.86 }),
    signStyle: 'board',
    stand: f => ({ c: cm(f), r: rm(f), z: f.h * 1.6 }),
    draw: (P, f) => {
      const T = f.h * 1.6;
      return [
        block(P, f.c0, f.r0, f.c1, f.r1, 0, T, f.color, 'b'),
        ...windows(P, f, T * 0.18, T * 0.76, 4, 4),
        front(P, f.r1, cm(f) - 0.45, cm(f) + 0.45, 0, T * 0.16, GLASS, 'door'),
        block(P, cm(f) - 0.9, f.r1 - 0.2, cm(f) + 0.9, f.r1 + 0.25, T * 0.16, T * 0.19, WHITE, 'canopy'),
        block(P, f.c0 + 0.5, f.r0 + 0.5, f.c0 + 1.5, f.r0 + 1.3, T, T + 12, STONE, 'hvac'),
      ];
    },
  },
  /** A studio: big windows on the front and a sloping roof with a skylight. */
  studio: {
    top: f => f.h * 1.5,
    sign: f => ({ c: cm(f), r: f.r1, z: f.h * 0.95 * 0.86 }),
    signStyle: 'plaque',
    stand: f => ({ c: cm(f), r: rm(f), z: f.h * 1.3 }),
    draw: (P, f) => {
      const zw = f.h * 0.95, T = f.h * 1.5;
      const at = (t: number) => ({ r: f.r1 - (f.r1 - f.r0) * t, z: zw + (T - zw) * t });
      const a = at(0.2), b = at(0.85);
      return [
        front(P, f.r1, f.c0, f.c1, 0, zw, tone(f.color, 0.78), 'front', EDGE, 2),
        poly([P(f.c1, f.r0, 0), P(f.c1, f.r1, 0), P(f.c1, f.r1, zw), P(f.c1, f.r0, T)], tone(f.color, 0.62), EDGE, 2, 'side'),
        poly([P(f.c0, f.r1, zw), P(f.c1, f.r1, zw), P(f.c1, f.r0, T), P(f.c0, f.r0, T)], tone(f.color, 0.9), EDGE, 2, 'roof'),
        poly([P(f.c0 + 0.5, a.r, a.z), P(f.c1 - 0.5, a.r, a.z), P(f.c1 - 0.5, b.r, b.z), P(f.c0 + 0.5, b.r, b.z)], GLASS, EDGE, 1.5, 'sky'),
        front(P, f.r1, f.c0 + 0.3, cm(f) - 0.12, 6, zw * 0.68, GLASS, 'g1'),
        front(P, f.r1, cm(f) + 0.12, f.c1 - 0.3, 6, zw * 0.68, GLASS, 'g2'),
        side(P, f.c1, f.r0 + 0.5, f.r1 - 0.5, zw * 0.2, zw * 0.68, tone(GLASS, 0.92), 'g3'),
      ];
    },
  },
  /** A workshop: a wide bay door and a gear on the roof. */
  workshop: {
    top: f => f.h * 1.4 + 44,
    sign: f => ({ c: cm(f), r: f.r1, z: f.h * 1.4 * 0.82 }),
    signStyle: 'board',
    stand: f => ({ c: cm(f) + 0.8, r: rm(f) + 0.6, z: f.h * 1.4 }),
    draw: (P, f) => {
      const T = f.h * 1.4;
      const [gx, gy] = pt(P(cm(f) - 0.4, rm(f) - 0.4, T));
      const bars = [0.12, 0.24, 0.36].map(t => front(P, f.r1, f.c0 + 0.4, cm(f) + 0.5, T * t, T * t + 2, tone(f.color, 0.35), `bar${t}`, 'none', 0));
      return [
        block(P, f.c0, f.r0, f.c1, f.r1, 0, T, f.color, 'b'),
        front(P, f.r1, f.c0 + 0.4, cm(f) + 0.5, 0, T * 0.48, tone(f.color, 0.5), 'bay'),
        ...bars,
        front(P, f.r1, cm(f) + 0.8, f.c1 - 0.4, T * 0.2, T * 0.48, GLASS, 'win'),
        side(P, f.c1, f.r0 + 0.5, f.r1 - 0.5, T * 0.25, T * 0.55, tone(GLASS, 0.92), 'ws'),
        <polyline key="mast" points={`${gx},${gy} ${gx},${gy - 30}`} stroke={STEEL} strokeWidth={3} />,
        gear(gx, gy - 36, 14, tone(f.color, 0.5)),
      ];
    },
  },
  /** A civic hall: steps, columns, a pediment and a flag. */
  civic: {
    top: f => f.h * 1.25 + 60,
    sign: f => ({ c: cm(f), r: f.r1 - 0.45, z: f.h * 1.25 * 0.72, span: f.c1 - f.c0 - 0.3 }),
    signStyle: 'plaque',
    stand: f => ({ c: cm(f), r: rm(f) - 0.3, z: f.h * 1.25 * 0.8 }),
    draw: (P, f) => {
      const T = f.h * 1.25, zt = T * 0.8, rb = f.r1 - 0.7;
      const cols = Array.from({ length: 5 }, (_, i) => {
        const c = f.c0 + 0.35 + i * ((f.c1 - f.c0 - 0.7) / 4);
        return front(P, rb + 0.25, c - 0.13, c + 0.13, 8, zt - T * 0.12, WHITE, `col${i}`, 'rgba(0,0,0,0.3)', 1);
      });
      const [fx, fy] = pt(P(cm(f) + 0.6, (f.r0 + rb) / 2, zt));
      return [
        block(P, f.c0, rb - 0.1, f.c1, f.r1, 0, 4, STONE, 'step1'),
        block(P, f.c0 + 0.1, rb - 0.1, f.c1 - 0.1, f.r1 - 0.3, 4, 8, STONE, 'step2'),
        block(P, f.c0, f.r0, f.c1, rb, 0, zt, f.color, 'hall'),
        ...windows(P, { ...f, r1: rb }, zt * 0.2, zt * 0.6, 4, 1),
        ...cols,
        front(P, rb + 0.25, f.c0 + 0.15, f.c1 - 0.15, zt - T * 0.12, zt, WHITE, 'beam'),
        poly([P(f.c0 + 0.15, rb + 0.25, zt), P(f.c1 - 0.15, rb + 0.25, zt), P(cm(f), rb + 0.25, zt + T * 0.22)], tone(f.color, 0.95), EDGE, 2, 'pediment'),
        <polyline key="pole" points={`${fx},${fy} ${fx},${fy - 60}`} stroke={STEEL} strokeWidth={3} />,
        <polygon key="flag" points={`${fx},${fy - 60} ${fx + 30},${fy - 54} ${fx},${fy - 44}`} fill={WHITE} stroke={EDGE} strokeWidth={1.5} />,
      ];
    },
  },
  /** A firehouse: two big engine doors and a hose tower. */
  firehouse: {
    top: f => f.h * 1.4 * 1.6,
    sign: f => ({ c: cm(f), r: f.r1, z: f.h * 1.4 * 0.7 }),
    signStyle: 'plaque',
    stand: f => ({ c: cm(f) - 0.5, r: rm(f) + 0.4, z: f.h * 1.4 * 0.85 }),
    draw: (P, f) => {
      const T = f.h * 1.4, zm = T * 0.85;
      const door = (ca: number, cb: number, k: string) => [
        front(P, f.r1, ca, cb, 0, T * 0.55, tone(WHITE, 0.9), k),
        ...[0.14, 0.28, 0.42].map(t => front(P, f.r1, ca + 0.05, cb - 0.05, T * t, T * t + 2, tone(WHITE, 0.6), `${k}${t}`, 'none', 0)),
      ];
      return [
        block(P, f.c0, f.r0, f.c1, f.r1, 0, zm, f.color, 'hall'),
        block(P, f.c1 - 1.2, f.r0, f.c1, f.r0 + 1.2, zm, T * 1.6, tone(f.color, 0.85), 'tower'),
        ...door(f.c0 + 0.3, cm(f) - 0.1, 'd1'),
        ...door(cm(f) + 0.1, f.c1 - 0.3, 'd2'),
        side(P, f.c1, f.r0 + 1.5, f.r1 - 0.5, T * 0.3, T * 0.6, tone(GLASS, 0.92), 'ws'),
      ];
    },
  },
  /** A bank: steps, a row of columns and a pediment. */
  bank: {
    top: f => f.h * 1.9 * 1.15,
    sign: f => ({ c: cm(f), r: f.r1 - 0.25, z: f.h * 1.9 * 0.74, span: f.c1 - f.c0 - 0.3 }),
    signStyle: 'board',
    stand: f => ({ c: cm(f), r: rm(f) - 0.3, z: f.h * 1.9 * 0.8 }),
    draw: (P, f) => {
      const T = f.h * 1.9, zt = T * 0.8, rb = f.r1 - 0.5;
      const cols = Array.from({ length: 4 }, (_, i) => {
        const c = f.c0 + 0.45 + i * ((f.c1 - f.c0 - 0.9) / 3);
        return front(P, rb + 0.25, c - 0.16, c + 0.16, 6, T * 0.66, WHITE, `col${i}`, 'rgba(0,0,0,0.3)', 1);
      });
      return [
        block(P, f.c0, rb - 0.1, f.c1, f.r1, 0, 6, STONE, 'steps'),
        block(P, f.c0, f.r0, f.c1, rb, 0, zt, f.color, 'hall'),
        ...cols,
        front(P, rb + 0.25, f.c0 + 0.15, f.c1 - 0.15, T * 0.66, zt, WHITE, 'beam'),
        poly([P(f.c0 + 0.15, rb + 0.25, zt), P(f.c1 - 0.15, rb + 0.25, zt), P(cm(f), rb + 0.25, T * 1.15)], tone(f.color, 0.95), EDGE, 2, 'pediment'),
      ];
    },
  },
  /** A tall glass tower. */
  tower: {
    top: f => f.h * 3.6 + 24,
    sign: f => ({ c: cm(f), r: f.r1 - 0.3, z: f.h * 3.6 * 0.88, span: f.c1 - f.c0 - 0.8 }),
    signStyle: 'board',
    stand: f => ({ c: cm(f), r: rm(f), z: f.h * 3.6 }),
    draw: (P, f) => {
      const T = f.h * 3.6, a = f.c0 + 0.4, b = f.c1 - 0.4, r0 = f.r0 + 0.3, r1 = f.r1 - 0.3;
      const bands: React.ReactNode[] = [];
      for (let z = 14; z < T - 10; z += 16) {
        bands.push(front(P, r1, a + 0.1, b - 0.1, z, z + 9, GLASS, `gf${z}`, 'none', 0));
        bands.push(side(P, b, r0 + 0.1, r1 - 0.1, z, z + 9, tone(GLASS, 0.9), `gs${z}`, 'none', 0));
      }
      const [sx, sy] = pt(P((a + b) / 2, (r0 + r1) / 2, T));
      return [
        block(P, a, r0, b, r1, 0, T, f.color, 'b'),
        ...bands,
        <polyline key="spire" points={`${sx},${sy} ${sx},${sy - 24}`} stroke={STEEL} strokeWidth={3} />,
      ];
    },
  },
  /** A small stage with a ribbon between two posts, and bunting. */
  stage: {
    top: () => 110,
    sign: f => ({ c: cm(f), r: f.r1 - 0.4, z: 92, span: f.c1 - f.c0 - 0.9 }),
    signStyle: 'banner',
    stand: f => ({ c: cm(f), r: rm(f) - 0.3, z: 12 }),
    draw: (P, f) => {
      const a = f.c0 + 0.45, b = f.c1 - 0.45, r = f.r1 - 0.4;
      const [ax, ay] = pt(P(a, r, 58)), [bx, by] = pt(P(b, r, 58));
      const flags = Array.from({ length: 5 }, (_, i) => {
        const [x, y] = pt(P(f.c0 + 0.5 + i * ((f.c1 - f.c0 - 1) / 4), f.r0 + 0.3, 70));
        return <polygon key={`fl${i}`} points={`${x - 7},${y} ${x + 7},${y} ${x},${y + 13}`} fill={i % 2 ? WHITE : tone(f.color, 0.5)} />;
      });
      const [s0x, s0y] = pt(P(f.c0 + 0.3, f.r0 + 0.3, 72)), [s1x, s1y] = pt(P(f.c1 - 0.3, f.r0 + 0.3, 72));
      return [
        poly([P(f.c0, f.r0, 0), P(f.c1, f.r0, 0), P(f.c1, f.r1, 0), P(f.c0, f.r1, 0)], tone(f.color, 1.05), tone(f.color, 0.6), 2, 'lot'),
        block(P, f.c0 + 0.2, f.r0 + 0.2, f.c1 - 0.2, f.r1 - 0.6, 0, 12, tone(f.color, 0.8), 'deck'),
        <polyline key="string" points={`${s0x},${s0y} ${s1x},${s1y}`} stroke={STEEL} strokeWidth={1.5} />,
        ...flags,
        <polyline key="p1" points={`${P(a, r, 0)} ${P(a, r, 108)}`} stroke={STEEL} strokeWidth={5} />,
        <polyline key="p2" points={`${P(b, r, 0)} ${P(b, r, 108)}`} stroke={STEEL} strokeWidth={5} />,
        <path key="ribbon" d={`M${ax},${ay} Q${(ax + bx) / 2},${(ay + by) / 2 + 22} ${bx},${by}`} fill="none" stroke={tone(f.color, 0.45)} strokeWidth={7} />,
      ];
    },
  },
  /** A site trailer on blocks, with wheels and steps. */
  trailer: {
    top: f => f.h * 1.6,
    // on its far (right) wall, so it never runs over the sign of the lot it stands on
    sign: f => ({ c: f.c1, r: rm(f), z: f.h * 1.6 * 0.62, span: f.r1 - f.r0, side: true }),
    signStyle: 'board',
    stand: f => ({ c: cm(f), r: rm(f), z: f.h * 1.6 }),
    draw: (P, f) => {
      const T = f.h * 1.6;
      const [w1x, w1y] = pt(P(f.c0 + 0.5, f.r1, 7)), [w2x, w2y] = pt(P(f.c0 + 1.1, f.r1, 7));
      return [
        block(P, f.c0, f.r0, f.c1, f.r1, 9, T, f.color, 'b'),
        front(P, f.r1, f.c1 - 0.55, f.c1 - 0.15, 9, T * 0.8, WOOD, 'door'),
        block(P, f.c1 - 0.6, f.r1, f.c1 - 0.1, f.r1 + 0.35, 0, 6, STONE, 'step'),
        side(P, f.c1, f.r0 + 0.3, f.r1 - 0.3, T * 0.45, T * 0.75, tone(GLASS, 0.92), 'ws'),
        <circle key="wh1" cx={w1x} cy={w1y} r={6} fill={DARK} />,
        <circle key="wh2" cx={w2x} cy={w2y} r={6} fill={DARK} />,
      ];
    },
  },
  /** A building site for a renovation: an old shell in scaffolding behind a site fence. */
  site_reno: {
    top: () => 96,
    // on the lot's left fence, the end its trailer never stands at
    sign: f => ({ c: f.c0, r: rm(f), z: 34, span: (f.r1 - f.r0) * 0.7, side: true }),
    signStyle: 'banner',
    stand: f => ({ c: f.c0 + (f.c1 - f.c0) * 0.3, r: rm(f), z: 0 }),
    draw: (P, f) => {
      const a = f.c0 + 0.3, b = cm(f) + 0.3, r0 = f.r0 + 0.3, r1 = rm(f) + 0.2;
      const poles: React.ReactNode[] = [];
      for (let c = a; c <= b + 0.01; c += 0.55) poles.push(<polyline key={`sp${c}`} points={`${P(c, r1 + 0.3, 0)} ${P(c, r1 + 0.3, 86)}`} stroke={STEEL} strokeWidth={2.5} />);
      for (let z = 20; z <= 86; z += 22) poles.push(<polyline key={`sz${z}`} points={`${P(a, r1 + 0.3, z)} ${P(b, r1 + 0.3, z)}`} stroke={STEEL} strokeWidth={2.5} />);
      return [
        poly([P(f.c0, f.r0, 0), P(f.c1, f.r0, 0), P(f.c1, f.r1, 0), P(f.c0, f.r1, 0)], f.color, tone(f.color, 0.6), 3, 'lot'),
        block(P, a, r0, b, r1, 0, 76, STONE, 'shell'),
        ...windows(P, { c0: a, r0, c1: b, r1, h: 76, color: STONE }, 6, 70, 3, 3, DARK, 'hole'),
        ...poles,
        fence(P, f),
      ];
    },
  },
  /** A site for a new building: a dug foundation and a crane behind a site fence. */
  site_new: {
    top: () => 176,
    // on the lot's left fence, the end its trailer never stands at
    sign: f => ({ c: f.c0, r: rm(f), z: 34, span: (f.r1 - f.r0) * 0.7, side: true }),
    signStyle: 'banner',
    stand: f => ({ c: f.c0 + (f.c1 - f.c0) * 0.3, r: rm(f), z: 0 }),
    draw: (P, f) => {
      const [mx, my] = pt(P(f.c0 + 0.7, f.r0 + 0.7, 0)), [tx, ty] = pt(P(f.c0 + 0.7, f.r0 + 0.7, 166));
      const [jx, jy] = pt(P(f.c0 + 4.2, f.r0 + 0.7, 166)), [kx, ky] = pt(P(f.c0 - 0.6, f.r0 + 0.7, 166));
      const hookX = tx + (jx - tx) * 0.7, hookY = ty + (jy - ty) * 0.7;
      const lattice: React.ReactNode[] = [];
      for (let z = 0; z < 160; z += 20) {
        const [x0, y0] = pt(P(f.c0 + 0.7, f.r0 + 0.7, z)), [x1, y1] = pt(P(f.c0 + 0.7, f.r0 + 0.7, z + 20));
        lattice.push(<polyline key={`lt${z}`} points={`${x0 - 6},${y0} ${x1 + 6},${y1}`} stroke={STEEL} strokeWidth={1.5} />);
      }
      return [
        poly([P(f.c0, f.r0, 0), P(f.c1, f.r0, 0), P(f.c1, f.r1, 0), P(f.c0, f.r1, 0)], f.color, tone(f.color, 0.6), 3, 'lot'),
        poly([P(f.c0 + 0.5, f.r0 + 1.4, 0), P(cm(f) + 0.4, f.r0 + 1.4, 0), P(cm(f) + 0.4, rm(f) + 0.8, 0), P(f.c0 + 0.5, rm(f) + 0.8, 0)], tone(f.color, 0.62), EDGE, 1.5, 'pit'),
        block(P, f.c0 + 0.8, f.r0 + 1.7, cm(f) + 0.1, rm(f) + 0.5, 0, 8, STONE, 'slab'),
        <polyline key="m1" points={`${mx - 6},${my} ${tx - 6},${ty}`} stroke={STEEL} strokeWidth={3} />,
        <polyline key="m2" points={`${mx + 6},${my} ${tx + 6},${ty}`} stroke={STEEL} strokeWidth={3} />,
        ...lattice,
        <polyline key="jib" points={`${kx},${ky} ${jx},${jy}`} stroke={STEEL} strokeWidth={4} />,
        <polyline key="hook" points={`${hookX},${hookY} ${hookX},${hookY + 50}`} stroke={STEEL} strokeWidth={1.5} />,
        <rect key="weight" x={kx - 6} y={ky - 4} width={14} height={12} fill={DARK} />,
        fence(P, f),
      ];
    },
  },
};

/** The look for a name from the data; anything unknown is a plain block. */
export function lookFor(name: string | undefined): Look {
  return (name && LOOKS[name]) || LOOKS.box;
}

// -------------------------------------------------------------------------------------------------
// The name sign's size and place, worked out here (not left to the browser) so the board draws every sign at this
// width and a test can check that no two signs ever overlap, at any pose of the turning table.
// -------------------------------------------------------------------------------------------------

/** The sign's letter size before the town's sign scale (`round_sign_scale`). */
export const SIGN_FONT = 22;
/** How wide one letter of a sign's bold type is, against its size (a little over the real 0.58, to be safe). */
const LETTER = 0.62;
/** The front walls slope at this angle on screen (the town is drawn at 2:1). */
export const FACE_SLOPE = (Math.atan(0.5) * 180) / Math.PI;

export interface SignBox {
  /** The middle of the sign, board px. */
  x: number;
  y: number;
  /** Width and height before it is slanted along its wall. */
  w: number;
  h: number;
  font: number;
  /** +1: along the front wall, -1: along a side wall. */
  slant: 1 | -1;
}

/**
 * A sign's box: at least as wide as its wall, stretching up to a third past it (and to the longest word) so the name
 * takes two lines at most; `extraLines` leaves room for a row of room choices under the name.
 */
export function signBox(look: Look, f: Foot, name: string, scale: number, tile: number, iso: (c: number, r: number, z: number, t: number) => { x: number; y: number }, extraLines = 0): SignBox {
  const s = look.sign(f);
  const font = SIGN_FONT * scale * (look.signSize ?? 1);
  const pad = 7 * scale;
  const wall = (s.span ?? (f.c1 - f.c0)) * tile * Math.hypot(1, 0.5);
  const words = name.split(/\s+/).filter(Boolean);
  const wordW = (w: string) => w.length * font * LETTER;
  const longest = Math.max(0, ...words.map(wordW));
  const w = Math.max(wall, Math.min(Math.max(wall * 1.34, longest + 2 * pad), wordW(name) + 2 * pad));
  let lines = 0, line = 0;
  for (const word of words) {
    const add = (line ? font * LETTER : 0) + wordW(word);
    if (line && line + add > w - 2 * pad) { lines++; line = wordW(word); } else line += add;
  }
  if (line || lines === 0) lines++;
  const h = (lines + extraLines * 0.75) * font * 1.05 + 6 * scale + 4 * scale;
  const p = iso(s.c, s.r, s.z, tile);
  return { x: p.x, y: p.y, w, h, font, slant: s.side ? -1 : 1 };
}

/** The sign's four corners on screen, slanted along its wall. */
export function signCorners(b: SignBox): Array<[number, number]> {
  const t = Math.tan((FACE_SLOPE * Math.PI) / 180) * b.slant;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const dx = (sx * b.w) / 2, dy = (sy * b.h) / 2;
    return [b.x + dx, b.y + dy + dx * t] as [number, number];
  });
}

/** Whether two convex shapes (corner lists) overlap, by the separating-axis test; `gap` px of air counts as touching. */
export function shapesOverlap(a: Array<[number, number]>, b: Array<[number, number]>, gap = 0): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y1 - y2, ny = x2 - x1, len = Math.hypot(nx, ny) || 1;
      const proj = (q: Array<[number, number]>) => q.map(([x, y]) => (x * nx + y * ny) / len);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) + gap <= Math.min(...pb) || Math.max(...pb) + gap <= Math.min(...pa)) return false;
    }
  }
  return true;
}

type Spot = { c: number; r: number; z: number; span?: number; side?: boolean };

/** A sign's second spot, used when its first would cross a sign already placed: the other wall it can hang on. */
export function altSign(look: Look, f: Foot): Spot {
  const s = look.sign(f);
  return s.side
    ? { c: f.c0 + (f.c1 - f.c0) * 0.35, r: f.r1, z: s.z, span: (f.c1 - f.c0) * 0.6 }
    : { c: f.c1, r: (f.r0 + f.r1) / 2, z: s.z, span: f.r1 - f.r0, side: true };
}

/** The spots a sign may take, best first: its own, its other wall, then each of those raised up the building. */
export const SIGN_SPOTS = 4;
export function signSpot(look: Look, f: Foot, spot: number): Spot {
  const base = spot % 2 === 0 ? look.sign(f) : altSign(look, f);
  if (spot < 2) return base;
  const top = look.top(f);
  return { ...base, z: Math.min(top + 30, base.z + Math.max(50, top * 0.4)) };
}

export interface SignItem {
  id: string;
  look: Look;
  foot: Foot;
  name: string;
  /** Room for a row of room choices under the name (when the building is a move choice). */
  extraLines: number;
  /** Placed first (the shared ring); the rest go by width, widest first. */
  first?: boolean;
}

/**
 * Where each sign goes at one pose of the town: every sign takes its own spot unless that crosses a sign placed before
 * it, then its other wall. Returns the spot (0 = own, 1 = other wall) and the box of every sign.
 */
export function placeSigns(items: SignItem[], scale: number, tile: number, iso: (c: number, r: number, z: number, t: number) => { x: number; y: number }): Map<string, { spot: number; box: SignBox }> {
  const boxOf = (it: SignItem, spot: number) => signBox({ ...it.look, sign: (f: Foot) => signSpot(it.look, f, spot) }, it.foot, it.name, scale, tile, iso, it.extraLines);
  const order = [...items].sort((a, b) => Number(!!b.first) - Number(!!a.first) || boxOf(b, 0).w - boxOf(a, 0).w);
  const out = new Map<string, { spot: number; box: SignBox }>();
  const placedIds: string[] = [];
  const hits = (box: SignBox, skip?: string) => placedIds.filter(id => id !== skip && shapesOverlap(signCorners(out.get(id)!.box), signCorners(box), 4));
  for (const it of order) {
    const cands = Array.from({ length: SIGN_SPOTS }, (_, spot) => ({ spot, box: boxOf(it, spot) }));
    let pick = cands.find(c => hits(c.box).length === 0) ?? cands[0];
    if (hits(pick.box).length > 0) {
      // No free spot: if one sign is in the way of a spot, move that sign to another of its spots when that clears both.
      search: for (const cand of cands) {
        const block = hits(cand.box);
        if (block.length !== 1) continue;
        const was = out.get(block[0])!;
        const blocker = order.find(x => x.id === block[0])!;
        for (let spot = 0; spot < SIGN_SPOTS; spot++) {
          if (spot === was.spot) continue;
          const moved = { spot, box: boxOf(blocker, spot) };
          out.set(block[0], moved);
          if (hits(moved.box, block[0]).length === 0 && !shapesOverlap(signCorners(moved.box), signCorners(cand.box), 4)) { pick = cand; break search; }
        }
        out.set(block[0], was);
      }
    }
    placedIds.push(it.id);
    out.set(it.id, pick);
  }
  return out;
}
