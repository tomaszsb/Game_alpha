import React, { useState } from 'react';
import { DiceRollRow } from './types/EditorTypes';

interface DiceRollEditorProps {
  diceRolls: DiceRollRow[];
  selectedSpaceId: string | null;
  allSpaceNames: string[];
  onUpdateDiceRoll: (index: number, field: keyof DiceRollRow, value: string) => void;
  onAddDiceRoll: (diceRoll: DiceRollRow) => void;
  onDeleteDiceRoll: (index: number) => void;
}

export function DiceRollEditor({
  diceRolls,
  selectedSpaceId,
  allSpaceNames,
  onUpdateDiceRoll,
  onAddDiceRoll,
  onDeleteDiceRoll
}: DiceRollEditorProps): JSX.Element {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoll, setNewRoll] = useState<Partial<DiceRollRow>>({
    space_name: selectedSpaceId || '',
    die_roll: '',
    visit_type: 'First',
    roll_1: '',
    roll_2: '',
    roll_3: '',
    roll_4: '',
    roll_5: '',
    roll_6: ''
  });

  // Filter dice rolls for selected space
  const filteredRolls = selectedSpaceId
    ? diceRolls.filter(roll => roll.space_name === selectedSpaceId)
    : diceRolls;

  // Get index in the full array
  const getGlobalIndex = (roll: DiceRollRow): number => {
    return diceRolls.findIndex(r =>
      r.space_name === roll.space_name &&
      r.die_roll === roll.die_roll &&
      r.visit_type === roll.visit_type
    );
  };

  const handleAddNew = () => {
    if (!newRoll.space_name || !newRoll.die_roll) {
      alert('Space name and Die Roll category are required');
      return;
    }

    onAddDiceRoll({
      space_name: newRoll.space_name,
      die_roll: newRoll.die_roll,
      visit_type: newRoll.visit_type as 'First' | 'Subsequent',
      roll_1: newRoll.roll_1 || '',
      roll_2: newRoll.roll_2 || '',
      roll_3: newRoll.roll_3 || '',
      roll_4: newRoll.roll_4 || '',
      roll_5: newRoll.roll_5 || '',
      roll_6: newRoll.roll_6 || ''
    });

    setShowAddForm(false);
    setNewRoll({
      space_name: selectedSpaceId || '',
      die_roll: '',
      visit_type: 'First',
      roll_1: '',
      roll_2: '',
      roll_3: '',
      roll_4: '',
      roll_5: '',
      roll_6: ''
    });
  };

  // Update new roll space_name when selectedSpaceId changes
  React.useEffect(() => {
    if (selectedSpaceId) {
      setNewRoll(prev => ({ ...prev, space_name: selectedSpaceId }));
    }
  }, [selectedSpaceId]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>
          Dice Roll Info
          {selectedSpaceId && <span style={styles.spaceTag}>{selectedSpaceId}</span>}
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={styles.addButton}
        >
          {showAddForm ? 'Cancel' : '+ Add Row'}
        </button>
      </div>

      {/* Add New Form */}
      {showAddForm && (
        <div style={styles.addForm}>
          <div style={styles.formRow}>
            <div style={styles.field}>
              <label style={styles.label}>Space</label>
              <select
                value={newRoll.space_name}
                onChange={(e) => setNewRoll({ ...newRoll, space_name: e.target.value })}
                style={styles.select}
              >
                <option value="">-- Select Space --</option>
                {allSpaceNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <input
                type="text"
                value={newRoll.die_roll}
                onChange={(e) => setNewRoll({ ...newRoll, die_roll: e.target.value })}
                placeholder="e.g., W Cards, Next Step"
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Visit Type</label>
              <select
                value={newRoll.visit_type}
                onChange={(e) => setNewRoll({ ...newRoll, visit_type: e.target.value as 'First' | 'Subsequent' })}
                style={styles.select}
              >
                <option value="First">First</option>
                <option value="Subsequent">Subsequent</option>
              </select>
            </div>
          </div>
          <div style={styles.rollsRow}>
            {[1, 2, 3, 4, 5, 6].map(num => (
              <div key={num} style={styles.rollField}>
                <label style={styles.label}>Roll {num}</label>
                <input
                  type="text"
                  value={newRoll[`roll_${num}` as keyof typeof newRoll] || ''}
                  onChange={(e) => setNewRoll({ ...newRoll, [`roll_${num}`]: e.target.value })}
                  style={styles.input}
                />
              </div>
            ))}
          </div>
          <button onClick={handleAddNew} style={styles.saveButton}>
            Add Dice Roll Row
          </button>
        </div>
      )}

      {/* Existing Dice Rolls */}
      <div style={styles.rollsList}>
        {filteredRolls.length === 0 ? (
          <div style={styles.noRolls}>
            {selectedSpaceId
              ? `No dice roll data for ${selectedSpaceId}`
              : 'Select a space to view dice rolls'}
          </div>
        ) : (
          filteredRolls.map((roll) => {
            const globalIndex = getGlobalIndex(roll);
            return (
              <div key={`${roll.space_name}-${roll.die_roll}-${roll.visit_type}`} style={styles.rollCard}>
                <div style={styles.rollHeader}>
                  <div style={styles.rollInfo}>
                    <span style={styles.rollCategory}>{roll.die_roll}</span>
                    <span style={styles.visitBadge}>{roll.visit_type}</span>
                  </div>
                  <button
                    onClick={() => onDeleteDiceRoll(globalIndex)}
                    style={styles.deleteButton}
                    title="Delete this dice roll row"
                  >
                    ×
                  </button>
                </div>
                <div style={styles.rollsGrid}>
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <div key={num} style={styles.rollCell}>
                      <span style={styles.dieNumber}>{num}</span>
                      <input
                        type="text"
                        value={roll[`roll_${num}` as keyof DiceRollRow] || ''}
                        onChange={(e) => onUpdateDiceRoll(globalIndex, `roll_${num}` as keyof DiceRollRow, e.target.value)}
                        style={styles.rollInput}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f8f9fa'
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #dee2e6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  spaceTag: {
    fontSize: '12px',
    padding: '2px 8px',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    color: '#495057'
  },
  addButton: {
    padding: '6px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  addForm: {
    padding: '16px',
    backgroundColor: '#fff3cd',
    borderBottom: '1px solid #ffc107'
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px'
  },
  field: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  rollField: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: '80px'
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#343a40',
    marginBottom: '4px'
  },
  input: {
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: 'white',
    width: '100%',
    boxSizing: 'border-box'
  },
  rollsRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  saveButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  rollsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px'
  },
  noRolls: {
    textAlign: 'center',
    color: '#495057',
    padding: '40px 20px',
    fontStyle: 'italic'
  },
  rollCard: {
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    marginBottom: '12px',
    overflow: 'hidden'
  },
  rollHeader: {
    padding: '10px 12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dee2e6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rollInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  rollCategory: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#212529'
  },
  visitBadge: {
    fontSize: '11px',
    padding: '2px 6px',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '3px'
  },
  deleteButton: {
    width: '24px',
    height: '24px',
    padding: 0,
    border: 'none',
    backgroundColor: '#dc3545',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1'
  },
  rollsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '8px',
    padding: '12px'
  },
  rollCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  dieNumber: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c757d',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  rollInput: {
    width: '100%',
    padding: '6px',
    fontSize: '12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    textAlign: 'center',
    boxSizing: 'border-box'
  }
};
