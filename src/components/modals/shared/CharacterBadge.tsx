// src/components/modals/shared/CharacterBadge.tsx
// Compact badge showing which character is "speaking" in a modal.

import React from 'react';
import { theme } from '../../../styles/theme';
import { getNpcCharacterInfo } from '../../../constants/characters';
import { panelPalettes, PanelMode } from '../../player/panelTheme';

interface CharacterBadgeProps {
  spaceName: string;
  /** Optional portrait image URL. When provided, replaces the emoji with a circular portrait. */
  portraitSrc?: string | null;
  /**
   * Light/dark token set. Defaults to 'light' — ChoiceModal/CardModal have no
   * dark-mode awareness at all and don't pass this, so they keep rendering
   * exactly as before. Only mode-aware callers (DiceResultModal) pass the
   * shell's actual mode (fb:feedback-1783924131895-ffec84f4 — this badge was
   * hardcoded light and showed as a stray light box in a dark modal).
   */
  mode?: PanelMode;
}

export function CharacterBadge({ spaceName, portraitSrc, mode = 'light' }: CharacterBadgeProps): JSX.Element | null {
  // PM-voiced spaces (fb:7065e8df) resolve to undefined here — no NPC badge
  // when the narration is the PM's own first-person thought.
  const info = getNpcCharacterInfo(spaceName);
  if (!info) return null;

  const p = panelPalettes[mode];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 12px',
      marginBottom: '10px',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: p.surf,
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
      <span style={{ fontWeight: 600, color: p.text }}>{info.name}</span>
      <span style={{ color: p.muted, fontSize: '12px' }}>— {info.phase}</span>
    </div>
  );
}
