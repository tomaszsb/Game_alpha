import { ActionLogEntry } from '../types/StateTypes';

export interface ExportMetadata {
  gameId: string;
  exportedAt: Date;
  scopeLabel: string;       // "Player 1" or "All Players"
  appVersion: string;
}

function formatTimestampISO(ts: Date | string): string {
  return (ts instanceof Date ? ts : new Date(ts)).toISOString();
}

function formatTimestampReadable(ts: Date | string): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString();
}

function detailToString(details: Record<string, unknown> | undefined): string {
  if (!details) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('; ');
}

// ============================================================================
// Markdown
// ============================================================================

export function exportLogToMarkdown(entries: ActionLogEntry[], meta: ExportMetadata): string {
  const lines: string[] = [];
  lines.push(`# Unravel Codes — Game Log`);
  lines.push('');
  lines.push(`- **Game:** ${meta.gameId}`);
  lines.push(`- **Scope:** ${meta.scopeLabel}`);
  lines.push(`- **Exported:** ${formatTimestampReadable(meta.exportedAt)}`);
  lines.push(`- **App version:** ${meta.appVersion}`);
  lines.push(`- **Entries:** ${entries.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group by globalTurnNumber for readability
  const byTurn = new Map<number, ActionLogEntry[]>();
  for (const e of entries) {
    const k = e.globalTurnNumber || 0;
    if (!byTurn.has(k)) byTurn.set(k, []);
    byTurn.get(k)!.push(e);
  }

  for (const [turn, turnEntries] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`## Turn ${turn}`);
    lines.push('');
    for (const e of turnEntries) {
      const ts = formatTimestampReadable(e.timestamp);
      lines.push(`- **${ts}** · *${e.type}* · **${e.playerName}** — ${e.description}`);
      const d = detailToString(e.details);
      if (d) lines.push(`  - _details:_ \`${d}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// JSON
// ============================================================================

export function exportLogToJson(entries: ActionLogEntry[], meta: ExportMetadata): string {
  return JSON.stringify(
    {
      gameId: meta.gameId,
      exportedAt: meta.exportedAt.toISOString(),
      scopeLabel: meta.scopeLabel,
      appVersion: meta.appVersion,
      entries,
    },
    null,
    2,
  );
}

// ============================================================================
// CSV
// ============================================================================

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportLogToCsv(entries: ActionLogEntry[]): string {
  const header = [
    'timestamp',
    'type',
    'playerId',
    'playerName',
    'gameRound',
    'globalTurnNumber',
    'playerTurnNumber',
    'description',
    'details',
  ].join(',');

  const rows = entries.map(e =>
    [
      formatTimestampISO(e.timestamp),
      e.type,
      e.playerId,
      csvEscape(e.playerName || ''),
      String(e.gameRound ?? ''),
      String(e.globalTurnNumber ?? ''),
      String(e.playerTurnNumber ?? ''),
      csvEscape(e.description || ''),
      csvEscape(detailToString(e.details)),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

// ============================================================================
// PDF — render printable HTML in a new tab, browser handles "Save as PDF"
// ============================================================================

export function exportLogToPrintableHtml(entries: ActionLogEntry[], meta: ExportMetadata): string {
  const rowsHtml = entries
    .map(e => {
      const ts = formatTimestampReadable(e.timestamp);
      const d = detailToString(e.details);
      return `
        <tr>
          <td>${ts}</td>
          <td>${escapeHtml(e.playerName)}</td>
          <td>T${escapeHtml(String(e.globalTurnNumber))}</td>
          <td>${e.type}</td>
          <td>${escapeHtml(e.description || '')}</td>
          <td><code>${escapeHtml(d)}</code></td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Unravel Codes — Game ${escapeHtml(meta.gameId)} Log</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1rem; color: #333; }
    h1 { color: #1565c0; }
    .meta { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
    .meta div { margin-bottom: 0.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; text-align: left; vertical-align: top; }
    th { background: #fafafa; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    code { font-size: 9px; color: #666; word-break: break-word; }
    @media print {
      body { margin: 0.5in; }
      .print-button { display: none !important; }
    }
  </style>
</head>
<body>
  <h1>Unravel Codes — Game Log</h1>
  <div class="meta">
    <div><strong>Game:</strong> ${escapeHtml(meta.gameId)}</div>
    <div><strong>Scope:</strong> ${escapeHtml(meta.scopeLabel)}</div>
    <div><strong>Exported:</strong> ${formatTimestampReadable(meta.exportedAt)}</div>
    <div><strong>App version:</strong> ${escapeHtml(meta.appVersion)}</div>
    <div><strong>Entries:</strong> ${entries.length}</div>
  </div>
  <button class="print-button" onclick="window.print()" style="padding: 0.5rem 1rem; margin-bottom: 1rem; cursor: pointer;">🖨 Print / Save as PDF</button>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Player</th>
        <th>Turn</th>
        <th>Type</th>
        <th>Description</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Download triggers
// ============================================================================

export function triggerTextDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so Safari has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function openPrintableTab(html: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    // Popup blocked — fall back to a download
    triggerTextDownload(html, 'unravel-game-log.html', 'text/html');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ============================================================================
// Filename helper
// ============================================================================

export function buildExportFilename(meta: ExportMetadata, extension: string): string {
  const date = meta.exportedAt.toISOString().slice(0, 10);
  const scopeSlug = meta.scopeLabel.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `unravel-${meta.gameId}-${scopeSlug}-${date}.${extension}`;
}
