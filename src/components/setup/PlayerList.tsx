// src/components/setup/PlayerList.tsx

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { ColorOption, AVAILABLE_COLORS } from './usePlayerValidation';
import { getServerURL, getNetworkInfo } from '../../utils/networkDetection';

interface PlayerListProps {
  players: Player[];
  onUpdatePlayer: (playerId: string, property: string, value: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onCycleAvatar: (playerId: string) => void;
  canRemovePlayer: boolean;
  /** When true, QR codes / connected badges are hidden from player cards */
  hideQR?: boolean;
}

/**
 * PlayerList component displays and manages the list of players
 * Extracted from the legacy component's player rendering and management
 */
export function PlayerList({
  players,
  onUpdatePlayer,
  onRemovePlayer,
  onCycleAvatar,
  canRemovePlayer,
  hideQR = false
}: PlayerListProps): JSX.Element {

  /**
   * Handle input focus styling
   */
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>, playerColor: string) => {
    e.target.style.borderColor = playerColor;
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = colors.secondary.light;
  };

  /**
   * Handle remove button hover effects
   */
  const handleRemoveMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.1)';
  };

  const handleRemoveMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  /**
   * Render color picker for a player
   */
  const renderColorPicker = (player: Player) => {
    return (
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap'
      }}>
        {AVAILABLE_COLORS.map((colorOption: ColorOption) => {
          const isSelected = player.color === colorOption.color;
          return (
            <button
              key={colorOption.color}
              onClick={() => onUpdatePlayer(player.id, 'color', colorOption.color)}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: colorOption.color,
                border: isSelected ? `3px solid ${colors.success.text}` : `2px solid ${colors.secondary.light}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isSelected ? 'scale(1.2)' : 'scale(1)'
              }}
              title={colorOption.name}
              aria-label={`Select ${colorOption.name} color`}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
              }}
            />
          );
        })}
      </div>
    );
  };

  /**
   * Render individual player card
   */
  const renderPlayerCard = (player: Player) => {
    const playerURL = getServerURL(player.id, player.shortId);
    const networkInfo = getNetworkInfo();

    return (
      <div
        key={player.id}
        style={{
          background: colors.secondary.bg,
          border: `3px solid ${player.color}`,
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          // flexWrap lets the QR section drop below the avatar/name/colors
          // section on narrow viewports (e.g. phone hosting PC-mode setup)
          // instead of overflowing horizontally past the card edge.
          // <!-- fb:feedback-1779566484383-02bb1588 -->
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          transition: 'all 0.3s ease',
          animation: 'slideInFromLeft 0.5s ease-out'
        }}
      >
        {/* Left side: Avatar + Name + Colors + Remove */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          // flex basis 360px gives the avatar+name+remove cluster a real
          // minimum width so the QR section's `marginLeft: auto` can't
          // crush the name input down to nothing on TV-width cards. When
          // the card is narrower than ~500px, flex-wrap kicks in and the
          // QR section drops to a new row below — cleanly. v3.0.16.
          flex: '1 1 360px',
          minWidth: 0
        }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div
              style={{
                fontSize: '2rem',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => onCycleAvatar(player.id)}
              title="Click to change avatar"
            >
              {player.avatar}
            </div>
          </div>

          {/* Name + Colors stacked */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <input
              type="text"
              placeholder="Enter player name"
              value={player.name}
              onChange={(e) => onUpdatePlayer(player.id, 'name', e.target.value)}
              maxLength={20}
              style={{
                padding: '0.5rem 0.75rem',
                border: `2px solid ${colors.secondary.light}`,
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                transition: 'border-color 0.3s ease',
                // 100% so the input shrinks on phone-width viewports; maxWidth
                // caps it at the color-picker row width below (8 swatches ×
                // 30px + 7 × 8px gap = 296px) so wide-screen visual alignment
                // is preserved. <!-- fb:feedback-1779566484383-02bb1588 -->
                width: '100%',
                maxWidth: `${AVAILABLE_COLORS.length * 30 + (AVAILABLE_COLORS.length - 1) * 8}px`,
                boxSizing: 'border-box'
              }}
              onFocus={(e) => handleInputFocus(e, player.color || '')}
              onBlur={handleInputBlur}
            />
            {renderColorPicker(player)}
          </div>

          {/* Remove button */}
          {canRemovePlayer && (
            <button
              onClick={() => onRemovePlayer(player.id)}
              style={{
                background: colors.danger.main,
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={handleRemoveMouseEnter}
              onMouseLeave={handleRemoveMouseLeave}
              title="Remove player"
              aria-label={`Remove ${player.name}`}
            >
              ×
            </button>
          )}
        </div>

        {/* Right side: QR code or Connected badge (hidden when hideQR is true) */}
        {!hideQR && (
          <div style={{
            marginLeft: 'auto',
            flexShrink: 0,
            textAlign: 'center'
          }}>
            {player.deviceType === 'mobile' ? (
              <div style={{
                background: colors.success.light,
                color: colors.success.text,
                border: `2px solid ${colors.success.main}`,
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                ✅ Mobile
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {networkInfo.isLocalhost && (
                  <div style={{
                    fontSize: '0.65rem',
                    color: colors.danger.text,
                    marginBottom: '0.25rem',
                    maxWidth: '120px'
                  }}>
                    localhost only
                  </div>
                )}
                <div style={{
                  padding: '4px',
                  background: 'white',
                  borderRadius: '6px',
                  border: `2px solid ${player.color}`,
                  lineHeight: 0
                }}>
                  <QRCodeSVG
                    value={playerURL}
                    size={100}
                    level="M"
                    includeMargin={false}
                    fgColor={player.color || colors.primary.main}
                    style={{ width: '100%', height: 'auto', maxWidth: '100px' }}
                  />
                </div>
                <div style={{
                  fontSize: '0.65rem',
                  color: colors.secondary.main,
                  marginTop: '0.25rem',
                  fontStyle: 'italic'
                }}>
                  Optional: scan for personal screen
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (players.length === 0) {
    return (
      <div style={{
        background: colors.secondary.bg,
        border: `2px dashed ${colors.secondary.border}`,
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        color: colors.secondary.main,
        fontStyle: 'italic'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
        <p style={{ margin: 0, fontSize: '1.1rem' }}>
          No players added yet. Click "Add Player" to get started!
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      // Grid floor uses `min(100%, 360px)` so phones (container narrower
      // than 360) drop cleanly into a single full-width column without
      // horizontal overflow, while TVs (container wider than 360) get a
      // 360px floor — wide enough for the QR section to sit inline next
      // to the name input. v3.0.15 used a flat 280px floor; the side
      // effect on TV was that the auto-fit packed 4-5 narrow cards per
      // row and the QR overlapped the name input. v3.0.16 restored a
      // 360px floor at TV widths while keeping the phone collapse.
      // <!-- fb:feedback-1779566484383-02bb1588 -->
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
      gap: '1rem'
    }}>
      {players.map(player => renderPlayerCard(player))}
    </div>
  );
}