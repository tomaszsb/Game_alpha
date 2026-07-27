// src/components/icons/LogoTransform.tsx
//
// An animated take on the actual brand mark (public/images/logo.png): a
// yarn ball connected by a thread to the "NYC Codes" book. Built in the
// same flat-color, hard-edged "pixel art" style as AvatarIcons.tsx (a grid
// of rects, crisp edges, dithered shading bands instead of smooth
// gradients) rather than smooth vector curves — a first pass in plain
// curves read as generic/flat next to the real logo's rendered depth; the
// pixel-grid shading gives it more texture without needing raster assets.
// Only the connecting thread animates (a marching-dash flow); the ball and
// book stay fixed and recognizable.

import React from 'react';

export interface LogoTransformProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

type Block = [x: number, y: number, w: number, h: number, color: string];

const GRID = 32;

const GREEN = '#123020';
const GREEN_DARK = '#0a1c13';
const GREEN_LIGHT = '#1e4a30';
const CREAM = '#f3ecde';
const YARN = '#d3ab63';
const YARN_LIGHT = '#e9cf9c';
const YARN_MID = '#c19752';
const YARN_DARK = '#a67c3f';

// Yarn ball: a filled circle mask approximated on the pixel grid, built as
// horizontal spans per row (classic circle-rasterization-by-hand), with
// three dithered shade bands (light/mid/dark) instead of a smooth radial
// gradient — same technique as shading a sphere in low-res pixel art.
const ballRows: Array<[y: number, x0: number, x1: number, shade: 0 | 1 | 2]> = [
  [4, 8, 12, 0], [4, 12, 15, 1],
  [5, 6, 9, 0], [5, 9, 14, 1], [5, 14, 16, 2],
  [6, 5, 8, 0], [6, 8, 15, 1], [6, 15, 17, 2],
  [7, 4, 7, 0], [7, 7, 16, 1], [7, 16, 18, 2],
  [8, 4, 7, 0], [8, 7, 16, 1], [8, 16, 18, 2],
  [9, 3, 7, 0], [9, 7, 16, 1], [9, 16, 18, 2],
  [10, 3, 7, 0], [10, 7, 16, 1], [10, 16, 18, 2],
  [11, 3, 7, 0], [11, 7, 16, 1], [11, 16, 18, 2],
  [12, 3, 7, 0], [12, 7, 16, 1], [12, 16, 18, 2],
  [13, 4, 7, 0], [13, 7, 16, 1], [13, 16, 18, 2],
  [14, 4, 7, 0], [14, 7, 15, 1], [14, 15, 18, 2],
  [15, 5, 8, 0], [15, 8, 15, 1], [15, 15, 17, 2],
  [16, 6, 9, 0], [16, 9, 14, 1], [16, 14, 16, 2],
  [17, 8, 12, 1], [17, 12, 15, 2],
];
const SHADE_COLORS = [YARN_LIGHT, YARN, YARN_DARK] as const;

function ballBlocks(): Block[] {
  return ballRows.map(([y, x0, x1, shade]) => [x0, y, x1 - x0, 1, SHADE_COLORS[shade]] as Block);
}
// A few short ridge lines (wound-yarn texture) drawn on top, darker.
const ridges: Block[] = [
  [5, 8, 5, 1, YARN_MID], [9, 5, 6, 1, YARN_MID], [12, 6, 6, 1, YARN_MID],
  [8, 12, 4, 1, YARN_MID], [11, 13, 3, 1, YARN_MID], [14, 9, 5, 1, YARN_MID],
];

// Book: a blocky closed cover with a fanned page edge, built from a small
// number of rects rather than curves.
const bookBlocks: Block[] = [
  [21, 8, 8, 15, GREEN],
  [27, 9, 2, 14, GREEN_DARK],
  [21, 8, 8, 1, GREEN_LIGHT], // top highlight strip
  // fanned pages
  [22, 6, 1, 3, CREAM], [24, 5, 1, 4, CREAM], [26, 6, 1, 3, CREAM],
];

const THREAD_D = 'M17,20 C14,23 9,24 7,27 C5,30 8,32 11,31';

function renderBlocks(blocks: Block[], keyPrefix: string): JSX.Element[] {
  return blocks.map(([x, y, w, h, color], i) => (
    <rect key={`${keyPrefix}${i}`} x={x} y={y} width={w} height={h} fill={color} />
  ));
}

export function LogoTransform({ size = 64, className, style }: LogoTransformProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Unravel Codes logo: a yarn ball connected to the NYC Codes book"
    >
      <style>{`
        @keyframes us-logo-thread-flow {
          to { stroke-dashoffset: -20; }
        }
        .us-logo-thread {
          stroke-dasharray: 4 5;
          shape-rendering: geometricPrecision;
          animation: us-logo-thread-flow 1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .us-logo-thread { animation: none; }
        }
      `}</style>

      {/* Square-cornered badge, matching the flat-pixel style (the real
          logo's circular frame doesn't read cleanly at low pixel-grid
          resolution, so this simplifies to a rounded-square badge). */}
      <rect x="0.5" y="0.5" width={GRID - 1} height={GRID - 1} rx="4" fill={CREAM} stroke={GREEN} strokeWidth="1.4" />

      {/* Thread — the only animated element */}
      <path
        className="us-logo-thread"
        d={THREAD_D}
        fill="none"
        stroke={GREEN}
        strokeWidth="1.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {renderBlocks(ballBlocks(), 'ball')}
      {renderBlocks(ridges, 'ridge')}
      {renderBlocks(bookBlocks, 'book')}
    </svg>
  );
}
