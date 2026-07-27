// src/components/icons/LogoTransform.tsx
//
// A small looping animation of a loose thread winding itself into a yarn
// ball — the "Unravel" half of the brand mark (public/images/logo.png, whose
// own in-code comment already describes it as "the yarn ball unraveling
// into the 'NYC Codes' book"), brought to life as a real page animation
// instead of a static image. Pure SVG + CSS, no external assets or
// generated media — renders identically everywhere the static logo does.
//
// How it works: a single spiral path (pre-computed, not path-morphing,
// which needs matching point counts and gets expensive to keep in sync) is
// drawn with a dash array equal to its own length, then the dash offset is
// animated from "fully hidden" to "fully revealed." A stroke revealing
// itself from the center outward along a spiral reads as thread winding
// into a ball; run in reverse (or just let the loop restart) it reads as
// unraveling — either direction matches "Unravel Codes."

import React, { useMemo } from 'react';

export interface LogoTransformProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  /** Brand ring/thread color. Defaults to the logo's dark forest green. */
  threadColor?: string;
  /** Badge background. Defaults to the logo's cream. */
  bgColor?: string;
}

/** Archimedean spiral points, center (100,100), computed once at module load. */
function buildSpiralPath(): string {
  const turns = 3.1;
  const steps = 160;
  const centerR = 6;
  const growth = 12.5;
  const cx = 100;
  const cy = 100;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * turns * Math.PI * 2;
    const r = centerR + growth * theta / (Math.PI * 2);
    points.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
  }
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

const SPIRAL_D = buildSpiralPath();

export function LogoTransform({
  size = 64,
  className,
  style,
  threadColor = '#1b4332',
  bgColor = '#f3e9db',
}: LogoTransformProps): JSX.Element {
  // Rough path length for an Archimedean spiral of this shape — used as the
  // dasharray/dashoffset unit. Doesn't need to be exact, just large enough
  // that "fully hidden" truly hides the whole path and small enough the
  // animation doesn't sit at "fully revealed" for a visibly long pause.
  const pathLength = useMemo(() => 620, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      role="img"
      aria-label="Unravel Codes logo animation: a thread winding into a yarn ball"
    >
      <style>{`
        @keyframes us-logo-wind {
          0%   { stroke-dashoffset: ${pathLength}; }
          70%  { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes us-logo-fade-restart {
          0%, 88% { opacity: 1; }
          94%     { opacity: 0; }
          100%    { opacity: 1; }
        }
        .us-logo-spiral {
          stroke-dasharray: ${pathLength};
          animation: us-logo-wind 4.2s cubic-bezier(0.45, 0, 0.2, 1) infinite,
                     us-logo-fade-restart 4.2s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .us-logo-spiral { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>

      <circle cx="100" cy="100" r="94" fill={bgColor} stroke={threadColor} strokeWidth="5" />
      <path
        className="us-logo-spiral"
        d={SPIRAL_D}
        fill="none"
        stroke={threadColor}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
