// src/components/board/BoardToggle.tsx
//
// Workstream 3 / Phase B testing aid. Floating button in the top-right
// corner that flips between BoardV3 (snake-grid, the default) and
// BoardCanvas (React Flow). Stored in localStorage so the choice
// survives reloads.
//
// Visible to admin only (via isAdminAuthenticated). Regular players
// don't see the dev toggle and stay on whichever board is the default.
//
// Will be removed in Phase D/E once BoardCanvas becomes the only board.

import React from 'react';
import { isAdminAuthenticated } from '../../utils/adminAuth';

export type BoardImpl = 'v3' | 'canvas';

interface BoardToggleProps {
  boardImpl: BoardImpl;
  onBoardImplChange: (v: BoardImpl) => void;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  /** When false, BoardCanvas hides all edges. Lets admin focus on
   *  arranging tiles without the visual noise of auto-routed arrows.
   *  No effect on BoardV3. */
  edgesVisible: boolean;
  onEdgesVisibleChange: (v: boolean) => void;
  /** Number of edges manually hidden (per-edge hide). 0 = none hidden.
   *  Shown as a small badge so admin remembers there are hidden edges. */
  hiddenEdgeCount?: number;
  /** Restore all per-edge hides. */
  onClearHiddenEdges?: () => void;
}

export function BoardToggle({
  boardImpl,
  onBoardImplChange,
  editMode,
  onEditModeChange,
  edgesVisible,
  onEdgesVisibleChange,
  hiddenEdgeCount = 0,
  onClearHiddenEdges,
}: BoardToggleProps) {
  // Gate behind admin auth so normal players never see the dev toggle.
  // Re-check on each render so unlocking via /admin shows it immediately.
  if (!isAdminAuthenticated()) return null;

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '6px',
    border: '1px solid #ced4da',
    background: '#fff',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    fontFamily: 'system-ui, sans-serif',
  };

  const activeStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#0d6efd',
    color: '#fff',
    border: '1px solid #0d6efd',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 1500,
        display: 'flex',
        gap: 6,
        background: '#f8f9fa',
        padding: '6px 8px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: '1px solid #dee2e6',
      }}
      // Stop drag events bubbling — important when BoardCanvas is the
      // child renderer; React Flow's pan/drag could otherwise catch
      // pointer events on the toggle.
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        style={boardImpl === 'v3' ? activeStyle : buttonStyle}
        onClick={() => onBoardImplChange('v3')}
        title="Snake-grid board (current default)"
      >
        📊 Old
      </button>
      <button
        type="button"
        style={boardImpl === 'canvas' ? activeStyle : buttonStyle}
        onClick={() => onBoardImplChange('canvas')}
        title="React Flow board (Workstream 3)"
      >
        🎨 New
      </button>
      {boardImpl === 'canvas' && (
        <>
          <button
            type="button"
            style={editMode ? activeStyle : buttonStyle}
            onClick={() => onEditModeChange(!editMode)}
            title="Drag tiles to reposition. New coords logged to browser console (F12)."
          >
            ✏️ Edit {editMode ? 'on' : 'off'}
          </button>
          <button
            type="button"
            style={edgesVisible ? activeStyle : buttonStyle}
            onClick={() => onEdgesVisibleChange(!edgesVisible)}
            title={edgesVisible ? 'Hide all connector lines' : 'Show all connector lines'}
          >
            🔗 Edges {edgesVisible ? 'on' : 'off'}
          </button>
          {hiddenEdgeCount > 0 && onClearHiddenEdges && (
            <button
              type="button"
              style={{ ...buttonStyle, background: '#fff3cd', borderColor: '#ffc107' }}
              onClick={onClearHiddenEdges}
              title={`${hiddenEdgeCount} edge${hiddenEdgeCount === 1 ? '' : 's'} hidden individually — click to restore`}
            >
              🚫 {hiddenEdgeCount} hidden · restore
            </button>
          )}
        </>
      )}
    </div>
  );
}
