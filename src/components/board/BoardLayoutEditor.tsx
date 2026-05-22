// src/components/board/BoardLayoutEditor.tsx
//
// Workstream 3 / Phase D follow-up — standalone board layout editor.
//
// The board layout (pos_x / pos_y per space) is shared infrastructure: set
// once by the teacher, reused across every game. Coupling its editing to an
// active game session was an accident of where BoardCanvas mounted, not a
// design decision. This component breaks that coupling.
//
// Launched from the lobby's "🛠️ Admin Tools" section. Mounts BoardCanvas
// with no game state (empty players, null currentPlayerId) and isAdmin=true
// so drag-to-save is always on. No BoardToggle here — this view is
// purpose-built for arranging tiles, so there's no need to flip between
// implementations or modes.
//
// Drag-save persists through the same /api/admin/save-source-files endpoint
// the in-game edit mode uses, so a change here is immediately reflected the
// next time anyone (player or admin) loads the game.

import React from 'react';
import { BoardCanvas } from './BoardCanvas';
import { colors } from '../../styles/theme';

interface BoardLayoutEditorProps {
  onClose: () => void;
}

export function BoardLayoutEditor({ onClose }: BoardLayoutEditorProps): JSX.Element {
  // Handle Escape to close, like a standard modal.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Board Layout Editor"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header bar with title, hint, and close */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          background: '#fff',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 700,
              color: colors.text.primary
            }}
          >
            🗺️ Board Layout Editor
          </h2>
          <p
            style={{
              margin: '0.15rem 0 0',
              fontSize: '0.82rem',
              color: colors.text.secondary
            }}
          >
            Drag tiles to reposition. Each drop saves automatically — the
            green banner top-right confirms the new coordinates were written
            to <code>Spaces.csv</code>. Changes apply to every future game.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '0.5rem 1rem',
            background: '#f8f9fa',
            color: '#495057',
            border: '1px solid #dee2e6',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500
          }}
          title="Close (Esc)"
        >
          ✕ Close
        </button>
      </div>

      {/* Board canvas, full remaining height. No game state — players empty,
          no current player. isAdmin=true forces edit mode on so tiles are
          draggable from the moment the editor opens. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <BoardCanvas
          currentPlayerId={null}
          players={[]}
          isAdmin={true}
          edgesVisible={true}
        />
      </div>
    </div>
  );
}
