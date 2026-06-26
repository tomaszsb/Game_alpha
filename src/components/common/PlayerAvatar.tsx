// PlayerAvatar — an emoji avatar encircled in the player's chosen COLOR.
//
// Emoji render in each device's native style (Apple on iPhone, Segoe on Windows,
// Noto on Android), so the SAME player's avatar looks different on a phone vs the
// shared computer/TV screen (fb:e9852ae6 — "avatars look different on phone vs
// computer"). Rather than ship an image-based emoji set (a 12-site refactor +
// asset pipeline), we keep the native emoji but ring it in the player's color —
// a CSS color is byte-identical on every device, so COLOR becomes the reliable
// "that's me" signal across screens, with the emoji as flavor on top.

import React from 'react';

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
      }}
    >
      {avatar}
    </span>
  );
};
