import React, { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getBackendURL, getGameStateAPIPath, getCurrentGameId } from '../../utils/networkDetection';
import { isAdminAuthenticated, verifyAdminPassword } from '../../utils/adminAuth';
import { SpaceBrowser } from './SpaceBrowser';
import { SpaceEditor } from './SpaceEditor';
import { DiceRollEditor } from './DiceRollEditor';
import { SpaceRow, DiceRollRow } from './types/EditorTypes';
import { downloadSourceFiles } from './utils/csvExport';
import { colors } from '../../styles/theme';

interface DataEditorProps {
  onClose: () => void;
}

/**
 * Admin auth gate - shown before DataEditor content if not authenticated
 */
function AdminAuthGate({ onAuthenticated, onClose }: { onAuthenticated: () => void; onClose: () => void }): JSX.Element {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!password.trim()) return;
    setVerifying(true);
    setError('');
    const success = await verifyAdminPassword(password);
    setVerifying(false);
    if (success) {
      onAuthenticated();
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
        maxWidth: '360px', width: '90%', textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 0.5rem', color: colors.text.primary }}>🔒 Admin Access Required</h3>
        <p style={{ margin: '0 0 1.25rem', color: colors.text.secondary, fontSize: '0.9rem' }}>
          Enter the admin password to access the Data Editor.
        </p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          autoFocus
          style={{
            width: '100%', padding: '0.75rem', marginBottom: '0.75rem',
            border: `2px solid ${error ? '#dc3545' : '#dee2e6'}`,
            borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
          }}
        />
        {error && <p style={{ color: '#dc3545', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '0.65rem', backgroundColor: '#f8f9fa',
              color: '#495057', border: '1px solid #dee2e6',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying}
            style={{
              flex: 1, padding: '0.65rem',
              backgroundColor: colors.primary.main, color: 'white',
              border: 'none', borderRadius: '8px',
              cursor: verifying ? 'wait' : 'pointer',
              fontSize: '0.9rem', fontWeight: '600'
            }}
          >
            {verifying ? 'Verifying...' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DataEditor({ onClose }: DataEditorProps): JSX.Element {
  // Admin auth check
  const [isAuthed, setIsAuthed] = useState(() => isAdminAuthenticated());
  if (!isAuthed) {
    return <AdminAuthGate onAuthenticated={() => setIsAuthed(true)} onClose={onClose} />;
  }
  const { dataService } = useGameContext();

  // Editor state
  const [spacesData, setSpacesData] = useState<SpaceRow[]>([]);
  const [diceRollData, setDiceRollData] = useState<DiceRollRow[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<'First' | 'Subsequent'>('First');
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'spaces' | 'diceRolls'>('spaces');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from DataService (CLEAN_FILES) and convert to source format
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load source files directly from public folder
        const [spacesResponse, diceRollResponse] = await Promise.all([
          fetch('/data/SOURCE_FILES/Spaces.csv?_=' + Date.now()),
          fetch('/data/SOURCE_FILES/DiceRoll Info.csv?_=' + Date.now())
        ]);

        if (!spacesResponse.ok || !diceRollResponse.ok) {
          throw new Error('Failed to load source files');
        }

        const spacesText = await spacesResponse.text();
        const diceRollText = await diceRollResponse.text();

        // Parse Spaces.csv
        const spacesRows = parseSpacesCSV(spacesText);
        setSpacesData(spacesRows);

        // Parse DiceRoll Info.csv
        const diceRollRows = parseDiceRollCSV(diceRollText);
        setDiceRollData(diceRollRows);

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading source files:', err);
        setError('Failed to load source files. Make sure SOURCE_FILES are in public/data/SOURCE_FILES/');
        setIsLoading(false);
      }
    };

    loadData();
  }, [dataService]);

  // Get all unique space names for dropdowns
  const allSpaceNames = React.useMemo(() => {
    const names = new Set<string>();
    spacesData.forEach(space => names.add(space.space_name));
    return Array.from(names).sort();
  }, [spacesData]);

  // Get current space data (First and Subsequent)
  const spaceFirst = spacesData.find(
    s => s.space_name === selectedSpaceId && s.visit_type === 'First'
  ) || null;
  const spaceSubsequent = spacesData.find(
    s => s.space_name === selectedSpaceId && s.visit_type === 'Subsequent'
  ) || null;

  // Handle field changes
  const handleFieldChange = useCallback((
    vType: 'First' | 'Subsequent',
    field: keyof SpaceRow,
    value: string
  ) => {
    setSpacesData(prev => prev.map(space => {
      if (space.space_name === selectedSpaceId && space.visit_type === vType) {
        return { ...space, [field]: value };
      }
      return space;
    }));
    setHasUnsavedChanges(true);
  }, [selectedSpaceId]);

  // Handle dice roll changes
  const handleDiceRollUpdate = useCallback((
    index: number,
    field: keyof DiceRollRow,
    value: string
  ) => {
    setDiceRollData(prev => prev.map((roll, i) => {
      if (i === index) {
        return { ...roll, [field]: value };
      }
      return roll;
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleAddDiceRoll = useCallback((newRoll: DiceRollRow) => {
    setDiceRollData(prev => [...prev, newRoll]);
    setHasUnsavedChanges(true);
  }, []);

  const handleDeleteDiceRoll = useCallback((index: number) => {
    if (!confirm('Delete this dice roll row?')) return;
    setDiceRollData(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }, []);

  // Export handlers
  const handleExport = useCallback(() => {
    downloadSourceFiles(spacesData, diceRollData);
    setHasUnsavedChanges(false);
    alert('Downloading Spaces.csv and DiceRoll Info.csv...\n\nReplace files in data/SOURCE_FILES/ and run:\npython data/process_game_data.py');
  }, [spacesData, diceRollData]);

  // Clear game data handler
  const handleClearData = async () => {
    const confirmed = window.confirm(
      'Clear All Game Data?\n\n' +
      'This will permanently delete:\n' +
      '- All players\n' +
      '- Current game progress\n' +
      '- Game state\n\n' +
      'The page will reload after clearing.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      const backendURL = getBackendURL();
      const gameId = getCurrentGameId();
      const apiPath = getGameStateAPIPath(gameId);

      const response = await fetch(`${backendURL}${apiPath}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Game data cleared successfully!\n\nReturning to home...');
        window.location.href = window.location.origin + window.location.pathname;
      } else {
        alert(`Failed to clear game data (${response.status}). Please try again.`);
      }
    } catch (error) {
      alert('Error connecting to server. Make sure the backend is running on port 3001.\n\nError: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard and close?')) {
        return;
      }
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        handleClose();
      }
      // Ctrl+S to export
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!isLoading && !error) {
          handleExport();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handleExport, isLoading, error]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.title}>Space Data Editor</h2>
            {hasUnsavedChanges && (
              <span style={styles.unsavedBadge}>Unsaved Changes</span>
            )}
          </div>
          <button onClick={handleClose} style={styles.closeButton}>&times;</button>
        </div>

        {/* Tab Bar */}
        <div style={styles.tabBar}>
          <button
            onClick={() => setActiveTab('spaces')}
            style={{
              ...styles.tab,
              ...(activeTab === 'spaces' ? styles.tabActive : {})
            }}
          >
            Spaces ({allSpaceNames.length})
          </button>
          <button
            onClick={() => setActiveTab('diceRolls')}
            style={{
              ...styles.tab,
              ...(activeTab === 'diceRolls' ? styles.tabActive : {})
            }}
          >
            Dice Rolls ({diceRollData.length})
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {isLoading ? (
            <div style={styles.loading}>Loading source files...</div>
          ) : error ? (
            <div style={styles.error}>
              <p>{error}</p>
              <p style={{ fontSize: '14px', marginTop: '12px' }}>
                To use the editor, copy SOURCE_FILES to public/data/:
              </p>
              <code style={styles.code}>
                cp -r data/SOURCE_FILES public/data/
              </code>
            </div>
          ) : activeTab === 'spaces' ? (
            <div style={styles.splitPanel}>
              <div style={styles.browserPanel}>
                <SpaceBrowser
                  spaces={spacesData}
                  selectedSpaceId={selectedSpaceId}
                  searchTerm={searchTerm}
                  onSelectSpace={setSelectedSpaceId}
                  onSearchChange={setSearchTerm}
                  phaseFilter={phaseFilter}
                  onPhaseFilterChange={setPhaseFilter}
                />
              </div>
              <div style={styles.editorPanel}>
                <SpaceEditor
                  spaceFirst={spaceFirst}
                  spaceSubsequent={spaceSubsequent}
                  visitType={visitType}
                  allSpaceNames={allSpaceNames}
                  onVisitTypeChange={setVisitType}
                  onFieldChange={handleFieldChange}
                />
              </div>
            </div>
          ) : (
            <DiceRollEditor
              diceRolls={diceRollData}
              selectedSpaceId={selectedSpaceId}
              allSpaceNames={allSpaceNames}
              onUpdateDiceRoll={handleDiceRollUpdate}
              onAddDiceRoll={handleAddDiceRoll}
              onDeleteDiceRoll={handleDeleteDiceRoll}
            />
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={handleClearData} style={styles.clearButton}>
            Clear Game Data
          </button>
          <div style={styles.footerRight}>
            <button onClick={handleExport} style={styles.exportButton} disabled={isLoading || !!error}>
              Export Source Files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// CSV Parsing Functions
function parseSpacesCSV(csvText: string): SpaceRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return {
      space_name: values[0] || '',
      phase: values[1] || '',
      visit_type: (values[2] || 'First') as 'First' | 'Subsequent',
      Title: values[3] || '',
      Event: values[4] || '',
      Action: values[5] || '',
      Outcome: values[6] || '',
      w_card: values[7] || '',
      b_card: values[8] || '',
      i_card: values[9] || '',
      l_card: values[10] || '',
      e_card: values[11] || '',
      Time: values[12] || '',
      Fee: values[13] || '',
      space_1: values[14] || '',
      space_2: values[15] || '',
      space_3: values[16] || '',
      space_4: values[17] || '',
      space_5: values[18] || '',
      Negotiate: values[19] || '',
      requires_dice_roll: values[20] || '',
      path: values[21] || '',
      rolls: values[22] || ''
    };
  }).filter(row => row.space_name); // Filter out empty rows
}

function parseDiceRollCSV(csvText: string): DiceRollRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row (may have BOM character)
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return {
      space_name: values[0]?.replace(/^\uFEFF/, '') || '', // Remove BOM if present
      die_roll: values[1] || '',
      visit_type: (values[2] || 'First') as 'First' | 'Subsequent',
      roll_1: values[3] || '',
      roll_2: values[4] || '',
      roll_3: values[5] || '',
      roll_4: values[6] || '',
      roll_5: values[7] || '',
      roll_6: values[8] || ''
    };
  }).filter(row => row.space_name); // Filter out empty rows
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'white',
    borderRadius: '8px',
    width: '95%',
    maxWidth: '1400px',
    height: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #dee2e6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600
  },
  unsavedBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#ffc107',
    color: '#212529',
    borderRadius: '4px',
    fontWeight: 500
  },
  closeButton: {
    background: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '4px 10px',
    color: '#333'
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #dee2e6',
    backgroundColor: '#f8f9fa'
  },
  tab: {
    padding: '10px 20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: '#495057',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px'
  },
  tabActive: {
    color: '#007bff',
    fontWeight: 600,
    borderBottomColor: '#007bff',
    backgroundColor: 'white'
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex'
  },
  splitPanel: {
    display: 'flex',
    width: '100%',
    height: '100%'
  },
  browserPanel: {
    width: '280px',
    minWidth: '280px',
    height: '100%',
    overflow: 'hidden'
  },
  editorPanel: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#f8f9fa'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: '#6c757d',
    fontSize: '16px'
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: '#dc3545',
    padding: '40px',
    textAlign: 'center'
  },
  code: {
    display: 'block',
    marginTop: '8px',
    padding: '12px 16px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#212529'
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #dee2e6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  footerRight: {
    display: 'flex',
    gap: '8px'
  },
  clearButton: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600
  },
  exportButton: {
    background: '#28a745',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600
  }
};
