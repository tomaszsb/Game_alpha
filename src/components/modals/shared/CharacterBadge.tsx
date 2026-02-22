// src/components/modals/shared/CharacterBadge.tsx
// Compact badge showing which character is "speaking" in a modal.

import React from 'react';
import { colors, theme } from '../../../styles/theme';

interface CharacterInfo {
  emoji: string;
  name: string;
  phase: string;
  color: string;
}

const CHARACTER_MAP: Record<string, CharacterInfo> = {
  OWNER:      { emoji: '👔', name: 'The Owner',        phase: 'Initiation',   color: '#2196F3' },
  ARCH:       { emoji: '📐', name: 'The Architect',    phase: 'Design',       color: '#9C27B0' },
  ENG:        { emoji: '⚙️', name: 'The Engineer',     phase: 'Engineering',  color: '#FF9800' },
  'REG-DOB':  { emoji: '📋', name: 'DOB Examiner',     phase: 'Regulatory',   color: '#f44336' },
  'REG-FDNY': { emoji: '🚒', name: 'FDNY Inspector',   phase: 'Regulatory',   color: '#f44336' },
  CON:        { emoji: '🏗️', name: 'The Contractor',   phase: 'Construction', color: '#4CAF50' },
};

function extractPrefix(spaceName: string): string {
  if (spaceName.startsWith('REG-DOB'))  return 'REG-DOB';
  if (spaceName.startsWith('REG-FDNY')) return 'REG-FDNY';
  const idx = spaceName.indexOf('-');
  return idx > 0 ? spaceName.substring(0, idx) : spaceName;
}

interface CharacterBadgeProps {
  spaceName: string;
}

export function CharacterBadge({ spaceName }: CharacterBadgeProps): JSX.Element | null {
  const prefix = extractPrefix(spaceName);
  const info = CHARACTER_MAP[prefix];
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
      <span style={{ fontSize: '16px' }}>{info.emoji}</span>
      <span style={{ fontWeight: 600, color: colors.text.primary }}>{info.name}</span>
      <span style={{ color: colors.text.secondary, fontSize: '12px' }}>— {info.phase}</span>
    </div>
  );
}
