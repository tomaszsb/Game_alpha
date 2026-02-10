import React, { useState } from 'react';
import { SpaceRow, PHASES, PATH_TYPES, YES_NO_OPTIONS, YES_NO_LOWER_OPTIONS } from './types/EditorTypes';

interface SpaceEditorProps {
  spaceFirst: SpaceRow | null;
  spaceSubsequent: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  allSpaceNames: string[];
  onVisitTypeChange: (visitType: 'First' | 'Subsequent') => void;
  onFieldChange: (visitType: 'First' | 'Subsequent', field: keyof SpaceRow, value: string) => void;
}

// Card type colors matching theme.ts cardTypes
const CARD_COLORS: Record<string, { primary: string; bg: string; border: string; text: string; emoji: string; label: string }> = {
  W: { primary: '#6f42c1', bg: '#f3e5f5', border: '#6f42c1', text: '#4a148c', emoji: '🏗️', label: 'Work' },
  B: { primary: '#007bff', bg: '#e3f2fd', border: '#007bff', text: '#0d47a1', emoji: '🏦', label: 'Bank' },
  I: { primary: '#28a745', bg: '#e8f5e9', border: '#28a745', text: '#1b5e20', emoji: '💰', label: 'Investor' },
  L: { primary: '#dc3545', bg: '#fce4ec', border: '#dc3545', text: '#b71c1c', emoji: '🎲', label: 'Life Event' },
  E: { primary: '#ff9800', bg: '#fff3e0', border: '#ff9800', text: '#e65100', emoji: '⚡', label: 'Expeditor' },
};

// Fieldset border colors
const SECTION_COLORS = {
  identity: '#6c757d',
  story: '#4caf50',
  cards: '#6f42c1',
  costs: '#fd7e14',
  movement: '#007bff',
  buttons: '#868e96',
};

function getEndTurnLabel(title: string, negotiate: string): string {
  if (negotiate !== 'YES' || !title) return 'End Turn';
  const t = title.toLowerCase();
  if (t.includes('owner')) return 'Agree with Owner';
  if (t.includes('fee')) return 'Accept Fee';
  if (t.includes('scope')) return 'Accept Scope';
  if (t.includes('fund')) return 'Accept Funding';
  if (t.includes('exam') || t.includes('audit') || t.includes('review')) return 'Accept Result';
  if (t.includes('contractor') || t.includes('change order')) return 'Accept Terms';
  return 'Accept & End Turn';
}

function getTryAgainLabel(negotiate: string): string {
  return negotiate === 'YES' ? '🔄 Negotiate' : '🔄 Try Again';
}

export function SpaceEditor({
  spaceFirst,
  spaceSubsequent,
  visitType,
  allSpaceNames,
  onVisitTypeChange,
  onFieldChange
}: SpaceEditorProps): JSX.Element {
  const currentSpace = visitType === 'First' ? spaceFirst : spaceSubsequent;
  const [previewOpen, setPreviewOpen] = useState(true);

  if (!currentSpace) {
    return (
      <div style={styles.placeholder}>
        <div style={styles.placeholderIcon}>📍</div>
        <div style={styles.placeholderText}>Select a space to edit</div>
      </div>
    );
  }

  const handleChange = (field: keyof SpaceRow, value: string) => {
    onFieldChange(visitType, field, value);
  };

  // Collect active effects for preview
  const effects: { emoji: string; label: string; value: string; color: string }[] = [];
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
      const cc = CARD_COLORS[cf.type];
      effects.push({ emoji: cc.emoji, label: `${cc.label} Card`, value: val, color: cc.primary });
    }
  }
  if (currentSpace.Time) {
    effects.push({ emoji: '⏱️', label: 'Time', value: currentSpace.Time, color: '#fd7e14' });
  }
  if (currentSpace.Fee) {
    effects.push({ emoji: '💰', label: 'Fee', value: currentSpace.Fee, color: '#28a745' });
  }

  // Movement destinations
  const destinations: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = currentSpace[`space_${i}` as keyof SpaceRow];
    if (v) destinations.push(v);
  }

  const endTurnLabel = getEndTurnLabel(currentSpace.Title, currentSpace.Negotiate);
  const tryAgainLabel = getTryAgainLabel(currentSpace.Negotiate);

  return (
    <div style={styles.container}>
      {/* Header with space name and visit type toggle */}
      <div style={styles.header}>
        <h3 style={styles.spaceName}>{currentSpace.space_name}</h3>
        <div style={styles.visitToggle}>
          <button
            onClick={() => onVisitTypeChange('First')}
            style={{
              ...styles.toggleButton,
              ...(visitType === 'First' ? styles.toggleButtonActive : {})
            }}
          >
            First Visit
          </button>
          <button
            onClick={() => onVisitTypeChange('Subsequent')}
            style={{
              ...styles.toggleButton,
              ...(visitType === 'Subsequent' ? styles.toggleButtonActive : {})
            }}
          >
            Subsequent
          </button>
        </div>
      </div>

      <div style={styles.formContainer}>
        {/* Player Preview (collapsible) */}
        <div style={styles.previewContainer}>
          <div
            style={styles.previewHeader}
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            <span>👁️ Player Preview</span>
            <span style={{ fontSize: '12px', color: '#868e96' }}>{previewOpen ? '▼' : '▶'}</span>
          </div>
          {previewOpen && (
            <div style={styles.previewBody}>
              {/* Story box */}
              {currentSpace.Event ? (
                <div style={styles.previewStory}>
                  <div style={styles.previewStoryLabel}>📖 Story</div>
                  <div style={styles.previewStoryText}>{currentSpace.Event}</div>
                </div>
              ) : (
                <div style={styles.previewEmpty}>No story text</div>
              )}

              {/* Effects summary */}
              {effects.length > 0 && (
                <div style={styles.previewEffects}>
                  <div style={styles.previewEffectsLabel}>⚡ Effects</div>
                  <div style={styles.previewEffectsList}>
                    {effects.map((eff, i) => (
                      <div key={i} style={styles.previewEffectItem}>
                        <span style={{ ...styles.previewEffectBadge, backgroundColor: eff.color + '18', color: eff.color, borderColor: eff.color + '40' }}>
                          {eff.emoji} {eff.label}
                        </span>
                        <span style={styles.previewEffectValue}>{eff.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Button labels */}
              <div style={styles.previewButtons}>
                <div style={styles.previewButtonsLabel}>🎮 Button Labels</div>
                <div style={styles.previewButtonRow}>
                  <span style={styles.previewBtnEndTurn}>{endTurnLabel}</span>
                  <span style={styles.previewBtnTryAgain}>{tryAgainLabel}</span>
                </div>
              </div>

              {/* Movement destinations */}
              {destinations.length > 0 && (
                <div style={styles.previewMovement}>
                  <div style={styles.previewMovementLabel}>🚶 Next Spaces</div>
                  <div style={styles.previewDestList}>
                    {destinations.map((d, i) => (
                      <span key={i} style={styles.previewDestChip}>{d}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Group 1: Identity & Config */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.identity}` }}>
          <legend style={styles.legend}>🏷️ Identity & Config</legend>
          <div style={styles.fieldRow}>
            <Field label="Space Name" value={currentSpace.space_name} readOnly />
            <Field label="Visit Type" value={currentSpace.visit_type} readOnly />
          </div>
          <div style={styles.fieldRow}>
            <SelectField
              label="Phase"
              value={currentSpace.phase}
              options={PHASES as unknown as string[]}
              onChange={(v) => handleChange('phase', v)}
            />
            <SelectField
              label="Path"
              value={currentSpace.path}
              options={PATH_TYPES as unknown as string[]}
              onChange={(v) => handleChange('path', v)}
            />
          </div>
          <div style={styles.fieldRow}>
            <SelectField
              label="Requires Dice Roll"
              value={currentSpace.requires_dice_roll}
              options={YES_NO_LOWER_OPTIONS as unknown as string[]}
              onChange={(v) => handleChange('requires_dice_roll', v)}
            />
            <Field
              label="Rolls"
              value={currentSpace.rolls}
              type="number"
              onChange={(v) => handleChange('rolls', v)}
            />
            <SelectField
              label="Negotiate"
              value={currentSpace.Negotiate}
              options={YES_NO_OPTIONS as unknown as string[]}
              onChange={(v) => handleChange('Negotiate', v)}
            />
          </div>
        </fieldset>

        {/* Group 2: Story & Narrative */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.story}` }}>
          <legend style={styles.legend}>📖 Story & Narrative</legend>
          <Field
            label="Title"
            value={currentSpace.Title}
            onChange={(v) => handleChange('Title', v)}
            placeholder="e.g., Owner Scope Initiation"
          />
          <TextareaField
            label="Event (Story)"
            value={currentSpace.Event}
            onChange={(v) => handleChange('Event', v)}
          />
          <TextareaField
            label="Action"
            value={currentSpace.Action}
            onChange={(v) => handleChange('Action', v)}
          />
          <TextareaField
            label="Outcome"
            value={currentSpace.Outcome}
            onChange={(v) => handleChange('Outcome', v)}
          />
        </fieldset>

        {/* Group 3: Card Effects */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.cards}` }}>
          <legend style={styles.legend}>🃏 Card Effects</legend>
          <div style={styles.fieldRow}>
            <CardField
              type="W"
              value={currentSpace.w_card}
              onChange={(v) => handleChange('w_card', v)}
            />
            <CardField
              type="B"
              value={currentSpace.b_card}
              onChange={(v) => handleChange('b_card', v)}
            />
          </div>
          <div style={styles.fieldRow}>
            <CardField
              type="I"
              value={currentSpace.i_card}
              onChange={(v) => handleChange('i_card', v)}
            />
            <CardField
              type="L"
              value={currentSpace.l_card}
              onChange={(v) => handleChange('l_card', v)}
            />
            <CardField
              type="E"
              value={currentSpace.e_card}
              onChange={(v) => handleChange('e_card', v)}
            />
          </div>
        </fieldset>

        {/* Group 4: Time & Costs */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.costs}` }}>
          <legend style={styles.legend}>⏱️ Time & Costs</legend>
          <div style={styles.fieldRow}>
            <Field
              label="⏱️ Time"
              value={currentSpace.Time}
              onChange={(v) => handleChange('Time', v)}
              placeholder="e.g., 5 days"
            />
            <Field
              label="💰 Fee"
              value={currentSpace.Fee}
              onChange={(v) => handleChange('Fee', v)}
              placeholder="e.g., 8%"
            />
          </div>
        </fieldset>

        {/* Group 5: Movement */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.movement}` }}>
          <legend style={styles.legend}>🚶 Movement Destinations</legend>
          <div style={styles.fieldRow}>
            <SpaceSelectField
              label="Space 1"
              value={currentSpace.space_1}
              options={allSpaceNames}
              onChange={(v) => handleChange('space_1', v)}
            />
            <SpaceSelectField
              label="Space 2"
              value={currentSpace.space_2}
              options={allSpaceNames}
              onChange={(v) => handleChange('space_2', v)}
            />
          </div>
          <div style={styles.fieldRow}>
            <SpaceSelectField
              label="Space 3"
              value={currentSpace.space_3}
              options={allSpaceNames}
              onChange={(v) => handleChange('space_3', v)}
            />
            <SpaceSelectField
              label="Space 4"
              value={currentSpace.space_4}
              options={allSpaceNames}
              onChange={(v) => handleChange('space_4', v)}
            />
            <SpaceSelectField
              label="Space 5"
              value={currentSpace.space_5}
              options={allSpaceNames}
              onChange={(v) => handleChange('space_5', v)}
            />
          </div>
        </fieldset>

        {/* Group 6: Button Labels Preview */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.buttons}` }}>
          <legend style={styles.legend}>🎮 Button Labels Preview</legend>
          <div style={styles.buttonPreviewRow}>
            <div style={styles.buttonPreviewItem}>
              <span style={styles.buttonPreviewLabel}>End Turn shows:</span>
              <span style={styles.buttonPreviewEndTurn}>{endTurnLabel}</span>
            </div>
            <div style={styles.buttonPreviewItem}>
              <span style={styles.buttonPreviewLabel}>Try Again shows:</span>
              <span style={styles.buttonPreviewTryAgain}>{tryAgainLabel}</span>
            </div>
          </div>
          <div style={styles.buttonPreviewHint}>
            Based on Title="{currentSpace.Title || '(empty)'}" + Negotiate="{currentSpace.Negotiate || '(empty)'}"
          </div>
        </fieldset>
      </div>
    </div>
  );
}

// Field Components
interface FieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
}

function Field({ label, value, onChange, readOnly, type = 'text', placeholder }: FieldProps): JSX.Element {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          ...styles.input,
          ...(readOnly ? styles.inputReadOnly : {})
        }}
      />
    </div>
  );
}

interface CardFieldProps {
  type: string;
  value: string;
  onChange: (value: string) => void;
}

function CardField({ type, value, onChange }: CardFieldProps): JSX.Element {
  const cc = CARD_COLORS[type];
  return (
    <div style={styles.field}>
      <label style={{ ...styles.label, color: cc.text }}>
        <span style={{ ...styles.cardBadge, backgroundColor: cc.bg, borderColor: cc.border, color: cc.primary }}>
          {cc.emoji} {type}
        </span>
        {' '}{cc.label}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g., Draw 1`}
        style={{
          ...styles.input,
          backgroundColor: value ? cc.bg : undefined,
          borderColor: value ? cc.border + '60' : undefined,
        }}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function SelectField({ label, value, options, onChange }: SelectFieldProps): JSX.Element {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
      >
        <option value="">-- Select --</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

interface SpaceSelectFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function SpaceSelectField({ label, value, options, onChange }: SpaceSelectFieldProps): JSX.Element {
  const isComplexValue = value && !options.includes(value) && value.length > 0;

  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {isComplexValue ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
          title="Complex value - edit directly"
        />
      ) : (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={styles.select}
        >
          <option value="">-- None --</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  );
}

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function TextareaField({ label, value, onChange }: TextareaFieldProps): JSX.Element {
  return (
    <div style={styles.textareaField}>
      <label style={styles.label}>{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={styles.textarea}
        rows={3}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden'
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#495057'
  },
  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  placeholderText: {
    fontSize: '16px'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #dee2e6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  spaceName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#212529'
  },
  visitToggle: {
    display: 'flex',
    gap: '4px'
  },
  toggleButton: {
    padding: '6px 12px',
    border: '1px solid #ced4da',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '4px'
  },
  toggleButtonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff'
  },
  formContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px'
  },
  fieldset: {
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    padding: '12px 16px',
    marginBottom: '16px',
    backgroundColor: 'white'
  },
  legend: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#495057',
    padding: '0 8px'
  },
  fieldRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px'
  },
  field: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  textareaField: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '12px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#343a40',
    marginBottom: '4px'
  },
  input: {
    padding: '8px 10px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    width: '100%',
    boxSizing: 'border-box'
  },
  inputReadOnly: {
    backgroundColor: '#e9ecef',
    color: '#6c757d'
  },
  select: {
    padding: '8px 10px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: 'white',
    width: '100%',
    boxSizing: 'border-box'
  },
  textarea: {
    padding: '8px 10px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    resize: 'vertical',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box'
  },

  // Card badge
  cardBadge: {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 700,
    border: '1px solid',
    verticalAlign: 'middle',
  },

  // Preview panel
  previewContainer: {
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    marginBottom: '16px',
    backgroundColor: '#fafbfc',
    overflow: 'hidden',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    color: '#343a40',
    backgroundColor: '#f1f3f5',
    userSelect: 'none',
  },
  previewBody: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  previewStory: {},
  previewStoryLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '4px',
  },
  previewStoryText: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#2c3e50',
    padding: '10px 12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '2px solid #4caf50',
    fontWeight: 500,
  },
  previewEmpty: {
    fontSize: '13px',
    color: '#adb5bd',
    fontStyle: 'italic',
  },
  previewEffects: {},
  previewEffectsLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '4px',
  },
  previewEffectsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  previewEffectItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  previewEffectBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid',
  },
  previewEffectValue: {
    color: '#343a40',
    fontSize: '13px',
  },
  previewButtons: {},
  previewButtonsLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '4px',
  },
  previewButtonRow: {
    display: 'flex',
    gap: '8px',
  },
  previewBtnEndTurn: {
    display: 'inline-block',
    padding: '5px 14px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
  },
  previewBtnTryAgain: {
    display: 'inline-block',
    padding: '5px 14px',
    backgroundColor: '#ffc107',
    color: '#212529',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
  },
  previewMovement: {},
  previewMovementLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '4px',
  },
  previewDestList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  previewDestChip: {
    display: 'inline-block',
    padding: '3px 10px',
    backgroundColor: '#e3f2fd',
    color: '#007bff',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    border: '1px solid #007bff40',
  },

  // Button Labels Preview fieldset
  buttonPreviewRow: {
    display: 'flex',
    gap: '20px',
    marginBottom: '8px',
  },
  buttonPreviewItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  buttonPreviewLabel: {
    fontSize: '12px',
    color: '#495057',
  },
  buttonPreviewEndTurn: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
  },
  buttonPreviewTryAgain: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#ffc107',
    color: '#212529',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
  },
  buttonPreviewHint: {
    fontSize: '11px',
    color: '#868e96',
    fontStyle: 'italic',
  },
};
