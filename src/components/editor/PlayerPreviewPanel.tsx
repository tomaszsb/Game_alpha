import React from 'react';
import { SpaceRow, DiceRollRow } from './types/EditorTypes';

interface PlayerPreviewPanelProps {
  currentSpace: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  diceRollData: DiceRollRow[];
}

// Card type colors matching theme
const CARD_COLORS: Record<string, { primary: string; bg: string; emoji: string; label: string }> = {
  W: { primary: '#6f42c1', bg: '#f3e5f5', emoji: '🏗️', label: 'Work' },
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
      <div style={styles.emptyState}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>👁️</div>
        <div style={{ color: '#495057', fontSize: '14px' }}>Select a space to preview</div>
      </div>
    );
  }

  // Collect card effects
  const cardEffects: { type: string; value: string; config: typeof CARD_COLORS['W'] }[] = [];
  const cardFields: { key: keyof SpaceRow; type: string }[] = [
    { key: 'w_card', type: 'W' },
    { key: 'b_card', type: 'B' },
    { key: 'i_card', type: 'I' },
    { key: 'l_card', type: 'L' },
    { key: 'e_card', type: 'E' },
  ];
  for (const cf of cardFields) {
    const val = currentSpace[cf.key];
    if (val) {
      cardEffects.push({ type: cf.type, value: val, config: CARD_COLORS[cf.type] });
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
    <div style={styles.panel}>
      {/* ZONE 1: Context — matches action-center__context */}
      <div style={styles.context}>
        {/* Space Header */}
        <div style={styles.spaceHeader}>
          <div style={styles.spaceInfo}>
            <div style={styles.visitBadge}>
              {visitType === 'First' ? '1st Visit' : 'Subsequent'}
            </div>
            <div style={styles.spaceName}>
              📍 {currentSpace.space_name}
              {currentSpace.Title && (
                <span style={styles.spaceTitle}> — {currentSpace.Title}</span>
              )}
            </div>
          </div>
          {currentSpace.phase && (
            <span style={styles.phaseBadge}>{currentSpace.phase}</span>
          )}
        </div>

        {/* Story */}
        {currentSpace.Event ? (
          <div style={styles.story}>
            {currentSpace.Event}
          </div>
        ) : (
          <div style={styles.noContent}>No story text</div>
        )}

        {/* Action */}
        {currentSpace.Action ? (
          <div style={styles.actionBox}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🎯</span>
            <span><strong>PM Action:</strong> {currentSpace.Action}</span>
          </div>
        ) : (
          <div style={styles.noContent}>No action text</div>
        )}

        {/* Outcome */}
        {currentSpace.Outcome ? (
          <div style={styles.outcomeBox}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📋</span>
            <span><strong>Outcome:</strong> {currentSpace.Outcome}</span>
          </div>
        ) : (
          <div style={styles.noContent}>No outcome text</div>
        )}

        {/* Quick Stats Bar */}
        <div style={styles.statsBar}>
          {currentSpace.Time && (
            <div style={styles.stat}>
              <span style={styles.statIcon}>⏱</span>
              <span style={styles.statValue}>{currentSpace.Time}</span>
            </div>
          )}
          {currentSpace.Fee && (
            <div style={styles.stat}>
              <span style={styles.statIcon}>💰</span>
              <span style={styles.statValue}>{currentSpace.Fee}</span>
            </div>
          )}
          {currentSpace.requires_dice_roll?.toLowerCase() === 'yes' && (
            <div style={{ ...styles.stat, borderColor: '#ff9800', background: '#fff3e0' }}>
              <span style={styles.statIcon}>🎲</span>
              <span style={{ ...styles.statValue, color: '#e65100' }}>
                {currentSpace.rolls ? `${currentSpace.rolls} roll${currentSpace.rolls !== '1' ? 's' : ''}` : 'Dice'}
              </span>
            </div>
          )}
          {currentSpace.Negotiate === 'YES' && (
            <div style={{ ...styles.stat, borderColor: '#ffc107', background: '#fff8e1' }}>
              <span style={styles.statIcon}>🤝</span>
              <span style={{ ...styles.statValue, color: '#f57f17' }}>Negotiate</span>
            </div>
          )}
          {currentSpace.path && currentSpace.path !== 'Main' && (
            <div style={{ ...styles.stat, borderColor: '#6f42c1', background: '#f3e5f5' }}>
              <span style={{ ...styles.statValue, color: '#6f42c1', fontSize: '11px' }}>{currentSpace.path}</span>
            </div>
          )}
        </div>
      </div>

      {/* ZONE 2: Effects & Dice — matches action-center__actions */}
      <div style={styles.actions}>
        {/* Card Effects */}
        {cardEffects.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>🃏 CARD EFFECTS</div>
            {cardEffects.map((card, i) => (
              <div key={i} style={styles.cardEffect}>
                <span style={{
                  ...styles.cardBadge,
                  backgroundColor: card.config.bg,
                  color: card.config.primary,
                  borderColor: card.config.primary + '60',
                }}>
                  {card.config.emoji} {card.type}
                </span>
                <span style={styles.cardValue}>{card.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dice Rolls — full breakdown */}
        {spaceDiceRolls.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>🎲 DICE ROLL OUTCOMES</div>
            {spaceDiceRolls.map((dr, idx) => {
              const config = DICE_TYPE_CONFIG[dr.die_roll] || { emoji: '🎲', color: '#6c757d', label: dr.die_roll };
              const rolls = [dr.roll_1, dr.roll_2, dr.roll_3, dr.roll_4, dr.roll_5, dr.roll_6];
              return (
                <div key={idx} style={styles.diceRollGroup}>
                  <div style={{
                    ...styles.diceRollLabel,
                    color: config.color,
                  }}>
                    {config.emoji} {config.label}
                  </div>
                  <div style={styles.diceGrid}>
                    {rolls.map((val, ri) => (
                      <div key={ri} style={styles.diceCell}>
                        <span style={styles.dieFace}>{DIE_FACES[ri]}</span>
                        <span style={{
                          ...styles.diceValue,
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
          </div>
        )}

        {/* Movement Destinations */}
        {destinations.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>🚶 NEXT SPACES</div>
            <div style={styles.destList}>
              {destinations.map((d, i) => (
                <div key={i} style={styles.destBtn}>
                  🎯 {d}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ZONE 3: Turn Controls — matches action-center__turn-controls */}
      <div style={styles.turnControls}>
        <div style={styles.endTurnBtn}>{endTurnLabel}</div>
        {showTryAgain && (
          <div style={styles.tryAgainBtn}>{tryAgainLabel}</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#fafafa',
  },

  // Zone 1: Context
  context: {
    flexShrink: 0,
    padding: '8px',
    borderBottom: '2px solid #e0e0e0',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  spaceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  spaceInfo: {
    flex: 1,
    minWidth: 0,
  },
  visitBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#343a40',
    marginBottom: '2px',
  },
  spaceName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1565c0',
  },
  spaceTitle: {
    fontSize: '11px',
    color: '#495057',
    fontWeight: 'normal',
  },
  phaseBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'white',
    background: '#2196f3',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  story: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#2c3e50',
    padding: '8px',
    background: '#f8f9fa',
    borderRadius: '6px',
    border: '2px solid #4caf50',
    fontWeight: 500,
  },
  actionBox: {
    padding: '8px 10px',
    backgroundColor: '#e8f4fd',
    borderRadius: '8px',
    borderLeft: '3px solid #2196F3',
    fontSize: '12px',
    color: '#1565C0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  outcomeBox: {
    padding: '8px 10px',
    backgroundColor: '#f3e5f5',
    borderRadius: '8px',
    borderLeft: '3px solid #7b1fa2',
    fontSize: '12px',
    color: '#4a148c',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  noContent: {
    fontSize: '12px',
    color: '#adb5bd',
    fontStyle: 'italic',
    padding: '4px 0',
  },
  statsBar: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '3px 8px',
    borderRadius: '6px',
    background: 'white',
    border: '1px solid #e0e0e0',
    fontSize: '11px',
  },
  statIcon: {
    fontSize: '12px',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#343a40',
  },

  // Zone 2: Actions
  actions: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  section: {
    marginBottom: '4px',
  },
  sectionHeader: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#343a40',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardEffect: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    backgroundColor: '#fafafa',
    borderRadius: '4px',
    marginBottom: '3px',
  },
  cardBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
    border: '1px solid',
    flexShrink: 0,
  },
  cardValue: {
    fontSize: '12px',
    color: '#343a40',
  },

  // Dice rolls
  diceRollGroup: {
    marginBottom: '8px',
    padding: '6px 8px',
    backgroundColor: '#fafafa',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
  },
  diceRollLabel: {
    fontSize: '12px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  diceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '2px',
  },
  diceCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
  },
  dieFace: {
    fontSize: '14px',
    lineHeight: 1,
  },
  diceValue: {
    fontSize: '10px',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: '1.2',
    wordBreak: 'break-word',
  },

  // Destinations
  destList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  destBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    borderRadius: '6px',
    background: '#2196f3',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  // Zone 3: Turn Controls
  turnControls: {
    flexShrink: 0,
    padding: '8px',
    borderTop: '2px solid #e0e0e0',
    background: '#fafafa',
    display: 'flex',
    gap: '8px',
  },
  endTurnBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '13px',
    textAlign: 'center',
    background: '#4caf50',
    color: 'white',
  },
  tryAgainBtn: {
    flex: 1,
    padding: '10px',
    border: '2px solid #ff9800',
    borderRadius: '8px',
    background: '#fff3e0',
    color: '#e65100',
    fontWeight: 'bold',
    fontSize: '12px',
    textAlign: 'center',
  },
};
