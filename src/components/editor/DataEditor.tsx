
import React, { useState, useEffect } from 'react';
import { useGameContext } from '../../context/GameContext';
import { Space } from '../../types/DataTypes';
import { getBackendURL, getGameStateAPIPath, getCurrentGameId } from '../../utils/networkDetection';

interface DataEditorProps {
  onClose: () => void;
}

export function DataEditor({ onClose }: DataEditorProps): JSX.Element {
  const { dataService } = useGameContext();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');

  useEffect(() => {
    // In a real implementation, you'd fetch all spaces
    // For now, this is a placeholder
    const allSpaces = dataService.getAllSpaces();
    setSpaces(allSpaces);
  }, [dataService]);

  const handleDownload = () => {
    // Logic to convert edited data to CSV and trigger download
    alert('CSV download functionality to be implemented!');
  };

  const handleClearData = async () => {
    console.log('🗑️ Clear Game Data button clicked');

    const confirmed = window.confirm(
      '⚠️ Clear All Game Data?\n\n' +
      'This will permanently delete:\n' +
      '• All players\n' +
      '• Current game progress\n' +
      '• Game state\n\n' +
      'The page will reload after clearing.\n\n' +
      'Continue?'
    );

    if (!confirmed) {
      console.log('🗑️ Clear Game Data cancelled by user');
      return;
    }

    console.log('🗑️ User confirmed - clearing game data...');

    try {
      const backendURL = getBackendURL();
      const gameId = getCurrentGameId();
      const apiPath = getGameStateAPIPath(gameId);

      console.log(`🗑️ Sending DELETE to: ${backendURL}${apiPath}`);

      const response = await fetch(`${backendURL}${apiPath}`, {
        method: 'DELETE'
      });

      console.log(`🗑️ Response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log('🗑️ Clear successful:', result);
        alert('✅ Game data cleared successfully!\n\nPage will reload...');
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('🗑️ Clear failed:', response.status, errorText);
        alert(`❌ Failed to clear game data (${response.status}). Please try again.`);
      }
    } catch (error) {
      console.error('🗑️ Error clearing game data:', error);
      alert('❌ Error connecting to server. Make sure the backend is running on port 3001.\n\nError: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>Space Data Editor</h2>
          <button onClick={onClose} style={styles.closeButton}>&times;</button>
        </div>
        <div style={styles.content}>
          <p>Editor UI will go here.</p>
          <div style={styles.formGroup}>
            <label htmlFor="space-select">Select Space:</label>
            <select
              id="space-select"
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              style={styles.select}
            >
              <option value="">--Choose a Space--</option>
              {spaces.map(space => (
                <option key={space.id} value={space.id}>
                  {space.id}: {space.title}
                </option>
              ))}
            </select>
          </div>
          {/* Form for editing the selected space will be built here */}
        </div>
        <div style={styles.footer}>
          <button onClick={handleClearData} style={styles.clearButton}>
            🗑️ Clear Game Data
          </button>
          <button onClick={handleDownload} style={styles.downloadButton}>
            Download as CSV
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
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
    zIndex: 1000,
  },
  modal: {
    background: 'white',
    borderRadius: '8px',
    width: '80%',
    maxWidth: '1000px',
    height: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '15px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
  },
  content: {
    padding: '15px',
    flex: 1,
    overflowY: 'auto',
  },
  footer: {
    padding: '15px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearButton: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  downloadButton: {
    background: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  formGroup: {
    marginBottom: '15px',
  },
  select: {
    width: '100%',
    padding: '8px',
    fontSize: '16px',
  }
};
