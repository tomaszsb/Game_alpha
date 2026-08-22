import React, { useState, useEffect, useCallback } from 'react';
import { isAdminAuthenticated, verifyAdminPassword } from '../../utils/adminAuth';
import { SpaceBrowser } from './SpaceBrowser';
import { SpaceEditor } from './SpaceEditor';
import { PlayerPreviewPanel } from './PlayerPreviewPanel';
import { useEditorSource } from './useEditorSource';
import { colors } from '../../styles/theme';

// The original Space Data Editor, in its own window.
//
// NOTHING OPENS THIS ANY MORE. As of 2026-08-22 "Make changes" keeps you on
// the merged screen (SpaceDeckScreen) instead of hopping here, so this file
// has no caller outside its own tests. It is deliberately left standing as
// the fallback if the merged screen turns out to have a problem in real use;
// removing it is a separate cleanup once the maintainer has lived with the
// new screen. The two cannot drift apart in the meantime — everything about
// the data is in useEditorSource, which both use.

interface DataEditorProps {
  onClose: () => void;
  /**
   * Open with this space already picked. Left out, the editor starts with
   * nothing selected exactly as it always has.
   */
  initialSpaceName?: string | null;
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

// Admin auth gate. This thin wrapper exists ONLY so the gate's early return
// lives in a component that has exactly one hook, never 28.
//
// The gate used to sit at the top of DataEditorContent itself: it ran useState,
// then returned before the other 27 hooks when unauthenticated. On a fresh
// (unauthenticated) mount React recorded 1 hook for this component — and the
// instant the admin logged in, setIsAuthed re-rendered that SAME component,
// which now ran all 28. React throws "Rendered more hooks than during the
// previous render" on exactly that transition, so the editor crashed for
// precisely the people who had to log in. Admins whose session was already
// authenticated skipped the gate on first render and never saw it, which is how
// it survived unnoticed. (28 react-hooks/rules-of-hooks errors; DEF-3 in the
// 2026-06-10 deficiency audit.)
export function DataEditor({ onClose, initialSpaceName }: DataEditorProps): JSX.Element {
  const [isAuthed, setIsAuthed] = useState(() => isAdminAuthenticated());
  if (!isAuthed) {
    return <AdminAuthGate onAuthenticated={() => setIsAuthed(true)} onClose={onClose} />;
  }
  return <DataEditorContent onClose={onClose} initialSpaceName={initialSpaceName} />;
}

function DataEditorContent({ onClose, initialSpaceName }: DataEditorProps): JSX.Element {
  // Which space is being worked on, and how the rest of the screen is
  // filtered, stay here — they are this screen's own furniture. Everything
  // about the DATA (the three CSVs, what is unsaved, and the save itself)
  // lives in useEditorSource, shared with the merged screen's focus mode so
  // there is one save path and one idea of "unsaved" between them.
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(initialSpaceName ?? null);
  const [visitType, setVisitType] = useState<'First' | 'Subsequent'>('First');
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  // activeTab removed — dice rolls now inline in SpaceEditor

  const {
    spacesData, diceRollData, modalConfigData,
    allSpaceNames, spaceFirst, spaceSubsequent,
    isLoading, error, hasUnsavedChanges, isSaving, saveStatus,
    handleFieldChange, handleDisplayLabelChange,
    handleDiceRollUpdate, handleAddDiceRoll, handleDeleteDiceRoll,
    handleModalConfigChange, handleAddSpace, handleDeleteSpace,
    handleSave, handleResetToBaseline,
  } = useEditorSource(selectedSpaceId);

  // Adding a space lands you on it; deleting the one you were on leaves you
  // with nothing picked. The rows themselves are the hook's business.
  const addSpace = useCallback((spaceName: string) => {
    handleAddSpace(spaceName);
    setSelectedSpaceId(spaceName);
  }, [handleAddSpace]);

  const deleteSpace = useCallback((spaceName: string) => {
    handleDeleteSpace(spaceName);
    setSelectedSpaceId(prev => (prev === spaceName ? null : prev));
  }, [handleDeleteSpace]);

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
                  onAddSpace={addSpace}
                  onDeleteSpace={deleteSpace}
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
                  onModalConfigChange={handleModalConfigChange}
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
