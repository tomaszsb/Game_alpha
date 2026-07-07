// src/components/modals/shared/CharacterBadge.tsx
// Compact badge showing which character is "speaking" in a modal.

import React from 'react';
import { colors, theme } from '../../../styles/theme';
import { getNpcCharacterInfo } from '../../../constants/characters';

interface CharacterBadgeProps {
  spaceName: string;
  /** Optional portrait image URL. When provided, replaces the emoji with a circular portrait. */
  portraitSrc?: string | null;
}

export function CharacterBadge({ spaceName, portraitSrc }: CharacterBadgeProps): JSX.Element | null {
  // PM-voiced spaces (fb:7065e8df) resolve to undefined here — no NPC badge
  // when the narration is the PM's own first-person thought.
  const info = getNpcCharacterInfo(spaceName);
  if (!info) return null;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 12px',
      marginBottom: '10px',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: colors.secondary.bg,
      borderLeft: `3px solid ${info.color}`,
      fontSize: '13px',
    }}>
      {portraitSrc ? (
        <img
          src={portraitSrc}
          alt={info.name}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid ${info.color}`,
            flexShrink: 0,
          }}
        />
      ) : (
        <span style={{ fontSize: '16px' }}>{info.emoji}</span>
      )}
      <span style={{ fontWeight: 600, color: colors.text.primary }}>{info.name}</span>
      <span style={{ color: colors.text.secondary, fontSize: '12px' }}>— {info.phase}</span>
    </div>
  );
}
