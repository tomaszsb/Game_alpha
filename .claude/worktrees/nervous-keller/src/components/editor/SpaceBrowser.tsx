import React, { useState } from 'react';
import { SpaceRow, PHASES } from './types/EditorTypes';

interface SpaceBrowserProps {
  spaces: SpaceRow[];
  selectedSpaceId: string | null;
  searchTerm: string;
  onSelectSpace: (spaceId: string) => void;
  onSearchChange: (term: string) => void;
  phaseFilter: string;
  onPhaseFilterChange: (phase: string) => void;
  onAddSpace?: (spaceName: string) => void;
  onDeleteSpace?: (spaceName: string) => void;
}

export function SpaceBrowser({
  spaces,
  selectedSpaceId,
  searchTerm,
  onSelectSpace,
  onSearchChange,
  phaseFilter,
  onPhaseFilterChange,
  onAddSpace,
  onDeleteSpace
}: SpaceBrowserProps): JSX.Element {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [addError, setAddError] = useState('');
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);

  // Get unique space names (since each space has 2 rows: First/Subsequent)
  const uniqueSpaces = React.useMemo(() => {
    const seen = new Set<string>();
    return spaces.filter(space => {
      if (seen.has(space.space_name)) return false;
      seen.add(space.space_name);
      return true;
    });
  }, [spaces]);

  // Filter spaces by search term and phase
  const filteredSpaces = React.useMemo(() => {
    return uniqueSpaces.filter(space => {
      const matchesSearch = searchTerm === '' ||
        space.space_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPhase = phaseFilter === '' || space.phase === phaseFilter;
      return matchesSearch && matchesPhase;
    });
  }, [uniqueSpaces, searchTerm, phaseFilter]);

  // Group spaces by phase
  const groupedSpaces = React.useMemo(() => {
    const groups: Record<string, SpaceRow[]> = {};
    filteredSpaces.forEach(space => {
      const phase = space.phase || 'Unknown';
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(space);
    });
    return groups;
  }, [filteredSpaces]);

  const existingNames = React.useMemo(() => {
    return new Set(spaces.map(s => s.space_name));
  }, [spaces]);

  const handleAddConfirm = () => {
    const formatted = newSpaceName.trim().toUpperCase().replace(/\s+/g, '-');
    if (!formatted) {
      setAddError('Name is required');
      return;
    }
    if (!/^[A-Z0-9-]+$/.test(formatted)) {
      setAddError('Only letters, numbers, and hyphens');
      return;
    }
    if (existingNames.has(formatted)) {
      setAddError('Space already exists');
      return;
    }
    onAddSpace?.(formatted);
    setShowAddDialog(false);
    setNewSpaceName('');
    setAddError('');
  };

  const handleDeleteClick = (e: React.MouseEvent, spaceName: string) => {
    e.stopPropagation();
    if (confirm(`Delete "${spaceName}"?\n\nThis removes both First and Subsequent visit data.`)) {
      onDeleteSpace?.(spaceName);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.searchSection}>
        <div style={styles.searchRow}>
          <input
            type="text"
            placeholder="Search spaces..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            style={styles.searchInput}
          />
          {onAddSpace && (
            <button
              onClick={() => setShowAddDialog(true)}
              style={styles.addButton}
              title="Add new space"
            >
              +
            </button>
          )}
        </div>
        <select
          value={phaseFilter}
          onChange={(e) => onPhaseFilterChange(e.target.value)}
          style={styles.phaseSelect}
        >
          <option value="">All Phases</option>
          {PHASES.map(phase => (
            <option key={phase} value={phase}>{phase}</option>
          ))}
        </select>
      </div>

      {/* Add Space Dialog */}
      {showAddDialog && (
        <div style={styles.addDialog}>
          <div style={styles.addDialogTitle}>New Space</div>
          <input
            type="text"
            placeholder="SPACE-NAME"
            value={newSpaceName}
            onChange={(e) => {
              setNewSpaceName(e.target.value.toUpperCase().replace(/\s+/g, '-'));
              setAddError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddConfirm()}
            autoFocus
            style={styles.addInput}
          />
          {addError && <div style={styles.addError}>{addError}</div>}
          <div style={styles.addDialogButtons}>
            <button
              onClick={() => { setShowAddDialog(false); setNewSpaceName(''); setAddError(''); }}
              style={styles.addCancelBtn}
            >
              Cancel
            </button>
            <button onClick={handleAddConfirm} style={styles.addConfirmBtn}>
              Create
            </button>
          </div>
        </div>
      )}

      <div style={styles.spaceCount}>
        {filteredSpaces.length} of {uniqueSpaces.length} spaces
      </div>

      <div style={styles.spaceList}>
        {Object.entries(groupedSpaces).map(([phase, phaseSpaces]) => (
          <div key={phase} style={styles.phaseGroup}>
            <div style={styles.phaseHeader}>{phase}</div>
            {phaseSpaces.map(space => (
              <div
                key={space.space_name}
                onClick={() => onSelectSpace(space.space_name)}
                onMouseEnter={() => setHoveredSpace(space.space_name)}
                onMouseLeave={() => setHoveredSpace(null)}
                style={{
                  ...styles.spaceItem,
                  ...(selectedSpaceId === space.space_name ? styles.spaceItemSelected : {})
                }}
              >
                <span style={styles.spaceName}>{space.space_name}</span>
                <span style={styles.spaceActions}>
                  {space.requires_dice_roll?.toLowerCase() === 'yes' && (
                    <span style={styles.diceIndicator} title="Requires dice roll">🎲</span>
                  )}
                  {onDeleteSpace && hoveredSpace === space.space_name && selectedSpaceId !== space.space_name && (
                    <span
                      onClick={(e) => handleDeleteClick(e, space.space_name)}
                      style={styles.deleteButton}
                      title="Delete space"
                    >
                      ✕
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}

        {filteredSpaces.length === 0 && (
          <div style={styles.noResults}>No spaces found</div>
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
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #dee2e6'
  },
  searchSection: {
    padding: '12px',
    borderBottom: '1px solid #dee2e6',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  searchRow: {
    display: 'flex',
    gap: '6px'
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    boxSizing: 'border-box'
  },
  addButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #28a745',
    borderRadius: '4px',
    backgroundColor: '#28a745',
    color: 'white',
    fontSize: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  phaseSelect: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: 'white'
  },
  addDialog: {
    margin: '0 12px',
    padding: '12px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #a5d6a7',
    borderRadius: '6px',
    marginBottom: '4px'
  },
  addDialogTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#2e7d32',
    marginBottom: '8px'
  },
  addInput: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontFamily: 'monospace'
  },
  addError: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '4px'
  },
  addDialogButtons: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
    justifyContent: 'flex-end'
  },
  addCancelBtn: {
    padding: '5px 12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '13px'
  },
  addConfirmBtn: {
    padding: '5px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#28a745',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600
  },
  spaceCount: {
    padding: '8px 12px',
    fontSize: '12px',
    color: '#495057',
    borderBottom: '1px solid #dee2e6'
  },
  spaceList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0'
  },
  phaseGroup: {
    marginBottom: '8px'
  },
  phaseHeader: {
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#343a40',
    backgroundColor: '#dee2e6'
  },
  spaceItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    color: '#212529',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background-color 0.1s'
  },
  spaceItemSelected: {
    backgroundColor: '#007bff',
    color: 'white'
  },
  spaceName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  spaceActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0
  },
  diceIndicator: {
    fontSize: '12px'
  },
  deleteButton: {
    fontSize: '14px',
    color: '#dc3545',
    cursor: 'pointer',
    padding: '0 4px',
    fontWeight: 'bold',
    opacity: 0.7
  },
  noResults: {
    padding: '20px',
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic'
  }
};
