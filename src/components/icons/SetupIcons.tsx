// src/components/icons/SetupIcons.tsx
//
// A small hand-drawn icon set for the game-setup screen, replacing raw emoji
// characters. Emoji render as completely different glyphs per OS/browser
// (Windows, iOS, Android, Chromecast/Tizen/webOS smart-TV browsers all ship
// their own emoji font, and some smart-TV browsers fall back to a blank box
// or the wrong character entirely) — this project's setup screen targets all
// of those. These icons are plain inline SVG instead: identical pixels
// everywhere, and they inherit `currentColor` so they automatically match
// whatever text color they're dropped into (white on the header's gradient,
// dark on light panels) without per-usage color props.

import React from 'react';

export interface IconProps {
  size?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

const base: React.CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  flexShrink: 0,
};

function Svg({
  size = '1em',
  style,
  className,
  children,
  viewBox = '0 0 24 24',
}: IconProps & { children: React.ReactNode; viewBox?: string }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...base, ...style }}
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Replaces ✓ (sync status: in-sync) */
export function IconCheck(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 12.5L9.5 18L20 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Replaces ⚠ (sync status: behind / validation warning) */
export function IconWarning(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3.5L22 20.5H2L12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1.15" fill="currentColor" />
    </Svg>
  );
}

/** Replaces ⚙️ (settings gear button) — a ring with 8 square teeth, not
 * thin radiating lines (an earlier version of this read as a sun/star). */
export function IconGear(props: IconProps): JSX.Element {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="3.2" fill="none" />
      {teeth.map((deg) => (
        <rect key={deg} x="10.6" y="1.6" width="2.8" height="3.4" rx="0.5" fill="currentColor" transform={`rotate(${deg} 12 12)`} />
      ))}
    </Svg>
  );
}

/** Replaces 🌗 (light/dark theme toggle — a crescent moon, the standard
 * convention for this control) */
export function IconMoon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M20.5 14.8A9 9 0 1 1 10.2 3.5 7 7 0 0 0 20.5 14.8Z"
        fill="currentColor"
      />
    </Svg>
  );
}

/** Pairs with IconMoon for a light/dark toggle that shows the mode you'd switch TO */
export function IconSun(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.3" fill="currentColor" />
      <path
        d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Replaces 📋 (Rules button) */
export function IconClipboard(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5" y="4" width="14" height="17" rx="1.8" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" fill="currentColor" />
      <line x1="7.5" y1="10" x2="16.5" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="13.5" x2="16.5" y2="13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces 🗒️ (Log button) */
export function IconNotepad(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="4.5" y="3" width="15" height="18" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <line x1="7.5" y1="8" x2="16.5" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="11.5" x2="16.5" y2="11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="15" x2="13" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces 📖 (Glossary button) */
export function IconBookOpen(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 5.5c-1.8-1.4-4.4-2-7-2v14c2.6 0 5.2.6 7 2 1.8-1.4 4.4-2 7-2v-14c-2.6 0-5.2.6-7 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="12" y1="5.5" x2="12" y2="19.5" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

/** Replaces 👥 (Players section heading) */
export function IconPeople(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth="2" />
      <path d="M3.2 19.5c0-3.3 2.6-5.7 5.8-5.7s5.8 2.4 5.8 5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.6" cy="8.6" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.9 14.3c2.6.3 4.4 2.3 4.5 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces 📱 (phone / waiting-for-phones) */
export function IconPhone(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="currentColor" strokeWidth="2" />
      <line x1="10" y1="18.2" x2="14" y2="18.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces 🚀 (Start Game button) */
export function IconPlay(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6 4.2v15.6c0 .8.9 1.3 1.6.9l13-7.8c.7-.4.7-1.4 0-1.8l-13-7.8C6.9 2.9 6 3.4 6 4.2Z" fill="currentColor" />
    </Svg>
  );
}

/** Replaces ✕ (drawer close button) */
export function IconClose(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M5 5L19 19M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces 🐞 (footer bug-report link) */
export function IconBug(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="13.5" rx="5.5" ry="6.5" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="19.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 9.5L3 7M17.5 9.5L21 7M6.5 13.5H2.5M17.5 13.5H21.5M6.5 17.5L3 20M17.5 17.5L21 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 6.2c.6-1.4 1.8-2.2 3-2.2s2.4.8 3 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces 🖥️ (PC mode tile) */
export function IconDesktop(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <line x1="8.5" y1="20.3" x2="15.5" y2="20.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="16.5" x2="12" y2="20.3" stroke="currentColor" strokeWidth="2" />
    </Svg>
  );
}

/** Replaces 📺 (TV mode tile) */
export function IconTV(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2" y="5.5" width="20" height="13.5" rx="1.8" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 2.5L12 5.5L15 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Replaces 🌐 (Remote mode tile) */
export function IconGlobe(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="12" cy="12" rx="3.6" ry="9" stroke="currentColor" strokeWidth="1.6" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 7.2h15M4.5 16.8h15" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

/** Replaces 🎮 ("Game Setup" panel heading) */
export function IconController(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M6.5 8h11a4 4 0 0 1 3.9 4.9l-.9 3.7a2.6 2.6 0 0 1-4.6 1L14.5 16h-5l-1.4 1.6a2.6 2.6 0 0 1-4.6-1l-.9-3.7A4 4 0 0 1 6.5 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="7.2" y1="12.2" x2="7.2" y2="14.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <line x1="6" y1="13.4" x2="8.4" y2="13.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.6" cy="12" r="0.9" fill="currentColor" />
      <circle cx="14.4" cy="14.2" r="0.9" fill="currentColor" />
    </Svg>
  );
}

/** Replaces 👁️ ("Just watching" spectator option) */
export function IconEye(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M2 12S5.5 5.5 12 5.5 22 12 22 12 18.5 18.5 12 18.5 2 12 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="2" />
    </Svg>
  );
}

/** Replaces 🏫 (classroom badge) */
export function IconSchool(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3L21 8L12 13L3 8L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6.5 10.3v5.1c0 1.3 2.5 2.4 5.5 2.4s5.5-1.1 5.5-2.4v-5.1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M21 8v6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/** Replaces ⏳ ("Starting…" button state) */
export function IconHourglass(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6 3h12M6 21h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 3c0 4 3.2 5.5 5 6.5V9C10.2 8 7 6.5 7 3ZM17 3c0 4-3.2 5.5-5 6.5V9c1.8-1 5-2.5 5-6.5ZM7 21c0-4 3.2-5.5 5-6.5V15c1.8 1 5 2.5 5 6.5"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}
