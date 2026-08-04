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
// Drag-save persists into the classroom's instance config (the teacher
// instance layer, /api/instances/.../positions) — same path the in-game
// edit mode uses, so a change here is immediately reflected the next time
// anyone (player or admin) loads the game, and survives every deploy.
//
// Same permanence for connector redirects (G160, /api/instances/.../
// edge-waypoints, added 2026-08-04): a redirect handle dragged here fixes
// a badly auto-routed line for every teacher/device/future game, not just
// this browser — matching what the header banner already promises for
// tile positions.
//
// IMPORTANT (v2.69.4): DataService caches GAME_CONFIG.csv at app startup
// and never refetches it (the `loaded` flag guards loadData() from re-runs).
// Without intervention, reopening this editor after a save shows tiles back
// at their ORIGINAL positions — BoardCanvas's initialNodes useMemo reads
// from the stale cache, even though the disk has the new coords. Fix: call
// dataService.reloadGameConfig() on every open before rendering BoardCanvas,
// so initialNodes sees fresh positions from disk.
//
// We deliberately do NOT reload after each drag-save in the same session:
//   - React Flow's local node state already reflects the new position, so
//     the user sees the move complete immediately.
//   - Remounting BoardCanvas on every save would lose React Flow's
//     pan/zoom/selection state, which a layout editor sits on heavily.
// The on-disk source of truth gets refreshed when the editor is reopened.

import React, { useCallback, useEffect, useState } from 'react';
import { BoardCanvas } from './BoardCanvas';
import { RestorablePillDropdown } from './RestorablePillDropdown';
import { useGameContext } from '../../context/GameContext';
import { colors } from '../../styles/theme';
import { fetchEdgeWaypoints, saveEdgeWaypoints, clearEdgeWaypoint, clearAllEdgeWaypoints, type EdgeWaypointResult } from '../../utils/saveEdgeWaypoint';
import { fetchEdgeAnchors, saveEdgeAnchor, clearEdgeAnchor, type EdgeAnchorResult, type EdgeEnd } from '../../utils/saveEdgeAnchor';
import type { BoxAnchor } from '../../utils/boardCommon';

const pillButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
  border: '1px solid #dee2e6',
};

interface BoardLayoutEditorProps {
  onClose: () => void;
}

export function BoardLayoutEditor({ onClose }: BoardLayoutEditorProps): JSX.Element {
  const { dataService } = useGameContext();
  const [ready, setReady] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  // Per-edge waypoint redirect (G160) — permanent, classroom-wide (same
  // server tier as tile positions), so a redirect drawn here is also what
  // players see in-game. Fetched independently of the reloadGameConfig
  // gate above: unlike tile positions, this doesn't feed BoardCanvas's
  // memoized initialNodes, so there's no stale-cache risk in rendering it
  // as soon as it arrives.
  const [edgeWaypoints, setEdgeWaypoints] = useState<Record<string, { x: number; y: number }[]>>({});
  const [boardEditError, setBoardEditError] = useState<string | null>(null);
  // Per-edge hide set — same per-device localStorage tier and key
  // GameLayout.tsx's in-game admin toggle already uses, so a connector
  // hidden in either tool stays hidden in both (same admin, same device).
  // Never wired up here before now — a real pre-existing gap, not
  // something this session's other board changes broke.
  const [hiddenEdgeIds, setHiddenEdgeIdsState] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem('unravel:boardHiddenEdges');
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const setHiddenEdgeIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setHiddenEdgeIdsState(prev => {
      const next = updater(prev);
      try {
        window.localStorage.setItem('unravel:boardHiddenEdges', JSON.stringify([...next]));
      } catch { /* ignored */ }
      return next;
    });
  }, []);
  const onHideEdge = useCallback((edgeId: string) => {
    setHiddenEdgeIds(prev => {
      const next = new Set(prev);
      next.add(edgeId);
      return next;
    });
  }, [setHiddenEdgeIds]);
  const onClearHiddenEdges = useCallback(() => {
    setHiddenEdgeIds(() => new Set());
  }, [setHiddenEdgeIds]);
  const onRestoreOneHiddenEdge = useCallback((edgeId: string) => {
    setHiddenEdgeIds(prev => {
      const next = new Set(prev);
      next.delete(edgeId);
      return next;
    });
  }, [setHiddenEdgeIds]);

  // Refresh GAME_CONFIG.csv on every open so we pick up any pos_x/pos_y
  // changes persisted from a previous editor session (or via in-game drag).
  // We hold the canvas off-screen until the fetch completes — otherwise
  // BoardCanvas's initialNodes would memoize stale positions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dataService.reloadGameConfig();
        if (cancelled) return;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setReloadError(err instanceof Error ? err.message : 'Failed to refresh board data.');
        // Render BoardCanvas anyway so the user still gets a usable editor;
        // they'll see the stale coords but can still drag/save fresh ones.
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [dataService]);

  useEffect(() => {
    let cancelled = false;
    fetchEdgeWaypoints().then(fetched => {
      if (!cancelled) setEdgeWaypoints(fetched);
    });
    return () => { cancelled = true; };
  }, []);

  const onSetEdgeWaypoints = useCallback((edgeId: string, points: { x: number; y: number }[]) => {
    setEdgeWaypoints(prev => ({ ...prev, [edgeId]: points }));
    saveEdgeWaypoints(edgeId, points).then((result: EdgeWaypointResult) => {
      if (!result.success) setBoardEditError(`Couldn't save the redirect (${result.detail})`);
    });
  }, []);
  const onClearEdgeWaypoint = useCallback((edgeId: string) => {
    setEdgeWaypoints(prev => {
      const next = { ...prev };
      delete next[edgeId];
      return next;
    });
    clearEdgeWaypoint(edgeId).then(result => {
      if (!result.success) setBoardEditError(`Couldn't clear the redirect (${result.detail})`);
    });
  }, []);
  const onClearAllEdgeWaypoints = useCallback(() => {
    setEdgeWaypoints({});
    clearAllEdgeWaypoints().then(result => {
      if (!result.success) setBoardEditError(`Couldn't clear all redirects (${result.detail})`);
    });
  }, []);

  // Box-side anchor snapping (2026-08-04) — independent of edgeWaypoints
  // above, same permanent server tier.
  const [edgeAnchors, setEdgeAnchors] = useState<Record<string, { source?: BoxAnchor; target?: BoxAnchor }>>({});
  useEffect(() => {
    let cancelled = false;
    fetchEdgeAnchors().then(fetched => {
      if (!cancelled) setEdgeAnchors(fetched);
    });
    return () => { cancelled = true; };
  }, []);

  const onSetEdgeAnchor = useCallback((edgeId: string, end: EdgeEnd, anchor: BoxAnchor) => {
    setEdgeAnchors(prev => ({ ...prev, [edgeId]: { ...prev[edgeId], [end]: anchor } }));
    saveEdgeAnchor(edgeId, end, anchor).then((result: EdgeAnchorResult) => {
      if (!result.success) setBoardEditError(`Couldn't save the anchor (${result.detail})`);
    });
  }, []);
  const onClearEdgeAnchor = useCallback((edgeId: string, end: EdgeEnd) => {
    setEdgeAnchors(prev => {
      const next = { ...prev };
      const entry = { ...next[edgeId] };
      delete entry[end];
      if (Object.keys(entry).length === 0) delete next[edgeId];
      else next[edgeId] = entry;
      return next;
    });
    clearEdgeAnchor(edgeId, end).then((result: EdgeAnchorResult) => {
      if (!result.success) setBoardEditError(`Couldn't clear the anchor (${result.detail})`);
    });
  }, []);

  // Handle Escape to close, like a standard modal.
  useEffect(() => {
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
            Click a connector line to hide it individually.
          </p>
          {reloadError && (
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.78rem',
                color: '#991b1b',
              }}
            >
              ⚠️ Couldn’t refresh latest positions ({reloadError}). Showing cached layout.
            </p>
          )}
          {boardEditError && (
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.78rem',
                color: '#991b1b',
              }}
            >
              ⚠️ {boardEditError}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RestorablePillDropdown
            icon="🚫"
            label="hidden"
            itemIds={[...hiddenEdgeIds]}
            background="#fff3cd"
            borderColor="#ffc107"
            textColor="#664d03"
            onRestoreOne={onRestoreOneHiddenEdge}
            onRestoreAll={onClearHiddenEdges}
            baseButtonStyle={pillButtonStyle}
          />
          <RestorablePillDropdown
            icon="↩️"
            label="redirected"
            itemIds={Object.keys(edgeWaypoints)}
            background="#eef2ff"
            borderColor="#6366f1"
            textColor="#3730a3"
            onRestoreOne={onClearEdgeWaypoint}
            onRestoreAll={onClearAllEdgeWaypoints}
            baseButtonStyle={pillButtonStyle}
          />
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
      </div>

      {/* Board canvas, full remaining height. No game state — players empty,
          no current player. isAdmin=true forces edit mode on so tiles are
          draggable from the moment the editor opens. The mount happens only
          AFTER dataService.reloadGameConfig() resolves, so initialNodes
          reads fresh pos_x/pos_y from disk on the very first render. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {ready ? (
          <BoardCanvas
            currentPlayerId={null}
            players={[]}
            isAdmin={true}
            edgesVisible={true}
            hiddenEdgeIds={hiddenEdgeIds}
            onHideEdge={onHideEdge}
            showBuffer={true}
            edgeWaypoints={edgeWaypoints}
            onSetEdgeWaypoints={onSetEdgeWaypoints}
            onClearEdgeWaypoint={onClearEdgeWaypoint}
            edgeAnchors={edgeAnchors}
            onSetEdgeAnchor={onSetEdgeAnchor}
            onClearEdgeAnchor={onClearEdgeAnchor}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text.secondary,
              fontSize: '0.95rem',
            }}
          >
            ⏳ Loading latest board layout…
          </div>
        )}
      </div>
    </div>
  );
}
