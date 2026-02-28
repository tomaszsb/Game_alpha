// src/components/modals/SpaceInfoModal.tsx

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { Space, SpaceContent, SpaceEffect, DiceEffect, Player } from '../../types/DataTypes';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';

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
  portraitSrc?: string | null;
}

export function SpaceInfoModal({
  isOpen,
  onClose,
  spaceName,
  space,
  content,
  effects,
  diceEffects,
  playersOnSpace,
  connections,
  portraitSrc
}: SpaceInfoModalProps): JSX.Element | null {
  if (!isOpen) return null;

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: '16px',
    color: colors.text.primary,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 'bold',
  };

  const footer = (
    <button
      onClick={onClose}
      style={modalButtonStyles.primary}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.dark;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.success.main;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      Close
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={spaceName}
      emoji={theme.emoji.info}
      maxWidth="600px"
      footer={footer}
      testId="space-info-modal"
    >
      {/* Phase Badge */}
      {space?.config?.phase && (
        <div style={{
          marginBottom: '16px',
          display: 'inline-block',
          padding: '4px 12px',
          backgroundColor: colors.info.light,
          borderRadius: theme.borderRadius.sm,
          fontSize: '14px',
          color: colors.info.dark,
          fontWeight: '500',
        }}>
          Phase: {space.config.phase}
        </div>
      )}

      {/* Story/Description */}
      {content?.story && (() => {
        const prefix = extractPrefix(spaceName);
        const npcInfo = CHARACTER_MAP[prefix];
        return (
          <div style={sectionStyle}>
            <h3 style={sectionHeadingStyle}>
              {theme.emoji.story} Story
            </h3>
            <div style={{
              margin: 0,
              color: colors.text.secondary,
              fontSize: '14px',
              lineHeight: '1.6',
              fontStyle: 'italic',
              padding: '12px',
              backgroundColor: colors.background.secondary,
              borderRadius: theme.borderRadius.sm,
              borderLeft: `3px solid ${npcInfo?.color || colors.primary.main}`,
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
                      width: '52px',
                      height: '52px',
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
                  }}>{npcInfo.name} says:</span>
                </div>
              )}
              {content.story}
            </div>
          </div>
        );
      })()}

      {/* PM Action Instructions */}
      {content?.action_description && (
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>
            🏗️ PM Action
          </h3>
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#e8f4fd',
            borderRadius: theme.borderRadius.sm,
            borderLeft: '3px solid #2196F3',
            fontSize: '14px',
            color: '#1565C0',
            lineHeight: '1.5',
          }}>
            {content.action_description}
          </div>
        </div>
      )}

      {/* Effects */}
      {effects.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>
            {theme.emoji.effects} Effects
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {effects.map((effect, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  backgroundColor: effect.trigger_type === 'manual' ? colors.warning.bg : colors.background.light,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${effect.trigger_type === 'manual' ? colors.warning.main : colors.border.light}`,
                  fontSize: '14px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {effect.trigger_type === 'manual' ? '👆 ' : '⚙️ '}
                  {effect.description || `${effect.effect_type}: ${effect.effect_action} ${effect.effect_value || ''}`}
                  {effect.trigger_type === 'manual' && (
                    <span style={{
                      color: colors.warning.text,
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
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>
            {theme.emoji.dice} Dice Effects
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {diceEffects.map((effect, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  backgroundColor: colors.info.light,
                  borderRadius: theme.borderRadius.sm,
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
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>
            {theme.emoji.movement} Movement Options
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {connections.map((dest, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px 12px',
                  backgroundColor: colors.success.light,
                  borderRadius: '999px',
                  fontSize: '13px',
                  color: colors.success.text,
                  border: `1px solid ${colors.success.main}`,
                  fontWeight: '500',
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
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>
            {theme.emoji.players} Players Here ({playersOnSpace.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {playersOnSpace.map((player) => (
              <div
                key={player.id}
                style={{
                  padding: '6px 12px',
                  backgroundColor: player.color || colors.primary.main,
                  borderRadius: '999px',
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
    </ModalBase>
  );
}
