import React, { useState, useEffect, useCallback } from 'react';
import { getBackendURL } from '../../utils/networkDetection';
import { colors } from '../../styles/theme';

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
    screenSize?: { width: number; height: number };
  };
}

function shortId(id: string): string {
  // id is "feedback-{timestamp}-{hex}.json" — return just the hex suffix
  return id.replace(/\.json$/, '').split('-').pop() || id;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export function BugReportsPanel(): JSX.Element {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendURL()}/api/feedback`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError('Could not load feedback: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const toggleResolved = useCallback(async (e: React.MouseEvent, report: FeedbackReport) => {
    e.stopPropagation();
    const newStatus = !report.resolved;
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, resolved: newStatus } : r));
    try {
      await fetch(`${getBackendURL()}/api/feedback/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: newStatus }),
      });
    } catch {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, resolved: !newStatus } : r));
    }
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 16px', borderBottom: `1px solid ${colors.secondary.border}`,
        backgroundColor: colors.secondary.bg, flexShrink: 0
      }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: colors.text?.primary || '#333' }}>
          🐛 Bug Reports
        </span>
        <span style={{
          fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
          backgroundColor: unresolvedCount > 0 ? colors.danger.bg : colors.success.light,
          color: unresolvedCount > 0 ? colors.danger.text : colors.success.darker,
          fontWeight: 700
        }}>
          {unresolvedCount} unresolved
        </span>

        <div style={{ flex: 1 }} />

        <input
          type="text"
          placeholder="Search by description or fb: ID…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
            border: `1px solid ${colors.secondary.border}`, width: '260px',
            outline: 'none'
          }}
        />

        <button
          onClick={() => setShowResolved(v => !v)}
          style={{
            padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${colors.secondary.border}`,
            backgroundColor: showResolved ? colors.primary.light : 'white',
            color: showResolved ? colors.primary.text : colors.secondary.main
          }}
        >
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>

        <button
          onClick={fetchReports}
          disabled={loading}
          style={{
            padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${colors.secondary.border}`, backgroundColor: 'white',
            color: colors.secondary.dark
          }}
        >
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error ? (
          <div style={{ padding: '24px', color: colors.danger.main, fontSize: '13px' }}>{error}</div>
        ) : loading && reports.length === 0 ? (
          <div style={{ padding: '24px', color: colors.secondary.main, fontSize: '13px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px', color: colors.secondary.main, fontSize: '13px' }}>
            No {showResolved ? '' : 'unresolved '}reports{searchTerm ? ' matching your search' : ''}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: colors.secondary.bg, position: 'sticky', top: 0 }}>
                {['✓', 'Time', 'fb: ID', 'What were you doing?', 'What went wrong?'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                    fontSize: '11px', color: colors.secondary.dark, letterSpacing: '0.04em',
                    borderBottom: `1px solid ${colors.secondary.border}`, whiteSpace: 'nowrap'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(report => {
                const resolved = !!report.resolved;
                return (
                  <tr
                    key={report.id}
                    style={{
                      backgroundColor: resolved ? '#f9fff9' : 'white',
                      opacity: resolved ? 0.65 : 1,
                      borderBottom: `1px solid ${colors.secondary.border}`
                    }}
                  >
                    {/* Resolve toggle */}
                    <td style={{ padding: '8px 12px', textAlign: 'center', width: '36px' }}>
                      <button
                        onClick={e => toggleResolved(e, report)}
                        title={resolved ? 'Mark unresolved' : 'Mark resolved'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '16px', lineHeight: 1, padding: 0,
                          color: resolved ? colors.success.main : colors.secondary.border
                        }}
                      >
                        {resolved ? '✅' : '○'}
                      </button>
                    </td>

                    {/* Time */}
                    <td style={{
                      padding: '8px 12px', whiteSpace: 'nowrap',
                      color: colors.secondary.main, fontFamily: 'monospace', fontSize: '11px'
                    }}>
                      {formatTime(report.createdAt)}
                    </td>

                    {/* Short ID */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span
                        title={report.id}
                        style={{
                          fontFamily: 'monospace', fontSize: '11px',
                          backgroundColor: colors.secondary.light, padding: '2px 6px',
                          borderRadius: '4px', color: colors.secondary.darker,
                          cursor: 'default', userSelect: 'all'
                        }}
                      >
                        fb:{shortId(report.id)}
                      </span>
                    </td>

                    {/* whatDoing */}
                    <td style={{
                      padding: '8px 12px', maxWidth: '280px',
                      color: resolved ? colors.secondary.main : colors.secondary.darker
                    }}>
                      <div style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: resolved ? 'line-through' : 'none'
                      }} title={report.whatDoing}>
                        {report.whatDoing}
                      </div>
                    </td>

                    {/* whatWrong */}
                    <td style={{
                      padding: '8px 12px', maxWidth: '360px',
                      color: resolved ? colors.secondary.main : colors.danger.text
                    }}>
                      <div style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
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
  );
}
