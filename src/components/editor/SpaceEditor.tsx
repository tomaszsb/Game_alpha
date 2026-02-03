import React from 'react';
import { SpaceRow, PHASES, PATH_TYPES, YES_NO_OPTIONS, YES_NO_LOWER_OPTIONS } from './types/EditorTypes';

interface SpaceEditorProps {
  spaceFirst: SpaceRow | null;
  spaceSubsequent: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  allSpaceNames: string[];
  onVisitTypeChange: (visitType: 'First' | 'Subsequent') => void;
  onFieldChange: (visitType: 'First' | 'Subsequent', field: keyof SpaceRow, value: string) => void;
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
        {/* Group 1: Identity (read-only) */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Identity</legend>
          <div style={styles.fieldRow}>
            <Field
              label="Space Name"
              value={currentSpace.space_name}
              readOnly
            />
            <Field
              label="Visit Type"
              value={currentSpace.visit_type}
              readOnly
            />
          </div>
        </fieldset>

        {/* Group 2: Configuration */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Configuration</legend>
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

        {/* Group 3: Narrative */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Narrative</legend>
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

        {/* Group 4: Card Effects */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Card Effects</legend>
          <div style={styles.fieldRow}>
            <Field
              label="W Card"
              value={currentSpace.w_card}
              onChange={(v) => handleChange('w_card', v)}
              placeholder="e.g., Draw 3"
            />
            <Field
              label="B Card"
              value={currentSpace.b_card}
              onChange={(v) => handleChange('b_card', v)}
              placeholder="e.g., Draw 1"
            />
          </div>
          <div style={styles.fieldRow}>
            <Field
              label="I Card"
              value={currentSpace.i_card}
              onChange={(v) => handleChange('i_card', v)}
              placeholder="e.g., Draw 1"
            />
            <Field
              label="L Card"
              value={currentSpace.l_card}
              onChange={(v) => handleChange('l_card', v)}
              placeholder="e.g., Draw 1"
            />
            <Field
              label="E Card"
              value={currentSpace.e_card}
              onChange={(v) => handleChange('e_card', v)}
              placeholder="e.g., Draw 1"
            />
          </div>
        </fieldset>

        {/* Group 5: Costs */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Costs</legend>
          <div style={styles.fieldRow}>
            <Field
              label="Time"
              value={currentSpace.Time}
              onChange={(v) => handleChange('Time', v)}
              placeholder="e.g., 5 days"
            />
            <Field
              label="Fee"
              value={currentSpace.Fee}
              onChange={(v) => handleChange('Fee', v)}
              placeholder="e.g., 8%"
            />
          </div>
        </fieldset>

        {/* Group 6: Movement (Space Dropdowns) */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Movement Destinations</legend>
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
  // Allow both dropdown selection and free text entry for complex conditions
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
    color: '#6c757d'
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
    fontWeight: 500,
    color: '#6c757d',
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
  }
};
