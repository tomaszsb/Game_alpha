// src/components/board/BoardToggle.tsx
//
// Floating control strip in the top-right corner of the gameplay board.
// Originally (Workstream 3 Phase B) this had Old/New buttons that flipped
// between BoardV3 and BoardCanvas; v3.0.0 retired BoardV3, so the impl flip
// is gone and only the BoardCanvas-specific controls remain (in-game edit
// toggle, edge visibility, hidden-edge restore).
//
// 2026-07-26 (G160): the "Edges on/off" declutter control was fully gated
// behind isAdminAuthenticated(), so even the maintainer playing a normal
// (non-admin) session had no way to reach it. Corrected to also open it up
// to a logged-in teacher (the person actually running a classroom instance)
// — NOT to regular players/students. In shared-screen mode a whole group
// looks at one device, so this was never a "personal" per-player preference
// to begin with; it's a presentation control for whoever is running the
// game. Edit mode (dragging tiles) stays admin-only — that's a real
// classroom-config change, a stricter bar than just decluttering the view.

import React from 'react';
import { isAdminAuthenticated } from '../../utils/adminAuth';
import { isTeacherLoggedIn } from '../../utils/teacherAuth';
import { RestorablePillDropdown } from './RestorablePillDropdown';

interface BoardToggleProps {
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  /** When false, BoardCanvas hides all edges. Admin or a logged-in teacher
   *  only — not regular players. */
  edgesVisible: boolean;
  onEdgesVisibleChange: (v: boolean) => void;
  /** Ids of edges manually hidden (per-edge hide, admin-edit-mode only).
   *  Empty = none hidden. Clicking the pill opens a list to pick which
   *  one to restore (2026-08-04) — a hidden edge has no visible surface
   *  left to interact with directly, unlike waypoints/anchors. */
  hiddenEdgeIds?: string[];
  /** Restore one specific hidden edge. */
  onRestoreOneHiddenEdge?: (edgeId: string) => void;
  /** Restore all per-edge hides. */
  onClearHiddenEdges?: () => void;
  /** Ids of edges with a manual waypoint redirect (G160, admin-edit-mode
   *  only). Empty = none redirected. Separate from hiddenEdgeIds — a
   *  redirect reshapes an edge's path, a hide removes it entirely;
   *  independently reversible so clearing one doesn't discard the other. */
  redirectedEdgeIds?: string[];
  /** Restore one specific edge's redirect back to auto-routing. */
  onRestoreOneWaypoint?: (edgeId: string) => void;
  /** Restore all per-edge waypoint redirects to normal auto-routing. */
  onClearRedirectedEdges?: () => void;
}

export function BoardToggle({
  editMode,
  onEditModeChange,
  edgesVisible,
  onEdgesVisibleChange,
  hiddenEdgeIds = [],
  onRestoreOneHiddenEdge,
  onClearHiddenEdges,
  redirectedEdgeIds = [],
  onRestoreOneWaypoint,
  onClearRedirectedEdges,
}: BoardToggleProps) {
  // Re-check on each render so unlocking via /admin or a teacher login shows
  // the right controls immediately, no remount needed.
  const isAdmin = isAdminAuthenticated();
  const isTeacher = isTeacherLoggedIn();
  // Nobody but admin/teacher gets any board control here — a regular player
  // (or a teacher who isn't logged in this browser) sees nothing at all.
  if (!isAdmin && !isTeacher) return null;

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
      // Stop drag events bubbling — important because React Flow's
      // pan/drag could otherwise catch pointer events on the toggle.
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isAdmin && (
        <button
          type="button"
          style={editMode ? activeStyle : buttonStyle}
          onClick={() => onEditModeChange(!editMode)}
          title="Drag tiles to reposition. Saves to the classroom config (survives updates)."
        >
          ✏️ Edit {editMode ? 'on' : 'off'}
        </button>
      )}
      <button
        type="button"
        style={edgesVisible ? activeStyle : buttonStyle}
        onClick={() => onEdgesVisibleChange(!edgesVisible)}
        title={edgesVisible ? 'Hide all connector lines' : 'Show all connector lines'}
      >
        🔗 Edges {edgesVisible ? 'on' : 'off'}
      </button>
      {onClearHiddenEdges && onRestoreOneHiddenEdge && (
        <RestorablePillDropdown
          icon="🚫"
          label="hidden"
          itemIds={hiddenEdgeIds}
          background="#fff3cd"
          borderColor="#ffc107"
          onRestoreOne={onRestoreOneHiddenEdge}
          onRestoreAll={onClearHiddenEdges}
          baseButtonStyle={buttonStyle}
        />
      )}
      {onClearRedirectedEdges && onRestoreOneWaypoint && (
        <RestorablePillDropdown
          icon="↩️"
          label="redirected"
          itemIds={redirectedEdgeIds}
          background="#eef2ff"
          borderColor="#6366f1"
          onRestoreOne={onRestoreOneWaypoint}
          onRestoreAll={onClearRedirectedEdges}
          baseButtonStyle={buttonStyle}
        />
      )}
    </div>
  );
}
