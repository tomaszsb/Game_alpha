// src/components/modals/shared/NarrativeBlock.tsx
// Reusable styled block for per-action narrative text in modals.

import React from 'react';
import { colors, theme } from '../../../styles/theme';
import { getNpcCharacterInfo } from '../../../constants/characters';
import { TextWithTerms, useDictionaryPanel } from '../../../dictionary';
import { panelPalettes, PanelMode } from '../../player/panelTheme';

interface NarrativeBlockProps {
  text: string;
  spaceName?: string;
  portraitSrc?: string | null;
  /**
   * Light/dark token set. Defaults to 'light' — ChoiceModal/CardModal have no
   * dark-mode awareness at all and don't pass this, so they keep rendering
   * exactly as before. Only mode-aware callers (DiceResultModal) pass the
   * shell's actual mode (fb:feedback-1783924131895-ffec84f4 — same stray
   * light-box-in-dark-modal bug as CharacterBadge).
   */
  mode?: PanelMode;
}

export function NarrativeBlock({ text, spaceName, portraitSrc, mode = 'light' }: NarrativeBlockProps): JSX.Element | null {
  const { openWithTerm } = useDictionaryPanel();

  if (!text) return null;

  const p = panelPalettes[mode];

  // PM-voiced spaces (fb:7065e8df) resolve to undefined — no NPC portrait/name
  // when the narration is the PM's own first-person thought.
  const npcInfo = spaceName ? getNpcCharacterInfo(spaceName) : undefined;
  const borderColor = npcInfo?.color || colors.primary.main;

  return (
    <div style={{
      margin: '0 0 16px 0',
      color: p.muted,
      fontSize: '14px',
      lineHeight: '1.6',
      fontStyle: 'italic',
      padding: '12px',
      backgroundColor: p.surf,
      borderRadius: theme.borderRadius.sm,
      borderLeft: `3px solid ${borderColor}`,
    }}>
      {portraitSrc && npcInfo && (
        <div style={{
          float: 'left',
          marginRight: '10px',
          marginBottom: '4px',
          textAlign: 'center',
        }}>
          <img
            src={portraitSrc}
            alt={npcInfo.name}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${npcInfo.color}`,
              display: 'block',
            }}
          />
          <span style={{
            fontSize: '10px',
            fontStyle: 'normal',
            fontWeight: 600,
            color: npcInfo.color,
          }}>{npcInfo.name}</span>
        </div>
      )}
      <TextWithTerms text={text} onTermClick={(term) => openWithTerm(term.id)} />
    </div>
  );
}
