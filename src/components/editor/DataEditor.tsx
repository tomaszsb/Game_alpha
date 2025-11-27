
import React, { useState, useEffect } from 'react';
import { useGameContext } from '../../context/GameContext';
import { Space } from '../../types/DataTypes';

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
    const confirmed = window.confirm(
      '⚠️ Clear All Game Data?\n\n' +
      'This will permanently delete:\n' +
      '• All players\n' +
      '• Current game progress\n' +
      '• Game state\n\n' +
      'The page will reload after clearing.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      // Get backend URL using window.location to match network setup
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const backendURL = `${protocol}//${hostname}:3001`;

      const response = await fetch(`${backendURL}/api/gamestate`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('✅ Game data cleared successfully!\n\nPage will reload...');
        window.location.reload();
      } else {
        alert('❌ Failed to clear game data. Please try again.');
      }
    } catch (error) {
      console.error('Error clearing game data:', error);
      alert('❌ Error connecting to server. Make sure the backend is running on port 3001.');
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
