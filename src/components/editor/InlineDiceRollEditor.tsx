import React, { useState } from 'react';
import { DiceRollRow } from './types/EditorTypes';

interface InlineDiceRollEditorProps {
  diceRolls: DiceRollRow[];
  spaceName: string;
  visitType: 'First' | 'Subsequent';
  allSpaceNames: string[];
  onUpdateDiceRoll: (index: number, field: keyof DiceRollRow, value: string) => void;
  onAddDiceRoll: (diceRoll: DiceRollRow) => void;
  onDeleteDiceRoll: (index: number) => void;
}

const CARD_PRESETS = ['Draw 1', 'Draw 2', 'Draw 3', 'Remove 1', 'Replace 1', 'No change'];
const QUALITY_PRESETS = ['HIGH', 'MED', 'LOW'];
const DIE_ROLL_CATEGORIES = ['W Cards', 'I Cards', 'E cards', 'Fees Paid', 'Fee Paid', 'Time outcomes', 'Next Step', 'Quality', 'Multiplier'];

function SmartRollInput({ value, dieRoll, allSpaceNames, onChange }: {
  value: string; dieRoll: string; allSpaceNames: string[]; onChange: (v: string) => void;
}): JSX.Element {
  if (['W Cards', 'I Cards', 'E cards'].includes(dieRoll)) {
    if (!value || CARD_PRESETS.includes(value)) {
      return (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={s.rollInput}>
          <option value="">—</option>
          {CARD_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      );
    }
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={s.rollInput} />;
  }
  if (dieRoll === 'Fees Paid') {
    const m = value?.match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (!value || m) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <input type="number" min="0" step="1" value={m ? m[1] : ''}
            onChange={(e) => onChange(e.target.value ? `${e.target.value}%` : '')}
            style={{ ...s.rollInput, flex: 1 }} placeholder="0" />
          <span style={{ fontSize: '10px', color: '#495057' }}>%</span>
        </div>
      );
    }
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={s.rollInput} />;
  }
  if (dieRoll === 'Fee Paid') {
    const m = value?.match(/^\$?\s*(\d+(?:\.\d+)?)$/);
    if (!value || m) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <span style={{ fontSize: '10px', color: '#495057' }}>$</span>
          <input type="number" min="0" step="0.01" value={m ? m[1] : ''}
            onChange={(e) => onChange(e.target.value ? `$${e.target.value}` : '')}
            style={{ ...s.rollInput, flex: 1 }} placeholder="0.00" />
        </div>
      );
    }
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={s.rollInput} />;
  }
  if (dieRoll === 'Quality') {
    return (
      <select value={QUALITY_PRESETS.includes(value) ? value : ''} onChange={(e) => onChange(e.target.value)} style={s.rollInput}>
        <option value="">—</option>
        {QUALITY_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    );
  }
  if (dieRoll.trim() === 'Multiplier') {
    return <input type="number" min="0" step="1" value={value || ''} onChange={(e) => onChange(e.target.value)} style={s.rollInput} placeholder="0" />;
  }
  if (dieRoll === 'Next Step') {
    if (!value || allSpaceNames.includes(value)) {
      return (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={s.rollInput}>
          <option value="">—</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      );
    }
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={s.rollInput} />;
  }
  return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={s.rollInput} />;
}

export function InlineDiceRollEditor({
  diceRolls, spaceName, visitType, allSpaceNames,
  onUpdateDiceRoll, onAddDiceRoll, onDeleteDiceRoll,
}: InlineDiceRollEditorProps): JSX.Element {
  const [addCategory, setAddCategory] = useState('');

  // Filter to this space + visit type
  const filtered = diceRolls
    .map((roll, idx) => ({ roll, idx }))
    .filter(({ roll }) => roll.space_name === spaceName && roll.visit_type === visitType);

  const handleAdd = () => {
    if (!addCategory) return;
    onAddDiceRoll({
      space_name: spaceName,
      die_roll: addCategory,
      visit_type: visitType,
      roll_1: '', roll_2: '', roll_3: '', roll_4: '', roll_5: '', roll_6: '',
      button_label: '',
      roll_group: '',
    });
    setAddCategory('');
  };

  // Categories already used
  const usedCategories = filtered.map(f => f.roll.die_roll);

  return (
    <div>
      {filtered.length === 0 && (
        <div style={{ fontSize: '11px', color: '#868e96', fontStyle: 'italic', marginBottom: '6px' }}>
          No dice roll rows yet
        </div>
      )}

      {filtered.map(({ roll, idx }) => (
        <div key={`${roll.die_roll}-${idx}`} style={s.rollCard}>
          <div style={s.rollHeader}>
            <span style={s.rollCategory}>{roll.die_roll}</span>
            <button onClick={() => onDeleteDiceRoll(idx)} style={s.deleteBtn} title="Delete">×</button>
          </div>
          <div style={s.rollGrid}>
            {([1, 2, 3, 4, 5, 6] as const).map(num => (
              <div key={num} style={s.rollCell}>
                <span style={s.dieNum}>{num}</span>
                <SmartRollInput
                  value={roll[`roll_${num}` as keyof DiceRollRow] || ''}
                  dieRoll={roll.die_roll}
                  allSpaceNames={allSpaceNames}
                  onChange={(v) => onUpdateDiceRoll(idx, `roll_${num}` as keyof DiceRollRow, v)}
                />
              </div>
            ))}
          </div>
          <div style={s.labelRow}>
            <label style={s.labelText}>Button:</label>
            <input
              type="text"
              value={roll.button_label || ''}
              onChange={(e) => onUpdateDiceRoll(idx, 'button_label', e.target.value)}
              placeholder={`Roll for ${roll.die_roll}`}
              style={s.labelInput}
            />
          </div>
          <div style={s.labelRow}>
            <label style={s.labelText}>Roll Group:</label>
            <input
              type="text"
              value={roll.roll_group || ''}
              onChange={(e) => onUpdateDiceRoll(idx, 'roll_group', e.target.value)}
              placeholder="(blank = shared roll)"
              style={s.labelInput}
            />
          </div>
        </div>
      ))}

      {/* Add new row */}
      <div style={s.addRow}>
        <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)} style={s.addSelect}>
          <option value="">+ Add dice roll...</option>
          {DIE_ROLL_CATEGORIES.filter(c => !usedCategories.includes(c)).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {addCategory && (
          <button onClick={handleAdd} style={s.addBtn}>Add</button>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  rollCard: {
    border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '6px',
    backgroundColor: '#fafafa', overflow: 'hidden',
  },
  rollHeader: {
    padding: '3px 8px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #e0e0e0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  rollCategory: { fontWeight: 600, fontSize: '11px', color: '#212529' },
  deleteBtn: {
    width: '18px', height: '18px', padding: 0, border: 'none',
    backgroundColor: '#dc3545', color: 'white', borderRadius: '3px',
    cursor: 'pointer', fontSize: '13px', lineHeight: '1',
  },
  rollGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '3px', padding: '4px 6px',
  },
  rollCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' },
  dieNum: {
    width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6c757d', color: 'white', borderRadius: '2px',
    fontSize: '9px', fontWeight: 600,
  },
  rollInput: {
    width: '100%', padding: '3px 2px', fontSize: '10px',
    border: '1px solid #ced4da', borderRadius: '2px', textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  },
  labelRow: {
    display: 'flex', gap: '4px', alignItems: 'center', padding: '3px 6px',
    borderTop: '1px solid #e0e0e0',
  },
  labelText: { fontSize: '10px', fontWeight: 600, color: '#343a40', flexShrink: 0 },
  labelInput: {
    flex: 1, padding: '2px 4px', fontSize: '11px',
    border: '1px solid #ced4da', borderRadius: '2px',
    boxSizing: 'border-box' as const,
  },
  addRow: { display: 'flex', gap: '4px', alignItems: 'center' },
  addSelect: {
    flex: 1, padding: '3px 6px', fontSize: '11px',
    border: '1px solid #ced4da', borderRadius: '3px', backgroundColor: 'white',
  },
  addBtn: {
    padding: '3px 10px', backgroundColor: '#28a745', color: 'white',
    border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px',
  },
};
