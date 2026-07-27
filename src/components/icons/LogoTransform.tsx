// src/components/icons/LogoTransform.tsx
//
// An animated take on the actual brand mark (public/images/logo.png): a
// yarn ball connected by a thread to the "NYC Codes" book. The ball and
// book are drawn as fixed, recognizable shapes — matching the real logo,
// not an abstraction of it — and only the connecting thread animates, as a
// continuous "marching" flow between the two, suggesting the thread being
// wound up (or paid out) between them. Pure SVG + CSS, no external assets.

import React from 'react';

export interface LogoTransformProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

const GREEN = '#123020';
const GREEN_DARK = '#0c2418';
const CREAM = '#f3ecde';
const YARN = '#d3ab63';
const YARN_SHADE = '#b98f45';
const YARN_HILITE = '#e9cf9c';

export function LogoTransform({ size = 64, className, style }: LogoTransformProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      role="img"
      aria-label="Unravel Codes logo: a yarn ball unraveling into the NYC Codes book"
    >
      <style>{`
        @keyframes us-logo-thread-flow {
          to { stroke-dashoffset: -24; }
        }
        .us-logo-thread {
          stroke-dasharray: 5 7;
          animation: us-logo-thread-flow 1.1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .us-logo-thread { animation: none; }
        }
      `}</style>

      {/* Circular badge, matching the real logo's frame */}
      <circle cx="100" cy="100" r="94" fill={CREAM} stroke={GREEN} strokeWidth="5" />

      {/* Thread connecting ball to book — the only animated part */}
      <path
        className="us-logo-thread"
        d="M96,118 C88,132 70,138 62,150 C56,159 62,168 74,166"
        fill="none"
        stroke={GREEN}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Yarn ball */}
      <g>
        <circle cx="66" cy="92" r="34" fill={YARN} stroke={YARN_SHADE} strokeWidth="1.5" />
        {/* wound-yarn ridge lines */}
        <path d="M36 84c14-14 34-16 50-4" fill="none" stroke={YARN_SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.75" />
        <path d="M33 98c16-6 36-2 48 10" fill="none" stroke={YARN_SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.75" />
        <path d="M40 68c10 12 12 30 4 46" fill="none" stroke={YARN_SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <path d="M60 60c14 6 22 22 18 38" fill="none" stroke={YARN_SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <ellipse cx="55" cy="80" rx="10" ry="6" fill={YARN_HILITE} opacity="0.55" />
      </g>

      {/* Book — closed cover with a fanned page edge, tilted to match the
          real mark's propped-open angle */}
      <g transform="rotate(8 148 108)">
        <path d="M126 76h30c5 0 8 3 8 8v56c0 5-3 8-8 8h-30V76Z" fill={GREEN} />
        <path d="M164 78c5 1 8 4 8 9v54c0 5-3 8-7 9l-1-72Z" fill={GREEN_DARK} />
        {/* fanned pages peeking from the top */}
        <path d="M132 76l4-9 4 9M141 76l4-10 4 10M150 76l4-10 4 10" fill="none" stroke={CREAM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
