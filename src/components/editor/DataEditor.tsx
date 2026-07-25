import React, { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getBackendURL } from '../../utils/networkDetection';
import { isAdminAuthenticated, verifyAdminPassword, getAdminPassword } from '../../utils/adminAuth';
import { SpaceBrowser } from './SpaceBrowser';
import { SpaceEditor } from './SpaceEditor';
import { PlayerPreviewPanel } from './PlayerPreviewPanel';
import { SpaceRow, DiceRollRow, ModalConfigRow } from './types/EditorTypes';
import { exportSpacesCSV, exportDiceRollCSV, exportModalConfigCSV, parseModalConfigCSV, parseSpacesCSV, parseDiceRollCSV } from './utils/csvExport';
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
  const [modalConfigData, setModalConfigData] = useState<ModalConfigRow[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<'First' | 'Subsequent'>('First');
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // activeTab removed — dice rolls now inline in SpaceEditor
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load data from DataService (CLEAN_FILES) and convert to source format
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load source files directly from public folder
        const [spacesResponse, diceRollResponse, modalConfigResponse] = await Promise.all([
          fetch('/data/SOURCE_FILES/Spaces.csv?_=' + Date.now()),
          fetch('/data/SOURCE_FILES/DiceRoll Info.csv?_=' + Date.now()),
          fetch('/data/SOURCE_FILES/ModalConfig.csv?_=' + Date.now())
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

        // Parse ModalConfig.csv (optional — may not exist yet)
        if (modalConfigResponse.ok) {
          const modalConfigText = await modalConfigResponse.text();
          const modalRows = parseModalConfigCSV(modalConfigText);
          setModalConfigData(modalRows);
        }

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

  // Tile label (display_label_override) is a per-space GAME_CONFIG value that
  // rides in _extraColumns. It must stay identical on the First + Subsequent
  // rows so the regenerated GAME_CONFIG.csv carries one consistent value
  // regardless of which visit row the regen reads. Update both at once.
  const handleDisplayLabelChange = useCallback((value: string) => {
    setSpacesData(prev => prev.map(space => {
      if (space.space_name === selectedSpaceId) {
        return {
          ...space,
          _extraColumns: { ...(space._extraColumns ?? {}), display_label_override: value },
        };
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

  // Save to server (live save)
  const handleSave = useCallback(async () => {
    const password = getAdminPassword();
    if (!password) {
      setSaveStatus({ type: 'error', message: 'Admin session expired. Please re-open the editor.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const backendURL = getBackendURL();
      const spacesCSV = exportSpacesCSV(spacesData);
      const diceRollCSV = exportDiceRollCSV(diceRollData);
      const modalConfigCSV = exportModalConfigCSV(modalConfigData);

      const response = await fetch(`${backendURL}/api/admin/save-source-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ spacesCSV, diceRollCSV, modalConfigCSV })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setHasUnsavedChanges(false);
        // Refresh DataService's in-memory caches so gameplay sees the new CSVs
        // without a hard browser reload. Without this, SPACE_EFFECTS / DICE_EFFECTS
        // / MOVEMENT stay stale until the user hits Ctrl+Shift+R — same trap as
        // the v2.69.4 reloadGameConfig fix, generalized in v2.70.1.
        try {
          await dataService.reloadAllData();
        } catch (reloadErr) {
          console.warn('[DataEditor] Save succeeded but in-memory reload failed:', reloadErr);
        }
        setSaveStatus({ type: 'success', message: `Saved! ${data.files.length} files regenerated.` });
        // Auto-clear success message after 4 seconds
        setTimeout(() => setSaveStatus(prev => prev?.type === 'success' ? null : prev), 4000);
      } else {
        const base = data.error || 'Save failed';
        const detail = data.detail ? ` (${data.step || 'unknown'}: ${data.detail})` : '';
        setSaveStatus({ type: 'error', message: base + detail });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Connection error: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsSaving(false);
    }
  }, [spacesData, diceRollData, modalConfigData, dataService]);

  // Add new space
  const handleAddSpace = useCallback((spaceName: string) => {
    // Determine default phase from the first space (or SETUP)
    const defaultPhase = spacesData.length > 0 ? spacesData[0].phase : 'SETUP';
    const newFirst: SpaceRow = {
      space_name: spaceName,
      phase: defaultPhase,
      visit_type: 'First',
      Title: '', Event: '', Action: '', Outcome: '',
      w_card: '', b_card: '', i_card: '', l_card: '', e_card: '',
      Time: '', Fee: '',
      space_1: '', space_2: '', space_3: '', space_4: '', space_5: '',
      Negotiate: '', requires_dice_roll: '', path: 'Main', rolls: '',
      end_turn_label: 'End Turn', try_again_label: 'Try Again',
      w_card_label: '', b_card_label: '', i_card_label: '', l_card_label: '', e_card_label: '',
      shake_on: '', tts_field: '',
      w_card_narrative: '', b_card_narrative: '', i_card_narrative: '', l_card_narrative: '', e_card_narrative: ''
    };
    const newSubsequent: SpaceRow = { ...newFirst, visit_type: 'Subsequent' };
    setSpacesData(prev => [...prev, newFirst, newSubsequent]);
    setSelectedSpaceId(spaceName);
    setHasUnsavedChanges(true);
  }, [spacesData]);

  // Delete space
  const handleDeleteSpace = useCallback((spaceName: string) => {
    setSpacesData(prev => prev.filter(s => s.space_name !== spaceName));
    setDiceRollData(prev => prev.filter(d => d.space_name !== spaceName));
    if (selectedSpaceId === spaceName) {
      setSelectedSpaceId(null);
    }
    setHasUnsavedChanges(true);
  }, [selectedSpaceId]);

  // Reset to baseline
  const handleResetToBaseline = useCallback(async () => {
    const confirmed = window.confirm(
      'Reset to Baseline?\n\n' +
      'This will revert ALL space and dice roll data to the original defaults ' +
      'that were baked into the Docker image.\n\n' +
      'Any changes you\'ve saved will be lost.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;

    const password = getAdminPassword();
    if (!password) {
      setSaveStatus({ type: 'error', message: 'Admin session expired. Please re-open the editor.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/admin/reset-to-baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveStatus({ type: 'success', message: 'Reset to baseline! Reloading data...' });
        // Reload the data from server
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setSaveStatus({ type: 'error', message: data.error || 'Reset failed' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Connection error: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsSaving(false);
    }
  }, []);

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
      // Ctrl+S to save to server
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!isLoading && !error && !isSaving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handleSave, isLoading, error, isSaving]);

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
          ) : (
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
                  onAddSpace={handleAddSpace}
                  onDeleteSpace={handleDeleteSpace}
                />
              </div>
              <div style={styles.editorPanel}>
                <SpaceEditor
                  spaceFirst={spaceFirst}
                  spaceSubsequent={spaceSubsequent}
                  visitType={visitType}
                  allSpaceNames={allSpaceNames}
                  diceRollData={diceRollData}
                  modalConfigData={modalConfigData}
                  onVisitTypeChange={setVisitType}
                  onFieldChange={handleFieldChange}
                  displayLabelOverride={spaceFirst?._extraColumns?.display_label_override ?? spaceSubsequent?._extraColumns?.display_label_override ?? ''}
                  onDisplayLabelChange={handleDisplayLabelChange}
                  onUpdateDiceRoll={handleDiceRollUpdate}
                  onAddDiceRoll={handleAddDiceRoll}
                  onDeleteDiceRoll={handleDeleteDiceRoll}
                  onModalConfigChange={(updatedConfigs) => { setModalConfigData(updatedConfigs); setHasUnsavedChanges(true); }}
                />
              </div>
              <div style={styles.previewPanel}>
                <PlayerPreviewPanel
                  currentSpace={visitType === 'First' ? spaceFirst : spaceSubsequent}
                  visitType={visitType}
                  diceRollData={diceRollData}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={handleResetToBaseline} style={styles.resetButton} disabled={isSaving}>
            Reset to Baseline
          </button>
          <div style={styles.footerRight}>
            {saveStatus && (
              <span style={{
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: saveStatus.type === 'success' ? '#d4edda' : '#f8d7da',
                color: saveStatus.type === 'success' ? '#155724' : '#721c24',
                alignSelf: 'center'
              }}>
                {saveStatus.message}
              </span>
            )}
            <button onClick={handleSave} style={styles.saveButton} disabled={isLoading || !!error || isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
    width: '97%',
    maxWidth: '1700px',
    height: '92vh',
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
  previewPanel: {
    width: '340px',
    minWidth: '300px',
    height: '100%',
    overflow: 'hidden',
    borderLeft: '2px solid #e0e0e0',
    backgroundColor: 'white'
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
  resetButton: {
    background: 'white',
    color: '#dc3545',
    border: '2px solid #dc3545',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600
  },
  saveButton: {
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
