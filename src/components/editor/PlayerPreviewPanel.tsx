import React from 'react';
import { SpaceRow, DiceRollRow } from './types/EditorTypes';
import '../player/ActionCenterPanel.css';

interface PlayerPreviewPanelProps {
  currentSpace: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  diceRollData: DiceRollRow[];
}

// Card type colors matching theme
const CARD_COLORS: Record<string, { primary: string; bg: string; emoji: string; label: string }> = {
  W: { primary: '#6f42c1', bg: '#f3e5f5', emoji: '🏗️', label: 'Scope Worktypes' },
  B: { primary: '#007bff', bg: '#e3f2fd', emoji: '🏦', label: 'Bank' },
  I: { primary: '#28a745', bg: '#e8f5e9', emoji: '💰', label: 'Investor' },
  L: { primary: '#dc3545', bg: '#fce4ec', emoji: '🎲', label: 'Life Event' },
  E: { primary: '#ff9800', bg: '#fff3e0', emoji: '⚡', label: 'Expeditor' },
};

const DICE_TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  'W Cards': { emoji: '🏗️', color: '#6f42c1', label: 'W Cards' },
  'I Cards': { emoji: '💰', color: '#28a745', label: 'I Cards' },
  'E cards': { emoji: '⚡', color: '#ff9800', label: 'E Cards' },
  'Fees Paid': { emoji: '💰', color: '#dc3545', label: 'Fees' },
  'Fee Paid': { emoji: '💰', color: '#dc3545', label: 'Fees' },
  'Time outcomes': { emoji: '⏱️', color: '#fd7e14', label: 'Time/Destination' },
  'Quality': { emoji: '⭐', color: '#17a2b8', label: 'Quality' },
  'Multiplier': { emoji: '✖️', color: '#6610f2', label: 'Multiplier' },
  'Multiplier ': { emoji: '✖️', color: '#6610f2', label: 'Multiplier' },
  'Next Step': { emoji: '🚶', color: '#007bff', label: 'Next Step' },
};

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];


export function PlayerPreviewPanel({ currentSpace, visitType, diceRollData }: PlayerPreviewPanelProps): JSX.Element {
  if (!currentSpace) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#fafafa' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>👁️</div>
        <div style={{ color: '#495057', fontSize: '14px' }}>Select a space to preview</div>
      </div>
    );
  }

  // Collect card effects with labels
  const cardEffects: { type: string; value: string; label: string; config: typeof CARD_COLORS['W'] }[] = [];
  const cardFields: { key: keyof SpaceRow; labelKey: keyof SpaceRow; type: string }[] = [
    { key: 'w_card', labelKey: 'w_card_label', type: 'W' },
    { key: 'b_card', labelKey: 'b_card_label', type: 'B' },
    { key: 'i_card', labelKey: 'i_card_label', type: 'I' },
    { key: 'l_card', labelKey: 'l_card_label', type: 'L' },
    { key: 'e_card', labelKey: 'e_card_label', type: 'E' },
  ];
  for (const cf of cardFields) {
    const val = currentSpace[cf.key];
    if (val) {
      cardEffects.push({ type: cf.type, value: val, label: currentSpace[cf.labelKey] || '', config: CARD_COLORS[cf.type] });
    }
  }

  // Dice rolls for this space/visit
  const spaceDiceRolls = diceRollData.filter(
    dr => dr.space_name === currentSpace.space_name && dr.visit_type === visitType
  );

  // Movement destinations
  const destinations: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = currentSpace[`space_${i}` as keyof SpaceRow];
    if (v) destinations.push(v);
  }

  const endTurnLabel = currentSpace.end_turn_label || 'End Turn';
  const tryAgainLabel = currentSpace.try_again_label || 'Try Again';
  const showTryAgain = currentSpace.Negotiate === 'YES';

  return (
    <div className="action-center" style={{ height: '100%', overflow: 'hidden' }}>
      {/* ===== ZONE 1: Context ===== */}
      <div className="action-center__context">
        {/* Space Header */}
        <div className="action-center__space-header">
          <div className="action-center__space-info">
            <div className="action-center__player-name">
              {visitType === 'First' ? '1st Visit' : 'Subsequent'}
            </div>
            <div className="action-center__space-name">
              📍 {currentSpace.space_name}
              {currentSpace.Title && (
                <span className="action-center__space-title"> - {currentSpace.Title}</span>
              )}
            </div>
          </div>
          {currentSpace.phase && (
            <span className="action-center__phase-badge">{currentSpace.phase}</span>
          )}
        </div>

        {/* Story */}
        {currentSpace.Event ? (
          <div className="action-center__story">
            {currentSpace.Event}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#adb5bd', fontStyle: 'italic', padding: '4px 0' }}>No story text</div>
        )}

        {/* PM Action */}
        {currentSpace.Action ? (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#e8f4fd',
            borderRadius: '8px',
            borderLeft: '3px solid #2196F3',
            fontSize: '13px',
            color: '#1565C0',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>🎯</span>
            <span><strong>PM Action:</strong> {currentSpace.Action}</span>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#adb5bd', fontStyle: 'italic', padding: '4px 0' }}>No action text</div>
        )}

        {/* Outcome */}
        {currentSpace.Outcome ? (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f3e5f5',
            borderRadius: '8px',
            borderLeft: '3px solid #7b1fa2',
            fontSize: '13px',
            color: '#4a148c',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📋</span>
            <span><strong>Outcome:</strong> {currentSpace.Outcome}</span>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#adb5bd', fontStyle: 'italic', padding: '4px 0' }}>No outcome text</div>
        )}

        {/* Quick Stats */}
        <div className="action-center__stats">
          {currentSpace.Time && (
            <div className="action-center__stat">
              <span className="action-center__stat-icon">⏱</span>
              <span className="action-center__stat-value">{currentSpace.Time}</span>
            </div>
          )}
          {currentSpace.Fee && (
            <div className="action-center__stat">
              <span className="action-center__stat-icon">💰</span>
              <span className="action-center__stat-value">{currentSpace.Fee}</span>
            </div>
          )}
          {currentSpace.requires_dice_roll?.toLowerCase() === 'yes' && (
            <div className="action-center__stat" style={{ borderColor: '#ff9800', background: '#fff3e0' }}>
              <span className="action-center__stat-icon">🎲</span>
              <span className="action-center__stat-value" style={{ color: '#e65100' }}>
                {currentSpace.rolls ? `${currentSpace.rolls} roll${currentSpace.rolls !== '1' ? 's' : ''}` : 'Dice'}
              </span>
            </div>
          )}
          {currentSpace.Negotiate === 'YES' && (
            <div className="action-center__stat" style={{ borderColor: '#ffc107', background: '#fff8e1' }}>
              <span className="action-center__stat-icon">🤝</span>
              <span className="action-center__stat-value" style={{ color: '#f57f17' }}>Negotiate</span>
            </div>
          )}
          {currentSpace.path && currentSpace.path !== 'Main' && (
            <div className="action-center__stat" style={{ borderColor: '#6f42c1', background: '#f3e5f5' }}>
              <span className="action-center__stat-value" style={{ color: '#6f42c1', fontSize: '11px' }}>{currentSpace.path}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== ZONE 2: Actions ===== */}
      <div className="action-center__actions" style={{ flex: 1, overflowY: 'auto' }}>
        {/* (C) Card Action Buttons */}
        {cardEffects.length > 0 && (
          <>
            <div className="action-center__required-actions-header">
              🃏 (C) ACTIONS ({cardEffects.length})
            </div>
            {cardEffects.map((card, i) => (
              <button
                key={i}
                className="action-center__action-btn"
                disabled
              >
                {card.label || `${card.value} ${card.type} cards`}
              </button>
            ))}
          </>
        )}

        {/* (D) Dice Roll Outcomes */}
        {spaceDiceRolls.length > 0 && (
          <>
            <div className="action-center__required-actions-header">
              🎲 (D) ACTIONS
            </div>
            {spaceDiceRolls.map((dr, idx) => {
              const config = DICE_TYPE_CONFIG[dr.die_roll] || { emoji: '🎲', color: '#6c757d', label: dr.die_roll };
              const rolls = [dr.roll_1, dr.roll_2, dr.roll_3, dr.roll_4, dr.roll_5, dr.roll_6];
              return (
                <div key={idx} style={{
                  padding: '6px 8px',
                  backgroundColor: '#fafafa',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0',
                  marginBottom: '4px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: config.color }}>
                    {config.emoji} {config.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2px' }}>
                    {rolls.map((val, ri) => (
                      <div key={ri} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                        <span style={{ fontSize: '14px', lineHeight: 1 }}>{DIE_FACES[ri]}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, textAlign: 'center',
                          lineHeight: '1.2', wordBreak: 'break-word',
                          color: val ? '#343a40' : '#ced4da',
                        }}>
                          {val || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Movement Choices */}
        {destinations.length > 0 && (
          <div className="action-center__movement">
            <div className="action-center__movement-header">🚶 CHOOSE YOUR DESTINATION</div>
            {destinations.map((d, i) => (
              <button key={i} className="action-center__movement-btn" disabled>
                🎯 {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Turn Controls ===== */}
      <div className="action-center__turn-controls">
        <button className="action-center__end-turn-btn" disabled={false}>
          {endTurnLabel}
        </button>
        {showTryAgain && (
          <button className="action-center__try-again-btn">
            {tryAgainLabel}
          </button>
        )}
      </div>
    </div>
  );
}
