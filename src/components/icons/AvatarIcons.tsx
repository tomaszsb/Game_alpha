// src/components/icons/AvatarIcons.tsx
//
// Custom replacements for AVAILABLE_AVATARS (usePlayerValidation.ts) — the
// same cross-platform emoji problem as SetupIcons.tsx, applied to player
// avatars. Two prior passes were hand-drawn SVG (a shared silhouette + tiny
// badge read as too similar; a rebuilt pixel-grid version was better but
// maintainer feedback asked for real generated pixel art). 2026-07-26: real
// PixelLab-generated portraits (public/images/avatars/*.png, ~$0.006/image)
// replaced the hand-drawn sprites — same component API, so every call site
// wired up in the earlier passes needed no changes.
//
// player.avatar itself is UNCHANGED — still the raw emoji string from
// AVAILABLE_AVATARS, still what's compared/validated/persisted everywhere.
// getAvatarIcon() only maps that stored string to a matching image at
// render time, so no data migration is needed anywhere in the game.

import React from 'react';

export interface AvatarIconProps {
  size?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Maps AVAILABLE_AVATARS' emoji strings (usePlayerValidation.ts) to the
 * generated portrait. player.avatar keeps storing the emoji — this is a
 * display-only lookup, so nothing about validation, persistence, or the
 * picker's equality checks changes.
 */
export const AVATAR_IMAGE_MAP: Record<string, string> = {
  '👤': '/images/avatars/person.png',
  '👨‍💼': '/images/avatars/business_male.png',
  '👩‍💼': '/images/avatars/business_female.png',
  '👨‍🔧': '/images/avatars/technician_male.png',
  '👩‍🔧': '/images/avatars/technician_female.png',
  '👨‍💻': '/images/avatars/developer_male.png',
  '👩‍💻': '/images/avatars/developer_female.png',
  '🧑‍🎨': '/images/avatars/artist.png',
  '👨‍🏫': '/images/avatars/teacher_male.png',
  '👩‍🏫': '/images/avatars/teacher_female.png',
};

/** Renders the portrait for a stored avatar string, or null for an unrecognized/empty value (callers fall back to their own placeholder). */
export function AvatarIcon({ avatar, size = '1em', style, className }: AvatarIconProps & { avatar?: string }): JSX.Element | null {
  const src = avatar ? AVATAR_IMAGE_MAP[avatar] : undefined;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, objectFit: 'cover', borderRadius: '50%', ...style }}
      className={className}
    />
  );
}
