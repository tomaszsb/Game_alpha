// src/components/modals/shared/NarrativeBlock.tsx
// Reusable styled block for per-action narrative text in modals.
// Uses the same styling as SpaceInfoModal's story section for consistency.

import React from 'react';
import { colors, theme } from '../../../styles/theme';
import { CHARACTER_MAP, extractPrefix } from '../../../constants/characters';
import { TextWithTerms, useDictionaryPanel } from '../../../dictionary';

interface NarrativeBlockProps {
  text: string;
  spaceName?: string;
  portraitSrc?: string | null;
}

export function NarrativeBlock({ text, spaceName, portraitSrc }: NarrativeBlockProps): JSX.Element | null {
  const { openWithTerm } = useDictionaryPanel();

  if (!text) return null;

  const prefix = spaceName ? extractPrefix(spaceName) : '';
  const npcInfo = prefix ? CHARACTER_MAP[prefix] : undefined;
  const borderColor = npcInfo?.color || colors.primary.main;

  return (
    <div style={{
      margin: '0 0 16px 0',
      color: colors.text.secondary,
      fontSize: '14px',
      lineHeight: '1.6',
      fontStyle: 'italic',
      padding: '12px',
      backgroundColor: colors.background.secondary,
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
