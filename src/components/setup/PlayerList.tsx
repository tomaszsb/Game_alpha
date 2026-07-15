// src/components/setup/PlayerList.tsx

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { ColorOption, AVAILABLE_COLORS } from './usePlayerValidation';
import { getServerURL, getNetworkInfo } from '../../utils/networkDetection';
import { PlayerAvatar } from '../common/PlayerAvatar';

interface PlayerListProps {
  players: Player[];
  onUpdatePlayer: (playerId: string, property: string, value: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onCycleAvatar: (playerId: string) => void;
  canRemovePlayer: boolean;
  /** When true, QR codes / connected badges are hidden from player cards */
  hideQR?: boolean;
  /** When true (TV mode), scanning the QR is mandatory — wording + styling
      reflect that the game can't start until the player joins. v3.0.25. */
  qrRequired?: boolean;
  /** When true (TV mode), cards render at a smaller footprint — smaller QR,
      avatar, and color swatches, tighter padding — so 4 tiles have a real
      shot at fitting on lower-resolution TV browser viewports without
      scrolling. QR is shrunk (100px -> 76px), not removed — still well
      within a comfortably phone-scannable size at the close range players
      hold a phone to a TV screen to join. fb: TV real-hardware feedback,
      2026-07-15. */
  compact?: boolean;
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
  hideQR = false,
  qrRequired = false,
  compact = false
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
  const renderColorPicker = (player: Player, compactPicker: boolean) => {
    const swatchSize = compactPicker ? 22 : 30;
    return (
      <div style={{
        display: 'flex',
        gap: compactPicker ? '0.35rem' : '0.5rem',
        flexWrap: 'wrap'
      }}>
        {AVAILABLE_COLORS.map((colorOption: ColorOption) => {
          const isSelected = player.color === colorOption.color;
          return (
            <button
              key={colorOption.color}
              onClick={() => onUpdatePlayer(player.id, 'color', colorOption.color)}
              style={{
                width: `${swatchSize}px`,
                height: `${swatchSize}px`,
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

    const qrSize = compact ? 76 : 100;
    const avatarSize = compact ? 30 : 40;

    return (
      <div
        key={player.id}
        style={{
          background: colors.secondary.bg,
          border: `3px solid ${player.color}`,
          borderRadius: '12px',
          padding: compact ? '0.5rem 0.75rem' : '1rem 1.25rem',
          display: 'flex',
          // flexWrap lets the QR section drop below the avatar/name/colors
          // section on narrow viewports (e.g. phone hosting PC-mode setup)
          // instead of overflowing horizontally past the card edge.
          // <!-- fb:feedback-1779566484383-02bb1588 -->
          flexWrap: 'wrap',
          gap: compact ? '0.6rem' : '1rem',
          alignItems: 'center',
          transition: 'all 0.3s ease',
          animation: 'slideInFromLeft 0.5s ease-out'
        }}
      >
        {/* Left side: Avatar + Name + Colors + Remove */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '0.5rem' : '0.75rem',
          // flex basis gives the avatar+name+remove cluster a real minimum
          // width so the QR section's `marginLeft: auto` can't crush the
          // name input down to nothing on TV-width cards. When the card is
          // narrower than the basis + QR width, flex-wrap kicks in and the
          // QR section drops to a new row below — cleanly. v3.0.16. The
          // grid's own column-width floor (see the grid below) is what
          // actually keeps cards wide enough to avoid that in practice.
          flex: compact ? '1 1 260px' : '1 1 360px',
          minWidth: 0
        }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div
              style={{
                fontSize: compact ? '1.5rem' : '2rem',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => onCycleAvatar(player.id)}
              title="Click to change avatar"
            >
              <PlayerAvatar avatar={player.avatar} color={player.color} size={avatarSize} />
            </div>
          </div>

          {/* Name + Colors stacked */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? '0.35rem' : '0.5rem'
          }}>
            <input
              type="text"
              placeholder="Enter player name"
              value={player.name}
              onChange={(e) => onUpdatePlayer(player.id, 'name', e.target.value)}
              maxLength={20}
              style={{
                padding: compact ? '0.35rem 0.55rem' : '0.5rem 0.75rem',
                border: `2px solid ${colors.secondary.light}`,
                borderRadius: '8px',
                fontSize: compact ? '0.85rem' : '1rem',
                fontWeight: 'bold',
                transition: 'border-color 0.3s ease',
                // 100% so the input shrinks on phone-width viewports; maxWidth
                // caps it at the color-picker row width below (8 swatches ×
                // swatch size + 7 × gap) so wide-screen visual alignment is
                // preserved. <!-- fb:feedback-1779566484383-02bb1588 -->
                width: '100%',
                maxWidth: compact
                  ? `${AVAILABLE_COLORS.length * 22 + (AVAILABLE_COLORS.length - 1) * 5.6}px`
                  : `${AVAILABLE_COLORS.length * 30 + (AVAILABLE_COLORS.length - 1) * 8}px`,
                boxSizing: 'border-box'
              }}
              onFocus={(e) => handleInputFocus(e, player.color || '')}
              onBlur={handleInputBlur}
            />
            {renderColorPicker(player, compact)}
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
                width: compact ? '24px' : '32px',
                height: compact ? '24px' : '32px',
                fontSize: compact ? '1rem' : '1.2rem',
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
                    size={qrSize}
                    level="M"
                    includeMargin={false}
                    fgColor={player.color || colors.primary.main}
                    style={{ width: '100%', height: 'auto', maxWidth: `${qrSize}px` }}
                  />
                </div>
                <div style={{
                  fontSize: compact ? '0.6rem' : '0.65rem',
                  color: qrRequired ? colors.danger.text : colors.secondary.main,
                  fontWeight: qrRequired ? 700 : 400,
                  marginTop: compact ? '0.15rem' : '0.25rem',
                  fontStyle: qrRequired ? 'normal' : 'italic'
                }}>
                  {qrRequired ? '⚠ Required: scan to join' : 'Optional: scan for personal screen'}
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

  // Column-width floor must stay comfortably above a card's own side-by-side
  // minimum (name/avatar block + QR block + gap), or the QR silently wraps
  // below the name/avatar INSIDE the card, nearly doubling its height. v3.0.15
  // used a flat 280px floor; the side effect on TV was that auto-fit packed
  // 4-5 narrow cards per row and the QR overlapped the name input. v3.0.16
  // raised it to 360px, which stopped the overlap but was still narrower
  // than the true side-by-side minimum (~500px non-compact) — confirmed
  // 2026-07-15 via a real-hardware TV bug report: at 1920px-wide, auto-fit
  // packed 3 narrow (447px) columns, each too tight, and cards nearly
  // doubled in height. Compact (TV) cards need less: smaller QR/avatar/
  // padding bring the true minimum down to ~380px.
  // <!-- fb:feedback-1779566484383-02bb1588, TV real-hardware feedback 2026-07-15 -->
  const columnFloor = compact ? 380 : 520;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${columnFloor}px), 1fr))`,
      gap: compact ? '0.6rem' : '1rem'
    }}>
      {players.map(player => renderPlayerCard(player))}
    </div>
  );
}