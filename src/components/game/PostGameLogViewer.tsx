import React, { useState, useMemo } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getDisplayableLogEntries } from '../../utils/logFiltering';
import { HistoryFeed, HistoryFeedFilters } from './HistoryFeed';
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

export const PostGameLogViewer: React.FC<PostGameLogViewerProps> = ({ viewingPlayerId }) => {
  const gameServices = useGameContext();
  const { stateService } = gameServices;
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
  const [searchText, setSearchText] = useState('');
  // 2026-08-25 (maintainer decision): the who/what dropdowns and the hand-rolled
  // row list that used to live here are now the shared <HistoryFeed/>'s chips and
  // rows — every history surface shows the same feed and differs only by filter.
  // This one opens scoped to whoever's end-game screen it is, widenable to the
  // whole table by the "Who" chip (what the old My log / All players pair did).
  const [filters, setFilters] = useState<HistoryFeedFilters>({
    who: viewingPlayerId ?? 'all',
    what: 'all',
  });

  // Distinct values for filter dropdowns
  const distinctPlayers = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of fullLog) {
      if (e.playerId && e.playerName) m.set(e.playerId, e.playerName);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [fullLog]);

  // Same canonical call HistoryFeed makes, minus the turn dividers — the
  // export is a record of events, not of the feed's headers.
  const filteredEntries = useMemo(
    () => getDisplayableLogEntries(fullLog, {
      filterPlayerId: filters.who,
      filterType: filters.what,
      search: searchText,
    }),
    [fullLog, filters.who, filters.what, searchText],
  );

  const buildMeta = (): ExportMetadata => {
    const appSemver = typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : '';
    const appCommit = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
    const version = appSemver && appCommit ? `${appSemver} (${appCommit})` : appSemver || appCommit || 'unknown';
    const scopePlayer = filters.who !== 'all'
      ? distinctPlayers.find(p => p.id === filters.who)?.name
      : null;
    return {
      gameId: getCurrentGameId() || 'unknown',
      exportedAt: new Date(),
      scopeLabel: scopePlayer || 'All Players',
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

      {/* Search — the one filter the shared feed's chips don't cover. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ flex: '1 1 140px', padding: '4px 8px', fontSize: '11px', border: `1px solid ${colors.secondary.border}`, borderRadius: '4px' }}
        />
      </div>

      {/* Result count */}
      <div style={{ fontSize: '10px', color: colors.text.secondary, marginBottom: '8px' }}>
        Showing {filteredEntries.length} of {fullLog.length} entries
      </div>

      {/* The shared feed — same rows, same wording, same Who/What chips as the
          player panel, the shared-screen Log and the TV column. */}
      <div style={{ maxHeight: '320px', overflowY: 'auto', scrollbarGutter: 'stable', padding: '8px', background: 'white', borderRadius: '4px', border: `1px solid ${colors.secondary.border}` }}>
        <HistoryFeed
          gameServices={gameServices}
          filters={filters}
          onFiltersChange={setFilters}
          defaultFilters={{ who: viewingPlayerId ?? 'all', what: 'all' }}
          extraFilters={{ search: searchText }}
          showRowDetail
          emptyText="No entries match the current filters."
          testId="post-game-log-feed"
        />
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
