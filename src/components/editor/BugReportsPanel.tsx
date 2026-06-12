import React, { useState, useEffect, useCallback } from 'react';
import { getBackendURL } from '../../utils/networkDetection';
import { getAdminPassword } from '../../utils/adminAuth';

const UNDO_KEY = 'bugReportsUndo';

interface UndoEntry {
  id: string;
  whatWrong: string;
  sessionsLeft: number;
}

interface FeedbackReport {
  id: string;
  createdAt: string;
  whatDoing: string;
  whatWrong: string;
  resolved?: boolean;
  metadata: {
    gameId?: string;
    playerId?: string;
    version?: string;
  };
}

function loadUndo(): UndoEntry[] {
  try { return JSON.parse(localStorage.getItem(UNDO_KEY) || '[]'); } catch { return []; }
}
function saveUndo(entries: UndoEntry[]): void {
  localStorage.setItem(UNDO_KEY, JSON.stringify(entries));
}
function initUndo(): UndoEntry[] {
  const decremented = loadUndo()
    .map(e => ({ ...e, sessionsLeft: e.sessionsLeft - 1 }))
    .filter(e => e.sessionsLeft > 0);
  saveUndo(decremented);
  return decremented;
}

function shortId(id: string): string {
  return id.replace(/\.json$/, '').split('-').pop() || id;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

interface BugReportsPanelProps {
  onClose: () => void;
}

export function BugReportsPanel({ onClose }: BugReportsPanelProps): JSX.Element {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [undoList, setUndoList] = useState<UndoEntry[]>(() => initUndo());

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Feedback reads are admin-gated server-side (reports can carry
      // reporter contact info). The panel only renders after the admin
      // unlock, so the session password is available here.
      const res = await fetch(`${getBackendURL()}/api/feedback`, {
        headers: { 'x-admin-password': getAdminPassword() || '' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const patchReport = useCallback(async (id: string, resolved: boolean) => {
    const res = await fetch(`${getBackendURL()}/api/feedback/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': getAdminPassword() || '',
      },
      body: JSON.stringify({ resolved }),
    });
    // Surface auth/server rejections so callers' catch-and-revert works
    // (fetch only rejects on network errors, not 401/500).
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }, []);

  const toggleResolved = useCallback(async (e: React.MouseEvent, report: FeedbackReport) => {
    e.stopPropagation();
    const newStatus = !report.resolved;
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, resolved: newStatus } : r));

    if (newStatus) {
      const entry: UndoEntry = { id: report.id, whatWrong: report.whatWrong, sessionsLeft: 3 };
      const updated = [...undoList.filter(u => u.id !== report.id), entry];
      setUndoList(updated);
      saveUndo(updated);
    } else {
      const updated = undoList.filter(u => u.id !== report.id);
      setUndoList(updated);
      saveUndo(updated);
    }

    try {
      await patchReport(report.id, newStatus);
    } catch {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, resolved: !newStatus } : r));
    }
  }, [undoList, patchReport]);

  const handleUndo = useCallback(async (entry: UndoEntry) => {
    setReports(prev => prev.map(r => r.id === entry.id ? { ...r, resolved: false } : r));
    const updated = undoList.filter(u => u.id !== entry.id);
    setUndoList(updated);
    saveUndo(updated);
    try { await patchReport(entry.id, false); } catch { /* silent */ }
  }, [undoList, patchReport]);

  const dismissUndo = useCallback((id: string) => {
    const updated = undoList.filter(u => u.id !== id);
    setUndoList(updated);
    saveUndo(updated);
  }, [undoList]);

  const filtered = reports.filter(r => {
    if (!showResolved && r.resolved) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.whatDoing.toLowerCase().includes(q) ||
      r.whatWrong.toLowerCase().includes(q) ||
      shortId(r.id).includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  const unresolvedCount = reports.filter(r => !r.resolved).length;

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={s.title}>🐛 Bug Reports</h2>
            <span style={{
              ...s.badge,
              backgroundColor: unresolvedCount > 0 ? '#fde8e8' : '#d4edda',
              color: unresolvedCount > 0 ? '#c0392b' : '#155724',
              borderColor: unresolvedCount > 0 ? '#f5c6cb' : '#c3e6cb',
            }}>
              {unresolvedCount} unresolved
            </span>
          </div>
          <button onClick={onClose} style={s.closeBtn}>&times;</button>
        </div>

        {/* ── Toolbar ── */}
        <div style={s.toolbar}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search description or fb: ID…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={s.searchInput}
            />
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowResolved(v => !v)}
            style={{ ...s.toolbarBtn, ...(showResolved ? s.toolbarBtnActive : {}) }}
          >
            {showResolved ? '👁 Showing all' : '🚫 Hiding resolved'}
          </button>
          <button onClick={fetchReports} disabled={loading} style={s.toolbarBtn}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>

        {/* ── Undo banners ── */}
        {undoList.length > 0 && (
          <div style={s.undoArea}>
            {undoList.map(entry => (
              <div key={entry.id} style={s.undoBanner}>
                <span style={{ fontSize: '16px' }}>↩</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={s.undoLabel}>Just resolved: </span>
                  <em style={s.undoText}>
                    "{entry.whatWrong.length > 70
                      ? entry.whatWrong.slice(0, 70) + '…'
                      : entry.whatWrong}"
                  </em>
                  <span style={s.undoCounter}>
                    · undo available for {entry.sessionsLeft} more
                    {entry.sessionsLeft === 1 ? ' session' : ' sessions'}
                  </span>
                </div>
                <button onClick={() => handleUndo(entry)} style={s.undoBtn}>Undo</button>
                <button onClick={() => dismissUndo(entry.id)} style={s.dismissBtn} title="Dismiss">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Table ── */}
        <div style={s.tableWrap}>
          {error ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: '36px' }}>⚠️</div>
              <div style={{ color: '#c0392b', marginTop: '8px' }}>Could not load reports: {error}</div>
              <button onClick={fetchReports} style={{ ...s.toolbarBtn, marginTop: '12px' }}>Retry</button>
            </div>
          ) : loading && reports.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ color: '#888', marginTop: '8px' }}>Loading reports…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: '48px', opacity: 0.2 }}>🐛</div>
              <div style={{ color: '#aaa', marginTop: '10px', fontSize: '14px' }}>
                No {showResolved ? '' : 'unresolved '}reports
                {searchTerm ? ' matching your search' : ''}.
              </div>
              {!showResolved && reports.some(r => r.resolved) && (
                <button
                  onClick={() => setShowResolved(true)}
                  style={{ ...s.toolbarBtn, marginTop: '10px', color: '#0056b3', borderColor: '#0056b3' }}
                >
                  Show {reports.filter(r => r.resolved).length} resolved
                </button>
              )}
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  {[
                    { label: 'Status',              w: '108px' },
                    { label: 'Time',                w: '130px' },
                    { label: 'Report ID',           w: '110px' },
                    { label: 'What were you doing?',w: undefined },
                    { label: 'What went wrong?',    w: undefined },
                  ].map(col => (
                    <th key={col.label} style={{ ...s.th, width: col.w }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((report, i) => {
                  const resolved = !!report.resolved;
                  const rowBg = resolved ? '#f8fff8' : i % 2 === 0 ? '#ffffff' : '#fafafa';
                  return (
                    <tr
                      key={report.id}
                      style={{ backgroundColor: rowBg, transition: 'background 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f0f4ff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowBg; }}
                    >
                      {/* Status pill / toggle */}
                      <td style={s.td}>
                        <button
                          onClick={e => toggleResolved(e, report)}
                          title={resolved ? 'Click to reopen' : 'Click to resolve'}
                          style={{
                            ...s.statusPill,
                            backgroundColor: resolved ? '#d4edda' : '#fde8e8',
                            color:           resolved ? '#155724' : '#c0392b',
                            border:          `1px solid ${resolved ? '#c3e6cb' : '#f5c6cb'}`,
                          }}
                        >
                          {resolved ? '✓ Resolved' : '● Open'}
                        </button>
                      </td>

                      {/* Time */}
                      <td style={{ ...s.td, color: '#888', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {formatTime(report.createdAt)}
                      </td>

                      {/* fb: ID chip */}
                      <td style={s.td}>
                        <span
                          title={`Full ID: ${report.id}`}
                          style={s.idChip}
                        >
                          fb:{shortId(report.id)}
                        </span>
                      </td>

                      {/* whatDoing */}
                      <td style={{ ...s.td, maxWidth: '280px' }}>
                        <div style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: resolved ? '#bbb' : '#333',
                          textDecoration: resolved ? 'line-through' : 'none',
                        }} title={report.whatDoing}>
                          {report.whatDoing}
                        </div>
                      </td>

                      {/* whatWrong */}
                      <td style={{ ...s.td, maxWidth: '380px' }}>
                        <div style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: resolved ? '#bbb' : '#c0392b',
                          fontStyle: resolved ? 'italic' : 'normal',
                        }} title={report.whatWrong}>
                          {report.whatWrong}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'white', borderRadius: '10px',
    width: '97%', maxWidth: '1200px', height: '88vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
  },
  header: {
    padding: '12px 16px', borderBottom: '1px solid #dee2e6',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8f9fa', flexShrink: 0,
  },
  title: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#212529' },
  badge: {
    fontSize: '12px', fontWeight: 700, padding: '3px 10px',
    borderRadius: '12px', border: '1px solid transparent',
  },
  closeBtn: {
    background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px',
    fontSize: '20px', fontWeight: 'bold', cursor: 'pointer',
    padding: '4px 10px', color: '#333', lineHeight: 1,
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 16px', borderBottom: '1px solid #dee2e6',
    backgroundColor: 'white', flexShrink: 0,
  },
  searchWrap: {
    position: 'relative', display: 'flex', alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute', left: '10px', fontSize: '13px', pointerEvents: 'none',
  },
  searchInput: {
    paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px',
    borderRadius: '6px', fontSize: '13px',
    border: '1px solid #dee2e6', width: '300px',
    outline: 'none', transition: 'border-color 0.15s',
  },
  toolbarBtn: {
    padding: '6px 13px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', border: '1px solid #dee2e6',
    backgroundColor: 'white', color: '#555', transition: 'all 0.15s',
  },
  toolbarBtnActive: {
    backgroundColor: '#e3f2fd', borderColor: '#90caf9', color: '#0d47a1',
  },
  undoArea: {
    padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '6px',
    borderBottom: '1px solid #dee2e6', backgroundColor: '#fffdf5', flexShrink: 0,
  },
  undoBanner: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 14px', borderRadius: '7px',
    backgroundColor: '#fff3cd', border: '1px solid #ffc107',
  },
  undoLabel: { fontSize: '13px', fontWeight: 600, color: '#856404' },
  undoText:  { fontSize: '13px', color: '#856404' },
  undoCounter: { fontSize: '11px', color: '#a78628', marginLeft: '6px' },
  undoBtn: {
    padding: '4px 14px', borderRadius: '5px', cursor: 'pointer',
    border: '1px solid #d97706', backgroundColor: '#f59e0b',
    color: 'white', fontSize: '12px', fontWeight: 700,
    flexShrink: 0, transition: 'background 0.15s',
  },
  dismissBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a16207', fontSize: '14px', padding: '2px 6px',
    borderRadius: '4px', flexShrink: 0,
  },
  tableWrap: { flex: 1, overflow: 'auto' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', padding: '48px',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead: {
    backgroundColor: '#f8f9fa', position: 'sticky', top: 0, zIndex: 1,
    boxShadow: '0 1px 0 #dee2e6',
  },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: '#666',
    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    borderBottom: '2px solid #dee2e6', whiteSpace: 'nowrap',
  },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  statusPill: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '12px',
    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  },
  idChip: {
    fontFamily: 'monospace', fontSize: '11px',
    backgroundColor: '#e9ecef', padding: '3px 8px',
    borderRadius: '4px', color: '#495057',
    cursor: 'default', userSelect: 'all' as const,
    letterSpacing: '0.03em', display: 'inline-block',
  },
};
