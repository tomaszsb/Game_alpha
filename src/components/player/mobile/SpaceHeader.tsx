// src/components/player/mobile/SpaceHeader.tsx
//
// Compact header showing current space and player info for mobile.
// Created: January 24, 2026

import React from 'react';

export interface SpaceHeaderProps {
  spaceName: string;
  spaceTitle?: string;
  visitType: 'First' | 'Subsequent';
  playerName: string;
  playerAvatar?: string;
  playerColor?: string;
}

/**
 * SpaceHeader - Compact header for mobile player panel.
 * Shows current space name, title, and player identity.
 */
export const SpaceHeader: React.FC<SpaceHeaderProps> = ({
  spaceName,
  spaceTitle,
  visitType,
  playerName,
  playerAvatar,
  playerColor
}) => {
  return (
    <div
      className="mobile-space-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: playerColor ? `${playerColor}22` : '#e3f2fd',
        borderBottom: `2px solid ${playerColor || '#2196f3'}`,
        minHeight: '40px'
      }}
    >
      {/* Player avatar */}
      <div
        style={{
          fontSize: '24px',
          lineHeight: 1,
          flexShrink: 0
        }}
      >
        {playerAvatar || '🎮'}
      </div>

      {/* Space info - grows to fill */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            flexWrap: 'wrap'
          }}
        >
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#1a1a1a'
            }}
          >
            {spaceName}
          </span>
          {visitType === 'Subsequent' && (
            <span
              style={{
                fontSize: '10px',
                color: '#666',
                backgroundColor: '#f0f0f0',
                padding: '1px 4px',
                borderRadius: '3px'
              }}
            >
              Return
            </span>
          )}
        </div>
        {spaceTitle && (
          <div
            style={{
              fontSize: '11px',
              color: '#555',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={spaceTitle}
          >
            {spaceTitle}
          </div>
        )}
      </div>

      {/* Player name - right aligned */}
      <div
        style={{
          fontSize: '11px',
          color: '#666',
          flexShrink: 0,
          textAlign: 'right'
        }}
      >
        {playerName}
      </div>
    </div>
  );
};
