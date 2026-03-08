import React, { useState } from 'react';
import { SpaceRow, PHASES, PATH_TYPES, YES_NO_OPTIONS, YES_NO_LOWER_OPTIONS } from './types/EditorTypes';
// Note: Player Preview has been moved to PlayerPreviewPanel.tsx (right-side panel)

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
};


export function SpaceEditor({
  spaceFirst,
  spaceSubsequent,
  visitType,
  allSpaceNames,
  onVisitTypeChange,
  onFieldChange
}: SpaceEditorProps): JSX.Element {
  const currentSpace = visitType === 'First' ? spaceFirst : spaceSubsequent;

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
            <TimeField
              value={currentSpace.Time}
              onChange={(v) => handleChange('Time', v)}
            />
            <FeeField
              value={currentSpace.Fee}
              onChange={(v) => handleChange('Fee', v)}
            />
          </div>
        </fieldset>

        {/* Group 5: Movement */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.movement}` }}>
          <legend style={styles.legend}>🚶 Movement Destinations</legend>
          {currentSpace.path === 'LOGIC' ? (
            <LogicBuilder
              currentSpace={currentSpace}
              allSpaceNames={allSpaceNames}
              onFieldChange={handleChange}
            />
          ) : (
            <>
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
            </>
          )}
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

const CARD_PRESETS = ['Draw 1', 'Draw 2', 'Draw 3', 'Remove 1', 'Replace 1', 'No change'];

interface CardFieldProps {
  type: string;
  value: string;
  onChange: (value: string) => void;
}

function CardField({ type, value, onChange }: CardFieldProps): JSX.Element {
  const cc = CARD_COLORS[type];
  const isPreset = !value || CARD_PRESETS.includes(value);
  const [useCustom, setUseCustom] = useState(!isPreset && !!value);

  return (
    <div style={styles.field}>
      <label style={{ ...styles.label, color: cc.text }}>
        <span style={{ ...styles.cardBadge, backgroundColor: cc.bg, borderColor: cc.border, color: cc.primary }}>
          {cc.emoji} {type}
        </span>
        {' '}{cc.label}
      </label>
      {useCustom ? (
        <div style={styles.comboRow}>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Custom card effect..."
            style={{
              ...styles.input,
              flex: 1,
              backgroundColor: value ? cc.bg : undefined,
              borderColor: value ? cc.border + '60' : undefined,
            }}
          />
          <button
            onClick={() => { setUseCustom(false); if (!CARD_PRESETS.includes(value)) onChange(''); }}
            style={styles.comboToggle}
            title="Switch to dropdown"
          >
            ▼
          </button>
        </div>
      ) : (
        <div style={styles.comboRow}>
          <select
            value={value || ''}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setUseCustom(true);
              } else {
                onChange(e.target.value);
              }
            }}
            style={{
              ...styles.select,
              flex: 1,
              backgroundColor: value ? cc.bg : undefined,
              borderColor: value ? cc.border + '60' : undefined,
            }}
          >
            <option value="">-- None --</option>
            {CARD_PRESETS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
        </div>
      )}
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

// LOGIC condition builder for spaces with path === 'LOGIC'
// Parses/generates: "{question} YES - {yesDest} - NO - {noDest}"
function parseLogicCondition(value: string): { question: string; yes: string; no: string } | null {
  if (!value) return null;
  const match = value.match(/^(.+?)\s+YES\s*-\s*(.+?)\s*-\s*NO\s*-\s*(.+)$/i);
  if (!match) return null;
  return { question: match[1].trim(), yes: match[2].trim(), no: match[3].trim() };
}

function LogicBuilder({
  currentSpace,
  allSpaceNames,
  onFieldChange
}: {
  currentSpace: SpaceRow;
  allSpaceNames: string[];
  onFieldChange: (field: keyof SpaceRow, value: string) => void;
}): JSX.Element {
  // Build logic entries for each space_N field
  const spaceFields = ['space_1', 'space_2', 'space_3', 'space_4', 'space_5'] as const;
  const destOptions = [...allSpaceNames, 'Space 2', 'Space 3', 'Space 4', 'Space 5'];

  return (
    <div style={styles.logicBuilder}>
      {spaceFields.map((field, idx) => {
        const raw = currentSpace[field];
        if (!raw && idx > 0) {
          // Only show empty slots after the first if space_1 exists
          if (!currentSpace.space_1 && idx > 0) return null;
          // Show a simple add field for empty subsequent slots
          return (
            <div key={field}>
              <label style={styles.label}>Destination {idx + 1}</label>
              <SpaceSelectField
                label=""
                value=""
                options={allSpaceNames}
                onChange={(v) => onFieldChange(field, v)}
              />
            </div>
          );
        }
        if (!raw) {
          return (
            <div key={field}>
              <label style={styles.label}>Destination {idx + 1} (LOGIC)</label>
              <LogicFieldBuilder
                value=""
                allSpaceNames={destOptions}
                onChange={(v) => onFieldChange(field, v)}
              />
            </div>
          );
        }

        const parsed = parseLogicCondition(raw);
        if (!parsed) {
          // Non-parseable: show as plain text + space select
          return (
            <div key={field} style={{ marginBottom: '8px' }}>
              <label style={styles.label}>Destination {idx + 1}</label>
              <input
                type="text"
                value={raw}
                onChange={(e) => onFieldChange(field, e.target.value)}
                style={styles.input}
              />
              <div style={styles.logicFallback}>Complex value - edit as text</div>
            </div>
          );
        }

        return (
          <div key={field} style={{ marginBottom: '8px' }}>
            <label style={styles.label}>Destination {idx + 1} (LOGIC)</label>
            <LogicFieldBuilder
              value={raw}
              allSpaceNames={destOptions}
              onChange={(v) => onFieldChange(field, v)}
            />
          </div>
        );
      })}
    </div>
  );
}

function LogicFieldBuilder({
  value,
  allSpaceNames,
  onChange
}: {
  value: string;
  allSpaceNames: string[];
  onChange: (v: string) => void;
}): JSX.Element {
  const parsed = parseLogicCondition(value);
  const [question, setQuestion] = useState(parsed?.question || '');
  const [yesDest, setYesDest] = useState(parsed?.yes || '');
  const [noDest, setNoDest] = useState(parsed?.no || '');

  const rebuild = (q: string, y: string, n: string) => {
    if (!q && !y && !n) {
      onChange('');
    } else {
      onChange(`${q} YES - ${y} - NO - ${n}`);
    }
  };

  return (
    <div style={styles.logicBuilder}>
      <div style={styles.logicRow}>
        <span style={styles.logicLabel}>Question</span>
        <input
          type="text"
          value={question}
          onChange={(e) => { setQuestion(e.target.value); rebuild(e.target.value, yesDest, noDest); }}
          placeholder="e.g., Is scope ≤ $4M?"
          style={{ ...styles.input, flex: 1 }}
        />
      </div>
      <div style={styles.logicRow}>
        <span style={styles.logicYes}>YES →</span>
        <select
          value={allSpaceNames.includes(yesDest) ? yesDest : ''}
          onChange={(e) => { setYesDest(e.target.value); rebuild(question, e.target.value, noDest); }}
          style={{ ...styles.select, flex: 1 }}
        >
          <option value="">-- Select --</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {yesDest && !allSpaceNames.includes(yesDest) && (
          <input
            type="text"
            value={yesDest}
            onChange={(e) => { setYesDest(e.target.value); rebuild(question, e.target.value, noDest); }}
            style={{ ...styles.input, flex: 1 }}
          />
        )}
      </div>
      <div style={styles.logicRow}>
        <span style={styles.logicNo}>NO →</span>
        <select
          value={allSpaceNames.includes(noDest) ? noDest : ''}
          onChange={(e) => { setNoDest(e.target.value); rebuild(question, yesDest, e.target.value); }}
          style={{ ...styles.select, flex: 1 }}
        >
          <option value="">-- Select --</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {noDest && !allSpaceNames.includes(noDest) && (
          <input
            type="text"
            value={noDest}
            onChange={(e) => { setNoDest(e.target.value); rebuild(question, yesDest, e.target.value); }}
            style={{ ...styles.input, flex: 1 }}
          />
        )}
      </div>
    </div>
  );
}

// Time field: number spinner + "days" label
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const timeMatch = value?.match(/^(\d+)\s*days?$/i);
  const isNumeric = !value || timeMatch;

  if (!isNumeric) {
    // Fallback to plain text for non-standard values
    return (
      <div style={styles.field}>
        <label style={styles.label}>⏱️ Time</label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
      </div>
    );
  }

  const numDays = timeMatch ? parseInt(timeMatch[1]) : 0;

  return (
    <div style={styles.field}>
      <label style={styles.label}>⏱️ Time</label>
      <div style={styles.helperRow}>
        <input
          type="number"
          min="0"
          value={numDays || ''}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            if (!e.target.value || n <= 0) {
              onChange('');
            } else {
              onChange(`${n} ${n === 1 ? 'day' : 'days'}`);
            }
          }}
          style={{ ...styles.input, flex: 1 }}
          placeholder="0"
        />
        <span style={styles.helperSuffix}>days</span>
      </div>
    </div>
  );
}

// Fee field: number input + "%" suffix
function FeeField({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const feeMatch = value?.match(/^(\d+(?:\.\d+)?)\s*%$/);
  const isPercent = !value || feeMatch;

  if (!isPercent) {
    return (
      <div style={styles.field}>
        <label style={styles.label}>💰 Fee</label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
      </div>
    );
  }

  const numFee = feeMatch ? feeMatch[1] : '';

  return (
    <div style={styles.field}>
      <label style={styles.label}>💰 Fee</label>
      <div style={styles.helperRow}>
        <input
          type="number"
          min="0"
          step="0.5"
          value={numFee}
          onChange={(e) => {
            if (!e.target.value) {
              onChange('');
            } else {
              onChange(`${e.target.value}%`);
            }
          }}
          style={{ ...styles.input, flex: 1 }}
          placeholder="0"
        />
        <span style={styles.helperSuffix}>%</span>
      </div>
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

  // Combo / helper styles
  comboRow: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  comboToggle: {
    padding: '6px 8px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: '#f8f9fa',
    cursor: 'pointer',
    fontSize: '12px',
    flexShrink: 0,
  },
  helperRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  helperSuffix: {
    fontSize: '14px',
    color: '#495057',
    fontWeight: 500,
    flexShrink: 0,
  },

  // LOGIC builder
  logicBuilder: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  logicRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  logicLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#343a40',
    minWidth: '60px',
    flexShrink: 0,
  },
  logicYes: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#28a745',
    minWidth: '40px',
    flexShrink: 0,
  },
  logicNo: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#dc3545',
    minWidth: '40px',
    flexShrink: 0,
  },
  logicFallback: {
    fontSize: '11px',
    color: '#868e96',
    fontStyle: 'italic',
    marginTop: '4px',
  },
};
