import React from 'react';
import { SpaceRow, DiceRollRow } from './types/EditorTypes';
import '../player/ActionCenterPanel.css';

interface PlayerPreviewPanelProps {
  currentSpace: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  diceRollData: DiceRollRow[];
}



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
  const cardEffects: { type: string; value: string; label: string }[] = [];
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
      cardEffects.push({ type: cf.type, value: val, label: currentSpace[cf.labelKey] || '' });
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
        {/* YOUR ACTIONS — combined card + dice, matching the game */}
        {(cardEffects.length > 0 || spaceDiceRolls.length > 0) && (() => {
          const diceTypes = [...new Set(spaceDiceRolls.map(dr => dr.die_roll))];
          const totalActions = cardEffects.length + diceTypes.length;
          return (
            <>
              <div className="action-center__required-actions-header">
                📋 YOUR ACTIONS ({totalActions})
              </div>
              {cardEffects.map((card, i) => (
                <button
                  key={`card-${i}`}
                  className="action-center__action-btn"
                  disabled
                >
                  {card.label || `${card.value} ${card.type} cards`}
                </button>
              ))}
              {diceTypes.map((dieRoll, idx) => {
                const dr = spaceDiceRolls.find(r => r.die_roll === dieRoll);
                const label = dr?.button_label || `Roll for ${dieRoll}`;
                return (
                  <button
                    key={`dice-${idx}`}
                    className="action-center__action-btn action-center__action-btn--dice"
                    disabled
                  >
                    🎲 {label}
                  </button>
                );
              })}
            </>
          );
        })()}

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
