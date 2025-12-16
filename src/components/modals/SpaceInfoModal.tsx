import React from 'react';
import { colors } from '../../styles/theme';
import { Space, SpaceContent, SpaceEffect, DiceEffect, Player } from '../../types/DataTypes';
import { FormatUtils } from '../../utils/FormatUtils';

interface SpaceInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceName: string;
  space: Space | null;
  content: SpaceContent | null | undefined;
  effects: SpaceEffect[];
  diceEffects: DiceEffect[];
  playersOnSpace: Player[];
  connections: string[];
}

/**
 * SpaceInfoModal - Shows detailed information about a specific space
 * Appears when user clicks info icon on a space
 */
export function SpaceInfoModal({
  isOpen,
  onClose,
  spaceName,
  space,
  content,
  effects,
  diceEffects,
  playersOnSpace,
  connections
}: SpaceInfoModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.white,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px', borderBottom: `2px solid ${colors.primary.main}`, paddingBottom: '12px' }}>
          <h2 style={{
            color: colors.primary.main,
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            {spaceName}
          </h2>
          {space?.config?.phase && (
            <div style={{
              color: colors.text.secondary,
              fontSize: '14px',
              marginTop: '4px'
            }}>
              Phase: {space.config.phase}
            </div>
          )}
        </div>

        {/* Story/Description */}
        {content?.story && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              color: colors.text.primary,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              📖 Story
            </h3>
            <p style={{
              margin: 0,
              color: colors.text.secondary,
              fontSize: '14px',
              lineHeight: '1.6',
              fontStyle: 'italic'
            }}>
              {content.story}
            </p>
          </div>
        )}

        {/* Effects */}
        {effects.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              color: colors.text.primary,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ⚡ Effects
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {effects.map((effect, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px',
                    backgroundColor: effect.trigger_type === 'manual' ? colors.warning.light : colors.background.light,
                    borderRadius: '6px',
                    border: `1px solid ${effect.trigger_type === 'manual' ? colors.warning.main : colors.border.light}`,
                    fontSize: '14px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {effect.trigger_type === 'manual' ? '👆 ' : '⚙️ '}
                    {effect.description || `${effect.effect_type}: ${effect.effect_action} ${effect.effect_value || ''}`}
                    {effect.trigger_type === 'manual' && (
                      <span style={{
                        color: colors.warning.main,
                        fontSize: '12px',
                        marginLeft: '8px',
                        fontWeight: 'normal'
                      }}>
                        (Manual Action Required)
                      </span>
                    )}
                  </div>
                  {effect.condition && effect.condition !== 'always' && (
                    <div style={{ fontSize: '12px', color: colors.text.secondary }}>
                      Condition: {effect.condition}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dice Effects */}
        {diceEffects.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              color: colors.text.primary,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🎲 Dice Effects
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {diceEffects.map((effect, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px',
                    backgroundColor: colors.info.light,
                    borderRadius: '6px',
                    fontSize: '13px',
                    border: `1px solid ${colors.info.main}`
                  }}
                >
                  {effect.effect_type}: {effect.description || effect.effect_action || 'See dice roll results'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Movement Options */}
        {connections.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              color: colors.text.primary,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🚶 Movement Options
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {connections.map((dest, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: colors.success.light,
                    borderRadius: '16px',
                    fontSize: '13px',
                    color: colors.success.main,
                    border: `1px solid ${colors.success.main}`
                  }}
                >
                  → {dest}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Players on Space */}
        {playersOnSpace.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              color: colors.text.primary,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              👥 Players Here ({playersOnSpace.length})
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {playersOnSpace.map((player) => (
                <div
                  key={player.id}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: player.color || colors.primary.main,
                    borderRadius: '16px',
                    fontSize: '13px',
                    color: colors.white,
                    fontWeight: 'bold'
                  }}
                >
                  {player.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: colors.primary.main,
            color: colors.white,
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.primary.dark;
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.primary.main;
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
