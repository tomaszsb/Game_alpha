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

// Maintainer report 2026-08-18: avatar circles showed only the colored ring
// with no portrait for some players on the setup screen (2 filled in, 2
// blank). Root cause: <img> renders that colored ring/background via the
// PARENT span (PlayerAvatar.tsx) — that shows immediately — but the
// portrait itself only appears once its own PNG finishes downloading. Adding
// several players in quick succession fires several *different* first-time
// image requests at once (each avatar is a distinct file), so on a real
// network (not instant like a local dev server) a few can still be mid-load
// when the player looks — a blank-but-ringed circle, not a missing avatar.
// Firing one-shot preload requests for all 10 as soon as this module loads
// (well before any player card exists) means they're already cached by the
// time a real player card asks for one.
if (typeof window !== 'undefined') {
  Object.values(AVATAR_IMAGE_MAP).forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

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
