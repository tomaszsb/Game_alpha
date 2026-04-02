import React, { useState } from 'react';
import { SpaceRow, DiceRollRow, PHASES, PATH_TYPES, YES_NO_OPTIONS, YES_NO_LOWER_OPTIONS, SHAKE_OPTIONS, TTS_FIELD_OPTIONS } from './types/EditorTypes';
import { InlineDiceRollEditor } from './InlineDiceRollEditor';

interface SpaceEditorProps {
  spaceFirst: SpaceRow | null;
  spaceSubsequent: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  allSpaceNames: string[];
  diceRollData: DiceRollRow[];
  onVisitTypeChange: (visitType: 'First' | 'Subsequent') => void;
  onFieldChange: (visitType: 'First' | 'Subsequent', field: keyof SpaceRow, value: string) => void;
  onUpdateDiceRoll: (index: number, field: keyof DiceRollRow, value: string) => void;
  onAddDiceRoll: (diceRoll: DiceRollRow) => void;
  onDeleteDiceRoll: (index: number) => void;
}

// Card type colors matching theme.ts cardTypes
const CARD_COLORS: Record<string, { primary: string; bg: string; border: string; text: string; emoji: string; label: string }> = {
  W: { primary: '#6f42c1', bg: '#f3e5f5', border: '#6f42c1', text: '#4a148c', emoji: '🏗️', label: 'Scope Worktypes' },
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
  dice: '#ff9800',
  buttons: '#868e96',
};

export function SpaceEditor({
  spaceFirst,
  spaceSubsequent,
  visitType,
  allSpaceNames,
  diceRollData,
  onVisitTypeChange,
  onFieldChange,
  onUpdateDiceRoll,
  onAddDiceRoll,
  onDeleteDiceRoll,
}: SpaceEditorProps): JSX.Element {
  const currentSpace = visitType === 'First' ? spaceFirst : spaceSubsequent;

  if (!currentSpace) {
    return (
      <div style={styles.placeholder}>
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📍</div>
        <div style={{ fontSize: '14px', color: '#495057' }}>Select a space to edit</div>
      </div>
    );
  }

  const handleChange = (field: keyof SpaceRow, value: string) => {
    onFieldChange(visitType, field, value);
  };

  return (
    <div style={styles.container}>
      {/* Header with space name, title, and visit type toggle */}
      <div style={styles.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={styles.spaceName}>{currentSpace.space_name}</h3>
            <input
              type="text"
              value={currentSpace.Title || ''}
              onChange={(e) => handleChange('Title', e.target.value)}
              placeholder="Display name..."
              style={styles.titleInline}
            />
          </div>
        </div>
        <div style={styles.visitToggle}>
          <button
            onClick={() => onVisitTypeChange('First')}
            style={{
              ...styles.toggleButton,
              ...(visitType === 'First' ? styles.toggleButtonActive : {})
            }}
          >
            1st
          </button>
          <button
            onClick={() => onVisitTypeChange('Subsequent')}
            style={{
              ...styles.toggleButton,
              ...(visitType === 'Subsequent' ? styles.toggleButtonActive : {})
            }}
          >
            Sub
          </button>
        </div>
      </div>

      <div style={styles.formContainer}>
        {/* Identity & Config */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.identity}` }}>
          <legend style={styles.legend}>🏷️ Identity & Config</legend>
          <div style={styles.fieldRow}>
            <Field label="Space Name" value={currentSpace.space_name} readOnly />
            <Field label="Visit Type" value={currentSpace.visit_type} readOnly />
            <SelectField
              label="Phase"
              value={currentSpace.phase}
              options={PHASES as unknown as string[]}
              onChange={(v) => handleChange('phase', v)}
            />
            <SelectField
              label="Dice Roll?"
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

        {/* Button Labels */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.buttons}` }}>
          <legend style={styles.legend}>🎮 Button Labels</legend>
          <div style={styles.fieldRow}>
            <Field
              label="End Turn Label"
              value={currentSpace.end_turn_label}
              onChange={(v) => handleChange('end_turn_label', v)}
              placeholder="End Turn"
            />
            <Field
              label="Try Again Label"
              value={currentSpace.try_again_label}
              onChange={(v) => handleChange('try_again_label', v)}
              placeholder="Try Again"
            />
            <div style={styles.field}>
              <label style={styles.label}>Preview</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={styles.btnPreviewGreen}>{currentSpace.end_turn_label || 'End Turn'}</span>
                {currentSpace.Negotiate === 'YES' && (
                  <span style={styles.btnPreviewYellow}>{currentSpace.try_again_label || 'Try Again'}</span>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Story & Narrative */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.story}` }}>
          <legend style={styles.legend}>📖 Story & Narrative</legend>
          <TextareaField
            label="Event (Story)"
            value={currentSpace.Event}
            onChange={(v) => handleChange('Event', v)}
            rows={2}
          />
          <TextareaField
            label="Action"
            value={currentSpace.Action}
            onChange={(v) => handleChange('Action', v)}
            rows={2}
          />
          <TextareaField
            label="Outcome"
            value={currentSpace.Outcome}
            onChange={(v) => handleChange('Outcome', v)}
            rows={2}
          />
          <div style={styles.fieldRow}>
            <SelectField
              label="Shake On"
              value={currentSpace.shake_on}
              options={[...SHAKE_OPTIONS]}
              onChange={(v) => handleChange('shake_on', v)}
            />
            <SelectField
              label="TTS Field"
              value={currentSpace.tts_field}
              options={[...TTS_FIELD_OPTIONS]}
              onChange={(v) => handleChange('tts_field', v)}
            />
          </div>
        </fieldset>

        {/* Card Effects + Time & Costs */}
        <div style={styles.fieldRow}>
          <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.cards}`, flex: 1 }}>
            <legend style={styles.legend}>🃏 (C) Actions</legend>
            <div style={styles.cardGrid}>
              <CardFieldWithLabel type="W" value={currentSpace.w_card} label={currentSpace.w_card_label}
                onChange={(v) => handleChange('w_card', v)} onLabelChange={(v) => handleChange('w_card_label', v)} />
              <CardFieldWithLabel type="B" value={currentSpace.b_card} label={currentSpace.b_card_label}
                onChange={(v) => handleChange('b_card', v)} onLabelChange={(v) => handleChange('b_card_label', v)} />
              <CardFieldWithLabel type="I" value={currentSpace.i_card} label={currentSpace.i_card_label}
                onChange={(v) => handleChange('i_card', v)} onLabelChange={(v) => handleChange('i_card_label', v)} />
              <CardFieldWithLabel type="L" value={currentSpace.l_card} label={currentSpace.l_card_label}
                onChange={(v) => handleChange('l_card', v)} onLabelChange={(v) => handleChange('l_card_label', v)} />
              <CardFieldWithLabel type="E" value={currentSpace.e_card} label={currentSpace.e_card_label}
                onChange={(v) => handleChange('e_card', v)} onLabelChange={(v) => handleChange('e_card_label', v)} />
            </div>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>⏱️ Time</label>
                <TimeInput value={currentSpace.Time} onChange={(v) => handleChange('Time', v)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>💰 Fee</label>
                <FeeInput value={currentSpace.Fee} onChange={(v) => handleChange('Fee', v)} />
              </div>
              <div style={{ flex: 3 }} />
            </div>
          </fieldset>
        </div>

        {/* Dice Rolls — inline */}
        {currentSpace.requires_dice_roll?.toLowerCase() === 'yes' && (
          <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.dice}` }}>
            <legend style={styles.legend}>🎲 (D) Actions</legend>
            <InlineDiceRollEditor
              diceRolls={diceRollData}
              spaceName={currentSpace.space_name}
              visitType={visitType}
              allSpaceNames={allSpaceNames}
              onUpdateDiceRoll={onUpdateDiceRoll}
              onAddDiceRoll={onAddDiceRoll}
              onDeleteDiceRoll={onDeleteDiceRoll}
            />
          </fieldset>
        )}

        {/* Movement */}
        <fieldset style={{ ...styles.fieldset, borderLeft: `3px solid ${SECTION_COLORS.movement}` }}>
          <legend style={styles.legend}>🚶 Movement Destinations</legend>
          <div style={{ ...styles.fieldRow, marginBottom: '6px' }}>
            <SelectField
              label="Path Type"
              value={currentSpace.path}
              options={PATH_TYPES as unknown as string[]}
              onChange={(v) => handleChange('path', v)}
            />
            <div style={{ flex: 3 }} />
          </div>
          {currentSpace.path === 'LOGIC' ? (
            <LogicBuilder
              currentSpace={currentSpace}
              allSpaceNames={allSpaceNames}
              onFieldChange={handleChange}
            />
          ) : (
            <div style={styles.fieldRow}>
              <SpaceSelectField label="1" value={currentSpace.space_1} options={allSpaceNames} onChange={(v) => handleChange('space_1', v)} />
              <SpaceSelectField label="2" value={currentSpace.space_2} options={allSpaceNames} onChange={(v) => handleChange('space_2', v)} />
              <SpaceSelectField label="3" value={currentSpace.space_3} options={allSpaceNames} onChange={(v) => handleChange('space_3', v)} />
              <SpaceSelectField label="4" value={currentSpace.space_4} options={allSpaceNames} onChange={(v) => handleChange('space_4', v)} />
              <SpaceSelectField label="5" value={currentSpace.space_5} options={allSpaceNames} onChange={(v) => handleChange('space_5', v)} />
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}

// ─── Field Components ──────────────────────────────────────

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

function CardField({ type, value, onChange }: { type: string; value: string; onChange: (v: string) => void }): JSX.Element {
  const cc = CARD_COLORS[type];
  const isPreset = !value || CARD_PRESETS.includes(value);
  const [useCustom, setUseCustom] = useState(!isPreset && !!value);

  return (
    <div style={styles.field}>
      <label style={{ ...styles.label, color: cc.text }}>
        <span style={{ ...styles.cardBadge, backgroundColor: cc.bg, borderColor: cc.border, color: cc.primary }}>
          {cc.emoji} {type}
        </span>
      </label>
      {useCustom ? (
        <div style={styles.comboRow}>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Custom..."
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
          >▼</button>
        </div>
      ) : (
        <select
          value={value || ''}
          onChange={(e) => {
            if (e.target.value === '__custom__') setUseCustom(true);
            else onChange(e.target.value);
          }}
          style={{
            ...styles.select,
            backgroundColor: value ? cc.bg : undefined,
            borderColor: value ? cc.border + '60' : undefined,
          }}
        >
          <option value="">--</option>
          {CARD_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">Custom...</option>
        </select>
      )}
    </div>
  );
}

function CardFieldWithLabel({ type, value, label, onChange, onLabelChange }: {
  type: string; value: string; label: string; onChange: (v: string) => void; onLabelChange: (v: string) => void;
}): JSX.Element {
  const cc = CARD_COLORS[type];
  const isPreset = !value || CARD_PRESETS.includes(value);
  const [useCustom, setUseCustom] = useState(!isPreset && !!value);

  return (
    <div style={styles.cardWithLabel}>
      <label style={{ ...styles.label, color: cc.text }}>
        <span style={{ ...styles.cardBadge, backgroundColor: cc.bg, borderColor: cc.border, color: cc.primary }}>
          {cc.emoji} {type}
        </span>
      </label>
      <div style={{ display: 'flex', gap: '3px' }}>
        {useCustom ? (
          <div style={{ ...styles.comboRow, flex: 1 }}>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Custom..."
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
            >▼</button>
          </div>
        ) : (
          <select
            value={value || ''}
            onChange={(e) => {
              if (e.target.value === '__custom__') setUseCustom(true);
              else onChange(e.target.value);
            }}
            style={{
              ...styles.select,
              flex: 1,
              backgroundColor: value ? cc.bg : undefined,
              borderColor: value ? cc.border + '60' : undefined,
            }}
          >
            <option value="">--</option>
            {CARD_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="__custom__">Custom...</option>
          </select>
        )}
        <input
          type="text"
          value={label || ''}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Button label..."
          disabled={!value}
          style={{
            ...styles.input,
            flex: 1,
            fontSize: '11px',
            opacity: value ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }): JSX.Element {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.select}>
        <option value="">--</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function SpaceSelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }): JSX.Element {
  const isComplex = value && !options.includes(value) && value.length > 0;
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {isComplex ? (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.input} title="Complex value" />
      ) : (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.select}>
          <option value="">--</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }): JSX.Element {
  return (
    <div style={styles.textareaField}>
      <label style={styles.label}>{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={styles.textarea}
        rows={rows}
      />
    </div>
  );
}

// Time inline input
function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const timeMatch = value?.match(/^(\d+)\s*days?$/i);
  const isNumeric = !value || timeMatch;
  if (!isNumeric) {
    return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.input} />;
  }
  const numDays = timeMatch ? parseInt(timeMatch[1]) : 0;
  return (
    <div style={styles.helperRow}>
      <input
        type="number" min="0" value={numDays || ''}
        onChange={(e) => {
          const n = parseInt(e.target.value);
          onChange(!e.target.value || n <= 0 ? '' : `${n} ${n === 1 ? 'day' : 'days'}`);
        }}
        style={{ ...styles.input, flex: 1 }} placeholder="0"
      />
      <span style={styles.helperSuffix}>days</span>
    </div>
  );
}

// Fee inline input
function FeeInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const feeMatch = value?.match(/^(\d+(?:\.\d+)?)\s*%$/);
  const isPercent = !value || feeMatch;
  if (!isPercent) {
    return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.input} />;
  }
  return (
    <div style={styles.helperRow}>
      <input
        type="number" min="0" step="0.5" value={feeMatch ? feeMatch[1] : ''}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}%` : '')}
        style={{ ...styles.input, flex: 1 }} placeholder="0"
      />
      <span style={styles.helperSuffix}>%</span>
    </div>
  );
}

// ─── LOGIC Builder ──────────────────────────────────────

function parseLogicCondition(value: string): { question: string; yes: string; no: string } | null {
  if (!value) return null;
  const match = value.match(/^(.+?)\s+YES\s*-\s*(.+?)\s*-\s*NO\s*-\s*(.+)$/i);
  if (!match) return null;
  return { question: match[1].trim(), yes: match[2].trim(), no: match[3].trim() };
}

function LogicBuilder({ currentSpace, allSpaceNames, onFieldChange }: {
  currentSpace: SpaceRow; allSpaceNames: string[]; onFieldChange: (field: keyof SpaceRow, value: string) => void;
}): JSX.Element {
  const spaceFields = ['space_1', 'space_2', 'space_3', 'space_4', 'space_5'] as const;
  const destOptions = [...allSpaceNames, 'Space 2', 'Space 3', 'Space 4', 'Space 5'];

  return (
    <div style={styles.logicBuilder}>
      {spaceFields.map((field, idx) => {
        const raw = currentSpace[field];
        if (!raw && idx > 0) {
          if (!currentSpace.space_1 && idx > 0) return null;
          return (
            <div key={field}>
              <label style={styles.label}>Dest {idx + 1}</label>
              <SpaceSelectField label="" value="" options={allSpaceNames} onChange={(v) => onFieldChange(field, v)} />
            </div>
          );
        }
        if (!raw) {
          return (
            <div key={field}>
              <label style={styles.label}>Dest {idx + 1} (LOGIC)</label>
              <LogicFieldBuilder value="" allSpaceNames={destOptions} onChange={(v) => onFieldChange(field, v)} />
            </div>
          );
        }
        const parsed = parseLogicCondition(raw);
        if (!parsed) {
          return (
            <div key={field} style={{ marginBottom: '4px' }}>
              <label style={styles.label}>Dest {idx + 1}</label>
              <input type="text" value={raw} onChange={(e) => onFieldChange(field, e.target.value)} style={styles.input} />
              <div style={styles.logicFallback}>Complex — edit as text</div>
            </div>
          );
        }
        return (
          <div key={field} style={{ marginBottom: '4px' }}>
            <label style={styles.label}>Dest {idx + 1} (LOGIC)</label>
            <LogicFieldBuilder value={raw} allSpaceNames={destOptions} onChange={(v) => onFieldChange(field, v)} />
          </div>
        );
      })}
    </div>
  );
}

function LogicFieldBuilder({ value, allSpaceNames, onChange }: {
  value: string; allSpaceNames: string[]; onChange: (v: string) => void;
}): JSX.Element {
  const parsed = parseLogicCondition(value);
  const [question, setQuestion] = useState(parsed?.question || '');
  const [yesDest, setYesDest] = useState(parsed?.yes || '');
  const [noDest, setNoDest] = useState(parsed?.no || '');

  const rebuild = (q: string, y: string, n: string) => {
    onChange(!q && !y && !n ? '' : `${q} YES - ${y} - NO - ${n}`);
  };

  return (
    <div style={styles.logicBuilder}>
      <div style={styles.logicRow}>
        <span style={styles.logicLabel}>Q</span>
        <input type="text" value={question}
          onChange={(e) => { setQuestion(e.target.value); rebuild(e.target.value, yesDest, noDest); }}
          placeholder="e.g., Is scope ≤ $4M?" style={{ ...styles.input, flex: 1 }}
        />
      </div>
      <div style={styles.logicRow}>
        <span style={styles.logicYes}>Y→</span>
        <select value={allSpaceNames.includes(yesDest) ? yesDest : ''}
          onChange={(e) => { setYesDest(e.target.value); rebuild(question, e.target.value, noDest); }}
          style={{ ...styles.select, flex: 1 }}
        >
          <option value="">--</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {yesDest && !allSpaceNames.includes(yesDest) && (
          <input type="text" value={yesDest}
            onChange={(e) => { setYesDest(e.target.value); rebuild(question, e.target.value, noDest); }}
            style={{ ...styles.input, flex: 1 }}
          />
        )}
      </div>
      <div style={styles.logicRow}>
        <span style={styles.logicNo}>N→</span>
        <select value={allSpaceNames.includes(noDest) ? noDest : ''}
          onChange={(e) => { setNoDest(e.target.value); rebuild(question, yesDest, e.target.value); }}
          style={{ ...styles.select, flex: 1 }}
        >
          <option value="">--</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {noDest && !allSpaceNames.includes(noDest) && (
          <input type="text" value={noDest}
            onChange={(e) => { setNoDest(e.target.value); rebuild(question, yesDest, e.target.value); }}
            style={{ ...styles.input, flex: 1 }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Styles (compact) ──────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
  header: {
    padding: '6px 12px', borderBottom: '1px solid #dee2e6',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa',
  },
  spaceName: { margin: 0, fontSize: '15px', fontWeight: 600, color: '#212529', flexShrink: 0 },
  titleInline: {
    padding: '3px 8px', fontSize: '13px', border: '1px solid #ced4da',
    borderRadius: '3px', flex: 1, minWidth: '120px', color: '#495057',
    fontStyle: 'italic' as const, boxSizing: 'border-box' as const,
  },
  visitToggle: { display: 'flex', gap: '2px' },
  toggleButton: {
    padding: '4px 10px', border: '1px solid #ced4da', backgroundColor: 'white',
    cursor: 'pointer', fontSize: '12px', borderRadius: '3px',
  },
  toggleButtonActive: { backgroundColor: '#007bff', color: 'white', borderColor: '#007bff' },
  formContainer: { flex: 1, overflowY: 'auto', padding: '8px' },
  fieldset: {
    border: '1px solid #dee2e6', borderRadius: '4px', padding: '6px 10px',
    marginBottom: '8px', backgroundColor: 'white',
  },
  legend: { fontSize: '11px', fontWeight: 600, color: '#495057', padding: '0 4px' },
  fieldRow: { display: 'flex', gap: '6px', marginBottom: '6px' },
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '6px',
  },
  cardWithLabel: { display: 'flex', flexDirection: 'column' as const, minWidth: 0 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  textareaField: { display: 'flex', flexDirection: 'column', marginBottom: '6px' },
  label: { fontSize: '10px', fontWeight: 600, color: '#343a40', marginBottom: '2px' },
  input: {
    padding: '4px 6px', fontSize: '12px', border: '1px solid #ced4da',
    borderRadius: '3px', width: '100%', boxSizing: 'border-box' as const,
  },
  inputReadOnly: { backgroundColor: '#e9ecef', color: '#6c757d' },
  select: {
    padding: '4px 6px', fontSize: '12px', border: '1px solid #ced4da',
    borderRadius: '3px', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' as const,
  },
  textarea: {
    padding: '4px 6px', fontSize: '12px', border: '1px solid #ced4da', borderRadius: '3px',
    resize: 'vertical' as const, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const,
  },
  cardBadge: {
    display: 'inline-block', padding: '0px 4px', borderRadius: '2px',
    fontSize: '10px', fontWeight: 700, border: '1px solid', verticalAlign: 'middle',
  },
  comboRow: { display: 'flex', gap: '2px', alignItems: 'center' },
  comboToggle: {
    padding: '3px 6px', border: '1px solid #ced4da', borderRadius: '3px',
    backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '10px', flexShrink: 0,
  },
  helperRow: { display: 'flex', gap: '4px', alignItems: 'center' },
  helperSuffix: { fontSize: '12px', color: '#495057', fontWeight: 500, flexShrink: 0 },
  logicBuilder: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  logicRow: { display: 'flex', gap: '4px', alignItems: 'center' },
  logicLabel: { fontSize: '11px', fontWeight: 600, color: '#343a40', minWidth: '20px', flexShrink: 0 },
  logicYes: { fontSize: '11px', fontWeight: 700, color: '#28a745', minWidth: '20px', flexShrink: 0 },
  logicNo: { fontSize: '11px', fontWeight: 700, color: '#dc3545', minWidth: '20px', flexShrink: 0 },
  logicFallback: { fontSize: '10px', color: '#868e96', fontStyle: 'italic', marginTop: '2px' },
  // Button label preview
  btnPreviewGreen: {
    display: 'inline-block', padding: '3px 10px', backgroundColor: '#28a745',
    color: 'white', borderRadius: '3px', fontSize: '12px', fontWeight: 600,
  },
  btnPreviewYellow: {
    display: 'inline-block', padding: '3px 10px', backgroundColor: '#ffc107',
    color: '#212529', borderRadius: '3px', fontSize: '12px', fontWeight: 600,
  },
};
