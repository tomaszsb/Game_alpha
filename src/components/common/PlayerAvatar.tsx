// PlayerAvatar — a custom SVG avatar icon encircled in the player's chosen COLOR.
//
// Emoji render in each device's native style (Apple on iPhone, Segoe on Windows,
// Noto on Android), so the SAME player's avatar used to look different on a
// phone vs the shared computer/TV screen (fb:e9852ae6 — "avatars look
// different on phone vs computer"). That bug was first fixed by ringing the
// native emoji in the player's color (a CSS color IS byte-identical on every
// device, unlike the emoji glyph itself) rather than replacing the emoji —
// at the time, a full icon set was judged too big a lift for the payoff.
// 2026-07-26: replaced the emoji itself too, once AvatarIcons.tsx made that
// cheap — player.avatar still stores the same emoji string (AVAILABLE_AVATARS,
// usePlayerValidation.ts), this just renders a matching custom icon for it
// instead of the raw glyph. The color ring stays as the second, independent
// signal it always was.

import React from 'react';
import { AvatarIcon } from '../icons/AvatarIcons';

interface PlayerAvatarProps {
  avatar?: string;
  color?: string;
  /** Diameter in px. The emoji scales to ~58% of this. */
  size?: number;
  title?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ avatar, color, size = 28, title }) => {
  const ring = color || '#94a3b8';
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${ring}`,
        // Faint fill of the same color so the identity reads even at a glance;
        // only when `ring` is a hex color (append 8-digit-hex alpha safely).
        background: ring.startsWith('#') ? `${ring}22` : 'transparent',
        fontSize: Math.round(size * 0.58),
        lineHeight: 1,
        flexShrink: 0,
        boxSizing: 'border-box',
        color: ring,
      }}
    >
      {AvatarIcon({ avatar, size: Math.round(size * 0.62) }) || avatar}
    </span>
  );
};
