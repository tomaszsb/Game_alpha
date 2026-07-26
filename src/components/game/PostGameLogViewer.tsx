import React, { useState, useMemo } from 'react';
import { useGameContext } from '../../context/GameContext';
import { ActionLogEntry } from '../../types/StateTypes';
import { formatActionDescription, getLogTypeLabel } from '../../utils/actionLogFormatting';
import { getDisplayableLogEntries } from '../../utils/logFiltering';
import { LogRowDetail } from './LogRowDetail';
import {
  exportLogToMarkdown,
  exportLogToJson,
  exportLogToCsv,
  exportLogToPrintableHtml,
  triggerTextDownload,
  openPrintableTab,
  buildExportFilename,
  ExportMetadata,
} from '../../utils/logExport';
import { colors } from '../../styles/theme';
import { getCurrentGameId } from '../../utils/networkDetection';

declare const __APP_SEMVER__: string | undefined;
declare const __APP_VERSION__: string | undefined;

interface PostGameLogViewerProps {
  // The player whose perspective owns this view (default scope='mine').
  // When undefined, opens directly in 'all' scope.
  viewingPlayerId?: string;
}

type Scope = 'mine' | 'all';

export const PostGameLogViewer: React.FC<PostGameLogViewerProps> = ({ viewingPlayerId }) => {
  const { stateService } = useGameContext();
  const gameState = stateService.getGameState();
  // Phase 1.2 audit (2026-06-04): canonical isCommitted && visibility==='player' filter
  // shared with PlayerLogSection + GameLog via getDisplayableLogEntries. End-game state
  // has everything committed (or removed via discardCurrentSession) so isCommitted is a
  // defensive no-op here, but consistency makes future log-rule changes a single edit.
  const fullLog = useMemo(
    () => getDisplayableLogEntries(gameState.globalActionLog),
    [gameState.globalActionLog],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(viewingPlayerId ? 'mine' : 'all');
  const [searchText, setSearchText] = useState('');
  const [filterPlayerId, setFilterPlayerId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

  // Distinct values for filter dropdowns
  const distinctPlayers = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of fullLog) {
      if (e.playerId && e.playerName) m.set(e.playerId, e.playerName);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [fullLog]);

  const distinctTypes = useMemo(() => {
    const s = new Set<string>();
    for (const e of fullLog) s.add(e.type);
    return [...s].sort();
  }, [fullLog]);

  // Apply all filters
  const filteredEntries = useMemo(() => {
    let result = fullLog;
    if (scope === 'mine' && viewingPlayerId) {
      result = result.filter(e => e.playerId === viewingPlayerId);
    }
    if (filterPlayerId !== 'all') {
      result = result.filter(e => e.playerId === filterPlayerId);
    }
    if (filterType !== 'all') {
      result = result.filter(e => e.type === filterType);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(e => {
        if (e.description?.toLowerCase().includes(q)) return true;
        if (e.playerName?.toLowerCase().includes(q)) return true;
        if (e.details) {
          const detailsStr = JSON.stringify(e.details).toLowerCase();
          if (detailsStr.includes(q)) return true;
        }
        return false;
      });
    }
    return result;
  }, [fullLog, scope, viewingPlayerId, filterPlayerId, filterType, searchText]);

  const buildMeta = (): ExportMetadata => {
    const appSemver = typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : '';
    const appCommit = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
    const version = appSemver && appCommit ? `${appSemver} (${appCommit})` : appSemver || appCommit || 'unknown';
    const scopePlayer = viewingPlayerId
      ? distinctPlayers.find(p => p.id === viewingPlayerId)?.name
      : null;
    return {
      gameId: getCurrentGameId() || 'unknown',
      exportedAt: new Date(),
      scopeLabel: scope === 'mine' && scopePlayer ? scopePlayer : 'All Players',
      appVersion: version,
    };
  };

  const handleExportMarkdown = () => {
    const meta = buildMeta();
    triggerTextDownload(exportLogToMarkdown(filteredEntries, meta), buildExportFilename(meta, 'md'), 'text/markdown');
  };
  const handleExportJson = () => {
    const meta = buildMeta();
    triggerTextDownload(exportLogToJson(filteredEntries, meta), buildExportFilename(meta, 'json'), 'application/json');
  };
  const handleExportCsv = () => {
    const meta = buildMeta();
    triggerTextDownload(exportLogToCsv(filteredEntries), buildExportFilename(meta, 'csv'), 'text/csv');
  };
  const handleExportPdf = () => {
    const meta = buildMeta();
    openPrintableTab(exportLogToPrintableHtml(filteredEntries, meta));
  };

  const toggleRow = (key: string) => setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));

  const sectionStyle: React.CSSProperties = {
    marginBottom: '16px',
    padding: '12px 16px',
    backgroundColor: colors.secondary.bg,
    borderRadius: '8px',
    border: `2px solid ${colors.secondary.border}`,
    textAlign: 'left',
  };

  if (!isOpen) {
    return (
      <div style={sectionStyle}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%',
            padding: '10px',
            background: colors.primary.main,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          🗒️ Review &amp; Export Game Log ({fullLog.length} entries)
        </button>
      </div>
    );
  }

  return (
    <div style={sectionStyle} data-testid="post-game-log-viewer">
      {/* Header row with collapse */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: colors.primary.dark }}>🗒️ Game Log</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: colors.text.secondary }}
        >
          Hide ✕
        </button>
      </div>

      {/* Filter controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        {viewingPlayerId && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setScope('mine')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                background: scope === 'mine' ? colors.primary.main : 'white',
                color: scope === 'mine' ? 'white' : colors.text.secondary,
                border: `1px solid ${colors.secondary.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              My log
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                background: scope === 'all' ? colors.primary.main : 'white',
                color: scope === 'all' ? 'white' : colors.text.secondary,
                border: `1px solid ${colors.secondary.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              All players
            </button>
          </div>
        )}
        <input
          type="text"
          placeholder="Search…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ flex: '1 1 140px', padding: '4px 8px', fontSize: '11px', border: `1px solid ${colors.secondary.border}`, borderRadius: '4px' }}
        />
        {scope === 'all' && distinctPlayers.length > 1 && (
          <select
            value={filterPlayerId}
            onChange={e => setFilterPlayerId(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '11px', border: `1px solid ${colors.secondary.border}`, borderRadius: '4px' }}
          >
            <option value="all">All players</option>
            {distinctPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ padding: '4px 8px', fontSize: '11px', border: `1px solid ${colors.secondary.border}`, borderRadius: '4px' }}
        >
          <option value="all">All types</option>
          {distinctTypes.map(t => (
            <option key={t} value={t}>{getLogTypeLabel(t as ActionLogEntry['type'])}</option>
          ))}
        </select>
      </div>

      {/* Result count */}
      <div style={{ fontSize: '10px', color: colors.text.secondary, marginBottom: '8px' }}>
        Showing {filteredEntries.length} of {fullLog.length} entries
      </div>

      {/* Log list */}
      <div style={{ maxHeight: '320px', overflowY: 'scroll', scrollbarGutter: 'stable', padding: '4px 8px', background: 'white', borderRadius: '4px', border: `1px solid ${colors.secondary.border}` }}>
        {filteredEntries.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: colors.secondary.main, fontStyle: 'italic', fontSize: '12px' }}>
            No entries match the current filters.
          </div>
        ) : (
          filteredEntries.map((entry, i) => {
            const rowKey = `pgl-${entry.id || i}`;
            const isExpanded = expandedRows[rowKey] || false;
            return (
              <div
                key={rowKey}
                onClick={() => toggleRow(rowKey)}
                style={{
                  padding: '4px 8px',
                  borderBottom: `1px solid ${colors.secondary.bg}`,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '9px', color: colors.secondary.main }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span style={{ color: colors.text.secondary }}>
                      <strong>{entry.playerName}:</strong> {formatActionDescription(entry)}
                    </span>
                  </span>
                </div>
                {isExpanded && <LogRowDetail entry={entry} />}
              </div>
            );
          })
        )}
      </div>

      {/* Export buttons */}
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '6px' }}>
          Export {filteredEntries.length} entries as:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button type="button" onClick={handleExportMarkdown} style={exportBtnStyle}>📝 Markdown</button>
          <button type="button" onClick={handleExportJson} style={exportBtnStyle}>{`{ } JSON`}</button>
          <button type="button" onClick={handleExportCsv} style={exportBtnStyle}>📊 CSV</button>
          <button type="button" onClick={handleExportPdf} style={exportBtnStyle}>🖨 PDF</button>
        </div>
      </div>
    </div>
  );
};

const exportBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '11px',
  fontWeight: 'bold',
  background: 'white',
  color: '#1565c0',
  border: '1px solid #1565c0',
  borderRadius: '4px',
  cursor: 'pointer',
};
