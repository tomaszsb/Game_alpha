import React from 'react';
import { SpaceRow, PHASES } from './types/EditorTypes';

interface SpaceBrowserProps {
  spaces: SpaceRow[];
  selectedSpaceId: string | null;
  searchTerm: string;
  onSelectSpace: (spaceId: string) => void;
  onSearchChange: (term: string) => void;
  phaseFilter: string;
  onPhaseFilterChange: (phase: string) => void;
}

export function SpaceBrowser({
  spaces,
  selectedSpaceId,
  searchTerm,
  onSelectSpace,
  onSearchChange,
  phaseFilter,
  onPhaseFilterChange
}: SpaceBrowserProps): JSX.Element {
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

  return (
    <div style={styles.container}>
      <div style={styles.searchSection}>
        <input
          type="text"
          placeholder="Search spaces..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          style={styles.searchInput}
        />
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
                style={{
                  ...styles.spaceItem,
                  ...(selectedSpaceId === space.space_name ? styles.spaceItemSelected : {})
                }}
              >
                <span style={styles.spaceName}>{space.space_name}</span>
                {space.requires_dice_roll?.toLowerCase() === 'yes' && (
                  <span style={styles.diceIndicator} title="Requires dice roll">🎲</span>
                )}
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
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    boxSizing: 'border-box'
  },
  phaseSelect: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: 'white'
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
  diceIndicator: {
    marginLeft: '4px',
    fontSize: '12px'
  },
  noResults: {
    padding: '20px',
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic'
  }
};
