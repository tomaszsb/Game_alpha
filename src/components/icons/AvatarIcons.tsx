// src/components/icons/AvatarIcons.tsx
//
// Custom replacements for AVAILABLE_AVATARS (usePlayerValidation.ts) — the
// same cross-platform emoji problem as SetupIcons.tsx, applied to player
// avatars. Built as flat-color, hard-edged "pixel art" style sprites (a
// small grid of rectangles, crisp edges, no gradients/anti-aliasing) rather
// than thin-line icons — a first pass using a shared silhouette + a small
// corner badge read as too similar at a glance; this version gives each
// avatar its own hair/hat silhouette AND a bold, distinct clothing color,
// plus a bigger held accessory instead of a tiny badge.
//
// player.avatar itself is UNCHANGED — still the raw emoji string from
// AVAILABLE_AVATARS, still what's compared/validated/persisted everywhere.
// getAvatarIcon() only maps that stored string to a matching icon at
// render time, so no data migration is needed anywhere in the game.

import React from 'react';

export interface AvatarIconProps {
  size?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

type Block = [x: number, y: number, w: number, h: number, color: string];

const GRID = 16;

function Sprite({
  size = '1em',
  style,
  className,
  blocks,
}: AvatarIconProps & { blocks: Block[] }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {blocks.map(([x, y, w, h, color], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
      ))}
    </svg>
  );
}

// ---- Shared palette ----
const SKIN = '#e3ac7a';
const EYE = '#22201c';

// ---- Shared face block (same for everyone — differentiation comes from
// hair silhouette, clothing color, and accessory, not facial detail) ----
const face: Block[] = [
  [5, 3, 6, 5, SKIN],   // face
  [6, 6, 1, 1, EYE],    // left eye
  [9, 6, 1, 1, EYE],    // right eye
];

// ---- Hair / headwear silhouettes ----
function hairShort(color: string): Block[] {
  return [
    [4, 1, 8, 2, color],
    [4, 3, 1, 3, color],
    [11, 3, 1, 3, color],
  ];
}
function hairLong(color: string): Block[] {
  return [
    [3, 1, 10, 2, color],
    [3, 3, 2, 7, color],
    [11, 3, 2, 7, color],
  ];
}
function hardHat(shell: string, brim: string): Block[] {
  return [
    [3, 0, 10, 3, shell],
    [2, 2, 12, 1, brim],
  ];
}
function beret(color: string, puff: string): Block[] {
  return [
    [4, 0, 8, 2, color],
    [10, -1, 2, 2, puff],
  ];
}

// ---- Clothing (torso) blocks ----
function torso(primary: string, accent?: Block): Block[] {
  const base: Block[] = [[2, 9, 12, 6, primary]];
  return accent ? [...base, accent] : base;
}

// ---- Individually composed sprites ----

/** 👤 default — neutral, no hair color, no accessory */
export function AvatarPerson(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairShort('#8a8a8a'),
        ...face,
        ...torso('#94a3b8'),
      ]}
    />
  );
}

/** 👨‍💼 business (male) — navy suit + red tie + briefcase */
export function AvatarBusinessMale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairShort('#3b2a1a'),
        ...face,
        ...torso('#1e2a4a', [7, 9, 2, 6, '#c23b3b']),
        [11, 11, 4, 4, '#8a5a2b'], // briefcase
        [12, 11, 2, 1, '#3a2411'], // briefcase handle
      ]}
    />
  );
}

/** 👩‍💼 business (female) — plum blazer + gold tie + briefcase */
export function AvatarBusinessFemale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairLong('#3b2a1a'),
        ...face,
        ...torso('#5b2a5e', [7, 9, 2, 6, '#d9a441']),
        [11, 11, 4, 4, '#8a5a2b'],
        [12, 11, 2, 1, '#3a2411'],
      ]}
    />
  );
}

/** 👨‍🔧 technician (male) — hard hat + hi-vis orange overalls + wrench */
export function AvatarTechMale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hardHat('#e8a13a', '#b97a1f'),
        ...face,
        ...torso('#2b4a7a', [2, 12, 12, 1, '#f0c419']),
        [11, 9, 4, 2, '#c7ccd1'], // wrench head
        [13, 11, 2, 4, '#c7ccd1'], // wrench handle
      ]}
    />
  );
}

/** 👩‍🔧 technician (female) — hard hat + hi-vis teal overalls + wrench */
export function AvatarTechFemale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hardHat('#e8a13a', '#b97a1f'),
        [3, 3, 2, 7, '#3b2a1a'], // ponytail spilling from under the hat
        ...face,
        ...torso('#1f6e6e', [2, 12, 12, 1, '#f0c419']),
        [11, 9, 4, 2, '#c7ccd1'],
        [13, 11, 2, 4, '#c7ccd1'],
      ]}
    />
  );
}

/** 👨‍💻 developer (male) — purple hoodie + glowing laptop */
export function AvatarDevMale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairShort('#241a12'),
        ...face,
        ...torso('#4c3a8a', [4, 12, 8, 2, '#3a2c6e']), // hoodie + pocket
        [10, 10, 5, 4, '#2b2b2b'], // laptop body
        [10, 10, 5, 2, '#8fd6ff'], // screen glow
      ]}
    />
  );
}

/** 👩‍💻 developer (female) — teal hoodie + glowing laptop */
export function AvatarDevFemale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairLong('#241a12'),
        ...face,
        ...torso('#1f7a6e', [4, 12, 8, 2, '#175f56']),
        [10, 10, 5, 4, '#2b2b2b'],
        [10, 10, 5, 2, '#8fd6ff'],
      ]}
    />
  );
}

/** 🧑‍🎨 artist — beret + teal smock + paint palette */
export function AvatarArtist(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...beret('#a8324a', '#7a2036'),
        [3, 3, 1, 5, '#3b2a1a'],
        [12, 3, 1, 5, '#3b2a1a'],
        ...face,
        ...torso('#2c8f6e'),
        [10, 10, 4, 3, '#c9b28a'], // palette
        [11, 9, 1, 1, '#c23b3b'],
        [12, 10, 1, 1, '#3a6fd8'],
        [11, 11, 1, 1, '#e8c93a'],
      ]}
    />
  );
}

/** 👨‍🏫 teacher (male) — maroon cardigan + open book */
export function AvatarTeacherMale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairShort('#5a5a5a'),
        ...face,
        ...torso('#7a2e2e', [7, 9, 2, 6, '#d9d0b8']),
        [10, 11, 5, 3, '#3a5f3a'], // book cover
        [12, 11, 1, 3, '#eef0e6'], // page edge
      ]}
    />
  );
}

/** 👩‍🏫 teacher (female) — maroon cardigan + open book */
export function AvatarTeacherFemale(props: AvatarIconProps): JSX.Element {
  return (
    <Sprite
      {...props}
      blocks={[
        ...hairLong('#5a5a5a'),
        ...face,
        ...torso('#7a2e2e', [7, 9, 2, 6, '#d9d0b8']),
        [10, 11, 5, 3, '#3a5f3a'],
        [12, 11, 1, 3, '#eef0e6'],
      ]}
    />
  );
}

/**
 * Maps AVAILABLE_AVATARS' emoji strings (usePlayerValidation.ts) to the
 * sprite above. player.avatar keeps storing the emoji — this is a
 * display-only lookup, so nothing about validation, persistence, or the
 * picker's equality checks changes.
 */
export const AVATAR_ICON_MAP: Record<string, React.FC<AvatarIconProps>> = {
  '👤': AvatarPerson,
  '👨‍💼': AvatarBusinessMale,
  '👩‍💼': AvatarBusinessFemale,
  '👨‍🔧': AvatarTechMale,
  '👩‍🔧': AvatarTechFemale,
  '👨‍💻': AvatarDevMale,
  '👩‍💻': AvatarDevFemale,
  '🧑‍🎨': AvatarArtist,
  '👨‍🏫': AvatarTeacherMale,
  '👩‍🏫': AvatarTeacherFemale,
};

/** Renders the icon for a stored avatar string, or null for an unrecognized/empty value (callers fall back to their own placeholder). */
export function AvatarIcon({ avatar, ...props }: AvatarIconProps & { avatar?: string }): JSX.Element | null {
  const Icon = avatar ? AVATAR_ICON_MAP[avatar] : undefined;
  if (!Icon) return null;
  return <Icon {...props} />;
}
