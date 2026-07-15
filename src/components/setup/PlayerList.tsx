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
  /** When true (TV mode), cards render at a minimal single-line footprint —
      avatar, name, and a tap-to-cycle color dot (replacing the full
      8-swatch picker) all on one row; a smaller QR (100px -> 44px); tighter
      padding throughout — so 4 tiles have a real shot at fitting a real
      TV's actual (often much smaller than 1080p) logical resolution
      without scrolling. 44px is still within a comfortably phone-scannable
      size at the close range players hold a phone to a TV screen to join.
      fb: TV real-hardware feedback, 2026-07-15 (two rounds — the first
      shrink wasn't enough once the TV's real 960x540 resolution came in). */
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
   * Compact (TV) mode replaces the always-visible 8-swatch color picker with
   * a single tap-to-cycle dot — same interaction pattern as the avatar
   * (onCycleAvatar) already uses. Cycles through colors not taken by ANY
   * OTHER player (this player's own current color stays in the cycle so
   * tapping repeatedly always lands somewhere valid). Confirmed live
   * 2026-07-15: on a real TV at its actual 960x540 resolution, the full
   * picker row was one of the biggest single contributors to tiles not
   * fitting on screen without scrolling.
   */
  const cycleColor = (player: Player) => {
    const eligible = AVAILABLE_COLORS.filter(
      c => c.color === player.color || !players.some(p => p.id !== player.id && p.color === c.color)
    );
    if (eligible.length <= 1) return;
    const idx = eligible.findIndex(c => c.color === player.color);
    const next = eligible[(idx + 1) % eligible.length];
    onUpdatePlayer(player.id, 'color', next.color);
  };

  /**
   * Render the full 8-swatch color picker — non-compact (PC) mode only.
   * Compact (TV) mode uses the single tap-to-cycle dot in renderPlayerCard
   * instead (see cycleColor above).
   */
  const renderColorPicker = (player: Player) => {
    const swatchSize = 30;
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

    const qrSize = compact ? 44 : 100;
    const avatarSize = compact ? 24 : 40;

    return (
      <div
        key={player.id}
        style={{
          background: colors.secondary.bg,
          border: `3px solid ${player.color}`,
          borderRadius: '12px',
          padding: compact ? '0.2rem 0.5rem' : '1rem 1.25rem',
          display: 'flex',
          // flexWrap lets the QR section drop below the avatar/name/colors
          // section on narrow viewports (e.g. phone hosting PC-mode setup)
          // instead of overflowing horizontally past the card edge.
          // <!-- fb:feedback-1779566484383-02bb1588 -->
          flexWrap: 'wrap',
          gap: compact ? '0.4rem' : '1rem',
          alignItems: 'center',
          transition: 'all 0.3s ease',
          animation: 'slideInFromLeft 0.5s ease-out'
        }}
      >
        {/* Left side: Avatar + Name + Colors + Remove */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '0.35rem' : '0.75rem',
          // flex basis gives the avatar+name+remove cluster a real minimum
          // width so the QR section's `marginLeft: auto` can't crush the
          // name input down to nothing on TV-width cards. When the card is
          // narrower than the basis + QR width, flex-wrap kicks in and the
          // QR section drops to a new row below — cleanly. v3.0.16. The
          // grid's own column-width floor (see the grid below) is what
          // actually keeps cards wide enough to avoid that in practice.
          // Compact's basis shrunk further 2026-07-15 when the whole left
          // side collapsed to one line (name + a single color dot, no more
          // 8-swatch picker row) — there's simply less content to reserve
          // room for now.
          flex: compact ? '1 1 190px' : '1 1 360px',
          minWidth: 0
        }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div
              style={{
                fontSize: compact ? '1.1rem' : '2rem',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => onCycleAvatar(player.id)}
              title="Click to change avatar"
            >
              <PlayerAvatar avatar={player.avatar} color={player.color} size={avatarSize} />
            </div>
          </div>

          {/* Compact (TV): name + a single tap-to-cycle color dot sit on ONE
              line — no second row for a picker at all. Non-compact (PC):
              name on top, full 8-swatch picker below, unchanged. */}
          {compact ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <input
                type="text"
                placeholder="Enter player name"
                value={player.name}
                onChange={(e) => onUpdatePlayer(player.id, 'name', e.target.value)}
                maxLength={20}
                style={{
                  padding: '0.3rem 0.5rem',
                  border: `2px solid ${colors.secondary.light}`,
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  transition: 'border-color 0.3s ease',
                  width: '90px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => handleInputFocus(e, player.color || '')}
                onBlur={handleInputBlur}
              />
              <button
                onClick={() => cycleColor(player)}
                title={`Color: ${AVAILABLE_COLORS.find(c => c.color === player.color)?.name || player.color} — tap to change`}
                aria-label={`Change color, currently ${AVAILABLE_COLORS.find(c => c.color === player.color)?.name || player.color}`}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: player.color,
                  border: `2px solid ${colors.secondary.light}`,
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
          )}

          {/* Remove button */}
          {canRemovePlayer && (
            <button
              onClick={() => onRemovePlayer(player.id)}
              style={{
                background: colors.danger.main,
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: compact ? '18px' : '32px',
                height: compact ? '18px' : '32px',
                fontSize: compact ? '0.8rem' : '1.2rem',
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
                padding: compact ? '0.2rem 0.4rem' : '0.5rem 0.75rem',
                fontSize: compact ? '0.7rem' : '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                {compact ? '✅' : '✅ Mobile'}
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
                {/* Compact (TV) mode drops this label entirely rather than
                    shrinking it further — compact only ever renders in TV
                    mode, where qrRequired is always true anyway (see
                    PlayerSetup.tsx's <PlayerList qrRequired={selectedMode
                    === 'tv'} compact={selectedMode === 'tv'}>), so there's
                    no "optional" wording this could ever need to show, and
                    the surrounding TV-mode context (the PC/TV toggle, the
                    "Phones + TV" copy) already makes "scan this" obvious
                    without spending a text line's height on every tile. */}
                {!compact && (
                  <div style={{
                    fontSize: '0.65rem',
                    color: qrRequired ? colors.danger.text : colors.secondary.main,
                    fontWeight: qrRequired ? 700 : 400,
                    marginTop: '0.25rem',
                    fontStyle: qrRequired ? 'normal' : 'italic'
                  }}>
                    {qrRequired ? '⚠ Required: scan to join' : 'Optional: scan for personal screen'}
                  </div>
                )}
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
  // doubled in height. Compact (TV) cards collapsed to a single line (name +
  // one color dot, no more 8-swatch row; QR shrunk 100->44px) the same day
  // after a SECOND real-hardware report — the TV's actual logical
  // resolution (960x540) was much smaller than the 1920x1080/1280x720 this
  // was first verified against, and even the earlier compact tiles didn't
  // come close to fitting. The true side-by-side minimum for these leaner
  // tiles is now only ~280px, so the floor dropped to 300px — deliberately
  // low enough to let 2 columns fit even at 960x540's shrunk-for-zoom local
  // width (~738px), halving the row count from 4 to 2.
  // <!-- fb:feedback-1779566484383-02bb1588, TV real-hardware feedback 2026-07-15 -->
  const columnFloor = compact ? 300 : 520;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${columnFloor}px), 1fr))`,
      gap: compact ? '0.4rem' : '1rem'
    }}>
      {players.map(player => renderPlayerCard(player))}
    </div>
  );
}