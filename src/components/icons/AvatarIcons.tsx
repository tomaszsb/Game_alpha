// src/components/icons/AvatarIcons.tsx
//
// Custom replacements for AVAILABLE_AVATARS (usePlayerValidation.ts) — the
// same cross-platform emoji problem as SetupIcons.tsx, applied to player
// avatars. A shared silhouette (round head + shoulders) with a hairstyle
// silhouette (short/long) and a small role badge in the corner, so the 10
// options read as a consistent set rather than 10 unrelated pictures.
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

function Base({
  size = '1em',
  style,
  className,
  children,
}: AvatarIconProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Head + shoulders, shared by every avatar. */
const bust = (
  <>
    <circle cx="16" cy="13" r="6.4" fill="currentColor" />
    <path d="M4 28c0-6.6 5.4-10.5 12-10.5S28 21.4 28 28" fill="currentColor" />
  </>
);

const hairShort = <path d="M9.8 12.2c0-4.2 2.8-6.8 6.2-6.8s6.2 2.6 6.2 6.8c0-2.6-2.5-4.2-6.2-4.2s-6.2 1.6-6.2 4.2Z" fill="currentColor" opacity="0.55" />;
const hairLong = <path d="M9.2 12c0-4.3 2.9-6.9 6.8-6.9s6.8 2.6 6.8 6.9v6.6c0 .9-.7 1.5-1.4 1L20 17.8v-4.4c-1.1.9-2.5 1.4-4 1.4s-2.9-.5-4-1.4v4.6l-1.6 1.7c-.6.6-1.6.2-1.6-.6V12Z" fill="currentColor" opacity="0.55" />;

/** No badge — the neutral default avatar. */
export function AvatarPerson(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairShort}</Base>;
}

/** Briefcase badge — business/owner roles. */
function briefcaseBadge(cx: number, cy: number) {
  return (
    <g transform={`translate(${cx - 4.2} ${cy - 3.4})`}>
      <rect x="0" y="1.6" width="8.4" height="6" rx="1.1" fill="#fff" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2.6 1.6v-.9c0-.7.6-1.2 1.2-1.2h1c.6 0 1.2.5 1.2 1.2v.9" stroke="currentColor" strokeWidth="1.1" fill="none" />
    </g>
  );
}
export function AvatarBusinessMale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairShort}{briefcaseBadge(24, 25)}</Base>;
}
export function AvatarBusinessFemale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairLong}{briefcaseBadge(24, 25)}</Base>;
}

/** Wrench badge — technician/expeditor roles. */
function wrenchBadge(cx: number, cy: number) {
  return (
    <g transform={`translate(${cx - 4} ${cy - 4})`}>
      <circle cx="4" cy="4" r="4.6" fill="#fff" stroke="currentColor" strokeWidth="1" />
      <path d="M2 6.2L5.6 2.6a1.7 1.7 0 0 1 2.3 2.3L4.3 8.4a1.2 1.2 0 0 1-1.9-.2L1 6.9a1 1 0 0 1 1-.7Z" fill="currentColor" />
    </g>
  );
}
export function AvatarTechMale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairShort}{wrenchBadge(24, 25)}</Base>;
}
export function AvatarTechFemale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairLong}{wrenchBadge(24, 25)}</Base>;
}

/** Laptop badge — developer/data roles. */
function laptopBadge(cx: number, cy: number) {
  return (
    <g transform={`translate(${cx - 4.4} ${cy - 3.4})`}>
      <rect x="0.4" y="0.4" width="8" height="5" rx="0.8" fill="#fff" stroke="currentColor" strokeWidth="1" />
      <path d="M0 6.6h8.8l1 1.4H-1l1-1.4Z" fill="currentColor" />
    </g>
  );
}
export function AvatarDevMale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairShort}{laptopBadge(24, 25)}</Base>;
}
export function AvatarDevFemale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairLong}{laptopBadge(24, 25)}</Base>;
}

/** Palette badge — the artist/designer avatar (🧑‍🎨 has no male/female split). */
export function AvatarArtist(props: AvatarIconProps): JSX.Element {
  return (
    <Base {...props}>
      {bust}{hairLong}
      <g transform="translate(19.8 21.6)">
        <path d="M4.2 0C1.9 0 0 1.7 0 3.9c0 1.3.9 2 1.9 2 .5 0 .7-.3.7-.7 0-.6.5-1 1.1-1h.8c1.7 0 3.1-1.2 3.1-2.7C7.6 1 6.1 0 4.2 0Z" fill="#fff" stroke="currentColor" strokeWidth="0.9" />
        <circle cx="1.6" cy="1.7" r="0.55" fill="currentColor" />
        <circle cx="3.3" cy="0.9" r="0.55" fill="currentColor" />
      </g>
    </Base>
  );
}

/** Mortarboard badge — teacher roles. */
function teacherBadge(cx: number, cy: number) {
  return (
    <g transform={`translate(${cx - 4.6} ${cy - 3.6})`}>
      <path d="M4.6 0L9.2 2.3 4.6 4.6 0 2.3 4.6 0Z" fill="#fff" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M2.2 3.4v2c0 .7 1.1 1.3 2.4 1.3s2.4-.6 2.4-1.3v-2" stroke="currentColor" strokeWidth="0.9" fill="none" />
    </g>
  );
}
export function AvatarTeacherMale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairShort}{teacherBadge(24, 25)}</Base>;
}
export function AvatarTeacherFemale(props: AvatarIconProps): JSX.Element {
  return <Base {...props}>{bust}{hairLong}{teacherBadge(24, 25)}</Base>;
}

/**
 * Maps AVAILABLE_AVATARS' emoji strings (usePlayerValidation.ts) to the icon
 * above. player.avatar keeps storing the emoji — this is a display-only
 * lookup, so nothing about validation, persistence, or the picker's
 * equality checks changes.
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
